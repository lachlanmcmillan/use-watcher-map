# use-watcher-map

Control re-renders in React with ease. `use-watcher-map` uses path-based subscriptions to ensure components re-render only when relevant data changes.

[Live Demo](https://lachlanmcmillan.github.io/use-watcher-map/)

## Installation

```bash
npm install use-watcher-map
```

Peer dependencies: `react >= 19.0.0`, `react-dom >= 19.0.0`

## Quick Start

```tsx
import { useWatcherMap, WatcherMap } from 'use-watcher-map';

interface FormState {
  user: { name: string; email: string };
  submitted: boolean;
}

function Form() {
  const watcher = useWatcherMap<FormState>({
    user: { name: '', email: '' },
    submitted: false,
  });

  return (
    <>
      <NameInput watcher={watcher} />
      <SubmitButton watcher={watcher} />
    </>
  );
}

// Only re-renders when user.name changes
function NameInput({ watcher }: { watcher: WatcherMap<FormState> }) {
  const name = watcher.usePath('user.name');
  return (
    <input
      value={name}
      onChange={(e) => watcher.setPath('user.name', e.target.value)}
    />
  );
}

// Only re-renders when submitted changes
function SubmitButton({ watcher }: { watcher: WatcherMap<FormState> }) {
  const submitted = watcher.usePath('submitted');
  return <button disabled={submitted}>Submit</button>;
}
```

## API Reference

### `useWatcherMap<T>(initialState): WatcherMap<T>`

React hook for managing nested object state with path-based subscriptions. Create it in a parent component and pass the watcher object to children.

#### Methods

| Method | Description |
|--------|-------------|
| `getState()` | Get the entire state object |
| `getPath(path)` | Get value at a specific path |
| `setState(data)` | Replace the entire state (notifies all subscribers) |
| `setPath(path, value)` | Update a specific path (notifies only affected subscribers) |
| `clearPath(path, removeEmptyObjects?)` | Delete a value at a path |
| `batch(fn)` | Group multiple `setPath` calls, notify subscribers once |
| `useState()` | React hook — re-renders when any state changes |
| `usePath(path)` | React hook — re-renders only when the specified path changes |
| `watchState(fn)` | Side-effect listener for any state change (useEffect-based) |
| `watchPath(path, fn)` | Side-effect listener for a specific path (useEffect-based) |

---

### `useWatcher<T>(initialValue): WatcherPrimitive<T>`

React hook for a single primitive or simple value. Lighter alternative to `useWatcherMap` when you don't need path-based subscriptions.

```tsx
import { useWatcher, WatcherPrimitive } from 'use-watcher-map';

function Parent() {
  const isLoading = useWatcher(false);
  return <Child isLoading={isLoading} />;
}

function Child({ isLoading }: { isLoading: WatcherPrimitive<boolean> }) {
  const loading = isLoading.useState();
  return <span>{loading ? 'Loading...' : 'Done'}</span>;
}
```

#### Methods

| Method | Description |
|--------|-------------|
| `getState()` | Get the current value |
| `setState(value)` | Set the value and notify subscribers |
| `useState()` | React hook — re-renders when the value changes |
| `watchState(fn)` | Side-effect listener (useEffect-based) |

---

### `watcherStore<T>(initialState): WatcherStore<T>`

Module-level store — **not a React hook**. Create it outside of components for global/shared state. Has the same API as `useWatcherMap` plus lifecycle hooks.

```tsx
// store.ts
import { watcherStore } from 'use-watcher-map';

interface AppState {
  user: { name: string } | null;
  theme: 'light' | 'dark';
}

export const appStore = watcherStore<AppState>({
  user: null,
  theme: 'light',
});

// Optional: runs when first subscriber mounts, cleanup on last unmount
appStore.onMount(() => {
  console.log('Store mounted');
  return () => console.log('Store unmounted');
});
```

```tsx
// Component.tsx
import { appStore } from './store';

function ThemeToggle() {
  const theme = appStore.usePath('theme');
  return (
    <button onClick={() => appStore.setPath('theme', theme === 'light' ? 'dark' : 'light')}>
      {theme}
    </button>
  );
}
```

#### Additional Methods (beyond WatcherMap)

| Method | Description |
|--------|-------------|
| `onMount(fn)` | Called when first subscriber mounts. Return a cleanup function for unmount. |

---

## Path System

Paths use dot-notation strings to reference nested values: `"user.name"`, `"todos.0.completed"`, `"settings.theme"`.

The `PathOf<T>` utility type generates all valid paths as a string union, giving you full TypeScript autocomplete and compile-time validation:

```typescript
interface State {
  user: { name: string; address: { city: string } };
  todos: { text: string; done: boolean }[];
}

// PathOf<State> includes:
// "user" | "user.name" | "user.address" | "user.address.city" | "todos" | ...
```

`TypeAtPath<T, P>` infers the correct type at any path, so `setPath` is fully type-safe.

---

## Key Patterns

### Batching updates

Use `batch()` to group multiple updates and notify subscribers only once:

```tsx
watcher.batch(() => {
  watcher.setPath('user.name', 'Alice');
  watcher.setPath('user.email', 'alice@example.com');
});
// Subscribers notified once with both changes
```

### Side-effect watchers

`watchPath` and `watchState` run side-effects when values change. They use `useEffect` internally for proper cleanup:

```tsx
function Logger({ watcher }: { watcher: WatcherMap<State> }) {
  watcher.watchPath('user.name', (name) => {
    console.log('Name changed to:', name);
  });
  return null;
}
```

---

## When to Use What

| | `useWatcherMap` | `useWatcher` | `watcherStore` |
|---|---|---|---|
| **Use for** | Nested objects | Primitives / simple values | Global shared state |
| **Created in** | React component | React component | Module scope |
| **Path subscriptions** | Yes | No | Yes |
| **Lifecycle hooks** | No | No | `onMount` |

---

## Utility Types

```typescript
import type { PathOf, TypeAtPath, WatcherMap, WatcherPrimitive, WatcherStore } from 'use-watcher-map';
```

| Type | Description |
|------|-------------|
| `PathOf<T>` | Union of all valid dot-notation paths for type `T` |
| `TypeAtPath<T, P>` | The type of the value at path `P` in type `T` |
| `WatcherMap<T>` | Return type of `useWatcherMap` |
| `WatcherPrimitive<T>` | Return type of `useWatcher` |
| `WatcherStore<T>` | Return type of `watcherStore` |

---

## Example App

This repository includes an interactive example app in `example/` demonstrating:

- **Simple**: Basic usage with counters
- **SubPath**: Watching specific nested paths
- **SubPath Arrays**: Handling arrays within watched paths
- **WatcherStore**: Global store usage

```bash
bun install
bun dev
```
