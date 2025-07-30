import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useWatcher } from '../src/useWatcher';

describe('useWatcher', () => {
  const initialState = 0;

  beforeEach(() => {
    mock.restore();
  });

  test('initialize with the default state', () => {
    const { result } = renderHook(() => useWatcher(initialState));
    expect(result.current.getState()).toEqual(initialState);
  });

  describe('setState', () => {
    test('update the entire state', () => {
      const { result } = renderHook(() => useWatcher(initialState));
      const newState = 5;

      act(() => {
        result.current.setState(newState);
      });

      expect(result.current.getState()).toEqual(newState);
    });
  });

  /**
   * NOTE. getting react hooks like useEffect and useSyncExternalStore to work
   * in tests is a pain, so we're calling addSubscriber and removeSubscriber
   * directly to test how the functionality works.
   */
  describe('watchState', () => {
    test('call the subscriber when setState is called', () => {
      const { result } = renderHook(() => useWatcher(initialState));
      const mockFn = mock(() => {});
      const updatedState = 10;

      result.current.__addSubscriber__(mockFn);
      act(() => {
        result.current.setState(updatedState);
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(updatedState);
    });

    test('no longer call the function after removing subscriber', () => {
      const { result } = renderHook(() => useWatcher(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn);
      act(() => {
        result.current.setState(5);
      });
      expect(mockFn).toHaveBeenCalledTimes(1);

      result.current.__removeSubscriber__(mockFn);
      act(() => {
        result.current.setState(10);
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
