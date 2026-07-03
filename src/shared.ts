import { getDeepPath } from './object';

type WatcherDependencyTarget = {
  getState: () => any;
  __addSubscriber__: (
    fn: Function,
    path?: any,
    opts?: { skipMountTracking?: boolean }
  ) => void;
  __removeSubscriber__: (fn: Function) => void;
  onMount?: unknown;
};

type PathSubscription = {
  watcher: WatcherDependencyTarget & { getPath: (path: string) => any };
  path: string;
};

type Dependency = WatcherDependencyTarget | PathSubscription;

export const isPathSubscription = (
  dependency: Dependency
): dependency is PathSubscription => {
  return (
    Object.keys(dependency).length === 2 &&
    'watcher' in dependency &&
    'path' in dependency
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

  return dependency.getState();
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

  let [target, path] = isPathSubscription(dependency)
    ? [dependency.watcher, dependency.path]
    : [dependency, undefined];

  // Only WatcherStore has a mount lifecycle, so only it accepts skipMountTracking.
  if ('onMount' in target) {
    target.__addSubscriber__(fn, path as never, { skipMountTracking: true });
  } else if (path !== undefined) {
    target.__addSubscriber__(fn, path as never);
  } else {
    target.__addSubscriber__(fn);
  }

  return () => target.__removeSubscriber__(fn);
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

export const getUniqueBatchedUpdates = <T>(
  batchedUpdates: { value: T; paths: string[] }[]
) => {
  const updates: { value: T; paths: string[] }[] = [];
  for (let i = batchedUpdates.length - 1; i >= 0; i--) {
    const update = batchedUpdates[i];
    if (!updates.some(u => u.paths.every(p => update.paths.includes(p)))) {
      updates.push(update);
    }
  }
  return updates;
};
