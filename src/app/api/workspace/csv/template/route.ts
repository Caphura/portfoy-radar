import { createFsboImportTemplate } from "@/features/csv/fsbo-csv-contract";
import { getWorkspaceAccess } from "@/server/workspace/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });

  if (!access.ok) {
    return Response.json(
      { message: access.error.message },
      {
        status: access.error.code === "UNAUTHENTICATED" ? 401 : 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return new Response(createFsboImportTemplate(), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition":
        'attachment; filename="portfoy-radar-fsbo-sablon.csv"',
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
