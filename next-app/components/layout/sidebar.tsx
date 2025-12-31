"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import { useI18n } from "@/components/i18n-context";
type NavItem = { href: string; label: string };

const getNavItems = (t: (key: string) => string): NavItem[] => [
  { href: "/", label: t("nav.dashboard") },
  { href: "/oauth", label: t("nav.oauth") },
  { href: "/settings", label: t("nav.settings") },
  { href: "/settings/api-keys", label: t("nav.settings.apiKeys") },
  { href: "/settings/providers", label: t("nav.settings.providers") },
  { href: "/logs", label: t("nav.logs") },
  { href: "/usage", label: t("nav.usage") },
  { href: "/pipeline", label: t("nav.pipeline") },
  { href: "/pricing", label: t("nav.pricing") },
  { href: "/config", label: t("nav.config") },
  { href: "/system", label: t("nav.system") },
];

function SidebarLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const matchExactly = href === "/settings";
  const active =
    pathname === href || (!matchExactly && href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-2 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {label}
    </Link>
  );
}

export function Sidebar() {
  const { t } = useI18n();
  const navItems = getNavItems(t);

  return (
    <aside className="w-56 border-r border-border bg-card/30 backdrop-blur">
      <div className="px-4 py-4 border-b border-border">
        <Link href="/" className="text-lg font-semibold">
          CLIProxy Center
        </Link>
      </div>
      <nav className="flex flex-col gap-1 px-2 py-4">
        {navItems.map((item) => (
          <SidebarLink key={item.href} {...item} />
        ))}
      </nav>
    </aside>
  );
}
