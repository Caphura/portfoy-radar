import {
  createEmptyQuickFsboFieldErrors,
  type QuickFsboFieldErrors,
} from "./quick-fsbo-validation";

export type QuickFsboActionState = {
  status: "idle" | "error" | "success";
  fieldErrors: QuickFsboFieldErrors;
  formError: string | null;
  success:
    | {
        message: string;
        maskedPhone: string;
        nextActionAt: string;
      }
    | null;
};

export const initialQuickFsboActionState: QuickFsboActionState = {
  status: "idle",
  fieldErrors: createEmptyQuickFsboFieldErrors(),
  formError: null,
  success: null,
};
