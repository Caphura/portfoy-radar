"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { WorkspaceSetupActionState } from "./workspace-state";
import { validateWorkspaceName } from "./workspace-validation";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";

export async function createWorkspaceAction(
  _previousState: WorkspaceSetupActionState,
  formData: FormData,
): Promise<WorkspaceSetupActionState> {
  const validation = validateWorkspaceName(formData.get("name"));

  if (!validation.ok) {
    return {
      status: "error",
      nameError: validation.message,
      formError: null,
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      status: "error",
      nameError: null,
      formError: "Çalışma alanı servisine ulaşılamıyor. Lütfen yeniden deneyin.",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await clientResult.client.auth.getUser();

  if (userError || !user) {
    redirect("/giris");
  }

  const { error } = await clientResult.client.rpc("bootstrap_workspace", {
    requested_name: validation.name,
  });

  if (error) {
    return {
      status: "error",
      nameError: null,
      formError:
        "Çalışma alanı oluşturulamadı. Yetkinizi ve bağlantınızı kontrol edip yeniden deneyin.",
    };
  }

  revalidatePath("/workspace");
  redirect("/workspace");
}
