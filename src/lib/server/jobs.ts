import { startCronJobs } from "../cronManager";

let cronJobsStarted = false;

/** Initializes background cron jobs (idempotent — safe to call multiple times). */
export function start() {
  if (!cronJobsStarted) {
    console.log("Initializing background jobs...");
    startCronJobs();
    cronJobsStarted = true;
  } else {
    console.log("Background jobs already running.");
  }
}
