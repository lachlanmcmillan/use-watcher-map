import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { getDeepPath, isShallowEqual } from './object';
import {
  getDependencyValue,
  getExpandedDependencies,
  getReplacedStatePaths,
  notifyPathSubscribers,
  subscribeToDependency,
  WatcherType,
  type Dependency,
  type PathSubscription,
} from './shared';

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
  /**
   * manually remove a subscriber from the computed store.
   *
   * if `path` is given, only that (fn, path) subscription is removed.
   * if omitted, every subscription for `fn` is removed.
   */
  __removeSubscriber__: (fn: Function, path?: string) => void;
  /** the type of the watcher */
  __type__: typeof WatcherType.WatcherComputed;
}

type DependencyValue<D> = D extends PathSubscription
  ? any
  : D extends { getState: () => infer Value }
    ? Value
    : D;

type DependencyValues<D extends readonly Dependency[]> = {
  -readonly [K in keyof D]: DependencyValue<D[K]>;
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
export function useComputed<T, const D extends readonly Dependency[]>(
  dependencies: D,
  computeFn: (values: DependencyValues<D>, prev?: T) => T
): WatcherComputed<T>;

export function useComputed<T, D extends Dependency>(
  dependency: D,
  computeFn: (value: DependencyValue<D>, prev?: T) => T
): WatcherComputed<T>;

export function useComputed<T>(
  dependency: any,
  computeFn: (value: any | any[], prev?: any | any[]) => T
): WatcherComputed<T> {
  const state = useRef<T>(undefined as T);
  // Expanded deps this state was last computed for. Compared element-wise so
  // a new array (or path-subscription wrapper) with the same contents is a no-op.
  const computedForDeps = useRef<Dependency[] | null>(null);
  // Render-time computes cannot notify subscribers. Flush this in the effect.
  // Holds the paths to notify (old + new top-level keys), or null if none.
  const pendingNotifyPaths = useRef<string[] | null>(null);
  const subscribers = useRef<{ path?: string; fn: Function }[]>([]);

  // Expand once per render and reuse as the effect deps. Path subscriptions
  // become [watcher, path] so React compares those identities, not the wrapper.
  const expandedDeps = getExpandedDependencies(dependency);
  const depsChanged =
    computedForDeps.current === null ||
    computedForDeps.current.length !== expandedDeps.length ||
    computedForDeps.current.some((dep, i) => dep !== expandedDeps[i]);

  // Compute during render when expanded deps change so this render's useState /
  // getState already see the new snapshot. Watcher notifications still go
  // through the effect subscription, not this path.
  if (depsChanged) {
    const isFirst = computedForDeps.current === null;
    const nextState = computeFn(
      getDependencyValue(dependency),
      isFirst ? undefined : state.current
    );
    if (isFirst || !isShallowEqual(state.current, nextState)) {
      // Child subscribers (useState/usePath in other components) would otherwise
      // miss primitive / watcher-identity updates that don't come from a store notify.
      // Capture the old keys now, before they are lost, so dropped keys notify.
      if (!isFirst) {
        pendingNotifyPaths.current = getReplacedStatePaths(
          state.current,
          nextState
        );
      }
      state.current = nextState;
    }
    computedForDeps.current = expandedDeps;
  }

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

  // store notifies call the latest computeFn, not the one captured when the
  // effect last ran. render-time computes above still call computeFn directly
  // since effect events cannot run during render.
  const compute = useEffectEvent(computeFn);

  // Subscribe to dependency changes, including writes made by mount callbacks.
  useEffect(() => {
    const updateComputed = () => {
      const nextState = compute(getDependencyValue(dependency), state.current);
      if (isShallowEqual(state.current, nextState)) {
        return;
      }

      // notify every top-level key in either the old or the new result, so a
      // subscriber of a key that was dropped sees `undefined`
      const paths = getReplacedStatePaths(state.current, nextState);
      state.current = nextState;
      notifySubscribers(nextState, paths);
    };

    const unsubscribe = subscribeToDependency(dependency, updateComputed, {
      skipMountTracking: false,
    });

    // Defer until after this commit's other passive effects. useSyncExternalStore
    // in *this* component updates its cached snapshot in a passive effect; if we
    // notify first it still has the previous snapshot and forces a second render.
    // A microtask runs after those effects, so same-component subscribers bail
    // out (snapshot already matches) while children that did not re-render still
    // get the push.
    let cancelled = false;
    const pendingPaths = pendingNotifyPaths.current;
    if (pendingPaths) {
      pendingNotifyPaths.current = null;
      queueMicrotask(() => {
        if (!cancelled) {
          notifySubscribers(state.current, pendingPaths);
        }
      });
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, expandedDeps);

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

  // useMemo is needed here to ensure the computed store API object is
  // referentially stable across renders. This prevents unnecessary re-renders
  // for consumers.
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
      __type__: WatcherType.WatcherComputed,
    }),
    []
  );
}
