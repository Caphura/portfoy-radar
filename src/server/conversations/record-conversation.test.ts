// @vitest-environment node

import { Buffer } from "node:buffer";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationInput } from "@/features/conversations/conversation-validation";

const {
  createSessionSupabaseClientMock,
  getWorkspaceAccessMock,
  protectConversationFieldsMock,
} = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
  getWorkspaceAccessMock: vi.fn(),
  protectConversationFieldsMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

vi.mock("@/server/pii/protect-conversation-fields", () => ({
  protectConversationFields: protectConversationFieldsMock,
}));

import { recordConversation } from "./record-conversation";

const input: ConversationInput = {
  opportunityId: "10000000-0000-4000-8000-000000000001",
  channel: "phone",
  result: "unreachable",
  occurredAt: "2026-07-26T09:00:00.000Z",
  note: "Sentetik görüşme özeti.",
  requiresFollowUp: true,
  followUpAt: "2026-07-27T09:00:00.000Z",
  followUpPurpose: "Fiyat beklentisini yeniden görüş.",
};

function allowAccess() {
  getWorkspaceAccessMock.mockResolvedValue({
    ok: true,
    userId: "20000000-0000-4000-8000-000000000001",
    workspace: {
      id: "30000000-0000-4000-8000-000000000001",
      name: "Görüşme Fixture",
    },
    membership: { role: "advisor" },
  });
}

function protectFields() {
  protectConversationFieldsMock.mockReturnValue({
    ok: true,
    data: {
      note: {
        ciphertext: Buffer.from([1, 2, 3]),
        nonce: Buffer.alloc(12, 4),
        authTag: Buffer.alloc(16, 5),
        algorithm: "AES-256-GCM",
        keyVersion: 2,
      },
      followUpPurpose: {
        ciphertext: Buffer.from([6, 7, 8]),
        nonce: Buffer.alloc(12, 9),
        authTag: Buffer.alloc(16, 10),
        algorithm: "AES-256-GCM",
        keyVersion: 2,
      },
    },
  });
}

describe("recordConversation", () => {
  afterEach(() => {
    createSessionSupabaseClientMock.mockReset();
    getWorkspaceAccessMock.mockReset();
    protectConversationFieldsMock.mockReset();
  });

  it("viewer rolünü PII koruma veya veritabanı çağrısından önce reddeder", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });

    const result = await recordConversation(input);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(getWorkspaceAccessMock).toHaveBeenCalledWith({
      allowedRoles: ["owner", "advisor"],
    });
    expect(protectConversationFieldsMock).not.toHaveBeenCalled();
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("not ve amacı yalnız şifreli zarflarla atomik RPCye taşır", async () => {
    allowAccess();
    protectFields();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          conversation_id: "40000000-0000-4000-8000-000000000001",
          follow_up_task_id: "50000000-0000-4000-8000-000000000001",
          opportunity_id: input.opportunityId,
          requires_follow_up: true,
          next_action_type: "follow_up",
          next_action_at: input.followUpAt,
          occurred_at: input.occurredAt,
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const result = await recordConversation(input);

    expect(result).toEqual({
      ok: true,
      data: {
        conversationId: "40000000-0000-4000-8000-000000000001",
        followUpTaskId: "50000000-0000-4000-8000-000000000001",
        opportunityId: input.opportunityId,
        requiresFollowUp: true,
        nextActionAt: input.followUpAt,
        occurredAt: input.occurredAt,
      },
    });
    expect(rpc).toHaveBeenCalledWith(
      "record_conversation",
      expect.objectContaining({
        requested_opportunity_id: input.opportunityId,
        requested_result: "unreachable",
        requested_requires_follow_up: true,
        requested_note_ciphertext: "\\x010203",
        requested_follow_up_purpose_ciphertext: "\\x060708",
      }),
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(input.note);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(
      input.followUpPurpose,
    );
  });

  it("PII yapılandırma ayrıntısını veritabanına veya sonuç DTOsuna taşımaz", async () => {
    allowAccess();
    protectConversationFieldsMock.mockReturnValue({
      ok: false,
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message: "private-keyring-detail",
      },
    });

    const result = await recordConversation(input);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "PII_PROTECTION_UNAVAILABLE" },
    });
    expect(JSON.stringify(result)).not.toContain("private-keyring-detail");
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("RLS, bulunamadı ve kural hatalarını güvenli kodlara dönüştürür", async () => {
    allowAccess();
    protectFields();
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
      });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const forbidden = await recordConversation(input);
    const notFound = await recordConversation(input);
    const invalid = await recordConversation(input);

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
      error: { code: "CONVERSATION_RULE_VIOLATION" },
    });
    expect(JSON.stringify([forbidden, notFound, invalid])).not.toContain(
      "private-",
    );
  });

  it("bozuk RPC sonucunu başarılı saymaz", async () => {
    allowAccess();
    protectFields();
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: {
        rpc: vi.fn().mockResolvedValue({
          data: [{ conversation_id: "gecersiz" }],
          error: null,
        }),
      },
    });

    const result = await recordConversation(input);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CONVERSATION_UNAVAILABLE" },
    });
  });
});
