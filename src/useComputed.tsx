import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { getDeepPath, isShallowEqual } from './object';
import {
  getDependencyValue,
  notifyPathSubscribers,
  subscribeToDependency,
} from './shared';
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

  const notifySubscribers = (value: T, paths: string[]) => {
    notifyPathSubscribers(subscribers.current, value, paths);
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

