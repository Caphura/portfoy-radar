// @vitest-environment node

import { describe, expect, it } from "vitest";

import { maskTurkishPhone, normalizeTurkishPhone } from "./phone";

const subscriber = ["5", "55", "000", "00", "00"].join("");

describe("Türkiye telefonu normalizasyonu", () => {
  it("ulusal ve uluslararası girişleri aynı E.164 değerine dönüştürür", () => {
    const inputs = [
      `0${subscriber}`,
      subscriber,
      `+90${subscriber}`,
      `0090${subscriber}`,
      `0 ${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6, 8)} ${subscriber.slice(8)}`,
    ];
    const results = inputs.map(normalizeTurkishPhone);

    expect(results.every((result) => result.ok)).toBe(true);

    const normalizedValues = results.flatMap((result) =>
      result.ok ? [result.e164] : [],
    );

    expect(new Set(normalizedValues).size).toBe(1);
    expect(normalizedValues[0]?.startsWith("+90")).toBe(true);
    expect(normalizedValues[0]?.length).toBe(13);
  });

  it("geçersiz, yabancı veya uzantılı değeri açık girdiyi yansıtmadan reddeder", () => {
    const privateInput = "gecersiz-girdi";
    const foreignSubscriber = ["1", "213", "373", "4253"].join("");
    const results = [
      normalizeTurkishPhone(privateInput),
      normalizeTurkishPhone(`+${foreignSubscriber}`),
      normalizeTurkishPhone(`0${subscriber} dahili 7`),
      normalizeTurkishPhone("5".repeat(81)),
    ];

    expect(results.every((result) => !result.ok)).toBe(true);
    expect(JSON.stringify(results)).not.toContain(privateInput);
  });

  it("normal liste değerinde ülke kodu ve son iki hane dışında rakam göstermez", () => {
    const result = normalizeTurkishPhone(`0${subscriber}`);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const masked = maskTurkishPhone(result.e164);

    expect(masked).toBe("+90 ••• ••• •• 00");
    expect(masked.replace("+90", "").match(/\d/g)).toHaveLength(2);
    expect(masked).not.toContain(subscriber.slice(0, -2));
  });
});
