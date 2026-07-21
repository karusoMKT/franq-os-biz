import { Link, useLocation } from "@tanstack/react-router";
import { Home, BookOpen, User, ListChecks, ShieldCheck, Wallet, Users } from "lucide-react";
import type { AppRole } from "@/hooks/use-profile";

type Item = { to: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> };

const ITEMS: Record<AppRole, Item[]> = {
  owner: [
    { to: "/dashboard/owner", label: "Início", icon: Home },
    { to: "/finance", label: "Financeiro", icon: Wallet },
    { to: "/daily-checklists", label: "Rotina", icon: ListChecks },
    { to: "/audits", label: "Auditoria", icon: ShieldCheck },
    { to: "/team", label: "Equipe", icon: Users },
    { to: "/pops", label: "POPs", icon: BookOpen },
    { to: "/profile", label: "Perfil", icon: User },
  ],
  manager: [
    { to: "/dashboard/manager", label: "Início", icon: Home },
    { to: "/daily-checklists", label: "Rotina", icon: ListChecks },
    { to: "/team", label: "Equipe", icon: Users },
    { to: "/pops", label: "POPs", icon: BookOpen },
    { to: "/profile", label: "Perfil", icon: User },
  ],
  employee: [
    { to: "/daily-checklists", label: "Rotina", icon: ListChecks },
    { to: "/pops", label: "POPs", icon: BookOpen },
    { to: "/profile", label: "Perfil", icon: User },
  ],
};

export function BottomNav({ role }: { role: AppRole }) {
  const loc = useLocation();
  const items = ITEMS[role];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <ul
        className="mx-auto max-w-md grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ to, label, icon: Icon }) => {
          const active = loc.pathname === to || loc.pathname.startsWith(to + "/");
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] ${
                  active ? "text-[color:var(--franqos-blue)] font-semibold" : "text-muted-foreground"
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
