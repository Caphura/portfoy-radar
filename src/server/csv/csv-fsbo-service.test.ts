// @vitest-environment node

import { Buffer } from "node:buffer";

import { afterEach, describe, expect, it, vi } from "vitest";

import { fsboImportHeaders } from "@/features/csv/fsbo-csv-contract";

vi.mock("server-only", () => ({}));

const {
  createSessionSupabaseClientMock,
  decryptPiiMock,
  getPiiProtectionConfigMock,
  getWorkspaceAccessMock,
  protectContactNameMock,
  protectDuplicateReasonMock,
  protectTurkishPhoneMock,
  rpcMock,
} = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
  decryptPiiMock: vi.fn(),
  getPiiProtectionConfigMock: vi.fn(),
  getWorkspaceAccessMock: vi.fn(),
  protectContactNameMock: vi.fn(),
  protectDuplicateReasonMock: vi.fn(),
  protectTurkishPhoneMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));
vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));
vi.mock("@/server/pii/environment", () => ({
  getPiiProtectionConfig: getPiiProtectionConfigMock,
}));
vi.mock("@/server/pii/protect-phone", () => ({
  protectTurkishPhone: protectTurkishPhoneMock,
}));
vi.mock("@/server/pii/protect-contact-name", () => ({
  protectContactName: protectContactNameMock,
}));
vi.mock("@/server/pii/protect-duplicate-reason", () => ({
  protectDuplicateReason: protectDuplicateReasonMock,
}));
vi.mock("@/server/pii/crypto-core", () => ({
  decryptPii: decryptPiiMock,
}));

import {
  confirmCsvFsboImport,
  exportWorkspaceFsboCsv,
  previewCsvFsboImport,
} from "./csv-fsbo-service";

const now = new Date("2026-07-27T09:00:00.000Z");
const subscriber = ["5", "32", "000", "00", "01"].join("");
const rawPhone = `0${subscriber}`;
const candidateKey = [
  "11000000-0000-4000-8000-000000000001",
  "12000000-0000-4000-8000-000000000001",
  "13000000-0000-4000-8000-000000000001",
  "-",
].join(":");

function validCsvFile() {
  const row = [
    "sahibinden",
    "12345",
    "https://www.sahibinden.com/ilan/12345",
    "sale",
    "apartment",
    "İstanbul",
    "Kadıköy",
    "Moda",
    "3",
    "1",
    "100.00",
    "120.00",
    "7500000.00",
    "TRY",
    "Sentetik Kişi",
    rawPhone,
    "2026-07-28T12:00:00+03:00",
  ].join(";");
  const bytes = new TextEncoder().encode(
    `\uFEFF${fsboImportHeaders.join(";")}\r\n${row}\r\n`,
  );
  const arrayBuffer = vi.fn(async () =>
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer
  );

  return {
    name: "fsbo.csv",
    size: bytes.byteLength,
    type: "text/csv",
    arrayBuffer,
  };
}

function grantAccess() {
  getWorkspaceAccessMock.mockResolvedValue({
    ok: true,
    userId: "10000000-0000-4000-8000-000000000001",
    workspace: {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Fixture",
    },
    membership: { role: "owner" },
  });
}

function protectedEnvelope(byte: number) {
  return {
    ciphertext: Buffer.alloc(8, byte),
    nonce: Buffer.alloc(12, byte + 1),
    authTag: Buffer.alloc(16, byte + 2),
    algorithm: "AES-256-GCM" as const,
    keyVersion: 1,
  };
}

function protectPhone() {
  protectTurkishPhoneMock.mockReturnValue({
    ok: true,
    data: {
      maskedValue: "+90 ••• ••• •• 01",
      envelope: protectedEnvelope(1),
      blindIndex: Buffer.alloc(32, 9),
      blindIndexKeyVersion: 2,
    },
  });
}

describe("CSV FSBO servisi", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("viewer rolünde dosyayı veya PII’yi işlemeden durur", async () => {
    const file = validCsvFile();
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });

    const result = await previewCsvFsboImport(file, now);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(protectTurkishPhoneMock).not.toHaveBeenCalled();
  });

  it("önizlemede yalnız HMAC ve iş alanlarını gönderip maskeli aday döndürür", async () => {
    grantAccess();
    protectPhone();
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc: rpcMock },
    });
    rpcMock.mockResolvedValue({
      data: [
        {
          preview_id: "30000000-0000-4000-8000-000000000001",
          expires_at: "2026-07-28T09:00:00.000Z",
          rows: [
            {
              rowNumber: 1,
              candidateCount: 1,
              candidatesTruncated: false,
              candidates: [
                {
                  key: candidateKey,
                  rank: 1,
                  matchKinds: ["platform_listing"],
                  linkable: true,
                  listing: {
                    platform: "sahibinden",
                    externalListingId: "12345",
                    transactionType: "sale",
                    status: "active",
                    askingPrice: 7500000,
                    currency: "TRY",
                    lastSeenAt: "2026-07-27T09:00:00.000Z",
                  },
                  property: {
                    city: "İstanbul",
                    district: "Kadıköy",
                    neighborhood: "Moda",
                    roomCount: 3,
                    livingRoomCount: 1,
                    netAreaSqm: 100,
                    grossAreaSqm: 120,
                  },
                  opportunity: {
                    stage: "new",
                    nextActionAt: "2026-07-28T09:00:00.000Z",
                  },
                },
              ],
            },
          ],
        },
      ],
      error: null,
    });

    const result = await previewCsvFsboImport(validCsvFile(), now);

    expect(result).toMatchObject({
      ok: true,
      data: {
        rowCount: 1,
        duplicateRowCount: 1,
        rows: [{ maskedPhone: "+90 ••• ••• •• 01" }],
      },
    });
    const args = rpcMock.mock.calls[0]?.[1];
    expect(args).toMatchObject({
      requested_file_sha256: expect.stringMatching(/^\\x[0-9a-f]{64}$/),
      requested_rows: [
        {
          phone_blind_index: expect.stringMatching(/^\\x[0-9a-f]{64}$/),
        },
      ],
    });
    expect(JSON.stringify(args)).not.toContain(rawPhone);
    expect(JSON.stringify(args)).not.toContain("Sentetik Kişi");
    expect(JSON.stringify(result)).not.toContain(subscriber.slice(0, -2));
  });

  it("onayda PII zarflarını gönderir ve atomik toplu sonucu özetler", async () => {
    grantAccess();
    protectPhone();
    protectContactNameMock.mockReturnValue({
      ok: true,
      data: protectedEnvelope(5),
    });
    protectDuplicateReasonMock.mockReturnValue({
      ok: true,
      data: protectedEnvelope(10),
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc: rpcMock },
    });
    rpcMock.mockResolvedValue({
      data: [
        {
          import_id: "40000000-0000-4000-8000-000000000001",
          processed_count: 1,
          created_new_count: 0,
          used_existing_count: 0,
          linked_existing_property_count: 0,
          created_separate_count: 1,
        },
      ],
      error: null,
    });

    const result = await confirmCsvFsboImport(
      "30000000-0000-4000-8000-000000000001",
      validCsvFile(),
      {
        1: {
          decision: "keep_separate",
          candidateKey,
          separationReason: "Kayıtların malikleri farklı.",
        },
      },
      now,
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        processedCount: 1,
        createdSeparateCount: 1,
      },
    });
    const args = rpcMock.mock.calls[0]?.[1];
    expect(args).toMatchObject({
      requested_rows: [
        {
          display_name_ciphertext: expect.stringMatching(/^\\x/),
          phone_ciphertext: expect.stringMatching(/^\\x/),
        },
      ],
      requested_decisions: {
        "1": {
          decision: "keep_separate",
          candidate_key: candidateKey,
          reason_ciphertext: expect.stringMatching(/^\\x/),
        },
      },
    });
    expect(JSON.stringify(args)).not.toContain(rawPhone);
    expect(JSON.stringify(args)).not.toContain("Kayıtların malikleri");
  });

  it("dışa aktarımı maskeler ve hesap tablosu formüllerini etkisizleştirir", async () => {
    grantAccess();
    getPiiProtectionConfigMock.mockReturnValue({
      ok: true,
      data: {
        encryption: { keys: new Map([[1, Buffer.alloc(32)]]), activeVersion: 1 },
        phoneHmac: { keys: new Map([[1, Buffer.alloc(32, 1)]]), activeVersion: 1 },
      },
    });
    decryptPiiMock.mockReturnValue({ ok: true, data: `+90${subscriber}` });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc: rpcMock },
    });
    rpcMock.mockResolvedValue({
      data: [
        {
          export_id: "50000000-0000-4000-8000-000000000001",
          export_version: "fsbo-v1",
          total_count: 1,
          truncated: false,
          rows: [
            {
              opportunityId: "60000000-0000-4000-8000-000000000001",
              stage: "new",
              nextActionAt: "2026-07-28T09:00:00.000Z",
              propertyType: "apartment",
              city: "=FORMULA",
              district: "Kadıköy",
              neighborhood: "Moda",
              roomCount: 3,
              livingRoomCount: 1,
              netAreaSqm: 100,
              grossAreaSqm: 120,
              platform: "sahibinden",
              externalListingId: "12345",
              canonicalUrl: "https://example.com/12345",
              transactionType: "sale",
              askingPrice: 7500000,
              currency: "TRY",
              phoneCiphertextHex: "0102",
              phoneNonceHex: "03".repeat(12),
              phoneAuthTagHex: "04".repeat(16),
              phoneAlgorithm: "AES-256-GCM",
              phoneKeyVersion: 1,
            },
          ],
        },
      ],
      error: null,
    });

    const result = await exportWorkspaceFsboCsv();

    expect(result).toMatchObject({
      ok: true,
      data: { totalCount: 1, truncated: false },
    });
    if (result.ok) {
      expect(result.data.content.startsWith("\uFEFF")).toBe(true);
      expect(result.data.content).toContain("'+90");
      expect(result.data.content).toContain("'=FORMULA");
      expect(result.data.content).not.toContain(subscriber.slice(0, -2));
    }
  });
});
