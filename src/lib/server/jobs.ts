import { startCronJobs } from "../cronManager";

let cronJobsStarted = false;

export function start() {
  if (!cronJobsStarted) {
    console.log("Initializing background jobs...");
    startCronJobs();
    cronJobsStarted = true;
  } else {
    console.log("Background jobs already running.");
  }
}
