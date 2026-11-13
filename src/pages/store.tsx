import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Inspection from "@/components/store/Inspection";
import StoreTeam from "@/components/store/StoreTeam";

const TABS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "walk", label: "Обход" },
  { id: "team", label: "Команда" },
];

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
  return <div className="inventory-page mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="work-page-title">{team?.store ? `Отдел · ${team.store.name}` : "Отдел"}</h1>
      <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-dash-accent hover:text-dash-accent/80" href="/settings">Подключить Telegram</Link>
    </header>
    {team?.store && <div role="group" aria-label="Разделы отдела" className="flex w-full gap-1 rounded-[10px] border border-dash-line bg-dash-surface p-[3px] sm:w-fit">
      {TABS.map(item => <button
        key={item.id}
        type="button"
        aria-pressed={tab === item.id}
        onClick={() => setTab(item.id)}
        className={cn(
          "inline-flex min-h-11 flex-1 items-center justify-center rounded-[7px] px-4 text-sm font-semibold transition-colors sm:flex-none",
          tab === item.id ? "bg-dash-accent text-white" : "text-dash-ink-2 hover:text-dash-ink",
        )}
      >{item.label}</button>)}
    </div>}
    {team?.isAdmin && team?.store && <p className="rounded-xl border border-expiry-border bg-expiry-soft px-4 py-3 text-[13px] leading-5 font-semibold text-expiry-ink">Вы вошли в отдел как поддержка: ваши действия записываются в журнал. Выход — в разделе «Отделы» админ-панели.</p>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dash-expired bg-dash-expired-soft px-4 py-3">
      <p className="text-[13px] leading-5 font-semibold text-dash-expired">{error}</p>
      <Button variant="outline" className="min-h-11" onClick={() => void load()}>Повторить</Button>
    </div>}
    {!team && !error && <p role="status" className="rounded-xl border border-dash-line bg-dash-panel px-4 py-5 text-sm text-dash-ink-2">Загружаем отдел…</p>}
    {team && !team.store && (team.isAdmin
      ? <div className="space-y-3 rounded-xl border border-dash-line bg-dash-panel p-5">
        <p className="text-sm leading-5 text-dash-ink">Администратор сервиса не состоит в отделах и не видит их таблицы. Отделы, руководители и временный доступ — в админ-панели.</p>
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-dash-accent" href="/admin#departments">Открыть раздел «Отделы»</Link>
      </div>
      : <p className="rounded-xl border border-dash-line bg-dash-panel p-5 text-sm leading-5 text-dash-ink">Вы пока не входите в отдел. Руководитель отдела создаёт сотрудникам учётные записи сам — обратитесь к нему.</p>)}
    {tab === "walk" && list && <Inspection data={list} refresh={() => void load()} />}
    {tab === "team" && team?.store && session?.user && <StoreTeam key={team.store.id} data={team} refresh={() => void load()} currentUserId={session.user.id} />}
  </div>;
}
