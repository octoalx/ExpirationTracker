import { Home, ScanBarcode, Settings, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";

const navigation = [
  { name: "Главная", href: "/dashboard", icon: Home },
  {
    name: "Сканировать",
    href: "#",
    icon: ScanBarcode,
    action: () => alert("Scan action!"),
  }, // Placeholder
  { name: "Настройки", href: "/settings", icon: Settings },
  { name: "Выйти", href: "#", icon: LogOut, action: () => signOut() },
];

export default function Layout({ children }) {
  const router = useRouter();
  const isAuthPage = router.pathname.startsWith("/auth");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col grow pt-5 bg-white overflow-y-auto shadow-sm border-r border-slate-100">
          <div className="flex items-center shrink-0 px-4">
            {/* Your Logo Here */}
            <h1 className="text-2xl font-bold text-indigo-600">ExpiTrack</h1>
          </div>
          <div className="mt-5 grow flex flex-col">
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {navigation.map((item) => {
                if (item.action) {
                  return (
                    <a
                      key={item.name}
                      onClick={item.action}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer`}
                    >
                      <item.icon className="mr-3 h-6 w-6" />
                      {item.name}
                    </a>
                  );
                }
                return (
                  <Link key={item.name} href={item.href} legacyBehavior>
                    <a
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${router.pathname === item.href ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                    >
                      <item.icon className="mr-3 h-6 w-6" />
                      {item.name}
                    </a>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed inset-x-0 bottom-0 bg-white shadow-t border-t border-slate-100">
        <div className="flex justify-around items-center h-16">
          {navigation.map((item) => {
            if (item.action) {
              return (
                <a
                  key={item.name}
                  onClick={item.action}
                  className={`flex flex-col items-center justify-center w-full text-slate-500 cursor-pointer`}
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-xs">{item.name}</span>
                </a>
              );
            }
            return (
              <Link key={item.name} href={item.href} legacyBehavior>
                <a
                  className={`flex flex-col items-center justify-center w-full ${router.pathname === item.href ? "text-indigo-600" : "text-slate-500"}`}
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-xs">{item.name}</span>
                </a>
              </Link>
            );
          })}
        </div>
      </div>
      {/* Add padding to the bottom of the content to avoid overlap with mobile nav */}
      <div className="md:hidden h-16"></div>
    </div>
  );
}
