"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

function subscribeToConnectionStatus(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getConnectionStatus() {
  return window.navigator.onLine;
}

function getServerConnectionStatus() {
  return true;
}

export function PwaRuntimeStatus() {
  const isOnline = useSyncExternalStore(
    subscribeToConnectionStatus,
    getConnectionStatus,
    getServerConnectionStatus,
  );
  const [registrationFailed, setRegistrationFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if ("serviceWorker" in window.navigator) {
      void window.navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .catch(() => {
          if (isMounted) {
            setRegistrationFailed(true);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  if (isOnline && !registrationFailed) {
    return null;
  }

  return (
    <div
      className={`fixed inset-x-3 top-2 z-[80] mx-auto max-w-lg rounded-2xl border px-4 py-3 text-sm font-bold shadow-lg backdrop-blur ${
        registrationFailed
          ? "border-amber-200 bg-amber-50/95 text-amber-950"
          : "border-slate-300 bg-slate-950/95 text-white"
      }`}
      role={registrationFailed ? "alert" : "status"}
    >
      {registrationFailed
        ? "Çevrimdışı destek etkinleştirilemedi. Uygulamayı çevrimiçi kullanmaya devam edebilirsiniz."
        : "Çevrimdışısınız. Güvenli kayıtlar bu cihazda saklanmaz; bağlantı gelince yeniden deneyin."}
    </div>
  );
}
