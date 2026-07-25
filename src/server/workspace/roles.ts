import type { Enums } from "@/types/database.generated";

export type WorkspaceRole = Enums<"workspace_role">;

export function isWorkspaceRoleAllowed(
  role: WorkspaceRole,
  allowedRoles: readonly WorkspaceRole[],
) {
  return allowedRoles.includes(role);
}
