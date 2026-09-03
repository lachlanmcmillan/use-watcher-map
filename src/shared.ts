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
  __removeSubscriber__: (fn: Function) => void;
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
    return () => target.__removeSubscriber__(fn);
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
        const childPathMatch = subscriber.path.startsWith(notifyPath);

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
        const parentPathMatch = notifyPath.startsWith(subscriber.path);

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
