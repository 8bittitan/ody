---
status: completed
created: 2026-02-18
started: 2026-02-18
completed: 2026-02-18
---
# Task: Add Jira REST API Client

## Description
Create a Jira REST API client module at `packages/cli/src/lib/jira.ts` that can parse ticket input (URL or key), fetch ticket data from Jira's REST API v2, and format the ticket as a structured text description suitable for passing to an LLM agent. The client must handle both Jira Cloud and Jira Server/Data Center instances, support authenticated and unauthenticated requests, and provide clear error messages for common failure cases.

## Background
The upcoming `ody task import --jira` command needs to fetch Jira ticket data and convert it into a `.code-task.md` file via the backend agent. This module provides the data-fetching layer. Jira's REST API v2 (`/rest/api/2/issue/{key}`) is used because it works on both Jira Cloud and Jira Server/Data Center — Cloud still fully supports v2 and returns descriptions as plain text or wiki markup (unlike v3 which uses Atlassian Document Format). Authentication uses HTTP Basic auth with the user's email and API token, which are stored in the global auth store (`~/.local/share/ody/auth.json`) via named profiles. The module follows the namespace pattern used by `Config` and `Installation` in the codebase.

## Technical Requirements
1. Create `packages/cli/src/lib/jira.ts` exporting a `Jira` namespace
2. Define and export a `JiraTicket` type with fields: `key`, `summary`, `description`, `status`, `priority`, `type`, `labels` (string array), `components` (string array), `assignee` (optional string), `reporter` (optional string), `comments` (string array)
3. Define a `ParsedInput` type with fields: `baseUrl` and `ticketKey`
4. Implement `Jira.parseInput(input, configBaseUrl?)` that auto-detects whether the input is a full URL or a ticket key:
   - If the input contains `://`, parse it as a URL: extract the origin as `baseUrl` and the ticket key from the path (handling both `/browse/PROJ-123` and `/jira/browse/PROJ-123` URL patterns)
   - If the input matches `/^[A-Z][A-Z0-9]+-\d+$/`, treat it as a ticket key and require `configBaseUrl` to be provided
   - Throw descriptive errors for invalid input or missing base URL
5. Implement `Jira.fetchTicket(baseUrl, key, auth?)` that fetches the ticket via `GET {baseUrl}/rest/api/2/issue/{key}?fields=summary,description,status,priority,issuetype,labels,components,assignee,reporter,comment`:
   - If `auth` is provided, send an `Authorization: Basic` header with base64-encoded `email:apiToken`
   - If no `auth`, attempt an unauthenticated request (for public instances)
   - Handle HTTP error responses: 401 (guide user to run `ody auth jira`), 403 (permission error), 404 (ticket not found), other (generic API error)
   - Map the JSON response fields to the `JiraTicket` type
6. Implement `Jira.formatAsDescription(ticket)` that converts a `JiraTicket` into a structured multi-line text block containing all ticket fields, suitable for inclusion in an LLM prompt
7. Use native `fetch()` (available in Bun) — no HTTP client dependencies
8. Use `btoa()` for base64 encoding of Basic auth credentials
9. Import the `JiraCredentials` type from `../lib/auth` for the `auth` parameter type

## Dependencies
- `packages/cli/src/lib/auth.ts` — provides the `JiraCredentials` type for the `auth` parameter
- Native `fetch()` and `btoa()` — available in Bun runtime, no external dependencies
- `packages/cli/src/lib/config.ts` — `Config.get('jira')` provides `baseUrl` when ticket keys are used without a full URL
- No new npm dependencies required

## Implementation Approach
1. **Create the module file**: Create `packages/cli/src/lib/jira.ts` with a `Jira` namespace export
2. **Define types**: Define `JiraTicket` and `ParsedInput` types at the top of the namespace. Define a `TICKET_KEY_PATTERN` regex constant (`/^[A-Z][A-Z0-9]+-\d+$/`) for validating ticket keys
3. **Implement `parseInput`**: Check if the input contains `://` to determine URL vs key. For URLs, use `new URL(input)` to parse, extract `url.origin` as `baseUrl`, split the pathname on `/`, find the segment after `browse`, and validate it matches the ticket key pattern. For keys, validate the format and check that `configBaseUrl` is provided, throwing with a helpful message if not
4. **Implement `fetchTicket`**: Construct the API URL with the `fields` query parameter to limit the response payload. Build headers with `Accept: application/json` and optionally `Authorization: Basic {base64(email:apiToken)}`. Call `fetch()`, check `res.ok`, and handle specific HTTP status codes with targeted error messages. Parse the JSON response and map `data.fields` to the `JiraTicket` shape, using optional chaining and fallback defaults for potentially missing fields. Map `comment.comments` array to extract author display names and bodies
5. **Implement `formatAsDescription`**: Build a multi-line string with labeled fields (key, summary, type, priority, status, labels, components, assignee, reporter, description, comments). Skip optional fields when empty. This format is consumed by the import prompt builder and ultimately interpreted by the LLM agent
6. **Handle edge cases**: Guard against `null` or `undefined` fields in the Jira API response (not all fields are always present). Handle empty description and empty comments gracefully

## Acceptance Criteria

1. **URL input parsed correctly**
   - Given the input `https://company.atlassian.net/browse/PROJ-123`
   - When `Jira.parseInput(input)` is called
   - Then it returns `{ baseUrl: 'https://company.atlassian.net', ticketKey: 'PROJ-123' }`

2. **URL with context path parsed correctly**
   - Given the input `https://jira.company.com/jira/browse/PROJ-456`
   - When `Jira.parseInput(input)` is called
   - Then it returns `{ baseUrl: 'https://jira.company.com', ticketKey: 'PROJ-456' }`

3. **Ticket key with config base URL parsed correctly**
   - Given the input `PROJ-123` and `configBaseUrl` is `https://company.atlassian.net`
   - When `Jira.parseInput(input, configBaseUrl)` is called
   - Then it returns `{ baseUrl: 'https://company.atlassian.net', ticketKey: 'PROJ-123' }`

4. **Ticket key without base URL throws descriptive error**
   - Given the input `PROJ-123` and no `configBaseUrl`
   - When `Jira.parseInput(input)` is called
   - Then an error is thrown mentioning `jira.baseUrl` in `.ody/ody.json`

5. **Invalid input throws error**
   - Given the input `not-a-ticket`
   - When `Jira.parseInput(input)` is called
   - Then an error is thrown indicating the input is invalid

6. **Authenticated fetch succeeds**
   - Given valid `baseUrl`, `key`, and `auth` credentials
   - When `Jira.fetchTicket(baseUrl, key, auth)` is called against a Jira instance
   - Then the ticket data is returned as a `JiraTicket` with all fields populated

7. **Unauthenticated fetch works for public instances**
   - Given a publicly accessible Jira instance and no `auth`
   - When `Jira.fetchTicket(baseUrl, key)` is called
   - Then the ticket data is returned without errors

8. **401 error guides user to auth command**
   - Given invalid or missing credentials for a private instance
   - When `Jira.fetchTicket` receives a 401 response
   - Then the error message includes guidance to run `ody auth jira`

9. **404 error identifies the missing ticket**
   - Given a non-existent ticket key
   - When `Jira.fetchTicket` receives a 404 response
   - Then the error message includes the ticket key and base URL

10. **Format produces structured text**
    - Given a `JiraTicket` with all fields populated
    - When `Jira.formatAsDescription(ticket)` is called
    - Then a multi-line string is returned containing all ticket fields in a labeled format

## Metadata
- **Complexity**: Medium
- **Labels**: cli, jira, api, infrastructure
