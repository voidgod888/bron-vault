"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import AppHeader from "@/components/app-header";
import { getPageTitle } from "@/lib/menu-config";

export default function ClientLayoutWithSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  // Determine page title based on pathname
  const title = getPageTitle(pathname);

  // Don't render sidebar/header if on login page
  if (pathname === "/login") {
    return (
      <main className="flex-1 bg-background">{children}</main>
    );
  }

  return (
    <>
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <AppHeader title={title} />
        <main className="flex-1 bg-background">{children}</main>
      </div>
    </>
  );
}
