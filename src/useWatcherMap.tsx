import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { getDeepPath, setDeepPathClone, deleteDeepPathClone } from './object';

export interface WatcherMapReturn<T extends Record<string, any>> {
  /** get the entire state */
  getState: () => T;
  /** get a specific path */
  getPath: (path: string) => any;
  /** override the entire state */
  setState: (data: T) => void;
  /** update a specific path */
  setPath: (path: string, value: any) => void;
  /** clear a specific path */
  clearPath: (path: string, removeEmptyObjects?: boolean) => void;
  /** make multiple updates and call notifiers at the end */
  batch: (fn: () => void) => void;
  /** useState will re-render the component when the state changes */
  useState: () => T;
  /** usePath will re-render the component when the specified path changes */
  usePath: (path: string) => any;
  /**
   * watchState will call the supplied function when the state changes.
   * It uses a useEffect underneath to cleanup properly
   */
  watchState: (fn: (value: T) => void) => void;
  /** watchPath will call the supplied function when the path changes */
  watchPath: (path: string, fn: (value: any) => void) => void;
  // internal fns, do not call directly, exported for testing */
  __addSubscriber__: (fn: Function, path?: string) => void;
  __removeSubscriber__: (fn: Function) => void;
}

export const useWatcherMap = <T extends Record<string, any>>(
  defaultValue: T
): WatcherMapReturn<T> => {
  const state = useRef(defaultValue);
  const subscribers = useRef<{ path?: string; fn: Function }[]>([]);
  const batchedUpdates = useRef<{ value: T; paths: string[] }[] | null>(null);

  // --- helper fns ---

  const addSubscriber = (fn: Function, path?: string) => {
    if (!subscribers.current.some(sub => sub.fn === fn)) {
      subscribers.current.push({ path, fn });
    }
  };

  const removeSubscriber = (fn: Function) => {
    subscribers.current = subscribers.current.filter(sub => sub.fn !== fn);
  };

  /**
   * each path that's being updated should be a full path, not parts
   *
   * ✅ - ["todos.0.completed"]
   * ❌ - ["todos", "todos.0", "todos.0.completed"]
   */
  const notifySubscribers = (value: T, paths: string[]) => {
    // if we're in a batch, delay the notification until the batch is complete
    if (batchedUpdates.current) {
      batchedUpdates.current.push({ value, paths });
      return;
    }

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

  const subscribePathFactory = (path: string) => {
    return useCallback(
      (fn: Function) => {
        addSubscriber(fn, path);

        return () => removeSubscriber(fn);
      },
      [path]
    );
  };

  const getState = useCallback(() => state.current, []);

  const getPath = useCallback((path: string): any => {
    return getDeepPath(state.current, path.split('.'));
  }, []);

  // returns a function that always returns the same path, useful for useSyncExternalStore
  const getPathFactory = (path: string) => {
    return useCallback((): any => {
      return getDeepPath(state.current, path.split('.'));
    }, [path]);
  };

  const batch = useCallback((fn: () => void) => {
    if (batchedUpdates.current) {
      throw new Error('Cannot batch updates inside a batch');
    }
    batchedUpdates.current = [];
    fn();
    // make a list of unique updates, take the last one for each path
    const updates: { value: T; paths: string[] }[] = [];
    for (let i = batchedUpdates.current.length - 1; i >= 0; i--) {
      const update = batchedUpdates.current[i];
      if (!updates.some(u => u.paths.every(p => update.paths.includes(p)))) {
        updates.push(update);
      }
    }
    batchedUpdates.current = null;
    updates.forEach(({ value, paths }) => notifySubscribers(value, paths));
  }, []);

  /**
   * setState - OVERRIDES the entire state and notifies subscribers
   * of the changes. This will trigger all paths that are being watched.
   */
  const setState = useCallback((value: T) => {
    // update the state
    state.current = value;
    // determine what keys have changed in the map
    // a user can call setValue({ a: 1, b: 2 })
    // and subscribers of both a and b will be notified
    const paths = Object.keys(value);
    // notify subscribers of the changes
    notifySubscribers(value, paths);
  }, []);

  /**
   * setPath - updates a specific path in the state and notifies subscribers
   * of the changes.
   */
  const setPath = useCallback(
    (path: string, value: any) => {
      if (typeof state.current === 'undefined' || state.current === null) {
        state.current = {} as T;
      }

      const pathParts = path.split('.');
      const newState = setDeepPathClone(state.current, pathParts, value);

      state.current = newState;

      notifySubscribers(state.current, [path]);
    },
    [subscribers.current]
  );

  const clearPath = useCallback((path: string, removeEmptyObjects = false) => {
    if (typeof state.current === 'undefined' || state.current === null) {
      return;
    }

    const pathParts = path.split('.');
    state.current = deleteDeepPathClone(
      state.current,
      pathParts,
      removeEmptyObjects
    );

    notifySubscribers(state.current, [path]);
  }, []);

  // do not call setState from within this function or it will cause
  // an infinite loop
  const watchState = useCallback(
    (fn: Function) =>
      useEffect(() => {
        addSubscriber(fn);

        return () => removeSubscriber(fn);
      }, []),
    []
  );

  const watchPath = useCallback(
    (path: string, fn: (value: any) => void) =>
      useEffect(() => {
        addSubscriber(fn, path);

        return () => removeSubscriber(fn);
      }, []),
    []
  );

  return {
    batch,
    getState,
    getPath,
    setState,
    setPath,
    clearPath,
    useState: () => useSyncExternalStore<T>(subscribe, getState),
    usePath: (path: string) =>
      useSyncExternalStore<string>(
        subscribePathFactory(path),
        getPathFactory(path)
      ),
    watchState,
    watchPath,
    // internal fns, do not call directly
    __addSubscriber__: addSubscriber,
    __removeSubscriber__: removeSubscriber,
  };
};
