import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { getDeepPath, isShallowEqual } from './object';
import { WatcherStore } from './watcherStore';
import { WatcherMap } from './useWatcherMap';
import { WatcherPrimitive } from './useWatcherPrimitive';

export interface WatcherComputed<T> {
  /** get the entire computed state */
  getState: () => T;
  /** get a specific path from the computed state */
  getPath: (path: string) => any;
  /** useState will re-render the component when the computed state changes */
  useState: () => T;
  /** usePath will re-render the component when the specified path changes */
  usePath: (path: string) => any;
  /** watchState will call the supplied function when the computed state changes */
  watchState: (fn: (value: T) => void) => void;
  /** watchPath will call the supplied function when the computed path changes */
  watchPath: (path: string, fn: (value: any) => void) => void;

  /* --- internal fns, do not call directly, exported for testing --- */

  /** manually add a subscriber to the computed store */
  __addSubscriber__: (fn: Function, path?: string) => void;
  /** manually remove a subscriber from the computed store */
  __removeSubscriber__: (fn: Function) => void;
}

type PathSubscription = {
  watcher: WatcherStore<any> | WatcherMap<any> | WatcherComputed<any>;
  path: string;
};

type Dependency =
  | WatcherStore<any>
  | WatcherMap<any>
  | WatcherPrimitive<any>
  | WatcherComputed<any>
  | PathSubscription;

const isPathSubscription = (
  dependency: Dependency
): dependency is PathSubscription => {
  return (
    Object.keys(dependency).length === 2 &&
    'watcher' in dependency &&
    'path' in dependency
  );
};

const getDependencyValue = (
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

const subscribeToDependency = (
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
 * Read-only derived watcher. `computeFn` runs when dependencies change.
 *
 * **WARNING** - skips update when new result is shallow-equal to previous state.
 * - isShallowEqual(['apples'], ['apples']) // true
 * - isShallowEqual([{ a: 1 }], [{ a: 1 }]) // false
 * - equivalent to a deep-equality check only a single level deep.
 * - to skip manually: return `prev` from computeFn (ref equality = no notify)
 *
 * @example
 * const veg = useComputed({ watcher: store, path: 'items' }, (items, _prev) =>
 *   items.filter(i => i.type === 'veg')
 * );
 */
export const useComputed = <T,>(
  dependency: Dependency | Dependency[],
  computeFn: (value: any | any[], prev?: any | any[]) => T
): WatcherComputed<T> => {
  const state = useRef(computeFn(getDependencyValue(dependency), undefined));
  const subscribers = useRef<{ path?: string; fn: Function }[]>([]);

  // --- helper fns ---

  const addSubscriber = useCallback((fn: Function, path?: string) => {
    if (!subscribers.current.some(sub => sub.fn === fn)) {
      subscribers.current.push({ path, fn });
    }
  }, []);

  const removeSubscriber = useCallback((fn: Function) => {
    subscribers.current = subscribers.current.filter(sub => sub.fn !== fn);
  }, []);

  /**
   * each path that's being updated should be a full path, not parts
   *
   * ✅ - ["todos.0.completed"]
   * ❌ - ["todos", "todos.0", "todos.0.completed"]
   */
  const notifySubscribers = (value: T, paths: string[]) => {
    // each subscriber should only be called once
    for (const subscriber of subscribers.current) {
      // If the subscriber is watching a specific path (as opposed to the
      // entire state)
      if (subscriber.path) {
        for (const notifyPath of paths) {
          // first, check for exact and child matches
          // eg. notifyPath = "todos.0.tags"
          // we notify subscribers of exact matches "todos.0.tags", and
          // sub-paths "todos.0.tags.0", "todos.0.tags.1", etc. but not
          // siblings "todos.0.completed"
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

  const subscribe = useCallback((fn: Function) => {
    addSubscriber(fn);

    return () => removeSubscriber(fn);
  }, []);

  const getState = useCallback(() => state.current, []);

  const getPath = useCallback((path: string): any => {
    return getDeepPath(state.current, path.split('.'));
  }, []);

  useEffect(() => {
    const updateComputed = () => {
      const nextState = computeFn(
        getDependencyValue(dependency),
        state.current
      );
      if (isShallowEqual(state.current, nextState)) {
        return;
      }

      state.current = nextState;
      notifySubscribers(nextState, Object.keys(Object(nextState)));
    };

    return subscribeToDependency(dependency, updateComputed);
  }, [dependency, computeFn]);

  // do not call setState from within this function or it will cause
  // an infinite loop
  const watchState = (fn: Function) =>
    useEffect(() => {
      addSubscriber(fn);

      return () => removeSubscriber(fn);
    }, []);

  const watchPath = (path: string, fn: (value: any) => void) =>
    useEffect(() => {
      addSubscriber(fn, path);

      return () => removeSubscriber(fn);
    }, [path]);

  const useState = () => useSyncExternalStore<T>(subscribe, getState);

  const usePath = (path: string) => {
    const subscribePath = useCallback(
      (fn: Function) => {
        addSubscriber(fn, path);
        return () => removeSubscriber(fn);
      },
      [path]
    );

    const getPathSnapshot = useCallback(() => {
      return getDeepPath(state.current, path.split('.'));
    }, [path]);

    return useSyncExternalStore(subscribePath, getPathSnapshot);
  };

  return useMemo(
    () => ({
      getState,
      getPath,
      useState,
      usePath,
      watchState,
      watchPath,
      // internal fns, do not call directly
      __addSubscriber__: addSubscriber,
      __removeSubscriber__: removeSubscriber,
    }),
    []
  );
};
