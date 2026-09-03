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

    test('call the subscriber ONCE with the final state when a batch updates multiple paths', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn);

      store.batch(() => {
        store.setPath('filter', 'completed');
        store.setPath('nextId', 10);
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
      // the state passed to the subscriber must include both updates
      expect(mockFn).toHaveBeenLastCalledWith(
        expect.objectContaining({ filter: 'completed', nextId: 10 })
      );
      expect(mockFn).toHaveBeenLastCalledWith(store.getState());
    });

    test('roll back all updates and notify nobody when a batch throws', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn);

      expect(() =>
        store.batch(() => {
          store.setPath('filter', 'completed');
          store.setPath('nextId', 99);
          throw new Error('boom');
        })
      ).toThrow('boom');

      // a batch is atomic: state is restored and no subscriber is notified
      expect(store.getState()).toBe(initialState);
      expect(mockFn).not.toHaveBeenCalled();

      // the store must not be stuck in batch mode
      store.setPath('nextId', 10);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenLastCalledWith(store.getState());

      // and a new batch must be allowed
      expect(() => store.batch(() => {})).not.toThrow();
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

    test('notify a path subscriber when setState removes that key', () => {
      const store = watcherStore<{ a: number; b?: number }>({ a: 1, b: 2 });
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn, 'b');

      store.setState({ a: 1, b: 3 });
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenLastCalledWith(3);

      // "b" is gone from the new state, its subscriber must hear about it
      store.setState({ a: 1 });
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith(undefined);
    });

    test('do not notify a sibling path that merely shares a string prefix', () => {
      const store = watcherStore({
        user: { name: 'Ada' },
        username: 'ada',
        items: Array.from({ length: 11 }, (_, i) => ({ id: i })),
      });
      const userMock = mock(() => {});
      const usernameMock = mock(() => {});
      const item1Mock = mock(() => {});
      const item10Mock = mock(() => {});

      store.__addSubscriber__(userMock, 'user');
      store.__addSubscriber__(usernameMock, 'username');
      store.__addSubscriber__(item1Mock, 'items.1');
      store.__addSubscriber__(item10Mock, 'items.10');

      // "username" starts with "user" but is a sibling, not a child
      store.setPath('username', 'grace');
      expect(usernameMock).toHaveBeenCalledTimes(1);
      expect(userMock).not.toHaveBeenCalled();

      // "user.name" IS a child of "user"
      store.setPath('user.name', 'Grace');
      expect(userMock).toHaveBeenCalledTimes(1);
      expect(usernameMock).toHaveBeenCalledTimes(1);

      // "items.10" starts with "items.1" but is a sibling, not a child
      store.setPath('items.10', { id: 100 });
      expect(item10Mock).toHaveBeenCalledTimes(1);
      expect(item1Mock).not.toHaveBeenCalled();

      // and the reverse: updating "items.1" must not notify "items.10"
      store.setPath('items.1', { id: 11 });
      expect(item1Mock).toHaveBeenCalledTimes(1);
      expect(item10Mock).toHaveBeenCalledTimes(1);
    });

    test('call the same function subscribed to two different paths when either changes', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn, 'filter');
      store.__addSubscriber__(mockFn, 'nextId');

      store.setPath('filter', 'completed');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenLastCalledWith('completed');

      store.setPath('nextId', 10);
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith(10);
    });

    test('call the subscriber ONCE with the final value when a batch updates a path and its parent', () => {
      const store = watcherStore(initialState);
      const mockFn = mock(() => {});

      store.__addSubscriber__(mockFn, 'todos.0.text');

      store.batch(() => {
        store.setPath('todos.0.text', 'intermediate');
        store.setPath('todos.0', {
          id: 1,
          text: 'final',
          completed: true,
          tags: [],
        });
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenLastCalledWith('final');
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

      store.__addSubscriber__(mockFn, 'completed' as any);

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
      store.__addSubscriber__(mockFn, 'settings.theme' as any);

      // Verify the path doesn't exist initially
      expect(store.getPath('settings.theme' as any)).toBeUndefined();

      // Set the non-existent path
      store.setPath('settings.theme' as any, 'dark');

      // The watcher should be called with the new value
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('dark');

      // Verify the path now exists with the correct value
      expect(store.getPath('settings.theme' as any)).toBe('dark');
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

    test('skipMountTracking subscriber does not call onMount', () => {
      const store = watcherStore(initialState);
      const onMountFn = mock(() => {});

      store.onMount(onMountFn);

      const mockSubscriber = mock(() => {});
      store.__addSubscriber__(mockSubscriber, undefined, {
        skipMountTracking: true,
      });

      expect(onMountFn).not.toHaveBeenCalled();
    });

    test('tracked subscriber calls onMount after skipMountTracking subscriber', () => {
      const store = watcherStore(initialState);
      const onMountFn = mock(() => {});

      store.onMount(onMountFn);

      const skippedSubscriber = mock(() => {});
      store.__addSubscriber__(skippedSubscriber, undefined, {
        skipMountTracking: true,
      });
      expect(onMountFn).not.toHaveBeenCalled();

      const trackedSubscriber = mock(() => {});
      store.__addSubscriber__(trackedSubscriber);

      expect(onMountFn).toHaveBeenCalledTimes(1);
    });

    test('skipMountTracking subscriber does not keep store mounted', () => {
      const store = watcherStore(initialState);
      const onUnmountFn = mock(() => {});
      const onMountFn = mock(() => onUnmountFn);

      store.onMount(onMountFn);

      const trackedSubscriber = mock(() => {});
      const skippedSubscriber = mock(() => {});
      store.__addSubscriber__(trackedSubscriber);
      store.__addSubscriber__(skippedSubscriber, undefined, {
        skipMountTracking: true,
      });

      store.__removeSubscriber__(trackedSubscriber);

      expect(onMountFn).toHaveBeenCalledTimes(1);
      expect(onUnmountFn).toHaveBeenCalledTimes(1);
    });

    test('removing skipMountTracking subscriber does not call stale onUnmount', () => {
      const store = watcherStore(initialState);
      const onUnmountFn = mock(() => {});
      const onMountFn = mock(() => onUnmountFn);

      store.onMount(onMountFn);

      const trackedSubscriber = mock(() => {});
      store.__addSubscriber__(trackedSubscriber);
      store.__removeSubscriber__(trackedSubscriber);
      expect(onUnmountFn).toHaveBeenCalledTimes(1);

      const skippedSubscriber = mock(() => {});
      store.__addSubscriber__(skippedSubscriber, undefined, {
        skipMountTracking: true,
      });
      store.__removeSubscriber__(skippedSubscriber);

      expect(onMountFn).toHaveBeenCalledTimes(1);
      expect(onUnmountFn).toHaveBeenCalledTimes(1);
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

    test('usePath re-renders do not churn onMount/onUnmount', () => {
      const store = watcherStore(initialState);
      const onUnmountFn = mock(() => {});
      const onMountFn = mock(() => onUnmountFn);

      store.onMount(onMountFn);

      const { rerender, unmount } = renderHook(() => store.usePath('filter'));

      // First render -> first subscriber added -> onMount fires once.
      expect(onMountFn).toHaveBeenCalledTimes(1);
      expect(onUnmountFn).not.toHaveBeenCalled();

      // Re-render multiple times. If subscribePathFactory returned a new fn
      // each call, useSyncExternalStore would resubscribe (unsub + sub), and
      // the 1->0->1 transitions would fire onUnmount/onMount each time.
      rerender();
      rerender();
      rerender();

      // Trigger a state update which also causes a re-render of the hook.
      act(() => {
        store.setPath('filter', 'completed');
      });

      expect(onMountFn).toHaveBeenCalledTimes(1);
      expect(onUnmountFn).not.toHaveBeenCalled();

      // Unmount triggers the only real unsubscribe.
      unmount();
      expect(onUnmountFn).toHaveBeenCalledTimes(1);
    });

    test('two consumers on the same path are tracked independently', () => {
      const store = watcherStore(initialState);
      const onUnmountFn = mock(() => {});
      const onMountFn = mock(() => onUnmountFn);

      store.onMount(onMountFn);

      const a = renderHook(() => store.usePath('filter'));
      const b = renderHook(() => store.usePath('filter'));

      // First subscriber -> mount fires once. Second adds another entry
      // without re-firing mount.
      expect(onMountFn).toHaveBeenCalledTimes(1);

      expect(a.result.current).toBe('all');
      expect(b.result.current).toBe('all');

      act(() => {
        store.setPath('filter', 'completed');
      });

      // Both subscriptions are notified independently.
      expect(a.result.current).toBe('completed');
      expect(b.result.current).toBe('completed');

      // Unmounting one consumer must not remove the other's subscription.
      a.unmount();
      expect(onUnmountFn).not.toHaveBeenCalled();

      act(() => {
        store.setPath('filter', 'active');
      });
      expect(b.result.current).toBe('active');

      // Last consumer leaves -> 1->0 transition fires onUnmount.
      b.unmount();
      expect(onUnmountFn).toHaveBeenCalledTimes(1);
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

  describe('onMountPath', () => {
    test('call onMountPath when first subscriber for a path is added', () => {
      const store = watcherStore(initialState);
      const onMountPathFn = mock(() => {});

      store.onMountPath(onMountPathFn);

      expect(onMountPathFn).not.toHaveBeenCalled();

      const mockSubscriber = mock(() => {});
      store.__addSubscriber__(mockSubscriber, 'filter');

      expect(onMountPathFn).toHaveBeenCalledTimes(1);
      expect(onMountPathFn).toHaveBeenCalledWith('filter');

      const mockSubscriber2 = mock(() => {});
      store.__addSubscriber__(mockSubscriber2, 'filter');

      expect(onMountPathFn).toHaveBeenCalledTimes(1);
    });

    test('track mount and unmount per path when the same fn subscribes to two paths', () => {
      const store = watcherStore(initialState);
      const unmountFilter = mock(() => {});
      const unmountNextId = mock(() => {});
      const onMountPathFn = mock((path: string) =>
        path === 'filter' ? unmountFilter : unmountNextId
      );

      store.onMountPath(onMountPathFn);

      const subscriber = mock(() => {});
      store.__addSubscriber__(subscriber, 'filter');
      store.__addSubscriber__(subscriber, 'nextId');

      expect(onMountPathFn).toHaveBeenCalledTimes(2);

      // removing one path leaves the other subscribed
      store.__removeSubscriber__(subscriber, 'filter');
      expect(unmountFilter).toHaveBeenCalledTimes(1);
      expect(unmountNextId).not.toHaveBeenCalled();

      store.setPath('nextId', 10);
      expect(subscriber).toHaveBeenCalledTimes(1);

      // removing with no path removes everything left for that fn
      store.__removeSubscriber__(subscriber);
      expect(unmountNextId).toHaveBeenCalledTimes(1);

      store.setPath('nextId', 11);
      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    test('call onMountPath for each distinct path', () => {
      const store = watcherStore(initialState);
      const onMountPathFn = mock(() => {});

      store.onMountPath(onMountPathFn);

      store.__addSubscriber__(
        mock(() => {}),
        'filter'
      );
      store.__addSubscriber__(
        mock(() => {}),
        'nextId'
      );

      expect(onMountPathFn).toHaveBeenCalledTimes(2);
      expect(onMountPathFn).toHaveBeenCalledWith('filter');
      expect(onMountPathFn).toHaveBeenCalledWith('nextId');
    });

    test('does not call onMountPath for whole-state subscribers', () => {
      const store = watcherStore(initialState);
      const onMountPathFn = mock(() => {});

      store.onMountPath(onMountPathFn);

      const mockSubscriber = mock(() => {});
      store.__addSubscriber__(mockSubscriber);

      expect(onMountPathFn).not.toHaveBeenCalled();
    });

    test('parent and child paths each fire onMountPath independently', () => {
      const store = watcherStore(initialState);
      const onMountPathFn = mock(() => {});

      store.onMountPath(onMountPathFn);

      store.__addSubscriber__(
        mock(() => {}),
        'todos'
      );
      expect(onMountPathFn).toHaveBeenCalledTimes(1);
      expect(onMountPathFn).toHaveBeenCalledWith('todos');

      store.__addSubscriber__(
        mock(() => {}),
        'todos.0.completed'
      );
      expect(onMountPathFn).toHaveBeenCalledTimes(2);
      expect(onMountPathFn).toHaveBeenCalledWith('todos.0.completed');
    });

    test('independent paths mount and unmount separately', () => {
      const store = watcherStore(initialState);
      const aborts = new Map<string, ReturnType<typeof mock>>();
      const onMountPathFn = mock((path: string) => {
        const abort = mock(() => {});
        aborts.set(path, abort);
        return abort;
      });

      store.onMountPath(onMountPathFn);

      const filterSubscriber = mock(() => {});
      const nextIdSubscriber = mock(() => {});
      store.__addSubscriber__(filterSubscriber, 'filter');
      store.__addSubscriber__(nextIdSubscriber, 'nextId');

      expect(onMountPathFn).toHaveBeenCalledTimes(2);

      store.__removeSubscriber__(filterSubscriber);
      expect(aborts.get('filter')).toHaveBeenCalledTimes(1);
      expect(aborts.get('nextId')).not.toHaveBeenCalled();

      store.__removeSubscriber__(nextIdSubscriber);
      expect(aborts.get('nextId')).toHaveBeenCalledTimes(1);
    });

    test('call path unmount when last subscriber for that path is removed', () => {
      const store = watcherStore(initialState);
      const onUnmountPathFn = mock(() => {});
      const onMountPathFn = mock(() => onUnmountPathFn);

      store.onMountPath(onMountPathFn);

      const mockSubscriber1 = mock(() => {});
      const mockSubscriber2 = mock(() => {});
      store.__addSubscriber__(mockSubscriber1, 'filter');
      store.__addSubscriber__(mockSubscriber2, 'filter');

      expect(onMountPathFn).toHaveBeenCalledTimes(1);
      expect(onUnmountPathFn).not.toHaveBeenCalled();

      store.__removeSubscriber__(mockSubscriber1);
      expect(onUnmountPathFn).not.toHaveBeenCalled();

      store.__removeSubscriber__(mockSubscriber2);
      expect(onUnmountPathFn).toHaveBeenCalledTimes(1);
    });

    test('onMountPath that does not return a function should not set path unmount', () => {
      const store = watcherStore(initialState);
      const onMountPathFn = mock(() => {});

      store.onMountPath(onMountPathFn);

      const mockSubscriber = mock(() => {});
      store.__addSubscriber__(mockSubscriber, 'filter');
      expect(onMountPathFn).toHaveBeenCalledTimes(1);

      store.__removeSubscriber__(mockSubscriber);
    });

    test('onMountPath mount and unmount cycle works multiple times', () => {
      const store = watcherStore(initialState);
      const onUnmountPathFn = mock(() => {});
      const onMountPathFn = mock(() => onUnmountPathFn);

      store.onMountPath(onMountPathFn);

      const mockSubscriber1 = mock(() => {});
      store.__addSubscriber__(mockSubscriber1, 'filter');
      expect(onMountPathFn).toHaveBeenCalledTimes(1);

      store.__removeSubscriber__(mockSubscriber1);
      expect(onUnmountPathFn).toHaveBeenCalledTimes(1);

      const mockSubscriber2 = mock(() => {});
      store.__addSubscriber__(mockSubscriber2, 'filter');
      expect(onMountPathFn).toHaveBeenCalledTimes(2);

      store.__removeSubscriber__(mockSubscriber2);
      expect(onUnmountPathFn).toHaveBeenCalledTimes(2);
    });

    test('skipMountTracking subscriber does not call onMountPath', () => {
      const store = watcherStore(initialState);
      const onMountPathFn = mock(() => {});

      store.onMountPath(onMountPathFn);

      const mockSubscriber = mock(() => {});
      store.__addSubscriber__(mockSubscriber, 'filter', {
        skipMountTracking: true,
      });

      expect(onMountPathFn).not.toHaveBeenCalled();
    });

    test('tracked subscriber calls onMountPath after skipMountTracking subscriber', () => {
      const store = watcherStore(initialState);
      const onMountPathFn = mock(() => {});

      store.onMountPath(onMountPathFn);

      const skippedSubscriber = mock(() => {});
      store.__addSubscriber__(skippedSubscriber, 'filter', {
        skipMountTracking: true,
      });
      expect(onMountPathFn).not.toHaveBeenCalled();

      const trackedSubscriber = mock(() => {});
      store.__addSubscriber__(trackedSubscriber, 'filter');

      expect(onMountPathFn).toHaveBeenCalledTimes(1);
    });

    test('skipMountTracking subscriber does not keep path mounted', () => {
      const store = watcherStore(initialState);
      const onUnmountPathFn = mock(() => {});
      const onMountPathFn = mock(() => onUnmountPathFn);

      store.onMountPath(onMountPathFn);

      const trackedSubscriber = mock(() => {});
      const skippedSubscriber = mock(() => {});
      store.__addSubscriber__(trackedSubscriber, 'filter');
      store.__addSubscriber__(skippedSubscriber, 'filter', {
        skipMountTracking: true,
      });

      store.__removeSubscriber__(trackedSubscriber);

      expect(onMountPathFn).toHaveBeenCalledTimes(1);
      expect(onUnmountPathFn).toHaveBeenCalledTimes(1);
    });

    test('removing skipMountTracking subscriber does not call stale path unmount', () => {
      const store = watcherStore(initialState);
      const onUnmountPathFn = mock(() => {});
      const onMountPathFn = mock(() => onUnmountPathFn);

      store.onMountPath(onMountPathFn);

      const trackedSubscriber = mock(() => {});
      store.__addSubscriber__(trackedSubscriber, 'filter');
      store.__removeSubscriber__(trackedSubscriber);
      expect(onUnmountPathFn).toHaveBeenCalledTimes(1);

      const skippedSubscriber = mock(() => {});
      store.__addSubscriber__(skippedSubscriber, 'filter', {
        skipMountTracking: true,
      });
      store.__removeSubscriber__(skippedSubscriber);

      expect(onMountPathFn).toHaveBeenCalledTimes(1);
      expect(onUnmountPathFn).toHaveBeenCalledTimes(1);
    });

    test('onMountPath not called if path already has subscribers', () => {
      const store = watcherStore(initialState);

      const existingSubscriber = mock(() => {});
      store.__addSubscriber__(existingSubscriber, 'filter');

      const onMountPathFn = mock(() => {});
      store.onMountPath(onMountPathFn);

      expect(onMountPathFn).not.toHaveBeenCalled();

      const newSubscriber = mock(() => {});
      store.__addSubscriber__(newSubscriber, 'filter');

      expect(onMountPathFn).not.toHaveBeenCalled();

      store.__removeSubscriber__(existingSubscriber);
      store.__removeSubscriber__(newSubscriber);

      const finalSubscriber = mock(() => {});
      store.__addSubscriber__(finalSubscriber, 'filter');

      expect(onMountPathFn).toHaveBeenCalledTimes(1);
      expect(onMountPathFn).toHaveBeenCalledWith('filter');
    });

    test('usePath re-renders do not churn onMountPath unmount', () => {
      const store = watcherStore(initialState);
      const onUnmountPathFn = mock(() => {});
      const onMountPathFn = mock(() => onUnmountPathFn);

      store.onMountPath(onMountPathFn);

      const { rerender, unmount } = renderHook(() => store.usePath('filter'));

      expect(onMountPathFn).toHaveBeenCalledTimes(1);
      expect(onUnmountPathFn).not.toHaveBeenCalled();

      rerender();
      rerender();
      rerender();

      act(() => {
        store.setPath('filter', 'completed');
      });

      expect(onMountPathFn).toHaveBeenCalledTimes(1);
      expect(onUnmountPathFn).not.toHaveBeenCalled();

      unmount();
      expect(onUnmountPathFn).toHaveBeenCalledTimes(1);
    });

    test('two consumers on the same path are tracked independently', () => {
      const store = watcherStore(initialState);
      const onUnmountPathFn = mock(() => {});
      const onMountPathFn = mock(() => onUnmountPathFn);

      store.onMountPath(onMountPathFn);

      const a = renderHook(() => store.usePath('filter'));
      const b = renderHook(() => store.usePath('filter'));

      expect(onMountPathFn).toHaveBeenCalledTimes(1);

      a.unmount();
      expect(onUnmountPathFn).not.toHaveBeenCalled();

      b.unmount();
      expect(onUnmountPathFn).toHaveBeenCalledTimes(1);
    });

    test('onMountPath return value replaces previous path unmount function', () => {
      const store = watcherStore(initialState);
      const firstOnUnmount = mock(() => {});
      const secondOnUnmount = mock(() => {});

      const onMountPathFn = mock(() => firstOnUnmount);
      store.onMountPath(onMountPathFn);

      const subscriber1 = mock(() => {});
      store.__addSubscriber__(subscriber1, 'filter');

      onMountPathFn.mockReturnValue(secondOnUnmount);

      store.__removeSubscriber__(subscriber1);
      expect(firstOnUnmount).toHaveBeenCalledTimes(1);
      expect(secondOnUnmount).not.toHaveBeenCalled();

      const subscriber2 = mock(() => {});
      store.__addSubscriber__(subscriber2, 'filter');
      store.__removeSubscriber__(subscriber2);

      expect(firstOnUnmount).toHaveBeenCalledTimes(1);
      expect(secondOnUnmount).toHaveBeenCalledTimes(1);
    });

    test('store onMount and onMountPath both fire independently', () => {
      const store = watcherStore(initialState);
      const storeUnmount = mock(() => {});
      const aborts = new Map<string, ReturnType<typeof mock>>();
      const storeMount = mock(() => storeUnmount);
      const pathMount = mock((path: string) => {
        const abort = mock(() => {});
        aborts.set(path, abort);
        return abort;
      });

      store.onMount(storeMount);
      store.onMountPath(pathMount);

      const filterSubscriber = mock(() => {});
      store.__addSubscriber__(filterSubscriber, 'filter');

      expect(storeMount).toHaveBeenCalledTimes(1);
      expect(pathMount).toHaveBeenCalledTimes(1);
      expect(pathMount).toHaveBeenCalledWith('filter');

      const nextIdSubscriber = mock(() => {});
      store.__addSubscriber__(nextIdSubscriber, 'nextId');
      expect(storeMount).toHaveBeenCalledTimes(1);
      expect(pathMount).toHaveBeenCalledTimes(2);
      expect(pathMount).toHaveBeenCalledWith('nextId');

      store.__removeSubscriber__(filterSubscriber);
      expect(aborts.get('filter')).toHaveBeenCalledTimes(1);
      expect(aborts.get('nextId')).not.toHaveBeenCalled();
      expect(storeUnmount).not.toHaveBeenCalled();

      store.__removeSubscriber__(nextIdSubscriber);
      expect(aborts.get('nextId')).toHaveBeenCalledTimes(1);
      expect(storeUnmount).toHaveBeenCalledTimes(1);
    });

    test('fetch an item when usePath first subscribes to that id', () => {
      type ItemId = string;
      type ItemData = Record<string, any>;
      const store = watcherStore<Record<ItemId, ItemData>>({});

      const fetchItem = mock((path: string) => ({ name: `item-${path}` }));
      const abortItem = mock((path: string) => {});

      store.onMountPath(path => {
        const data = fetchItem(path);
        store.setPath(path, data);
        return () => abortItem(path);
      });

      const { result: item999, unmount: unmount999 } = renderHook(() =>
        store.usePath('999')
      );
      expect(fetchItem).toHaveBeenCalledTimes(1);
      expect(fetchItem).toHaveBeenCalledWith('999');
      expect(item999.current).toEqual({ name: 'item-999' });

      const { result: item1000, unmount: unmount1000 } = renderHook(() =>
        store.usePath('1000')
      );
      expect(fetchItem).toHaveBeenCalledTimes(2);
      expect(fetchItem).toHaveBeenCalledWith('1000');
      expect(item1000.current).toEqual({ name: 'item-1000' });

      unmount999();
      expect(abortItem).toHaveBeenCalledTimes(1);
      expect(abortItem).toHaveBeenCalledWith('999');
      expect(abortItem).not.toHaveBeenCalledWith('1000');

      unmount1000();
      expect(abortItem).toHaveBeenCalledTimes(2);
      expect(abortItem).toHaveBeenCalledWith('1000');
    });
  });
});
