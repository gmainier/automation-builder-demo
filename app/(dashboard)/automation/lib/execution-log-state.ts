import type { ExecutionLog } from "../contexts/automation-context";

/**
 * The execution panel treats a run as in-flight whenever any log entry is still
 * "running". Derive it from the logs (rather than a separate boolean) so the
 * panel and context can never disagree about whether execution is ongoing.
 */
export function deriveIsExecuting(logs: ReadonlyArray<Pick<ExecutionLog, "status">>): boolean {
  return logs.some((log) => log.status === "running");
}

/**
 * Append a terminal (error/cancelled) entry while dropping any lingering
 * "running" entries.
 *
 * Without the drop, `deriveIsExecuting` stays true after a failure — the spinner
 * spins forever and the (now-inert) Cancel button lingers. This was the
 * "can't even press cancel" symptom when a stream died with a network error.
 */
export function appendTerminalLog(logs: ReadonlyArray<ExecutionLog>, terminal: ExecutionLog): ExecutionLog[] {
  return [...logs.filter((log) => log.status !== "running"), terminal];
}
