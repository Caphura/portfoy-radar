import { z } from "zod";

export const currentDatabaseSchemaVersion = 19;

const databaseContractSchema = z.object({
  schema_version: z.literal(currentDatabaseSchemaVersion),
  locale: z.literal("tr-TR"),
  time_zone: z.literal("Europe/Istanbul"),
  default_currency: z.literal("TRY"),
});

export type DatabaseStatus = {
  service: "supabase-postgres";
  status: "ok";
  schemaVersion: typeof currentDatabaseSchemaVersion;
  locale: "tr-TR";
  timeZone: "Europe/Istanbul";
  defaultCurrency: "TRY";
};

export type DatabaseStatusResult =
  | {
      ok: true;
      data: DatabaseStatus;
    }
  | {
      ok: false;
      error: {
        code:
          | "DATABASE_NOT_CONFIGURED"
          | "DATABASE_UNAVAILABLE"
          | "INVALID_DATABASE_CONTRACT";
        message: string;
      };
    };

type ReadDatabaseContract = () => Promise<{
  data: unknown;
  error: unknown;
}>;

export async function resolveDatabaseStatus(
  readDatabaseContract: ReadDatabaseContract,
): Promise<DatabaseStatusResult> {
  try {
    const result = await readDatabaseContract();

    if (result.error || !result.data) {
      return {
        ok: false,
        error: {
          code: "DATABASE_UNAVAILABLE",
          message:
            "Yerel veritabanına ulaşılamadı. Supabase servislerinin çalıştığını kontrol edin.",
        },
      };
    }

    const contract = databaseContractSchema.safeParse(result.data);

    if (!contract.success) {
      return {
        ok: false,
        error: {
          code: "INVALID_DATABASE_CONTRACT",
          message:
            "Veritabanı şema sözleşmesi beklenen sürümle uyuşmuyor. Migration'ları uygulayın.",
        },
      };
    }

    return {
      ok: true,
      data: {
        service: "supabase-postgres",
        status: "ok",
        schemaVersion: contract.data.schema_version,
        locale: contract.data.locale,
        timeZone: contract.data.time_zone,
        defaultCurrency: contract.data.default_currency,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "DATABASE_UNAVAILABLE",
        message:
          "Yerel veritabanına ulaşılamadı. Supabase servislerinin çalıştığını kontrol edin.",
      },
    };
  }
}
