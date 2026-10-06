import { notifySettingsChanged } from "@/lib/inventory-settings";
import { useState, useEffect, useId } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  User,
  Bell,
  AlertTriangle,
  Loader2,
  Send,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import IntegrationCard from "@/components/IntegrationCard";

/* ── Glow input ── */
interface GlowInputProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  inputClassName?: string;
  autoComplete?: string;
}

function GlowInput({ label, value, onChange, onBlur, type = "text", placeholder, inputClassName, autoComplete }: GlowInputProps) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-semibold text-muted-foreground mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn(
          "w-full min-w-0 rounded-xl border bg-slate-50/80 dark:bg-slate-800/60 px-4 py-3 text-base text-foreground",
          "border-slate-200 dark:border-slate-700",
          "transition-all duration-200",
          " focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800",
          "focus:ring-2 focus:ring-blue-300/40 ",
          "placeholder:text-slate-400",
          inputClassName,
        )}
      />
    </div>
  );
}

/* ── Tabs ── */
interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
}

const tabs: Tab[] = [
  { id: "personal", label: "Личные данные", icon: User },
  { id: "integrations", label: "Интеграции", icon: Bell },
  { id: "statuses", label: "Статусы", icon: AlertTriangle },
];

/* ── Settings page ── */
/** User settings page with personal info, integrations, and status thresholds. */
const SettingsPage = () => {
  const { data: session, update: updateSession } = useSession();
  const [activeTab, setActiveTab] = useState("personal");
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [user, setUser] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
  });

  const [settings, setSettings] = useState({
    telegramNotifications: true,
    emailNotifications: false,
    urgentThreshold: 3 as number | string,
    warningThreshold: 7 as number | string,
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
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => {
        if (data) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
          setUser((prev) => ({ ...prev, ...data.user }));
          setIsLoaded(true);
        }
      }).catch(() => toast.error("Не удалось загрузить настройки. Обновите страницу."));
  }, []);

  const handleSave = async () => {
    if (newPassword !== confirmPassword) { toast.error("Новые пароли не совпадают."); return; }
    if (newPassword && (newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72)) {
      toast.error("Пароль: минимум 8 символов, максимум 72 байта UTF-8."); return;
    }
    const normalizedSettings = {
      ...settings,
      urgentThreshold: Number(settings.urgentThreshold),
      warningThreshold: Number(settings.warningThreshold),
    };
    setSettings(normalizedSettings);
    setIsSaving(true);
    try {
      const cleanUser = { name: user.name, email: user.email };
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: cleanUser, settings: normalizedSettings, currentPassword, newPassword }),
      });
      if (res.ok) {
        notifySettingsChanged();
        toast.success("Настройки сохранены!");
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        await updateSession();
      } else {
        const error = await res.json();
        toast.error(error.message || "Ошибка сохранения");
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

  /* ── Tab content ── */
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
              autoComplete="name"
            />
            <GlowInput
              label="Email"
              value={user.email}
              onChange={(v) => setUser({ ...user, email: v })}
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
            />
            <p className="text-sm text-muted-foreground">Этот email используется для входа. Отдельный адрес для уведомлений можно указать во вкладке «Интеграции».</p>
            <div className="space-y-4 border-t pt-5">
              <h3 className="text-base font-semibold">Безопасность аккаунта</h3>
              <p className="text-sm text-muted-foreground">Для смены email или пароля нужен текущий пароль. Чтобы сохранить только имя или настройки, оставьте поля пароля пустыми.</p>
              <GlowInput label="Текущий пароль" type="password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
              <GlowInput label="Новый пароль" type="password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
              <GlowInput label="Повторите новый пароль" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
              <p className="text-sm text-muted-foreground">Минимум 8 символов, максимум 72 байта UTF-8 (до 72 латинских или 36 кириллических символов). После сохранения используйте новый email и пароль при входе.</p>
            </div>
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
              enabled={settings.emailNotifications}
              onToggle={(v) => setSettings({ ...settings, emailNotifications: v })}
            >
              <div className="grid grid-cols-1 items-end sm:grid-cols-2 gap-3">
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
                placeholder={(settings as Record<string, unknown>).hasSmtpPass ? "••••••••••••••••" : ""}
                inputClassName="placeholder:text-lg placeholder:tracking-widest"
              />
              <GlowInput
                label="Email для уведомлений"
                value={settings.notificationEmail || ""}
                onChange={(v) => setSettings({ ...settings, notificationEmail: v })}
                type="email"
                placeholder="notify@example.com"
              />
              {/* Notify times */}
              <div className="grid grid-cols-1 items-end sm:grid-cols-2 gap-3">
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
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Поля «Срочно» и «Внимание» определяют, какие товары попадают во вкладку «Скоро истекает».</p>
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
                    onChange={(v) => setSettings({ ...settings, urgentThreshold: v === "" ? "" : parseInt(v, 10) || 0 })}
                    onBlur={() => setSettings((prev) => ({ ...prev, urgentThreshold: Number(prev.urgentThreshold) }))}
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
                    onChange={(v) => setSettings({ ...settings, warningThreshold: v === "" ? "" : parseInt(v, 10) || 0 })}
                    onBlur={() => setSettings((prev) => ({ ...prev, warningThreshold: Number(prev.warningThreshold) }))}
                    type="number"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
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

      {/* Animated tabs */}
      <div className="relative mb-8">
        <div className="grid grid-cols-3 gap-1 pb-px">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-2 rounded-t-xl px-2 py-3 text-center text-sm font-semibold sm:min-h-12 sm:flex-row",
                  "transition-colors duration-200",
                  active
                    ? "text-blue-700 dark:text-blue-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {active && (
                  <motion.div
                    layoutId="settings-tab-underline"
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

      {/* Tab content */}
      <div className="work-surface p-4 sm:p-6">
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
            onClick={handleSave}
            disabled={isSaving || !isLoaded}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white",
              "bg-blue-700 hover:bg-blue-800",
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
