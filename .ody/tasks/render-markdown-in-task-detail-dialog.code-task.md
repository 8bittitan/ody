---
status: completed
created: 2026-03-05
started: 2026-03-05
completed: 2026-03-05
---
# Task: Render Full Markdown in Task Detail Dialog

## Description
Replace the hand-rolled plain-text parser in `TaskDetailDialog` with a proper markdown rendering solution so the task detail dialog displays fully rendered markdown — including inline formatting (bold, italic, code), code blocks, links, nested lists, blockquotes, and tables — instead of the current limited plain-text approximation.

## Background
The `TaskDetailDialog` component (`packages/desktop/src/renderer/components/TaskDetailDialog.tsx`) currently uses two custom functions — `parseMarkdownSections` and `renderSectionBody` — to convert raw `.code-task.md` content into React elements. This approach only handles top-level `##` section splitting, flat bullet/numbered lists, standalone bold lines, and plain paragraphs. It does not render inline markdown (bold within paragraphs, italic, inline code backticks, links), fenced code blocks, nested lists, blockquotes, or tables. Task files are full markdown documents, so the dialog should render them as such.

The desktop package already depends on `@milkdown/kit` and `@milkdown/react` for the task editor, but Milkdown is a full WYSIWYG ProseMirror-based editor — overkill for a read-only detail view. A lightweight, read-only markdown renderer is the appropriate solution. A library like `react-markdown` (with optional `remark-gfm` for GFM table/strikethrough support) is the standard approach in the React ecosystem.

## Technical Requirements
1. Install a lightweight markdown rendering library suitable for read-only display (e.g., `react-markdown`, optionally with `remark-gfm` for GFM support).
2. Remove the `parseMarkdownSections` and `renderSectionBody` helper functions and the `MarkdownSection` type from `TaskDetailDialog.tsx`.
3. Strip the YAML frontmatter from the raw markdown content before passing it to the renderer.
4. Render the remaining markdown (after frontmatter stripping) using the chosen library inside the existing `ScrollArea` container.
5. Style the rendered markdown output to match the existing dialog's visual design — use the same Tailwind utility classes (`text-mid`, `text-light`, `text-xs`, `text-dim`, etc.) and spacing conventions established by the current implementation.
6. Ensure all standard CommonMark elements render correctly: headings (`##`, `###`), bold, italic, inline code, fenced code blocks, ordered and unordered lists (including nested), links, blockquotes, and horizontal rules.
7. Optionally support GFM extensions (tables, strikethrough, task lists) if the chosen library makes this trivial (e.g., adding `remark-gfm`).
8. The dialog's header (title, status badge), label/metadata bar, footer buttons, and loading/error states must remain unchanged.

## Dependencies
- A markdown rendering library added to `packages/desktop` (e.g., `react-markdown` as a dependency, `remark-gfm` as a dev or regular dependency).
- Existing component: `packages/desktop/src/renderer/components/TaskDetailDialog.tsx` (lines 63–186 contain the code to replace; lines 291–306 contain the rendering call site).
- Existing Tailwind theme tokens used across the desktop app (`text-light`, `text-mid`, `text-dim`, `border-edge`, etc.).

## Implementation Approach
1. **Install dependencies** — Add `react-markdown` (and optionally `remark-gfm`) to `packages/desktop/package.json` via `bun add`.
2. **Create a styled markdown renderer component** — Build a small `RenderedMarkdown` component (or inline configuration) that maps markdown elements to styled React elements using Tailwind classes matching the dialog's design system. Use `react-markdown`'s `components` prop to override default element rendering (e.g., `h2` → `<h3 className="text-light mb-2 text-sm font-semibold">`, `p` → `<p className="text-mid text-xs leading-relaxed">`, `li` → styled list items, `code` → styled code spans/blocks, etc.).
3. **Strip frontmatter** — Keep the existing frontmatter-stripping regex (`content.replace(/^---[\s\S]*?---\s*/, '')`) but apply it inline before passing content to the renderer. Also strip the `# Task: ...` title line since the dialog already displays the title in its header.
4. **Replace the rendering call site** — In the `TaskDetailDialog` component, replace the `sections.map(...)` block (lines 291–306) with the new markdown renderer, passing the stripped content.
5. **Remove dead code** — Delete `parseMarkdownSections`, `renderSectionBody`, and the `MarkdownSection` type.
6. **Verify visual consistency** — Ensure headings, lists, paragraphs, code blocks, and inline formatting render with appropriate size, color, and spacing that matches the existing dialog aesthetic.

## Acceptance Criteria

1. **Inline Formatting Renders**
   - Given a task file containing `**bold**`, `*italic*`, and `` `inline code` `` within paragraph text
   - When the task detail dialog is opened
   - Then bold text appears bold, italic text appears italic, and inline code appears in a monospace styled span

2. **Fenced Code Blocks Render**
   - Given a task file containing a fenced code block (triple backticks)
   - When the task detail dialog is opened
   - Then the code block renders in a styled preformatted block with appropriate background and monospace font

3. **Nested Lists Render**
   - Given a task file containing nested bullet or numbered lists
   - When the task detail dialog is opened
   - Then nested list items render with proper indentation and list markers

4. **Links Render as Clickable**
   - Given a task file containing `[link text](url)` markdown links
   - When the task detail dialog is opened
   - Then the links render as clickable anchor elements

5. **Existing Dialog Chrome Unchanged**
   - Given the task detail dialog is opened for any task
   - When viewing the dialog
   - Then the header (title, status badge), label/metadata bar, footer buttons, and loading/error states remain visually and functionally identical to the current implementation

6. **Frontmatter and Title Not Rendered**
   - Given any task file with YAML frontmatter and a `# Task:` title
   - When the task detail dialog is opened
   - Then neither the frontmatter nor the duplicate title line appear in the rendered body

## Metadata
- **Complexity**: Medium
- **Labels**: feature, desktop, ui
