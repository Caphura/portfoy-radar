import { z } from "zod";

const publicRuntimeConfigurationSchema = z.object({
  APP_LOCALE: z.literal("tr-TR").default("tr-TR"),
  APP_TIME_ZONE: z.literal("Europe/Istanbul").default("Europe/Istanbul"),
  APP_CURRENCY: z.literal("TRY").default("TRY"),
});

export const publicSystemStatusSchema = z.object({
  service: z.literal("portfoy-radar"),
  status: z.literal("ok"),
  locale: z.literal("tr-TR"),
  timeZone: z.literal("Europe/Istanbul"),
  defaultCurrency: z.literal("TRY"),
});

export type PublicSystemStatus = z.infer<typeof publicSystemStatusSchema>;

export type PublicSystemStatusResult =
  | {
      ok: true;
      data: PublicSystemStatus;
    }
  | {
      ok: false;
      error: {
        code: "INVALID_PUBLIC_CONFIGURATION";
        message: string;
      };
    };

type PublicEnvironment = Record<string, string | undefined>;

export function getPublicSystemStatus(
  environment: PublicEnvironment = process.env,
): PublicSystemStatusResult {
  const configuration = publicRuntimeConfigurationSchema.safeParse(environment);

  if (!configuration.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_PUBLIC_CONFIGURATION",
        message: "Sistem ayarları doğrulanamadı. Lütfen yapılandırmayı kontrol edin.",
      },
    };
  }

  const status = publicSystemStatusSchema.parse({
    service: "portfoy-radar",
    status: "ok",
    locale: configuration.data.APP_LOCALE,
    timeZone: configuration.data.APP_TIME_ZONE,
    defaultCurrency: configuration.data.APP_CURRENCY,
  });

  return {
    ok: true,
    data: status,
  };
}
