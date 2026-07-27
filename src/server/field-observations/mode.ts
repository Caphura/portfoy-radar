import "server-only";

import { z } from "zod";

import releasePolicy from "../../../config/release-policy.json";

import { hasApprovedLivePiiEvidence } from "@/server/release/release-readiness-core";

export const fieldObservationModes = [
  "disabled",
  "synthetic",
  "live",
] as const;

export type FieldObservationMode = (typeof fieldObservationModes)[number];

export type FieldObservationModeResult =
  | {
      ok: true;
      mode: Exclude<FieldObservationMode, "disabled">;
    }
  | {
      ok: false;
      error: {
        code: "FIELD_OBSERVATION_DISABLED";
        message: string;
      };
    };

export function getFieldObservationMode(
  environment: Record<string, string | undefined> = process.env,
  policyInput: unknown = releasePolicy,
): FieldObservationModeResult {
  const parsed = z
    .enum(fieldObservationModes)
    .safeParse(environment.FIELD_OBSERVATION_MODE ?? "disabled");

  if (!parsed.success || parsed.data === "disabled") {
    return {
      ok: false,
      error: {
        code: "FIELD_OBSERVATION_DISABLED",
        message:
          "Saha kaydı bu ortamda kapalı. Üretim kanıtları tamamlanmadan gerçek fotoğraf yüklemeyin.",
      },
    };
  }

  if (
    parsed.data === "live" &&
    !hasApprovedLivePiiEvidence(policyInput)
  ) {
    return {
      ok: false,
      error: {
        code: "FIELD_OBSERVATION_DISABLED",
        message:
          "Gerçek saha kaydı release-v2 kanıtları tamamlanmadan açılamaz.",
      },
    };
  }

  return {
    ok: true,
    mode: parsed.data,
  };
}
