import { describe, expect, it } from "vitest";

import { validateCommunicationBlockForm } from "./communication-block-validation";

const opportunityId = "10000000-0000-4000-8000-000000000001";

function formData() {
  const data = new FormData();
  data.set("opportunityId", opportunityId);
  data.set("reason", "  Sentetik iletişim tercihi açıklaması.  ");
  data.set("confirmation", "on");
  return data;
}

describe("validateCommunicationBlockForm", () => {
  it("geçerli nedeni kırpıp fırsat kimliğiyle sunucu girdisine dönüştürür", () => {
    expect(validateCommunicationBlockForm(formData())).toEqual({
      ok: true,
      data: {
        opportunityId,
        reason: "Sentetik iletişim tercihi açıklaması.",
      },
    });
  });

  it("neden ve açık etki onayı olmadan işlemi reddeder", () => {
    const data = formData();
    data.set("reason", "x");
    data.delete("confirmation");

    const result = validateCommunicationBlockForm(data);

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        reason: "İşlem nedeni en az 3 karakter olmalıdır.",
        confirmation: "İşlemin etkisini anladığınızı onaylayın.",
      },
    });
  });

  it("bozuk fırsat kimliğini güvenli alan hatasına dönüştürür", () => {
    const data = formData();
    data.set("opportunityId", "gecersiz");

    const result = validateCommunicationBlockForm(data);

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        opportunityId: "Fırsat kimliği doğrulanamadı.",
      },
    });
  });
});
