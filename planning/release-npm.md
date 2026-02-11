# Release Plan: Adding npm Publishing

This document describes how to add npm package publishing on top of the
existing GitHub Releases pipeline defined in `planning/release.md`. Complete
that plan first before following this one.

## Overview

Publishing `@ody/cli` to npm allows users to install with:

```bash
bun install -g @ody/cli
# or
bunx @ody/cli
```

Since the CLI uses Bun-specific APIs (`Bun.spawn`, `Bun.file`, `Bun.write`),
it requires Bun as the runtime. It will not work with Node.js. The npm package
ships a bundled JS file (not a compiled binary), so users need Bun installed.

## Prerequisites

- The GitHub Releases pipeline from `planning/release.md` is already in place.
- An npm account with access to the `@ody` scope (or the scope matching your
  package name).
- An npm access token with publish permissions and 2FA on auth only (not on
  publish).

## Step 1: Add npm Metadata to package.json

Edit `packages/cli/package.json` to add `publishConfig`:

```jsonc
{
  "publishConfig": {
    "access": "public",
  },
}
```

Also update `.changeset/config.json` — change `access` from `restricted` to
`public`:

```json
{
  "access": "public"
}
```

## Step 2: Add a JS Bundle Build Script

The existing `build` script compiles a native binary. For npm we need a
standard JS bundle with a shebang so it can be executed via `bun`.

Add a `build:npm` script to `packages/cli/package.json`:

```jsonc
{
  "scripts": {
    "build": "bun build --production --compile --outfile=./dist/ody ./src/index.ts",
    "build:npm": "scripts/build-npm.sh",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
  },
}
```

Create `packages/cli/scripts/build-npm.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

OUTFILE="./dist/ody.mjs"

# Bundle to a single JS file targeting Bun
bun build --outfile="$OUTFILE" --target=bun ./src/index.ts

# Prepend shebang
TEMP=$(mktemp)
printf '#!/usr/bin/env bun\n' > "$TEMP"
cat "$OUTFILE" >> "$TEMP"
mv "$TEMP" "$OUTFILE"

chmod +x "$OUTFILE"

echo "Built npm bundle: $OUTFILE"
```

Make it executable:

```bash
chmod +x packages/cli/scripts/build-npm.sh
```

## Step 3: Update the bin Field

For npm publishing, `bin` should point to the JS bundle, not the compiled
binary:

```jsonc
{
  "bin": "./dist/ody.mjs",
}
```

> Note: This changes the `bin` field from `./dist/ody` (compiled binary) to
> `./dist/ody.mjs` (JS bundle). The compiled binary is still produced by the
> `build` script for GitHub Releases but is not included in the npm package.

The `files` field (`["dist"]`) already covers the output directory.

## Step 4: Add the NPM_TOKEN Secret

1. Go to [npmjs.com](https://www.npmjs.com) > Access Tokens > Generate New Token.
2. Choose "Automation" type (bypasses 2FA for CI publishing).
3. Copy the token.
4. In your GitHub repo, go to Settings > Secrets and variables > Actions.
5. Add a new secret named `NPM_TOKEN` with the token value.

## Step 5: Add an npm Publish Step to the Release Workflow

The existing `release.yml` workflow creates a git tag when a release PR is
merged to `main`. Add an npm publish job that runs after the tag is created.

Update `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches:
      - main
    paths:
      - 'packages/cli/package.json'

permissions:
  contents: write

jobs:
  tag:
    name: Tag Release
    runs-on: ubuntu-latest
    if: startsWith(github.event.head_commit.message, 'release: v')
    outputs:
      tagged: ${{ steps.tag.outputs.tagged }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Create and push tag
        id: tag
        run: |
          VERSION=$(jq -r .version packages/cli/package.json)
          TAG="v${VERSION}"

          if git rev-parse "$TAG" >/dev/null 2>&1; then
            echo "Tag $TAG already exists, skipping."
            echo "tagged=false" >> "$GITHUB_OUTPUT"
            exit 0
          fi

          echo "Creating tag $TAG"
          git tag "$TAG"
          git push origin "$TAG"
          echo "tagged=true" >> "$GITHUB_OUTPUT"

  publish-npm:
    name: Publish to npm
    needs: tag
    if: needs.tag.outputs.tagged == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: .tool-versions

      - name: Install dependencies
        run: bun install

      - name: Build npm bundle
        run: bun run build:npm
        working-directory: packages/cli

      - name: Publish
        run: bunx changeset publish
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

The `publish-npm` job only runs when a new tag was actually created. It builds
the JS bundle and publishes to npm via `changeset publish`, which only
publishes packages with a version newer than what is on the registry.

The changesets action will create a `.npmrc` file automatically using the
`NPM_TOKEN` environment variable. If you need a custom `.npmrc`, add a step
before the publish step:

```yaml
- name: Create .npmrc
  run: |
    cat << EOF > "$HOME/.npmrc"
      //registry.npmjs.org/:_authToken=$NPM_TOKEN
    EOF
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Changes Summary

| File                                | Status   | Purpose                                        |
| ----------------------------------- | -------- | ---------------------------------------------- |
| `packages/cli/package.json`         | Modified | Add `publishConfig`, `build:npm`, update `bin` |
| `.changeset/config.json`            | Modified | Change `access` to `public`                    |
| `.github/workflows/release.yml`     | Modified | Add `publish-npm` job with `NPM_TOKEN`         |
| `packages/cli/scripts/build-npm.sh` | Created  | Builds JS bundle with shebang                  |

## How Users Install (After npm Publishing)

```bash
# Via bun (recommended)
bun install -g @ody/cli
ody

# Via bunx (no install)
bunx @ody/cli

# Via binary (unchanged — still works via GitHub Releases)
curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh
```

## Important Notes

- The npm package requires Bun as the runtime. It will **not** work with
  Node.js because the CLI uses Bun-specific APIs (`Bun.spawn`, `Bun.file`,
  `Bun.write`).
- The `bin` field change means local development should still use
  `bun run src/index.ts` (as documented in the README), not the `bin` path.
- `changeset publish` only publishes packages whose version is newer than
  what is currently on npm, so re-running is safe.
- If you later want to support Node.js users, you would need to replace
  Bun-specific APIs with Node equivalents or use a compatibility layer. At
  that point, change the shebang to `#!/usr/bin/env node` and the build
  target to `--target=node`.
