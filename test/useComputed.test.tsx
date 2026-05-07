import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useComputed } from '../src/useComputed';
import { useWatcher } from '../src/index';
import { watcherStore } from '../src/watcherStore';

describe('useComputed', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('initialize with a computed value from the dependency state', () => {
    const store = watcherStore({ count: 2 });

    const { result } = renderHook(() =>
      useComputed(store, state => ({ doubled: state.count * 2 }))
    );

    expect(result.current.getState()).toEqual({ doubled: 4 });
    expect(result.current.getPath('doubled')).toBe(4);
  });
  
  test('update computed state when the dependency changes', () => {
    const store = watcherStore({ count: 2 });
    const computeFn = mock((state: { count: number }) => ({
      doubled: state.count * 2,
    }));
    
    const { result } = renderHook(() => useComputed(store, computeFn));
    
    expect(result.current.getState()).toEqual({ doubled: 4 });
    
    act(() => {
      store.setPath('count', 3);
    });
    
    expect(result.current.getState()).toEqual({ doubled: 6 });
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  test('call subscriber of computed state when the dependency state changes', () => {
    const store = watcherStore({ count: 2 });

    const { result } = renderHook(() =>
      useComputed(store, state => ({ doubled: state.count * 2 }))
    );
    const subscriber = mock(() => {});

    result.current.__addSubscriber__(subscriber);

    act(() => {
      store.setPath('count', 3);
    });

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith({ doubled: 6 });
  });

  test('subscribe to a watcherStore dependency and receive whole-store updates', () => {
    const store = watcherStore({ count: 2, label: 'two' });
    const computeFn = mock((state: { count: number; label: string }) => ({
      summary: `${state.label}:${state.count}`,
    }));

    const { result } = renderHook(() => useComputed(store, computeFn));

    expect(result.current.getState()).toEqual({ summary: 'two:2' });

    act(() => {
      store.setState({ count: 3, label: 'three' });
    });

    expect(result.current.getState()).toEqual({ summary: 'three:3' });
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  test('does not call dependency store onMount when subscribing internally', () => {
    const store = watcherStore({ count: 2 });
    const onMountFn = mock(() => {});

    store.onMount(onMountFn);

    renderHook(() => {
      const computed = useComputed(store, state => ({
        doubled: state.count * 2,
      }));

      return computed.useState();
    });

    expect(onMountFn).not.toHaveBeenCalled();
  });

  test('rerender usePath subscribers when a computed path changes', () => {
    const store = watcherStore({ count: 2 });

    const { result } = renderHook(() => {
      const computed = useComputed(store, state => ({
        doubled: state.count * 2,
      }));

      return computed.usePath('doubled');
    });

    expect(result.current).toBe(4);

    act(() => {
      store.setPath('count', 5);
    });

    expect(result.current).toBe(10);
  });

  test('subscribe to a dependency path and ignore unrelated path changes', () => {
    const store = watcherStore({
      user: { firstName: 'Ada', lastName: 'Lovelace' },
      theme: 'dark',
    });
    const computeFn = mock((user: { firstName: string }) => ({
      displayName: user.firstName,
    }));

    const { result } = renderHook(() => useComputed([store, 'user'], computeFn));

    expect(result.current.getState()).toEqual({ displayName: 'Ada' });
    expect(computeFn).toHaveBeenCalledTimes(1);

    act(() => {
      store.setPath('theme', 'light');
    });

    expect(result.current.getState()).toEqual({ displayName: 'Ada' });
    expect(computeFn).toHaveBeenCalledTimes(1);

    act(() => {
      store.setPath('user.firstName', 'Grace');
    });

    expect(result.current.getState()).toEqual({ displayName: 'Grace' });
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  test('subscribe to a path on a watcherStore dependency', () => {
    const store = watcherStore({
      counts: { active: 2, total: 5 },
      theme: 'dark',
    });
    const computeFn = mock((activeCount: number) => ({
      activeLabel: `${activeCount} active`,
    }));

    const { result } = renderHook(() =>
      useComputed([store, 'counts.active'], computeFn)
    );

    expect(result.current.getState()).toEqual({ activeLabel: '2 active' });
    expect(computeFn).toHaveBeenCalledTimes(1);

    act(() => {
      store.setPath('theme', 'light');
      store.setPath('counts.total', 6);
    });

    expect(result.current.getState()).toEqual({ activeLabel: '2 active' });
    expect(computeFn).toHaveBeenCalledTimes(1);

    act(() => {
      store.setPath('counts.active', 3);
    });

    expect(result.current.getState()).toEqual({ activeLabel: '3 active' });
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  test('support primitive dependencies', () => {
    const { result } = renderHook(() => {
      const count = useWatcher(2);
      const computed = useComputed(count, value => ({ doubled: value * 2 }));

      return { count, computed };
    });

    expect(result.current.computed.getState()).toEqual({ doubled: 4 });

    act(() => {
      result.current.count.setState(7);
    });

    expect(result.current.computed.getState()).toEqual({ doubled: 14 });
  });

  test('unsubscribe from the dependency when the computed hook unmounts', () => {
    const store = watcherStore({ count: 2 });

    const { result, unmount } = renderHook(() =>
      useComputed(store, state => ({ doubled: state.count * 2 }))
    );
    const computed = result.current;

    act(() => {
      store.setPath('count', 3);
    });
    expect(computed.getState()).toEqual({ doubled: 6 });

    unmount();

    act(() => {
      store.setPath('count', 4);
    });

    expect(computed.getState()).toEqual({ doubled: 6 });
  });
});
