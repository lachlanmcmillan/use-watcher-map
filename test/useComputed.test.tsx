import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { memo } from 'react';
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

  test('watchState calls the latest callback after a rerender', () => {
    const store = watcherStore({ count: 2 });
    const calls: string[] = [];

    const { rerender } = renderHook(
      ({ label }: { label: string }) => {
        const computed = useComputed(store, state => ({
          doubled: state.count * 2,
        }));
        computed.watchState(value => calls.push(`${label}:${value.doubled}`));
      },
      { initialProps: { label: 'before' } }
    );

    rerender({ label: 'after' });
    act(() => {
      store.setPath('count', 3);
    });

    expect(calls).toEqual(['after:6']);
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

  test('does not call dependency store onMountPath when subscribing internally', () => {
    const store = watcherStore({ count: 2, label: 'two' });
    const onMountPathFn = mock(() => {});

    store.onMountPath(onMountPathFn);

    renderHook(() => {
      const computed = useComputed(
        { watcher: store, path: 'count' },
        (count: number) => ({ doubled: count * 2 })
      );

      return computed.useState();
    });

    expect(onMountPathFn).not.toHaveBeenCalled();
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

  test('rerender a usePath subscriber when the computed result drops that key', () => {
    const store = watcherStore({ showTotal: true, amount: 5 });

    const { result } = renderHook(() => {
      const computed = useComputed(store, state =>
        state.showTotal
          ? { amount: state.amount, total: state.amount * 2 }
          : { amount: state.amount }
      );

      return computed.usePath('total');
    });

    expect(result.current).toBe(10);

    // "total" is gone from the computed result, the subscriber must see undefined
    act(() => {
      store.setPath('showTotal', false);
    });

    expect(result.current).toBeUndefined();
  });

  test('subscribe to a dependency path and ignore unrelated path changes', () => {
    const store = watcherStore({
      user: { firstName: 'Ada', lastName: 'Lovelace' },
      theme: 'dark',
    });
    const computeFn = mock((user: { firstName: string }) => ({
      displayName: user.firstName,
    }));

    const { result } = renderHook(() =>
      useComputed({ watcher: store, path: 'user' }, computeFn)
    );

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
      useComputed({ watcher: store, path: 'counts.active' }, computeFn)
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

  test('do not notify subscribers when filtered computed array is unchanged', () => {
    const store = watcherStore({
      items: [
        { type: 'fruits', name: 'apple' },
        { type: 'vegetables', name: 'lettuce' },
      ],
    });

    const { result } = renderHook(() =>
      useComputed({ watcher: store, path: 'items' }, items =>
        items.filter(
          (item: { type: string; name: string }) => item.type === 'vegetables'
        )
      )
    );
    const subscriber = mock(() => {});

    result.current.__addSubscriber__(subscriber);

    act(() => {
      store.setPath('items', [
        ...store.getPath('items'),
        { type: 'fruits', name: 'banana' },
      ]);
    });

    expect(result.current.getState()).toEqual([
      { type: 'vegetables', name: 'lettuce' },
    ]);
    expect(subscriber).not.toHaveBeenCalled();

    act(() => {
      store.setPath('items', [
        ...store.getPath('items'),
        { type: 'vegetables', name: 'carrot' },
      ]);
    });

    expect(result.current.getState()).toEqual([
      { type: 'vegetables', name: 'lettuce' },
      { type: 'vegetables', name: 'carrot' },
    ]);
    expect(subscriber).toHaveBeenCalledTimes(1);
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

  test('support primitive computed values', () => {
    const store = watcherStore({
      items: [
        { type: 'fruits', name: 'apple' },
        { type: 'vegetables', name: 'lettuce' },
      ],
    });

    const { result } = renderHook(() =>
      useComputed({ watcher: store, path: 'items' }, items =>
        items.some(
          (item: { type: string; name: string }) => item.type === 'vegetables'
        )
      )
    );
    const subscriber = mock(() => {});

    result.current.__addSubscriber__(subscriber);

    expect(result.current.getState()).toBe(true);

    act(() => {
      store.setPath('items', [
        ...store.getPath('items'),
        { type: 'fruits', name: 'banana' },
      ]);
    });

    expect(result.current.getState()).toBe(true);
    expect(subscriber).not.toHaveBeenCalled();

    act(() => {
      store.setPath(
        'items',
        store
          .getPath('items')
          .filter((item: { type: string }) => item.type !== 'vegetables')
      );
    });

    expect(result.current.getState()).toBe(false);
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith(false);
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

  // --- array of dependencies ---

  test('initialize with a computed value derived from an array of store dependencies', () => {
    const storeA = watcherStore({ count: 2 });
    const storeB = watcherStore({ count: 3 });

    const { result } = renderHook(() =>
      useComputed(
        [storeA, storeB],
        ([a, b]: [{ count: number }, { count: number }]) => ({
          sum: a.count + b.count,
        })
      )
    );

    expect(result.current.getState()).toEqual({ sum: 5 });
  });

  test('recompute when any store in the dependency array changes', () => {
    const storeA = watcherStore({ count: 2 });
    const storeB = watcherStore({ count: 3 });
    const computeFn = mock(
      ([a, b]: [{ count: number }, { count: number }]) => ({
        sum: a.count + b.count,
      })
    );

    const { result } = renderHook(() =>
      useComputed([storeA, storeB], computeFn)
    );

    expect(result.current.getState()).toEqual({ sum: 5 });
    expect(computeFn).toHaveBeenCalledTimes(1);

    act(() => {
      storeA.setPath('count', 10);
    });

    expect(result.current.getState()).toEqual({ sum: 13 });
    expect(computeFn).toHaveBeenCalledTimes(2);

    act(() => {
      storeB.setPath('count', 20);
    });

    expect(result.current.getState()).toEqual({ sum: 30 });
    expect(computeFn).toHaveBeenCalledTimes(3);
  });

  test('initialize with a computed value derived from an array of path subscriptions', () => {
    const storeA = watcherStore({ user: { firstName: 'Ada' } });
    const storeB = watcherStore({ user: { firstName: 'Grace' } });

    const { result } = renderHook(() =>
      useComputed(
        [
          { watcher: storeA, path: 'user.firstName' },
          { watcher: storeB, path: 'user.firstName' },
        ],
        ([a, b]: [string, string]) => `${a} & ${b}`
      )
    );

    expect(result.current.getState()).toBe('Ada & Grace');
  });

  test('recompute when any path subscription in the dependency array changes', () => {
    const storeA = watcherStore({ user: { firstName: 'Ada' }, theme: 'dark' });
    const storeB = watcherStore({
      user: { firstName: 'Grace' },
      theme: 'light',
    });
    const computeFn = mock(([a, b]: [string, string]) => `${a} & ${b}`);

    const { result } = renderHook(() =>
      useComputed(
        [
          { watcher: storeA, path: 'user.firstName' },
          { watcher: storeB, path: 'user.firstName' },
        ],
        computeFn
      )
    );

    expect(result.current.getState()).toBe('Ada & Grace');
    expect(computeFn).toHaveBeenCalledTimes(1);

    // unrelated paths do not trigger a recompute
    act(() => {
      storeA.setPath('theme', 'light');
      storeB.setPath('theme', 'dark');
    });

    expect(computeFn).toHaveBeenCalledTimes(1);

    act(() => {
      storeB.setPath('user.firstName', 'Hopper');
    });

    expect(result.current.getState()).toBe('Ada & Hopper');
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  test('recompute when any of several path subscriptions on the SAME store changes', () => {
    const store = watcherStore({
      user: { firstName: 'Ada', lastName: 'Lovelace' },
      theme: 'dark',
    });
    const computeFn = mock(([a, b]: [string, string]) => `${a} ${b}`);

    const { result } = renderHook(() =>
      useComputed(
        [
          { watcher: store, path: 'user.firstName' },
          { watcher: store, path: 'user.lastName' },
        ],
        computeFn
      )
    );

    expect(result.current.getState()).toBe('Ada Lovelace');
    expect(computeFn).toHaveBeenCalledTimes(1);

    // a change to the first path recomputes
    act(() => {
      store.setPath('user.firstName', 'Grace');
    });

    expect(result.current.getState()).toBe('Grace Lovelace');
    expect(computeFn).toHaveBeenCalledTimes(2);

    // a change to the second path alone must also recompute
    act(() => {
      store.setPath('user.lastName', 'Hopper');
    });

    expect(result.current.getState()).toBe('Grace Hopper');
    expect(computeFn).toHaveBeenCalledTimes(3);
  });

  test('support a mixed array of stores and path subscriptions', () => {
    const storeA = watcherStore({ multiplier: 3 });
    const storeB = watcherStore({ value: 5, label: 'count' });

    const { result } = renderHook(() =>
      useComputed(
        [storeA, { watcher: storeB, path: 'value' }],
        ([a, value]: [{ multiplier: number }, number]) => ({
          product: a.multiplier * value,
        })
      )
    );

    expect(result.current.getState()).toEqual({ product: 15 });

    // the path subscription only watches `value`, so changing `label` on
    // storeB must not trigger a recompute
    act(() => {
      storeB.setPath('label', 'total');
    });

    expect(result.current.getState()).toEqual({ product: 15 });

    // a whole-store dependency re-notifies on any change to storeA
    act(() => {
      storeA.setPath('multiplier', 4);
    });

    expect(result.current.getState()).toEqual({ product: 20 });

    act(() => {
      storeB.setPath('value', 10);
    });

    expect(result.current.getState()).toEqual({ product: 40 });
  });

  test('does not recompute when an omitted regular dependency changes', () => {
    const computeFn = mock(
      (watcherValue: number, primitiveNumber: number) =>
        watcherValue + primitiveNumber
    );
    const { result, rerender } = renderHook(
      ({ primitiveNumber }) => {
        const watcherNumber = useWatcher(2);
        const computed = useComputed(watcherNumber, watcherValue =>
          computeFn(watcherValue, primitiveNumber)
        );

        return computed.useState();
      },
      { initialProps: { primitiveNumber: 3 } }
    );

    expect(result.current).toBe(5);
    expect(computeFn).toHaveBeenCalledTimes(1);

    rerender({ primitiveNumber: 4 });

    expect(result.current).toBe(5);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  test('recompute when an included primitive dependency changes', () => {
    const computeFn = mock(
      (watcherValue: number, primitiveNumber: number) =>
        watcherValue + primitiveNumber
    );
    const { result, rerender } = renderHook(
      ({ primitiveNumber }) => {
        const watcherNumber = useWatcher(2);
        const computed = useComputed(
          [watcherNumber, primitiveNumber],
          ([watcherValue]) => computeFn(watcherValue, primitiveNumber)
        );

        return computed.useState();
      },
      { initialProps: { primitiveNumber: 3 } }
    );

    expect(result.current).toBe(5);
    expect(computeFn).toHaveBeenCalledTimes(1);

    rerender({ primitiveNumber: 3 });

    expect(result.current).toBe(5);
    expect(computeFn).toHaveBeenCalledTimes(1);

    rerender({ primitiveNumber: 4 });

    expect(result.current).toBe(6);
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  test('same-component useState does not re-render after a primitive dep change', async () => {
    // When a primitive dep changes, useComputed writes the new snapshot during
    // *this* render so useState() already returns it:
    //
    //   const doubled = useComputed(someNumber, n => n * 2);
    //   const nx2 = doubled.useState(); // 6 on the someNumber: 2 → 3 render
    //
    // Subscriber notify is deferred to a microtask so React can first cache
    // that snapshot. useSyncExternalStore then compares (both 6) and bails
    // out — no second render. A memoized child still gets the notify.
    let renderCount = 0;

    const { result, rerender } = renderHook(
      ({ someNumber }) => {
        renderCount++;
        const doubled = useComputed(someNumber, (n: number) => n * 2);
        return doubled.useState();
      },
      { initialProps: { someNumber: 2 } }
    );

    expect(result.current).toBe(4);
    const rendersAfterMount = renderCount;

    rerender({ someNumber: 3 });
    await act(async () => {});

    expect(result.current).toBe(6);
    expect(renderCount).toBe(rendersAfterMount + 1);
  });

  test('child useState still updates when a primitive dep changes on the parent', async () => {
    // memo child does not re-render just because the parent did. It only updates
    // when useSyncExternalStore is notified — which is pendingNotify's job.
    const Child = memo(function Child({
      computed,
    }: {
      computed: { useState: () => number };
    }) {
      return <span>{computed.useState()}</span>;
    });

    function Parent({ someNumber }: { someNumber: number }) {
      const doubled = useComputed(someNumber, (n: number) => n * 2);
      return <Child computed={doubled} />;
    }

    const { rerender } = render(<Parent someNumber={2} />);
    expect(document.body.textContent).toBe('4');

    rerender(<Parent someNumber={3} />);
    await waitFor(() => expect(document.body.textContent).toBe('6'));
  });

  test('does not re-render the owner when a computed dep updates unless the owner is subscribed', () => {
    // Creating watchers + a computed does not subscribe this component. setState
    // on a source watcher updates the computed store, but the owner only
    // re-renders if it called useState/usePath on one of them.
    //
    //   const w1 = useWatcher(101);
    //   const w2 = useWatcher(102);
    //   const product = useComputed([w1, w2], ([a, b]) => a * b);
    //   const handleClick = () => w1.setState(w1.getState() + 1);
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      const watcher1 = useWatcher(101);
      const watcher2 = useWatcher(102);
      const product = useComputed(
        [watcher1, watcher2],
        ([a, b]: [number, number]) => a * b
      );
      return { watcher1, product };
    });

    expect(result.current.product.getState()).toBe(10302);
    const rendersAfterMount = renderCount;

    act(() => {
      result.current.watcher1.setState(result.current.watcher1.getState() + 1);
    });

    expect(renderCount).toBe(rendersAfterMount);
    expect(result.current.product.getState()).toBe(10404);
  });

  test('re-renders the owner when it is subscribed to a computed that updates', () => {
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      const watcher1 = useWatcher(101);
      const watcher2 = useWatcher(102);
      const product = useComputed(
        [watcher1, watcher2],
        ([a, b]: [number, number]) => a * b
      );
      return { watcher1, value: product.useState() };
    });

    expect(result.current.value).toBe(10302);
    const rendersAfterMount = renderCount;

    act(() => {
      result.current.watcher1.setState(result.current.watcher1.getState() + 1);
    });

    expect(result.current.value).toBe(10404);
    expect(renderCount).toBe(rendersAfterMount + 1);
  });

  test('recompute when a regular dependency changes reference', () => {
    const store = watcherStore({ count: 2 });
    const initialOptions = { multiplier: 3 };
    const computeFn = mock(
      ([state, options]: [{ count: number }, { multiplier: number }]) =>
        state.count * options.multiplier
    );

    const { result, rerender } = renderHook(
      ({ options }) => {
        const computed = useComputed([store, options], computeFn);
        return computed.useState();
      },
      { initialProps: { options: initialOptions } }
    );

    expect(result.current).toBe(6);
    expect(computeFn).toHaveBeenCalledTimes(1);

    rerender({ options: initialOptions });

    expect(result.current).toBe(6);
    expect(computeFn).toHaveBeenCalledTimes(1);

    rerender({ options: { multiplier: 4 } });

    expect(result.current).toBe(8);
    expect(computeFn).toHaveBeenCalledTimes(2);

    act(() => {
      store.setPath('count', 5);
    });

    expect(result.current).toBe(20);
    expect(computeFn).toHaveBeenCalledTimes(3);
  });

  test('does not recompute or resubscribe when a path dependency wrapper is recreated', () => {
    const store = watcherStore({ count: 2 });
    const originalAddSubscriber = store.__addSubscriber__;
    const originalRemoveSubscriber = store.__removeSubscriber__;
    const addSubscriber = mock(originalAddSubscriber);
    const removeSubscriber = mock(originalRemoveSubscriber);
    const computeFn = mock((count: number) => count * 2);

    store.__addSubscriber__ = addSubscriber;
    store.__removeSubscriber__ = removeSubscriber;

    const { result, rerender, unmount } = renderHook(
      ({ unrelatedProp }) => {
        const computed = useComputed(
          { watcher: store, path: 'count' },
          computeFn
        );
        return { value: computed.useState(), unrelatedProp };
      },
      { initialProps: { unrelatedProp: 1 } }
    );

    expect(result.current.value).toBe(4);
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(addSubscriber).toHaveBeenCalledTimes(1);
    expect(removeSubscriber).not.toHaveBeenCalled();

    rerender({ unrelatedProp: 2 });

    expect(result.current.value).toBe(4);
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(addSubscriber).toHaveBeenCalledTimes(1);
    expect(removeSubscriber).not.toHaveBeenCalled();

    unmount();

    expect(removeSubscriber).toHaveBeenCalledTimes(1);
  });

  test('recompute and resubscribe when a path dependency changes', () => {
    const store = watcherStore({ first: 2, second: 5 });
    const computeFn = mock((value: number) => value * 2);

    const { result, rerender } = renderHook(
      ({ path }: { path: 'first' | 'second' }) => {
        const computed = useComputed({ watcher: store, path }, computeFn);
        return computed.useState();
      },
      { initialProps: { path: 'first' as 'first' | 'second' } }
    );

    expect(result.current).toBe(4);
    expect(computeFn).toHaveBeenCalledTimes(1);

    rerender({ path: 'second' });

    expect(result.current).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(2);

    act(() => {
      store.setPath('first', 3);
    });

    expect(result.current).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(2);

    act(() => {
      store.setPath('second', 6);
    });

    expect(result.current).toBe(12);
    expect(computeFn).toHaveBeenCalledTimes(3);
  });

  test('recompute and resubscribe when a watcher dependency changes reference', () => {
    const storeA = watcherStore({ count: 2 });
    const storeB = watcherStore({ count: 5 });
    const computeFn = mock((state: { count: number }) => state.count * 2);

    const { result, rerender } = renderHook(
      ({ store }) => {
        const computed = useComputed(store, computeFn);
        return computed.useState();
      },
      { initialProps: { store: storeA } }
    );

    expect(result.current).toBe(4);
    expect(computeFn).toHaveBeenCalledTimes(1);

    rerender({ store: storeB });

    expect(result.current).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(2);

    act(() => {
      storeA.setPath('count', 3);
    });

    expect(result.current).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(2);

    act(() => {
      storeB.setPath('count', 6);
    });

    expect(result.current).toBe(12);
    expect(computeFn).toHaveBeenCalledTimes(3);
  });

  test('preserve dependency value order across watcher, path, primitive, and object dependencies', () => {
    const store = watcherStore({ count: 2 });
    const pathStore = watcherStore({ value: 5 });
    const options = { multiplier: 3 };
    const computeFn = mock((values: any[]) => values);

    const { result } = renderHook(() =>
      useComputed(
        [store, { watcher: pathStore, path: 'value' }, 'label', options],
        computeFn
      )
    );

    const values = result.current.getState() as [
      { count: number },
      number,
      string,
      typeof options,
    ];
    expect(values).toEqual([store.getState(), 5, 'label', options]);
    expect(values[3]).toBe(options);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  test('unsubscribe only watcher dependencies from a mixed dependency array', () => {
    const store = watcherStore({ count: 2 });
    const originalRemoveSubscriber = store.__removeSubscriber__;
    const removeSubscriber = mock(originalRemoveSubscriber);
    const regularRemoveSubscriber = mock(() => {});
    const regularDependency = {
      multiplier: 3,
      __removeSubscriber__: regularRemoveSubscriber,
    };

    store.__removeSubscriber__ = removeSubscriber;

    const { unmount } = renderHook(() =>
      useComputed(
        [store, 4, regularDependency],
        ([state, primitiveNumber, options]) =>
          state.count * primitiveNumber * options.multiplier
      )
    );

    unmount();

    expect(removeSubscriber).toHaveBeenCalledTimes(1);
    expect(regularRemoveSubscriber).not.toHaveBeenCalled();
  });

  test('do not notify subscribers when the computed result is shallow-equal across array updates', () => {
    const storeA = watcherStore({ count: 2 });
    const storeB = watcherStore({ label: 'two' });

    const { result } = renderHook(() =>
      useComputed(
        [storeA, storeB],
        ([a, b]: [{ count: number }, { label: string }]) => ({
          summary: `${b.label}:${a.count}`,
        })
      )
    );
    const subscriber = mock(() => {});

    result.current.__addSubscriber__(subscriber);

    expect(result.current.getState()).toEqual({ summary: 'two:2' });
    expect(subscriber).not.toHaveBeenCalled();

    // changing an unrelated part of the dependency values keeps the computed
    // value shallow-equal, so no subscriber notification
    act(() => {
      storeA.setPath('count', 2);
    });

    expect(result.current.getState()).toEqual({ summary: 'two:2' });
    expect(subscriber).not.toHaveBeenCalled();

    act(() => {
      storeB.setPath('label', 'three');
    });

    expect(result.current.getState()).toEqual({ summary: 'three:2' });
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  test('unsubscribe from every dependency in the array when the computed hook unmounts', () => {
    const storeA = watcherStore({ count: 2 });
    const storeB = watcherStore({ count: 3 });

    const { result, unmount } = renderHook(() =>
      useComputed(
        [storeA, storeB],
        ([a, b]: [{ count: number }, { count: number }]) => ({
          sum: a.count + b.count,
        })
      )
    );
    const computed = result.current;

    act(() => {
      storeA.setPath('count', 10);
    });
    expect(computed.getState()).toEqual({ sum: 13 });

    unmount();

    act(() => {
      storeA.setPath('count', 100);
      storeB.setPath('count', 200);
    });

    expect(computed.getState()).toEqual({ sum: 13 });
  });

  test('does not call onMount for any watcherStore in the dependency array', () => {
    const storeA = watcherStore({ count: 2 });
    const storeB = watcherStore({ count: 3 });
    const onMountA = mock(() => {});
    const onMountB = mock(() => {});

    storeA.onMount(onMountA);
    storeB.onMount(onMountB);

    renderHook(() => {
      const computed = useComputed(
        [storeA, storeB],
        ([a, b]: [{ count: number }, { count: number }]) => ({
          sum: a.count + b.count,
        })
      );

      return computed.useState();
    });

    expect(onMountA).not.toHaveBeenCalled();
    expect(onMountB).not.toHaveBeenCalled();
  });

  // --- computed-of-computed ---

  test('subscribe a computed to another computed (whole-value dependency)', () => {
    const store = watcherStore({ count: 2 });

    const { result: doubledResult } = renderHook(() =>
      useComputed(store, s => ({ doubled: s.count * 2 }))
    );
    const { result: quadrupledResult } = renderHook(() =>
      useComputed(doubledResult.current, d => ({ quadrupled: d.doubled * 2 }))
    );

    expect(quadrupledResult.current.getState()).toEqual({ quadrupled: 8 });

    act(() => store.setPath('count', 3));

    expect(doubledResult.current.getState()).toEqual({ doubled: 6 });
    expect(quadrupledResult.current.getState()).toEqual({ quadrupled: 12 });
  });

  test('subscribe a computed to a path on another computed', () => {
    const store = watcherStore({ count: 2 });

    const { result: doubledResult } = renderHook(() =>
      useComputed(store, s => ({ doubled: s.count * 2 }))
    );
    const { result: quadrupledResult } = renderHook(() =>
      useComputed(
        { watcher: doubledResult.current, path: 'doubled' },
        (d: number) => ({ quadrupled: d * 2 })
      )
    );
    const subscriber = mock(() => {});

    quadrupledResult.current.__addSubscriber__(subscriber);

    expect(quadrupledResult.current.getState()).toEqual({ quadrupled: 8 });

    act(() => store.setPath('count', 3));

    expect(quadrupledResult.current.getState()).toEqual({ quadrupled: 12 });
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith({ quadrupled: 12 });
  });

  test('computed-of-computed unsubscribes when the outer hook unmounts', () => {
    const store = watcherStore({ count: 2 });

    const { result: doubledResult } = renderHook(() =>
      useComputed(store, s => ({ doubled: s.count * 2 }))
    );
    const { result: quadrupledResult, unmount } = renderHook(() =>
      useComputed(doubledResult.current, d => ({ quadrupled: d.doubled * 2 }))
    );
    const quadrupled = quadrupledResult.current;

    act(() => store.setPath('count', 3));
    expect(quadrupled.getState()).toEqual({ quadrupled: 12 });

    unmount();

    act(() => store.setPath('count', 4));

    // the unmounted outer computed stops receiving updates, while the inner
    // computed keeps running
    expect(quadrupled.getState()).toEqual({ quadrupled: 12 });
    expect(doubledResult.current.getState()).toEqual({ doubled: 8 });
  });

  test('subscribe a computed to an array of computeds', () => {
    const storeA = watcherStore({ count: 2 });
    const storeB = watcherStore({ count: 3 });

    const { result: doubledA } = renderHook(() =>
      useComputed(storeA, s => ({ doubled: s.count * 2 }))
    );
    const { result: doubledB } = renderHook(() =>
      useComputed(storeB, s => ({ doubled: s.count * 2 }))
    );

    const { result: sum } = renderHook(() =>
      useComputed(
        [doubledA.current, doubledB.current],
        ([a, b]: [{ doubled: number }, { doubled: number }]) => ({
          sum: a.doubled + b.doubled,
        })
      )
    );

    expect(sum.current.getState()).toEqual({ sum: 10 });

    act(() => storeA.setPath('count', 5));
    expect(sum.current.getState()).toEqual({ sum: 16 });

    act(() => storeB.setPath('count', 6));
    expect(sum.current.getState()).toEqual({ sum: 22 });
  });

  test('subscribe a computed to a mixed array including a computed and a path on a computed', () => {
    const storeA = watcherStore({ multiplier: 3 });
    const storeB = watcherStore({ value: 5 });

    const { result: valueComputed } = renderHook(() =>
      useComputed(storeB, s => ({ value: s.value }))
    );

    const { result: product } = renderHook(() =>
      useComputed(
        [storeA, { watcher: valueComputed.current, path: 'value' }],
        ([a, value]: [{ multiplier: number }, number]) => ({
          product: a.multiplier * value,
        })
      )
    );
    const subscriber = mock(() => {});

    product.current.__addSubscriber__(subscriber);

    expect(product.current.getState()).toEqual({ product: 15 });

    // changing the source storeB propagates through valueComputed into product
    act(() => storeB.setPath('value', 10));
    expect(valueComputed.current.getState()).toEqual({ value: 10 });
    expect(product.current.getState()).toEqual({ product: 30 });
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith({ product: 30 });

    // changing storeA also propagates
    act(() => storeA.setPath('multiplier', 4));
    expect(product.current.getState()).toEqual({ product: 40 });
  });

  test('do not notify computed-of-computed subscribers when the result is shallow-equal', () => {
    const store = watcherStore({ count: 2, label: 'two' });

    const { result: doubled } = renderHook(() =>
      useComputed(store, s => ({ doubled: s.count * 2 }))
    );
    const { result: quadrupled } = renderHook(() =>
      useComputed(doubled.current, d => ({ quadrupled: d.doubled * 2 }))
    );
    const subscriber = mock(() => {});

    quadrupled.current.__addSubscriber__(subscriber);

    expect(quadrupled.current.getState()).toEqual({ quadrupled: 8 });
    expect(subscriber).not.toHaveBeenCalled();

    // changing `label` on the source store changes the doubled computed's
    // input state, but the doubled *result* is shallow-equal, so neither
    // doubled nor quadrupled should notify
    act(() => store.setPath('label', 'deux'));

    expect(doubled.current.getState()).toEqual({ doubled: 4 });
    expect(quadrupled.current.getState()).toEqual({ quadrupled: 8 });
    expect(subscriber).not.toHaveBeenCalled();

    act(() => store.setPath('count', 3));

    expect(quadrupled.current.getState()).toEqual({ quadrupled: 12 });
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  // --- computeFn prev-value argument ---

  test('computeFn receives the previous computed value as its second argument', () => {
    const store = watcherStore({ count: 2 });
    const seen: Array<{ value: number; prev: number | undefined }> = [];

    const { result } = renderHook(() =>
      useComputed(
        store,
        (state: { count: number }, prev?: { doubled: number }) => {
          seen.push({ value: state.count, prev: prev?.doubled });
          return { doubled: state.count * 2 };
        }
      )
    );

    expect(result.current.getState()).toEqual({ doubled: 4 });
    // on initial compute, prev is undefined
    expect(seen).toEqual([{ value: 2, prev: undefined }]);

    act(() => store.setPath('count', 3));

    expect(result.current.getState()).toEqual({ doubled: 6 });
    // on update, prev is the previously-computed state
    expect(seen[1]).toEqual({ value: 3, prev: 4 });
  });

  test('returning prev from computeFn skips subscriber notification via reference equality', () => {
    const store = watcherStore({
      items: [
        { type: 'vegetables', name: 'lettuce' },
        { type: 'vegetables', name: 'carrot' },
        { type: 'fruits', name: 'apple' },
      ],
    });

    // deep equality check for arrays-of-strings (the deduplicated value)
    const deepEqual = (a: any, b: any): boolean => {
      if (a === b) return true;
      if (typeof a !== typeof b) return false;
      if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
      }
      if (a && b && typeof a === 'object' && typeof b === 'object') {
        const ak = Object.keys(a);
        const bk = Object.keys(b);
        return ak.length === bk.length && ak.every(k => deepEqual(a[k], b[k]));
      }
      return a === b;
    };

    const { result } = renderHook(() =>
      useComputed(
        { watcher: store, path: 'items' },
        (items: { type: string; name: string }[], prev?: string[]) => {
          const names = [...new Set(items.map(x => x.name))];
          // returning prev keeps the same reference, so the watcher treats it
          // as unchanged and skips notifying subscribers
          return deepEqual(names, prev) ? (prev as string[]) : names;
        }
      )
    );
    const subscriber = mock(() => {});

    result.current.__addSubscriber__(subscriber);

    const firstState = result.current.getState();
    expect(firstState).toEqual(['lettuce', 'carrot', 'apple']);
    expect(subscriber).not.toHaveBeenCalled();

    // adding an item whose name is already present keeps the deduped list
    // identical, so computeFn returns prev and no notification fires
    act(() => {
      store.setPath('items', [
        ...store.getPath('items'),
        { type: 'vegetables', name: 'lettuce' },
      ]);
    });

    expect(result.current.getState()).toBe(firstState);
    expect(subscriber).not.toHaveBeenCalled();

    // adding an item with a brand-new name changes the deduped list, so
    // computeFn returns a fresh array and subscribers are notified
    act(() => {
      store.setPath('items', [
        ...store.getPath('items'),
        { type: 'fruits', name: 'banana' },
      ]);
    });

    expect(result.current.getState()).toEqual([
      'lettuce',
      'carrot',
      'apple',
      'banana',
    ]);
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith([
      'lettuce',
      'carrot',
      'apple',
      'banana',
    ]);
  });

  test('a plain object with watcher and path keys is a value, not a path subscription', () => {
    // #19: only a real watcher makes { watcher, path } a subscription
    const plain = { watcher: 'x', path: 'y' };
    const computeFn = mock((value: any) => value);

    const { result } = renderHook(() => useComputed(plain as any, computeFn));

    expect(result.current.getState()).toBe(plain);
    expect(computeFn).toHaveBeenCalledWith(plain, undefined);
  });

  test('a store notify uses the latest computeFn closure after a rerender', () => {
    // #6: computeFn closes over a prop that is not a dependency. a store
    // notify must call the current closure, not the one the effect captured
    const store = watcherStore({ count: 2 });

    const { result, rerender } = renderHook(
      ({ multiplier }: { multiplier: number }) =>
        useComputed(store, state => ({ value: state.count * multiplier })),
      { initialProps: { multiplier: 1 } }
    );

    expect(result.current.getState()).toEqual({ value: 2 });

    // no dependency changed, so no recompute yet (same rule as useMemo)
    rerender({ multiplier: 10 });
    expect(result.current.getState()).toEqual({ value: 2 });

    act(() => {
      store.setPath('count', 3);
    });

    expect(result.current.getState()).toEqual({ value: 30 });
  });
});
