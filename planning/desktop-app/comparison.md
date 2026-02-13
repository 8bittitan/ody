# Electron vs Tauri

Comparison for cross-platform desktop application development.

## Performance & Bundle Size

| Metric       | Electron                               | Tauri                                |
| ------------ | -------------------------------------- | ------------------------------------ |
| Bundle size  | ~150-300 MB (ships Chromium + Node.js) | ~2-10 MB (uses OS webview)           |
| Memory usage | High (~100-300 MB baseline)            | Low (~20-50 MB baseline)             |
| Startup time | Slower (loading Chromium)              | Faster (native process + OS webview) |
| Runtime      | V8 (Node.js)                           | Native (Rust compiled binary)        |

Tauri wins decisively on performance. Electron bundles an entire Chromium instance per app, which is why Slack, VS Code, etc. are memory-hungry.

## Ease of Development

| Aspect              | Electron                         | Tauri                                                 |
| ------------------- | -------------------------------- | ----------------------------------------------------- |
| Language (backend)  | JavaScript/TypeScript (Node.js)  | Rust                                                  |
| Language (frontend) | Any web framework                | Any web framework                                     |
| Learning curve      | Low (JS/TS everywhere)           | Medium-High (must know some Rust)                     |
| Ecosystem maturity  | Very mature (since 2013)         | Younger but growing fast (v1 in 2022, v2 stable 2024) |
| Debugging           | Chrome DevTools + Node debugging | Chrome DevTools + Rust debugging                      |
| Docs & community    | Extensive, large community       | Good docs, smaller but active community               |

Electron wins on developer accessibility - if your team is JS/TS-only, Electron has a much lower barrier. Tauri requires at least basic Rust for backend logic, IPC commands, and plugins.

## Feature Comparison

| Feature             | Electron                           | Tauri                                                                   |
| ------------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| Cross-platform      | Windows, macOS, Linux              | Windows, macOS, Linux (+ iOS, Android in v2)                            |
| Auto-updater        | Built-in                           | Built-in (v1+)                                                          |
| System tray         | Yes                                | Yes                                                                     |
| Native menus        | Yes                                | Yes                                                                     |
| File system access  | Full (Node.js `fs`)                | Scoped, permission-based                                                |
| IPC                 | `ipcMain`/`ipcRenderer`            | Rust commands invoked from JS                                           |
| Webview consistency | 100% consistent (bundled Chromium) | Varies by OS (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux) |
| Native OS APIs      | Via Node.js + native addons        | Via Rust (excellent FFI story)                                          |
| Plugin ecosystem    | npm (massive)                      | Growing plugin system, cargo crates                                     |
| Security model      | Permissive by default              | Strict by default (allowlist, CSP)                                      |
| Mobile support      | No (desktop-only)                  | Yes (Tauri v2)                                                          |

## Key Tradeoffs

### Choose Electron if:

- Your team is all JS/TS and doesn't want to learn Rust
- You need pixel-perfect cross-platform rendering consistency (bundled Chromium)
- You depend heavily on Node.js npm packages with native bindings
- Time-to-market matters more than app size/performance

### Choose Tauri if:

- Bundle size and memory footprint matter (e.g., utility apps, tools)
- You want stronger security defaults out of the box
- You need mobile targets alongside desktop (Tauri v2)
- Your team knows or is willing to learn Rust
- You're building something performance-sensitive

## The Webview Consistency Caveat

This is Tauri's biggest practical gotcha. Since it uses the OS-native webview rather than bundling Chromium, you can hit rendering or API differences between platforms (especially Linux's WebKitGTK, which tends to lag behind). Electron eliminates this class of bugs entirely by shipping its own browser.

## Bottom Line

Electron is the safe, mature choice with the lowest learning curve for web developers. Tauri is the modern, leaner alternative that trades JS backend simplicity for Rust's performance and safety - and is the only option if you also want mobile from the same codebase.
