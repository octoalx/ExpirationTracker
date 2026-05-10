import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { 
  Users, FileText, Database, Shield
} from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const UsersTab = dynamic(() => import("@/components/admin/UsersTab"), { ssr: false });
const LogsTab = dynamic(() => import("@/components/admin/LogsTab"), { ssr: false });
const BackupTab = dynamic(() => import("@/components/admin/BackupTab"), { ssr: false });

const tabs = [
  { id: "users", label: "Пользователи", icon: Users },
  { id: "logs", label: "Логи", icon: FileText },
  { id: "backup", label: "Бэкап", icon: Database },
];

const VALID_TABS = tabs.map((t) => t.id);

/** Admin panel with tabs for users, logs, and backup management. */
export default function AdminPage() {
  const router = useRouter();
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
      case "backup":
        return <BackupTab />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-purple-100 dark:bg-purple-900/50 p-2.5">
            <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
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
        <div className="flex gap-1 overflow-x-auto pb-px scrollbar-none">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-t-xl",
                  "transition-colors duration-200",
                  active
                    ? "text-purple-700 dark:text-purple-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {active && (
                  <motion.div
                    layoutId="admin-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-purple-500"
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
        className="glass-card p-6"
      >
        {renderContent()}
      </motion.div>
    </div>
  );
}
