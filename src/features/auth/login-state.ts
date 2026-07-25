export type LoginActionState = {
  status: "idle" | "error";
  fieldErrors: {
    email: string | null;
    password: string | null;
  };
  formError: string | null;
};

export const initialLoginActionState: LoginActionState = {
  status: "idle",
  fieldErrors: {
    email: null,
    password: null,
  },
  formError: null,
};
