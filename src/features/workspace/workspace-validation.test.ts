import { describe, expect, it } from "vitest";

import { validateWorkspaceName } from "./workspace-validation";

describe("validateWorkspaceName", () => {
  it("adı kırpar ve geçerli değeri döndürür", () => {
    expect(validateWorkspaceName("  Danışmanlık Ekibi  ")).toEqual({
      ok: true,
      name: "Danışmanlık Ekibi",
    });
  });

  it("çok kısa adı Türkçe hata ile reddeder", () => {
    expect(validateWorkspaceName("A")).toEqual({
      ok: false,
      message: "Çalışma alanı adı en az 2 karakter olmalıdır.",
    });
  });

  it("çok uzun adı istemciye geri yansıtmadan reddeder", () => {
    const longName = "A".repeat(81);
    const result = validateWorkspaceName(longName);

    expect(result).toEqual({
      ok: false,
      message: "Çalışma alanı adı en fazla 80 karakter olabilir.",
    });
    expect(JSON.stringify(result)).not.toContain(longName);
  });
});
