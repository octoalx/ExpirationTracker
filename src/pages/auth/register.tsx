import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Floating input ── */
interface FloatingInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  icon?: React.ReactNode;
}

function FloatingInput({ id, label, value, onChange, type = "text", icon }: FloatingInputProps) {
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;

  return (
    <div className="relative group">
      {icon && (
        <div
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 z-10",
            focused ? "text-blue-500" : "text-slate-400",
          )}
        >
          {icon}
        </div>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required
        className={cn(
          "peer w-full rounded-xl border bg-white px-4 py-3.5 text-base text-slate-900 dark:text-slate-100",
          "border-slate-200 dark:border-slate-700",
          "transition-all duration-200",
          " focus:border-blue-400",
          "focus:ring-2 focus:ring-blue-300/40 ",
          "placeholder-transparent",
          icon ? "pl-10" : "pl-4",
        )}
        placeholder={label}
      />
      <label
        htmlFor={id}
        className={cn(
          "absolute transition-all duration-200 pointer-events-none text-slate-500",
          icon ? "left-10" : "left-4",
          floated
            ? "-top-2.5 text-[11px] font-semibold bg-white dark:bg-slate-900 px-1.5 rounded text-blue-600 dark:text-blue-400"
            : "top-3.5 text-sm",
        )}
      >
        {label}
      </label>
    </div>
  );
}

/* ── Shake animation ── */
const shakeVariants = {
  shake: {
    x: [0, -12, 12, -8, 8, -4, 4, 0],
    transition: { duration: 0.5 },
  },
  idle: { x: 0 },
};

/* ── Register page ── */
/** New user registration page with name, email, and password form. */
export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const router = useRouter();

  const triggerError = (msg: string) => {
    setError(msg);
    setShakeKey((k) => k + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      triggerError("Пароли не совпадают");
      return;
    }

    setIsLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (res.ok) {
      router.push("/auth/signin");
    } else {
      const errorData = await res.json();
      triggerError(errorData.message || "Что-то пошло не так");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center auth-shell px-4 py-10">


      <div className="relative z-10 w-full max-w-md">
        <motion.div
          key={shakeKey}
          variants={shakeVariants}
          animate={error ? "shake" : "idle"}
          className="work-surface p-8 space-y-6"
        >
          {/* Header */}
          <div className="text-center">
            <h1 className="work-brand">
              Expi<span className="text-[#1554b5]">Track</span>
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Учёт сроков годности
            </p>
            <h2 className="mt-3 text-xl font-bold text-foreground">
              Создать аккаунт
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Присоединяйтесь к нам
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm text-center border border-red-200 dark:border-red-800"
              >
                {error}
              </motion.div>
            )}

            <FloatingInput
              id="name"
              label="Имя"
              value={name}
              onChange={setName}
              icon={<UserPlus size={16} />}
            />

            <FloatingInput
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              icon={<Mail size={16} />}
            />

            <FloatingInput
              id="password"
              label="Пароль"
              type="password"
              value={password}
              onChange={setPassword}
              icon={<Lock size={16} />}
            />

            <FloatingInput
              id="confirmPassword"
              label="Повторите пароль"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              icon={<Lock size={16} />}
            />

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white",
                "bg-[#1554b5] hover:bg-[#12479a]",
                "active:scale-[0.98]",
                "transition-all duration-200",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100",
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Создаём…
                </>
              ) : (
                "Создать аккаунт"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link
              href="/auth/signin"
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Войти
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
