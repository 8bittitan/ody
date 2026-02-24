const RETRYABLE_STATUSES = new Set([408, 429]);

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type RetryFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  fetchFn?: FetchLike;
  sleepFn?: (ms: number) => Promise<void>;
  randomFn?: () => number;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 2_000;
const DEFAULT_JITTER_RATIO = 0.2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRequestLabel(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function buildRequestFailureError(
  input: string | URL | Request,
  attempts: number,
  errorMessage: string,
): Error {
  return new Error(
    `Request to ${getRequestLabel(input)} failed after ${attempts} attempt(s): ${errorMessage}`,
  );
}

async function fetchOnceWithTimeout(
  input: string | URL | Request,
  init: RequestInit | undefined,
  timeoutMs: number,
  fetchFn: FetchLike,
): Promise<Response> {
  const timeoutController = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    timeoutController.abort();
  }, timeoutMs);

  const externalSignal = init?.signal;
  const onAbort = () => {
    timeoutController.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      throw new Error('Request was aborted');
    }
    externalSignal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    return await fetchFn(input, { ...init, signal: timeoutController.signal });
  } catch (error) {
    if (didTimeout) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onAbort);
  }
}

export namespace Http {
  export function shouldRetryStatus(status: number): boolean {
    return RETRYABLE_STATUSES.has(status) || (status >= 500 && status <= 599);
  }

  export function shouldRetryError(error: unknown): boolean {
    if (error instanceof TypeError) {
      return true;
    }

    if (!(error instanceof Error)) {
      return false;
    }

    return error.name === 'AbortError' || error.message.includes('timed out');
  }

  export function calculateBackoffMs(
    retryAttempt: number,
    options?: Pick<RetryFetchOptions, 'baseDelayMs' | 'maxDelayMs' | 'jitterRatio' | 'randomFn'>,
  ): number {
    const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    const jitterRatio = options?.jitterRatio ?? DEFAULT_JITTER_RATIO;
    const randomFn = options?.randomFn ?? Math.random;

    const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** (retryAttempt - 1));
    const jitter = Math.floor(exponentialDelay * jitterRatio * randomFn());

    return Math.min(maxDelayMs, exponentialDelay + jitter);
  }

  export async function fetchWithRetry(
    input: string | URL | Request,
    init?: RequestInit,
    options?: RetryFetchOptions,
  ): Promise<Response> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retries = options?.retries ?? DEFAULT_RETRIES;
    const fetchFn: FetchLike = options?.fetchFn ?? fetch;
    const sleepFn = options?.sleepFn ?? sleep;
    const maxAttempts = retries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetchOnceWithTimeout(input, init, timeoutMs, fetchFn);

        if (shouldRetryStatus(response.status) && attempt < maxAttempts) {
          const backoffMs = calculateBackoffMs(attempt, options);
          await sleepFn(backoffMs);
          continue;
        }

        return response;
      } catch (error) {
        const errorMessage = toErrorMessage(error);

        if (!shouldRetryError(error) || attempt >= maxAttempts) {
          throw buildRequestFailureError(input, attempt, errorMessage);
        }

        const backoffMs = calculateBackoffMs(attempt, options);
        await sleepFn(backoffMs);
      }
    }

    throw buildRequestFailureError(input, maxAttempts, 'Unknown error');
  }
}
