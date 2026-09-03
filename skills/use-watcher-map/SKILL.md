---
name: use-watcher-map
description: >-
  Guides correct use of the use-watcher-map React state library (path-based
  subscriptions, fine-grained re-renders). Use when writing or editing React
  code that imports use-watcher-map, or when the user mentions WatcherMap,
  WatcherStore, WatcherComputed, useWatcherMap, useWatcher, watcherStore,
  useComputed, computedStore, usePath, setPath, or path subscriptions.
license: MIT
metadata:
  package: use-watcher-map
  version: 6.0.0-beta.5
---

# use-watcher-map

React state with **path-based subscriptions**. Components re-render only for the paths they subscribe to. Peer: React 19. Zero runtime deps. Import from `use-watcher-map`.

Prefix watcher instances with `$` so they are not confused with values:

```tsx
const $form = useWatcherMap<FormState>({ user: { name: '' } });
const name = $form.usePath('user.name'); // value — this component re-renders
$form.setPath('user.name', 'Ada'); // update — call from handlers, not during render
```

## Pick an API

| Need                             | Create with              | Where        | Paths     |
| -------------------------------- | ------------------------ | ------------ | --------- |
| Nested object, local to a tree   | `useWatcherMap(initial)` | Component    | yes       |
| One primitive / flag             | `useWatcher(initial)`    | Component    | no        |
| Nested object, shared / global   | `watcherStore(initial)`  | Module scope | yes       |
| Derived value inside a component | `useComputed(dep, fn)`   | Component    | read-only |
| Derived value from a store       | `computedStore(dep, fn)` | Module scope | read-only |

`useWatcherMap` / `useWatcher` / `useComputed` are hooks. `watcherStore` / `computedStore` are **not** hooks — never call them inside a component.

## Hard rules

1. **Pass the `$watcher`, not the value.** Children call `usePath` / `useState` themselves. Subscribing in a parent and passing the value down re-renders the parent and every sibling.
2. **`usePath` / `useState` / `watchPath` / `watchState` are hooks.** Call them unconditionally in a React function component. `getPath` / `getState` / `setPath` / `setState` / `clearPath` / `batch` are not hooks — use those in event handlers, effects, and module-level actions.
3. **Do not mutate snapshots.** `getState()`, `getPath()`, `useState()`, and `usePath()` return current data. Clone, then `setPath` / `setState`.
4. **Prefer `setPath` over `setState`.** `setState` replaces the whole tree and notifies every subscriber. Use `setState` only for full resets.
5. **`watchPath` / `watchState` are side-effects only** (they wrap `useEffect`). Do not use them to drive UI. Do not `setPath` / `setState` inside them without a stop condition — easy infinite loop. Prefer `useComputed` / `computedStore` for derived data.
6. **Never call `__addSubscriber__`, `__removeSubscriber__`, or `__type__`.** Internal.
7. **Initial state is initial only.** Changing the object passed to `useWatcherMap` / `watcherStore` on a later render does not update stored state. Keep a constant and reset with `setState(initial)`.
8. **Do not nest `batch()`.** Throws.

## Subscribe vs read vs write

| Goal                                | API                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| Render one field                    | `$w.usePath('user.name')`                                                           |
| Render the whole object             | `$w.useState()` — avoid except debug / small roots                                  |
| Read in a handler (no subscription) | `$w.getPath('user.name')` / `$w.getState()`                                         |
| Write one field                     | `$w.setPath('user.name', value)`                                                    |
| Write several fields, one notify    | `$w.batch(() => { $w.setPath(...); $w.setPath(...); })`                             |
| Delete                              | `$w.clearPath('user.temp')` — second arg `true` also removes emptied parent objects |
| Side-effect                         | `$w.watchPath('user.name', fn)`                                                     |

Paths are dot-notation: `'user.name'`, `'todos.0.completed'`. Type them with `PathOf<T>` / `TypeAtPath<T, P>` — always generic the store (`useWatcherMap<State>(...)`) so paths autocomplete.

Parent and child paths notify each other: `usePath('todos')` re-renders when `todos.0.completed` changes; `usePath('todos.0.completed')` re-renders when `todos` is replaced.

## Component pattern

Create once in a parent (or import a module store). Split UI so each component subscribes to the smallest path it displays.

```tsx
import { useWatcherMap, type WatcherMap } from 'use-watcher-map';

interface FormState {
  user: { name: string; email: string };
  submitted: boolean;
}

function Form() {
  const $form = useWatcherMap<FormState>({
    user: { name: '', email: '' },
    submitted: false,
  });
  return (
    <>
      <NameInput $form={$form} />
      <SubmitButton $form={$form} />
    </>
  );
}

function NameInput({ $form }: { $form: WatcherMap<FormState> }) {
  const name = $form.usePath('user.name');
  return (
    <input
      value={name}
      onChange={e => $form.setPath('user.name', e.target.value)}
    />
  );
}

function SubmitButton({ $form }: { $form: WatcherMap<FormState> }) {
  const submitted = $form.usePath('submitted');
  return <button disabled={submitted}>Submit</button>;
}
```

## Module store pattern

```tsx
// store.ts — not a hook
import { watcherStore, computedStore } from 'use-watcher-map';

export const $app = watcherStore<AppState>({
  theme: 'light',
  items: [],
  home: { banner: null },
  users: {},
  events: { upcoming: [] },
});

export const $veg = computedStore(
  { watcher: $app, path: 'items' },
  (items: Item[]) => items.filter(i => i.type === 'veg')
);

$app.onMount(() => {
  const id = window.setInterval(() => {}, 60_000);
  return () => window.clearInterval(id);
});

$app.onMountPath(path => {
  fetchUser(path);
  return () => abortUserFetch(path);
});

// ThemeToggle.tsx
const theme = $app.usePath('theme');
```

`onMount` and `onMountPath` exist only on `WatcherStore`. `onMount(fn)` runs when the first _component_ subscriber mounts (`usePath` / `useState` / `watchPath` / `watchState`), and the returned cleanup runs when the last one unmounts. `onMountPath(fn)` runs when any path is first subscribed to (`usePath` / `watchPath`); `fn` receives that path so you can fetch just that record (e.g. `$store.usePath(itemId)`). Each path has its own mount/unmount lifecycle. Only one callback is kept for `onMount` and one for `onMountPath` (later calls replace it). `computedStore` subscriptions do not count as mounts.

## Computed

Read-only. No `setPath` / `setState`.

**`useComputed` (hook)** deps: a watcher, `{ watcher, path }`, a primitive, or an **array** of those. Array → `computeFn` receives a values array.

**`computedStore` (module)** deps: `WatcherStore`, `WatcherComputed`, another `computedStore`, `{ watcher, path }`, or an array of those. Not `WatcherMap` / `useWatcher`.

Path dependency shape is an object, **not a tuple**:

```tsx
// correct
useComputed({ watcher: $app, path: 'items' }, (items, prev) => ...)

// wrong (removed in v6)
useComputed([$app, 'items'], ...)
```

Updates are skipped when the new result is **shallow-equal** to the previous (`isShallowEqual`: top-level key/index `Object.is`). `['a']` vs `['a']` is equal; `[{ a: 1 }]` vs `[{ a: 1 }]` is not (different object refs). To skip deeper changes, return `prev`:

```tsx
const $names = useComputed({ watcher: $app, path: 'items' }, (items, prev) => {
  const next = [...new Set(items.map(i => i.name))];
  return prev &&
    next.length === prev.length &&
    next.every((n, i) => n === prev[i])
    ? prev
    : next;
});
```

Do not `setState` from inside `computeFn`.

## Arrays

Index paths are strings: `'todos.0.completed'`. After delete/reorder, indices shift — replace the whole array for those operations. Dynamic segments type as `string`; cast (`as PathOf<State>`) or use a literal `` `todos.${0}.text` as const `` when needed.

```tsx
$w.setPath('todos', [...$w.getPath('todos'), newTodo]);
$w.setPath(`todos.${index}.completed`, true);
$w.setPath(
  'todos',
  $w.getPath('todos').filter((_, i) => i !== index)
);
```

## Do not

- Recreate `watcherStore` / `computedStore` inside render.
- Wrap `usePath` in a plain function used from non-components. If you wrap it, the wrapper must be a hook (`useCurrentUser`).
- Subscribe at a Context provider with `useState()` and pass values down. If you use Context, put the `$watcher` in context; consumers still call `usePath`.
- Spread or clone the watcher object. Pass the same reference.
- Import internals from `use-watcher-map/src/...` in app code.

## Additional resources

- Method tables and types: [references/api.md](references/api.md)
- Copy-paste recipes: [references/patterns.md](references/patterns.md)
