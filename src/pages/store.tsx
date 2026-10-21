import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Inspection from "@/components/store/Inspection";
import StoreTeam from "@/components/store/StoreTeam";

/**
 * One department screen: the shared table walk and the team.
 * An account without a department — the platform administrator among them — sees
 * no table at all, only the reason and where control lives.
 */
export default function StorePage() {
  const { data: session } = useSession();
  const [team, setTeam] = useState<any>(null);
  const [list, setList] = useState<any>(null);
  const [tab, setTab] = useState("walk");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/store/members");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setTeam(data);
      if (data.store) {
        const response = await fetch("/api/store/worklist");
        const work = await response.json();
        if (!response.ok) throw new Error(work.message);
        setList(work);
      } else setList(null);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => { if (!document.hidden) void load(); }, 10000); return () => clearInterval(timer); }, [load]);
  const manager = team?.role === "MANAGER";
  return <div className="mx-auto max-w-3xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{team?.store ? `Отдел · ${team.store.name}` : "Отдел"}</h1>
      <Link className="text-blue-700 underline" href="/settings">Подключить Telegram</Link>
    </div>
    {team?.store && <div className="flex flex-wrap gap-2">
      <Button variant={tab === "walk" ? "default" : "outline"} onClick={() => setTab("walk")}>Обход</Button>
      <Button variant={tab === "team" ? "default" : "outline"} onClick={() => setTab("team")}>Команда</Button>
    </div>}
    {team?.isAdmin && team?.store && <p className="work-surface p-4 text-sm">Вы вошли в отдел как поддержка: ваши действия записываются в журнал. Выход — в разделе «Отделы» админ-панели.</p>}
    {error && <div role="alert" className="space-y-2"><p className="text-red-700">{error}</p><Button variant="outline" onClick={() => void load()}>Повторить</Button></div>}
    {!team && !error && <p role="status">Загружаем отдел…</p>}
    {team && !team.store && (team.isAdmin
      ? <div className="work-surface space-y-3 p-5"><p>Администратор сервиса не состоит в отделах и не видит их таблицы. Отделы, руководители и временный доступ — в админ-панели.</p><Link className="text-blue-700 underline" href="/admin#departments">Открыть раздел «Отделы»</Link></div>
      : <p className="work-surface p-5">Вы пока не входите в отдел. Руководитель отдела создаёт сотрудникам учётные записи сам — обратитесь к нему.</p>)}
    {tab === "walk" && list && <Inspection data={list} refresh={() => void load()} />}
    {tab === "team" && team?.store && session?.user && <StoreTeam key={team.store.id} data={team} refresh={() => void load()} currentUserId={session.user.id} />}
  </div>;
}
