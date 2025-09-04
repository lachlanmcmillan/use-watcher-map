import { useEffect, useSyncExternalStore } from 'react';
import { getDeepPath, setDeepPathClone, deleteDeepPathClone } from './object';
import type { WatcherBase } from './watcherBase';

export interface WatcherStore<T extends Record<string, any>> extends WatcherBase<T> {
  /**
   * onMount will call the supplied function when the store is mounted.
   *
   * If the function returns a function, that function will be called when the
   * store is unmounted.
   *
   * Only one onMount function is kept, so calling onMount multiple times will
   * override the previous function.
   */
  onMount: (fn: () => void) => void;
}

/**
 * watcherStore - A store that allows you to watch for changes to the state
 */
export const watcherStore = <T extends Record<string, any>>(
  defaultValue: T
): WatcherStore<T> => {
  let state = defaultValue;
  let subscribers: { path?: string; fn: Function }[] = [];
  let batchedUpdates: { value: T; paths: string[] }[] | null = null;
  let onMountFn: (() => void) | null = null;
  let onUnmountFn: any | null = null;

  // --- helper fns ---

  const addSubscriber = (fn: Function, path?: string) => {
    if (subscribers.length === 0 && typeof onMountFn === 'function') {
      const returnValue = onMountFn();
      if (typeof returnValue === 'function') {
        onUnmountFn = returnValue;
      }
    }

    if (!subscribers.some(sub => sub.fn === fn)) {
      subscribers.push({ path, fn });
    }
  };

  const removeSubscriber = (fn: Function) => {
    subscribers = subscribers.filter(sub => sub.fn !== fn);

    if (subscribers.length === 0 && typeof onUnmountFn === 'function') {
      onUnmountFn();
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
    if (batchedUpdates) {
      batchedUpdates.push({ value, paths });
      return;
    }

    // each subscriber should only be called once
    for (const subscriber of subscribers) {
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

  const subscribe = (fn: Function) => {
    addSubscriber(fn);

    return () => removeSubscriber(fn);
  };

  const subscribePathFactory = (path: string) => {
    return (fn: Function) => {
      addSubscriber(fn, path);

      return () => removeSubscriber(fn);
    };
  };

  const getState = () => state;

  const getPath = (path: string): any => {
    return getDeepPath(state, path.split('.'));
  };

  // returns a function that always returns the same path, useful for useSyncExternalStore
  const getPathFactory = (path: string) => {
    return (): any => {
      return getDeepPath(state, path.split('.'));
    };
  };

  const batch = (fn: () => void) => {
    if (batchedUpdates) {
      throw new Error('Cannot batch updates inside a batch');
    }
    batchedUpdates = [];
    fn();
    // make a list of unique updates, take the last one for each path
    const updates: { value: T; paths: string[] }[] = [];
    for (let i = batchedUpdates.length - 1; i >= 0; i--) {
      const update = batchedUpdates[i];
      if (!updates.some(u => u.paths.every(p => update.paths.includes(p)))) {
        updates.push(update);
      }
    }
    batchedUpdates = null;
    updates.forEach(({ value, paths }) => notifySubscribers(value, paths));
  };

  /**
   * setState - OVERRIDES the entire state and notifies subscribers
   * of the changes. This will trigger all paths that are being watched.
   */
  const setState = (value: T) => {
    // update the state
    state = value;
    // determine what keys have changed in the map
    // a user can call setValue({ a: 1, b: 2 })
    // and subscribers of both a and b will be notified
    const paths = Object.keys(value);
    // notify subscribers of the changes
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
    const newState = setDeepPathClone(state, pathParts, value);

    state = newState;

    notifySubscribers(state, [path]);
  };

  const clearPath = (path: string, removeEmptyObjects = false) => {
    if (typeof state === 'undefined' || state === null) {
      return;
    }

    const pathParts = path.split('.');
    state = deleteDeepPathClone(state, pathParts, removeEmptyObjects);

    notifySubscribers(state, [path]);
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

  const onMount = (fn: () => void) => {
    onMountFn = fn;
  };

  const useState = () => useSyncExternalStore<T>(subscribe, getState);

  const usePath = (path: string) =>
    useSyncExternalStore(subscribePathFactory(path), getPathFactory(path));

  return {
    batch,
    clearPath,
    getPath,
    getState,
    onMount,
    setPath,
    setState,
    useState,
    usePath,
    watchState,
    watchPath,
    // internal fns, do not call directly
    __addSubscriber__: addSubscriber,
    __removeSubscriber__: removeSubscriber,
  };
};
