export type WorkspaceSetupActionState = {
  status: "idle" | "error";
  nameError: string | null;
  formError: string | null;
};

export const initialWorkspaceSetupActionState: WorkspaceSetupActionState = {
  status: "idle",
  nameError: null,
  formError: null,
};
