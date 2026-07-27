import { NextResponse } from "next/server";

import { createFieldObservation } from "@/server/field-observations/create-field-observation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Fotoğraf isteği okunamadı." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const photo = formData.get("photo");
  const observedAt = formData.get("observedAt");
  const rawLocation = formData.get("location");

  if (!(photo instanceof File) || typeof observedAt !== "string") {
    return NextResponse.json(
      { error: "Fotoğraf ve gözlem zamanı zorunludur." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let location: unknown = null;

  if (typeof rawLocation === "string" && rawLocation.length > 0) {
    try {
      location = JSON.parse(rawLocation);
    } catch {
      return NextResponse.json(
        { error: "Konum biçimi geçersiz. Fotoğrafı konumsuz deneyin." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const result = await createFieldObservation(photo, {
    observedAt,
    location,
  });

  if (!result.ok) {
    const status =
      result.error.code === "UNAUTHENTICATED"
        ? 401
        : result.error.code === "FORBIDDEN"
          ? 403
          : result.error.code === "INVALID_INPUT" ||
              result.error.code === "IMAGE_REJECTED" ||
              result.error.code === "LOCATION_PROTECTION_FAILED"
            ? 400
            : result.error.code === "STORAGE_LIMIT_REACHED"
              ? 507
              : result.error.code === "FIELD_OBSERVATION_DISABLED"
                ? 503
                : 503;

    return NextResponse.json(
      { error: result.error.message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      observationId: result.data.observationId,
      mode: result.data.mode,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
