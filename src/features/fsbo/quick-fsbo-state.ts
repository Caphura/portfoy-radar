import {
  createEmptyQuickFsboFieldErrors,
  type QuickFsboFieldErrors,
} from "./quick-fsbo-validation";
import type { DuplicateCandidate } from "./duplicate-review";

export type QuickFsboActionState = {
  status: "idle" | "error" | "review" | "success";
  fieldErrors: QuickFsboFieldErrors;
  formError: string | null;
  separationReasonError: string | null;
  review:
    | {
        candidates: DuplicateCandidate[];
        maskedPhone: string;
      }
    | null;
  success:
    | {
        message: string;
        detail: string;
        maskedPhone: string | null;
        nextActionAt: string | null;
      }
    | null;
};

export const initialQuickFsboActionState: QuickFsboActionState = {
  status: "idle",
  fieldErrors: createEmptyQuickFsboFieldErrors(),
  formError: null,
  separationReasonError: null,
  review: null,
  success: null,
};
