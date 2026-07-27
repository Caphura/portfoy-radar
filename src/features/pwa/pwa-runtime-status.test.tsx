import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PwaRuntimeStatus } from "./pwa-runtime-status";

const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(
  window.navigator,
  "onLine",
);
const originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(
  window.navigator,
  "serviceWorker",
);

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

function setServiceWorker(register: ReturnType<typeof vi.fn>) {
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: { register },
  });
}

afterEach(() => {
  cleanup();

  if (originalOnlineDescriptor) {
    Object.defineProperty(window.navigator, "onLine", originalOnlineDescriptor);
  } else {
    Reflect.deleteProperty(window.navigator, "onLine");
  }

  if (originalServiceWorkerDescriptor) {
    Object.defineProperty(
      window.navigator,
      "serviceWorker",
      originalServiceWorkerDescriptor,
    );
  } else {
    Reflect.deleteProperty(window.navigator, "serviceWorker");
  }
});

describe("PwaRuntimeStatus", () => {
  it("service worker'ı kök kapsamı ve cache dışı güncelleme ile kaydeder", async () => {
    const register = vi.fn().mockResolvedValue({});
    setOnline(true);
    setServiceWorker(register);

    render(<PwaRuntimeStatus />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("çevrimdışı durumda güvenli Türkçe bilgi verir", async () => {
    const register = vi.fn().mockResolvedValue({});
    setOnline(false);
    setServiceWorker(register);

    render(<PwaRuntimeStatus />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Güvenli kayıtlar bu cihazda saklanmaz",
    );
  });

  it("kayıt hatasında uygulamayı engellemeden anlaşılır hata gösterir", async () => {
    const register = vi.fn().mockRejectedValue(new Error("sentetik hata"));
    setOnline(true);
    setServiceWorker(register);

    render(<PwaRuntimeStatus />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Çevrimdışı destek etkinleştirilemedi",
    );
  });
});
