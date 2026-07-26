import {
  createEmptyCommunicationBlockFieldErrors,
  type CommunicationBlockFieldErrors,
} from "./communication-block-validation";

export type CommunicationBlockActionState = {
  status: "idle" | "error" | "success";
  fieldErrors: CommunicationBlockFieldErrors;
  formError: string | null;
  success: {
    message: string;
    detail: string;
  } | null;
};

export const initialCommunicationBlockActionState: CommunicationBlockActionState =
  {
    status: "idle",
    fieldErrors: createEmptyCommunicationBlockFieldErrors(),
    formError: null,
    success: null,
  };
