import { getPiiProtectionStatus } from "@/server/pii/get-protection-status";
import { getWorkspaceAccess } from "@/server/workspace/access";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json; charset=utf-8",
};

const statusByAccessErrorCode = {
  UNAUTHENTICATED: 401,
  WORKSPACE_REQUIRED: 409,
  FORBIDDEN: 403,
  WORKSPACE_SERVICE_UNAVAILABLE: 503,
} as const;

export async function GET() {
  const access = await getWorkspaceAccess();

  if (!access.ok) {
    return Response.json(
      {
        error: access.error,
      },
      {
        status: statusByAccessErrorCode[access.error.code],
        headers: responseHeaders,
      },
    );
  }

  const protection = getPiiProtectionStatus();

  if (!protection.ok) {
    return Response.json(
      {
        error: protection.error,
      },
      {
        status: 503,
        headers: responseHeaders,
      },
    );
  }

  return Response.json(protection.data, {
    status: 200,
    headers: responseHeaders,
  });
}
