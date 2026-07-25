import "server-only";

import {
  getWorkspaceAccess,
  type WorkspaceAccessError,
} from "@/server/workspace/access";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";

export type RenameWorkspaceResult =
  | {
      ok: true;
      workspace: {
        id: string;
        name: string;
      };
    }
  | {
      ok: false;
      error: WorkspaceAccessError;
    };

export async function renameCurrentWorkspace(
  name: string,
): Promise<RenameWorkspaceResult> {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner"],
  });

  if (!access.ok) {
    return access;
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "Çalışma alanı şu anda güncellenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const { data: workspace, error } = await clientResult.client
    .from("workspaces")
    .update({ name })
    .eq("id", access.workspace.id)
    .select("id, name")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: {
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "Çalışma alanı şu anda güncellenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  if (!workspace) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    };
  }

  return {
    ok: true,
    workspace,
  };
}
