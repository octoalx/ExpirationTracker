import { ChevronRight, LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";

type MobileHeaderProps = {
  user?: { name?: string | null; email?: string | null };
};

/** Keep account identity in a dedicated row without competing with page actions. */
export default function MobileHeader({ user }: MobileHeaderProps) {
  const accountName = user?.name?.trim() || user?.email?.trim() || "Пользователь";

  return <header className="border-b border-slate-200 bg-white px-4 pb-2 pt-2 md:hidden">
    <Link href="/dashboard" className="inline-flex min-h-11 items-center">
      <span className="work-brand">Expi<span className="text-blue-700">Track</span></span>
    </Link>
    {user && <div className="mt-1 flex items-center gap-1">
      <Link href="/settings" aria-label={`Настройки профиля: ${accountName}`} title={accountName}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <UserRound className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-base font-bold">{accountName}</span>
        <Settings className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
        <ChevronRight className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
      </Link>
      {/* Sibling of the settings link, never nested: the phone had no other way to sign out. */}
      <button type="button" aria-label={`Выйти из аккаунта: ${accountName}`} title="Выйти"
        onClick={() => void signOut({ callbackUrl: "/auth/signin" })}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-50 active:bg-slate-100">
        <LogOut className="size-5" aria-hidden="true" />
      </button>
    </div>}
  </header>;
}
