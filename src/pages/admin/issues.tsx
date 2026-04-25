import { useEffect, useState } from "react";
import { SystemLog } from "@prisma/client";
import IssueTable from "@/components/admin/issues/IssueTable";
import { Heading } from "@adobe/react-spectrum";

export default function IssueLogPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);

  useEffect(() => {
    fetch("/api/admin/issues")
      .then((res) => res.json())
      .then((data) => setLogs(data));
  }, []);

  return (
    <div>
      <Heading level={1}>Issue Log</Heading>
      <div style={{ marginTop: "2rem" }}>
        <IssueTable logs={logs} />
      </div>
    </div>
  );
}
