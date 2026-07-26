// @vitest-environment node

import { Buffer } from "node:buffer";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { QuickFsboInput } from "@/features/fsbo/quick-fsbo-validation";

vi.mock("server-only", () => ({}));

const {
  createSessionSupabaseClientMock,
  getWorkspaceAccessMock,
  protectContactNameMock,
  protectTurkishPhoneMock,
  rpcMock,
} = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
  getWorkspaceAccessMock: vi.fn(),
  protectContactNameMock: vi.fn(),
  protectTurkishPhoneMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

vi.mock("@/server/pii/protect-contact-name", () => ({
  protectContactName: protectContactNameMock,
}));

vi.mock("@/server/pii/protect-phone", () => ({
  protectTurkishPhone: protectTurkishPhoneMock,
}));

import { createQuickFsbo } from "./create-quick-fsbo";

const subscriber = ["5", "55", "000", "00", "00"].join("");
const input: QuickFsboInput = {
  contactName: "Sentetik Kişi",
  phone: `0${subscriber}`,
  propertyType: "apartment",
  city: "İstanbul",
  district: "Kadıköy",
  neighborhood: "Fenerbahçe",
  roomCount: 3,
  livingRoomCount: 1,
  netAreaSqm: 110,
  grossAreaSqm: 125,
  platform: "sahibinden",
  externalListingId: "123456",
  canonicalUrl: "https://sahibinden.com/ilan/123456",
  transactionType: "sale",
  askingPrice: 7_500_000,
  nextActionAt: "2026-07-26T08:00:00.000Z",
};

function mockProtectedPii() {
  protectContactNameMock.mockReturnValue({
    ok: true,
    data: {
      ciphertext: Buffer.alloc(12, 1),
      nonce: Buffer.alloc(12, 2),
      authTag: Buffer.alloc(16, 3),
      algorithm: "AES-256-GCM",
      keyVersion: 2,
    },
  });
  protectTurkishPhoneMock.mockReturnValue({
    ok: true,
    data: {
      maskedValue: "+90 ••• ••• •• 00",
      envelope: {
        ciphertext: Buffer.alloc(12, 4),
        nonce: Buffer.alloc(12, 5),
        authTag: Buffer.alloc(16, 6),
        algorithm: "AES-256-GCM",
        keyVersion: 2,
      },
      blindIndex: Buffer.alloc(32, 7),
      blindIndexKeyVersion: 3,
    },
  });
}

describe("createQuickFsbo", () => {
  afterEach(() => {
    createSessionSupabaseClientMock.mockReset();
    getWorkspaceAccessMock.mockReset();
    protectContactNameMock.mockReset();
    protectTurkishPhoneMock.mockReset();
    rpcMock.mockReset();
  });

  it("owner/advisor yetkisini doğrulayıp yalnız şifreli PII ile atomik RPC çağırır", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Fixture",
      },
      membership: { role: "owner" },
    });
    mockProtectedPii();
    rpcMock.mockResolvedValue({
      data: [
        {
          opportunity_id: "11000000-0000-4000-8000-000000000001",
          listing_id: "12000000-0000-4000-8000-000000000001",
          stage: "new",
          next_action_at: "2026-07-26T08:00:00+00:00",
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc: rpcMock },
    });

    const result = await createQuickFsbo(input);

    expect(result).toEqual({
      ok: true,
      data: {
        opportunityId: "11000000-0000-4000-8000-000000000001",
        listingId: "12000000-0000-4000-8000-000000000001",
        stage: "new",
        nextActionAt: "2026-07-26T08:00:00+00:00",
        maskedPhone: "+90 ••• ••• •• 00",
      },
    });
    expect(getWorkspaceAccessMock).toHaveBeenCalledWith({
      allowedRoles: ["owner", "advisor"],
    });
    const rpcArguments = rpcMock.mock.calls[0]?.[1];
    const serializedArguments = JSON.stringify(rpcArguments);

    expect(rpcMock).toHaveBeenCalledWith(
      "create_quick_fsbo",
      expect.objectContaining({
        requested_phone_ciphertext: expect.stringMatching(/^\\x[0-9a-f]+$/),
        requested_phone_blind_index: expect.stringMatching(/^\\x[0-9a-f]{64}$/),
        requested_display_name_ciphertext: expect.stringMatching(
          /^\\x[0-9a-f]+$/,
        ),
        requested_next_action_at: input.nextActionAt,
      }),
    );
    expect(rpcArguments).not.toHaveProperty("workspace_id");
    expect(serializedArguments).not.toContain(input.phone);
    expect(serializedArguments).not.toContain(input.contactName);
  });

  it("viewer veya workspace hatasında PII işleme ve RPC çalıştırmaz", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });

    const result = await createQuickFsbo(input);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });
    expect(protectTurkishPhoneMock).not.toHaveBeenCalled();
    expect(protectContactNameMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("PII koruması yoksa hiçbir veritabanı yazımı başlatmaz", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Fixture",
      },
      membership: { role: "advisor" },
    });
    protectTurkishPhoneMock.mockReturnValue({
      ok: false,
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message: "özel-ayrıntı",
      },
    });
    protectContactNameMock.mockReturnValue({
      ok: false,
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message: "özel-ayrıntı",
      },
    });

    const result = await createQuickFsbo(input);

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("özel-ayrıntı");
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("RPC ve bozuk yanıt ayrıntılarını güvenli Türkçe hataya indirger", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Fixture",
      },
      membership: { role: "owner" },
    });
    mockProtectedPii();
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc: rpcMock },
    });
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST999",
        message: "özel-veritabanı-ayrıntısı",
      },
    });

    const result = await createQuickFsbo(input);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "QUICK_FSBO_UNAVAILABLE",
        message: "FSBO kaydı şu anda oluşturulamıyor. Lütfen yeniden deneyin.",
      },
    });
    expect(JSON.stringify(result)).not.toContain("özel-veritabanı-ayrıntısı");
  });
});
