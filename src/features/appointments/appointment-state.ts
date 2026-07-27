import {
  createEmptyAppointmentFieldErrors,
  type AppointmentFieldErrors,
} from "./appointment-validation";

export type AppointmentActionState = {
  status: "idle" | "error" | "success";
  fieldErrors: AppointmentFieldErrors;
  formError: string | null;
  success: {
    message: string;
    detail: string;
  } | null;
};

export const initialAppointmentActionState: AppointmentActionState = {
  status: "idle",
  fieldErrors: createEmptyAppointmentFieldErrors(),
  formError: null,
  success: null,
};
