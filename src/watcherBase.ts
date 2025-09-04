import type { PathOf, TypeAtPath } from './pathOf';

export interface WatcherBase<T extends Record<string, any>> {
  /** get the entire state */
  getState: () => T;
  /** get a specific path */
  getPath: <P extends PathOf<T>>(path: P) => TypeAtPath<T, P>;
  /** override the entire state */
  setState: (data: T) => void;
  /** update a specific path */
  setPath: <P extends PathOf<T>>(path: P, value: TypeAtPath<T, P>) => void;
  /** clear a specific path */
  clearPath: (path: PathOf<T>, removeEmptyObjects?: boolean) => void;
  /** make multiple updates and call notifiers at the end */
  batch: (fn: () => void) => void;
  /** useState will re-render the component when the state changes */
  useState: () => T;
  /**
   * usePath will re-render the component when the specified path changes
   *
   * @param path - The path to watch
   * @returns The value at the specified path
   */
  usePath: <P extends PathOf<T>>(path: P) => TypeAtPath<T, P>;
  /**
   * watchState will call the supplied function when the state changes.
   * It uses a useEffect underneath to cleanup properly
   */
  watchState: (fn: (value: T) => void) => void;
  /** watchPath will call the supplied function when the path changes */
  watchPath: <P extends PathOf<T>>(
    path: P,
    fn: (value: TypeAtPath<T, P>) => void
  ) => void;
  // internal fns, do not call directly, exported for testing */
  __addSubscriber__: (fn: Function, path?: PathOf<T>) => void;
  __removeSubscriber__: (fn: Function) => void;
}