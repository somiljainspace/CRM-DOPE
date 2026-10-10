/**
 * Typed API client for the dashboard BFF.
 *
 * All requests go through the Next.js API routes under /api/proxy, which
 * attach the HttpOnly session cookie. No session token ever touches browser
 * JavaScript, so it is never logged or stored client-side.
 */

export type ApiErrorShape = {
  error?: string;
  message?: string;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function apiFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const { method = 'GET', query, body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  let url = `/api/proxy/${path.replace(/^\//, '')}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  // Link the caller's signal (cancellation) with our timeout signal.
  const onCallerAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data: T | ApiErrorShape = {} as T;
    try {
      data = (await res.json()) as T;
    } catch {
      // Non-JSON response; handled below via status.
    }

    if (!res.ok) {
      const err = data as ApiErrorShape;
      const message =
        err.message || err.error || defaultMessage(res.status);
      throw new ApiError(res.status, message);
    }
    return data as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out or was cancelled');
    }
    throw new ApiError(502, 'Unable to reach the API');
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onCallerAbort);
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request';
    case 401:
      return 'Session expired. Please sign in again.';
    case 403:
      return 'You do not have access to this workspace.';
    case 404:
      return 'Resource not found';
    case 429:
      return 'Too many requests. Please wait a moment.';
    default:
      return status >= 500 ? 'The API returned an error' : 'Request failed';
  }
}

// ---- Response types (mirror apps/api/src/routes/analytics.ts) ----

export interface TrendPoint {
  time_bucket: string;
  event_count: number;
}

export interface TrendsResponse {
  trends: TrendPoint[];
}

export interface ActiveUserPoint {
  time_bucket: string;
  unique_users: number;
}

export interface ActiveUsersResponse {
  activeUsers: ActiveUserPoint[];
}

export interface ExplorerEvent {
  event_id: string;
  event_name: string;
  event_type: string;
  timestamp: string;
  user_id: string | null;
  anonymous_id: string | null;
  session_id: string;
  properties: Record<string, unknown> | null;
}

export interface EventsResponse {
  events: ExplorerEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface FunnelStepResult {
  level: number;
  count: number;
}

export interface FunnelResponse {
  funnel: FunnelStepResult[];
}

export interface RetentionRow {
  cohort_date: string;
  day_offset: number;
  users_count: number;
}

export interface RetentionResponse {
  retention: RetentionRow[];
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
}
