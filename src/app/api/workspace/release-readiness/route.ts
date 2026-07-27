import { getReleaseReadiness } from "@/server/release/get-release-readiness";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json; charset=utf-8",
};

const statusByErrorCode = {
  UNAUTHENTICATED: 401,
  WORKSPACE_REQUIRED: 409,
  FORBIDDEN: 403,
  WORKSPACE_SERVICE_UNAVAILABLE: 503,
  INVALID_RELEASE_POLICY: 500,
} as const;

export async function GET() {
  const readiness = await getReleaseReadiness();

  if (!readiness.ok) {
    return Response.json(
      {
        error: readiness.error,
      },
      {
        status: statusByErrorCode[readiness.error.code],
        headers: responseHeaders,
      },
    );
  }

  return Response.json(readiness.data, {
    status: 200,
    headers: responseHeaders,
  });
}
