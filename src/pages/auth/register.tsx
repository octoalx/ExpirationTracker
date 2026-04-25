import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import AnimatedBackground from "@/components/AnimatedBackground";
import ParallaxCard from "@/components/ParallaxCard";

/* ── Floating input (local) ──────────────────────────────────────────── */
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
            focused ? "text-emerald-500" : "text-slate-400",
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
          "peer w-full rounded-xl border bg-white/60 dark:bg-slate-800/60 px-4 py-3.5 text-sm text-slate-900 dark:text-slate-100",
          "border-slate-200 dark:border-slate-700",
          "transition-all duration-200",
          "focus:scale-[1.02] focus:border-emerald-400",
          "focus:ring-2 focus:ring-emerald-300/40 focus:shadow-[0_0_16px_rgba(16,185,129,0.12)]",
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
            ? "-top-2.5 text-[11px] font-semibold bg-white dark:bg-slate-900 px-1.5 rounded text-emerald-600 dark:text-emerald-400"
            : "top-3.5 text-sm",
        )}
      >
        {label}
      </label>
    </div>
  );
}

/* ── Shake animation variants ────────────────────────────────────────── */
const shakeVariants = {
  shake: {
    x: [0, -12, 12, -8, 8, -4, 4, 0],
    transition: { duration: 0.5 },
  },
  idle: { x: 0 },
};

/* ── Social button icons ─────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.39l3.66-2.84v-.46z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/* ── Register page ───────────────────────────────────────────────────── */
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
    <div className="relative min-h-screen flex items-center justify-center bg-animated-gradient px-4 overflow-hidden">
      <AnimatedBackground />

      <ParallaxCard className="relative z-10 w-full max-w-md">
        <motion.div
          key={shakeKey}
          variants={shakeVariants}
          animate={error ? "shake" : "idle"}
          className="glass-card p-8 space-y-6"
        >
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight bg-linear-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              ExpiTrack
            </h1>
            <h2 className="mt-3 text-xl font-bold text-foreground">
              Создать аккаунт
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Присоединяйтесь к нам
            </p>
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5",
                "bg-white/60 dark:bg-slate-800/60 text-sm font-medium text-foreground",
                "hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:scale-[1.02]",
                "transition-all duration-200",
              )}
            >
              <GoogleIcon />
              Google
            </button>
            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5",
                "bg-white/60 dark:bg-slate-800/60 text-sm font-medium text-foreground",
                "hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:scale-[1.02]",
                "transition-all duration-200",
              )}
            >
              <GitHubIcon />
              GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-slate-900 px-3 text-muted-foreground font-medium">
                или по email
              </span>
            </div>
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
                "bg-linear-to-r from-emerald-600 to-teal-500",
                "shadow-lg shadow-emerald-500/20",
                "hover:shadow-emerald-500/30 hover:scale-[1.02]",
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
              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Войти
            </Link>
          </p>
        </motion.div>
      </ParallaxCard>
    </div>
  );
}
