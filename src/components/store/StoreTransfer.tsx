import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function StoreTransfer({ onTransferred }: { onTransferred: () => void }) {
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [managerId, setManagerId] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/admin/store").then(async r => { if (!r.ok) throw new Error("Не удалось загрузить аккаунты."); return r.json(); })
      .then(data => { setUsers(data.users); setName(data.store?.name ?? ""); }).catch(e => setError(e.message));
  }, []);
  const submit = async (operation: string) => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/store", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, managerId, userIds, name, digest: preview?.digest }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      if (operation === "preview") setPreview(data);
      else { setPreview(null); onTransferred(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); }
    finally { setBusy(false); }
  };
  return <section className="work-surface space-y-4 p-4 sm:p-6">
    <h2 className="text-lg font-semibold">Перенос в общую базу</h2>
    <p className="text-sm text-muted-foreground">Выберите только аккаунты этого магазина. Совпадающие партии сохранятся отдельными записями.</p>
    <label className="block space-y-1"><span>Название магазина</span><Input value={name} onChange={e => { setName(e.target.value); setPreview(null); }} /></label>
    <label className="block space-y-1"><span>Руководитель</span><select className="min-h-11 w-full rounded-lg border bg-background p-2" value={managerId}
      onChange={e => { setManagerId(e.target.value); setUserIds(prev => [...new Set([...prev, e.target.value])]); setPreview(null); }}>
      <option value="">Выберите аккаунт</option>{users.map(u => <option key={u.id} value={u.id}>{u.name ?? u.email} · {u.email}</option>)}
    </select></label>
    <fieldset className="space-y-1"><legend className="mb-2 font-medium">Аккаунты для переноса</legend>
      {users.map(u => <label key={u.id} className="flex min-h-11 items-center gap-3 break-all">
        <input type="checkbox" checked={userIds.includes(u.id)} disabled={u.id === managerId} onChange={e => {
          setUserIds(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id)); setPreview(null);
        }} /><span>{u.name ?? "Сотрудник"} · {u.email}</span>
      </label>)}
    </fieldset>
    <Button disabled={busy || !managerId || !name.trim()} onClick={() => void submit("preview")}>Проверить перенос</Button>
    {preview && <div className="space-y-3 rounded-lg border p-3" role="status">
      <p>Аккаунтов: {preview.users.length}. Записей: {preview.records}. Без срока: {preview.unknownExpiry}. Возможных совпадений: {preview.possibleDuplicates}.</p>
      <p className="text-sm">Статусы: {Object.entries(preview.statuses).map(([status, count]) => `${status}: ${count}`).join(", ") || "нет записей"}.</p>
      <p className="text-sm">Участники будут видеть общие товары. Остальные аккаунты сохранят личные списки.</p>
      <Button disabled={busy} onClick={() => void submit("confirm")}>Подтвердить перенос выбранных аккаунтов</Button>
    </div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </section>;
}
