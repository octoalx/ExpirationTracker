import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import ConfirmAction from "@/components/admin/ConfirmAction";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Account = { userId?: string; id?: string; name: string | null; email: string | null; role?: string; isAdmin?: boolean };
type Department = {
  id: string; name: string; urgentThreshold: number; warningThreshold: number;
  memberCount: number; members: (Account & { userId: string; role: string })[];
  manager: (Account & { userId: string; role: string }) | null;
};

/** The dashboard field look: control border, a 44 px target, the same focus ring. */
const FIELD =
  "w-full min-w-0 min-h-11 rounded-[10px] border border-dash-control bg-white px-3 py-2 text-[15px] leading-5 text-dash-ink transition-colors placeholder:text-dash-muted focus-visible:border-dash-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/35 disabled:cursor-not-allowed disabled:border-dash-line disabled:bg-dash-surface disabled:text-dash-ink-2";

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

  // Renaming and deletion ask in an app dialog, not in a browser prompt.
  const [renameTarget, setRenameTarget] = useState<Department | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleteValue, setDeleteValue] = useState("");

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

  const openRename = (department: Department) => {
    setRenameTarget(department);
    setRenameValue(department.name);
  };

  const submitRename = async () => {
    const name = renameValue.trim();
    if (!renameTarget || !name || name === renameTarget.name) { setRenameTarget(null); return; }
    if (await send({ operation: "rename", storeId: renameTarget.id, name }, "Название изменено.")) setRenameTarget(null);
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    if (await send({ operation: "delete", storeId: deleteTarget.id, confirm: deleteValue.trim() }, "Отдел удалён.")) {
      setDeleteTarget(null);
      setDeleteValue("");
    }
  };

  return <div className="space-y-4">
    {visiting && <div className="space-y-3 rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5">
      <p role="status" className="text-sm leading-5 text-dash-ink">Открыт доступ в отдел «{visiting.name}». Ваши действия в его таблице записываются в журнал.</p>
      <button type="button" className="dialog-action-secondary" disabled={busy} onClick={() => void send({ operation: "supportEnd" }, "Доступ в отдел закрыт.")}>Выйти из отдела</button>
    </div>}

    <form className="space-y-4 rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5" onSubmit={async e => {
      e.preventDefault();
      if (await send({ operation: "create", ...draft }, "Отдел создан.")) setDraft({ name: "", managerEmail: "" });
    }}>
      <h2 className="text-[15px] font-extrabold leading-5 text-dash-ink">Новый отдел</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">Название отдела</span>
          <input className={FIELD} required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">Email руководителя (необязательно)</span>
          <input className={FIELD} type="email" value={draft.managerEmail} onChange={e => setDraft({ ...draft, managerEmail: e.target.value })} />
        </label>
      </div>
      <p className="text-[13px] leading-5 text-dash-muted">Сотрудников создаёт руководитель отдела. Здесь назначается только руководитель.</p>
      <button type="submit" disabled={busy} className="primary-action gap-2 text-[15px]">
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Создать отдел
      </button>
    </form>

    {!departments.length && <p role="status" className="rounded-xl border border-dash-line bg-dash-panel p-4 text-sm leading-5 text-dash-ink-2">Отделов пока нет. Первый появляется при регистрации, либо создайте его здесь.</p>}

    {departments.map(department => <section key={department.id} className="space-y-4 rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 break-words text-[15px] font-extrabold leading-5 text-dash-ink">
            <Building2 className="size-4 shrink-0 text-dash-accent" aria-hidden="true" />
            {department.name}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-dash-muted">Сотрудников: {department.memberCount} · пороги: срочно {department.urgentThreshold} дн., внимание {department.warningThreshold} дн.</p>
          <p className="text-[13px] leading-5 text-dash-ink-2">Руководитель: {department.manager ? `${department.manager.name ?? department.manager.email}` : "не назначен"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="dialog-action-secondary" disabled={busy || !!visiting} onClick={() => void send({ operation: "support", storeId: department.id }, `Доступ в отдел «${department.name}» открыт.`)}>Войти в отдел</button>
          <button type="button" className="dialog-action-secondary" disabled={busy} onClick={() => openRename(department)}>Переименовать</button>
          <button type="button" className="dialog-action-danger" disabled={busy} onClick={() => { setDeleteTarget(department); setDeleteValue(""); }}>Удалить</button>
        </div>
      </div>

      <ul className="divide-y divide-dash-line border-t border-dash-line">
        {department.members.map(member => <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px] leading-5">
          <span className="min-w-0 break-all text-dash-ink">{member.name ?? "Сотрудник"} · {member.email}{member.isAdmin ? " · поддержка" : ""}</span>
          <span className="text-dash-muted">{member.role === "MANAGER" ? "Руководитель" : "Сотрудник"}</span>
        </li>)}
      </ul>

      {(() => {
        const candidates = [...department.members.filter(member => !member.isAdmin),
          ...unassigned.map(account => ({ userId: account.id!, name: account.name, email: account.email, role: "USER", isAdmin: false }))];
        if (!candidates.length) return <p className="text-[13px] leading-5 text-dash-muted">Некому передать отдел: сначала нужен хотя бы один аккаунт.</p>;
        return <form className="flex flex-wrap items-end gap-2 border-t border-dash-line pt-4" onSubmit={async e => {
          e.preventDefault();
          const data = new FormData(e.currentTarget as HTMLFormElement);
          const userId = String(data.get("manager") ?? "");
          if (userId) await send({ operation: "appoint", storeId: department.id, userId }, "Руководитель назначен.");
        }}>
          <label className="min-w-48 flex-1">
            <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">Назначить руководителем</span>
            <select name="manager" className={FIELD} defaultValue={department.manager?.userId ?? ""}>
              <option value="">— выберите аккаунт —</option>
              {candidates.map(candidate => <option key={candidate.userId} value={candidate.userId}>{candidate.name ?? candidate.email}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy} className="dialog-action-secondary">Передать отдел</button>
        </form>;
      })()}
    </section>)}

    {!!unassigned.length && <section className="space-y-2 rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5">
      <h2 className="text-[15px] font-extrabold leading-5 text-dash-ink">Аккаунты без отдела</h2>
      <p className="text-[13px] leading-5 text-dash-muted">Эти учётные записи не видят ни одной таблицы. Назначьте их руководителю отдела или добавьте руководителем отдела.</p>
      <ul className="divide-y divide-dash-line border-t border-dash-line">{unassigned.map(account => <li key={account.id} className="py-2.5 text-[13px] leading-5 text-dash-ink">{account.name ?? "Без имени"} · {account.email} · {account.role === "ADMIN" ? "администратор" : "пользователь"}</li>)}</ul>
    </section>}

    {message && <p role="status" className="rounded-[10px] border border-dash-line bg-dash-surface px-3 py-2 text-[13px] font-semibold leading-5 text-dash-ink-2">{message}</p>}
    {error && <p role="alert" className="rounded-[10px] border border-dash-expired bg-dash-expired-soft px-3 py-2 text-[13px] font-semibold leading-5 text-dash-expired">{error}</p>}

    <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
      <DialogContent className="work-panel product-dialog product-entry sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Новое название отдела</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submitRename(); }}>
          <label className="block">
            <span className="entry-label">Название (сейчас «{renameTarget?.name ?? ""}»)</span>
            <input
              required
              maxLength={100}
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
          </label>
          <div className="product-dialog-actions">
            <button type="button" className="dialog-action-secondary" onClick={() => setRenameTarget(null)}>Отмена</button>
            <button type="submit" className="primary-action dialog-action-primary gap-2 text-[15px]" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Сохранить название
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmAction
      open={!!deleteTarget}
      title={`Удалить отдел «${deleteTarget?.name ?? ""}»?`}
      description="Вместе с отделом удаляются его товары. Введите название отдела, чтобы подтвердить."
      confirmLabel="Удалить отдел"
      busy={busy}
      danger
      onCancel={() => setDeleteTarget(null)}
      onConfirm={() => void submitDelete()}
    >
      <label className="block">
        <span className="entry-label">Название отдела</span>
        <input
          value={deleteValue}
          onChange={(event) => setDeleteValue(event.target.value)}
          autoComplete="off"
        />
      </label>
    </ConfirmAction>
  </div>;
}
