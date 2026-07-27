// @vitest-environment node

import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("PWA yanıt başlıkları", () => {
  it("service worker güncellemelerini ara cache'lerden ve dış scriptlerden korur", async () => {
    const rules = await nextConfig.headers?.();
    const serviceWorkerRule = rules?.find((rule) => rule.source === "/sw.js");
    const headers = Object.fromEntries(
      serviceWorkerRule?.headers.map(({ key, value }) => [key, value]) ?? [],
    );

    expect(headers).toEqual(
      expect.objectContaining({
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'",
        "Content-Type": "application/javascript; charset=utf-8",
        "Service-Worker-Allowed": "/",
      }),
    );
  });
});
