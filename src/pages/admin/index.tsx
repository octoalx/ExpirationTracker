import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { 
  Users, FileText, Database, Shield
} from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const CatalogImport = dynamic(() => import("@/components/CatalogImport"), { ssr: false });

const UsersTab = dynamic(() => import("@/components/admin/UsersTab"), { ssr: false });
const LogsTab = dynamic(() => import("@/components/admin/LogsTab"), { ssr: false });
const BackupTab = dynamic(() => import("@/components/admin/BackupTab"), { ssr: false });

const tabs = [
  { id: "users", label: "Пользователи", icon: Users },
  { id: "logs", label: "Журнал", icon: FileText },
  { id: "catalog", label: "Каталог", icon: Database },
  { id: "backup", label: "Копии данных", icon: Database },
];

const VALID_TABS = tabs.map((t) => t.id);

/** Admin panel with tabs for users, logs, and backup management. */
export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("users");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (VALID_TABS.includes(hash)) setActiveTab(hash);
  }, []);

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    router.replace({ hash: id }, undefined, { shallow: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case "users":
        return <UsersTab />;
      case "logs":
        return <LogsTab />;
      case "catalog":
        return <CatalogImport />;
      case "backup":
        return <BackupTab />;
      default:
        return null;
    }
  };

  if (status === "loading") return <p role="status" className="p-4 text-slate-600">Проверка доступа…</p>;
  if (session?.user?.role !== "ADMIN") return <div className="work-surface p-5"><h1>Нет доступа</h1><p className="mt-3 text-sm text-slate-600">Этот раздел доступен администратору.</p></div>;
  const descriptions: Record<string, string> = { catalog: "Общий справочник штрихкодов и названий для сканера всех пользователей. Количество и сроки из файла не импортируются.", users: "Учётные записи и доступ сотрудников. Изменение роли влияет на доступ к управлению системой.", logs: "События приложения: ошибки, предупреждения и информационные записи.", backup: "Резервные копии и перенос данных. Восстановление заменяет текущие данные — проверьте выбранную копию." };
  return (
    <div className="admin-workspace mx-auto max-w-6xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 dark:bg-blue-900/50 p-2.5">
            <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Админ панель
            </h1>
            <p className="text-sm text-muted-foreground">Управление системой и пользователями</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="relative mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 pb-px">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "relative flex min-h-16 flex-col sm:min-h-12 sm:flex-row items-center justify-center gap-2 px-2 py-3 text-center text-sm font-semibold rounded-t-xl",
                  "transition-colors duration-200",
                  active
                    ? "text-blue-700 dark:text-blue-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {active && (
                  <motion.div
                    layoutId="admin-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="h-px bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.12 }}
        className="min-w-0"
      >
        <p className="mb-5 text-sm leading-relaxed text-slate-600">{descriptions[activeTab]}</p>
        {renderContent()}
      </motion.div>
    </div>
  );
}
