import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { InventoryError, requireManager, type Actor } from "./inventory";

type Database = PrismaClient | Prisma.TransactionClient;

export const DEPARTMENT_NAME_MAX = 100;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Department-level audit entries: they carry a store and no product, because the
 * product column references Product and department actions have no row.
 */
async function recordDepartmentEvent(db: Database, actor: Actor, storeId: string, action: string, details: unknown) {
  const user = await db.user.findUnique({ where: { id: actor.userId }, select: { name: true } });
  return db.productEvent.create({ data: { productId: null, storeId, actorId: actor.userId,
    actorName: user?.name ?? "Администратор", source: actor.source, action,
    details: JSON.stringify(details), key: randomUUID() } });
}

/** Trimmed department name, validated once for registration and admin creation. */
export function departmentName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > DEPARTMENT_NAME_MAX) {
    throw new InventoryError(400, `Укажите название отдела (до ${DEPARTMENT_NAME_MAX} символов).`);
  }
  return name;
}

/** A manager issues a password that the employee signs in with, so it is validated strictly. */
export function passwordValue(password: unknown) {
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new InventoryError(400, "Пароль должен содержать минимум 8 символов и не более 72 байт UTF-8.");
  }
  return password;
}

/** Name, email and password of a manager-issued account. */
export function accountCredentials(input: { name?: unknown; email?: unknown; password?: unknown }) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  if (!name || name.length > 120) throw new InventoryError(400, "Укажите имя сотрудника (до 120 символов).");
  if (!email || email.length > 254 || !EMAIL.test(email)) throw new InventoryError(400, "Укажите корректный email сотрудника.");
  return { name, email, password: passwordValue(input.password) };
}

/**
 * Self-registration founds a department: the account becomes its manager.
 * The three rows are written in one transaction, so a failure leaves no
 * department without a manager and no account without a department.
 */
export async function registerDepartment(db: PrismaClient,
  input: { name?: unknown; email?: unknown; password?: unknown; department?: unknown }) {
  const profile = accountCredentials(input);
  const name = departmentName(input.department);
  const password = await bcrypt.hash(profile.password, 10);
  return db.$transaction(async tx => {
    // Checked inside the transaction; the unique index is the final authority.
    if (await tx.user.findUnique({ where: { email: profile.email }, select: { id: true } })) {
      throw new InventoryError(409, "Пользователь с таким email уже существует.");
    }
    const store = await tx.store.create({ data: { name } });
    const user = await tx.user.create({
      data: { name: profile.name, email: profile.email, password, settings: { create: {} } },
      select: { id: true, name: true, email: true },
    });
    await tx.storeMembership.create({ data: { storeId: store.id, userId: user.id, role: "MANAGER" } });
    return { user, store: { id: store.id, name: store.name } };
  });
}

/** A manager hires an employee account with credentials handed over in person. */
export async function createEmployee(db: PrismaClient, managerId: string, input: { name?: unknown; email?: unknown; password?: unknown }) {
  const profile = accountCredentials(input);
  const password = await bcrypt.hash(profile.password, 10);
  return db.$transaction(async tx => {
    const manager = await requireManager(tx, managerId);
    if (await tx.user.findUnique({ where: { email: profile.email }, select: { id: true } })) {
      throw new InventoryError(409, "Аккаунт с таким email уже существует. Пароль можно сбросить в списке сотрудников.");
    }
    const user = await tx.user.create({
      data: { name: profile.name, email: profile.email, password, settings: { create: {} } },
      select: { id: true, name: true, email: true },
    });
    await tx.storeMembership.create({ data: { storeId: manager.storeId, userId: user.id, role: "EMPLOYEE" } });
    return user;
  });
}

/** The manager issues a new password for one employee of their own department. */
export async function resetEmployeePassword(db: PrismaClient, managerId: string, userId: string, password: unknown) {
  const hashed = await bcrypt.hash(passwordValue(password), 10);
  await db.$transaction(async tx => {
    const manager = await requireManager(tx, managerId);
    const target = await tx.storeMembership.findUnique({ where: { userId } });
    if (!target || target.storeId !== manager.storeId) throw new InventoryError(404, "Сотрудник не найден в вашем отделе.");
    if (target.role === "MANAGER") throw new InventoryError(409, "Пароль руководителя отдела меняет администратор сервиса.");
    await tx.user.update({ where: { id: userId }, data: { password: hashed } });
  });
}

/**
 * Revoking access removes the membership and the personal integrations, cancels
 * queued deliveries and releases authorship of the department rows. The rows
 * themselves stay with the department.
 */
export async function revokeMembership(db: PrismaClient, managerId: string, userId: string) {
  await db.$transaction(async tx => {
    const manager = await requireManager(tx, managerId);
    const target = await tx.storeMembership.findUnique({ where: { userId } });
    if (!target || target.storeId !== manager.storeId) throw new InventoryError(404, "Сотрудник не найден в вашем отделе.");
    if (target.role === "MANAGER") throw new InventoryError(409, "Руководителя отдела освобождает администратор сервиса.");
    await tx.storeMembership.delete({ where: { userId } });
    await tx.product.updateMany({ where: { userId, storeId: manager.storeId }, data: { userId: null } });
    await tx.productClaim.deleteMany({ where: { userId } });
    await tx.telegramLink.deleteMany({ where: { userId } });
    await tx.telegramLinkRequest.deleteMany({ where: { userId } });
    await tx.telegramButton.deleteMany({ where: { userId } });
    await tx.telegramWarning.deleteMany({ where: { userId } });
    await tx.telegramDelivery.updateMany({ where: { userId, state: { in: ["QUEUED", "PROCESSING"] } }, data: { state: "CANCELLED" } });
    await tx.settings.updateMany({ where: { userId }, data: { telegramNotifications: false } });
  });
}

/** Departments with their manager and member list. The administrator sees no product rows. */
export async function listDepartments(db: PrismaClient) {
  const stores = await db.store.findMany({
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    include: { members: { select: { userId: true, role: true,
      user: { select: { name: true, email: true, role: true } } } } },
  });
  return stores.map(store => {
    const members = store.members.map(member => ({ userId: member.userId, role: member.role,
      name: member.user.name, email: member.user.email, isAdmin: member.user.role === "ADMIN" }));
    return {
      id: store.id, name: store.name, createdAt: store.createdAt,
      urgentThreshold: store.urgentThreshold, warningThreshold: store.warningThreshold,
      members, memberCount: members.length,
      manager: members.find(member => member.role === "MANAGER") ?? null,
    };
  });
}

/** Exactly one manager per department: the appointment demotes the previous one. */
async function appointManagerIn(tx: Prisma.TransactionClient, adminId: string, storeId: string,
  user: { id: string; name: string | null; email: string | null; role: string }) {
  if (user.role === "ADMIN") throw new InventoryError(409, "Администратор сервиса не может руководить отделом.");
  const current = await tx.storeMembership.findUnique({ where: { userId: user.id } });
  if (current && current.storeId !== storeId) throw new InventoryError(409, "Аккаунт уже состоит в другом отделе.");
  await tx.storeMembership.updateMany({ where: { storeId, role: "MANAGER" }, data: { role: "EMPLOYEE" } });
  await tx.storeMembership.upsert({ where: { userId: user.id },
    create: { storeId, userId: user.id, role: "MANAGER" }, update: { role: "MANAGER" } });
  await recordDepartmentEvent(tx, { userId: adminId, source: "WEB" }, storeId, "MANAGER_APPOINTED", { userId: user.id });
  return { userId: user.id, name: user.name, email: user.email };
}

/** Administrator creates a department, optionally handing it to an existing account. */
export async function createDepartment(db: PrismaClient, adminId: string, input: { name?: unknown; managerEmail?: unknown }) {
  const name = departmentName(input.name);
  return db.$transaction(async tx => {
    const store = await tx.store.create({ data: { name } });
    const email = typeof input.managerEmail === "string" ? input.managerEmail.trim() : "";
    if (!email) return { store: { id: store.id, name: store.name }, manager: null };
    const manager = await tx.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, role: true } });
    if (!manager) throw new InventoryError(404, "Аккаунт руководителя не найден.");
    return { store: { id: store.id, name: store.name }, manager: await appointManagerIn(tx, adminId, store.id, manager) };
  });
}

/** Ownership transfer: the administrator appoints a member of the department as its manager. */
export async function appointManager(db: PrismaClient, adminId: string, input: { storeId?: unknown; userId?: unknown }) {
  const storeId = typeof input.storeId === "string" ? input.storeId : "";
  const userId = typeof input.userId === "string" ? input.userId : "";
  return db.$transaction(async tx => {
    const store = await tx.store.findUnique({ where: { id: storeId }, select: { id: true } });
    if (!store) throw new InventoryError(404, "Отдел не найден.");
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } });
    if (!user) throw new InventoryError(404, "Аккаунт не найден.");
    return { storeId: store.id, manager: await appointManagerIn(tx, adminId, store.id, user) };
  });
}

export async function renameDepartment(db: PrismaClient, input: { storeId?: unknown; name?: unknown }) {
  const storeId = typeof input.storeId === "string" ? input.storeId : "";
  const name = departmentName(input.name);
  const updated = await db.store.updateMany({ where: { id: storeId }, data: { name } });
  if (!updated.count) throw new InventoryError(404, "Отдел не найден.");
  return { id: storeId, name };
}

/**
 * Deleting a department is an administrator action with an explicit name
 * confirmation: rows, memberships and personal integrations go with it, while
 * the audit trail and the shared barcode reference stay.
 */
export async function deleteDepartment(db: PrismaClient, adminId: string, input: { storeId?: unknown; confirm?: unknown }) {
  const storeId = typeof input.storeId === "string" ? input.storeId : "";
  const confirm = typeof input.confirm === "string" ? input.confirm.trim() : "";
  return db.$transaction(async tx => {
    const store = await tx.store.findUnique({ where: { id: storeId } });
    if (!store) throw new InventoryError(404, "Отдел не найден.");
    if (confirm !== store.name) throw new InventoryError(400, "Введите название отдела, чтобы подтвердить удаление.");
    const members = await tx.storeMembership.findMany({ where: { storeId }, select: { userId: true } });
    const userIds = members.map(member => member.userId);
    const productIds = (await tx.product.findMany({ where: { storeId }, select: { id: true } })).map(p => p.id);
    await recordDepartmentEvent(tx, { userId: adminId, source: "WEB" }, storeId, "DEPARTMENT_DELETED",
      { name: store.name, members: userIds.length, rows: productIds.length });
    await tx.productClaim.deleteMany({ where: { productId: { in: productIds } } });
    await tx.telegramWarning.deleteMany({ where: { productId: { in: productIds } } });
    await tx.product.deleteMany({ where: { storeId } });
    await tx.storeMembership.deleteMany({ where: { storeId } });
    if (userIds.length) {
      await tx.telegramLink.deleteMany({ where: { userId: { in: userIds } } });
      await tx.telegramLinkRequest.deleteMany({ where: { userId: { in: userIds } } });
      await tx.telegramButton.deleteMany({ where: { userId: { in: userIds } } });
      await tx.telegramDelivery.updateMany({ where: { userId: { in: userIds }, state: { in: ["QUEUED", "PROCESSING"] } }, data: { state: "CANCELLED" } });
    }
    await tx.store.delete({ where: { id: storeId } });
    return { id: storeId, rows: productIds.length };
  });
}

/**
 * Temporary support access: the administrator joins one department as an
 * employee, and the grant and the revocation are both recorded in the audit log.
 * The unique membership row means only one such visit can be open at a time.
 */
export async function grantSupportAccess(db: PrismaClient, adminId: string, storeId: string) {
  return db.$transaction(async tx => {
    const store = await tx.store.findUnique({ where: { id: storeId }, select: { id: true, name: true } });
    if (!store) throw new InventoryError(404, "Отдел не найден.");
    const current = await tx.storeMembership.findUnique({ where: { userId: adminId }, include: { store: { select: { name: true } } } });
    if (current) {
      throw new InventoryError(409, current.storeId === storeId
        ? "Доступ в этот отдел уже открыт."
        : `Сначала закройте доступ в отделе «${current.store.name}».`);
    }
    await tx.storeMembership.create({ data: { storeId, userId: adminId, role: "EMPLOYEE" } });
    await recordDepartmentEvent(tx, { userId: adminId, source: "WEB" }, storeId, "SUPPORT_ACCESS", { name: store.name });
    return { storeId: store.id, name: store.name };
  });
}

export async function revokeSupportAccess(db: PrismaClient, adminId: string) {
  return db.$transaction(async tx => {
    const current = await tx.storeMembership.findUnique({ where: { userId: adminId } });
    if (!current) throw new InventoryError(404, "Доступ в отдел не открыт.");
    await tx.storeMembership.delete({ where: { userId: adminId } });
    await tx.productClaim.deleteMany({ where: { userId: adminId } });
    await recordDepartmentEvent(tx, { userId: adminId, source: "WEB" }, current.storeId, "SUPPORT_ACCESS_REVOKED", {});
    return { storeId: current.storeId };
  });
}
