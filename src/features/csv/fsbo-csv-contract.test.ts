import { describe, expect, it } from "vitest";

import {
  createFsboImportTemplate,
  escapeCsvCell,
  fsboImportHeaders,
  parseFsboImportFile,
  serializeSemicolonCsv,
} from "./fsbo-csv-contract";

const now = new Date("2026-07-27T09:00:00.000Z");

function csvFile(content: string | Uint8Array, name = "fsbo.csv") {
  const bytes =
    typeof content === "string" ? new TextEncoder().encode(content) : content;

  return {
    name,
    size: bytes.byteLength,
    type: "text/csv",
    async arrayBuffer() {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
    },
  };
}

function validRow(overrides: Partial<Record<number, string>> = {}) {
  const values = [
    "sahibinden",
    "12345",
    "https://www.sahibinden.com/ilan/12345",
    "sale",
    "apartment",
    "İstanbul",
    "Kadıköy",
    "Moda",
    "3",
    "1",
    "100.00",
    "120.00",
    "7500000.00",
    "TRY",
    "Örnek Mal Sahibi",
    "0532 000 00 01",
    "2026-07-28T12:00:00+03:00",
  ];

  for (const [index, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      values[Number(index)] = value;
    }
  }

  return values.join(";");
}

function csv(...rows: string[]) {
  return `\uFEFF${fsboImportHeaders.join(";")}\r\n${rows.join("\r\n")}\r\n`;
}

describe("FSBO CSV sözleşmesi", () => {
  it("BOM, Türkçe karakter ve ISO saatli geçerli satırı doğrular", async () => {
    const result = await parseFsboImportFile(csvFile(csv(validRow())), now);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.inputs).toHaveLength(1);
      expect(result.data.inputs[0]).toMatchObject({
        city: "İstanbul",
        neighborhood: "Moda",
        askingPrice: 7_500_000,
        nextActionAt: "2026-07-28T09:00:00.000Z",
      });
    }
  });

  it("hatalı başlık, para birimi, fiyat ve saat dilimini güvenli mesajlarla reddeder", async () => {
    const wrongHeader = csv(validRow()).replace("platform", "kaynak");
    const headerResult = await parseFsboImportFile(csvFile(wrongHeader), now);
    const rowResult = await parseFsboImportFile(
      csvFile(
        csv(
          validRow({
            12: "7500000",
            13: "EUR",
            16: "2026-07-28T12:00",
          }),
        ),
      ),
      now,
    );

    expect(headerResult).toMatchObject({ ok: false });
    expect(rowResult).toMatchObject({ ok: false });
    if (!rowResult.ok) {
      expect(rowResult.errors.map((error) => error.field)).toEqual(
        expect.arrayContaining([
          "fiyat",
          "para_birimi",
          "sonraki_islem_tarihi",
        ]),
      );
      expect(JSON.stringify(rowResult.errors)).not.toContain("0532");
    }
  });

  it("dosya içindeki kesin ve benzer mükerrerleri kullanıcı kararı olmadan kabul etmez", async () => {
    const result = await parseFsboImportFile(
      csvFile(
        csv(
          validRow(),
          validRow({
            1: "67890",
            2: "https://www.sahibinden.com/ilan/67890",
          }),
        ),
      ),
      now,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain(
        "aynı normalize telefon numarası",
      );
      expect(result.errors[0]?.message).toContain("2. satır");
    }
  });

  it("tırnaklı noktalı virgülü okur ve kapanmamış tırnağı reddeder", async () => {
    const quoted = csv(validRow({ 14: '"Mal; Sahibi"' }));
    const validResult = await parseFsboImportFile(csvFile(quoted), now);
    const invalidResult = await parseFsboImportFile(
      csvFile(`${fsboImportHeaders.join(";")}\r\n"yarım`),
      now,
    );

    expect(validResult.ok).toBe(true);
    expect(invalidResult).toMatchObject({ ok: false });
  });

  it("geçersiz UTF-8 ve 1.000 satır sınırı aşımını reddeder", async () => {
    const invalidUtf8 = await parseFsboImportFile(
      csvFile(new Uint8Array([0xff, 0xfe, 0xfd])),
      now,
    );
    const tooManyRows = Array.from({ length: 1_001 }, (_, index) =>
      validRow({
        1: String(index + 1),
        2: `https://example.com/${index + 1}`,
        15: `0532 000 ${String(Math.floor(index / 100)).padStart(2, "0")} ${String(index % 100).padStart(2, "0")}`,
      }),
    );
    const rowLimit = await parseFsboImportFile(
      csvFile(csv(...tooManyRows)),
      now,
    );

    expect(invalidUtf8).toMatchObject({ ok: false });
    expect(rowLimit).toMatchObject({ ok: false });
  });

  it("dışa aktarımda formül hücrelerini etkisizleştirir ve BOM kullanır", () => {
    expect(escapeCsvCell("=HYPERLINK(\"x\")")).toBe(
      `"'=HYPERLINK(""x"")"`,
    );
    expect(escapeCsvCell(" +SUM(1;2)")).toBe(`"' +SUM(1;2)"`);

    const output = serializeSemicolonCsv(["alan"], [["-1"]]);
    expect(output.startsWith("\uFEFF")).toBe(true);
    expect(output).toContain("'‑1".replace("‑", "-"));
    expect(createFsboImportTemplate()).toContain(fsboImportHeaders.join(";"));
  });
});
