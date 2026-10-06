import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Inspection from "@/components/store/Inspection";
import StoreTeam from "@/components/store/StoreTeam";
import StoreTransfer from "@/components/store/StoreTransfer";
import TelegramStatus from "@/components/store/TelegramStatus";

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
  return <div className="mx-auto max-w-3xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Магазин</h1><Link className="text-blue-700 underline" href="/settings">Подключить Telegram</Link></div>
    <div className="flex flex-wrap gap-2"><Button variant={tab === "walk" ? "default" : "outline"} onClick={() => setTab("walk")}>Обход</Button><Button variant={tab === "team" ? "default" : "outline"} onClick={() => setTab("team")}>Команда</Button>
      {session?.user?.role === "ADMIN" && <><Button variant={tab === "transfer" ? "default" : "outline"} onClick={() => setTab("transfer")}>Перенос базы</Button><Button variant={tab === "telegram" ? "default" : "outline"} onClick={() => setTab("telegram")}>Telegram</Button></>}</div>
    {error && <div role="alert" className="space-y-2"><p className="text-red-700">{error}</p><Button variant="outline" onClick={() => void load()}>Повторить</Button></div>}
    {!team && !error && <p role="status">Загружаем магазин…</p>}
    {team && !team.store && !["transfer", "telegram"].includes(tab) && <p className="work-surface p-5">Вы пока не включены в команду. Руководитель может добавить ваш аккаунт; перенос личных товаров выполняет администратор.</p>}
    {tab === "walk" && list && <Inspection data={list} refresh={() => void load()} />}
    {tab === "team" && team?.store && <StoreTeam key={team.store.id} data={team} refresh={() => void load()} />}
    {tab === "transfer" && session?.user?.role === "ADMIN" && <StoreTransfer onTransferred={() => { setTab("walk"); void load(); }} />}
    {tab === "telegram" && session?.user?.role === "ADMIN" && <TelegramStatus />}
  </div>;
}
