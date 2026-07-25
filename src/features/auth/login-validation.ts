import { z } from "zod";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "E-posta adresinizi girin.")
    .max(254, "E-posta adresi çok uzun.")
    .email("Geçerli bir e-posta adresi girin."),
  password: z
    .string()
    .min(1, "Parolanızı girin.")
    .max(256, "Parola çok uzun."),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

export type LoginValidationResult =
  | {
      ok: true;
      data: LoginCredentials;
    }
  | {
      ok: false;
      fieldErrors: {
        email: string | null;
        password: string | null;
      };
    };

export function validateLoginInput(input: {
  email: FormDataEntryValue | null;
  password: FormDataEntryValue | null;
}): LoginValidationResult {
  const result = loginSchema.safeParse({
    email: typeof input.email === "string" ? input.email : "",
    password: typeof input.password === "string" ? input.password : "",
  });

  if (result.success) {
    return {
      ok: true,
      data: result.data,
    };
  }

  const fields = result.error.flatten().fieldErrors;

  return {
    ok: false,
    fieldErrors: {
      email: fields.email?.[0] ?? null,
      password: fields.password?.[0] ?? null,
    },
  };
}
