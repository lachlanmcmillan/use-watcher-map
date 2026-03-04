import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

export interface WatcherPrimitive<T extends unknown> {
  /** get the entire state */
  getState: () => T;
  /** override the entire state */
  setState: (data: T) => void;
  /** useState will re-render the component when the state changes */
  useState: () => T;
  /**
   * watchState will call the supplied function when the state changes.
   * It uses a useEffect underneath to cleanup properly
   */
  watchState: (fn: (value: T) => void) => void;
  // internal fns, do not call directly, exported for testing
  __addSubscriber__: (fn: Function) => void;
  __removeSubscriber__: (fn: Function) => void;
}

/**
 * React hook for managing a single primitive or simple value.
 * Lighter alternative to useWatcherMap when you don't need path-based subscriptions.
 *
 * @param defaultValue - The initial value
 * @returns A WatcherPrimitive with getState, setState, useState, watchState
 *
 * @example
 * const isLoading = useWatcher(false);
 * // In a child component:
 * const loading = isLoading.useState(); // re-renders when value changes
 * // To update:
 * isLoading.setState(true);
 */
export const useWatcherPrimitive = <T extends unknown>(
  defaultValue: T
): WatcherPrimitive<T> => {
  const state = useRef(defaultValue);
  const subscribers = useRef<{ fn: Function }[]>([]);

  const addSubscriber = (fn: Function) => {
    if (!subscribers.current.some(sub => sub.fn === fn)) {
      subscribers.current.push({ fn });
    }
  };

  const removeSubscriber = (fn: Function) => {
    subscribers.current = subscribers.current.filter(sub => sub.fn !== fn);
  };

  const notifySubscribers = (value: T) => {
    for (const subscriber of subscribers.current) {
      subscriber.fn(value);
    }
  };

  const subscribe = useCallback((fn: Function) => {
    addSubscriber(fn);

    return () => removeSubscriber(fn);
  }, []);

  const getState = useCallback(() => state.current, []);

  const setState = useCallback((value: T) => {
    state.current = value;
    notifySubscribers(value);
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

  return {
    getState,
    setState,
    useState: () => useSyncExternalStore<T>(subscribe, getState),
    watchState,
    // internal fns, do not call directly
    __addSubscriber__: addSubscriber,
    __removeSubscriber__: removeSubscriber,
  };
};
