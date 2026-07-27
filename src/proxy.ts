import type { NextRequest } from "next/server";

import { updateSupabaseSession } from "@/server/supabase/update-session";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline.html|api/system/status|api/system/database|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
