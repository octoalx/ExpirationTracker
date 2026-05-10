import { useEffect, useState } from "react";
import { SystemLog } from "@prisma/client";
import IssueTable from "@/components/admin/issues/IssueTable";

/** Admin page displaying system issue logs. */
export default function IssueLogPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);

  useEffect(() => {
    fetch("/api/admin/issues")
      .then((res) => res.json())
      .then((data) => setLogs(data));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Issue Log</h1>
      <IssueTable logs={logs} />
    </div>
  );
}
