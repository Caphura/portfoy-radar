import { getOpportunityPipeline } from "@/server/opportunities/get-opportunity-pipeline";
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

  const pipeline = await getOpportunityPipeline(access.workspace.id);

  if (!pipeline.ok) {
    return Response.json(
      {
        error: pipeline.error,
      },
      {
        status: 503,
        headers: responseHeaders,
      },
    );
  }

  return Response.json(pipeline.data, {
    status: 200,
    headers: responseHeaders,
  });
}
