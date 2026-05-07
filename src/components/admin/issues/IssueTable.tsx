import { SystemLog } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface IssueTableProps {
  logs: SystemLog[];
}

export default function IssueTable({ logs }: IssueTableProps) {
  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "warn":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "info":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>Level</TableHead>
          <TableHead>Message</TableHead>
          <TableHead>Meta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
              No logs found
            </TableCell>
          </TableRow>
        ) : (
          logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
              <TableCell>
                <Badge className={getLevelColor(log.level)}>{log.level}</Badge>
              </TableCell>
              <TableCell>{log.message}</TableCell>
              <TableCell className="font-mono text-xs">
                {log.meta ? JSON.stringify(log.meta) : "-"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
