---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Add Network Timeouts and Retries for Remote Requests

## Description
Improve command responsiveness and reliability under unstable networks by adding request timeouts and retry/backoff logic to external HTTP calls used by update and import workflows.

## Background
External calls in `Installation.checkLatest`, `GitHub.fetchIssue`, and `Jira.fetchTicket` currently rely on plain `fetch` without request timeout or retry strategy. Slow or transient network failures can cause long waits and inconsistent user experience. A shared, bounded retry policy with `AbortController` timeout support can reduce tail latency and improve success rate for transient issues.

## Technical Requirements
1. Introduce a shared HTTP helper that supports:
   - per-request timeout via `AbortController`
   - bounded retries with exponential backoff and jitter
   - retry conditions for transient failures (network errors, 408, 429, and 5xx)
2. Apply the helper to:
   - `packages/cli/src/lib/installation.ts` (`checkLatest`)
   - `packages/cli/src/lib/github.ts` (`fetchIssue` and comments fetch path)
   - `packages/cli/src/lib/jira.ts` (`fetchTicket`)
3. Preserve existing domain-specific error messaging for non-retriable failures (401/403/404, invalid input).
4. Keep retry limits conservative to avoid excessive delays.
5. Ensure commands still fail fast with clear messages when retries are exhausted.
6. Add unit tests for retry decision logic and timeout behavior.
7. Keep public command interfaces unchanged.

## Dependencies
- `packages/cli/src/lib/installation.ts` -- update check HTTP path.
- `packages/cli/src/lib/github.ts` -- GitHub issue and comments HTTP paths.
- `packages/cli/src/lib/jira.ts` -- Jira issue HTTP path.
- `packages/cli/src/lib` -- location for shared HTTP utility module.
- `packages/cli/src/lib/__tests__` -- test coverage for retry/timeout helper behavior.

## Implementation Approach
1. Create a small shared HTTP utility in `packages/cli/src/lib` for timeout + retry orchestration.
2. Define retry policy constants (max attempts, base delay, max delay, timeout per request).
3. Integrate utility into installation/github/jira fetch call sites.
4. Preserve existing response mapping and status-specific error translation logic.
5. Add tests for retryable vs non-retryable statuses, timeout abort handling, and exhausted retries.
6. Validate command UX remains clear and does not introduce noisy logs.

## Acceptance Criteria

1. **Timeouts prevent indefinite waits**
   - Given a remote endpoint that hangs
   - When update/import code paths perform requests
   - Then requests abort after configured timeout and return clear errors

2. **Transient failures are retried**
   - Given temporary network errors or retryable HTTP statuses
   - When affected requests run
   - Then requests retry with bounded backoff before failing

3. **Non-retryable auth/not-found errors remain immediate**
   - Given 401, 403, or 404 responses for Jira/GitHub
   - When requests execute
   - Then existing specific error messages are returned without unnecessary retries

4. **Installation update check uses shared HTTP policy**
   - Given `ody update` performs latest release lookup
   - When network conditions are degraded
   - Then behavior follows timeout/retry policy and reports final result clearly

5. **Retry helper tests pass**
   - Given new test coverage in `packages/cli/src/lib/__tests__`
   - When running relevant Bun tests
   - Then tests pass and assert timeout/retry behavior

## Metadata
- **Complexity**: Medium
- **Labels**: performance, reliability, network, retry
