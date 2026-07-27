"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FieldObservationControls({
  observationId,
  status,
  hasLocation,
  canManageTrash,
  isLinked,
}: {
  observationId: string;
  status: "ready" | "trashed";
  hasLocation: boolean;
  canManageTrash: boolean;
  isLinked: boolean;
}) {
  const router = useRouter();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function patch(body: unknown) {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/workspace/field-observations/${observationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        },
      );
      const result = (await response.json()) as {
        status?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(result.error ?? "Saha kaydı güncellenemedi.");
        return false;
      }

      router.refresh();
      return true;
    } catch {
      setError("Bağlantı kesildi. Değişiklik kaydedilmedi.");
      return false;
    } finally {
      setPending(false);
    }
  }

  function addCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Bu cihaz konum paylaşımını desteklemiyor.");
      return;
    }

    setPending(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const saved = await patch({
          operation: "location",
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.max(position.coords.accuracy, 1),
            capturedAt: new Date(position.timestamp).toISOString(),
          },
        });

        if (saved) {
          setMessage("Konum güvenli biçimde güncellendi.");
        }
      },
      (positionError) => {
        setPending(false);
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Konum izni reddedildi."
            : "Konum alınamadı. Elle enlem ve boylam girebilirsiniz.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
    );
  }

  async function addManualLocation() {
    const parsedLatitude = Number(latitude.replace(",", "."));
    const parsedLongitude = Number(longitude.replace(",", "."));

    if (
      !Number.isFinite(parsedLatitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90 ||
      !Number.isFinite(parsedLongitude) ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      setError("Enlem -90–90, boylam -180–180 arasında olmalıdır.");
      return;
    }

    const saved = await patch({
      operation: "location",
      location: {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        accuracy: 100,
        capturedAt: new Date().toISOString(),
      },
    });

    if (saved) {
      setMessage("Elle girilen konum güvenli biçimde kaydedildi.");
    }
  }

  if (status === "trashed") {
    return (
      <section className="mt-5 rounded-3xl border border-amber-300 bg-amber-50 p-5">
        <h2 className="text-lg font-black text-amber-950">Çöp kutusunda</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Kayıt 30 gün dolduğunda fotoğrafıyla birlikte kalıcı olarak silinir.
          Şifreli yedeklerde en fazla 30 gün daha kalabilir.
        </p>
        {canManageTrash ? (
          <button
            className="mt-4 min-h-12 rounded-2xl bg-amber-900 px-5 text-sm font-black text-white disabled:opacity-50"
            disabled={pending}
            onClick={() => patch({ operation: "restore" })}
            type="button"
          >
            Geri al
          </button>
        ) : null}
        {error ? <p className="mt-3 text-sm font-bold text-red-800">{error}</p> : null}
      </section>
    );
  }

  return (
    <>
      <section className="mt-5 rounded-3xl border border-[var(--line)] bg-white p-5">
        <h2 className="text-lg font-black">Konum işlemleri</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {hasLocation
            ? "Bu kayıtta şifreli konum bulunuyor. Yeni konum eskisinin yerini alır."
            : "Konum eklenmedi. Cihazdan alınabilir veya elle girilebilir."}
        </p>
        <button
          className="mt-4 min-h-12 w-full rounded-2xl bg-[var(--brand)] px-4 text-sm font-black text-white disabled:opacity-50"
          disabled={pending}
          onClick={addCurrentLocation}
          type="button"
        >
          {hasLocation ? "Konumu yeniden al" : "Konumumu ekle"}
        </button>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-[var(--muted)]">
            Enlem
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-base"
              inputMode="decimal"
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="41.0082"
              value={latitude}
            />
          </label>
          <label className="text-xs font-bold text-[var(--muted)]">
            Boylam
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-base"
              inputMode="decimal"
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="28.9784"
              value={longitude}
            />
          </label>
        </div>
        <button
          className="mt-3 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-extrabold disabled:opacity-50"
          disabled={pending}
          onClick={addManualLocation}
          type="button"
        >
          Elle girilen konumu kaydet
        </button>
        {message ? (
          <p className="mt-3 text-sm font-bold text-emerald-800" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm font-bold text-red-800" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {!isLinked ? (
        <a
          className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--ink)] px-5 text-base font-black text-white"
          href={`/workspace/ekle/saha/${observationId}/donustur`}
        >
          FSBO’ya dönüştür
        </a>
      ) : null}

      {canManageTrash ? (
        <button
          className="mt-5 min-h-12 w-full rounded-2xl border border-red-200 bg-red-50 px-5 text-sm font-black text-red-800 disabled:opacity-50"
          disabled={pending}
          onClick={async () => {
            if (await patch({ operation: "trash" })) {
              router.refresh();
            }
          }}
          type="button"
        >
          Çöp kutusuna taşı
        </button>
      ) : null}
    </>
  );
}
