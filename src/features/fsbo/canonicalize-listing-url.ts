import type { QuickFsboPlatform } from "./quick-fsbo-options";

type CanonicalUrlResult =
  | {
      ok: true;
      value: string;
    }
  | {
      ok: false;
      message: string;
    };

const knownPlatformHosts: Partial<Record<QuickFsboPlatform, string>> = {
  sahibinden: "sahibinden.com",
  hepsiemlak: "hepsiemlak.com",
  emlakjet: "emlakjet.com",
};

const trackingParameters = new Set([
  "fbclid",
  "gclid",
  "ref",
  "referrer",
  "source",
]);

function hostMatches(hostname: string, expectedHost: string) {
  return hostname === expectedHost || hostname.endsWith(`.${expectedHost}`);
}

export function canonicalizeListingUrl(
  rawValue: string,
  platform: QuickFsboPlatform,
): CanonicalUrlResult {
  const value = rawValue.trim();

  if (value.length === 0 || value.length > 2_048) {
    return {
      ok: false,
      message: "Geçerli bir ilan bağlantısı girin.",
    };
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      message: "İlan bağlantısı http veya https ile başlamalıdır.",
    };
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    return {
      ok: false,
      message: "İlan bağlantısı güvenli ve geçerli bir web adresi olmalıdır.",
    };
  }

  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const expectedHost = knownPlatformHosts[platform];

  if (expectedHost && !hostMatches(url.hostname, expectedHost)) {
    return {
      ok: false,
      message: "İlan bağlantısı seçilen platformla eşleşmiyor.",
    };
  }

  if (!expectedHost && (url.protocol !== "https:" || !url.hostname.includes("."))) {
    return {
      ok: false,
      message: "Diğer platform bağlantısı geçerli bir https adresi olmalıdır.",
    };
  }

  if (expectedHost) {
    url.protocol = "https:";
  }

  url.hash = "";
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  for (const key of [...url.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();

    if (
      normalizedKey.startsWith("utm_") ||
      trackingParameters.has(normalizedKey)
    ) {
      url.searchParams.delete(key);
    }
  }

  url.searchParams.sort();

  const canonical = url.toString();

  if (canonical.length > 2_048) {
    return {
      ok: false,
      message: "İlan bağlantısı en fazla 2048 karakter olabilir.",
    };
  }

  return {
    ok: true,
    value: canonical,
  };
}
