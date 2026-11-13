import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Shield, User, Trash2, ChevronLeft, ChevronRight,
  Loader2, Search, Key, Eye, EyeOff, UserPlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { roleLabel } from "@/lib/admin-labels";
import ConfirmAction from "@/components/admin/ConfirmAction";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UserWithStats {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  /** null when the account belongs to no department: it sees no product table. */
  membership?: { role: string; store: { id: string; name: string } } | null;
  _count?: {
    products: number;
  };
}

/** The dashboard field look: control border, a 44 px target, the same focus ring. */
const FIELD =
  "w-full min-w-0 min-h-11 rounded-[10px] border border-dash-control bg-white px-3 py-2 text-[15px] leading-5 text-dash-ink transition-colors placeholder:text-dash-muted focus-visible:border-dash-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/35 disabled:cursor-not-allowed disabled:border-dash-line disabled:bg-dash-surface disabled:text-dash-ink-2";

const ICON_ACTION =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] text-dash-ink-2 transition-colors hover:bg-dash-surface hover:text-dash-ink disabled:opacity-55";

/** The role as a person reads it; the database keeps USER/ADMIN. */
function RolePill({ role }: { role: string }) {
  const admin = role === "ADMIN";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold leading-4",
      admin ? "bg-dash-soft text-dash-accent" : "bg-dash-surface text-dash-ink-2",
    )}>
      {admin ? <Shield className="size-3" aria-hidden="true" /> : <User className="size-3" aria-hidden="true" />}
      {roleLabel(role)}
    </span>
  );
}

/** Admin tab for account creation, search, role changes, deletion and password reset. */
export default function UsersTab() {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "", password: "", role: "USER" });

  // Password reset dialog state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Deletion is confirmed in the app dialog instead of the browser's confirm.
  const [deleteTarget, setDeleteTarget] = useState<UserWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("User list request failed");
      const data = await res.json();
      const usersArray = Array.isArray(data) ? data : data.users || [];
      setUsers(usersArray);
      setTotalPages(Math.ceil(usersArray.length / limit));
    } catch {
      toast.error("Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.message || "Не удалось создать учётную запись");
        return;
      }
      setDraft({ name: "", email: "", password: "", role: "USER" });
      setCreateOpen(false);
      setSearchTerm("");
      setPage(1);
      toast.success("Учётная запись создана");
      await fetchUsers();
    } catch {
      setCreateError("Ошибка сети. Проверьте список пользователей перед повторной попыткой.");
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        toast.success(`Роль изменена: ${roleLabel(newRole)}`);
        fetchUsers();
      } else {
        toast.error("Ошибка изменения роли");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Пользователь удалён");
        setDeleteTarget(null);
        fetchUsers();
      } else {
        toast.error("Ошибка удаления");
      }
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setDeleting(false);
    }
  };

  const openResetModal = (user: UserWithStats) => {
    setSelectedUser(user);
    setNewPassword("");
    setShowPassword(false);
    setResetModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error("Пароль должен быть минимум 6 символов");
      return;
    }

    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      if (res.ok) {
        toast.success(`Пароль для ${selectedUser.name || selectedUser.email} изменён`);
        setResetModalOpen(false);
        setSelectedUser(null);
        setNewPassword("");
      } else {
        const data = await res.json();
        toast.error(data.message || "Ошибка сброса пароля");
      }
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setResetting(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedUsers = filteredUsers.slice((page - 1) * limit, page * limit);
  const totalPagesShown = Math.max(1, Math.ceil(filteredUsers.length / limit));

  if (loading) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 rounded-xl border border-dash-line bg-dash-panel py-10 text-[13px] leading-5 text-dash-muted">
        <Loader2 className="size-4 animate-spin text-dash-accent" aria-hidden="true" />
        Загружаем пользователей…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={createOpen}
          aria-controls="create-account-form"
          disabled={creating}
          onClick={() => { setCreateOpen(!createOpen); setCreateError(""); setDraft({ name: "", email: "", password: "", role: "USER" }); }}
          className="dialog-action-secondary gap-2"
        >
          <UserPlus className="size-4" aria-hidden="true" />
          {createOpen ? "Закрыть форму" : "Создать учётную запись"}
        </button>
      </div>

      {createOpen && (
        <form id="create-account-form" onSubmit={handleCreate} className="space-y-4 rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5">
          <h2 className="text-[15px] font-extrabold leading-5 text-dash-ink">Новая учётная запись</h2>
          <fieldset disabled={creating} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">Имя</span>
              <input className={FIELD} name="name" autoComplete="off" required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="min-w-0">
              <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">Email</span>
              <input className={FIELD} name="email" type="email" autoComplete="off" required maxLength={254} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />
            </label>
            <label className="min-w-0">
              <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">Пароль</span>
              <input className={FIELD} name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} aria-describedby="account-password-hint" value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} />
              <span id="account-password-hint" className="mt-1.5 block text-[13px] leading-5 text-dash-muted">Минимум 8 символов; максимум 72 латинских символа или 36 кириллических.</span>
            </label>
            <label className="min-w-0">
              <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">Роль</span>
              <select className={FIELD} name="role" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })}>
                <option value="USER">Сотрудник</option><option value="ADMIN">Администратор</option>
              </select>
            </label>
          </fieldset>
          {createError && <p role="alert" className="field-error">{createError}</p>}
          <button type="submit" disabled={creating} className="primary-action gap-2 text-[15px]">
            {creating && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {creating ? "Создание…" : "Создать"}
          </button>
        </form>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dash-muted" aria-hidden="true" />
        <input
          aria-label="Поиск пользователей"
          placeholder="Поиск по имени или email..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className={cn(FIELD, "pl-9")}
        />
      </div>

      {/* Phone: cards keep the account readable without a table */}
      <div className="space-y-3 md:hidden">
        {paginatedUsers.length === 0 && <p role="status" className="rounded-xl border border-dash-line bg-dash-panel p-4 text-sm leading-5 text-dash-ink-2">Пользователей не найдено</p>}
        {paginatedUsers.map(user => (
          <article key={user.id} className="rounded-xl border border-dash-line bg-dash-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-[15px] font-bold leading-5 text-dash-ink">{user.name || "Без имени"}</h2>
                <p className="mt-1 break-all text-[13px] leading-5 text-dash-ink-2">{user.email || "Email не указан"}</p>
                <p className="mt-1 text-[13px] leading-5 text-dash-ink-2">{user.membership ? `Отдел «${user.membership.store.name}» · ${user.membership.role === "MANAGER" ? "руководитель" : "сотрудник"}` : "Без отдела — таблиц не видит"}</p>
              </div>
              <RolePill role={user.role} />
            </div>
            <details className="mt-3 border-t border-dash-line pt-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-dash-accent">Управление доступом</summary>
              <div className="mt-1 flex flex-col gap-2">
                <button type="button" className="dialog-action-secondary" onClick={() => handleRoleChange(user.id, user.role === "ADMIN" ? "USER" : "ADMIN")}>
                  {user.role === "ADMIN" ? "Снять права администратора" : "Назначить администратором"}
                </button>
                <button type="button" className="dialog-action-secondary gap-2" onClick={() => openResetModal(user)}>
                  <Key className="size-4" aria-hidden="true" />Сбросить пароль
                </button>
                <button type="button" className="dialog-action-danger gap-2" onClick={() => setDeleteTarget(user)}>
                  <Trash2 className="size-4" aria-hidden="true" />Удалить пользователя
                </button>
              </div>
            </details>
          </article>
        ))}
      </div>

      {/* Desktop: the accounts table */}
      <div className="hidden overflow-hidden rounded-xl border border-dash-line bg-dash-panel md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-dash-line bg-dash-surface">
                <th className="px-4 py-2.5 text-left text-[12px] font-bold leading-4 text-dash-muted">Пользователь</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-bold leading-4 text-dash-muted">Email</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-bold leading-4 text-dash-muted">Отдел</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-bold leading-4 text-dash-muted">Роль</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-bold leading-4 text-dash-muted">Действия</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-dash-muted">
                    <Users className="mx-auto mb-3 size-10 opacity-40" aria-hidden="true" />
                    <p>Пользователей не найдено</p>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-dash-line transition-colors last:border-0 hover:bg-dash-surface"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-dash-soft text-dash-accent">
                          <User className="size-4" aria-hidden="true" />
                        </span>
                        <span className="font-semibold text-dash-ink">{user.name || "Без имени"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-dash-ink-2">{user.email || "—"}</td>
                    <td className="px-4 py-3 text-dash-ink-2">{user.membership ? `${user.membership.store.name} · ${user.membership.role === "MANAGER" ? "руководитель" : "сотрудник"}` : "без отдела"}</td>
                    <td className="px-4 py-3"><RolePill role={user.role} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleRoleChange(user.id, user.role === "ADMIN" ? "USER" : "ADMIN")}
                          className="inline-flex min-h-11 items-center rounded-[10px] px-2.5 text-[13px] font-semibold text-dash-accent transition-colors hover:bg-dash-soft"
                        >
                          {user.role === "ADMIN" ? "Снять права администратора" : "Назначить администратором"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openResetModal(user)}
                          className={cn(ICON_ACTION, "text-dash-accent hover:bg-dash-soft hover:text-dash-accent")}
                          title="Сбросить пароль" aria-label={`Сбросить пароль ${user.name || user.email || "пользователя"}`}
                        >
                          <Key className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(user)}
                          aria-label={`Удалить ${user.name || user.email || "пользователя"}`}
                          className={cn(ICON_ACTION, "text-dash-expired hover:bg-dash-expired-soft hover:text-dash-expired")}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 border-t border-dash-line px-4 py-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Предыдущая страница"
              className={ICON_ACTION}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <span className="px-3 text-[13px] leading-5 tabular-nums text-dash-ink-2">
              {page} / {totalPagesShown}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPagesShown, p + 1))}
              disabled={page >= totalPagesShown}
              aria-label="Следующая страница"
              className={ICON_ACTION}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-5 text-dash-muted">
        <span className="inline-flex items-center gap-1">
          <Users className="size-4" aria-hidden="true" />
          Всего: {filteredUsers.length}
        </span>
        <span className="inline-flex items-center gap-1">
          <Shield className="size-4 text-dash-accent" aria-hidden="true" />
          Администраторов: {users.filter((u) => u.role === "ADMIN").length}
        </span>
      </div>

      {/* Password reset */}
      <Dialog open={resetModalOpen && !!selectedUser} onOpenChange={(open) => { if (!open) setResetModalOpen(false); }}>
        <DialogContent className="work-panel product-dialog product-entry sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Сброс пароля</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] leading-5 text-dash-ink-2">
            Пользователь: <span className="font-semibold text-dash-ink">{selectedUser?.name || selectedUser?.email}</span>
          </p>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Новый пароль (мин. 6 символов)"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-label="Новый пароль"
              className={cn("pr-12")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-[10px] text-dash-muted transition-colors hover:text-dash-ink"
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          </div>
          <div className="product-dialog-actions">
            <button type="button" className="dialog-action-secondary" onClick={() => setResetModalOpen(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="primary-action dialog-action-primary gap-2 text-[15px]"
              onClick={handleResetPassword}
              disabled={resetting || newPassword.length < 6}
            >
              {resetting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Key className="size-4" aria-hidden="true" />}
              {resetting ? "Сохранение..." : "Сбросить пароль"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmAction
        open={!!deleteTarget}
        title={`Удалить пользователя ${deleteTarget?.name || deleteTarget?.email || ""}?`}
        description="Все товары будут удалены. Действие необратимо."
        confirmLabel="Удалить пользователя"
        busy={deleting}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
