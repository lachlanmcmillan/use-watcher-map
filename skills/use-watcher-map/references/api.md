# API reference

Package: `use-watcher-map`. Peer: `react` / `react-dom` `>= 19`.

## Exports

```ts
import {
  useWatcherMap,
  useWatcher,
  watcherStore,
  useComputed,
  computedStore,
  getDeepPath,
  setDeepPathClone,
  deleteDeepPathClone,
  isShallowEqual,
} from 'use-watcher-map';

import type {
  WatcherMap,
  WatcherPrimitive,
  WatcherStore,
  WatcherComputed,
  PathOf,
  TypeAtPath,
  ComputedStoreDependency,
} from 'use-watcher-map';
```

`useWatcher` is the public name of `useWatcherPrimitive`.

## `useWatcherMap<T>(initial): WatcherMap<T>`

Hook. `T` must be an object. Returned API object is referentially stable.

| Method                                 | Hook? | Role                                                                           |
| -------------------------------------- | ----- | ------------------------------------------------------------------------------ |
| `getState()`                           | no    | Whole snapshot                                                                 |
| `getPath(path)`                        | no    | Snapshot at path                                                               |
| `setState(data)`                       | no    | Replace all; notifies every subscriber                                         |
| `setPath(path, value)`                 | no    | Immutable update (structural sharing); notifies that path and parents/children |
| `clearPath(path, removeEmptyObjects?)` | no    | Delete at path                                                                 |
| `batch(fn)`                            | no    | Coalesce notifies; cannot nest                                                 |
| `useState()`                           | yes   | Re-render on any change                                                        |
| `usePath(path)`                        | yes   | Re-render when that path (or parent/child) changes                             |
| `watchState(fn)`                       | yes   | Side-effect on any change                                                      |
| `watchPath(path, fn)`                  | yes   | Side-effect on path change                                                     |

## `useWatcher<T>(initial): WatcherPrimitive<T>`

Hook for one value. No paths.

| Method                           | Hook? |
| -------------------------------- | ----- |
| `getState()` / `setState(value)` | no    |
| `useState()` / `watchState(fn)`  | yes   |

## `watcherStore<T>(initial): WatcherStore<T>`

Module-level. Same methods as `WatcherMap`, plus:

| Method            | Role                                                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onMount(fn)`     | First component subscriber mounts. Return cleanup for last unmount. Later `onMount` calls replace the previous fn.                                                                      |
| `onMountPath(fn)` | First subscriber to any path mounts (`usePath` / `watchPath`). `fn` receives the path. Return cleanup for last unmount of that path. Later `onMountPath` calls replace the previous fn. |

## `useComputed(dep, computeFn): WatcherComputed<T>`

Hook. Read-only (`getState`, `getPath`, `useState`, `usePath`, `watchState`, `watchPath`).

`computeFn(value, prev?)` — `prev` is `undefined` on the first run. Returning `prev` skips notify (ref equality).

Otherwise skips when `isShallowEqual(prev, next)` is true.

### Dependency shapes

- Watcher: `WatcherMap` / `WatcherStore` / `WatcherPrimitive` / `WatcherComputed`
- Path: `{ watcher, path }` (`path` is a string)
- Primitive / plain value (recomputes when the identity passed as `dep` changes)
- Array of the above — `computeFn` receives `value[]` in order

## `computedStore(dep, computeFn)`

Not a hook. Same read API as `WatcherComputed`.

Deps: `WatcherStore` | `WatcherComputed` | another computed store | `{ watcher, path }` | array of those. **Not** `WatcherMap` or `WatcherPrimitive`.

Lazy: `getState` / `getPath` compute without subscribing. `useState` / `usePath` / `watch*` subscribe only while mounted, and unsubscribe from deps when the last subscriber leaves.

## Path types

```ts
type PathOf<T> = /* union of "a" | "a.b" | "items.0.name" | ... */;
type TypeAtPath<T, P extends string> = /* value type at P */;
```

Arrays use numeric segments: `'todos.0.text'`. Optional / nullable objects still generate child paths (`'user.name'` is valid even if `user` is `T | null`).

## `isShallowEqual(a, b)`

`Object.is` for primitives. For objects/arrays: same keys, each value `Object.is` (one level). Exported for tests and for matching computed skip behavior.
