import { z } from "zod";

import type { PiiProtectionStatusResult } from "@/server/pii/status-core";
import type { DatabaseStatusResult } from "@/server/system/database-status-core";

const gateBaseSchema = z.object({
  id: z.enum([
    "secret-manager",
    "data-region-kvkk",
    "backup-restore",
    "sensitive-media-location",
  ]),
  label: z.string().min(3).max(120),
  owner: z.enum(["Güvenlik", "Ürün sahibi", "Operasyon"]),
  closureCriteria: z.string().min(20).max(400),
});

const openGateSchema = gateBaseSchema.extend({
  status: z.literal("open"),
});

const approvedGateSchema = gateBaseSchema.extend({
  status: z.literal("approved"),
  evidence: z.object({
    reference: z.string().regex(/^[A-Z][A-Z0-9-]{2,63}$/),
    approvedAt: z.iso.datetime({ offset: true }),
    approvedByRole: z.enum(["Güvenlik", "Ürün sahibi", "Operasyon"]),
  }),
});

const releasePolicySchema = z
  .object({
    version: z.literal("release-v2"),
    defaultDecision: z.literal("blocked-until-approved"),
    manualGates: z
      .array(z.discriminatedUnion("status", [openGateSchema, approvedGateSchema]))
      .length(4),
  })
  .superRefine((policy, context) => {
    const expectedIds = [
      "secret-manager",
      "data-region-kvkk",
      "backup-restore",
      "sensitive-media-location",
    ];

    if (
      policy.manualGates.some(
        (gate, index) => gate.id !== expectedIds[index],
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Release kapıları beklenen sırada değil.",
        path: ["manualGates"],
      });
    }
  });

export type ReleaseTechnicalCheck = {
  id: "database-contract" | "pii-protection";
  label: string;
  status: "passed" | "failed";
  detail: string;
};

export type ReleaseManualGate = {
  id:
    | "secret-manager"
    | "data-region-kvkk"
    | "backup-restore"
    | "sensitive-media-location";
  label: string;
  owner: "Güvenlik" | "Ürün sahibi" | "Operasyon";
  closureCriteria: string;
  status: "open" | "approved";
  evidenceReference?: string;
};

export type ReleaseReadiness = {
  version: "release-v2";
  decision: "blocked" | "ready";
  livePiiAllowed: boolean;
  summary: string;
  technicalChecks: ReleaseTechnicalCheck[];
  manualGates: ReleaseManualGate[];
};

export type ReleaseReadinessEvaluationResult =
  | {
      ok: true;
      data: ReleaseReadiness;
    }
  | {
      ok: false;
      error: {
        code: "INVALID_RELEASE_POLICY";
        message: string;
      };
    };

export function hasApprovedLivePiiEvidence(policyInput: unknown): boolean {
  const policy = releasePolicySchema.safeParse(policyInput);

  return (
    policy.success &&
    policy.data.manualGates.every((gate) => gate.status === "approved")
  );
}

export function evaluateReleaseReadiness(input: {
  database: DatabaseStatusResult;
  piiProtection: PiiProtectionStatusResult;
  policy: unknown;
}): ReleaseReadinessEvaluationResult {
  const policy = releasePolicySchema.safeParse(input.policy);

  if (!policy.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_RELEASE_POLICY",
        message:
          "Release politikası doğrulanamadı. Canlı kişisel veri yayını güvenli biçimde engellendi.",
      },
    };
  }

  const technicalChecks: ReleaseTechnicalCheck[] = [
    input.database.ok
      ? {
          id: "database-contract",
          label: "Migration, RLS ve veritabanı sözleşmesi",
          status: "passed",
          detail: `Şema v${input.database.data.schemaVersion} doğrulandı; temiz migration ve negatif RLS testleri release komutunda zorunludur.`,
        }
      : {
          id: "database-contract",
          label: "Migration, RLS ve veritabanı sözleşmesi",
          status: "failed",
          detail: input.database.error.message,
        },
    input.piiProtection.ok
      ? {
          id: "pii-protection",
          label: "PII şifreleme ve mükerrer blind index",
          status: "passed",
          detail:
            "Ayrı, sürümlü AES-256-GCM ve HMAC-SHA-256 keyring sözleşmeleri doğrulandı.",
        }
      : {
          id: "pii-protection",
          label: "PII şifreleme ve mükerrer blind index",
          status: "failed",
          detail: input.piiProtection.error.message,
        },
  ];
  const manualGates: ReleaseManualGate[] = policy.data.manualGates.map(
    (gate) => ({
      id: gate.id,
      label: gate.label,
      owner: gate.owner,
      closureCriteria: gate.closureCriteria,
      status: gate.status,
      ...("evidence" in gate
        ? { evidenceReference: gate.evidence.reference }
        : {}),
    }),
  );
  const livePiiAllowed =
    technicalChecks.every((check) => check.status === "passed") &&
    manualGates.every((gate) => gate.status === "approved");

  return {
    ok: true,
    data: {
      version: policy.data.version,
      decision: livePiiAllowed ? "ready" : "blocked",
      livePiiAllowed,
      summary: livePiiAllowed
        ? "Teknik kontroller ve zorunlu üretim kanıtları tamamlandı."
        : "Canlı kişisel veri yayını için teknik kontrol veya zorunlu kanıt bekleniyor.",
      technicalChecks,
      manualGates,
    },
  };
}
