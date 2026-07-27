import "server-only";

import releasePolicy from "../../../config/release-policy.json";

import { getPiiProtectionStatus } from "@/server/pii/get-protection-status";
import { getDatabaseStatus } from "@/server/system/get-database-status";
import {
  getWorkspaceAccess,
  type WorkspaceAccessError,
} from "@/server/workspace/access";

import {
  evaluateReleaseReadiness,
  type ReleaseReadinessEvaluationResult,
} from "./release-readiness-core";

export type ReleaseReadinessResult =
  | ReleaseReadinessEvaluationResult
  | {
      ok: false;
      error: WorkspaceAccessError;
    };

export async function getReleaseReadiness(): Promise<ReleaseReadinessResult> {
  const access = await getWorkspaceAccess({ allowedRoles: ["owner"] });

  if (!access.ok) {
    return access;
  }

  const [database, piiProtection] = await Promise.all([
    getDatabaseStatus(),
    Promise.resolve(getPiiProtectionStatus()),
  ]);

  return evaluateReleaseReadiness({
    database,
    piiProtection,
    policy: releasePolicy,
  });
}
