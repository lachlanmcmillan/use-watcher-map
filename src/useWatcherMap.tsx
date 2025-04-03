import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { getDeepPath, setDeepPathClone } from "./object";

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
  clearPath: (path: Extract<keyof T, string>) => void;
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

  const notifySubscribers = (value: T, paths: string[]) => {
    subscribers.current.forEach((subscriber) => {
      // If the subscriber is watching a specific path
      if (subscriber.path) {
        // Check if the exact path is in the notification paths
        // Example: watching "filter" and "filter" is updated
        const exactPathMatch = paths.includes(subscriber.path);
        
        // Check if any updated path is a parent of the subscribed path
        // Example: watching "todos.0.completed" and "todos.0" is replaced
        // with a new object. In this case, "todos.0" is a parent of 
        // "todos.0.completed"
        const parentPathMatch = paths.some(path => {
          return subscriber.path!.startsWith(path + '.') || subscriber.path === path;
        });
        
        // Check if any updated path is a child of the subscribed path
        // Example: watching "todos" and "todos.0.completed" is updated
        // In this case, "todos.0.completed" is a child of "todos"
        const childPathMatch = paths.some(path => {
          return path.startsWith(subscriber.path! + '.') || path === subscriber.path;
        });
        
        // Notify if there's any relationship between the paths
        // This ensures bidirectional updates for nested paths:
        // 1. Exact match: watching "a.b" and "a.b" is updated
        // 2. Parent updated: watching "a.b.c" and "a.b" is replaced
        // 3. Child updated: watching "a.b" and "a.b.c" is updated
        if (exactPathMatch || parentPathMatch || childPathMatch) {
          const pathValue = getDeepPath(value, subscriber.path.split('.'));
          subscriber.fn(pathValue);
        }
      } else {
        // If the subscriber is watching the entire state, then notify the
        // subscriber with the complete state object
        subscriber.fn(value);
      }
    });
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

      // notify subscribers of this property of the changes
      // if setting a deep path, eg. "a.b.c", then we notify subscribers 
      // of "a", "a.b", and "a.b.c"
      const notifyPaths = pathParts.map((part, index) =>
        pathParts.slice(0, index + 1).join(".")
      );
      notifySubscribers(state.current, notifyPaths);
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

  const clearPath = useCallback((path: Extract<keyof T, string>) => {
    if (typeof state.current === "undefined" || state.current === null) {
      return;
    }

    delete (state.current as Record<string, any>)[path];
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
