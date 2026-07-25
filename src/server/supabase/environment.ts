import { z } from "zod";

const supabaseServerEnvironmentSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type SupabaseServerConfig = z.infer<typeof supabaseServerEnvironmentSchema>;

export type SupabaseServerConfigResult =
  | {
      ok: true;
      data: SupabaseServerConfig;
    }
  | {
      ok: false;
      error: {
        code: "DATABASE_NOT_CONFIGURED";
        message: string;
      };
    };

type ServerEnvironment = Record<string, string | undefined>;

export function getSupabaseServerConfig(
  environment: ServerEnvironment = process.env,
): SupabaseServerConfigResult {
  const configuration = supabaseServerEnvironmentSchema.safeParse(environment);

  if (!configuration.success) {
    return {
      ok: false,
      error: {
        code: "DATABASE_NOT_CONFIGURED",
        message:
          "Yerel veritabanı bağlantısı yapılandırılmadı. Supabase ortamını başlatın.",
      },
    };
  }

  return {
    ok: true,
    data: configuration.data,
  };
}
