import {
  useCallback,
  useEffect,
  useEffectEvent,
  useSyncExternalStore,
} from 'react';
import { getDeepPath, isShallowEqual } from './object';
import {
  getDependencyValue,
  getReplacedStatePaths,
  notifyPathSubscribers,
  subscribeToDependency,
  WatcherType,
} from './shared';
import type { WatcherComputed } from './useComputed';
import type { WatcherStore } from './watcherStore';

type StorePathSubscription = {
  watcher: WatcherStore<any> | WatcherComputed<any>;
  path: string;
};

export type ComputedStoreDependency =
  | WatcherStore<any>
  | WatcherComputed<any>
  | ComputedStore<any>
  | StorePathSubscription;

export type ComputedStore<T> = {
  getState: () => T;
  getPath: (path: string) => any;
  useState: () => T;
  usePath: (path: string) => any;
  watchState: (fn: (value: T) => void) => void;
  watchPath: (path: string, fn: (value: any) => void) => void;
  __addSubscriber__: (fn: Function, path?: string) => void;
  __removeSubscriber__: (fn: Function, path?: string) => void;
  __type__: typeof WatcherType.ComputedStore;
};

/**
 * Read-only derived store. Unlike useComputed, this is NOT a hook — create it
 * at module level and use its usePath/useState methods inside React components.
 *
 * Reads are lazy and do not subscribe to dependencies. Dependency subscriptions
 * are only active while the computed store has live subscribers.
 */
export const computedStore = <T,>(
  dependency: ComputedStoreDependency | ComputedStoreDependency[],
  computeFn: (value: any | any[], prev?: any | any[]) => T
): ComputedStore<T> => {
  let state: T | undefined = undefined;
  let hasState = false;
  // the dependency values `state` was computed from
  let lastInputs: any = undefined;
  let subscribers: { path?: string; fn: Function }[] = [];
  let unsubscribeDependency: (() => void) | null = null;

  // --- helper fns ---

  /** recompute `state` if the inputs changed. returns true if it did. */
  const refreshState = () => {
    const inputs = getDependencyValue(dependency);

    // unchanged inputs (by reference) mean an unchanged result, so skip
    // computeFn. this keeps getState() stable across unmounted reads, which
    // useSyncExternalStore requires of getSnapshot.
    if (hasState && isShallowEqual(inputs, lastInputs)) {
      return false;
    }

    const nextState = computeFn(inputs, hasState ? state : undefined);
    lastInputs = inputs;

    if (hasState && isShallowEqual(state, nextState)) {
      return false;
    }

    state = nextState;
    hasState = true;
    return true;
  };

  const updateComputed = () => {
    const previousState = state;
    if (!refreshState()) {
      return;
    }

    // notify every top-level key in either the old or the new result, so a
    // subscriber of a key that was dropped sees `undefined`
    notifyPathSubscribers(
      subscribers,
      state as T,
      getReplacedStatePaths(previousState, state)
    );
  };

  const mount = () => {
    if (unsubscribeDependency) {
      return;
    }

    refreshState();
    unsubscribeDependency = subscribeToDependency(dependency, updateComputed, {
      skipMountTracking: false,
    });
  };

  const unmount = () => {
    if (subscribers.length > 0 || !unsubscribeDependency) {
      return;
    }

    unsubscribeDependency();
    unsubscribeDependency = null;
  };

  const addSubscriber = (fn: Function, path?: string) => {
    // dedup on the (fn, path) pair. the same fn may subscribe to several
    // paths, but never twice to the same path.
    if (!subscribers.some(sub => sub.fn === fn && sub.path === path)) {
      subscribers.push({ path, fn });
    }

    mount();
  };

  /**
   * remove a subscriber. if `path` is given, only the (fn, path) pair is
   * removed. if omitted, every subscription for `fn` is removed.
   */
  const removeSubscriber = (fn: Function, path?: string) => {
    subscribers = subscribers.filter(
      sub => !(sub.fn === fn && (path === undefined || sub.path === path))
    );
    unmount();
  };

  const subscribe = (fn: Function) => {
    addSubscriber(fn);

    return () => removeSubscriber(fn);
  };

  const getState = () => {
    if (!unsubscribeDependency) {
      refreshState();
    }

    return state as T;
  };

  const getPath = (path: string): any => {
    return getDeepPath(getState(), path.split('.'));
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

  const useState = () => useSyncExternalStore<T>(subscribe, getState);

  // memoise per component so useSyncExternalStore keeps its subscription
  // across renders of the same path, without a store-level cache that would
  // hold every path ever used
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
    getState,
    getPath,
    useState,
    usePath,
    watchState,
    watchPath,
    // internal fns, do not call directly
    __addSubscriber__: addSubscriber,
    __removeSubscriber__: removeSubscriber,
    __type__: WatcherType.ComputedStore,
  };
};
