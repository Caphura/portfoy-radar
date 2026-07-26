import { parsePhoneNumberFromString } from "libphonenumber-js/max";

const turkishInternationalPrefix = /^00(?=90)/;

export type TurkishPhoneNormalizationResult =
  | {
      ok: true;
      e164: string;
    }
  | {
      ok: false;
      error: {
        code: "INVALID_TURKISH_PHONE";
        message: string;
      };
    };

const invalidPhoneResult: TurkishPhoneNormalizationResult = {
  ok: false,
  error: {
    code: "INVALID_TURKISH_PHONE",
    message: "Geçerli bir Türkiye telefon numarası girin.",
  },
};

export function normalizeTurkishPhone(
  value: string,
): TurkishPhoneNormalizationResult {
  if (value.length > 80) {
    return invalidPhoneResult;
  }

  const candidate = value.trim().replace(turkishInternationalPrefix, "+");

  if (candidate.length === 0) {
    return invalidPhoneResult;
  }

  try {
    const phone = parsePhoneNumberFromString(candidate, {
      defaultCountry: "TR",
      extract: false,
    });

    if (!phone || phone.country !== "TR" || phone.ext || !phone.isValid()) {
      return invalidPhoneResult;
    }

    return {
      ok: true,
      e164: phone.number,
    };
  } catch {
    return invalidPhoneResult;
  }
}

export function maskTurkishPhone(e164: string): string {
  return `+90 ••• ••• •• ${e164.slice(-2)}`;
}
