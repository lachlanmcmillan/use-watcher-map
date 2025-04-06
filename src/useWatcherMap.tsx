import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { getDeepPath, setDeepPathClone, deleteDeepPathClone } from "./object";

export interface WatcherMapReturn<T extends Record<string, any>> {
  // get the entire state
  getState: () => T;
  // get a specific path
  getPath: (path: string) => any;
  // override the entire state
  setState: (data: T) => void;
  // update a specific path
  setPath: (path: string, value: any) => void;
  // clear a specific path
  clearPath: (path: string) => void;
  // update many paths at once (batched)
  mergePaths: (newValues: Partial<T>) => void;
  // useState will re-render the component when the state changes
  useState: () => T;
  // usePath will re-render the component when the path changes
  usePath: (path: string) => any;
  // watchState will call the supplied function when the state changes.
  // It uses a useEffect underneath to cleanup properly
  watchState: (fn: (value: T) => void) => void;
  // watchPath will call the supplied function when the path changes
  // todo infer the function params here
  watchPath: (path: string, fn: (value: any) => void) => void;
  // internal fns, do not call directly, exported for testing
  __addSubscriber__: (fn: Function, path?: string) => void;
  __removeSubscriber__: (fn: Function) => void;
}

export const useWatcherMap = <T extends Record<string, any>>(
  defaultValue: T
): WatcherMapReturn<T> => {
  const state = useRef(defaultValue);
  const subscribers = useRef<{ path?: string; fn: Function }[]>([]);

  // --- helper fns ---

  const addSubscriber = (fn: Function, path?: string) => {
    if (!subscribers.current.some((sub) => sub.fn === fn)) {
      subscribers.current.push({ path, fn });
    }
  };

  const removeSubscriber = (fn: Function) => {
    subscribers.current = subscribers.current.filter((sub) => sub.fn !== fn);
  };

  /**
   * each path that's being updated should be a full path, not parts
   *
   * ✅ - ["todos.0.completed"]
   * ❌ - ["todos", "todos.0", "todos.0.completed"]
   */
  const notifySubscribers = (value: T, paths: string[]) => {
    // each subscriber should only be called once
    for (const subscriber of subscribers.current) {
      // If the subscriber is watching a specific path
      if (subscriber.path) {

        for (const notifyPath of paths) {
          // first, check for exact and child matches
          // eg. notifyPath = "todos.0.tags"
          // we notify subscribers of "todos.0.tags", "todos.0.tags.0", "todos.0.tags.1"
          // but not "todos.0.completed"
          const childPathMatch = subscriber.path.startsWith(notifyPath);

          if (childPathMatch) {
            const pathValue = getDeepPath(value, subscriber.path.split("."));
            subscriber.fn(pathValue);
            // we've notified this subscriber, so we can skip the rest of the paths
            break;
          }

          // check for parent matches
          // eg. notifyPath = "todos.0.tags"
          // we notify subscribers of "todos.0.tags", "todos.0", "todos"
          const parentPathMatch = notifyPath.startsWith(subscriber.path);

          if (parentPathMatch) {
            const pathValue = getDeepPath(value, subscriber.path.split("."));
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
    return getDeepPath(state.current, path.split("."));
  }, []);

  // returns a function that always returns the same path, useful for useSyncExternalStore
  const getPathFactory = (path: string) => {
    return useCallback((): any => {
      return getDeepPath(state.current, path.split("."));
    }, [path]);
  };

  /**
   * setState - OVERRIDES the entire state and notifies subscribers
   * of the changes. This will trigger all paths that are being watched.
   *
   * Warning. if you call setState and update the entire object state,
   * you can get into an infinite loop. It's better to call mergePaths, than
   * setState({...getState(), ...value})
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
      if (typeof state.current === "undefined" || state.current === null) {
        state.current = {} as T;
      }

      const pathParts = path.split(".");
      const newState = setDeepPathClone(state.current, pathParts, value);

      state.current = newState;

      notifySubscribers(state.current, [path]);
    },
    [subscribers.current]
  );

  /**
   * Update many paths at once (batched), and notify subscribers (once) of each
   * changed key.
   *
   * Note. that nested objects are not recursively merged.
   *
   * eg.
   * {
   *  a: { b: "example" }
   * };
   *
   * result = mergePaths({ a: { c: "new value" } });
   *
   * console.log(result)     // { a: { c: "new value" } }
   * console.log(result.a)   // { c: "new value" }
   * console.log(result.a.b) // undefined
   */
  const mergePaths = useCallback((newValues: Partial<T>) => {
    state.current = { ...state.current, ...newValues };
    const paths = Object.keys(newValues);
    notifySubscribers(state.current, paths);
  }, []);

  const clearPath = useCallback((path: string) => {
    if (typeof state.current === "undefined" || state.current === null) {
      return;
    }

    const pathParts = path.split(".");
    state.current = deleteDeepPathClone(state.current, pathParts);

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
    getState,
    getPath,
    setState,
    setPath,
    mergePaths,
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
