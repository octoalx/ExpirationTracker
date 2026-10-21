import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Account = { userId?: string; id?: string; name: string | null; email: string | null; role?: string; isAdmin?: boolean };
type Department = {
  id: string; name: string; urgentThreshold: number; warningThreshold: number;
  memberCount: number; members: (Account & { userId: string; role: string })[];
  manager: (Account & { userId: string; role: string }) | null;
};

/**
 * Administrator department registry. Departments are the only row container, and
 * their tables stay invisible here: the panel shows people and ownership, never
 * product data.
 */
export default function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [unassigned, setUnassigned] = useState<Account[]>([]);
  const [draft, setDraft] = useState({ name: "", managerEmail: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/departments");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDepartments(data.departments ?? []); setUnassigned(data.unassigned ?? []); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const send = async (body: object, success: string) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/admin/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setMessage(success); await load();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); return false; }
    finally { setBusy(false); }
  };

  const visiting = departments.find(department => department.members.some(member => member.isAdmin));

  return <div className="space-y-5">
    {visiting && <div className="work-surface space-y-3 p-4">
      <p role="status">Открыт доступ в отдел «{visiting.name}». Ваши действия в его таблице записываются в журнал.</p>
      <Button variant="outline" disabled={busy} onClick={() => void send({ operation: "supportEnd" }, "Доступ в отдел закрыт.")}>Выйти из отдела</Button>
    </div>}
    <form className="work-surface space-y-3 p-4 sm:p-6" onSubmit={async e => {
      e.preventDefault();
      if (await send({ operation: "create", ...draft }, "Отдел создан.")) setDraft({ name: "", managerEmail: "" });
    }}>
      <h2 className="font-semibold">Новый отдел</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span>Название отдела</span><Input required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="space-y-1"><span>Email руководителя (необязательно)</span><Input type="email" value={draft.managerEmail} onChange={e => setDraft({ ...draft, managerEmail: e.target.value })} /></label>
      </div>
      <p className="text-sm text-muted-foreground">Сотрудников создаёт руководитель отдела. Здесь назначается только руководитель.</p>
      <Button disabled={busy}>Создать отдел</Button>
    </form>

    {!departments.length && <p role="status" className="work-surface p-5">Отделов пока нет. Первый появляется при регистрации, либо создайте его здесь.</p>}
    {departments.map(department => <section key={department.id} className="work-surface space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold">{department.name}</h2>
          <p className="text-sm text-muted-foreground">Сотрудников: {department.memberCount} · пороги: срочно {department.urgentThreshold} дн., внимание {department.warningThreshold} дн.</p>
          <p className="text-sm">Руководитель: {department.manager ? `${department.manager.name ?? department.manager.email}` : "не назначен"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy || !!visiting} onClick={() => void send({ operation: "support", storeId: department.id }, `Доступ в отдел «${department.name}» открыт.`)}>Войти в отдел</Button>
          <Button variant="outline" disabled={busy} onClick={() => {
            const name = window.prompt(`Новое название отдела (сейчас «${department.name}»):`, department.name);
            if (name && name.trim() && name.trim() !== department.name) void send({ operation: "rename", storeId: department.id, name: name.trim() }, "Название изменено.");
          }}>Переименовать</Button>
          <Button variant="outline" disabled={busy} onClick={() => {
            const confirm = window.prompt(`Удаление отдела «${department.name}» вместе с товарами отдела. Введите название отдела для подтверждения:`);
            if (confirm !== null) void send({ operation: "delete", storeId: department.id, confirm: confirm.trim() }, "Отдел удалён.");
          }}>Удалить</Button>
        </div>
      </div>
      <ul className="divide-y">{department.members.map(member => <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <span className="min-w-0 break-all">{member.name ?? "Сотрудник"} · {member.email}{member.isAdmin ? " · поддержка" : ""}</span>
        <span className="text-muted-foreground">{member.role === "MANAGER" ? "Руководитель" : "Сотрудник"}</span>
      </li>)}</ul>
      {(() => {
        const candidates = [...department.members.filter(member => !member.isAdmin),
          ...unassigned.map(account => ({ userId: account.id!, name: account.name, email: account.email, role: "USER", isAdmin: false }))];
        if (!candidates.length) return <p className="text-sm text-muted-foreground">Некому передать отдел: сначала нужен хотя бы один аккаунт.</p>;
        return <form className="flex flex-wrap items-end gap-2 border-t pt-4" onSubmit={async e => {
          e.preventDefault();
          const data = new FormData(e.currentTarget as HTMLFormElement);
          const userId = String(data.get("manager") ?? "");
          if (userId) await send({ operation: "appoint", storeId: department.id, userId }, "Руководитель назначен.");
        }}>
          <label className="min-w-48 flex-1 space-y-1"><span className="text-sm">Назначить руководителем</span>
            <select name="manager" className="w-full rounded-lg border px-3 py-2" defaultValue={department.manager?.userId ?? ""}>
              <option value="">— выберите аккаунт —</option>
              {candidates.map(candidate => <option key={candidate.userId} value={candidate.userId}>{candidate.name ?? candidate.email}</option>)}
            </select>
          </label>
          <Button variant="outline" disabled={busy}>Передать отдел</Button>
        </form>;
      })()}
    </section>)}

    {!!unassigned.length && <section className="work-surface space-y-2 p-4 sm:p-6">
      <h2 className="font-semibold">Аккаунты без отдела</h2>
      <p className="text-sm text-muted-foreground">Эти учётные записи не видят ни одной таблицы. Назначьте их руководителю отдела или добавьте руководителем отдела.</p>
      <ul className="divide-y">{unassigned.map(account => <li key={account.id} className="py-2 text-sm">{account.name ?? "Без имени"} · {account.email} · {account.role === "ADMIN" ? "администратор" : "пользователь"}</li>)}</ul>
    </section>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
