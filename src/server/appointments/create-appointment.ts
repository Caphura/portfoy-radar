import "server-only";

import { z } from "zod";

import type { AppointmentInput } from "@/features/appointments/appointment-validation";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { getWorkspaceAccess } from "@/server/workspace/access";

const createdAppointmentSchema = z.object({
  appointment_id: z.uuid(),
  preparation_task_id: z.uuid(),
  opportunity_id: z.uuid(),
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  preparation_due_at: z.iso.datetime({ offset: true }),
});

export type CreateAppointmentResult =
  | {
      ok: true;
      data: {
        appointmentId: string;
        preparationTaskId: string;
        opportunityId: string;
        startsAt: string;
        endsAt: string;
        preparationDueAt: string;
      };
    }
  | {
      ok: false;
      error: {
        code:
          | "UNAUTHENTICATED"
          | "WORKSPACE_REQUIRED"
          | "FORBIDDEN"
          | "OPPORTUNITY_NOT_FOUND"
          | "APPOINTMENT_RULE_VIOLATION"
          | "APPOINTMENT_UNAVAILABLE";
        message: string;
      };
    };

export async function createAppointment(
  input: AppointmentInput,
): Promise<CreateAppointmentResult> {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });

  if (!access.ok) {
    switch (access.error.code) {
      case "UNAUTHENTICATED":
      case "WORKSPACE_REQUIRED":
      case "FORBIDDEN":
        return {
          ok: false,
          error: {
            code: access.error.code,
            message: access.error.message,
          },
        };
      case "WORKSPACE_SERVICE_UNAVAILABLE":
        return {
          ok: false,
          error: {
            code: "APPOINTMENT_UNAVAILABLE",
            message:
              "Randevu şu anda oluşturulamıyor. Lütfen yeniden deneyin.",
          },
        };
    }
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_UNAVAILABLE",
        message: "Randevu şu anda oluşturulamıyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const { data, error } = await clientResult.client.rpc(
    "create_appointment",
    {
      requested_opportunity_id: input.opportunityId,
      requested_starts_at: input.startsAt,
      requested_ends_at: input.endsAt,
    },
  );

  if (error) {
    if (error.code === "42501") {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Randevu oluşturmak için yetkiniz bulunmuyor.",
        },
      };
    }

    if (error.code === "P0002") {
      return {
        ok: false,
        error: {
          code: "OPPORTUNITY_NOT_FOUND",
          message:
            "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.",
        },
      };
    }

    if (
      error.code === "23505" ||
      error.code === "23514" ||
      error.code === "22023"
    ) {
      return {
        ok: false,
        error: {
          code: "APPOINTMENT_RULE_VIOLATION",
          message:
            "Randevu bilgileri fırsat durumu veya randevu kurallarıyla uyuşmuyor.",
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "APPOINTMENT_UNAVAILABLE",
        message: "Randevu şu anda oluşturulamıyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const parsed = z.array(createdAppointmentSchema).length(1).safeParse(data);
  const [created] = parsed.success ? parsed.data : [];

  if (
    !created ||
    created.opportunity_id !== input.opportunityId ||
    new Date(created.starts_at).getTime() !==
      new Date(input.startsAt).getTime() ||
    new Date(created.ends_at).getTime() !== new Date(input.endsAt).getTime()
  ) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_UNAVAILABLE",
        message: "Randevu şu anda oluşturulamıyor. Lütfen yeniden deneyin.",
      },
    };
  }

  return {
    ok: true,
    data: {
      appointmentId: created.appointment_id,
      preparationTaskId: created.preparation_task_id,
      opportunityId: created.opportunity_id,
      startsAt: created.starts_at,
      endsAt: created.ends_at,
      preparationDueAt: created.preparation_due_at,
    },
  };
}
