"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { prepareFieldPhoto } from "./client-image";

type CapturedLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

export function FieldObservationCapture() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState(
    "Konum isteğe bağlıdır ve yalnız düğmeye bastığınızda alınır.",
  );
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handlePhotoChange(file: File | undefined) {
    setError(null);

    if (!file) {
      setPhoto(null);
      return;
    }

    setPreparing(true);

    try {
      setPhoto(await prepareFieldPhoto(file));
    } catch (caught) {
      setPhoto(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Fotoğraf hazırlanamadı. Lütfen yeniden deneyin.",
      );
    } finally {
      setPreparing(false);
    }
  }

  function requestLocation() {
    setError(null);

    if (!navigator.geolocation) {
      setLocationMessage(
        "Bu cihaz konum paylaşımını desteklemiyor. Fotoğraf konumsuz kaydedilebilir.",
      );
      return;
    }

    setLocationMessage("Konum izni bekleniyor…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.max(position.coords.accuracy, 1),
          capturedAt: new Date(position.timestamp).toISOString(),
        });
        setLocationMessage(
          `Konum eklendi · yaklaşık ${Math.round(position.coords.accuracy)} m doğruluk`,
        );
      },
      (positionError) => {
        setLocation(null);
        setLocationMessage(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Konum izni reddedildi. Fotoğraf konumsuz kaydedilebilir."
            : "Konum alınamadı. Fotoğraf konumsuz kaydedilebilir.",
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12_000,
      },
    );
  }

  async function submit() {
    if (!photo || preparing || submitting) {
      setError("Kaydetmek için önce bir fotoğraf seçin.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const body = new FormData();
    body.set("photo", photo);
    body.set("observedAt", new Date().toISOString());

    if (location) {
      body.set("location", JSON.stringify(location));
    }

    try {
      const response = await fetch("/api/workspace/field-observations", {
        method: "POST",
        body,
        cache: "no-store",
      });
      const result = (await response.json()) as {
        observationId?: string;
        error?: string;
      };

      if (!response.ok || !result.observationId) {
        setError(
          result.error ??
            (navigator.onLine
              ? "Güvenli kayıt tamamlanamadı."
              : "Bağlantı kesildi. Hassas veri cihazda saklanmadı."),
        );
        return;
      }

      router.push(`/workspace/ekle/saha/${result.observationId}`);
      router.refresh();
    } catch {
      setError(
        "Bağlantı kesildi. Hassas veri cihazda saklanmadı; çevrimiçi olduğunuzda yeniden deneyin.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-white p-5 shadow-[0_16px_45px_rgba(18,37,29,0.08)] sm:p-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand)]">
        Yeni saha gözlemi
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
        Tabelanın fotoğrafını ekle
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        İlk sürüm çevrimiçi çalışır. Fotoğraf ve konum çevrimdışı kuyruğa
        alınmaz.
      </p>

      <input
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(event) => handlePhotoChange(event.target.files?.[0])}
        ref={fileInput}
        type="file"
      />
      <button
        className="mt-5 min-h-14 w-full rounded-2xl bg-[var(--brand)] px-5 text-base font-black text-white disabled:opacity-60"
        disabled={preparing || submitting}
        onClick={() => fileInput.current?.click()}
        type="button"
      >
        {preparing
          ? "Fotoğraf güvenli boyuta hazırlanıyor…"
          : photo
            ? "Fotoğrafı değiştir"
            : "Fotoğraf çek veya galeriden seç"}
      </button>
      <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
        {photo
          ? `Hazır · ${(photo.size / 1024).toFixed(0)} KB JPEG`
          : "Arka kamera desteklenmezse cihaz galeri seçimini açar."}
      </p>

      <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--canvas)]/60 p-4">
        <p className="text-sm font-black">Konum</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          {locationMessage}
        </p>
        <button
          className="mt-3 min-h-11 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-extrabold"
          disabled={submitting}
          onClick={requestLocation}
          type="button"
        >
          {location ? "Konumu yeniden al" : "Konumumu ekle"}
        </button>
      </div>

      {error ? (
        <p
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="mt-5 min-h-14 w-full rounded-2xl bg-[var(--ink)] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!photo || preparing || submitting}
        onClick={submit}
        type="button"
      >
        {submitting ? "Şifrelenerek kaydediliyor…" : "Saha kaydını oluştur"}
      </button>
    </section>
  );
}
