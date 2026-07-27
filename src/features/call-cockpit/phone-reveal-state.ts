export type PhoneRevealActionState = {
  status: "idle" | "error" | "success";
  error: string | null;
  phone: string | null;
};

export const initialPhoneRevealActionState: PhoneRevealActionState = {
  status: "idle",
  error: null,
  phone: null,
};
