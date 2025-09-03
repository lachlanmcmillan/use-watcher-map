import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { watcherStore } from '../src/watcherStore';

describe('watcherStore', () => {
  const initialState = {
    todos: [
      {
        id: 1,
        text: 'Learn React',
        completed: true,
        tags: ['frontend', 'learning'],
      },
      {
        id: 2,
        text: 'Build a project',
        completed: false,
        tags: ['coding', 'project'],
      },
    ],
    filter: 'all',
    nextId: 3,
  };

  beforeEach(() => {
    mock.restore();
  });

  test('initialize with the default state', () => {
    const store = watcherStore(initialState);
    expect(store.getState()).toEqual(initialState);
  });

  describe('getPath', () => {
    test('get a specific path', () => {
      const store = watcherStore(initialState);
      expect(store.getPath('todos.0.text')).toBe('Learn React');
      expect(store.getPath('todos.1.completed')).toBe(false);
      expect(store.getPath('filter')).toBe('all');
    });

    test('get path with numerical keys using string path', () => {
      const numericalKeyState = {
        data: {
          0: { name: 'zero' },
          1: { name: 'one' },
        },
        123: 'hello',
      };
      const store = watcherStore(numericalKeyState);
      expect(store.getPath('data.0.name')).toBe('zero');
      expect(store.getPath('data.1')).toEqual({ name: 'one' });
      expect(store.getPath('data')).toEqual(numericalKeyState.data);
      expect(store.getPath('123')).toBe('hello');
    });
  });

  describe('setState', () => {
    test('update the entire state', () => {
      const store = watcherStore(initialState);

      const newState = {
        ...initialState,
        filter: 'completed',
        nextId: 5,
      };

      store.setState(newState);

      expect(store.getState()).toEqual(newState);
      expect(store.getPath('filter')).toBe('completed');
      expect(store.getPath('nextId')).toBe(5);
    });
  });

  describe('setPath', () => {
    test('update a specific path', () => {
      const store = watcherStore(initialState);

      store.setPath('todos.0.completed', false);

      expect(store.getPath('todos.0.completed')).toBe(false);
      expect(store.getPath('todos.0.text')).toBe('Learn React');
    });

    test('update a specific path in an array', () => {
      const store = watcherStore(initialState);

      store.setPath('todos.1.tags.0', 'updated-tag');

      expect(store.getPath('todos.1.tags.0')).toBe('updated-tag');

      const tags = store.getPath('todos.1.tags');
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBe(2);
      expect(tags[1]).toBe('project');
    });
  });

  describe('clearPath', () => {
    test('clear a shallow path', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});
      const mockFn2 = mock(() => {});

      // watch the path being cleared
      store.__addSubscriber__(mockFn, 'filter');
      // watch a different path (should not be called)
      store.__addSubscriber__(mockFn2, 'nextId');

      store.clearPath('filter');

      expect(store.getPath('filter')).toBeUndefined();
      // Other parts of state untouched
      expect(store.getPath('todos')).toEqual(initialState.todos);
      expect(store.getPath('nextId')).toBe(3);

      // check subscribers
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn2).not.toHaveBeenCalled();
    });

    test('clear a deep path', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});
      const mockFn2 = mock(() => {});
      const mockFn3 = mock(() => {});

      // watch the path being cleared
      store.__addSubscriber__(mockFn, 'todos.0.text');
      // watch a parent path
      store.__addSubscriber__(mockFn2, 'todos.0');
      // watch a sibling path (should not be called)
      store.__addSubscriber__(mockFn3, 'todos.0.completed');

      store.clearPath('todos.0.text');

      expect(store.getPath('todos.0.text')).toBeUndefined();
      // Sibling path untouched
      expect(store.getPath('todos.0.completed')).toBe(true);
      // Other parts of the state untouched
      expect(store.getPath('todos.1')).toEqual(initialState.todos[1]);

      // check subscribers
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn2).toHaveBeenCalledTimes(1);
      expect(mockFn3).not.toHaveBeenCalled();
    });
  });

  /**
   * NOTE. getting react hooks like useEffect and useSyncExternalStore to work
   * in tests is a pain, so we're calling addSubscriber and removeSubscriber
   * directly to test how the functionality works.
   */
  describe('watchState', () => {
    test('call the subscriber when setState is called', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});
      const updatedState = { ...initialState, filter: 'completed' };

      store.__addSubscriber__(mockFn);
      store.setState(updatedState);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(updatedState);
    });

    test('call the subscriber when setPath is called', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn);
      store.setPath('todos.0.completed', false);

      expect(mockFn).toHaveBeenCalledTimes(1);

      store.setPath('filter', 'active');

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('call the subscribers at the end of batch', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn);

      store.batch(() => {
        store.setPath('filter', 'completed');

        // not called until the batch fn returns
        expect(mockFn).not.toHaveBeenCalled();
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('no longer call the function after removing subscriber', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn);
      store.setState({ ...initialState, filter: 'completed' });
      expect(mockFn).toHaveBeenCalledTimes(1);

      store.__removeSubscriber__(mockFn);
      store.setState({ ...initialState, filter: 'active' });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * NOTE. getting react hooks like useEffect and useSyncExternalStore to work
   * in tests is a pain, so we're calling addSubscriber and removeSubscriber
   * directly to test how the functionality works.
   */
  describe('watchPath', () => {
    test('call the subscriber when setState is called', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});
      const mockFn2 = mock(() => {});

      store.__addSubscriber__(mockFn, 'todos.1.text');
      store.__addSubscriber__(mockFn2, 'filter');
      // setState replaces the entire state object, so every path watcher will be called
      store.setState({ ...initialState, filter: 'completed' });

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('Build a project');
      expect(mockFn2).toHaveBeenCalledTimes(1);
      expect(mockFn2).toHaveBeenCalledWith('completed');
    });

    test('call the subscriber, and parent subscribers when setPath is called', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});
      const mockFn2 = mock(() => {});
      const mockFn3 = mock(() => {});
      const mockFn4 = mock(() => {});
      const mockFn5 = mock(() => {});
      const mockFn6 = mock(() => {});
      const mockFn7 = mock(() => {});
      const mockFn8 = mock(() => {});
      const mockFn9 = mock(() => {});
      const mockFn10 = mock(() => {});

      // direct path that's being updated
      store.__addSubscriber__(mockFn, 'todos.0.tags');
      // parent paths
      store.__addSubscriber__(mockFn2, 'todos.0');
      store.__addSubscriber__(mockFn3, 'todos');
      // child paths
      store.__addSubscriber__(mockFn4, 'todos.0.tags.0');
      store.__addSubscriber__(mockFn5, 'todos.0.tags.1');
      // sibling paths - not called
      store.__addSubscriber__(mockFn6, 'todos.0.text');
      store.__addSubscriber__(mockFn7, 'todos.0.completed');
      store.__addSubscriber__(mockFn8, 'todos.1');
      store.__addSubscriber__(mockFn9, 'filter');
      store.__addSubscriber__(mockFn10, 'nextId');

      const updatedTags = ['tag 1', 'tag 2'];
      store.setPath('todos.0.tags', updatedTags);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(updatedTags);
      expect(mockFn2).toHaveBeenCalledTimes(1);
      expect(mockFn3).toHaveBeenCalledTimes(1);
      expect(mockFn4).toHaveBeenCalledTimes(1);
      expect(mockFn4).toHaveBeenCalledWith('tag 1');
      expect(mockFn5).toHaveBeenCalledTimes(1);
      expect(mockFn5).toHaveBeenCalledWith('tag 2');
      expect(mockFn6).not.toHaveBeenCalled();
      expect(mockFn7).not.toHaveBeenCalled();
      expect(mockFn8).not.toHaveBeenCalled();
      expect(mockFn9).not.toHaveBeenCalled();
      expect(mockFn10).not.toHaveBeenCalled();
    });

    test('call the subscribers batch finishes', () => {
      const store = watcherStore(initialState);
      const mockFn1 = mock(() => {});
      const mockFn2 = mock(() => {});

      store.__addSubscriber__(mockFn1, 'filter');
      store.__addSubscriber__(mockFn2, 'nextId');

      store.batch(() => {
        store.setPath('filter', 'completed');
        store.setPath('nextId', 10);

        // not called until the batch fn returns
        expect(mockFn1).not.toHaveBeenCalled();
        expect(mockFn2).not.toHaveBeenCalled();
      });

      expect(mockFn1).toHaveBeenCalledTimes(1);
      expect(mockFn2).toHaveBeenCalledTimes(1);
    });

    test('call the subscriber ONCE when path updated multiple time in a batch', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn, 'filter');

      store.batch(() => {
        // update this path multiple times
        store.setPath('filter', 'update-1');
        store.setPath('filter', 'update-2');
        store.setPath('filter', 'update-3');

        // not called until the batch fn returns
        expect(mockFn).not.toHaveBeenCalled();
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
      // should be the last value
      expect(mockFn).toHaveBeenCalledWith('update-3');
    });

    test('call the subscribers at the end of batch when clearPath is called', () => {
      const store = watcherStore(initialState);
      const mockFn1 = mock(() => {});
      const mockFn2 = mock(() => {});
      const mockFn3 = mock(() => {});

      store.__addSubscriber__(mockFn1, 'filter');
      store.__addSubscriber__(mockFn2, 'todos.0.text');
      store.__addSubscriber__(mockFn3, 'nextId');

      store.batch(() => {
        store.clearPath('filter');
        store.clearPath('todos.0.text');
        store.setPath('nextId', 10);

        // not called until the batch fn returns
        expect(mockFn1).not.toHaveBeenCalled();
        expect(mockFn2).not.toHaveBeenCalled();
        expect(mockFn3).not.toHaveBeenCalled();
      });

      expect(mockFn1).toHaveBeenCalledTimes(1);
      expect(mockFn1).toHaveBeenCalledWith(undefined);
      expect(mockFn2).toHaveBeenCalledTimes(1);
      expect(mockFn2).toHaveBeenCalledWith(undefined);
      expect(mockFn3).toHaveBeenCalledTimes(1);
      expect(mockFn3).toHaveBeenCalledWith(10);

      // verify the paths were actually cleared
      expect(store.getPath('filter')).toBeUndefined();
      expect(store.getPath('todos.0.text')).toBeUndefined();
      expect(store.getPath('nextId')).toBe(10);
    });

    test('call the function when the path changes', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn, 'filter');
      store.setPath('filter', 'completed');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('completed');
    });

    test('trigger multiple path watchers when state object is replaced', () => {
      const store = watcherStore(initialState);
      const filterMock = mock(() => {});
      const todoTextMock = mock(() => {});

      // Watch two different paths
      store.__addSubscriber__(filterMock, 'filter');
      store.__addSubscriber__(todoTextMock, 'todos.1.text');

      const newState = {
        ...initialState, // Spread to include all keys
        filter: 'completed',
      };

      store.setState(newState);

      // Both watchers should be called because setState notifies based on keys
      // present in the new state object, and the notification logic checks parent/child.
      expect(filterMock).toHaveBeenCalledTimes(1);
      expect(filterMock).toHaveBeenCalledWith('completed');
      expect(todoTextMock).toHaveBeenCalledTimes(1);
      expect(todoTextMock).toHaveBeenCalledWith('Build a project'); // Value didn't change, but watcher triggered
    });

    test('only call the function when the watched path changes', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn, 'filter');
      store.setPath('nextId', 10);
      expect(mockFn).toHaveBeenCalledTimes(0);

      store.setPath('filter', 'completed');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('call the function when a parent path changes', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn, 'todos.0.completed');
      store.setPath('todos.0.completed', false);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(false);
    });

    test('call the function when updating a parent path', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn, 'todos.0.completed');

      const updatedTodo = { ...initialState.todos[0], completed: false };
      store.setPath('todos.0', updatedTodo);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(false);
    });

    test('call the function when a child path is updated', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn, 'todos');
      store.setPath('todos.0.completed', false);

      expect(mockFn).toHaveBeenCalledTimes(1);

      const expectedTodos = [
        { ...initialState.todos[0], completed: false },
        initialState.todos[1],
      ];
      expect(mockFn).toHaveBeenCalledWith(expectedTodos);
    });

    test('no longer call the function after removing subscriber', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn, 'filter');
      store.setPath('filter', 'completed');
      expect(mockFn).toHaveBeenCalledTimes(1);

      store.__removeSubscriber__(mockFn);
      store.setPath('filter', 'active');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('not call the function for partial path segment matches', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn, 'completed');

      store.setPath('todos.1.completed', true);

      // The mock should NOT have been called because "completed" is not a
      // valid root path nor is it a parent/child of the updated path
      // in a way that should trigger based on the logic.
      expect(mockFn).toHaveBeenCalledTimes(0);
    });

    test('call the function when watching a non-existent path that is then set', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      // Watch a path that doesn't exist in the initial state
      store.__addSubscriber__(mockFn, 'settings.theme');

      // Verify the path doesn't exist initially
      expect(store.getPath('settings.theme')).toBeUndefined();

      // Set the non-existent path
      store.setPath('settings.theme', 'dark');

      // The watcher should be called with the new value
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('dark');

      // Verify the path now exists with the correct value
      expect(store.getPath('settings.theme')).toBe('dark');
    });
  });

  test('properly handle undefined paths after removing all array items', () => {
    const store = watcherStore(initialState);
    expect(store.getPath('todos.0.tags')).toEqual(['frontend', 'learning']);

    const mockFn = mock(() => {});
    store.__addSubscriber__(mockFn, 'todos.0.tags');

    store.setPath('todos', []);

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  describe('onMount/onUnmount', () => {
    test('call onMount when first subscriber is added', () => {
      const store = watcherStore(initialState);
      const onMountFn = mock(() => {});

      store.onMount(onMountFn);

      // onMount should not be called yet
      expect(onMountFn).not.toHaveBeenCalled();

      // Add first subscriber - this should trigger onMount
      const mockSubscriber = mock(() => {});
      store.__addSubscriber__(mockSubscriber);

      expect(onMountFn).toHaveBeenCalledTimes(1);

      // Adding another subscriber should not call onMount again
      const mockSubscriber2 = mock(() => {});
      store.__addSubscriber__(mockSubscriber2);

      expect(onMountFn).toHaveBeenCalledTimes(1);
    });

    test('call onUnmount when last subscriber is removed', () => {
      const store = watcherStore(initialState);
      const onUnmountFn = mock(() => {});
      const onMountFn = mock(() => onUnmountFn);

      store.onMount(onMountFn);

      // Add subscribers
      const mockSubscriber1 = mock(() => {});
      const mockSubscriber2 = mock(() => {});
      store.__addSubscriber__(mockSubscriber1);
      store.__addSubscriber__(mockSubscriber2);

      expect(onMountFn).toHaveBeenCalledTimes(1);
      expect(onUnmountFn).not.toHaveBeenCalled();

      // Remove first subscriber - should not call onUnmount yet
      store.__removeSubscriber__(mockSubscriber1);
      expect(onUnmountFn).not.toHaveBeenCalled();

      // Remove last subscriber - should call onUnmount
      store.__removeSubscriber__(mockSubscriber2);
      expect(onUnmountFn).toHaveBeenCalledTimes(1);
    });

    test('onMount that does not return a function should not set onUnmount', () => {
      const store = watcherStore(initialState);
      const onMountFn = mock(() => {
        // Return nothing/undefined
      });

      store.onMount(onMountFn);

      const mockSubscriber = mock(() => {});
      store.__addSubscriber__(mockSubscriber);

      expect(onMountFn).toHaveBeenCalledTimes(1);

      // Remove subscriber - should not throw or call any onUnmount
      store.__removeSubscriber__(mockSubscriber);

      // Test passes if no error is thrown
    });

    test('onMount and onUnmount cycle works multiple times', () => {
      const store = watcherStore(initialState);
      const onUnmountFn = mock(() => {});
      const onMountFn = mock(() => onUnmountFn);

      store.onMount(onMountFn);

      // First cycle
      const mockSubscriber1 = mock(() => {});
      store.__addSubscriber__(mockSubscriber1);
      expect(onMountFn).toHaveBeenCalledTimes(1);

      store.__removeSubscriber__(mockSubscriber1);
      expect(onUnmountFn).toHaveBeenCalledTimes(1);

      // Second cycle
      const mockSubscriber2 = mock(() => {});
      store.__addSubscriber__(mockSubscriber2);
      expect(onMountFn).toHaveBeenCalledTimes(2);

      store.__removeSubscriber__(mockSubscriber2);
      expect(onUnmountFn).toHaveBeenCalledTimes(2);
    });

    test('onMount is called when adding path-specific subscribers', () => {
      const store = watcherStore(initialState);
      const onMountFn = mock(() => {});

      store.onMount(onMountFn);

      // Add path-specific subscriber - should trigger onMount
      const mockSubscriber = mock(() => {});
      store.__addSubscriber__(mockSubscriber, 'todos.0.completed');

      expect(onMountFn).toHaveBeenCalledTimes(1);
    });

    test('onUnmount is called when removing last path-specific subscriber', () => {
      const store = watcherStore(initialState);
      const onUnmountFn = mock(() => {});
      const onMountFn = mock(() => onUnmountFn);

      store.onMount(onMountFn);

      // Add path-specific subscriber
      const mockSubscriber = mock(() => {});
      store.__addSubscriber__(mockSubscriber, 'todos.0.completed');

      expect(onMountFn).toHaveBeenCalledTimes(1);

      // Remove the subscriber - should call onUnmount
      store.__removeSubscriber__(mockSubscriber);
      expect(onUnmountFn).toHaveBeenCalledTimes(1);
    });

    test('onMount not called if store already has subscribers', () => {
      const store = watcherStore(initialState);

      // Add a subscriber first
      const existingSubscriber = mock(() => {});
      store.__addSubscriber__(existingSubscriber);

      // Now set onMount - it should not be called immediately
      const onMountFn = mock(() => {});
      store.onMount(onMountFn);

      expect(onMountFn).not.toHaveBeenCalled();

      // Add another subscriber - still should not call onMount
      const newSubscriber = mock(() => {});
      store.__addSubscriber__(newSubscriber);

      expect(onMountFn).not.toHaveBeenCalled();

      // Only when all subscribers are removed and a new one is added should onMount be called
      store.__removeSubscriber__(existingSubscriber);
      store.__removeSubscriber__(newSubscriber);

      const finalSubscriber = mock(() => {});
      store.__addSubscriber__(finalSubscriber);

      expect(onMountFn).toHaveBeenCalledTimes(1);
    });

    test('onMount return value replaces previous onUnmount function', () => {
      const store = watcherStore(initialState);
      const firstOnUnmount = mock(() => {});
      const secondOnUnmount = mock(() => {});

      const onMountFn = mock(() => firstOnUnmount);
      store.onMount(onMountFn);

      // First cycle
      const subscriber1 = mock(() => {});
      store.__addSubscriber__(subscriber1);

      // Mock the onMount to return a different onUnmount function for next cycle
      onMountFn.mockReturnValue(secondOnUnmount);

      store.__removeSubscriber__(subscriber1);
      expect(firstOnUnmount).toHaveBeenCalledTimes(1);
      expect(secondOnUnmount).not.toHaveBeenCalled();

      // Second cycle should use the new onUnmount
      const subscriber2 = mock(() => {});
      store.__addSubscriber__(subscriber2);
      store.__removeSubscriber__(subscriber2);

      expect(firstOnUnmount).toHaveBeenCalledTimes(1);
      expect(secondOnUnmount).toHaveBeenCalledTimes(1);
    });
  });
});
