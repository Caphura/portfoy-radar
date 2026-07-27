import { NextResponse } from "next/server";
import { z } from "zod";

import {
  setFieldObservationTrashState,
  updateFieldObservationLocation,
} from "@/server/field-observations/manage-field-observation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const requestSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("location"),
    location: z.unknown(),
  }),
  z.object({
    operation: z.literal("trash"),
  }),
  z.object({
    operation: z.literal("restore"),
  }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ observationId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "İstek biçimi geçersiz." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Saha işlemi geçersiz." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { observationId } = await context.params;
  const result =
    parsed.data.operation === "location"
      ? await updateFieldObservationLocation(
          observationId,
          parsed.data.location,
        )
      : await setFieldObservationTrashState(
          observationId,
          parsed.data.operation === "trash",
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
              : result.error.code === "INVALID_INPUT" ||
                  result.error.code === "LOCATION_PROTECTION_FAILED"
                ? 400
                : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
