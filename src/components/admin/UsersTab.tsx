import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Shield, User, Trash2, ChevronLeft, ChevronRight, 
  Loader2, Search, Key, X, Eye, EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface UserWithStats {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  _count?: {
    products: number;
  };
}

/** Admin tab for managing users: search, role changes, deletion, password reset. */
export default function UsersTab() {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  // Password reset dialog state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
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

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        toast.success(`Роль изменена на ${newRole}`);
        fetchUsers();
      } else {
        toast.error("Ошибка изменения роли");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const handleDelete = async (userId: string, userName: string | null) => {
    if (!confirm(`Удалить пользователя ${userName || userId}? Все товары будут удалены!`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Пользователь удален");
        fetchUsers();
      } else {
        toast.error("Ошибка удаления");
      }
    } catch {
      toast.error("Ошибка сети");
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
        toast.success(`Пароль для ${selectedUser.name || selectedUser.email} изменен`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          aria-label="Поиск пользователей"
          placeholder="Поиск по имени или email..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="pl-9"
        />
      </div>

      <div className="space-y-3 md:hidden">
        {paginatedUsers.length === 0 && <p className="work-surface p-5 text-sm text-slate-600">Пользователей не найдено</p>}
        {paginatedUsers.map(user => <article key={user.id} className="work-surface p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-base font-bold">{user.name || "Без имени"}</h2><p className="mt-1 break-all text-sm text-slate-600">{user.email || "Email не указан"}</p></div><span className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-semibold", user.role === "ADMIN" ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-700")}>{user.role === "ADMIN" ? "Админ" : "Сотрудник"}</span></div>
          <details className="mt-3 border-t border-slate-200 pt-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-blue-700">Управление доступом</summary><div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => handleRoleChange(user.id, user.role === "ADMIN" ? "USER" : "ADMIN")}>{user.role === "ADMIN" ? "Снять права администратора" : "Назначить администратором"}</Button>
            <Button variant="outline" onClick={() => openResetModal(user)}><Key className="size-4" />Сбросить пароль</Button>
            <Button variant="outline" className="text-red-700" onClick={() => handleDelete(user.id, user.name)}><Trash2 className="size-4" />Удалить пользователя</Button>
          </div></details>
        </article>)}
      </div>
      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Пользователь</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Email</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Роль</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>Пользователей не найдено</p>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-1.5">
                        <User className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <span className="font-medium">{user.name || "Без имени"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{user.email || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        user.role === "ADMIN"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                      )}
                    >
                      {user.role === "ADMIN" ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRoleChange(user.id, user.role === "ADMIN" ? "USER" : "ADMIN")}
                        className={cn(
                          "text-xs",
                          user.role === "ADMIN"
                            ? "text-slate-600 hover:text-slate-900"
                            : "text-blue-600 hover:text-blue-900"
                        )}
                      >
                        {user.role === "ADMIN" ? "Сделать USER" : "Сделать ADMIN"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openResetModal(user)}
                        className="text-amber-600 hover:text-amber-900"
                        title="Сбросить пароль" aria-label={`Сбросить пароль ${user.name || user.email || "пользователя"}`}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(user.id, user.name)}
                        aria-label={`Удалить ${user.name || user.email || "пользователя"}`}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="min-h-11 min-w-11 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-400 px-3">
              {page} / {Math.max(1, Math.ceil(filteredUsers.length / limit))}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(Math.ceil(filteredUsers.length / limit), p + 1))}
              disabled={page >= Math.ceil(filteredUsers.length / limit)}
              className="min-h-11 min-w-11 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4" />
          <span>Всего: {filteredUsers.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="h-4 w-4 text-blue-600" />
          <span>Admin: {users.filter((u) => u.role === "ADMIN").length}</span>
        </div>
      </div>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {resetModalOpen && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setResetModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Сброс пароля</h3>
                <button
                  onClick={() => setResetModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Пользователь: <span className="font-medium">{selectedUser.name || selectedUser.email}</span>
              </p>

              <div className="relative mb-4">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Новый пароль (мин. 6 символов)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setResetModalOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleResetPassword}
                  disabled={resetting || newPassword.length < 6}
                >
                  {resetting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Key className="h-4 w-4 mr-2" />
                  )}
                  {resetting ? "Сохранение..." : "Сбросить пароль"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
