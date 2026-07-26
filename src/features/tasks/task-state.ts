export type TaskFieldErrors = {
  taskId?: string[];
  dueAt?: string[];
  nextActionType?: string[];
  nextActionAt?: string[];
};

export type TaskActionState = {
  status: "idle" | "error" | "success";
  fieldErrors: TaskFieldErrors;
  formError: string | null;
  success: string | null;
};

export const initialTaskActionState: TaskActionState = {
  status: "idle",
  fieldErrors: {},
  formError: null,
  success: null,
};
