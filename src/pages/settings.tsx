import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import {
  User,
  Bell,
  Palette,
  AlertTriangle,
  Loader2,
  Send,
  Mail,
  Sun,
  Moon,
  Monitor,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import IntegrationCard from "@/components/IntegrationCard";

/* ── Reusable focus-glow input ───────────────────────────────────────── */
interface GlowInputProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}

function GlowInput({ label, value, onChange, type = "text", placeholder }: GlowInputProps) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border bg-slate-50/80 dark:bg-slate-800/60 px-4 py-3 text-sm text-foreground",
          "border-slate-200 dark:border-slate-700",
          "transition-all duration-200",
          "focus:scale-[1.01] focus:border-emerald-400 focus:bg-white dark:focus:bg-slate-800",
          "focus:ring-2 focus:ring-emerald-300/40 focus:shadow-[0_0_16px_rgba(16,185,129,0.12)]",
          "placeholder:text-slate-400",
        )}
      />
    </div>
  );
}

/* ── Tab definition ──────────────────────────────────────────────────── */
interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
}

const tabs: Tab[] = [
  { id: "personal", label: "Личные данные", icon: User },
  { id: "integrations", label: "Интеграции", icon: Bell },
  { id: "statuses", label: "Статусы", icon: AlertTriangle },
  { id: "appearance", label: "Оформление", icon: Palette },
];

/* ── Theme option card ───────────────────────────────────────────────── */
interface ThemeOptionProps {
  label: string;
  value: string;
  icon: React.ElementType;
  selected: boolean;
  onSelect: () => void;
}

function ThemeOption({ label, value, icon: Icon, selected, onSelect }: ThemeOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200",
        selected
          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
      )}
    >
      <div className={cn(
        "rounded-lg p-2.5",
        selected
          ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <span className={cn(
        "text-xs font-semibold",
        selected ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
      )}>
        {label}
      </span>
      {selected && (
        <motion.div
          layoutId="theme-check"
          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center"
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <span className="text-[8px] text-white font-bold">✓</span>
        </motion.div>
      )}
    </button>
  );
}

/* ── Settings page ───────────────────────────────────────────────────── */
const SettingsPage = () => {
  const { data: session, update: updateSession } = useSession();
  const [activeTab, setActiveTab] = useState("personal");
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isSendingNow, setIsSendingNow] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const [user, setUser] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
  });

  const [settings, setSettings] = useState({
    telegramNotifications: true,
    emailNotifications: false,
    theme: "light",
    urgentThreshold: 3,
    warningThreshold: 7,
    telegramToken: "",
    telegramChatId: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    notificationEmail: "",
    urgentNotifyTime: "10:00",
    warningNotifyTime: "10:00",
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
          setUser((prev) => ({ ...prev, ...data.user }));
        }
      });
  }, []);

  const fireConfetti = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    confetti({
      particleCount: 60,
      spread: 50,
      origin: { x, y },
      colors: ["#059669", "#10b981", "#34d399", "#6ee7b7"],
      ticks: 100,
      gravity: 1.3,
      scalar: 0.85,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleanUser = { name: user.name, email: user.email };
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: cleanUser, settings }),
      });
      if (res.ok) {
        fireConfetti();
        toast.success("Настройки сохранены!");
        updateSession({ user: { ...session?.user, ...cleanUser } });
      } else {
        toast.error("Ошибка сохранения");
      }
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    try {
      const res = await fetch("/api/email/test", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Ошибка отправки тестового письма");
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleSendNow = async () => {
    setIsSendingNow(true);
    try {
      const res = await fetch("/api/email/send-now", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Ошибка отправки уведомлений");
    } finally {
      setIsSendingNow(false);
    }
  };

  /* Tab content */
  const renderContent = () => {
    switch (activeTab) {
      case "personal":
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">Личные данные</h2>
              <p className="text-sm text-muted-foreground">Управление профилем</p>
            </div>
            <GlowInput
              label="Имя"
              value={user.name}
              onChange={(v) => setUser({ ...user, name: v })}
              placeholder="Ваше имя"
            />
            <GlowInput
              label="Email"
              value={user.email}
              onChange={(v) => setUser({ ...user, email: v })}
              type="email"
              placeholder="name@example.com"
            />
          </div>
        );

      case "integrations":
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">Интеграции</h2>
              <p className="text-sm text-muted-foreground">Уведомления и подключения</p>
            </div>

            {/* Telegram */}
            <IntegrationCard
              title="Telegram"
              description="Мгновенные уведомления в мессенджер"
              icon={<Send className="h-5 w-5 text-white" />}
              gradient="from-sky-400 to-blue-500"
              enabled={settings.telegramNotifications}
              onToggle={(v) => setSettings({ ...settings, telegramNotifications: v })}
            >
              <GlowInput
                label="Bot Token"
                value={settings.telegramToken || ""}
                onChange={(v) => setSettings({ ...settings, telegramToken: v })}
                placeholder="123456:ABC-DEF..."
              />
              <GlowInput
                label="Chat ID"
                value={settings.telegramChatId || ""}
                onChange={(v) => setSettings({ ...settings, telegramChatId: v })}
                placeholder="123456789"
              />
            </IntegrationCard>

            {/* Email */}
            <IntegrationCard
              title="Email (SMTP)"
              description="Уведомления на электронную почту"
              icon={<Mail className="h-5 w-5 text-white" />}
              gradient="from-rose-400 to-pink-500"
              enabled={settings.emailNotifications}
              onToggle={(v) => setSettings({ ...settings, emailNotifications: v })}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GlowInput
                  label="SMTP Host"
                  value={settings.smtpHost || ""}
                  onChange={(v) => setSettings({ ...settings, smtpHost: v })}
                  placeholder="smtp.example.com"
                />
                <GlowInput
                  label="SMTP Port"
                  value={settings.smtpPort || ""}
                  onChange={(v) => setSettings({ ...settings, smtpPort: parseInt(v) || 0 })}
                  type="number"
                  placeholder="587"
                />
              </div>
              <GlowInput
                label="SMTP User"
                value={settings.smtpUser || ""}
                onChange={(v) => setSettings({ ...settings, smtpUser: v })}
                placeholder="user@example.com"
              />
              <GlowInput
                label="SMTP Password"
                value={settings.smtpPass || ""}
                onChange={(v) => setSettings({ ...settings, smtpPass: v })}
                type="password"
              />
              <GlowInput
                label="Email для уведомлений"
                value={settings.notificationEmail || ""}
                onChange={(v) => setSettings({ ...settings, notificationEmail: v })}
                type="email"
                placeholder="notify@example.com"
              />
              {/* Notify times */}
              <div className="grid grid-cols-2 gap-3">
                <GlowInput
                  label="Время отчёта Срочно"
                  value={settings.urgentNotifyTime || "10:00"}
                  onChange={(v) => setSettings({ ...settings, urgentNotifyTime: v })}
                  type="time"
                />
                <GlowInput
                  label="Время уведомления Внимание"
                  value={settings.warningNotifyTime || "10:00"}
                  onChange={(v) => setSettings({ ...settings, warningNotifyTime: v })}
                  type="time"
                />
              </div>
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={handleTestEmail}
                  disabled={isTestingEmail || !settings.emailNotifications}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                    "bg-rose-100 text-rose-700 hover:bg-rose-200",
                    "dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "transition-colors",
                  )}
                >
                  {isTestingEmail ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  Тестовое письмо
                </button>
                <button
                  onClick={handleSendNow}
                  disabled={isSendingNow || !settings.emailNotifications}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                    "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
                    "dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "transition-colors",
                  )}
                >
                  {isSendingNow ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Отправить сейчас
                </button>
              </div>
            </IntegrationCard>
          </div>
        );

      case "statuses":
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">Статусы</h2>
              <p className="text-sm text-muted-foreground">Пороги для срочности товаров</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative rounded-2xl p-px overflow-hidden">
                <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-red-400 to-rose-500 opacity-40" />
                <div className="relative rounded-2xl bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-red-100 dark:bg-red-900/50 p-1.5">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Срочно</span>
                  </div>
                  <GlowInput
                    label="Дней до истечения"
                    value={settings.urgentThreshold}
                    onChange={(v) => setSettings({ ...settings, urgentThreshold: parseInt(v) || 0 })}
                    type="number"
                  />
                </div>
              </div>
              <div className="relative rounded-2xl p-px overflow-hidden">
                <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-amber-400 to-orange-500 opacity-40" />
                <div className="relative rounded-2xl bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-amber-100 dark:bg-amber-900/50 p-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Внимание</span>
                  </div>
                  <GlowInput
                    label="Дней до истечения"
                    value={settings.warningThreshold}
                    onChange={(v) => setSettings({ ...settings, warningThreshold: parseInt(v) || 0 })}
                    type="number"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "appearance":
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">Оформление</h2>
              <p className="text-sm text-muted-foreground">Выберите тему интерфейса</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ThemeOption
                label="Светлая"
                value="light"
                icon={Sun}
                selected={settings.theme === "light"}
                onSelect={() => setSettings({ ...settings, theme: "light" })}
              />
              <ThemeOption
                label="Тёмная"
                value="dark"
                icon={Moon}
                selected={settings.theme === "dark"}
                onSelect={() => setSettings({ ...settings, theme: "dark" })}
              />
              <ThemeOption
                label="Системная"
                value="system"
                icon={Monitor}
                selected={settings.theme === "system"}
                onSelect={() => setSettings({ ...settings, theme: "system" })}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      {/* Page title */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Настройки
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Управление аккаунтом и настройками</p>
      </motion.div>

      {/* ── Animated tabs ─────────────────────────────────────────── */}
      <div className="relative mb-8">
        <div className="flex gap-1 overflow-x-auto pb-px scrollbar-none">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-t-xl",
                  "transition-colors duration-200",
                  active
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {active && (
                  <motion.div
                    layoutId="settings-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-emerald-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="h-px bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* ── Tab content ───────────────────────────────────────────── */}
      <div className="glass-card p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>

        {/* Save button */}
        <div className="mt-8 pt-5 border-t border-slate-200/60 dark:border-slate-700/40">
          <button
            ref={btnRef}
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white",
              "bg-linear-to-r from-emerald-600 to-teal-500",
              "shadow-lg shadow-emerald-500/20 dark:shadow-emerald-900/30",
              "hover:shadow-emerald-500/30 hover:scale-[1.02]",
              "active:scale-[0.98]",
              "transition-all duration-200",
              "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100",
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Сохранение…
              </>
            ) : (
              "Сохранить изменения"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
