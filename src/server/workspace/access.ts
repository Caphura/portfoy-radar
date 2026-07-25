import "server-only";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import {
  isWorkspaceRoleAllowed,
  type WorkspaceRole,
} from "@/server/workspace/roles";

export type WorkspaceAccessResult =
  | {
      ok: true;
      userId: string;
      workspace: {
        id: string;
        name: string;
      };
      membership: {
        role: WorkspaceRole;
      };
    }
  | {
      ok: false;
      error: WorkspaceAccessError;
    };

export type WorkspaceAccessError = {
  code:
    | "UNAUTHENTICATED"
    | "WORKSPACE_REQUIRED"
    | "FORBIDDEN"
    | "WORKSPACE_SERVICE_UNAVAILABLE";
  message: string;
};

type WorkspaceAccessOptions = {
  allowedRoles?: readonly WorkspaceRole[];
};

export async function getWorkspaceAccess(
  options: WorkspaceAccessOptions = {},
): Promise<WorkspaceAccessResult> {
  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "Çalışma alanına şu anda ulaşılamıyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const {
    data: { user },
    error: userError,
  } = await clientResult.client.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Devam etmek için giriş yapın.",
      },
    };
  }

  const { data: access, error: accessError } = await clientResult.client
    .from("current_workspace_access")
    .select(
      "workspace_id, workspace_name, membership_role, membership_created_at",
    )
    .order("membership_created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (accessError) {
    return {
      ok: false,
      error: {
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "Çalışma alanına şu anda ulaşılamıyor. Lütfen yeniden deneyin.",
      },
    };
  }

  if (!access) {
    return {
      ok: false,
      error: {
        code: "WORKSPACE_REQUIRED",
        message: "Devam etmek için çalışma alanınızı oluşturun.",
      },
    };
  }

  if (
    !access.workspace_id ||
    !access.workspace_name ||
    !access.membership_role
  ) {
    return {
      ok: false,
      error: {
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "Çalışma alanına şu anda ulaşılamıyor. Lütfen yeniden deneyin.",
      },
    };
  }

  if (
    options.allowedRoles &&
    !isWorkspaceRoleAllowed(access.membership_role, options.allowedRoles)
  ) {
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
    userId: user.id,
    workspace: {
      id: access.workspace_id,
      name: access.workspace_name,
    },
    membership: {
      role: access.membership_role,
    },
  };
}
