import {
  useCallback,
  useEffect,
  useEffectEvent,
  useSyncExternalStore,
} from 'react';
import { getDeepPath, setDeepPathClone, deleteDeepPathClone } from './object';
import type { WatcherBase } from './watcherBase';
import { PathOf } from './pathOf';
import {
  getChangedPaths,
  getReplacedStatePaths,
  notifyPathSubscribers,
  WatcherType,
} from './shared';

/** returned from a mount fn to run when the matching unmount happens */
export type CleanupFn = () => void;
/** passed to onMount. may return a cleanup fn. */
export type MountFn = () => void | CleanupFn;
/** passed to onMountPath. receives the path, may return a cleanup fn. */
export type MountPathFn<T extends Record<string, any>> = (
  path: PathOf<T>
) => void | CleanupFn;

export interface WatcherStore<T extends Record<string, any>>
  extends WatcherBase<T> {
  /**
   * onMount will call the supplied function when the store is mounted.
   *
   * ie. useState, usePath, watchState, watchPath is used within a component.
   *
   * If the mountFn returns a function, that function will be called when the
   * store is unmounted.
   *
   * Only one onMount function is kept, so calling onMount multiple times will
   * override the previous function.
   */
  onMount: (mountFn: MountFn) => void;
  /**
   * onMountPath will call the supplied function when a path is subscribed to
   * for the first time (`usePath` / `watchPath`).
   *
   * The function receives the path, so a single callback can fetch whatever
   * record was subscribed to (e.g. `$store.usePath(itemId)`).
   *
   * Exact path match only — each path has its own 0 -> 1 / 1 -> 0 lifecycle.
   * Whole-state subscribers (`useState` / `watchState`) do not trigger it.
   *
   * If the mountFn returns a function, that function will be called when the
   * last subscriber to that path is unmounted.
   *
   * Only one onMountPath function is kept, so calling onMountPath multiple
   * times will override the previous function.
   */
  onMountPath: (mountFn: MountPathFn<T>) => void;

  /* --- internal fns, do not call directly, exported for testing --- */

  /**
   * manually add a subscriber to the store.
   *
   * if you pass opts { skipMountTracking: true }, then this subscriber will not
   * trigger the onMount or onMountPath fn.
   */
  __addSubscriber__: (
    fn: Function,
    path?: PathOf<T>,
    opts?: { skipMountTracking?: boolean }
  ) => void;
  /**
   * manually remove a subscriber from the store.
   *
   * if `path` is given, only that (fn, path) subscription is removed.
   * if omitted, every subscription for `fn` is removed.
   */
  __removeSubscriber__: (fn: Function, path?: PathOf<T>) => void;
  __type__: typeof WatcherType.WatcherStore;
}

/**
 * Create a global store with path-based subscriptions. Unlike useWatcherMap,
 * this is NOT a hook — create it at module level and use its usePath/useState
 * methods inside React components.
 *
 * @param defaultValue - The initial state object
 * @returns A WatcherStore with all WatcherMap methods plus onMount / onMountPath lifecycle
 *
 * @example
 * // store.ts
 * export const appStore = watcherStore({ user: { name: 'Alice' }, theme: 'dark' });
 *
 * // Component.tsx
 * const theme = appStore.usePath('theme'); // subscribes to theme changes only
 * appStore.setPath('theme', 'light');
 */
export const watcherStore = <T extends Record<string, any>>(
  defaultValue: T
): WatcherStore<T> => {
  let state = defaultValue;
  let subscribers: {
    path?: string;
    fn: Function;
    opts?: { skipMountTracking?: boolean };
  }[] = [];
  // paths updated during a batch. null when not batching.
  let batchedPaths: Set<string> | null = null;
  let onMountFn: MountFn | null = null;
  let onUnmountFn: CleanupFn | null = null;
  let onMountPathFn: ((path: string) => void | CleanupFn) | null = null;
  const onUnmountPathFns = new Map<string, CleanupFn>();

  const trackedPathSubscriberCount = (path: string) =>
    subscribers.filter(s => !s.opts?.skipMountTracking && s.path === path)
      .length;

  // --- helper fns ---

  const addSubscriber = (
    fn: Function,
    path?: string,
    opts?: { skipMountTracking?: boolean }
  ) => {
    // dedup on the (fn, path) pair. the same fn may subscribe to several
    // paths (eg. useComputed fanning one update fn out to multiple path
    // dependencies on this store), but never twice to the same path.
    if (subscribers.some(sub => sub.fn === fn && sub.path === path)) {
      return;
    }

    const isFirstSubscriber =
      subscribers.filter(s => !s.opts?.skipMountTracking).length === 0;
    if (
      !opts?.skipMountTracking &&
      isFirstSubscriber &&
      typeof onMountFn === 'function'
    ) {
      const returnValue = onMountFn();
      if (typeof returnValue === 'function') {
        onUnmountFn = returnValue;
      }
    }

    if (path && !opts?.skipMountTracking) {
      const isFirstPathSubscriber = trackedPathSubscriberCount(path) === 0;
      if (isFirstPathSubscriber && typeof onMountPathFn === 'function') {
        const returnValue = onMountPathFn(path);
        if (typeof returnValue === 'function') {
          onUnmountPathFns.set(path, returnValue);
        }
      }
    }

    subscribers.push({ path, fn, opts });
  };

  /**
   * remove a subscriber. if `path` is given, only the (fn, path) pair is
   * removed. if omitted, every subscription for `fn` is removed.
   */
  const removeSubscriber = (fn: Function, path?: string) => {
    const isMatch = (sub: { fn: Function; path?: string }) =>
      sub.fn === fn && (path === undefined || sub.path === path);

    const removed = subscribers.filter(isMatch);
    if (removed.length === 0) {
      return;
    }
    subscribers = subscribers.filter(sub => !isMatch(sub));

    for (const sub of removed) {
      if (sub.path && !sub.opts?.skipMountTracking) {
        const isLastPathSubscriber = trackedPathSubscriberCount(sub.path) === 0;
        const onUnmountPathFn = onUnmountPathFns.get(sub.path);
        if (isLastPathSubscriber && typeof onUnmountPathFn === 'function') {
          onUnmountPathFn();
          onUnmountPathFns.delete(sub.path);
        }
      }
    }

    const removedTracked = removed.some(s => !s.opts?.skipMountTracking);
    const isLastSubscriber =
      subscribers.filter(s => !s.opts?.skipMountTracking).length === 0;
    if (
      removedTracked &&
      isLastSubscriber &&
      typeof onUnmountFn === 'function'
    ) {
      onUnmountFn();
      onUnmountFn = null;
    }
  };

  /**
   * each path that's being updated should be a full path, not parts
   *
   * ✅ - ["todos.0.completed"]
   * ❌ - ["todos", "todos.0", "todos.0.completed"]
   */
  const notifySubscribers = (value: T, paths: string[]) => {
    // if we're in a batch, delay the notification until the batch is complete
    if (batchedPaths) {
      for (const path of paths) {
        batchedPaths.add(path);
      }
      return;
    }

    notifyPathSubscribers(subscribers, value, paths);
  };

  const subscribe = (fn: Function) => {
    addSubscriber(fn);

    return () => removeSubscriber(fn);
  };

  const getState = () => state;

  const getPath = (path: string): any => {
    return getDeepPath(state, path.split('.'));
  };

  const batch = (fn: () => void) => {
    if (batchedPaths) {
      throw new Error('Cannot batch updates inside a batch');
    }
    // a batch is atomic: if fn throws, restore the pre-batch state, notify
    // nobody, and re-throw. state is immutable so keeping a reference is
    // enough to roll back.
    const previousState = state;
    batchedPaths = new Set();
    let paths: string[];
    try {
      fn();
      paths = [...batchedPaths];
    } catch (error) {
      state = previousState;
      throw error;
    } finally {
      // always leave batch mode, otherwise every later update is silently
      // queued and every later batch throws
      batchedPaths = null;
    }
    // notify once with the final state. notifyPathSubscribers guarantees each
    // subscriber is called at most once per call, regardless of how many of
    // the paths it matches.
    notifySubscribers(state, paths);
  };

  /**
   * setState - OVERRIDES the entire state and notifies subscribers
   * of the changes. This will trigger all paths that are being watched.
   */
  const setState = (value: T) => {
    const previousState = state;
    // update the state
    state = value;
    // notify subscribers of every top-level key in either the old or the new
    // state, so a subscriber of a key that was removed sees `undefined`
    const paths = getReplacedStatePaths(previousState, value);
    notifySubscribers(value, paths);
  };

  /**
   * setPath - updates a specific path in the state and notifies subscribers
   * of the changes.
   */
  const setPath = (path: string, value: any) => {
    if (typeof state === 'undefined' || state === null) {
      state = {} as T;
    }

    const pathParts = path.split('.');
    const previousState = state;
    state = setDeepPathClone(previousState, pathParts, value);

    notifySubscribers(state, getChangedPaths(previousState, state, pathParts));
  };

  const clearPath = (path: string, removeEmptyObjects = false) => {
    if (typeof state === 'undefined' || state === null) {
      return;
    }

    const pathParts = path.split('.');
    const previousState = state;
    state = deleteDeepPathClone(previousState, pathParts, removeEmptyObjects);

    notifySubscribers(state, getChangedPaths(previousState, state, pathParts));
  };

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

  const onMount = (fn: MountFn) => {
    onMountFn = fn;
  };

  const onMountPath = (fn: MountPathFn<T>) => {
    onMountPathFn = fn as (path: string) => void | CleanupFn;
  };

  const useState = () => useSyncExternalStore<T>(subscribe, getState);

  // memoise per component so useSyncExternalStore keeps its subscription
  // across renders of the same path (no onMount/onUnmount churn), without a
  // store-level cache that would hold every path ever used
  const usePath = (path: string) => {
    const subscribePath = useCallback(
      (fn: Function) => {
        addSubscriber(fn, path);
        return () => removeSubscriber(fn, path);
      },
      [path]
    );

    const getPathSnapshot = useCallback(() => getPath(path), [path]);

    return useSyncExternalStore(subscribePath, getPathSnapshot);
  };

  return {
    batch,
    clearPath,
    getPath,
    getState,
    onMount,
    onMountPath,
    setPath,
    setState,
    useState,
    usePath,
    watchState,
    watchPath,
    // internal fns, do not call directly
    __addSubscriber__: addSubscriber,
    __removeSubscriber__: removeSubscriber,
    __type__: WatcherType.WatcherStore,
  };
};
