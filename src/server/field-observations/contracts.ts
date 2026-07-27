import { z } from "zod";

export const observationIdSchema = z.uuid();

export const fieldObservationSummarySchema = z.object({
  observation_id: z.uuid(),
  observed_at: z.iso.datetime({ offset: true }),
  created_at: z.iso.datetime({ offset: true }),
  status: z.enum(["upload_pending", "ready", "trashed"]),
  has_location: z.boolean(),
  is_linked: z.boolean(),
});

export type FieldObservationSummary = {
  id: string;
  observedAt: string;
  createdAt: string;
  status: "upload_pending" | "ready" | "trashed";
  hasLocation: boolean;
  isLinked: boolean;
};

export const fieldObservationCreateInputSchema = z.object({
  observedAt: z.iso.datetime({ offset: true }),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().positive().max(100_000),
      capturedAt: z.iso.datetime({ offset: true }),
    })
    .nullable(),
});

export type FieldObservationCreateInput = z.infer<
  typeof fieldObservationCreateInputSchema
>;

export type FieldObservationDetail = {
  id: string;
  observedAt: string;
  createdAt: string;
  status: "ready" | "trashed";
  hasLocation: boolean;
  locationAccuracy: number | null;
  isLinked: boolean;
  listingId: string | null;
  opportunityId: string | null;
  createdByCurrentUser: boolean;
};
