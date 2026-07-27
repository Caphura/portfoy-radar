import type { QuickFsboInput } from "@/features/fsbo/quick-fsbo-validation";
import { validateQuickFsboForm } from "@/features/fsbo/quick-fsbo-validation";
import { normalizeTurkishPhone } from "@/features/pii/phone";
import { formatIstanbulLocalDateTime } from "@/shared/time/istanbul";

export const csvImportMaxRows = 1_000;
export const csvImportMaxBytes = 1_500_000;
export const csvFormatVersion = "fsbo-v1";

export const fsboImportHeaders = [
  "platform",
  "ilan_no",
  "ilan_url",
  "islem_turu",
  "gayrimenkul_turu",
  "il",
  "ilce",
  "mahalle",
  "oda",
  "salon",
  "net_m2",
  "brut_m2",
  "fiyat",
  "para_birimi",
  "mal_sahibi",
  "telefon",
  "sonraki_islem_tarihi",
] as const;

export const fsboExportHeaders = [
  "firsat_id",
  "asama",
  ...fsboImportHeaders.slice(0, 14),
  "telefon_maskeli",
  "sonraki_islem_tarihi",
] as const;

export type CsvImportError = {
  rowNumber: number | null;
  field: string | null;
  message: string;
};

export type ParseFsboCsvResult =
  | {
      ok: true;
      data: {
        inputs: QuickFsboInput[];
        bytes: Uint8Array;
      };
    }
  | {
      ok: false;
      errors: CsvImportError[];
    };

type CsvFileLike = {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type ParsedTable =
  | { ok: true; rows: string[][] }
  | { ok: false; message: string };

const offsetDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const exactMoneyPattern = /^\d{1,11}\.\d{2}$/;

function parseSemicolonTable(value: string): ParsedTable {
  if (value.includes("\0")) {
    return { ok: false, message: "CSV dosyası geçersiz karakter içeriyor." };
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;

  function completeField() {
    row.push(field);
    field = "";
    afterQuote = false;
  }

  function completeRow() {
    completeField();
    rows.push(row);
    row = [];
  }

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (quoted) {
      if (character === '"') {
        if (value[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote && ![";", "\r", "\n"].includes(character ?? "")) {
      return {
        ok: false,
        message: "Tırnaklı CSV alanından sonra geçersiz karakter bulundu.",
      };
    }

    if (character === '"' && field.length === 0 && !afterQuote) {
      quoted = true;
    } else if (character === ";") {
      completeField();
    } else if (character === "\n") {
      completeRow();
    } else if (character === "\r") {
      if (value[index + 1] === "\n") {
        index += 1;
      }
      completeRow();
    } else {
      field += character;
    }
  }

  if (quoted) {
    return { ok: false, message: "CSV dosyasında kapanmamış tırnak var." };
  }

  if (field.length > 0 || row.length > 0) {
    completeRow();
  }

  return { ok: true, rows };
}

function csvFieldError(
  rowNumber: number,
  field: string,
  message: string,
): CsvImportError {
  return { rowNumber, field, message };
}

function normalizeSimilarityText(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

function similarityKey(input: QuickFsboInput) {
  return [
    normalizeSimilarityText(input.neighborhood),
    input.roomCount,
    input.livingRoomCount,
    input.transactionType,
  ].join("|");
}

function areaIsSimilar(left: QuickFsboInput, right: QuickFsboInput) {
  const leftArea = left.netAreaSqm || left.grossAreaSqm;
  const rightArea = right.netAreaSqm || right.grossAreaSqm;
  return Math.abs(leftArea - rightArea) <= Math.max(leftArea, rightArea) * 0.1;
}

function priceIsSimilar(left: QuickFsboInput, right: QuickFsboInput) {
  return (
    Math.abs(left.askingPrice - right.askingPrice) <=
    Math.max(left.askingPrice, right.askingPrice) * 0.1
  );
}

function findInFileDuplicate(
  input: QuickFsboInput,
  previous: QuickFsboInput[],
): { rowNumber: number; reason: string } | null {
  const normalizedPhone = normalizeTurkishPhone(input.phone);

  for (let index = 0; index < previous.length; index += 1) {
    const candidate = previous[index];

    if (!candidate) {
      continue;
    }

    if (
      candidate.platform === input.platform &&
      candidate.externalListingId === input.externalListingId
    ) {
      return {
        rowNumber: index + 2,
        reason: "aynı platform ve ilan numarası",
      };
    }

    if (candidate.canonicalUrl === input.canonicalUrl) {
      return { rowNumber: index + 2, reason: "aynı canonical ilan URL’si" };
    }

    const candidatePhone = normalizeTurkishPhone(candidate.phone);

    if (
      normalizedPhone.ok &&
      candidatePhone.ok &&
      normalizedPhone.e164 === candidatePhone.e164
    ) {
      return {
        rowNumber: index + 2,
        reason: "aynı normalize telefon numarası",
      };
    }

    if (
      similarityKey(candidate) === similarityKey(input) &&
      areaIsSimilar(candidate, input) &&
      priceIsSimilar(candidate, input)
    ) {
      return {
        rowNumber: index + 2,
        reason: "benzer mahalle, oda, alan ve fiyat",
      };
    }
  }

  return null;
}

function buildQuickFsboFormData(row: string[], nextActionAt: string) {
  const data = new FormData();
  data.set("platform", row[0] ?? "");
  data.set("externalListingId", row[1] ?? "");
  data.set("listingUrl", row[2] ?? "");
  data.set("transactionType", row[3] ?? "");
  data.set("propertyType", row[4] ?? "");
  data.set("city", row[5] ?? "");
  data.set("district", row[6] ?? "");
  data.set("neighborhood", row[7] ?? "");
  data.set("roomCount", row[8] ?? "");
  data.set("livingRoomCount", row[9] ?? "");
  data.set("netAreaSqm", row[10] ?? "");
  data.set("grossAreaSqm", row[11] ?? "");
  data.set("askingPrice", row[12] ?? "");
  data.set("contactName", row[14] ?? "");
  data.set("phone", row[15] ?? "");
  data.set("nextActionAt", nextActionAt);
  return data;
}

function validateHeader(row: string[] | undefined): CsvImportError[] {
  if (!row || row.length !== fsboImportHeaders.length) {
    return [
      {
        rowNumber: 1,
        field: null,
        message: "CSV başlıkları şablonla aynı sırada olmalıdır.",
      },
    ];
  }

  return row.flatMap((value, index) =>
    value === fsboImportHeaders[index]
      ? []
      : [
          {
            rowNumber: 1,
            field: fsboImportHeaders[index] ?? null,
            message: "CSV başlıkları şablonla aynı sırada olmalıdır.",
          },
        ],
  );
}

export async function parseFsboImportFile(
  file: CsvFileLike,
  now = new Date(),
): Promise<ParseFsboCsvResult> {
  if (
    file.size <= 0 ||
    file.size > csvImportMaxBytes ||
    !file.name.toLocaleLowerCase("tr-TR").endsWith(".csv") ||
    (file.type !== "" &&
      !["text/csv", "application/csv", "text/plain"].includes(file.type))
  ) {
    return {
      ok: false,
      errors: [
        {
          rowNumber: null,
          field: null,
          message:
            "En fazla 1,5 MB boyutunda, UTF-8 kodlu bir .csv dosyası seçin.",
        },
      ],
    };
  }

  let bytes: Uint8Array;
  let text: string;

  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return {
      ok: false,
      errors: [
        {
          rowNumber: null,
          field: null,
          message: "CSV dosyası geçerli UTF-8 olarak okunamadı.",
        },
      ],
    };
  }

  const table = parseSemicolonTable(text);

  if (!table.ok) {
    return {
      ok: false,
      errors: [{ rowNumber: null, field: null, message: table.message }],
    };
  }

  const headerErrors = validateHeader(table.rows[0]);
  const dataRows = table.rows.slice(1);

  if (headerErrors.length > 0) {
    return { ok: false, errors: headerErrors };
  }

  if (dataRows.length === 0 || dataRows.length > csvImportMaxRows) {
    return {
      ok: false,
      errors: [
        {
          rowNumber: null,
          field: null,
          message: "CSV dosyası 1-1.000 veri satırı içermelidir.",
        },
      ],
    };
  }

  const inputs: QuickFsboInput[] = [];
  const errors: CsvImportError[] = [];

  for (let index = 0; index < dataRows.length; index += 1) {
    const rowNumber = index + 2;
    const row = dataRows[index] ?? [];

    if (row.length !== fsboImportHeaders.length) {
      errors.push(
        csvFieldError(
          rowNumber,
          "satır",
          "Satırdaki sütun sayısı CSV şablonuyla eşleşmiyor.",
        ),
      );
      continue;
    }

    const rawDate = row[16] ?? "";
    const rawPrice = row[12] ?? "";

    if (!exactMoneyPattern.test(rawPrice)) {
      errors.push(
        csvFieldError(
          rowNumber,
          "fiyat",
          "Fiyat iki ondalık basamakla yazılmalıdır (ör. 7500000.00).",
        ),
      );
    }

    if (row[13] !== "TRY") {
      errors.push(
        csvFieldError(
          rowNumber,
          "para_birimi",
          "MVP içe aktarımında para birimi TRY olmalıdır.",
        ),
      );
    }

    const parsedDate = offsetDateTimePattern.test(rawDate)
      ? new Date(rawDate)
      : new Date(Number.NaN);

    if (Number.isNaN(parsedDate.getTime())) {
      errors.push(
        csvFieldError(
          rowNumber,
          "sonraki_islem_tarihi",
          "Tarih saat dilimi içeren ISO 8601 biçiminde olmalıdır.",
        ),
      );
      continue;
    }

    const rowErrorsBefore = errors.length;
    const validation = validateQuickFsboForm(
      buildQuickFsboFormData(
        row,
        formatIstanbulLocalDateTime(parsedDate),
      ),
      now,
    );

    if (!validation.ok) {
      for (const [field, message] of Object.entries(validation.fieldErrors)) {
        if (message) {
          errors.push(csvFieldError(rowNumber, field, message));
        }
      }
      continue;
    }

    if (errors.length > rowErrorsBefore) {
      continue;
    }

    const duplicate = findInFileDuplicate(validation.data, inputs);

    if (duplicate) {
      errors.push(
        csvFieldError(
          rowNumber,
          "satır",
          `${duplicate.rowNumber}. satırla olası mükerrer: ${duplicate.reason}. Satırları ayrı dosyalarda inceleyin.`,
        ),
      );
      continue;
    }

    inputs.push(validation.data);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: { inputs, bytes } };
}

export function escapeCsvCell(value: string | number | null): string {
  if (value === null) {
    return "";
  }

  let text = String(value);

  if (/^[\s]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  if (/[;"\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function serializeSemicolonCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
): string {
  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(";"))
    .join("\r\n")}\r\n`;
}

export function createFsboImportTemplate(): string {
  return serializeSemicolonCsv(fsboImportHeaders, []);
}
