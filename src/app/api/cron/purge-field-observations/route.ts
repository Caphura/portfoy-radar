import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/server/supabase/admin-client";
import { callUntypedRpc } from "@/server/supabase/untyped-rpc";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const claimSchema = z.array(
  z.object({
    observation_id: z.uuid(),
    object_path: z.string().min(1).max(200),
    cleanup_kind: z.enum(["abandoned_upload", "expired_trash"]),
  }),
);

function hasValidCronSecret(request: Request): boolean {
  const configured = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "");

  if (!configured || !provided) {
    return false;
  }

  const configuredBytes = Buffer.from(configured);
  const providedBytes = Buffer.from(provided);

  return (
    configuredBytes.length === providedBytes.length &&
    timingSafeEqual(configuredBytes, providedBytes)
  );
}

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json(
      { error: "Temizlik yetkisi doğrulanamadı." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const admin = createAdminSupabaseClient();

  if (!admin.ok) {
    return NextResponse.json(
      { error: "Temizlik servisi yapılandırılmadı." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const claimResponse = await callUntypedRpc(
    admin.client,
    "claim_field_observations_for_cleanup",
    { requested_batch_size: 100 },
  );
  const claims = claimSchema.safeParse(claimResponse.data);

  if (claimResponse.error || !claims.success) {
    return NextResponse.json(
      { error: "Temizlik listesi güvenli biçimde alınamadı." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let completed = 0;
  let deferred = 0;

  for (const claim of claims.data) {
    const removal = await admin.client.storage
      .from("field-observation-media")
      .remove([claim.object_path]);

    if (removal.error) {
      await callUntypedRpc(
        admin.client,
        "release_field_observation_cleanup_claim",
        { requested_observation_id: claim.observation_id },
      );
      deferred += 1;
      continue;
    }

    const completion = await callUntypedRpc(
      admin.client,
      "complete_field_observation_cleanup",
      { requested_observation_id: claim.observation_id },
    );

    if (completion.error || completion.data !== true) {
      await callUntypedRpc(
        admin.client,
        "release_field_observation_cleanup_claim",
        { requested_observation_id: claim.observation_id },
      );
      deferred += 1;
      continue;
    }

    completed += 1;
  }

  return NextResponse.json(
    {
      status: "ok",
      claimed: claims.data.length,
      completed,
      deferred,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
