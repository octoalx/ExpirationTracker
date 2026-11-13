import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notifySettingsChanged } from "@/lib/inventory-settings";

const MIN_PASSWORD = 8;

/**
 * The department team. Hiring, password resets and revocations belong to the
 * manager; every member works the same table, so the team list is read-only here
 * for employees.
 * `variant="settings"` is the same panel inside the settings card: the layout and
 * the heading come from the page, the department name becomes editable, and the
 * thresholds are saved through the department endpoint instead of being posted as
 * personal settings.
 */
export default function StoreTeam({ data, refresh, currentUserId, variant = "page" }:
  { data: any; refresh: () => void; currentUserId?: string; variant?: "page" | "settings" }) {
  const [draft, setDraft] = useState({ name: "", email: "", password: "" });
  const [urgent, setUrgent] = useState(String(data.store.urgentThreshold));
  const [warning, setWarning] = useState(String(data.store.warningThreshold));
  const [name, setName] = useState<string>(data.store.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [resetValue, setResetValue] = useState("");
  const [resetError, setResetError] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<any>(null);
  const manager = data.role === "MANAGER";
  const inSettings = variant === "settings";

  const request = async (url: string, method: string, body: object, success = "Сохранено.") => {
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setMessage(success); notifySettingsChanged(); refresh();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); return false; }
    finally { setBusy(false); }
  };

  const openReset = (member: any) => { setResetError(""); setResetValue(""); setResetTarget(member); };

  /** The password comes from the manager in the application dialog, never a native one. */
  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetTarget) return;
    if (resetValue.length < MIN_PASSWORD) { setResetError(`Пароль должен быть не короче ${MIN_PASSWORD} символов.`); return; }
    const saved = await request(`/api/store/members/${resetTarget.userId}/password`, "POST", { password: resetValue }, "Пароль изменён. Передайте сотруднику новый пароль.");
    if (saved) { setResetTarget(null); setResetValue(""); }
  };

  const submitRevoke = async () => {
    if (!revokeTarget) return;
    const saved = await request("/api/store/members", "DELETE", { userId: revokeTarget.userId }, "Доступ отозван.");
    if (saved) setRevokeTarget(null);
  };

  return <section className={inSettings ? "space-y-5" : "space-y-5 rounded-xl border border-dash-line bg-dash-panel p-4 sm:p-6"}>
    {inSettings
      ? <div>
        <h2 className="text-lg font-bold text-foreground">Команда · {data.store.name}</h2>
        <p className="text-sm text-muted-foreground">Сотрудники отдела, их доступ и общие пороги</p>
        <p className="mt-2 text-sm text-muted-foreground">{manager
          ? "Здесь вы добавляете сотрудников: каждый получает свой email-логин и пароль."
          : "Учётные записи сотрудников создаёт и отзывает руководитель отдела. Список ниже — только для просмотра."}</p>
      </div>
      : <h2 className="text-base font-extrabold leading-5 text-dash-ink">Команда · {data.store.name}</h2>}
    {!inSettings && <p className="text-[13px] font-medium leading-5 text-dash-muted">Таблица у отдела одна, её ведут все сотрудники. Учётные записи сотрудников создаёт и отзывает руководитель.</p>}
    {manager && inSettings && <form className="flex flex-wrap items-end gap-2 rounded-xl border p-3" onSubmit={async e => {
      e.preventDefault();
      const title = name.trim();
      if (!title || title === data.store.name) return;
      if (await request("/api/store/members", "PUT", { name: title }, "Название отдела сохранено.")) setName(title);
    }}>
      <label className="min-w-48 flex-1 space-y-1"><span className="text-sm font-semibold text-muted-foreground">Название отдела</span>
        <Input required maxLength={100} value={name} onChange={e => setName(e.target.value)} />
      </label>
      <Button variant="outline" disabled={busy || !name.trim() || name.trim() === data.store.name}>Переименовать отдел</Button>
    </form>}
    <ul className="divide-y divide-dash-line">{data.members.map((member: any) => <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0 break-all">
        <p className="text-[15px] font-bold leading-5 text-dash-ink">{member.user.name ?? "Сотрудник"}{member.userId === currentUserId ? " · это вы" : ""}</p>
        <p className="text-[13px] leading-5 text-dash-muted">{member.user.email} · {member.role === "MANAGER" ? "Руководитель отдела" : "Сотрудник"}</p>
      </div>
      {manager && member.role !== "MANAGER" && <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => openReset(member)}>Сбросить пароль</Button>
        <Button variant="outline" disabled={busy} onClick={() => setRevokeTarget(member)}>Отозвать доступ</Button>
      </div>}
    </li>)}</ul>
    {manager && <form className="space-y-3 border-t border-dash-line pt-5" onSubmit={async e => {
      e.preventDefault();
      if (await request("/api/store/members", "POST", draft, "Сотрудник создан. Передайте ему email и пароль.")) setDraft({ name: "", email: "", password: "" });
    }}>
      <h3 className="text-base font-extrabold leading-5 text-dash-ink">Новый сотрудник</h3>
      <label className="block space-y-1"><span>Имя</span><Input required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label className="block space-y-1"><span>Email (логин)</span><Input type="email" required value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label>
      <label className="block space-y-1"><span>Пароль</span><Input type="text" required minLength={MIN_PASSWORD} value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} /></label>
      <p className="text-[13px] leading-5 text-dash-muted">Пароль показывается один раз — передайте его сотруднику лично. Сменить пароль сотрудник может сам в настройках.</p>
      <Button disabled={busy}>Создать сотрудника</Button>
    </form>}
    <form className="space-y-3 border-t border-dash-line pt-5" onSubmit={e => { e.preventDefault(); void request("/api/store/settings", "POST", { urgentThreshold: Number(urgent), warningThreshold: Number(warning) }, "Пороги сохранены."); }}>
      <h3 className="text-base font-extrabold leading-5 text-dash-ink">Общие пороги контроля</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span>Срочно, дней</span><Input type="number" min="0" required disabled={!manager} value={urgent} onChange={e => setUrgent(e.target.value)} /></label>
        <label className="space-y-1"><span>Внимание, дней</span><Input type="number" min={Number(urgent) || 0} required disabled={!manager} value={warning} onChange={e => setWarning(e.target.value)} /></label>
      </div>
      {manager ? <Button disabled={busy}>Сохранить пороги</Button> : <p className="text-[13px] leading-5 text-dash-muted">Пороги меняет руководитель отдела.</p>}
    </form>
    {message && <p role="status" className="rounded-[10px] border border-dash-line bg-dash-surface px-3 py-2 text-[13px] font-semibold leading-5 text-dash-ink-2">{message}</p>}
    {error && <p role="alert" className="rounded-[10px] border border-dash-expired bg-dash-expired-soft px-3 py-2 text-[13px] font-semibold leading-5 text-dash-expired">{error}</p>}
    <Dialog open={!!resetTarget} onOpenChange={open => { if (!open) setResetTarget(null); }}>
      <DialogContent className="work-panel product-dialog product-entry sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Новый пароль для {resetTarget ? resetTarget.user.name ?? resetTarget.user.email : ""} (не менее {MIN_PASSWORD} символов)</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submitReset}>
          <label className="block">
            <span className="entry-label">Пароль</span>
            <input
              type="text"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              value={resetValue}
              onChange={event => setResetValue(event.target.value)}
            />
          </label>
          {resetError && <p className="field-error" role="alert">{resetError}</p>}
          <div className="product-dialog-actions">
            <button type="button" className="dialog-action-secondary" onClick={() => setResetTarget(null)}>Отмена</button>
            <button type="submit" className="primary-action dialog-action-primary" disabled={busy}>Сбросить пароль</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={!!revokeTarget} onOpenChange={open => { if (!open) setRevokeTarget(null); }}>
      <DialogContent className="work-panel product-dialog product-entry sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Отозвать доступ у {revokeTarget ? revokeTarget.user.name ?? revokeTarget.user.email : ""}?</DialogTitle>
          <DialogDescription className="text-[13px] leading-5 font-medium text-dash-ink-2">Товары отдела сохранятся, авторство записей будет снято.</DialogDescription>
        </DialogHeader>
        <div className="product-dialog-actions">
          <button type="button" className="dialog-action-secondary" onClick={() => setRevokeTarget(null)}>Отмена</button>
          <button type="button" className="primary-action dialog-action-primary" disabled={busy} onClick={() => void submitRevoke()}>Отозвать доступ</button>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}
