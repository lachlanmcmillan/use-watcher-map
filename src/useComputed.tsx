import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { getDeepPath } from './object';
import { WatcherBase } from './watcherBase';
import { WatcherStore } from './watcherStore';
import { WatcherMap } from './useWatcherMap';
import { WatcherPrimitive } from './useWatcherPrimitive';

export type WatcherComputed<T extends Record<string, any>> = Omit<
  WatcherBase<T>,
  'batch' | 'setState' | 'setPath' | 'clearPath'
>;

type Dependency =
  | WatcherStore<any>
  | WatcherMap<any>
  | WatcherPrimitive<any>
  | [WatcherStore<any> | WatcherMap<any>, string];

const getDependencyValue = (dependency: Dependency) => {
  if (Array.isArray(dependency)) {
    const [store, path] = dependency;
    return store.getPath(path as never);
  }

  return dependency.getState();
};

const subscribeToDependency = (
  dependency: Dependency,
  fn: (value: any) => void
) => {
  if (Array.isArray(dependency)) {
    const [store, path] = dependency;
    store.__addSubscriber__(fn, path as never, { skipMountTracking: true });
    return () => store.__removeSubscriber__(fn);
  }

  dependency.__addSubscriber__(fn, undefined, { skipMountTracking: true });
  return () => dependency.__removeSubscriber__(fn);
};

/**
 * React hook for managing nested object state with path-based subscriptions.
 * Components using `usePath` only re-render when their specific path changes.
 *
 * @param defaultValue - The initial state object
 * @returns A WatcherMap with getPath, setPath, usePath, watchPath, batch, etc.
 *
 * @example
 * const watcher = useWatcherMap<{ user: { name: string } }>({ user: { name: 'Alice' } });
 * // In a child component:
 * const name = watcher.usePath('user.name'); // only re-renders when name changes
 * // To update:
 * watcher.setPath('user.name', 'Bob');
 */
export const useComputed = <T extends Record<string, any>>(
  dependency: Dependency,
  computeFn: (value: any) => T
): WatcherComputed<T> => {
  const state = useRef(computeFn(getDependencyValue(dependency)));
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
    const updateComputed = (dependencyValue: any) => {
      const nextState = computeFn(dependencyValue);
      state.current = nextState;
      notifySubscribers(nextState, Object.keys(nextState));
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
