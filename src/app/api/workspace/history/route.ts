import { getWorkspaceHistory } from "@/server/history/get-workspace-history";
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

  const history = await getWorkspaceHistory(
    access.workspace.id,
    access.membership.role,
  );

  if (!history.ok) {
    return Response.json(
      {
        error: history.error,
      },
      {
        status: 503,
        headers: responseHeaders,
      },
    );
  }

  return Response.json(history.data, {
    status: 200,
    headers: responseHeaders,
  });
}
