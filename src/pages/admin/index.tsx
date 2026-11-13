import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import {
  Users, FileText, Database, Shield, Building2, Send, BookOpen
} from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const CatalogImport = dynamic(() => import("@/components/CatalogImport"), { ssr: false });

const UsersTab = dynamic(() => import("@/components/admin/UsersTab"), { ssr: false });
const DepartmentsTab = dynamic(() => import("@/components/admin/DepartmentsTab"), { ssr: false });
const LogsTab = dynamic(() => import("@/components/admin/LogsTab"), { ssr: false });
const BackupTab = dynamic(() => import("@/components/admin/BackupTab"), { ssr: false });
const TelegramStatus = dynamic(() => import("@/components/admin/TelegramStatus"), { ssr: false });

const tabs = [
  { id: "users", label: "Пользователи", icon: Users },
  { id: "departments", label: "Отделы", icon: Building2 },
  { id: "logs", label: "Журнал", icon: FileText },
  { id: "catalog", label: "Каталог", icon: BookOpen },
  { id: "backup", label: "Копии данных", icon: Database },
  { id: "telegram", label: "Telegram", icon: Send },
];

const VALID_TABS = tabs.map((t) => t.id);

const descriptions: Record<string, string> = {
  users: "Учётные записи. Роль влияет на доступ к управлению системой, а не к таблицам отделов.",
  departments: "Отделы, их руководители и временный доступ администратора. Таблицы отделов здесь не показываются.",
  logs: "События приложения: ошибки, предупреждения и информационные записи.",
  catalog: "Названия для сканера всех пользователей. Сроки и количество не импортируются.",
  backup: "Резервные копии и перенос данных. Восстановление заменяет текущие данные — проверьте выбранную копию.",
  telegram: "Общий бот и очередь уведомлений всех отделов.",
};

/** Admin panel with tabs for users, departments, logs, catalog, backups and Telegram. */
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
      case "departments":
        return <DepartmentsTab />;
      case "logs":
        return <LogsTab />;
      case "catalog":
        return <CatalogImport />;
      case "backup":
        return <BackupTab />;
      case "telegram":
        return <TelegramStatus />;
      default:
        return null;
    }
  };

  if (status === "loading") {
    return <p role="status" className="inventory-page mx-auto w-full max-w-7xl text-[13px] leading-5 text-dash-muted">
      Проверка доступа…
    </p>;
  }
  if (session?.user?.role !== "ADMIN") {
    return <div className="inventory-page mx-auto w-full max-w-7xl space-y-2 rounded-xl border border-dash-line bg-dash-panel p-5">
      <h1 className="work-page-title">Нет доступа</h1>
      <p className="text-sm leading-5 text-dash-ink-2">Этот раздел доступен администратору.</p>
    </div>;
  }

  return (
    <div className="inventory-page admin-workspace mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <span className="entry-icon" aria-hidden="true">
          <Shield className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="work-page-title">Админ панель</h1>
          <p className="mt-1 text-[13px] font-medium leading-5 text-dash-muted">Управление системой и пользователями</p>
        </div>
      </motion.header>

      {/* One tab strip: three columns of two rows on a phone, a single row on a desktop */}
      <div>
        <div role="tablist" aria-label="Разделы админ панели" className="grid grid-cols-3 gap-1 sm:grid-cols-6">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="admin-panel"
                id={`admin-tab-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[12px] font-semibold leading-4 transition-colors sm:min-h-12 sm:flex-row sm:gap-2 sm:text-sm",
                  active ? "text-dash-accent" : "text-dash-muted hover:text-dash-ink",
                )}
              >
                <tab.icon className="size-4 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
                {active && (
                  <motion.span
                    layoutId="admin-tab-underline"
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-dash-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="h-px bg-dash-line" />
      </div>

      <div role="tabpanel" id="admin-panel" aria-labelledby={`admin-tab-${activeTab}`} className="min-w-0">
        <p className="mb-4 text-[13px] leading-5 text-dash-muted">{descriptions[activeTab]}</p>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="min-w-0"
        >
          {renderContent()}
        </motion.div>
      </div>
    </div>
  );
}
