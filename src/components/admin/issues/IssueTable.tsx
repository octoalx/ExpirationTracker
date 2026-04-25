import {
  Cell,
  Column,
  Row,
  TableView,
  TableHeader,
  TableBody,
} from "@adobe/react-spectrum";
import { SystemLog } from "@prisma/client";

interface IssueTableProps {
  logs: SystemLog[];
}

export default function IssueTable({ logs }: IssueTableProps) {
  return (
    <TableView aria-label="System logs table" flex>
      <TableHeader>
        <Column>Timestamp</Column>
        <Column>Level</Column>
        <Column>Message</Column>
        <Column>Meta</Column>
      </TableHeader>
      <TableBody items={logs}>
        {(item) => (
          <Row>
            <Cell>{new Date(item.timestamp).toLocaleString()}</Cell>
            <Cell>{item.level}</Cell>
            <Cell>{item.message}</Cell>
            <Cell>{JSON.stringify(item.meta)}</Cell>
          </Row>
        )}
      </TableBody>
    </TableView>
  );
}
