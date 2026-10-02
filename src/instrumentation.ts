/** Next.js instrumentation hook — starts background cron jobs in Node.js runtime. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DISABLE_BACKGROUND_JOBS !== "true") {
    const { start } = await import("./lib/server/jobs");
    start();
  }
}
