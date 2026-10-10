// Phase 6A retry scheduling (bounded exponential + jitter)
export const MAX_ATTEMPTS = 5;
export const BASE_DELAY_MS = 2000;
export const MAX_DELAY_MS = 3600000;

export function computeRetryAfter(attempt: number, retryAfterHeader?: string): Date {
  // Cap at MAX_ATTEMPTS; after exhaustion no retry.
  if (attempt >= MAX_ATTEMPTS) return new Date(0); // terminal
  const base = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * base * 0.3); // up to 30% jitter
  const delay = Math.min(base + jitter, MAX_DELAY_MS);
  if (retryAfterHeader) {
    const ra = parseInt(retryAfterHeader.trim(), 10);
    if (!Number.isNaN(ra) && ra > 0) return new Date(Date.now() + Math.min(ra * 1000, MAX_DELAY_MS));
  }
  return new Date(Date.now() + delay);
}
export function isRetryable(httpStatus: number | null, error?: string): boolean {
  if (httpStatus === null) return true; // network/timeout
  if (httpStatus >= 500 && httpStatus <= 599) return true;
  if (httpStatus === 408 || httpStatus === 425 || httpStatus === 429) return true;
  if (httpStatus >= 400 && httpStatus < 500) return false; // permanent 4xx (except retryable above)
  return false;
}
export function isPermanent(httpStatus: number | null): boolean {
  if (httpStatus === null) return false;
  if (httpStatus >= 400 && httpStatus < 500 && !(httpStatus === 408 || httpStatus === 425 || httpStatus === 429)) return true;
  return false;
}
