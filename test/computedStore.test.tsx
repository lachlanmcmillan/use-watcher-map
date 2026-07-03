import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { computedStore } from '../src/computedStore';
import { watcherStore } from '../src/watcherStore';

describe('computedStore', () => {
  beforeEach(() => {
    mock.restore();
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
