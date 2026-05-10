import { useState, useEffect, type ReactNode } from "react";
import {
  Home,
  Settings,
  LogOut,
  Shield,
  BarChart3,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import BackToTop from "@/components/BackToTop";
import AnimatedBackground from "@/components/AnimatedBackground";

interface LayoutProps {
  children: ReactNode;
}

/** Renders current year on the client to avoid hydration mismatch. */
function ClientYear() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return <>{year ?? "2024"}</>;
}

/** App shell with desktop sidebar, mobile bottom nav, and background. */
export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAuthPage = router.pathname.startsWith("/auth");

  const navigation: { name: string; href: string; icon: typeof Home; action?: () => void }[] = [
    { name: "Главная", href: "/dashboard", icon: Home },
    { name: "Статистика", href: "/stats", icon: BarChart3 },
    { name: "Настройки", href: "/settings", icon: Settings },
  ];

  if (session?.user?.role === "ADMIN") {
    navigation.push({ name: "Админ", href: "/admin", icon: Shield });
  }

  navigation.push({
    name: "Выйти",
    href: "#",
    icon: LogOut,
    action: () => signOut({ redirect: false }).then(() => router.push('/auth/signin')),
  });

  if (isAuthPage) {
    return <>{children}</>;
  }

  const isActive = (href: string) => router.pathname === href;

  return (
    <div className="min-h-screen bg-animated-gradient">
      <AnimatedBackground />
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30",
          "bg-white/80 dark:bg-slate-900/80",
          "backdrop-blur-xl",
          "border-r border-white/40 dark:border-slate-700/40",
          "shadow-[4px_0_24px_rgba(0,0,0,0.04)]",
        )}
      >
        <div className="flex flex-col grow pt-6 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center justify-center px-5 mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight bg-linear-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              ExpiTrack
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 pb-4 space-y-1">
            {navigation.map((item) => {
              const active = !item.action && isActive(item.href);

              if (item.action) {
                return (
                  <a
                    key={item.name}
                    onClick={item.action}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl cursor-pointer",
                      "text-slate-500 dark:text-slate-400",
                      "hover:bg-slate-100/80 dark:hover:bg-slate-800/60",
                      "hover:text-slate-700 dark:hover:text-slate-200",
                      "hover:scale-x-105 origin-left transition-all duration-200",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </a>
                );
              }

              return (
                <Link key={item.name} href={item.href} legacyBehavior>
                  <a
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl",
                      "transition-all duration-200",
                      active
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)] font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 hover:scale-x-105 origin-left",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5 transition-colors",
                        active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300",
                      )}
                    />
                    {item.name}
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                    )}
                  </a>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-200/60 dark:border-slate-700/40">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              &copy; <ClientYear /> ExpiTrack
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="py-6 pb-24 md:pb-6">
            <div className="w-full mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className={cn(
          "md:hidden fixed inset-x-0 bottom-0 z-30",
          "bg-white/80 dark:bg-slate-900/80",
          "backdrop-blur-xl",
          "border-t border-white/40 dark:border-slate-700/40",
          "shadow-[0_-4px_24px_rgba(0,0,0,0.06)]",
        )}
      >
        <div className="flex justify-around items-center h-16 px-2">
          {navigation
            .filter((item) => item.name !== "Выйти")
            .map((item) => {
              const active = !item.action && isActive(item.href);

              if (item.action) {
                return (
                  <button
                    key={item.name}
                    onClick={item.action}
                    className={cn(
                      "flex flex-col items-center justify-center w-16 py-1 rounded-xl cursor-pointer",
                      "text-slate-400 dark:text-slate-500",
                      "active:scale-95 transition-all duration-200",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] mt-0.5">{item.name}</span>
                  </button>
                );
              }

              return (
                <Link key={item.name} href={item.href} legacyBehavior>
                  <a
                    className={cn(
                      "relative flex flex-col items-center justify-center w-16 py-1 rounded-xl",
                      "transition-all duration-200",
                      active
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-400 dark:text-slate-500",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        active && "scale-110",
                      )}
                    />
                    <span className={cn("text-[10px] mt-0.5", active && "font-semibold")}>
                      {item.name}
                    </span>
                    {active && (
                      <span className="absolute -bottom-0.5 h-1 w-6 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                    )}
                  </a>
                </Link>
              );
            })}
        </div>
      </nav>

      {/* Global utilities */}
      <BackToTop />
    </div>
  );
}
