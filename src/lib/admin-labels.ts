/**
 * UI names for the account roles. The database keeps the USER/ADMIN codes;
 * people read «Сотрудник» and «Администратор» everywhere in the admin panel.
 */
export const ROLE_LABELS = {
  USER: "Сотрудник",
  ADMIN: "Администратор",
} as const;

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? ROLE_LABELS.USER;
}
