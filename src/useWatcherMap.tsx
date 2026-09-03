import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { getDeepPath, setDeepPathClone, deleteDeepPathClone } from './object';
import { PathOf } from './pathOf';
import {
  getChangedPaths,
  getReplacedStatePaths,
  notifyPathSubscribers,
  WatcherType,
} from './shared';
import { WatcherBase } from './watcherBase';

export interface WatcherMap<T extends Record<string, any>>
  extends WatcherBase<T> {
  /* --- internal fns, do not call directly, exported for testing  --- */

  /** manually add a subscriber to the store */
  __addSubscriber__: (fn: Function, path?: PathOf<T>) => void;
  /**
   * manually remove a subscriber from the store.
   *
   * if `path` is given, only that (fn, path) subscription is removed.
   * if omitted, every subscription for `fn` is removed.
   */
  __removeSubscriber__: (fn: Function, path?: PathOf<T>) => void;
  /** the type of the watcher */
  __type__: typeof WatcherType.WatcherMap;
}

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
export const useWatcherMap = <T extends Record<string, any>>(
  defaultValue: T
): WatcherMap<T> => {
  const state = useRef(defaultValue);
  const subscribers = useRef<{ path?: string; fn: Function }[]>([]);
  // paths updated during a batch. null when not batching.
  const batchedPaths = useRef<Set<string> | null>(null);

  // --- helper fns ---

  const addSubscriber = useCallback((fn: Function, path?: string) => {
    // dedup on the (fn, path) pair. the same fn may subscribe to several
    // paths, but never twice to the same path.
    if (!subscribers.current.some(sub => sub.fn === fn && sub.path === path)) {
      subscribers.current.push({ path, fn });
    }
  }, []);

  /**
   * remove a subscriber. if `path` is given, only the (fn, path) pair is
   * removed. if omitted, every subscription for `fn` is removed.
   */
  const removeSubscriber = useCallback((fn: Function, path?: string) => {
    subscribers.current = subscribers.current.filter(
      sub => !(sub.fn === fn && (path === undefined || sub.path === path))
    );
  }, []);

  /**
   * each path that's being updated should be a full path, not parts
   *
   * ✅ - ["todos.0.completed"]
   * ❌ - ["todos", "todos.0", "todos.0.completed"]
   */
  const notifySubscribers = (value: T, paths: string[]) => {
    // if we're in a batch, delay the notification until the batch is complete
    if (batchedPaths.current) {
      for (const path of paths) {
        batchedPaths.current.add(path);
      }
      return;
    }

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

  const batch = useCallback((fn: () => void) => {
    if (batchedPaths.current) {
      throw new Error('Cannot batch updates inside a batch');
    }
    // a batch is atomic: if fn throws, restore the pre-batch state, notify
    // nobody, and re-throw. state is immutable so keeping a reference is
    // enough to roll back.
    const previousState = state.current;
    batchedPaths.current = new Set();
    let paths: string[];
    try {
      fn();
      paths = [...batchedPaths.current];
    } catch (error) {
      state.current = previousState;
      throw error;
    } finally {
      // always leave batch mode, otherwise every later update is silently
      // queued and every later batch throws
      batchedPaths.current = null;
    }
    // notify once with the final state. notifyPathSubscribers guarantees each
    // subscriber is called at most once per call, regardless of how many of
    // the paths it matches.
    notifySubscribers(state.current, paths);
  }, []);

  /**
   * setState - OVERRIDES the entire state and notifies subscribers
   * of the changes. This will trigger all paths that are being watched.
   */
  const setState = useCallback((value: T) => {
    const previousState = state.current;
    // update the state
    state.current = value;
    // notify subscribers of every top-level key in either the old or the new
    // state, so a subscriber of a key that was removed sees `undefined`
    const paths = getReplacedStatePaths(previousState, value);
    notifySubscribers(value, paths);
  }, []);

  /**
   * setPath - updates a specific path in the state and notifies subscribers
   * of the changes.
   */
  const setPath = useCallback((path: string, value: any) => {
    if (typeof state.current === 'undefined' || state.current === null) {
      state.current = {} as T;
    }

    const pathParts = path.split('.');
    const previousState = state.current;
    state.current = setDeepPathClone(previousState, pathParts, value);

    notifySubscribers(
      state.current,
      getChangedPaths(previousState, state.current, pathParts)
    );
  }, []);

  const clearPath = useCallback((path: string, removeEmptyObjects = false) => {
    if (typeof state.current === 'undefined' || state.current === null) {
      return;
    }

    const pathParts = path.split('.');
    const previousState = state.current;
    state.current = deleteDeepPathClone(
      previousState,
      pathParts,
      removeEmptyObjects
    );

    notifySubscribers(
      state.current,
      getChangedPaths(previousState, state.current, pathParts)
    );
  }, []);

  // do not call setState from within this function or it will cause
  // an infinite loop
  const watchState = (fn: (value: T) => void) => {
    const onStateChange = useEffectEvent(fn);

    useEffect(() => {
      addSubscriber(onStateChange);

      return () => removeSubscriber(onStateChange);
    }, []);
  };

  const watchPath = (path: string, fn: (value: any) => void) => {
    const onPathChange = useEffectEvent(fn);

    useEffect(() => {
      addSubscriber(onPathChange, path);

      return () => removeSubscriber(onPathChange, path);
    }, [path]);
  };

  const useState = () => useSyncExternalStore<T>(subscribe, getState);

  const usePath = (path: string) => {
    const subscribePath = useCallback(
      (fn: Function) => {
        addSubscriber(fn, path);
        return () => removeSubscriber(fn, path);
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
      batch,
      getState,
      getPath,
      setState,
      setPath,
      clearPath,
      useState,
      usePath,
      watchState,
      watchPath,
      // internal fns, do not call directly
      __addSubscriber__: addSubscriber,
      __removeSubscriber__: removeSubscriber,
      __type__: WatcherType.WatcherMap,
    }),
    []
  );
};
