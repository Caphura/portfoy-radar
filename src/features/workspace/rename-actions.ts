"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { WorkspaceRenameActionState } from "./workspace-rename-state";
import { validateWorkspaceName } from "./workspace-validation";
import { renameCurrentWorkspace } from "@/server/workspace/rename-workspace";

export async function renameWorkspaceAction(
  _previousState: WorkspaceRenameActionState,
  formData: FormData,
): Promise<WorkspaceRenameActionState> {
  const validation = validateWorkspaceName(formData.get("name"));

  if (!validation.ok) {
    return {
      status: "error",
      nameError: validation.message,
      formError: null,
      successMessage: null,
    };
  }

  const result = await renameCurrentWorkspace(validation.name);

  if (!result.ok) {
    let formError: string;

    switch (result.error.code) {
      case "UNAUTHENTICATED":
        redirect("/giris");
      case "FORBIDDEN":
        formError = "Çalışma alanı adını yalnızca sahip rolü değiştirebilir.";
        break;
      case "WORKSPACE_REQUIRED":
        formError = "Güncellenecek bir çalışma alanı bulunamadı.";
        break;
      case "WORKSPACE_SERVICE_UNAVAILABLE":
        formError =
          "Çalışma alanı şu anda güncellenemiyor. Lütfen yeniden deneyin.";
        break;
    }

    return {
      status: "error",
      nameError: null,
      formError,
      successMessage: null,
    };
  }

  revalidatePath("/workspace");

  return {
    status: "success",
    nameError: null,
    formError: null,
    successMessage: "Çalışma alanı adı güncellendi.",
  };
}
