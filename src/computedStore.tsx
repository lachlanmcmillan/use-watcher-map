import { useEffect, useSyncExternalStore } from 'react';
import { getDeepPath, isShallowEqual } from './object';
import {
  getDependencyValue,
  notifyPathSubscribers,
  subscribeToDependency,
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
  | StorePathSubscription;

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
): WatcherComputed<T> => {
  let state: T | undefined = undefined;
  let hasState = false;
  let subscribers: { path?: string; fn: Function }[] = [];
  let unsubscribeDependency: (() => void) | null = null;

  // --- helper fns ---

  const refreshState = () => {
    const nextState = computeFn(
      getDependencyValue(dependency),
      hasState ? state : undefined
    );
    if (hasState && isShallowEqual(state, nextState)) {
      return false;
    }

    state = nextState;
    hasState = true;
    return true;
  };

  const updateComputed = () => {
    if (!refreshState()) {
      return;
    }

    notifyPathSubscribers(subscribers, state as T, Object.keys(Object(state)));
  };

  const mount = () => {
    if (unsubscribeDependency) {
      return;
    }

    refreshState();
    unsubscribeDependency = subscribeToDependency(dependency, updateComputed);
  };

  const unmount = () => {
    if (subscribers.length > 0 || !unsubscribeDependency) {
      return;
    }

    unsubscribeDependency();
    unsubscribeDependency = null;
  };

  const addSubscriber = (fn: Function, path?: string) => {
    if (!subscribers.some(sub => sub.fn === fn)) {
      subscribers.push({ path, fn });
    }

    mount();
  };

  const removeSubscriber = (fn: Function) => {
    subscribers = subscribers.filter(sub => sub.fn !== fn);
    unmount();
  };

  const subscribe = (fn: Function) => {
    addSubscriber(fn);

    return () => removeSubscriber(fn);
  };

  // useSyncExternalStore re-subscribes whenever the subscribe fn identity
  // changes. Cache one subscribe fn per path so identity is stable across
  // renders of the same usePath(path) call.
  const pathSubscribers = new Map<string, (fn: Function) => () => void>();
  const subscribePathFactory = (path: string) => {
    let cached = pathSubscribers.get(path);
    if (!cached) {
      cached = (fn: Function) => {
        addSubscriber(fn, path);
        return () => removeSubscriber(fn);
      };
      pathSubscribers.set(path, cached);
    }
    return cached;
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

  // Cache one getSnapshot fn per path. useSyncExternalStore reads identity to
  // detect changes; a fresh fn each render forces extra work.
  const pathGetters = new Map<string, () => any>();
  const getPathFactory = (path: string) => {
    let cached = pathGetters.get(path);
    if (!cached) {
      cached = (): any => getPath(path);
      pathGetters.set(path, cached);
    }
    return cached;
  };

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

  const usePath = (path: string) =>
    useSyncExternalStore(subscribePathFactory(path), getPathFactory(path));

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
  };
};
