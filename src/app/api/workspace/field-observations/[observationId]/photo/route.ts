import { NextResponse } from "next/server";

import { auditFieldObservationAccess } from "@/server/field-observations/audit-access";
import { getMediaProtectionConfig } from "@/server/field-observations/media-config";
import { decryptMedia } from "@/server/field-observations/media-crypto";
import { loadSecureFieldObservation } from "@/server/field-observations/secure-record";
import { createAdminSupabaseClient } from "@/server/supabase/admin-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ observationId: string }> },
) {
  const { observationId } = await context.params;
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
        headers: privateHeaders,
      },
    );
  }

  const [admin, mediaConfiguration] = [
    createAdminSupabaseClient(),
    getMediaProtectionConfig(),
  ];

  if (!admin.ok || !mediaConfiguration.ok) {
    return NextResponse.json(
      { error: "Fotoğraf güvenli biçimde açılamadı." },
      { status: 503, headers: privateHeaders },
    );
  }

  const download = await admin.client.storage
    .from("field-observation-media")
    .download(record.data.media.objectPath);

  if (download.error || !download.data) {
    return NextResponse.json(
      { error: "Fotoğraf güvenli depodan alınamadı." },
      { status: 503, headers: privateHeaders },
    );
  }

  const ciphertext = Buffer.from(await download.data.arrayBuffer());
  const decrypted = decryptMedia(
    {
      ...record.data.media.envelope,
      ciphertext,
    },
    mediaConfiguration.data.keys,
  );

  if (
    !decrypted.ok ||
    !(await auditFieldObservationAccess(
      record.data.id,
      "field_observation.photo_viewed",
    ))
  ) {
    return NextResponse.json(
      { error: "Fotoğraf güvenli biçimde açılamadı." },
      { status: 503, headers: privateHeaders },
    );
  }

  return new NextResponse(new Uint8Array(decrypted.data), {
    status: 200,
    headers: {
      ...privateHeaders,
      "Content-Disposition": "inline",
      "Content-Type": "image/jpeg",
    },
  });
}
