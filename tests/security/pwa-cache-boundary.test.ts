// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { describe, expect, it, vi } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const serviceWorkerSource = readFileSync(
  path.join(repositoryRoot, "public/sw.js"),
  "utf8",
);
const offlinePageSource = readFileSync(
  path.join(repositoryRoot, "public/offline.html"),
  "utf8",
);

type WorkerListener = (event: {
  request?: {
    method: string;
    mode: string;
    url: string;
  };
  respondWith?: (response: Promise<Response>) => void;
  waitUntil?: (response: Promise<unknown>) => void;
}) => void;

function createWorkerHarness() {
  const listeners = new Map<string, WorkerListener>();
  const addAll = vi.fn().mockResolvedValue(undefined);
  const match = vi
    .fn()
    .mockResolvedValue(new Response("çevrimdışı kabuk", { status: 200 }));
  const fetchRequest = vi
    .fn()
    .mockResolvedValue(new Response("yetkili ağ yanıtı", { status: 200 }));
  const workerSelf = {
    addEventListener: (type: string, listener: WorkerListener) => {
      listeners.set(type, listener);
    },
    clients: {
      claim: vi.fn().mockResolvedValue(undefined),
    },
    location: {
      origin: "https://radar.test",
    },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
  };
  const cacheStorage = {
    delete: vi.fn().mockResolvedValue(true),
    keys: vi.fn().mockResolvedValue([]),
    match,
    open: vi.fn().mockResolvedValue({ addAll }),
  };

  vm.runInNewContext(serviceWorkerSource, {
    Response,
    URL,
    caches: cacheStorage,
    fetch: fetchRequest,
    Promise,
    self: workerSelf,
  });

  return {
    addAll,
    cacheStorage,
    fetchRequest,
    listeners,
    match,
  };
}

describe("PWA cache güvenlik sınırı", () => {
  it("kurulumda yalnızca kişisel veri içermeyen sabit allowlist'i saklar", async () => {
    const { addAll, listeners } = createWorkerHarness();
    let installation: Promise<unknown> | undefined;

    listeners.get("install")?.({
      waitUntil: (promise) => {
        installation = promise;
      },
    });
    await installation;

    expect(addAll).toHaveBeenCalledWith([
      "/offline.html",
      "/icons/icon-192x192.png",
      "/icons/icon-512x512.png",
      "/icons/maskable-icon-512x512.png",
    ]);
    expect(serviceWorkerSource).not.toContain("cache.put");
    expect(serviceWorkerSource).not.toMatch(
      /["'`](?:\/workspace|\/api\/|\/_next\/)/,
    );
  });

  it("yetkili API yanıtını yakalamaz veya Cache Storage'a yazmaz", () => {
    const { fetchRequest, listeners, match } = createWorkerHarness();
    const respondWith = vi.fn();

    listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "cors",
        url: "https://radar.test/api/workspace/context",
      },
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
    expect(fetchRequest).not.toHaveBeenCalled();
    expect(match).not.toHaveBeenCalled();
  });

  it("navigasyonu ağdan geçirir ve yalnız ağ yoksa güvenli kabuğa düşer", async () => {
    const { fetchRequest, listeners, match } = createWorkerHarness();
    const respondWith = vi.fn();

    fetchRequest.mockRejectedValueOnce(new Error("sentetik ağ kesintisi"));
    listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://radar.test/workspace/radar",
      },
      respondWith,
    });

    expect(respondWith).toHaveBeenCalledOnce();
    await expect(respondWith.mock.calls[0]?.[0]).resolves.toBeInstanceOf(
      Response,
    );
    expect(match).toHaveBeenCalledWith("/offline.html", {
      cacheName: "portfoy-radar-static-v1",
    });
  });

  it("çevrimdışı kabukta form, script veya kişisel veri alanı bulundurmaz", () => {
    expect(offlinePageSource).toContain("Bağlantı bekleniyor");
    expect(offlinePageSource).toContain(
      "Portföy ve iletişim verileri güvenlik nedeniyle bu cihazda çevrimdışı",
    );
    expect(offlinePageSource).not.toMatch(/<(?:form|input|script)\b/i);
    expect(offlinePageSource).not.toMatch(/(?:\+90|0)5\d{9}/);
    expect(offlinePageSource).not.toMatch(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    );
  });
});
