import {
  createEmptyConversationFieldErrors,
  type ConversationFieldErrors,
} from "./conversation-validation";

export type ConversationActionState = {
  status: "idle" | "error" | "success";
  fieldErrors: ConversationFieldErrors;
  formError: string | null;
  success: {
    message: string;
    detail: string;
  } | null;
};

export const initialConversationActionState: ConversationActionState = {
  status: "idle",
  fieldErrors: createEmptyConversationFieldErrors(),
  formError: null,
  success: null,
};
