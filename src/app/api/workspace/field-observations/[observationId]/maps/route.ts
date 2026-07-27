import { NextResponse } from "next/server";
import { z } from "zod";

import { auditFieldObservationAccess } from "@/server/field-observations/audit-access";
import { revealFieldLocation } from "@/server/field-observations/location-crypto";
import { loadSecureFieldObservation } from "@/server/field-observations/secure-record";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const intentSchema = z.enum(["view", "directions"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ observationId: string }> },
) {
  const { observationId } = await context.params;
  const intent = intentSchema.safeParse(
    new URL(request.url).searchParams.get("intent"),
  );

  if (!intent.success) {
    return NextResponse.json(
      { error: "Harita işlemi geçersiz." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const record = await loadSecureFieldObservation(observationId);

  if (!record.ok) {
    return NextResponse.json(
      { error: record.error.message },
      {
        status:
          record.error.code === "UNAUTHENTICATED"
            ? 401
            : record.error.code === "FORBIDDEN"
              ? 403
              : record.error.code === "NOT_FOUND"
                ? 404
                : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  if (!record.data.locationEnvelope) {
    return NextResponse.json(
      { error: "Bu saha kaydında konum bulunmuyor." },
      { status: 409, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const location = revealFieldLocation(record.data.locationEnvelope);

  if (!location.ok) {
    return NextResponse.json(
      { error: "Konum güvenli biçimde açılamadı." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const auditAction =
    intent.data === "view"
      ? "field_observation.maps_viewed"
      : "field_observation.directions_opened";

  if (!(await auditFieldObservationAccess(record.data.id, auditAction))) {
    return NextResponse.json(
      { error: "Harita erişimi güvenli biçimde kaydedilemedi." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const coordinate = `${location.data.latitude},${location.data.longitude}`;
  const target =
    intent.data === "view"
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinate)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coordinate)}&travelmode=driving`;

  return NextResponse.redirect(target, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
