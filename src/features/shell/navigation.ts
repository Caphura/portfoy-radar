export type AppNavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  exact: boolean;
  primary?: boolean;
};

export const appNavigationItems = [
  {
    href: "/workspace",
    label: "Ana Sayfa",
    shortLabel: "⌂",
    exact: true,
    primary: false,
  },
  {
    href: "/workspace/radar",
    label: "Radar",
    shortLabel: "◎",
    exact: false,
    primary: false,
  },
  {
    href: "/workspace/ekle",
    label: "Ekle",
    shortLabel: "+",
    exact: false,
    primary: true,
  },
  {
    href: "/workspace/takvim",
    label: "Takvim",
    shortLabel: "□",
    exact: false,
    primary: false,
  },
  {
    href: "/workspace/raporlar",
    label: "Raporlar",
    shortLabel: "↗",
    exact: false,
    primary: false,
  },
] as const satisfies readonly AppNavigationItem[];

export function isNavigationItemActive(
  pathname: string,
  item: AppNavigationItem,
) {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
