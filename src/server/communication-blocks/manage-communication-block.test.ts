// @vitest-environment node

import { Buffer } from "node:buffer";

import { afterEach, describe, expect, it, vi } from "vitest";

const {
  createSessionSupabaseClientMock,
  getWorkspaceAccessMock,
  protectCommunicationBlockReasonMock,
} = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
  getWorkspaceAccessMock: vi.fn(),
  protectCommunicationBlockReasonMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

vi.mock("@/server/pii/protect-communication-block-reason", () => ({
  protectCommunicationBlockReason: protectCommunicationBlockReasonMock,
}));

import {
  liftContactCommunicationBlock,
  markContactDoNotCall,
} from "./manage-communication-block";

const opportunityId = "10000000-0000-4000-8000-000000000001";
const blockId = "20000000-0000-4000-8000-000000000001";
const reason = "Sentetik iletişim tercihi açıklaması.";

function allowAccess() {
  getWorkspaceAccessMock.mockResolvedValue({
    ok: true,
    userId: "30000000-0000-4000-8000-000000000001",
    workspace: {
      id: "40000000-0000-4000-8000-000000000001",
      name: "Engel Fixture",
    },
    membership: { role: "advisor" },
  });
}

function protectReason() {
  protectCommunicationBlockReasonMock.mockReturnValue({
    ok: true,
    data: {
      ciphertext: Buffer.from([1, 2, 3]),
      nonce: Buffer.alloc(12, 4),
      authTag: Buffer.alloc(16, 5),
      algorithm: "AES-256-GCM",
      keyVersion: 2,
    },
  });
}

describe("iletişim engeli sunucu servisi", () => {
  afterEach(() => {
    createSessionSupabaseClientMock.mockReset();
    getWorkspaceAccessMock.mockReset();
    protectCommunicationBlockReasonMock.mockReset();
  });

  it("viewer rolünü PII koruma ve veritabanından önce reddeder", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });

    const result = await markContactDoNotCall(opportunityId, reason);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(getWorkspaceAccessMock).toHaveBeenCalledWith({
      allowedRoles: ["owner", "advisor"],
    });
    expect(protectCommunicationBlockReasonMock).not.toHaveBeenCalled();
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("Aranmayacak nedenini yalnız şifreli zarfla atomik RPCye taşır", async () => {
    allowAccess();
    protectReason();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          communication_block_id: blockId,
          origin_opportunity_id: opportunityId,
          communication_block_active: true,
          affected_opportunity_count: 2,
          cancelled_task_count: 1,
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const result = await markContactDoNotCall(opportunityId, reason);

    expect(result).toEqual({
      ok: true,
      data: {
        communicationBlockId: blockId,
        opportunityId,
        active: true,
        affectedOpportunityCount: 2,
        cancelledTaskCount: 1,
      },
    });
    expect(protectCommunicationBlockReasonMock).toHaveBeenCalledWith(
      reason,
      "block",
    );
    expect(rpc).toHaveBeenCalledWith("mark_contact_do_not_call", {
      requested_opportunity_id: opportunityId,
      requested_reason_algorithm: "AES-256-GCM",
      requested_reason_auth_tag: `\\x${"05".repeat(16)}`,
      requested_reason_ciphertext: "\\x010203",
      requested_reason_key_version: 2,
      requested_reason_nonce: `\\x${"04".repeat(12)}`,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(reason);
  });

  it("engel kaldırma nedenini ayrı amaçla korur ve yeniden açma sayısını sıfır doğrular", async () => {
    allowAccess();
    protectReason();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          communication_block_id: blockId,
          origin_opportunity_id: opportunityId,
          communication_block_active: false,
          reopened_opportunity_count: 0,
          reopened_task_count: 0,
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const result = await liftContactCommunicationBlock(opportunityId, reason);

    expect(result).toEqual({
      ok: true,
      data: {
        communicationBlockId: blockId,
        opportunityId,
        active: false,
        reopenedOpportunityCount: 0,
        reopenedTaskCount: 0,
      },
    });
    expect(protectCommunicationBlockReasonMock).toHaveBeenCalledWith(
      reason,
      "lift",
    );
    expect(rpc).toHaveBeenCalledWith(
      "lift_contact_communication_block",
      expect.objectContaining({
        requested_opportunity_id: opportunityId,
        requested_lift_reason_ciphertext: "\\x010203",
      }),
    );
  });

  it("PII yapılandırma ayrıntısını RPCye veya kullanıcı sonucuna taşımaz", async () => {
    allowAccess();
    protectCommunicationBlockReasonMock.mockReturnValue({
      ok: false,
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message: "private-keyring-detail",
      },
    });

    const result = await markContactDoNotCall(opportunityId, reason);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "PII_PROTECTION_UNAVAILABLE" },
    });
    expect(JSON.stringify(result)).not.toContain("private-keyring-detail");
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("RLS, bulunamadı, kural ve bozuk sonuçları güvenli kodlara dönüştürür", async () => {
    allowAccess();
    protectReason();
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "42501", message: "private-policy-detail" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0002", message: "private-missing-detail" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "23514", message: "private-rule-detail" },
      })
      .mockResolvedValueOnce({
        data: [{ communication_block_id: "gecersiz" }],
        error: null,
      });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const forbidden = await markContactDoNotCall(opportunityId, reason);
    const notFound = await markContactDoNotCall(opportunityId, reason);
    const invalid = await markContactDoNotCall(opportunityId, reason);
    const malformed = await markContactDoNotCall(opportunityId, reason);

    expect(forbidden).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(notFound).toMatchObject({
      ok: false,
      error: { code: "OPPORTUNITY_NOT_FOUND" },
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "COMMUNICATION_BLOCK_RULE_VIOLATION" },
    });
    expect(malformed).toMatchObject({
      ok: false,
      error: { code: "COMMUNICATION_BLOCK_UNAVAILABLE" },
    });
    expect(
      JSON.stringify([forbidden, notFound, invalid, malformed]),
    ).not.toContain("private-");
  });
});
