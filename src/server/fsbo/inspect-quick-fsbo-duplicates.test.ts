// @vitest-environment node

import { Buffer } from "node:buffer";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { QuickFsboInput } from "@/features/fsbo/quick-fsbo-validation";

vi.mock("server-only", () => ({}));

const {
  createSessionSupabaseClientMock,
  getWorkspaceAccessMock,
  protectTurkishPhoneMock,
  rpcMock,
} = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
  getWorkspaceAccessMock: vi.fn(),
  protectTurkishPhoneMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

vi.mock("@/server/pii/protect-phone", () => ({
  protectTurkishPhone: protectTurkishPhoneMock,
}));

import { inspectQuickFsboDuplicates } from "./inspect-quick-fsbo-duplicates";

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

describe("inspectQuickFsboDuplicates", () => {
  afterEach(() => {
    createSessionSupabaseClientMock.mockReset();
    getWorkspaceAccessMock.mockReset();
    protectTurkishPhoneMock.mockReset();
    rpcMock.mockReset();
  });

  it("telefon HMACiyle sıralı ve PII içermeyen aday DTOsu üretir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Fixture",
      },
      membership: { role: "owner" },
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
    rpcMock.mockResolvedValue({
      data: [
        {
          candidate_key: [
            "11000000-0000-4000-8000-000000000001",
            "12000000-0000-4000-8000-000000000001",
            "13000000-0000-4000-8000-000000000001",
            "-",
          ].join(":"),
          match_rank: 1,
          match_kinds: ["platform_listing", "canonical_url"],
          contact_id: "11000000-0000-4000-8000-000000000001",
          property_id: "12000000-0000-4000-8000-000000000001",
          listing_id: "13000000-0000-4000-8000-000000000001",
          opportunity_id: null,
          platform: "sahibinden",
          external_listing_id: "123456",
          transaction_type: "sale",
          listing_status: "active",
          opportunity_stage: null,
          next_action_at: null,
          city: "İstanbul",
          district: "Kadıköy",
          neighborhood: "Fenerbahçe",
          room_count: 3,
          living_room_count: 1,
          net_area_sqm: 110,
          gross_area_sqm: 125,
          asking_price: 7_500_000,
          currency: "TRY",
          last_seen_at: "2026-07-26T08:00:00.000Z",
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc: rpcMock },
    });

    const result = await inspectQuickFsboDuplicates(input);

    expect(result).toMatchObject({
      ok: true,
      data: {
        maskedPhone: "+90 ••• ••• •• 00",
        candidates: [
          {
            rank: 1,
            matchKinds: ["platform_listing", "canonical_url"],
            linkable: true,
            listing: {
              externalListingId: "123456",
            },
            property: {
              neighborhood: "Fenerbahçe",
            },
          },
        ],
      },
    });
    const rpcArguments = rpcMock.mock.calls[0]?.[1];
    expect(rpcArguments).toMatchObject({
      requested_phone_blind_index: expect.stringMatching(/^\\x[0-9a-f]{64}$/),
      requested_phone_blind_index_key_version: 3,
    });
    expect(JSON.stringify(rpcArguments)).not.toContain(input.phone);
    expect(JSON.stringify(result)).not.toContain(input.contactName);
    expect(JSON.stringify(result)).not.toContain(subscriber.slice(0, -2));
  });

  it("viewer rolünde telefon işlemeden güvenli yetki hatası döndürür", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });

    const result = await inspectQuickFsboDuplicates(input);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });
    expect(protectTurkishPhoneMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("bozuk RPC yanıtını ayrıntı sızdırmayan Türkçe hataya indirger", async () => {
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
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc: rpcMock },
    });
    rpcMock.mockResolvedValue({
      data: [{ private_value: "sunucu-ayrıntısı" }],
      error: null,
    });

    const result = await inspectQuickFsboDuplicates(input);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "DUPLICATE_CHECK_UNAVAILABLE",
        message:
          "Mükerrer denetimi şu anda tamamlanamıyor. Lütfen yeniden deneyin.",
      },
    });
    expect(JSON.stringify(result)).not.toContain("sunucu-ayrıntısı");
  });
});
