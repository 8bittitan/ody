# Task Archive

Generated: 2026-02-21T03:51:36.395Z

Total tasks archived: 49

---

## Batch Plan Collection Before Agent Prompting

**Completed:** 2026-02-15

Refactor the `plan` CLI command so that it collects all task descriptions from the user upfront before invoking the backend agent.  Currently, the command prompts the user for a description, immediately spawns the agent to generate a task file, and then asks if they want to add another plan — repeating this cycle.  The new behavior should collect all descriptions first in a loop, then iterate through the collected descriptions and invoke the agent once per description to generate the corresponding task files.

---

## Compact Progress File and Rename History Output Files

**Completed:** 2026-02-15

Extend the `compact` command to also archive the `. ody/progress. txt` file alongside completed tasks.

---

## Create App Root Layout, Global Styles, and Home Page

**Completed:** 2026-02-15

Set up the Next. js App Router entry points: the root layout (`app/layout. tsx`) with Fumadocs `RootProvider`, a global CSS file (`app/global.

---

## Write Commands Documentation (Overview, init, run, config)

**Completed:** 2026-02-15

Create the MDX documentation pages for the top-level CLI commands: a commands overview page, and individual pages for `ody init`, `ody run`, and `ody config`.  Each page should document the command's purpose, synopsis, flags/options, behavior, and usage examples.

---

## Write Core Documentation Content (Introduction, Installation, Configuration)

**Completed:** 2026-02-15

Create the foundational MDX documentation pages and their sidebar ordering metadata.  These pages cover the project introduction/overview, installation instructions, and configuration guide -- the essential content a new user needs to get started with ody.

---

## Create Docs Layout, Catch-All Page, and Source Loader

**Completed:** 2026-02-15

Implement the Fumadocs documentation routing layer: the `docs/layout. tsx` with sidebar navigation, the `docs/[[... slug]]/page.

---

## Add Next.js and Fumadocs Configuration Files

**Completed:** 2026-02-15

Create all configuration files needed for the Next. js + Fumadocs documentation site to build and serve MDX content.  This includes the Next.

---

## Write Plan Subcommands Documentation (overview, new, list, edit, compact)

**Completed:** 2026-02-15

Create the MDX documentation pages for the `ody plan` command and all its subcommands: `plan new`, `plan list`, `plan edit`, and `plan compact`.  Each subcommand gets its own page with synopsis, flags, behavior description, and examples.

---

## Create the `packages/docs` Workspace Package

**Completed:** 2026-02-15

Bootstrap the `packages/docs` directory as a new workspace package in the Bun monorepo.  This is the foundational task that establishes the package identity, declares all required dependencies (Next. js, React, Fumadocs), and adds a `.

---

## Move `task compact` Subcommand to Root-Level `ody compact`

**Completed:** 2026-02-15

Promote the `compact` subcommand from `ody task compact` to a root-level CLI command `ody compact`.  This simplifies the user experience by making task compaction a first-class command rather than burying it under the `task` namespace, reflecting how frequently it is used as a standalone operation.

---

## Add File Argument to Plan Command for Batch Task Generation

**Completed:** 2026-02-15

Allow the `plan` command to accept an optional positional argument that is a path to a planning document or file.  When provided, the command should skip the interactive description collection loop and instead instruct the backend agent to read the referenced file and generate as many task files as needed based on its contents.

---

## Add Package Metadata to `packages/cli/package.json`

**Completed:** 2026-02-15

Add missing metadata fields to `packages/cli/package. json` required for the release pipeline.  The file currently lacks `description`, `license`, `author`, and `repository` fields.

---

## Create the Binaries GitHub Actions Workflow

**Completed:** 2026-02-15

Create `. github/workflows/binaries. yml`, a workflow that triggers on version tag pushes (`v*`), builds cross-platform Bun binaries in parallel using a matrix strategy, and creates a GitHub Release with the binaries attached.

---

## Generate Configuration Schema in Release Pipeline

**Completed:** 2026-02-15

Update the release pipeline to generate the JSON Schema for the `. ody/ody. json` configuration file and include it as a release artifact.

---

## Initialize Changesets for Version Management

**Completed:** 2026-02-15

Install the `@changesets/cli` package as a root workspace dev dependency and initialize the `. changeset/` directory with a project-specific configuration.  Changesets is used as a versioning engine only -- no per-change changeset files are created during development.

---

## Create User-Facing Install Script

**Completed:** 2026-02-15

Create `install. sh` at the repo root that allows users to install the correct platform binary with a single `curl` command.  The script detects the OS and architecture, fetches the latest release from the GitHub API, and downloads the appropriate binary.

---

## Create the Prepare Release GitHub Actions Workflow

**Completed:** 2026-02-15

Create `. github/workflows/prepare-release. yml`, a manually-dispatched GitHub Actions workflow that creates a temporary changeset, runs `changeset version` to bump `package.

---

## Create the Release (Tag) GitHub Actions Workflow

**Completed:** 2026-02-15

Create `. github/workflows/release. yml`, a workflow that triggers on pushes to `main` when `packages/cli/package.

---

## Align `run` Command Spinner Messaging with `plan` Command Pattern

**Completed:** 2026-02-15

The `run` command currently uses a single generic spinner message (`"Running agent loop"`) that starts once before the loop and stops once at the end, providing no per-iteration feedback.  It should be updated to follow the `plan` command's pattern: starting and stopping the spinner within each iteration, reporting the current iteration number, displaying a success message after each iteration, and outputting the final iteration count at the end.

---

## Add Installation Instructions to README

**Completed:** 2026-02-15

Add a dedicated "Installation" section to the README that covers all the ways a user can install `ody`.  Currently the README has a "Quick start" section focused on running from source and a "Build" section for compiling a binary, but there is no clear section explaining how end-users can install `ody` as a tool.  The install script (`install.

---

## Add Self-Update CLI Command

**Completed:** 2026-02-17

Add an `ody update` command that checks for a newer release on GitHub and replaces the running binary in-place.  This gives users a single-command upgrade path without needing to re-run the install script or manually download a release.

---

## Add Root-Level Convenience Scripts for Docs Workflow

**Completed:** 2026-02-17

Add `docs:dev` and `docs:build` convenience scripts to the root `package. json` so developers can start and build the documentation site without needing to remember the `--filter` flag.  Verify the full development workflow works end-to-end.

---

## Add Documentation Page for the `ody update` Command

**Completed:** 2026-02-17

Create a new MDX documentation page for the `ody update` CLI command and register it in the commands sidebar.  The update command allows users to check for and install CLI updates from GitHub Releases, but it currently has no corresponding documentation page.

---

## Add Auth Jira Command

**Completed:** 2026-02-18

Add an `ody auth jira` command that interactively prompts the user for their Jira email and API token, then stores them as a named profile in the global auth store at `~/. local/share/ody/auth. json`.

---

## Add Auth List Command

**Completed:** 2026-02-18

Add an `ody auth list` subcommand that displays all configured authentication credentials in a single unified view.  The command merges global auth store entries (from `~/. local/share/ody/auth.

---

## Add Auth Store With XDG Base Directory Support

**Completed:** 2026-02-18

Create a credential storage module at `packages/cli/src/lib/auth. ts` that reads and writes an `auth. json` file under the XDG data directory.

---

## Add GitHub Auth Provider with Profile Support

**Completed:** 2026-02-18

Add GitHub as an authentication provider to the CLI, accepting a personal access token (API key).  The implementation must follow the same "profiles" scheme used by the Jira integration, where non-sensitive config lives in the project config (`. ody/ody.

---

## Add GitHub Issue Import to Task Import Command

**Completed:** 2026-02-18

Extend the `ody task import` command to support importing GitHub issues as code tasks, alongside the existing Jira integration.  Users should be able to pass a `--github` / `-gh` flag with a GitHub issue URL or `owner/repo#number` shorthand.  The command fetches the issue via the GitHub REST API (authenticated using the GitHub auth provider profile), formats the issue data, and feeds it through the existing agent-based task generation pipeline to produce a `.

---

## Add Jira Configuration to Config Schema

**Completed:** 2026-02-18

Extend the Ody config schema in `packages/cli/src/lib/config. ts` to include an optional `jira` object with `baseUrl` and `profile` fields.  This allows projects to specify their Jira instance URL and which credential profile to use from the global auth store, keeping non-sensitive Jira settings in the project config while credentials remain in the user-global auth file.

---

## Add Jira Import Prompt Builder

**Completed:** 2026-02-18

Create a prompt builder at `packages/cli/src/builders/importPrompt. ts` that takes formatted Jira ticket data and wraps it in a structured prompt template instructing the backend agent to generate a `. code-task.

---

## Add Jira REST API Client

**Completed:** 2026-02-18

Create a Jira REST API client module at `packages/cli/src/lib/jira. ts` that can parse ticket input (URL or key), fetch ticket data from Jira's REST API v2, and format the ticket as a structured text description suitable for passing to an LLM agent.  The client must handle both Jira Cloud and Jira Server/Data Center instances, support authenticated and unauthenticated requests, and provide clear error messages for common failure cases.

---

## Add Task Import Jira Command

**Completed:** 2026-02-18

Add an `ody task import --jira <KEY_OR_URL>` command that fetches a Jira ticket via the REST API and generates a `. code-task. md` file by piping the ticket data through the backend agent.

---

## Add Network Timeouts and Retries for Remote Requests

**Completed:** 2026-02-19

Improve command responsiveness and reliability under unstable networks by adding request timeouts and retry/backoff logic to external HTTP calls used by update and import workflows.

---

## Cache Command-Scope Config and Path Derivations

**Completed:** 2026-02-19

Reduce repeated config/path derivation overhead in hot command paths by computing immutable command-scope values once and reusing them.

---

## Filter Task Edit Command to Only Show Pending Tasks

**Completed:** 2026-02-19

The `task edit` command currently displays all code task files as select options regardless of their frontmatter status.  It should only present tasks with `status: pending` so users are not offered completed, in-progress, or other non-pending tasks for editing.  This aligns the edit command's behavior with the existing `task list` command which already filters to pending tasks only.

---

## Fix Early `ody run` Exit That Leaves Tasks Stuck in `in_progress`

**Completed:** 2026-02-19

The `ody run` command can report success and end the loop even when the backend process exits early or fails after setting a task to `in_progress` but before marking it `completed`.  This leaves task files stuck in `in_progress` and causes follow-up iterations to skip them because the loop only targets `pending` tasks.

---

## Optimize Stream Processing for Large Agent Output

**Completed:** 2026-02-19

Reduce CPU and memory overhead in stream handling paths used by `run`, `plan`, and `task import` so long-running agent sessions remain responsive and do not degrade as output grows.

---

## Parallelize Task File Loading in CLI Commands

**Completed:** 2026-02-19

Improve command latency for task-heavy projects by parallelizing task file reads in list, edit, and status-related paths while keeping resource usage bounded.

---

## Per-Command Model Override in Config

**Completed:** 2026-02-19

Allow users to specify different models for the `run` and `plan` commands independently, while keeping a single root-level `model` property as the default fallback.  This enables workflows where planning uses a more capable (and expensive) model while execution uses a faster or cheaper one, or vice versa.

---

## Enforce Main Branch Context in Prepare Release Workflow

**Completed:** 2026-02-19

Ensure `. github/workflows/prepare-release. yml` always prepares releases from `main` and opens release PRs targeting `main`.

---

## Pin Release Workflow Checkouts to the Merged Commit

**Completed:** 2026-02-19

Update `. github/workflows/release. yml` so all jobs operate on the exact merged pull request commit instead of the moving `main` branch tip.

---

## Harden Release Tag Existence Check and Output Behavior

**Completed:** 2026-02-19

Improve tag creation logic in `. github/workflows/release. yml` by checking tag existence against the remote and preserving downstream output behavior.

---

## Replace Synchronous Task Globbing with Async Scans

**Completed:** 2026-02-19

Remove synchronous task directory scans from runtime command paths to reduce event-loop blocking and improve responsiveness under larger task directories.

---

## Add Concurrency Controls to CI and Release Workflows

**Completed:** 2026-02-19

Add GitHub Actions `concurrency` configuration to prevent overlapping CI and release runs from wasting resources or producing race conditions.

---

## Pin Third-Party GitHub Actions to Commit SHAs

**Completed:** 2026-02-19

Pin third-party actions in CI and release workflows from version tags to immutable commit SHAs for stronger supply-chain security.

---

## Reuse Shared Setup Bun Composite Action Across Workflows

**Completed:** 2026-02-19

Refactor release workflows to reuse `. github/actions/setup-bun` so Bun setup, caching, and dependency installation stay consistent across CI and release paths.

---

## Make CI and Release Installs Lockfile-Strict

**Completed:** 2026-02-19

Use `bun install --frozen-lockfile` in CI and release workflows to guarantee deterministic dependency resolution.

---

## Add Auth Command Documentation Page

**Completed:** 2026-02-20

Add a documentation page for the `ody auth` command and its subcommands (`github`, `jira`, `list`) to the docs website.  The auth command manages authentication credentials for third-party integrations and currently has no documentation on the site.

---

## Document the `ody task import` Command

**Completed:** 2026-02-20

Add a documentation page for the `ody task import` command to the docs website.  This command imports tasks from external issue trackers (Jira and GitHub) and converts them into structured `. code-task.

---

