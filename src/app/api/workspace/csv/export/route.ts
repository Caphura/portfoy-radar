import { exportWorkspaceFsboCsv } from "@/server/csv/csv-fsbo-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await exportWorkspaceFsboCsv();

  if (!result.ok) {
    const status =
      result.error.code === "UNAUTHENTICATED"
        ? 401
        : result.error.code === "FORBIDDEN"
          ? 403
          : 503;

    return Response.json(
      { message: result.error.message },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return new Response(result.data.content, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${result.data.filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Portfoy-Radar-Export-Truncated": String(result.data.truncated),
    },
  });
}
