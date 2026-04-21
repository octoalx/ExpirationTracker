import { getSession } from "next-auth/react";
import { prisma } from "@/lib/prisma";
import { useState } from "react";
import { useRouter } from "next/router";

export default function AdminDashboard({
  stats: initialStats,
  users: initialUsers,
}) {
  const [users, setUsers] = useState(initialUsers);
  const deleteUser = async (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUsers(users.filter((user) => user.id !== userId));
      } else {
        alert("Failed to delete user.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-700">
            Всего пользователей
          </h2>
          <p className="text-3xl font-bold text-gray-900">
            {initialStats.totalUsers}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-700">
            Всего продуктов
          </h2>
          <p className="text-3xl font-bold text-gray-900">
            {initialStats.totalProducts}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-700">
            Просроченные продукты
          </h2>
          <p className="text-3xl font-bold text-red-600">
            {initialStats.expiredProducts}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Управление пользователями
        </h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Имя
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Email
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Роль
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Удалить</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);

  const totalUsers = await prisma.user.count();
  const totalProducts = await prisma.product.count({
    where: { userId: session.user.id },
  });
  const expiredProducts = await prisma.product.count({
    where: {
      userId: session.user.id,
      expiryDate: {
        lt: new Date(),
      },
    },
  });
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });

  return {
    props: {
      session,
      stats: {
        totalUsers,
        totalProducts,
        expiredProducts,
      },
      users,
    },
  };
}
