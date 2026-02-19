import { describe, expect, mock, test } from 'bun:test';

import { Http } from '../http';

describe('Http', () => {
  test('retries only transient HTTP status codes', () => {
    expect(Http.shouldRetryStatus(408)).toBe(true);
    expect(Http.shouldRetryStatus(429)).toBe(true);
    expect(Http.shouldRetryStatus(500)).toBe(true);
    expect(Http.shouldRetryStatus(503)).toBe(true);

    expect(Http.shouldRetryStatus(400)).toBe(false);
    expect(Http.shouldRetryStatus(401)).toBe(false);
    expect(Http.shouldRetryStatus(404)).toBe(false);
  });

  test('retries retryable status responses and succeeds', async () => {
    const fetchFn = mock()
      .mockResolvedValueOnce(new Response('server error', { status: 500 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const sleepFn = mock(async () => {});

    const res = await Http.fetchWithRetry('https://example.com/resource', undefined, {
      retries: 2,
      timeoutMs: 100,
      baseDelayMs: 10,
      maxDelayMs: 10,
      jitterRatio: 0,
      fetchFn,
      sleepFn,
    });

    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).toHaveBeenCalledWith(10);
  });

  test('does not retry non-retryable status responses', async () => {
    const fetchFn = mock().mockResolvedValue(new Response('not found', { status: 404 }));
    const sleepFn = mock(async () => {});

    const res = await Http.fetchWithRetry('https://example.com/missing', undefined, {
      retries: 3,
      fetchFn,
      sleepFn,
    });

    expect(res.status).toBe(404);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).toHaveBeenCalledTimes(0);
  });

  test('retries network errors and then succeeds', async () => {
    const fetchFn = mock()
      .mockRejectedValueOnce(new TypeError('network unreachable'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const sleepFn = mock(async () => {});

    const res = await Http.fetchWithRetry('https://example.com/network', undefined, {
      retries: 2,
      timeoutMs: 100,
      baseDelayMs: 10,
      maxDelayMs: 10,
      jitterRatio: 0,
      fetchFn,
      sleepFn,
    });

    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });

  test('fails with a timeout error after retries are exhausted', async () => {
    let attempts = 0;
    const fetchFn = mock((_input: string | URL | Request, init?: RequestInit) => {
      attempts += 1;
      const signal = init?.signal;

      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => {
            reject(new Error('aborted'));
          },
          { once: true },
        );
      });
    });
    const sleepFn = mock(async () => {});

    await expect(
      Http.fetchWithRetry('https://example.com/timeout', undefined, {
        retries: 1,
        timeoutMs: 5,
        baseDelayMs: 1,
        maxDelayMs: 1,
        jitterRatio: 0,
        fetchFn,
        sleepFn,
      }),
    ).rejects.toThrow('timed out');

    expect(attempts).toBe(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });
});
