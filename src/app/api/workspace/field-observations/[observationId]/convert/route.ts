import { NextResponse } from "next/server";
import { z } from "zod";

import {
  validateDuplicateDecisionForm,
  type DuplicateDecision,
} from "@/features/fsbo/duplicate-review";
import { validatePhysicalFsboInput } from "@/features/field-observations/physical-fsbo-validation";
import { convertFieldObservation } from "@/server/field-observations/convert-field-observation";
import { inspectPhysicalFsboDuplicates } from "@/server/field-observations/physical-duplicates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  input: z.unknown(),
  decision: z
    .object({
      decision: z.enum([
        "use_existing",
        "link_existing_property",
        "keep_separate",
      ]),
      candidateKey: z.string().min(1).max(200),
      separationReason: z.string().max(500).nullable(),
    })
    .nullable()
    .default(null),
});

function validateDecision(
  raw: z.infer<typeof bodySchema>["decision"],
): DuplicateDecision | null | undefined {
  if (!raw) {
    return null;
  }

  const data = new FormData();
  data.set("duplicateDecision", raw.decision);
  data.set("duplicateCandidate", raw.candidateKey);
  data.set("separationReason", raw.separationReason ?? "");
  const validated = validateDuplicateDecisionForm(data);

  return validated.ok ? validated.data : undefined;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ observationId: string }> },
) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Dönüşüm isteği okunamadı." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = bodySchema.safeParse(rawBody);
  const input = body.success
    ? validatePhysicalFsboInput(body.data.input)
    : null;
  const decision = body.success ? validateDecision(body.data.decision) : undefined;

  if (!body.success || !input?.ok || decision === undefined) {
    return NextResponse.json(
      {
        error:
          input && !input.ok
            ? input.message
            : "Dönüşüm alanlarını ve mükerrer kararını kontrol edin.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!decision) {
    const inspection = await inspectPhysicalFsboDuplicates(input.data);

    if (!inspection.ok) {
      return NextResponse.json(
        { error: inspection.error.message },
        {
          status:
            inspection.error.code === "UNAUTHENTICATED"
              ? 401
              : inspection.error.code === "FORBIDDEN"
                ? 403
                : 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    if (inspection.data.candidates.length > 0) {
      return NextResponse.json(
        {
          review: {
            candidates: inspection.data.candidates,
            maskedPhone: inspection.data.maskedPhone,
          },
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const { observationId } = await context.params;
  const result = await convertFieldObservation(
    observationId,
    input.data,
    decision,
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      {
        status:
          result.error.code === "UNAUTHENTICATED"
            ? 401
            : result.error.code === "FORBIDDEN"
              ? 403
              : result.error.code === "DUPLICATE_REVIEW_REQUIRED" ||
                  result.error.code === "STALE_DUPLICATE_REVIEW"
                ? 409
                : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      opportunityId: result.data.opportunity_id,
      listingId: result.data.listing_id,
      outcome: result.data.outcome,
      maskedPhone: result.data.maskedPhone,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
