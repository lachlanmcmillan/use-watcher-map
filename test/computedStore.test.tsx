import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { computedStore } from '../src/computedStore';
import { watcherStore } from '../src/watcherStore';

describe('computedStore', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('watchPath calls the latest callback after a rerender', () => {
    const store = watcherStore({ count: 2 });
    const computed = computedStore(store, (state: { count: number }) => ({
      doubled: state.count * 2,
    }));
    const calls: string[] = [];

    const { rerender } = renderHook(
      ({ label }: { label: string }) =>
        computed.watchPath('doubled', value => calls.push(`${label}:${value}`)),
      { initialProps: { label: 'before' } }
    );

    rerender({ label: 'after' });
    act(() => {
      store.setPath('count', 3);
    });

    expect(calls).toEqual(['after:6']);
  });

  test('does not compute or subscribe until read or mounted', () => {
    const store = watcherStore({ count: 2 });
    const computeFn = mock((state: { count: number }) => ({
      doubled: state.count * 2,
    }));

    const computed = computedStore(store, computeFn);

    expect(computeFn).not.toHaveBeenCalled();

    store.setPath('count', 3);
    expect(computeFn).not.toHaveBeenCalled();

    expect(computed.getState()).toEqual({ doubled: 6 });
    expect(computeFn).toHaveBeenCalledTimes(1);

    store.setPath('count', 4);
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(computed.getState()).toEqual({ doubled: 8 });
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  test('returns a stable reference from repeated unmounted reads when dependencies are unchanged', () => {
    const store = watcherStore({ items: [{ type: 'veg' }, { type: 'fruit' }] });
    // the result contains a freshly built nested array, so two calls of
    // computeFn are never shallow-equal to each other
    const computeFn = mock((state: { items: { type: string }[] }) => ({
      veg: state.items.filter(i => i.type === 'veg'),
    }));

    const computed = computedStore(store, computeFn);

    const first = computed.getState();
    expect(computeFn).toHaveBeenCalledTimes(1);

    // nothing changed, so the same reference must come back and computeFn
    // must not run again. useSyncExternalStore requires this of getSnapshot.
    expect(computed.getState()).toBe(first);
    expect(computed.getPath('veg')).toBe(first.veg);
    expect(computeFn).toHaveBeenCalledTimes(1);

    // a dependency change invalidates the cache
    store.setPath('items', [{ type: 'veg' }]);
    const second = computed.getState();
    expect(second).not.toBe(first);
    expect(second.veg).toHaveLength(1);
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  test('getPath computes from current dependency values without subscribing', () => {
    const store = watcherStore({ count: 2 });
    const computeFn = mock((state: { count: number }) => ({
      nested: { doubled: state.count * 2 },
    }));

    const computed = computedStore(store, computeFn);

    expect(computed.getPath('nested.doubled')).toBe(4);
    expect(computeFn).toHaveBeenCalledTimes(1);

    store.setPath('count', 5);
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(computed.getPath('nested.doubled')).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  test('usePath subscribes to dependencies while mounted', () => {
    const store = watcherStore({ count: 2 });
    const computed = computedStore(store, (state: { count: number }) => ({
      doubled: state.count * 2,
    }));

    const { result } = renderHook(() => computed.usePath('doubled'));

    expect(result.current).toBe(4);

    act(() => {
      store.setPath('count', 5);
    });

    expect(result.current).toBe(10);
  });

  test('unsubscribes from dependencies when the last subscriber unmounts', () => {
    const store = watcherStore({ count: 2 });
    const computeFn = mock((state: { count: number }) => ({
      doubled: state.count * 2,
    }));
    const computed = computedStore(store, computeFn);

    const { unmount } = renderHook(() => computed.useState());

    act(() => {
      store.setPath('count', 3);
    });
    const callCountWhileMounted = computeFn.mock.calls.length;

    unmount();

    act(() => {
      store.setPath('count', 4);
    });

    expect(computeFn).toHaveBeenCalledTimes(callCountWhileMounted);
  });

  test('path dependencies ignore unrelated path changes', () => {
    const store = watcherStore({
      user: { firstName: 'Ada', lastName: 'Lovelace' },
      theme: 'dark',
    });
    const computeFn = mock((firstName: string) => ({
      displayName: firstName,
    }));
    const computed = computedStore(
      { watcher: store, path: 'user.firstName' },
      computeFn
    );

    const { result } = renderHook(() => computed.usePath('displayName'));

    expect(result.current).toBe('Ada');

    act(() => {
      store.setPath('theme', 'light');
      store.setPath('user.lastName', 'Hopper');
    });

    expect(result.current).toBe('Ada');

    act(() => {
      store.setPath('user.firstName', 'Grace');
    });

    expect(result.current).toBe('Grace');
  });

  test('rerenders a usePath subscriber when the computed result drops that key', () => {
    const store = watcherStore({ showTotal: true, amount: 5 });
    const computed = computedStore(
      store,
      (state: { showTotal: boolean; amount: number }) =>
        state.showTotal
          ? { amount: state.amount, total: state.amount * 2 }
          : { amount: state.amount }
    );

    const { result } = renderHook(() => computed.usePath('total'));

    expect(result.current).toBe(10);

    // "total" is gone from the computed result, the subscriber must see undefined
    act(() => {
      store.setPath('showTotal', false);
    });

    expect(result.current).toBeUndefined();
  });

  test('recomputes when any of several path dependencies on the SAME store changes', () => {
    const store = watcherStore({
      user: { firstName: 'Ada', lastName: 'Lovelace' },
      theme: 'dark',
    });
    const computeFn = mock(([firstName, lastName]: [string, string]) => ({
      displayName: `${firstName} ${lastName}`,
    }));
    const computed = computedStore(
      [
        { watcher: store, path: 'user.firstName' },
        { watcher: store, path: 'user.lastName' },
      ],
      computeFn
    );

    const { result } = renderHook(() => computed.usePath('displayName'));

    expect(result.current).toBe('Ada Lovelace');

    // a change to the first path recomputes
    act(() => {
      store.setPath('user.firstName', 'Grace');
    });

    expect(result.current).toBe('Grace Lovelace');

    // a change to the second path alone must also recompute
    act(() => {
      store.setPath('user.lastName', 'Hopper');
    });

    expect(result.current).toBe('Grace Hopper');
  });

  test('supports computed stores depending on other computed stores', () => {
    const store = watcherStore({ count: 2 });
    const doubled = computedStore(store, (state: { count: number }) => ({
      doubled: state.count * 2,
    }));
    const quadrupled = computedStore(doubled, (state: { doubled: number }) => ({
      quadrupled: state.doubled * 2,
    }));

    const { result } = renderHook(() => quadrupled.usePath('quadrupled'));

    expect(result.current).toBe(8);

    act(() => {
      store.setPath('count', 3);
    });

    expect(result.current).toBe(12);
  });

  test('does not notify subscribers when the computed result is shallow-equal', () => {
    const store = watcherStore({ count: 2, label: 'two' });
    const computed = computedStore(store, (state: { count: number }) => ({
      doubled: state.count * 2,
    }));
    const subscriber = mock(() => {});

    computed.__addSubscriber__(subscriber);

    act(() => {
      store.setPath('label', 'deux');
    });

    expect(subscriber).not.toHaveBeenCalled();

    act(() => {
      store.setPath('count', 3);
    });

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith({ doubled: 6 });
  });
});
