"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import type { UserRole } from "@/types/database";

export function DashboardShell({
  fullName,
  role,
  children,
}: {
  fullName: string;
  role: UserRole;
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-dvh flex">
      <Sidebar role={role} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader fullName={fullName} role={role} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
