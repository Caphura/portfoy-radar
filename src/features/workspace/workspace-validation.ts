import { z } from "zod";

const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, "Çalışma alanı adı en az 2 karakter olmalıdır.")
  .max(80, "Çalışma alanı adı en fazla 80 karakter olabilir.");

export type WorkspaceNameValidationResult =
  | {
      ok: true;
      name: string;
    }
  | {
      ok: false;
      message: string;
    };

export function validateWorkspaceName(
  value: FormDataEntryValue | null,
): WorkspaceNameValidationResult {
  const result = workspaceNameSchema.safeParse(
    typeof value === "string" ? value : "",
  );

  if (!result.success) {
    return {
      ok: false,
      message: result.error.issues[0]?.message ?? "Geçerli bir ad girin.",
    };
  }

  return {
    ok: true,
    name: result.data,
  };
}
