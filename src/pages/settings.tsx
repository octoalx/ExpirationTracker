import { notifySettingsChanged } from "@/lib/inventory-settings";
import { useState, useEffect, useId, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  User,
  Bell,
  Gauge,
  Loader2,
  Send,
  Mail,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import IntegrationCard, { IntegrationSwitch } from "@/components/IntegrationCard";
import TelegramConnect from "@/components/TelegramConnect";
import StoreTeam from "@/components/store/StoreTeam";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { settingsTabPatch } from "@/lib/settings-draft";

/**
 * The password rule has one source: the wording under the fields and the check
 * that runs before saving both read these numbers.
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_RULE = `Пароль: минимум ${PASSWORD_MIN_LENGTH} символов, максимум ${PASSWORD_MAX_BYTES} байта UTF-8.`;
const PASSWORD_HINT = `Минимум ${PASSWORD_MIN_LENGTH} символов, максимум ${PASSWORD_MAX_BYTES} байта UTF-8 (до ${PASSWORD_MAX_BYTES} латинских или ${PASSWORD_MAX_BYTES / 2} кириллических символов). После сохранения используйте новый email и пароль при входе.`;

/** Shared field look: the dashboard control border, a 44 px target, tabular numbers. */
const FIELD =
  "w-full min-w-0 min-h-11 rounded-[10px] border border-dash-control bg-white px-3 py-2 text-[15px] leading-5 text-dash-ink tabular-nums transition-colors placeholder:text-dash-muted focus-visible:border-dash-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/35 disabled:cursor-not-allowed disabled:border-dash-line disabled:bg-dash-surface disabled:text-dash-ink-2";

/* ── Field with a label above ── */
interface FieldProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  inputClassName?: string;
  autoComplete?: string;
  disabled?: boolean;
}

function Field({ label, value, onChange, onBlur, type = "text", placeholder, inputClassName, autoComplete, disabled }: FieldProps) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn(FIELD, inputClassName)}
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
  { id: "team", label: "Команда", icon: Users },
  { id: "integrations", label: "Интеграции", icon: Bell },
  { id: "statuses", label: "Статусы", icon: Gauge },
];

/** The team tab exists only for an account that belongs to a department. */
const TEAM_TAB = "team";

/** Section title inside a tab, with the optional one-line note under it. */
function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <h3 className="text-[15px] font-extrabold leading-5 text-dash-ink">{title}</h3>
      {note && <p className="mt-1 text-[13px] leading-5 text-dash-muted">{note}</p>}
    </div>
  );
}

/* ── Settings page ── */
/** User settings page with personal info, the department team, integrations and status thresholds. */
const SettingsPage = () => {
  const { data: session, update: updateSession } = useSession();
  const [activeTab, setActiveTab] = useState("personal");
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storeRole, setStoreRole] = useState<string | null>(null);
  const [team, setTeam] = useState<any>(null);
  const [teamError, setTeamError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [user, setUser] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
  });

  const [settings, setSettings] = useState({
    telegramNotifications: false,
    emailNotifications: false,
    urgentThreshold: 3 as number | string,
    warningThreshold: 7 as number | string,
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    notificationEmail: "",
    urgentNotifyTime: "10:00",
    warningNotifyTime: "10:00",
  });
  const [saved, setSaved] = useState({ user, settings });
  const tabPatch = (tab: string) => settingsTabPatch(tab, user, settings, saved.user, saved.settings);
  const tabDirty = (tab: string) => {
    const patch = tabPatch(tab);
    return !!(Object.keys(patch.user).length || Object.keys(patch.settings).length ||
      (tab === "personal" && (newPassword || confirmPassword)));
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => {
        if (data) {
          // For a department member the server already answers with the department thresholds.
          const loadedSettings = { ...settings, ...data.settings, smtpPass: "" };
          const loadedUser = { name: data.user?.name ?? "", email: data.user?.email ?? "" };
          setSettings(loadedSettings);
          setUser(loadedUser);
          setSaved({ user: loadedUser, settings: loadedSettings });
          setIsLoaded(true);
          setStoreRole(data.storeRole ?? null);
        }
      }).catch(() => toast.error("Не удалось загрузить настройки. Обновите страницу."));
  }, []);

  /* The team list has its own endpoint and refreshes after every hiring action. */
  const loadTeam = useCallback(async () => {
    try {
      const res = await fetch("/api/store/members");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setTeam(data); setTeamError("");
    } catch (e) { setTeamError(e instanceof Error ? e.message : "Ошибка сети."); }
  }, []);
  useEffect(() => { void loadTeam(); }, [loadTeam]);

  const handleSave = async () => {
    const savingTab = activeTab;
    const patch = tabPatch(savingTab);
    if (!tabDirty(savingTab)) return;
    if (savingTab === "personal" && newPassword !== confirmPassword) { toast.error("Новые пароли не совпадают."); return; }
    if (savingTab === "personal" && newPassword && (newPassword.length < PASSWORD_MIN_LENGTH || new TextEncoder().encode(newPassword).length > PASSWORD_MAX_BYTES)) {
      toast.error(PASSWORD_RULE); return;
    }
    const payload = {
      ...(Object.keys(patch.user).length ? { user: patch.user } : {}),
      ...(Object.keys(patch.settings).length ? { settings: patch.settings } : {}),
      ...(savingTab === "personal" ? { currentPassword, newPassword } : {}),
    };
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        notifySettingsChanged();
        setSaved(prev => ({ user: { ...prev.user, ...patch.user }, settings: { ...prev.settings, ...patch.settings, smtpPass: "" } }));
        toast.success("Изменения вкладки сохранены!");
        if (savingTab === "personal") {
          setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
          await updateSession();
        }
        if (savingTab === "integrations") setSettings(prev => ({ ...prev, smtpPass: "" }));
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
              <h2 className="text-base font-extrabold leading-5 text-dash-ink">Личные данные</h2>
              <p className="mt-1 text-[13px] font-medium leading-5 text-dash-muted">Управление профилем</p>
            </div>
            <div className="space-y-4">
              <Field
                label="Имя"
                value={user.name}
                onChange={(v) => setUser({ ...user, name: v })}
                placeholder="Ваше имя"
                autoComplete="name"
              />
              <Field
                label="Email"
                value={user.email}
                onChange={(v) => setUser({ ...user, email: v })}
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
              />
              <p className="text-[13px] leading-5 text-dash-muted">Этот email используется для входа. Отдельный адрес для уведомлений можно указать во вкладке «Интеграции».</p>
            </div>
            <div className="space-y-4 border-t border-dash-line pt-5">
              <SectionTitle
                title="Безопасность аккаунта"
                note="Для смены email или пароля нужен текущий пароль. Чтобы сохранить только имя или настройки, оставьте поля пароля пустыми."
              />
              <Field label="Текущий пароль" type="password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
              <Field label="Новый пароль" type="password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
              <Field label="Повторите новый пароль" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
              <p className="text-[13px] leading-5 text-dash-muted">{PASSWORD_HINT}</p>
            </div>
          </div>
        );

      case "integrations":
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-extrabold leading-5 text-dash-ink">Интеграции</h2>
              <p className="mt-1 text-[13px] font-medium leading-5 text-dash-muted">Уведомления и подключения</p>
            </div>

            {/* Telegram */}
            <section className="space-y-3 rounded-[10px] border border-dash-line p-4">
              <h3 className="text-[15px] font-extrabold leading-5 text-dash-ink">Telegram · помощник для обхода</h3>
              <TelegramConnect onConnected={() => setSettings(prev => ({ ...prev, telegramNotifications: true }))} />
              <div className="flex min-h-11 items-center justify-between gap-3">
                <span className="text-sm font-semibold leading-5 text-dash-ink">Личные уведомления в Telegram</span>
                <IntegrationSwitch
                  label="Личные уведомления в Telegram"
                  checked={settings.telegramNotifications}
                  onChange={checked => setSettings(prev => ({ ...prev, telegramNotifications: checked }))}
                />
              </div>
              <p className="text-[13px] leading-5 text-dash-muted">Выключение уведомлений сохраняет доступ к боту. Для применения нажмите «Сохранить».</p>
            </section>

            <section className="space-y-3 rounded-[10px] border border-dash-line p-4">
              <SectionTitle
                title="Расписание уведомлений"
                note="Время Минска (Europe/Minsk). Используется для Telegram и email."
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Ежедневный отчёт Срочно" type="time" value={settings.urgentNotifyTime} onChange={v => setSettings(prev => ({ ...prev, urgentNotifyTime: v }))} />
                <Field label="Раннее предупреждение Внимание" type="time" value={settings.warningNotifyTime} onChange={v => setSettings(prev => ({ ...prev, warningNotifyTime: v }))} />
              </div>
            </section>

            {/* Email */}
            <IntegrationCard
              title="Email (SMTP)"
              description="Уведомления на электронную почту"
              icon={<Mail className="size-5" />}
              enabled={settings.emailNotifications}
              onToggle={(v) => setSettings({ ...settings, emailNotifications: v })}
            >
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                <Field
                  label="SMTP Host"
                  value={settings.smtpHost || ""}
                  onChange={(v) => setSettings({ ...settings, smtpHost: v })}
                  placeholder="smtp.example.com"
                />
                <Field
                  label="SMTP Port"
                  value={settings.smtpPort || ""}
                  onChange={(v) => setSettings({ ...settings, smtpPort: parseInt(v) || 0 })}
                  type="number"
                  placeholder="587"
                />
              </div>
              <Field
                label="SMTP User"
                value={settings.smtpUser || ""}
                onChange={(v) => setSettings({ ...settings, smtpUser: v })}
                placeholder="user@example.com"
              />
              <Field
                label="SMTP Password"
                value={settings.smtpPass || ""}
                onChange={(v) => setSettings({ ...settings, smtpPass: v })}
                type="password"
                placeholder={(settings as Record<string, unknown>).hasSmtpPass ? "••••••••••••••••" : ""}
                inputClassName="placeholder:text-lg placeholder:tracking-widest"
              />
              <Field
                label="Email для уведомлений"
                value={settings.notificationEmail || ""}
                onChange={(v) => setSettings({ ...settings, notificationEmail: v })}
                type="email"
                placeholder="notify@example.com"
              />
              {/* The test send is a secondary action, the same shape as every other action. */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={isTestingEmail || !settings.emailNotifications}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-dash-control bg-white px-4 text-[13px] font-semibold text-dash-ink-2 transition-colors hover:bg-dash-surface disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isTestingEmail ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
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
              <h2 className="text-base font-extrabold leading-5 text-dash-ink">Статусы</h2>
              <p className="mt-1 text-[13px] font-medium leading-5 text-dash-muted">Пороги для срочности товаров</p>
              <p className="mt-2 text-[13px] leading-5 text-dash-ink-2">Поля «Срочно» и «Внимание» определяют, какие товары попадают во вкладку «Скоро истекает».</p>
              {storeRole && <p className="mt-2 text-[13px] leading-5 text-dash-ink-2">Для отдела действуют общие пороги, их меняет руководитель во вкладке «Команда». <Link href="/store" className="inline-flex min-h-11 items-center font-semibold text-dash-accent hover:text-dash-accent/80">Обход и таблица отдела</Link></p>}
            </div>
            {/* Two cells in the dashboard summary shape: label, number, note. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex min-h-[104px] flex-col justify-between gap-1 rounded-[10px] border border-dash-line bg-dash-panel px-4 py-3 md:min-h-[126px] md:px-5 md:py-4">
                <span className="flex items-center gap-2 text-[12px] font-bold leading-4 text-dash-ink-2 md:text-sm md:leading-5">
                  <i className="size-2 shrink-0 rounded-full bg-dash-expired" aria-hidden="true" />
                  Срочно
                </span>
                <input
                  aria-label="Срочно, дней до истечения"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={settings.urgentThreshold}
                  disabled={!!storeRole}
                  onChange={(v) => setSettings({ ...settings, urgentThreshold: v.target.value === "" ? "" : parseInt(v.target.value, 10) || 0 })}
                  onBlur={() => setSettings((prev) => ({ ...prev, urgentThreshold: Number(prev.urgentThreshold) }))}
                  className="w-full min-w-0 min-h-11 appearance-none border-0 border-b border-dash-line bg-transparent p-0 pb-1 text-[28px] font-extrabold leading-9 tabular-nums text-dash-expired outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:border-dash-accent disabled:border-transparent disabled:opacity-100 md:text-[40px] md:leading-[48px]"
                />
                <span className="text-[13px] font-semibold leading-5 text-dash-muted">Дней до истечения</span>
              </label>
              <label className="flex min-h-[104px] flex-col justify-between gap-1 rounded-[10px] border border-dash-line bg-dash-panel px-4 py-3 md:min-h-[126px] md:px-5 md:py-4">
                <span className="flex items-center gap-2 text-[12px] font-bold leading-4 text-dash-ink-2 md:text-sm md:leading-5">
                  <i className="size-2 shrink-0 rounded-full bg-dash-amber-bar" aria-hidden="true" />
                  Внимание
                </span>
                <input
                  aria-label="Внимание, дней до истечения"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={settings.warningThreshold}
                  disabled={!!storeRole}
                  onChange={(v) => setSettings({ ...settings, warningThreshold: v.target.value === "" ? "" : parseInt(v.target.value, 10) || 0 })}
                  onBlur={() => setSettings((prev) => ({ ...prev, warningThreshold: Number(prev.warningThreshold) }))}
                  className="w-full min-w-0 min-h-11 appearance-none border-0 border-b border-dash-line bg-transparent p-0 pb-1 text-[28px] font-extrabold leading-9 tabular-nums text-dash-amber-ink outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:border-dash-accent disabled:border-transparent disabled:opacity-100 md:text-[40px] md:leading-[48px]"
                />
                <span className="text-[13px] font-semibold leading-5 text-dash-muted">Дней до истечения</span>
              </label>
            </div>
          </div>
        );

      case "team":
        return <div className="space-y-4">
          {teamError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-dash-expired bg-dash-expired-soft px-4 py-3">
            <p className="text-[13px] font-semibold leading-5 text-dash-expired">{teamError}</p>
            <Button variant="outline" className="min-h-11" onClick={() => void loadTeam()}>Повторить</Button>
          </div>}
          {!team && !teamError && <p role="status" className="text-[13px] leading-5 text-dash-muted">Загружаем команду…</p>}
          {team && !team.store && <p className="text-sm leading-5 text-dash-ink-2">Вы не входите ни в один отдел, поэтому добавлять сотрудников некуда.</p>}
          {team?.store && <div className="settings-team"><StoreTeam variant="settings" data={team} refresh={() => void loadTeam()} currentUserId={session?.user?.id} /></div>}
        </div>;

      default:
        return null;
    }
  };

  /* The team tab saves through its own forms, so the shared save bar does not belong there. */
  const visibleTabs = storeRole ? tabs : tabs.filter(tab => tab.id !== TEAM_TAB);
  const hasSaveBar = activeTab !== TEAM_TAB;

  return (
    <div className="inventory-page mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5">
      {/* Page title */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="work-page-title">Настройки</h1>
        <p className="mt-1 text-[13px] font-medium leading-5 text-dash-muted">Управление аккаунтом и настройками</p>
      </motion.header>

      {/* One tab strip: icons in a row, an underline under the active tab */}
      <div>
        <div role="tablist" aria-label="Разделы настроек" className="flex w-full gap-1">
          {visibleTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="settings-panel"
                id={`settings-tab-${tab.id}`}
                disabled={isSaving}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[12px] font-semibold leading-4 transition-colors sm:min-h-12 sm:flex-row sm:gap-2 sm:text-sm",
                  active ? "text-dash-accent" : "text-dash-muted hover:text-dash-ink",
                )}
              >
                <tab.icon className="size-4 shrink-0" aria-hidden="true" />
                <span>{tab.label}{isLoaded && tabDirty(tab.id) && <span aria-label="Есть несохранённые изменения"> *</span>}</span>
                {active && (
                  <motion.span
                    layoutId="settings-tab-underline"
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

      {/* Tab content */}
      <div
        role="tabpanel"
        id="settings-panel"
        aria-labelledby={`settings-tab-${activeTab}`}
        className="rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <fieldset disabled={isSaving || !isLoaded} className="min-w-0">
              {renderContent()}
            </fieldset>
          </motion.div>
        </AnimatePresence>

        {/* Save button */}
        {hasSaveBar && <div className="mt-5 border-t border-dash-line pt-5">
          <p className="mb-3 text-[13px] leading-5 text-dash-muted">Сохраняются только изменённые поля этой вкладки. * — есть несохранённые изменения.</p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isLoaded || !tabDirty(activeTab)}
            className="primary-action gap-2 text-[15px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Сохранение…
              </>
            ) : (
              "Сохранить эту вкладку"
            )}
          </button>
        </div>}
      </div>
    </div>
  );
};

export default SettingsPage;
