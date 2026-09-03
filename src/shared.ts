import { getDeepPath } from './object';

export const WatcherType = {
  WatcherStore: 'WatcherStore',
  WatcherMap: 'WatcherMap',
  WatcherPrimitive: 'WatcherPrimitive',
  WatcherComputed: 'WatcherComputed',
  ComputedStore: 'ComputedStore',
} as const;

export type WatcherType = (typeof WatcherType)[keyof typeof WatcherType];

const watcherTypes = new Set<string>(Object.values(WatcherType));

export const isWatcherType = (value: unknown): value is WatcherType => {
  return typeof value === 'string' && watcherTypes.has(value);
};

type WatcherDependencyTarget = {
  getState: () => any;
  __addSubscriber__: (
    fn: Function,
    path?: any,
    opts?: { skipMountTracking?: boolean }
  ) => void;
  __removeSubscriber__: (fn: Function, path?: any) => void;
  onMount?: unknown;
  __type__: WatcherType;
};

export type PathSubscription = {
  watcher: WatcherDependencyTarget & { getPath: (path: any) => any };
  path: string;
};

export type WatcherDependency = WatcherDependencyTarget | PathSubscription;

export type Dependency =
  | WatcherDependency
  | string
  | number
  | boolean
  | bigint
  | symbol
  | object
  | null
  | undefined;

export const isPathSubscription = (
  dependency: Dependency
): dependency is PathSubscription => {
  return (
    typeof dependency === 'object' &&
    dependency !== null &&
    Object.keys(dependency).length === 2 &&
    'watcher' in dependency &&
    'path' in dependency
  );
};

export const isWatcherDependency = (
  dependency: Dependency
): dependency is WatcherDependencyTarget => {
  return (
    typeof dependency === 'object' &&
    dependency !== null &&
    '__type__' in dependency &&
    isWatcherType(dependency.__type__)
  );
};

export const getDependencyValue = (
  dependency: Dependency | Dependency[]
): any | any[] => {
  if (Array.isArray(dependency)) {
    return dependency.map(d => getDependencyValue(d));
  }

  if (isPathSubscription(dependency)) {
    return dependency.watcher.getPath(dependency.path);
  }

  if (isWatcherDependency(dependency)) {
    return dependency.getState();
  }

  // ASSUME PRIMITIVE
  return dependency;
};

export const subscribeToDependency = (
  dependency: Dependency | Dependency[],
  fn: (value: any) => void
) => {
  if (Array.isArray(dependency)) {
    let unsubscribers = [];
    for (const d of dependency) {
      unsubscribers.push(subscribeToDependency(d, fn));
    }
    return () => {
      for (const unsubscriber of unsubscribers) {
        unsubscriber();
      }
    };
  }

  if (isPathSubscription(dependency)) {
    const target = dependency.watcher;
    target.__addSubscriber__(fn, dependency.path as never, {
      skipMountTracking: true,
    });
    // remove only this path's subscription. the same fn may also be
    // subscribed to other paths on the same watcher.
    return () => target.__removeSubscriber__(fn, dependency.path);
  }

  if (isWatcherDependency(dependency)) {
    const target = dependency;
    if (target.__type__ === WatcherType.WatcherStore) {
      target.__addSubscriber__(fn, undefined, { skipMountTracking: true });
    } else {
      target.__addSubscriber__(fn);
    }
    return () => target.__removeSubscriber__(fn);
  }

  // ASSUME PRIMITIVE
  return () => {};
};

/**
 * Expands path subscriptions into their watcher and path so React compares
 * those values instead of the path subscription wrapper's reference.
 */
export const getExpandedDependencies = (
  dependency: Dependency | Dependency[]
): Dependency[] => {
  const dependencies = Array.isArray(dependency) ? dependency : [dependency];
  const expandedDependencies: Dependency[] = [];

  for (const dependency of dependencies) {
    if (isPathSubscription(dependency)) {
      expandedDependencies.push(dependency.watcher, dependency.path);
    } else {
      expandedDependencies.push(dependency);
    }
  }

  return expandedDependencies;
};

/**
 * The top-level paths to notify when the whole state is replaced: every key
 * in the old state and every key in the new one. Including the old keys is
 * what lets a subscriber of a removed key learn it is now `undefined`.
 *
 * Non-object states (primitives, null, undefined) contribute no keys.
 *
 * @example
 * getReplacedStatePaths({ a: 1, b: 2 }, { a: 1 })       // ['a', 'b']
 * getReplacedStatePaths({ a: 1 }, { a: 1, c: 3 })       // ['a', 'c']
 * getReplacedStatePaths(undefined, { a: 1 })            // ['a']
 * getReplacedStatePaths(5, 6)                           // []
 */
export const getReplacedStatePaths = (
  previous: unknown,
  next: unknown
): string[] => {
  const paths = new Set<string>();
  for (const key of Object.keys(Object(previous))) {
    paths.add(key);
  }
  for (const key of Object.keys(Object(next))) {
    paths.add(key);
  }
  return [...paths];
};

/**
 * Does `ancestor` contain `path`? Segments are compared whole, so a path is
 * only inside another when every dot-separated part matches, not when the
 * strings happen to share a prefix.
 *
 * @example
 * isPathWithin('todos', 'todos')              // true  — same path
 * isPathWithin('todos.0', 'todos')            // true  — direct child
 * isPathWithin('todos.0.tags.1', 'todos')     // true  — deeper descendant
 * isPathWithin('todos', 'todos.0')            // false — parent, not child
 * isPathWithin('todos.10', 'todos.1')         // false — sibling, "1" vs "10"
 * isPathWithin('username', 'user')            // false — sibling, "user" vs "username"
 * isPathWithin('todos.0.done', 'todos.0.text')// false — unrelated leaves
 */
export const isPathWithin = (path: string, ancestor: string) =>
  path === ancestor || path.startsWith(ancestor + '.');

/**
 * each path that's being updated should be a full path, not parts
 *
 * ✅ - ["todos.0.completed"]
 * ❌ - ["todos", "todos.0", "todos.0.completed"]
 */
export const notifyPathSubscribers = <T>(
  subscribers: Iterable<{ path?: string; fn: Function }>,
  value: T,
  paths: string[]
) => {
  // each subscriber should only be called once
  for (const subscriber of subscribers) {
    // If the subscriber is watching a specific path (as opposed to the entire state)
    if (subscriber.path) {
      for (const notifyPath of paths) {
        // first, check for exact and child matches
        // eg. notifyPath = "todos.0.tags"
        // we notify subscribers of exact matches "todos.0.tags", and sub-paths
        // "todos.0.tags.0", "todos.0.tags.1", etc. but not siblings
        // "todos.0.completed"
        const childPathMatch = isPathWithin(subscriber.path, notifyPath);

        if (childPathMatch) {
          const pathValue = getDeepPath(value, subscriber.path.split('.'));
          subscriber.fn(pathValue);
          // we've notified this subscriber, so we can skip the rest of the paths
          break;
        }

        // check for parent matches
        // eg. notifyPath = "todos.0.tags"
        // we notify subscribers of exact matches "todos.0.tags", and parents
        // "todos.0", "todos"
        const parentPathMatch = isPathWithin(notifyPath, subscriber.path);

        if (parentPathMatch) {
          const pathValue = getDeepPath(value, subscriber.path.split('.'));
          subscriber.fn(pathValue);
          break;
        }
      }
    } else {
      // If the subscriber is watching the entire state, then notify the
      // subscriber with the complete state object
      subscriber.fn(value);
    }
  }
};
