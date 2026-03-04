# use-watcher-map

React state management with path-based subscriptions for fine-grained re-renders.
v5.0.0 | React 19 peer dependency | TypeScript-first | Zero runtime dependencies.

## Architecture

- `src/useWatcherMap.tsx` — Main React hook for nested object state → `WatcherMap<T>`
- `src/useWatcherPrimitive.tsx` — React hook for primitives, exported as `useWatcher` → `WatcherPrimitive<T>`
- `src/watcherStore.tsx` — Module-level store (not a hook) for global state → `WatcherStore<T>`
- `src/watcherBase.ts` — Shared `WatcherBase<T>` interface (getPath, setPath, usePath, watchPath, batch, etc.)
- `src/object.ts` — Deep get/set/delete utilities with structural sharing (immutable updates)
- `src/pathOf.ts` — `PathOf<T>` and `TypeAtPath<T, P>` utility types for type-safe paths
- `src/index.ts` — Public API barrel export

## Key Concepts

- Paths are dot-notation strings: `"user.name"`, `"todos.0.completed"`
- `usePath(path)` subscribes a component to ONE path — re-renders only when that path changes
- `useState()` subscribes to the entire state — re-renders on any change
- `watchPath(path, fn)` / `watchState(fn)` are for side-effects (useEffect-based), not rendering
- `batch(() => { ... })` groups multiple `setPath` calls, notifies subscribers once at the end
- `watcherStore` is created at module level (outside components); `useWatcherMap` is a hook (inside components)
- All state updates are immutable (structural sharing via `setDeepPathClone`)
- Uses `useSyncExternalStore` internally for React integration

## Dev Commands

- `bun test` — run tests
- `bun run build` — compile TypeScript to dist/
- `bun dev` — run example app (Vite)
- `bun run format` — run Prettier

## Tests

- `test/useWatcherMap.test.tsx` — useWatcherMap hook tests
- `test/useWatcher.test.tsx` — useWatcher (primitive) tests
- `test/watcherStore.test.tsx` — watcherStore tests
- `test/object.test.ts` — deep path utility tests
- Uses Bun test runner + @testing-library/react + jsdom

## Conventions

- Bun as package manager and test runner
- ESM only (`"type": "module"`)
- Strict TypeScript
- No external runtime dependencies
