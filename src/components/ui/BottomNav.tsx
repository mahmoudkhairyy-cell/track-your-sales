"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type BottomNavProps = {
  month: string;
};

const ITEMS = [
  {
    href: "/home",
    label: "الرئيسية",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
      </svg>
    ),
  },
  {
    href: "/target",
    label: "التارجت",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/log",
    label: "تسجيل",
    emphasize: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    href: "/wiki",
    label: "المرجع",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" />
        <path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20M8 7h8M8 10h7" />
      </svg>
    ),
  },
  {
    href: "/more",
    label: "المزيد",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
        <path d="m19.4 13.5 1.1.9-1.8 3.1-1.4-.5a7.9 7.9 0 0 1-1.6.9l-.3 1.5h-3.6l-.3-1.5a7.9 7.9 0 0 1-1.6-.9l-1.4.5-1.8-3.1 1.1-.9a7.4 7.4 0 0 1 0-1.8l-1.1-.9 1.8-3.1 1.4.5a7.9 7.9 0 0 1 1.6-.9l.3-1.5h3.6l.3 1.5a7.9 7.9 0 0 1 1.6.9l1.4-.5 1.8 3.1-1.1.9a7.4 7.4 0 0 1 0 1.8Z" />
      </svg>
    ),
  },
];

export function BottomNav({ month }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="tys2-dock fixed z-50 lg:hidden"
      dir="rtl"
    >
      <div className="tys2-dock-grid">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={`${item.href}?month=${month}`}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`tys2-dock-link ${active ? "tys2-dock-link-active" : ""}`}
            >
              <span
                className={`tys2-dock-icon ${
                  item.emphasize
                    ? "tys2-dock-primary"
                    : active
                      ? "tys2-dock-icon-active"
                      : ""
                }`}
              >
                {item.icon}
              </span>
              <span className="tys2-dock-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
