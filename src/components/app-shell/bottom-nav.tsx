"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, FolderUp, Pill, Salad, Settings } from "lucide-react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Navegación principal: inferior en móvil (pulgar), lateral en desktop ≥1024.
 * Targets ≥44px; ícono + texto siempre (nunca solo ícono).
 */
export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  const items = [
    { href: "/", label: t.nav.today, Icon: CalendarCheck },
    { href: "/dieta", label: t.nav.diet, Icon: Salad },
    { href: "/suplementos", label: t.nav.supplements, Icon: Pill },
    { href: "/cargar", label: t.nav.load, Icon: FolderUp },
    { href: "/ajustes", label: t.nav.settings, Icon: Settings },
  ];

  return (
    <nav
      aria-label={t.a11y.mainNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:w-44 lg:border-r lg:border-t-0"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)] lg:mt-20 lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
        {items.map(({ href, label, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1 lg:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-xs font-semibold transition-colors lg:flex-row lg:justify-start lg:gap-2.5 lg:px-3 lg:text-sm",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  aria-hidden
                  className="size-5"
                  strokeWidth={active ? 2.4 : 2}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
