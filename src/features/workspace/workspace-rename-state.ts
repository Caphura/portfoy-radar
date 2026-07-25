export type WorkspaceRenameActionState = {
  status: "idle" | "error" | "success";
  nameError: string | null;
  formError: string | null;
  successMessage: string | null;
};

export const initialWorkspaceRenameActionState: WorkspaceRenameActionState = {
  status: "idle",
  nameError: null,
  formError: null,
  successMessage: null,
};
