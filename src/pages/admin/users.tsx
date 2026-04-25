import { useEffect, useState } from "react";
import { User } from "@prisma/client";
import UserTable from "@/components/admin/users/UserTable";
import { Heading } from "@adobe/react-spectrum";

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);

  const fetchUsers = () => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => setUsers(data));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    });
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
    fetchUsers();
  };

  return (
    <div>
      <Heading level={1}>User Management</Heading>
      <div style={{ marginTop: "2rem" }}>
        <UserTable
          users={users}
          onRoleChange={handleRoleChange}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
