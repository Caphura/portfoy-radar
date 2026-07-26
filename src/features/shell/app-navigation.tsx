"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  appNavigationItems,
  isNavigationItemActive,
} from "./navigation";

type AppNavigationProps = {
  placement: "desktop" | "mobile";
};

export function AppNavigation({ placement }: AppNavigationProps) {
  const pathname = usePathname();
  const mobile = placement === "mobile";

  return (
    <nav
      aria-label="Ana navigasyon"
      className={
        mobile
          ? "mobile-safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-white/95 px-2 pt-2 shadow-[0_-10px_35px_rgba(18,37,29,0.08)] backdrop-blur-xl lg:hidden"
          : "hidden lg:block"
      }
    >
      <ul className={mobile ? "grid grid-cols-5 gap-1" : "space-y-1.5"}>
        {appNavigationItems.map((item) => {
          const active = isNavigationItemActive(pathname, item);

          return (
            <li key={item.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={
                  mobile
                    ? `group flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[0.65rem] font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
                        active
                          ? "text-[var(--brand)]"
                          : "text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--ink)]"
                      }`
                    : `group flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                        active
                          ? "bg-white text-[var(--ink)] shadow-sm"
                          : "text-white/65 hover:bg-white/10 hover:text-white"
                      }`
                }
                href={item.href}
              >
                <span
                  aria-hidden="true"
                  className={`grid place-items-center font-black ${
                    mobile
                      ? item.primary
                        ? "-mt-6 size-12 rounded-2xl bg-[var(--brand)] text-2xl text-white shadow-[0_10px_24px_rgba(24,93,69,0.28)]"
                        : `size-6 rounded-lg text-lg ${
                            active ? "bg-[var(--brand-soft)]" : ""
                          }`
                      : `size-9 rounded-xl text-lg ${
                          active
                            ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                            : "bg-white/10"
                        }`
                  }`}
                >
                  {item.shortLabel}
                </span>
                <span className={mobile && item.primary ? "-mt-0.5" : ""}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
