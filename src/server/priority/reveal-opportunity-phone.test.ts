// @vitest-environment node

import { Buffer } from "node:buffer";

import { afterEach, describe, expect, it, vi } from "vitest";

import { encryptPii } from "@/server/pii/crypto-core";

const {
  createSessionSupabaseClientMock,
  getPiiProtectionConfigMock,
  getWorkspaceAccessMock,
} = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
  getPiiProtectionConfigMock: vi.fn(),
  getWorkspaceAccessMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

vi.mock("@/server/pii/environment", () => ({
  getPiiProtectionConfig: getPiiProtectionConfigMock,
}));

import { revealOpportunityPhone } from "./reveal-opportunity-phone";

const opportunityId = "10000000-0000-4000-8000-000000000001";
const subscriber = ["5", "55", "000", "00", "00"].join("");
const normalizedPhone = `+90${subscriber}`;
const encryptionKey = Buffer.alloc(32, 21);

function allowAccess() {
  getWorkspaceAccessMock.mockResolvedValue({
    ok: true,
    userId: "20000000-0000-4000-8000-000000000001",
    workspace: {
      id: "30000000-0000-4000-8000-000000000001",
      name: "Telefon Fixture",
    },
    membership: { role: "advisor" },
  });
}

function configureProtection() {
  getPiiProtectionConfigMock.mockReturnValue({
    ok: true,
    data: {
      encryption: {
        keys: new Map([[2, encryptionKey]]),
        activeVersion: 2,
      },
      phoneHmac: {
        keys: new Map([[3, Buffer.alloc(32, 22)]]),
        activeVersion: 3,
      },
    },
  });
}

function bytea(value: Buffer) {
  return `\\x${value.toString("hex")}`;
}

function encryptedPhoneRow() {
  const encrypted = encryptPii(
    normalizedPhone,
    "contact.phone",
    new Map([[2, encryptionKey]]),
    2,
  );

  if (!encrypted.ok) {
    throw new Error("Sentetik telefon zarfı hazırlanamadı.");
  }

  return {
    opportunity_id: opportunityId,
    value_ciphertext: bytea(encrypted.data.ciphertext),
    value_nonce: bytea(encrypted.data.nonce),
    value_auth_tag: bytea(encrypted.data.authTag),
    encryption_algorithm: encrypted.data.algorithm,
    encryption_key_version: encrypted.data.keyVersion,
  };
}

describe("revealOpportunityPhone", () => {
  afterEach(() => {
    createSessionSupabaseClientMock.mockReset();
    getPiiProtectionConfigMock.mockReset();
    getWorkspaceAccessMock.mockReset();
  });

  it("owner/advisor için auditli RPC zarfını sunucuda çözüp tek E.164 değer döndürür", async () => {
    allowAccess();
    configureProtection();
    const rpc = vi.fn().mockResolvedValue({
      data: [encryptedPhoneRow()],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const result = await revealOpportunityPhone(opportunityId);

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.opportunityId).toBe(opportunityId);
    expect(result.ok && result.data.phone.endsWith(subscriber)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("reveal_opportunity_phone", {
      requested_opportunity_id: opportunityId,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(subscriber);
  });

  it("viewer rolünü anahtar ve veritabanına erişmeden reddeder", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "private-role-detail",
      },
    });

    const result = await revealOpportunityPhone(opportunityId);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(getWorkspaceAccessMock).toHaveBeenCalledWith({
      allowedRoles: ["owner", "advisor"],
    });
    expect(getPiiProtectionConfigMock).not.toHaveBeenCalled();
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private-role-detail");
  });

  it("geçersiz kimlik ve PII yapılandırma hatasında güvenli sonuç verir", async () => {
    const invalid = await revealOpportunityPhone("gecersiz");

    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "OPPORTUNITY_PHONE_NOT_FOUND" },
    });
    expect(getWorkspaceAccessMock).not.toHaveBeenCalled();

    allowAccess();
    getPiiProtectionConfigMock.mockReturnValue({
      ok: false,
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message: "private-keyring-detail",
      },
    });

    const unavailable = await revealOpportunityPhone(opportunityId);

    expect(unavailable).toMatchObject({
      ok: false,
      error: { code: "PII_PROTECTION_UNAVAILABLE" },
    });
    expect(JSON.stringify(unavailable)).not.toContain("private-keyring-detail");
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("RLS, bulunamadı ve bozuk zarf ayrıntılarını kullanıcıya sızdırmaz", async () => {
    allowAccess();
    configureProtection();
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
        data: [{ ...encryptedPhoneRow(), value_auth_tag: "\\x00" }],
        error: null,
      });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const forbidden = await revealOpportunityPhone(opportunityId);
    const missing = await revealOpportunityPhone(opportunityId);
    const malformed = await revealOpportunityPhone(opportunityId);

    expect(forbidden).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(missing).toMatchObject({
      ok: false,
      error: { code: "OPPORTUNITY_PHONE_NOT_FOUND" },
    });
    expect(malformed).toMatchObject({
      ok: false,
      error: { code: "PII_PROTECTION_UNAVAILABLE" },
    });
    expect(JSON.stringify([forbidden, missing, malformed])).not.toContain(
      "private-",
    );
  });
});
