import { getDatabaseStatus } from "@/server/system/get-database-status";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

export async function GET() {
  const databaseStatus = await getDatabaseStatus();

  if (!databaseStatus.ok) {
    return Response.json(
      {
        error: databaseStatus.error,
      },
      {
        status: 503,
        headers: responseHeaders,
      },
    );
  }

  return Response.json(databaseStatus.data, {
    status: 200,
    headers: responseHeaders,
  });
}
