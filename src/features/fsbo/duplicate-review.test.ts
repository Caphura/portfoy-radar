import { describe, expect, it } from "vitest";

import { validateDuplicateDecisionForm } from "./duplicate-review";

const candidateKey = [
  "11000000-0000-4000-8000-000000000001",
  "12000000-0000-4000-8000-000000000001",
  "13000000-0000-4000-8000-000000000001",
  "-",
].join(":");

describe("validateDuplicateDecisionForm", () => {
  it("ilk denetimi ve yeniden denetimi kararsız istek olarak kabul eder", () => {
    expect(validateDuplicateDecisionForm(new FormData())).toEqual({
      ok: true,
      data: null,
    });

    const formData = new FormData();
    formData.set("duplicateDecision", "review_again");

    expect(validateDuplicateDecisionForm(formData)).toEqual({
      ok: true,
      data: null,
    });
  });

  it("mevcut kayıt ve bağlama kararında serbest gerekçe taşımaz", () => {
    const formData = new FormData();
    formData.set("duplicateDecision", "use_existing");
    formData.set("duplicateCandidate", candidateKey);
    formData.set("separationReason", "DTO'ya girmemeli");

    expect(validateDuplicateDecisionForm(formData)).toEqual({
      ok: true,
      data: {
        decision: "use_existing",
        candidateKey,
        separationReason: null,
      },
    });
  });

  it("ayrı kayıt için 3-500 karakter gerekçe ister", () => {
    const formData = new FormData();
    formData.set("duplicateDecision", "keep_separate");
    formData.set("duplicateCandidate", candidateKey);
    formData.set("separationReason", "x");

    expect(validateDuplicateDecisionForm(formData)).toEqual({
      ok: false,
      message: "Ayrı kayıt kararının gerekçesini kontrol edin.",
      separationReasonError: "Ayrı kayıt gerekçesi 3-500 karakter olmalıdır.",
    });

    formData.set("separationReason", "Adres ve malik doğrulaması farklı.");

    expect(validateDuplicateDecisionForm(formData)).toEqual({
      ok: true,
      data: {
        decision: "keep_separate",
        candidateKey,
        separationReason: "Adres ve malik doğrulaması farklı.",
      },
    });
  });

  it("istemci tarafından değiştirilmiş aday anahtarını reddeder", () => {
    const formData = new FormData();
    formData.set("duplicateDecision", "use_existing");
    formData.set("duplicateCandidate", "gecersiz-aday");

    expect(validateDuplicateDecisionForm(formData)).toEqual({
      ok: false,
      message: "Devam etmek için geçerli bir mükerrer aday ve karar seçin.",
      separationReasonError: null,
    });
  });
});
