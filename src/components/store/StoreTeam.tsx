import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifySettingsChanged } from "@/lib/inventory-settings";

export default function StoreTeam({ data, refresh }: { data: any; refresh: () => void }) {
  const [email, setEmail] = useState("");
  const [urgent, setUrgent] = useState(String(data.store.urgentThreshold));
  const [warning, setWarning] = useState(String(data.store.warningThreshold));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const manager = data.role === "MANAGER";
  const request = async (url: string, method: string, body: object) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setEmail(""); setMessage("Сохранено."); notifySettingsChanged(); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); }
    finally { setBusy(false); }
  };
  return <section className="work-surface space-y-5 p-4 sm:p-6">
    <h2 className="text-lg font-semibold">Команда · {data.store.name}</h2>
    <ul className="divide-y">{data.members.map((member: any) => <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0 break-all"><p className="font-medium">{member.user.name ?? "Сотрудник"}</p><p className="text-sm text-muted-foreground">{member.user.email} · {member.role === "MANAGER" ? "Руководитель" : "Сотрудник"}</p></div>
      {manager && member.role !== "MANAGER" && <Button variant="outline" disabled={busy} onClick={() => {
        if (window.confirm(`Отозвать доступ к магазину у ${member.user.name ?? member.user.email}? Общие товары сохранятся.`)) void request("/api/store/members", "DELETE", { userId: member.userId });
      }}>Отозвать доступ</Button>}
    </li>)}</ul>
    {manager && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void request("/api/store/members", "POST", { email }); }}>
      <label className="block space-y-1"><span>Email существующего аккаунта</span><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <p className="text-sm text-muted-foreground">Для аккаунта с личными товарами администратор сначала выполняет перенос.</p>
      <Button disabled={busy}>Добавить сотрудника</Button>
    </form>}
    <form className="space-y-3 border-t pt-5" onSubmit={e => { e.preventDefault(); void request("/api/store/settings", "POST", { urgentThreshold: Number(urgent), warningThreshold: Number(warning) }); }}>
      <h3 className="font-semibold">Общие пороги контроля</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span>Срочно, дней</span><Input type="number" min="0" required disabled={!manager} value={urgent} onChange={e => setUrgent(e.target.value)} /></label>
        <label className="space-y-1"><span>Внимание, дней</span><Input type="number" min={Number(urgent) || 0} required disabled={!manager} value={warning} onChange={e => setWarning(e.target.value)} /></label>
      </div>
      {manager ? <Button disabled={busy}>Сохранить пороги</Button> : <p className="text-sm text-muted-foreground">Пороги меняет руководитель магазина.</p>}
    </form>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
  </section>;
}
