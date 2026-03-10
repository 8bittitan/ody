#!/usr/bin/env sh
set -eu

REPO="8bittitan/ody"

detect_platform() {
  OS=$(uname -s)
  ARCH=$(uname -m)

  case "$OS" in
    Darwin) PLATFORM="darwin" ;;
    Linux)  PLATFORM="linux" ;;
    *)
      printf "Error: Unsupported operating system: %s\n" "$OS" >&2
      exit 1
      ;;
  esac

  case "$ARCH" in
    x86_64 | amd64) ARCH="x64" ;;
    arm64 | aarch64) ARCH="arm64" ;;
    *)
      printf "Error: Unsupported architecture: %s\n" "$ARCH" >&2
      exit 1
      ;;
  esac
}

main() {
  detect_platform

  INSTALL_DIR="${ODY_INSTALL_DIR:-$HOME/.local/bin}"
  BINARY_NAME="ody-${PLATFORM}-${ARCH}"
  TMP_FILE="${INSTALL_DIR}/ody.tmp.$$"

  # Clean up temp file on failure
  trap 'rm -f "$TMP_FILE" 2>/dev/null' EXIT

  printf "Detecting platform: %s %s\n" "$PLATFORM" "$ARCH"

  # Fetch latest release tag
  TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')

  if [ -z "$TAG" ]; then
    printf "Error: Could not determine the latest release tag.\n" >&2
    exit 1
  fi

  printf "Latest release: %s\n" "$TAG"

  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/${BINARY_NAME}"

  printf "Downloading %s...\n" "$DOWNLOAD_URL"

  # Ensure install directory exists
  mkdir -p "$INSTALL_DIR"

  # Download to a temp file, then atomically replace the target.
  # Writing directly to the running binary corrupts it on macOS
  # (code-signature invalidation causes SIGKILL).
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP_FILE"
  chmod +x "$TMP_FILE"
  mv -f "$TMP_FILE" "${INSTALL_DIR}/ody"

  printf "Installed ody to %s/ody\n" "$INSTALL_DIR"

  # PATH warning
  case ":$PATH:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      printf "\nWarning: %s is not in your PATH.\n" "$INSTALL_DIR"
      printf "Add it by running:\n\n"
      printf "  export PATH=\"%s:\$PATH\"\n\n" "$INSTALL_DIR"
      printf "You may want to add this to your shell profile (~/.bashrc, ~/.zshrc, etc.).\n"
      ;;
  esac
}

main
