"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import {
  FileText,
  ClipboardList,
  BookOpen,
  Settings,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const sidebarLinks = [
  {
    href: "/dashboard/knowledge-base",
    label: "Knowledge Base",
    icon: FileText,
  },
  {
    href: "/dashboard/questionnaires",
    label: "Questionnaires",
    icon: ClipboardList,
  },
  {
    href: "/dashboard/answer-library",
    label: "Answer Library",
    icon: BookOpen,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center gap-2 px-4">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">SecureQuest</span>
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 p-2">
          {sidebarLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Separator />
        <div className="p-4">
          <OrganizationSwitcher
            appearance={{
              elements: {
                rootBox: "w-full",
              },
            }}
          />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-end border-b px-6">
          <UserButton afterSignOutUrl="/" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
