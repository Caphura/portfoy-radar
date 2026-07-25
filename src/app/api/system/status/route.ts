import { getPublicSystemStatus } from "@/server/system/get-public-system-status";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

export function GET() {
  const systemStatus = getPublicSystemStatus();

  if (!systemStatus.ok) {
    return Response.json(
      {
        error: {
          code: systemStatus.error.code,
          message: systemStatus.error.message,
        },
      },
      {
        status: 500,
        headers: responseHeaders,
      },
    );
  }

  return Response.json(systemStatus.data, {
    status: 200,
    headers: responseHeaders,
  });
}
