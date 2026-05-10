"use client";

import { ColumnDef } from "@tanstack/react-table";
import { SystemLog } from "@prisma/client";

/** Column definitions for the system log data table. */
export const columns: ColumnDef<SystemLog>[] = [
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    cell: ({ row }) => {
      const date = new Date(row.getValue("timestamp"));
      return <span>{date.toLocaleString()}</span>;
    },
  },
  {
    accessorKey: "level",
    header: "Level",
  },
  {
    accessorKey: "message",
    header: "Message",
  },
  {
    accessorKey: "meta",
    header: "Meta",
  },
];
