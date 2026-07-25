"use server";

import { redirect } from "next/navigation";

import type { LoginActionState } from "./login-state";
import { validateLoginInput } from "./login-validation";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const validation = validateLoginInput({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validation.ok) {
    return {
      status: "error",
      fieldErrors: validation.fieldErrors,
      formError: null,
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      status: "error",
      fieldErrors: {
        email: null,
        password: null,
      },
      formError: clientResult.error.message,
    };
  }

  const { error } = await clientResult.client.auth.signInWithPassword(
    validation.data,
  );

  if (error) {
    return {
      status: "error",
      fieldErrors: {
        email: null,
        password: null,
      },
      formError: "E-posta veya parola hatalı. Bilgilerinizi kontrol edin.",
    };
  }

  redirect("/workspace");
}

export async function logoutAction() {
  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    redirect("/giris?durum=cikis-hatasi");
  }

  const { error } = await clientResult.client.auth.signOut({ scope: "local" });

  if (error) {
    redirect("/giris?durum=cikis-hatasi");
  }

  redirect("/giris");
}
