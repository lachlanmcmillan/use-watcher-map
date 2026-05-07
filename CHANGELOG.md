# CHANGELOG

## 6.0.0-beta.2

- **Fix** `usePath` causing repeated `onMount` / `onUnmount` calls

  `subscribePathFactory` and `getPathFactory` returned a fresh function on every
  render, so `useSyncExternalStore` saw a new `subscribe` reference each commit
  and resubscribed every time. With path-tracked subscribers, the resulting
  1 → 0 → 1 transitions fired `onMount` / `onUnmount` repeatedly. Both factories
  now cache their function per path so the identity is stable across renders.

  Tests added: `usePath re-renders do not churn onMount/onUnmount` and
  `two consumers on the same path are tracked independently`.

- **Fix** `__addSubscriber__` type — `skipMountTracking` opts only on `WatcherStore`.

## 6.0.0-beta.1

- **Add** `useComputed`

  `useComputed` creates a read-only derived watcher from a watcher dependency.
  It can subscribe to an entire watcher or a specific path tuple, recalculates
  when that dependency changes, and skips notifying subscribers when the derived
  value is shallow-equal to the previous value.

  ```typescript
  const vegetables = useComputed([allItems, 'items'], items =>
    items.filter(item => item.type === 'vegetables')
  );

  const hasVegetables = useComputed([allItems, 'items'], items =>
    items.some(item => item.type === 'vegetables')
  );
  ```

## 5.2.0

- **Add** `skipMountTracking` option to `watcherStore.__addSubscriber__`

  Internal subscribers can now opt out of `onMount` / `onUnmount` lifecycle
  tracking by passing `{ skipMountTracking: true }`. These subscribers still
  receive state/path updates, but they no longer cause the store to mount or keep
  it mounted.


## 5.1.0

- **Rewrite README** with full API reference, code examples, quick start guide, and comparison table
- **Add CLAUDE.md** for AI agent context (architecture, key patterns, dev commands)
- **Add llms.txt** for LLM tool consumption following the llmstxt.org convention
- **Add JSDoc** with `@example` tags to all exported functions (`useWatcherMap`, `useWatcher`, `watcherStore`)
- **Expand package.json keywords** for better npm discoverability
- **Fix** `useWatcher` test import path

## 5.0.0

- **NEW**: Improved TypeScript path support with `TypeAtPath<T>` type

All path-based methods now know what type is being set or returned!

```typescript
  interface UserState {
    user: {
      name: string;
      address: {
        street: string;
        city: string;
      };
    };
    settings: {
      theme: 'light' | 'dark';
    };
  }

  const store = useWatcherStore<UserState>({
    /* ... */
  });

  // TypeScript autocomplete and validation
  store.getPath('user.name'); // string 
  store.setPath('user.address.city', 'NYC'); // string
  store.usePath('settings.theme'); // 'light' | 'dark'

  // TypeScript errors for invalid paths
  store.setPath('user.name', 12345); // ❌ Error: invalid argument
  store.setPath('user.address.city', true); // ❌ Error: invalid argument
  ```

## 4.0.1

- Fix `clearPath` allowing any string to be cleared.

  Updated the function signature

  ```typescript
  function clearPath(path: PathOf<T>, removeEmptyObjects?: boolean): void;
  ```

## 4.0.0 - Path Typing

- **NEW**: Add comprehensive TypeScript path support with `PathOf<T>` type

  All path-based methods now have full TypeScript autocomplete and type safety! The new `PathOf<T>` type automatically generates all possible nested property paths as string literals from your state type.

  ```typescript
  interface UserState {
    user: {
      name: string;
      address: {
        street: string;
        city: string;
      };
    };
    settings: {
      theme: 'light' | 'dark';
    };
  }

  const store = useWatcherStore<UserState>({
    /* ... */
  });

  // TypeScript autocomplete and validation
  store.getPath('user.name'); // ✅ Valid
  store.setPath('user.address.city', 'NYC'); // ✅ Valid
  store.usePath('settings.theme'); // ✅ Valid

  // TypeScript errors for invalid paths
  store.getPath('user.age'); // ❌ Error: invalid path
  store.setPath('user.address.country', 'US'); // ❌ Error: invalid path
  store.setPath('random', '12345'); // ❌ Error: invalid path
  ```

- **Export `PathOf<T>` type** for advanced use cases

  ```typescript
  import { PathOf } from 'use-watcher-map';

  type MyPaths = PathOf<MyStateType>; // Get all valid paths as a union type
  ```

## 3.0.0 - watcherStore

- **NEW**: Add `watcherStore` - a standalone store that doesn't require React hooks

  The new `watcherStore` provides the same functionality as `useWatcherMap` but works outside of React components. This enables:
  - **Global state management**: Create stores that can be shared across your entire application
  - **Non-React usage**: Use the store in vanilla JavaScript, Node.js, or other frameworks

  ```javascript
  import { watcherStore } from 'use-watcher-map';

  const store = watcherStore({
    user: { name: 'John', age: 30 },
    settings: { theme: 'dark' },
  });

  // Get state
  const user = store.getPath('user.name'); // 'John'

  // Update state
  store.setPath('user.age', 31);

  // Watch for changes within a React component
  store.watchPath('user.name', name => {
    console.log('Name changed:', name);
  });

  // Subscribe to store changes within a React component
  const UserName = () => {
    const name = store.usePath('user.name');

    return <h3>Welcome {name}!</h3>;
  };
  ```

- Add `onMount`/`onUnmount` lifecycle management

  The store supports lifecycle hooks that are called when the first subscriber is added (mount) and when the last subscriber is removed (unmount):

  ```javascript
  store.onMount(() => {
    console.log('Store mounted - first subscriber added');

    // Return cleanup function (optional)
    return () => {
      console.log('Store unmounted - last subscriber removed');
    };
  });
  ```

## 2.1.0

- Improve function comments to work with TS language server
- Change React to a peerDependency

## 2.0.0 - Batching

- Remove `mergePaths()`, add `batch()`

  The function behaviour was inconsistent with other functions and broke the
  mental model. This was a source of bugs in downstream application code.

  For example

  `mergePaths({ "a.b": "example" })`

  would set a path "a.b" (rather than `{ a: { b: "example" } }`), and

  `mergePaths({ a: { b: "example" } })` would overwrite any existing data
  at path "a".

  Instead use the new function `batch` to delay notifying until all sets
  have finished.

  ```javascript
  batch(() => {
    setPath('a.b', 'example-1');
    setPath('a.c', 'example-2');
  });
  ```

## 1.3.0

- Add `useWatcher` hook to more easily work with primitives

## 1.2.0

- `deleteDeepPathClone` implements a `removeEmptyObjects` flag

## 1.1.0

- Add `deleteDeepPathClone` and improve `clearPath`

## 1.0.0

- Initial Release
