import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifySettingsChanged } from "@/lib/inventory-settings";

const MIN_PASSWORD = 8;

/**
 * The department team. Hiring, password resets and revocations belong to the
 * manager; every member works the same table, so the team list is read-only here
 * for employees.
 */
export default function StoreTeam({ data, refresh, currentUserId }: { data: any; refresh: () => void; currentUserId?: string }) {
  const [draft, setDraft] = useState({ name: "", email: "", password: "" });
  const [urgent, setUrgent] = useState(String(data.store.urgentThreshold));
  const [warning, setWarning] = useState(String(data.store.warningThreshold));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const manager = data.role === "MANAGER";

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

  const resetPassword = async (member: any) => {
    const password = window.prompt(`Новый пароль для ${member.user.name ?? member.user.email} (не менее ${MIN_PASSWORD} символов):`);
    if (password === null) return;
    if (password.length < MIN_PASSWORD) { setError(`Пароль должен быть не короче ${MIN_PASSWORD} символов.`); return; }
    await request(`/api/store/members/${member.userId}/password`, "POST", { password }, "Пароль изменён. Передайте сотруднику новый пароль.");
  };

  return <section className="work-surface space-y-5 p-4 sm:p-6">
    <h2 className="text-lg font-semibold">Команда · {data.store.name}</h2>
    <p className="text-sm text-muted-foreground">Таблица у отдела одна, её ведут все сотрудники. Учётные записи сотрудников создаёт и отзывает руководитель.</p>
    <ul className="divide-y">{data.members.map((member: any) => <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0 break-all">
        <p className="font-medium">{member.user.name ?? "Сотрудник"}{member.userId === currentUserId ? " · это вы" : ""}</p>
        <p className="text-sm text-muted-foreground">{member.user.email} · {member.role === "MANAGER" ? "Руководитель отдела" : "Сотрудник"}</p>
      </div>
      {manager && member.role !== "MANAGER" && <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void resetPassword(member)}>Сбросить пароль</Button>
        <Button variant="outline" disabled={busy} onClick={() => {
          if (window.confirm(`Отозвать доступ у ${member.user.name ?? member.user.email}? Товары отдела сохранятся, авторство записей будет снято.`)) void request("/api/store/members", "DELETE", { userId: member.userId }, "Доступ отозван.");
        }}>Отозвать доступ</Button>
      </div>}
    </li>)}</ul>
    {manager && <form className="space-y-3 border-t pt-5" onSubmit={async e => {
      e.preventDefault();
      if (await request("/api/store/members", "POST", draft, "Сотрудник создан. Передайте ему email и пароль.")) setDraft({ name: "", email: "", password: "" });
    }}>
      <h3 className="font-semibold">Новый сотрудник</h3>
      <label className="block space-y-1"><span>Имя</span><Input required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label className="block space-y-1"><span>Email (логин)</span><Input type="email" required value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label>
      <label className="block space-y-1"><span>Пароль</span><Input type="text" required minLength={MIN_PASSWORD} value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} /></label>
      <p className="text-sm text-muted-foreground">Пароль показывается один раз — передайте его сотруднику лично. Сменить пароль сотрудник может сам в настройках.</p>
      <Button disabled={busy}>Создать сотрудника</Button>
    </form>}
    <form className="space-y-3 border-t pt-5" onSubmit={e => { e.preventDefault(); void request("/api/store/settings", "POST", { urgentThreshold: Number(urgent), warningThreshold: Number(warning) }, "Пороги сохранены."); }}>
      <h3 className="font-semibold">Общие пороги контроля</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span>Срочно, дней</span><Input type="number" min="0" required disabled={!manager} value={urgent} onChange={e => setUrgent(e.target.value)} /></label>
        <label className="space-y-1"><span>Внимание, дней</span><Input type="number" min={Number(urgent) || 0} required disabled={!manager} value={warning} onChange={e => setWarning(e.target.value)} /></label>
      </div>
      {manager ? <Button disabled={busy}>Сохранить пороги</Button> : <p className="text-sm text-muted-foreground">Пороги меняет руководитель отдела.</p>}
    </form>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
  </section>;
}
