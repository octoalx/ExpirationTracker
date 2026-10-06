import type { ReactNode } from "react";
import { Package, Settings, LogOut, Shield, BarChart3, ClipboardCheck } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import BackToTop from "@/components/BackToTop";

/** Light work-tool shell with persistent thumb navigation and safe-area spacing. */
export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session } = useSession();
  if (router.pathname.startsWith("/auth")) return <>{children}</>;
  const navigation = [
    { name: "Товары", href: "/dashboard", icon: Package },
    { name: "Обход", href: "/store", icon: ClipboardCheck },
    { name: "Статистика", href: "/stats", icon: BarChart3 },
    { name: "Настройки", href: "/settings", icon: Settings },
    ...(session?.user?.role === "ADMIN" ? [{ name: "Админ", href: "/admin", icon: Shield }] : []),
  ];
  const brand = <span className="work-brand">Expi<span className="text-blue-700">Track</span></span>;
  return <div className="work-shell min-h-dvh">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-slate-200 bg-white px-4 py-7 md:flex">
      <Link href="/dashboard" className="px-3 pb-9">{brand}</Link>
      <nav aria-label="Основная навигация" className="flex-1 space-y-2">{navigation.map(item => <Link key={item.href} href={item.href} aria-current={router.pathname === item.href ? "page" : undefined}
        className={cn("flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium", router.pathname === item.href ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50")}><item.icon className="size-5" />{item.name}</Link>)}</nav>
      <p className="truncate px-3 pb-3 text-sm text-slate-600">{session?.user?.name}</p>
      <button className="flex min-h-12 items-center gap-3 px-3 text-sm text-slate-600" onClick={() => void signOut({ callbackUrl: "/auth/signin" })}><LogOut className="size-5" />Выйти</button>
    </aside>
    <header className="flex min-h-16 items-center px-5 pb-2 pt-5 md:hidden"><Link href="/dashboard">{brand}</Link></header>
    <main className="work-main mx-auto w-full px-4 py-5 md:pl-64 md:pr-8 md:pt-8">{children}</main>
    <nav aria-label="Мобильная навигация" className="phone-nav fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden"><div className="flex min-h-16 items-stretch">{navigation.map(item => {
      const active = router.pathname === item.href;
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs", active ? "text-blue-700" : "text-slate-600")}><item.icon className="size-5" /><span>{item.name}</span>{active && <span className="absolute bottom-1 h-0.5 w-5 rounded-full bg-blue-700" />}</Link>;
    })}</div></nav>
    <BackToTop />
  </div>;
}
