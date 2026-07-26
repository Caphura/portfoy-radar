"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel: string;
  tone?: "primary" | "danger";
};

export function SubmitButton({
  children,
  pendingLabel,
  tone = "primary",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-extrabold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70 ${
        tone === "danger"
          ? "bg-red-700 shadow-[0_10px_25px_rgba(185,28,28,0.18)] hover:bg-red-800 focus-visible:outline-red-700"
          : "bg-[var(--brand)] shadow-[0_10px_25px_rgba(24,93,69,0.22)] hover:bg-[#104c37] focus-visible:outline-[var(--brand)]"
      }`}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
