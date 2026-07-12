import type { ReactNode } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { FranqosLogo } from "./franqos-logo";
import { BottomNav } from "./bottom-nav";
import { UnitSwitcher } from "./unit-switcher";
import type { Profile } from "@/hooks/use-profile";

export function MobileShell({
  profile,
  title,
  subtitle,
  unreadCount = 0,
  children,
}: {
  profile: Profile;
  title: string;
  subtitle?: string;
  unreadCount?: number;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[oklch(0.98_0.01_240)] pb-24">
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <FranqosLogo className="h-9 w-9 rounded-md" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">{title}</div>
              {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
            </div>
          </div>
          <Link to="/notifications" className="relative p-2 text-muted-foreground" aria-label="Avisos">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">{children}</main>
      <BottomNav role={profile.role} />
    </div>
  );
}
