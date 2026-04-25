import {
  ActionButton,
  Button,
  ButtonGroup,
  Cell,
  Column,
  Row,
  TableView,
  TableHeader,
  TableBody,
  Menu,
  Item,
  MenuTrigger,
} from "@adobe/react-spectrum";
import { User } from "@prisma/client";

interface UserTableProps {
  users: User[];
  onRoleChange: (userId: string, role: string) => void;
  onDelete: (userId: string) => void;
}

export default function UserTable({
  users,
  onRoleChange,
  onDelete,
}: UserTableProps) {
  return (
    <TableView aria-label="Users table" flex>
      <TableHeader>
        <Column>ID</Column>
        <Column>Name</Column>
        <Column>Email</Column>
        <Column>Role</Column>
        <Column align="end">Actions</Column>
      </TableHeader>
      <TableBody items={users}>
        {(item) => (
          <Row>
            <Cell>{item.id}</Cell>
            <Cell>{item.name}</Cell>
            <Cell>{item.email}</Cell>
            <Cell>{item.role}</Cell>
            <Cell>
              <MenuTrigger>
                <ActionButton>Actions</ActionButton>
                <Menu
                  onAction={(key) => {
                    if (key === "delete") {
                      onDelete(item.id);
                    } else {
                      onRoleChange(item.id, key as string);
                    }
                  }}
                >
                  <Item key="ADMIN">Make Admin</Item>
                  <Item key="USER">Make User</Item>
                  <Item key="delete">Delete</Item>
                </Menu>
              </MenuTrigger>
            </Cell>
          </Row>
        )}
      </TableBody>
    </TableView>
  );
}
