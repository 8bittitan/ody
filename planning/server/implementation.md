# Desktop-to-Daemon RPC Migration Implementation Spec

## Overview

This spec defines the first phase of Command and Control (C2) server adoption in Ody:

- Introduce a local daemon in `packages/server`.
- Integrate **desktop only** with the daemon.
- Keep CLI unchanged for now.
- Use oRPC over HTTP for control requests.
- Use SSE at `GET /sse` for server notifications.
- Keep active project selection in desktop client state (not server state).
- Share RPC contracts, client, and validation in `internal/rpc`.

## Goals

1. Centralize backend process execution and run lifecycle in one daemon process.
2. Preserve existing renderer API and event behavior in desktop.
3. Guarantee client/server protocol type safety and runtime validation.
4. Ensure single daemon instance per user via PID + lock metadata files.

## Non-Goals (Phase 1)

- No CLI integration.
- No remote/multi-user mode.
- No authentication hardening beyond local daemon assumptions.
- No migration of all desktop features in one pass (plan/import/auth/archive/progress can remain local initially).

## High-Level Architecture

### Components

- `packages/server`
  - Local Bun daemon process.
  - oRPC endpoint: `POST /rpc`.
  - SSE notifications endpoint: `GET /sse`.
  - Run orchestrator for backend lifecycle.
- `internal/rpc`
  - Shared oRPC contracts and types.
  - Zod schemas for runtime validation.
  - Typed client and SSE event iterator helpers.
- `packages/desktop` (main process)
  - Manages daemon lifecycle.
  - Proxies selected IPC handlers to RPC methods.
  - Relays `/sse` notifications into existing Electron events.

### Ownership Rules

- Desktop owns active project (`activeProject` in Electron store).
- Server does **not** store active project.
- Project-scoped methods must include `projectPath` in params.

## Shared RPC Package (`internal/rpc`)

### New package

Create `internal/rpc` as a workspace package:

- `internal/rpc/package.json`
- `internal/rpc/src/index.ts`
- `internal/rpc/src/types.ts`
- `internal/rpc/src/contracts.ts`
- `internal/rpc/src/schemas.ts`
- `internal/rpc/src/client.ts`
- `internal/rpc/src/sse.ts`

### Responsibilities

1. Define oRPC procedure contracts and streaming contracts.
2. Define method and notification contract maps.
3. Define Zod schemas for:
   - Request params
   - Success result payloads
   - SSE notification payloads
   - Error shape
4. Export a typed client API with procedure-specific inference.
5. Export SSE event iterator utilities shared by server and desktop.

## Transport Protocol

### oRPC Control Endpoint

- Route: `POST /rpc`
- Content type: `application/json`
- Payload/response: oRPC procedure request and response
- Validation: request input and output validated with shared Zod schemas

### SSE Notifications Endpoint

- Route: `GET /sse`
- Transport: oRPC event iterator over SSE
- Event name: `agent.event`
- Data: JSON-serialized `AgentServerEvent`

Example SSE message:

```text
event: agent.event
id: evt_0001
data: {"eventId":"evt_0001","eventType":"agent.output","runId":"run_123","projectPath":"/repo","occurredAt":"2026-02-27T10:00:00.000Z","payload":{"chunk":"..."}}

```

## RPC Contract (Phase 1)

### Methods

1. `system.health`
2. `projects.list`
3. `projects.add`
4. `projects.remove`
5. `tasks.list`
6. `tasks.read`
7. `tasks.delete`
8. `tasks.byLabel`
9. `tasks.states`
10. `agent.run`
11. `agent.stop`

### Notifications (via `/sse`)

- `agent.started`
- `agent.iteration`
- `agent.output`
- `agent.ambiguousMarker`
- `agent.verifyFailed`
- `agent.complete`
- `agent.stopped`

All agent notification events must include:

- `eventId: string`
- `runId: string`
- `projectPath: string`
- `eventType: string`
- `occurredAt: string` (ISO timestamp)

## Contract Shapes (Phase 1)

Use these as the canonical shared contracts in `internal/rpc`.

```ts
import { z } from 'zod';

export const AgentEventBaseSchema = z.object({
  eventId: z.string(),
  runId: z.string(),
  projectPath: z.string(),
  eventType: z.enum([
    'agent.started',
    'agent.iteration',
    'agent.output',
    'agent.ambiguousMarker',
    'agent.verifyFailed',
    'agent.complete',
    'agent.stopped',
  ]),
  occurredAt: z.string(),
});

export const AgentRunInputSchema = z.object({
  projectPath: z.string(),
  taskId: z.string(),
  model: z.string().optional(),
  autoCommit: z.boolean().optional(),
});

export const AgentRunResultSchema = z.object({
  runId: z.string(),
  projectPath: z.string(),
  status: z.literal('started'),
  startedAt: z.string(),
});

export const AgentOutputEventSchema = AgentEventBaseSchema.extend({
  eventType: z.literal('agent.output'),
  payload: z.object({
    chunk: z.string(),
  }),
});

export const AgentIterationEventSchema = AgentEventBaseSchema.extend({
  eventType: z.literal('agent.iteration'),
  payload: z.object({
    iteration: z.number().int().nonnegative(),
  }),
});

export const AgentCompleteEventSchema = AgentEventBaseSchema.extend({
  eventType: z.literal('agent.complete'),
  payload: z.object({
    success: z.boolean(),
    summary: z.string().optional(),
  }),
});

export const AgentServerEventSchema = z.discriminatedUnion('eventType', [
  AgentOutputEventSchema,
  AgentIterationEventSchema,
  AgentCompleteEventSchema,
]);

export type AgentRunInput = z.infer<typeof AgentRunInputSchema>;
export type AgentRunResult = z.infer<typeof AgentRunResultSchema>;
export type AgentServerEvent = z.infer<typeof AgentServerEventSchema>;

export type DesktopRebroadcast = {
  onEvent: (event: AgentServerEvent) => void;
  rebroadcast: (channel: string, payload: unknown) => void;
};
```

Notes:

- Include all seven event variants in the production union; the snippet keeps a reduced set for readability.
- Keep `eventId` unique and monotonic per process so desktop can dedupe after reconnect.
- Keep `runId` and `projectPath` on every event for renderer routing compatibility.

## Validation Strategy

### Server-side

For each request:

1. Validate procedure existence in the oRPC router.
2. Validate input via procedure Zod schema.
3. Execute handler.
4. Validate output via output Zod schema (especially in development).
5. Return typed procedure response.

For each SSE event:

1. Validate event payload via `AgentServerEvent` schema.
2. Publish via oRPC event iterator to `/sse` clients.
3. Preserve `eventId` for dedupe and replay-safe client handling.

### Desktop-side

- Validate procedure responses using shared schemas (or trust typed client + narrow checks where needed).
- Validate `/sse` events via shared event schemas before rebroadcasting to renderer.

## Error Model

Use app-specific error codes with stable string identifiers and deterministic HTTP mapping:

- `BAD_REQUEST` -> `400`
- `NOT_FOUND` -> `404`
- `PROJECT_NOT_FOUND` -> `404`
- `RUN_ALREADY_ACTIVE` -> `409`
- `RUN_NOT_FOUND` -> `404`
- `BACKEND_SPAWN_FAILURE` -> `500`
- `INTERNAL_ERROR` -> `500`

Error payload shape:

```ts
type RpcError = {
  code:
    | 'BAD_REQUEST'
    | 'NOT_FOUND'
    | 'PROJECT_NOT_FOUND'
    | 'RUN_ALREADY_ACTIVE'
    | 'RUN_NOT_FOUND'
    | 'BACKEND_SPAWN_FAILURE'
    | 'INTERNAL_ERROR';
  message: string;
  details?: unknown;
};
```

## Daemon Lifecycle and Locking

### Lock files (namespaced)

- Directory: `~/.ody/server/`
- PID file: `~/.ody/server/daemon.pid`
- Metadata lock file: `~/.ody/server/daemon.lock.json`

### Metadata schema

`daemon.lock.json` fields:

- `pid: number`
- `port: number`
- `startedAt: string` (ISO timestamp)
- `version: string`
- `tokenId?: string` (optional, reserved for future auth)

### Startup behavior

1. Ensure lock directory exists.
2. If lock exists:
   - Read lock metadata.
   - Check PID liveness.
   - Verify daemon identity with `system.health`.
   - If healthy and same daemon, reject second instance.
   - If stale, clean stale lock + pid files.
3. Start server listener.
4. Write PID and lock metadata atomically.

### Shutdown behavior

- On `SIGINT`, `SIGTERM`, and normal process exit:
  - Remove `daemon.pid`.
  - Remove `daemon.lock.json`.

## Server Implementation (`packages/server`)

### Package scaffold

- `packages/server/package.json`
- `packages/server/src/index.ts`
- `packages/server/src/rpc/router.ts`
- `packages/server/src/rpc/procedures/*.ts`
- `packages/server/src/events/bus.ts`
- `packages/server/src/services/run-orchestrator.ts`
- `packages/server/src/services/project-service.ts`
- `packages/server/src/services/task-service.ts`
- `packages/server/src/daemon/lock.ts`

### Responsibilities

- Expose `/rpc` and `/sse`.
- Dispatch oRPC procedures to services.
- Broadcast run lifecycle notifications.
- Enforce run concurrency policy.

### Concurrency policy

- One active run per `projectPath`.
- Return `RUN_ALREADY_ACTIVE` if a run is already active for the same project.
- Allow parallel runs across different projects.

## Desktop Integration

### New desktop main modules

- `packages/desktop/src/main/server/lifecycle.ts`
  - `ensureServerRunning()` (health check -> spawn if needed -> wait ready)
- `packages/desktop/src/main/server/client.ts`
  - Typed oRPC client wrapper based on `@internal/rpc`
- `packages/desktop/src/main/server/sse.ts`
  - `/sse` connection + event validation + rebroadcast to renderer

### Startup flow

On desktop app startup:

1. Attempt `system.health`.
2. If unavailable, spawn daemon process.
3. Poll until healthy with timeout/backoff.
4. Open `/sse` subscription.

### IPC migration (desktop main)

Refactor selected handlers in `packages/desktop/src/main/ipc.ts` to proxy to server:

- `projects:list`
- `projects:add`
- `projects:remove`
- `tasks:list`
- `tasks:read`
- `tasks:delete`
- `tasks:byLabel`
- `tasks:states`
- `agent:run`
- `agent:stop`

Keep active project logic local and inject `projectPath` into project-scoped RPC calls.

### Renderer compatibility

Do not change:

- `packages/desktop/src/preload/index.ts` public API shape
- `packages/desktop/src/renderer/types/ipc.ts` event contracts
- `packages/desktop/src/renderer/hooks/useAgent.ts` behavior

Map server event types to existing renderer event names:

- `agent.started` -> `agent:started`
- `agent.iteration` -> `agent:iteration`
- `agent.output` -> `agent:output`
- `agent.complete` -> `agent:complete`
- `agent.stopped` -> `agent:stopped`
- `agent.verifyFailed` -> `agent:verifyFailed`
- `agent.ambiguousMarker` -> `agent:ambiguousMarker`

## Migration Order

1. Add `internal/rpc` shared package (oRPC contracts + schemas + client utilities).
2. Scaffold `packages/server` with `/rpc`, `/sse`, and `system.health`.
3. Implement daemon lock manager (pid + metadata).
4. Implement `projects.*` procedures and desktop proxies.
5. Implement `tasks.*` procedures and desktop proxies.
6. Migrate run loop to server (`agent.run`, `agent.stop`) and add notifications.
7. Connect desktop SSE rebroadcast path.
8. Remove or bypass equivalent local desktop execution paths once parity is validated.

## Testing and Validation

### Automated checks

- `bun typecheck`

### Manual smoke checks

1. Launch desktop with no daemon running.
   - Daemon starts automatically.
   - Lock files created in `~/.ody/server/`.
2. Launch second desktop instance.
   - No duplicate daemon process.
3. Project and task operations succeed through RPC.
4. Run starts and streams output through `/sse` to renderer.
5. Forced daemon termination creates recoverable stale lock scenario.
6. Restart desktop after stale lock.
   - Stale lock is cleaned.
   - Daemon boots successfully.
7. Clean desktop quit removes lock files.

## Acceptance Criteria

1. Desktop can operate migrated features exclusively through server RPC.
2. Renderer contract is unchanged for migrated features.
3. Shared `internal/rpc` types and schemas are consumed by both desktop and server.
4. Server enforces per-project run concurrency.
5. PID + lock metadata files prevent duplicate daemon instances and recover from stale state.
6. `/sse` endpoint is the only event stream endpoint and functions reliably for agent updates.

## Follow-up (Out of Scope for this spec)

- Migrate remaining desktop capabilities (plan/import/auth/archive/progress/config layers as needed).
- Integrate CLI with server RPC.
- Optional local auth token handshake.
- Optional persistent daemon mode beyond desktop lifecycle.
