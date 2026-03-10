---
status: completed
created: 2026-03-09
started: 2026-03-09
completed: 2026-03-09
---

# Task: Improve Task Detail Dialog Body Text Readability

## Description
The body text in the task detail dialog is hard to read in dark mode. The combination of `text-mid` color (`#9496ac`) and `text-xs` (12px) font size produces low-contrast, small text that strains readability for the content-heavy markdown view. Bump the color to `text-light` and the size to `text-sm` so the dialog content is comfortable to read.

## Background
The `TaskDetailDialog` component renders task markdown through a `MARKDOWN_COMPONENTS` map that overrides each HTML element with styled React components. Body-level elements (`p`, `ul`, `ol`, `li`, `em`, `blockquote`, `td`) currently use `text-mid text-xs`. Headings and bold text already use `text-light` at larger/bolder weights, so promoting body text to `text-light text-sm` will improve legibility without conflicting with the heading hierarchy.

## Technical Requirements
1. In `MARKDOWN_COMPONENTS` inside `packages/desktop/src/renderer/components/TaskDetailDialog.tsx`, change the text color class from `text-mid` to `text-light` for these elements: `p`, `ul`, `ol`, `li`, `em`, `td`.
2. In the same map, change the font size class from `text-xs` to `text-sm` for these elements: `p`, `ul`, `ol`, `pre`, `td`, `th`, and `blockquote`.
3. Leave headings (`h1`–`h4`), `strong`, `a`, and inline `code` unchanged — they already have appropriate styling.
4. Ensure `blockquote` text color stays `text-dim` (it is intentionally de-emphasized) but gets the size bump to `text-sm`.
5. Table headers (`th`) should keep `text-light` and get the size bump to `text-sm`.

## Dependencies
- None. This is a self-contained styling change in a single component file.

## Implementation Approach
1. Open `packages/desktop/src/renderer/components/TaskDetailDialog.tsx`.
2. Locate the `MARKDOWN_COMPONENTS` object (around line 75).
3. For each element listed in the requirements, update the Tailwind class strings:
   - Replace `text-mid` → `text-light` (for `p`, `ul`, `ol`, `li`, `em`, `td`).
   - Replace `text-xs` → `text-sm` (for `p`, `ul`, `ol`, `pre`, `td`, `th`, `blockquote`).
4. Visually verify in the desktop app that the dialog body text is noticeably more legible, heading hierarchy is preserved, and blockquotes still appear de-emphasized.

## Acceptance Criteria

1. **Body text has higher contrast**
   - Given the task detail dialog is open in dark mode
   - When viewing paragraph, list, and table cell text
   - Then the text color is `text-light` (`#c4c6d6`) instead of `text-mid` (`#9496ac`)

2. **Body text is larger**
   - Given the task detail dialog is open
   - When viewing paragraph, list, blockquote, pre, and table text
   - Then the font size is `text-sm` (14px) instead of `text-xs` (12px)

3. **Heading hierarchy is preserved**
   - Given the task detail dialog renders markdown with h1–h4 headings
   - When comparing headings to body text
   - Then headings remain visually distinct through larger size and/or bolder weight

4. **Blockquotes remain de-emphasized**
   - Given the markdown contains a blockquote
   - When viewing the rendered blockquote in the dialog
   - Then its text color is still `text-dim`, only its font size increases

5. **No regressions in other elements**
   - Given the dialog renders inline code, links, bold, and italic text
   - When inspecting these elements
   - Then inline code still uses `text-primary`, links still use `text-primary`, bold still uses `text-light font-semibold`, and italic uses the updated `text-light`

## Metadata
- **Complexity**: Low
- **Labels**: desktop, ui, readability
