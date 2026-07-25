import { describe, expect, it } from "vitest";

import { validateLoginInput } from "./login-validation";

describe("validateLoginInput", () => {
  it("geçerli e-posta ve parolayı normalize eder", () => {
    expect(
      validateLoginInput({
        email: "  danisman@example.invalid ",
        password: "GuvenliParola",
      }),
    ).toEqual({
      ok: true,
      data: {
        email: "danisman@example.invalid",
        password: "GuvenliParola",
      },
    });
  });

  it("eksik alanlar için Türkçe ve alana özel hata döndürür", () => {
    expect(
      validateLoginInput({
        email: "",
        password: "",
      }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        email: "E-posta adresinizi girin.",
        password: "Parolanızı girin.",
      },
    });
  });

  it("kişisel veriyi hata metnine taşımaz", () => {
    const result = validateLoginInput({
      email: "gecersiz-adres",
      password: "ornek",
    });

    expect(JSON.stringify(result)).not.toContain("gecersiz-adres");
    expect(JSON.stringify(result)).not.toContain("ornek");
  });
});
