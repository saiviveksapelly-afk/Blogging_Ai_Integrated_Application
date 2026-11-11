const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/$/, "");
const MAX_WAIT_MS = 2 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 8_000;
let backendReadyUntil = 0;
let pendingCheck: Promise<void> | null = null;

export class BackendWakeError extends Error {
  constructor() {
    super("The server did not become available after 2 minutes. Please try again later.");
    this.name = "BackendWakeError";
  }
}

const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function pollBackend(onWaiting?: () => void) {
  const deadline = Date.now() + MAX_WAIT_MS;
  let delay = 1_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/api/health`, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      if (response.ok) {
        backendReadyUntil = Date.now() + 20_000;
        return;
      }
      // A missing health route indicates a bad API URL/deployment, not a sleeping process.
      if (response.status >= 400 && response.status < 500) {
        throw new Error("The configured backend does not provide its health endpoint.");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "The configured backend does not provide its health endpoint.") throw error;
      // A sleeping host may refuse or time out the connection while it starts.
    }

    onWaiting?.();
    const remaining = deadline - Date.now();
    if (remaining > 0) await pause(Math.min(delay, remaining));
    delay = Math.min(delay * 1.5, 5_000);
  }

  throw new BackendWakeError();
}

export function waitForBackend(onWaiting?: () => void) {
  if (Date.now() < backendReadyUntil) return Promise.resolve();
  if (!pendingCheck) {
    pendingCheck = pollBackend(onWaiting).finally(() => { pendingCheck = null; });
  }
  return pendingCheck;
}

