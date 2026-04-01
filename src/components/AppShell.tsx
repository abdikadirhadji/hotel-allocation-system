"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { LogoutButton } from "@/components/LogoutButton";

const navItems = [
  { href: "/", label: "لوحة المتابعة اليومية" },
  { href: "/bookings", label: "الحجوزات" },
  { href: "/contracts", label: "الاتفاقيات" },
  { href: "/clients", label: "العملاء" },
  { href: "/hotels", label: "الفنادق" },
];

type AppShellProps = {
  children: ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
    role?: "SUPER_ADMIN" | "ADMIN";
  } | null;
};

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const isPublicPage = pathname === "/login" || pathname === "/setup/admin";
  const allNavItems =
    user?.role === "SUPER_ADMIN"
      ? [...navItems, { href: "/admin-users", label: "إدارة المشرفين" }]
      : navItems;

  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900" dir="rtl">
        <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10">
          <div className="w-full">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" dir="rtl">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-3 py-3 lg:flex-row lg:px-4 lg:py-4">
        <aside className="rounded-2xl bg-slate-900 p-4 text-white shadow-xl lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-72 lg:p-5">
          <h1 className="mb-4 text-center text-base font-extrabold leading-7 lg:mb-6">
            نظام عقود الفنادق وتخصيص الغرف
          </h1>
          <div className="mb-4 rounded-xl bg-slate-800 p-3 text-sm">
            <div className="font-bold">{user?.name ?? "مشرف النظام"}</div>
            <div className="mt-1 text-slate-300">{user?.email ?? "-"}</div>
            <div className="mt-2 text-xs font-semibold text-teal-300">
              {user?.role === "SUPER_ADMIN" ? "مشرف عام" : "مشرف"}
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-2">
            {allNavItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block shrink-0 rounded-lg px-3 py-2 text-sm transition lg:mb-2 ${
                    active
                      ? "bg-teal-500 font-bold text-white"
                      : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </aside>
        <main className="min-h-[calc(100vh-2rem)] flex-1 rounded-2xl bg-white p-4 shadow-sm lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
