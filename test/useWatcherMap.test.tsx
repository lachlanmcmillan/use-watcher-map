import { describe, test, expect, mock, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useWatcherMap } from "../src/useWatcherMap";

describe("useWatcherMap", () => {
  const initialState = {
    todos: [
      {
        id: 1,
        text: "Learn React",
        completed: true,
        tags: ["frontend", "learning"],
      },
      {
        id: 2,
        text: "Build a project",
        completed: false,
        tags: ["coding", "project"],
      },
    ],
    filter: "all",
    nextId: 3,
  };

  beforeEach(() => {
    mock.restore();
  });

  test("initialize with the default state", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    expect(result.current.getState()).toEqual(initialState);
  });

  describe("getPath", () => {
    test("get a specific path", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      expect(result.current.getPath("todos.0.text")).toBe("Learn React");
      expect(result.current.getPath("todos.1.completed")).toBe(false);
      expect(result.current.getPath("filter")).toBe("all");
    });

    test("get path with numerical keys using string path", () => {
      const numericalKeyState = {
        data: {
          0: { name: "zero" },
          1: { name: "one" },
        },
        123: "hello",
      };
      const { result } = renderHook(() => useWatcherMap(numericalKeyState));
      expect(result.current.getPath("data.0.name")).toBe("zero");
      expect(result.current.getPath("data.1")).toEqual({ name: "one" });
      expect(result.current.getPath("data")).toEqual(numericalKeyState.data);
      expect(result.current.getPath("123")).toBe("hello");
    });
  });

  describe("setState", () => {
    test("update the entire state", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));

      const newState = {
        ...initialState,
        filter: "completed",
        nextId: 5,
      };

      act(() => {
        result.current.setState(newState);
      });

      expect(result.current.getState()).toEqual(newState);
      expect(result.current.getPath("filter")).toBe("completed");
      expect(result.current.getPath("nextId")).toBe(5);
    });
  });

  describe("setPath", () => {
    test("update a specific path", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));

      act(() => {
        result.current.setPath("todos.0.completed", false);
      });

      expect(result.current.getPath("todos.0.completed")).toBe(false);
      expect(result.current.getPath("todos.0.text")).toBe("Learn React");
    });

    test("update a specific path in an array", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));

      act(() => {
        result.current.setPath("todos.1.tags.0", "updated-tag");
      });

      expect(result.current.getPath("todos.1.tags.0")).toBe("updated-tag");

      const tags = result.current.getPath("todos.1.tags");
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBe(2);
      expect(tags[1]).toBe("project");
    });
  });

  describe("clearPath", () => {
    test("clear a shallow path", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      const mockFn2 = mock(() => {});

      // watch the path being cleared
      result.current.__addSubscriber__(mockFn, "filter");
      // watch a different path (should not be called)
      result.current.__addSubscriber__(mockFn2, "nextId");

      act(() => {
        result.current.clearPath("filter");
      });

      expect(result.current.getPath("filter")).toBeUndefined();
      // Other parts of state untouched
      expect(result.current.getPath("todos")).toEqual(initialState.todos);
      expect(result.current.getPath("nextId")).toBe(3);

      // check subscribers
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn2).not.toHaveBeenCalled();
    });

    test("clear a deep path", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      const mockFn2 = mock(() => {});
      const mockFn3 = mock(() => {});

      // watch the path being cleared
      result.current.__addSubscriber__(mockFn, "todos.0.text");
      // watch a parent path
      result.current.__addSubscriber__(mockFn2, "todos.0");
      // watch a sibling path (should not be called)
      result.current.__addSubscriber__(mockFn3, "todos.0.completed");

      act(() => {
        result.current.clearPath("todos.0.text");
      });

      expect(result.current.getPath("todos.0.text")).toBeUndefined();
      // Sibling path untouched
      expect(result.current.getPath("todos.0.completed")).toBe(true);
      // Other parts of the state untouched
      expect(result.current.getPath("todos.1")).toEqual(initialState.todos[1]);

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
  describe("watchState", () => {
    test("call the subscriber when setState is called", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      const updatedState = { ...initialState, filter: "completed" };

      result.current.__addSubscriber__(mockFn);
      result.current.setState(updatedState);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(updatedState);
    });

    test("call the subscriber when setPath is called", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn);
      result.current.setPath("todos.0.completed", false);

      expect(mockFn).toHaveBeenCalledTimes(1);

      result.current.setPath("filter", "active");

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test("call the subscribers at the end of batch", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => { });

      result.current.__addSubscriber__(mockFn);

      result.current.batch(() => {
        result.current.setPath("filter", "completed");

        // not called until the batch fn returns
        expect(mockFn).not.toHaveBeenCalled();
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test("no longer call the function after removing subscriber", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn);
      result.current.setState({ ...initialState, filter: "completed" });
      expect(mockFn).toHaveBeenCalledTimes(1);

      result.current.__removeSubscriber__(mockFn);
      result.current.setState({ ...initialState, filter: "active" });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * NOTE. getting react hooks like useEffect and useSyncExternalStore to work
   * in tests is a pain, so we're calling addSubscriber and removeSubscriber
   * directly to test how the functionality works.
   */
  describe("watchPath", () => {
    test("call the subscriber when setState is called", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      const mockFn2 = mock(() => {});

      result.current.__addSubscriber__(mockFn, "todos.1.text");
      result.current.__addSubscriber__(mockFn2, "filter");
      // setState replaces the entire state object, so every path watcher will be called
      result.current.setState({ ...initialState, filter: "completed" });

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith("Build a project");
      expect(mockFn2).toHaveBeenCalledTimes(1);
      expect(mockFn2).toHaveBeenCalledWith("completed");
    });

    test("call the subscriber, and parent subscribers when setPath is called", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
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
      result.current.__addSubscriber__(mockFn, "todos.0.tags");
      // parent paths
      result.current.__addSubscriber__(mockFn2, "todos.0");
      result.current.__addSubscriber__(mockFn3, "todos");
      // child paths
      result.current.__addSubscriber__(mockFn4, "todos.0.tags.0");
      result.current.__addSubscriber__(mockFn5, "todos.0.tags.1");
      // sibling paths - not called
      result.current.__addSubscriber__(mockFn6, "todos.0.text");
      result.current.__addSubscriber__(mockFn7, "todos.0.completed");
      result.current.__addSubscriber__(mockFn8, "todos.1");
      result.current.__addSubscriber__(mockFn9, "filter");
      result.current.__addSubscriber__(mockFn10, "nextId");

      const updatedTags = ["tag 1", "tag 2"];
      act(() => {
        result.current.setPath("todos.0.tags", updatedTags);
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(updatedTags);
      expect(mockFn2).toHaveBeenCalledTimes(1);
      expect(mockFn3).toHaveBeenCalledTimes(1);
      expect(mockFn4).toHaveBeenCalledTimes(1);
      expect(mockFn4).toHaveBeenCalledWith("tag 1");
      expect(mockFn5).toHaveBeenCalledTimes(1);
      expect(mockFn5).toHaveBeenCalledWith("tag 2");
      expect(mockFn6).not.toHaveBeenCalled();
      expect(mockFn7).not.toHaveBeenCalled();
      expect(mockFn8).not.toHaveBeenCalled();
      expect(mockFn9).not.toHaveBeenCalled();
      expect(mockFn10).not.toHaveBeenCalled();
    });

    test("call the subscribers batch finishes", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn1 = mock(() => {});
      const mockFn2 = mock(() => {});

      result.current.__addSubscriber__(mockFn1, "filter");
      result.current.__addSubscriber__(mockFn2, "nextId");

      result.current.batch(() => {
        result.current.setPath("filter", "completed");
        result.current.setPath("nextId", 10);

        // not called until the batch fn returns
        expect(mockFn1).not.toHaveBeenCalled();
        expect(mockFn2).not.toHaveBeenCalled();
      });

      expect(mockFn1).toHaveBeenCalledTimes(1);
      expect(mockFn2).toHaveBeenCalledTimes(1);
    });

    test("call the subscriber ONCE when path updated multiple time in a batch", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn, "filter");

      result.current.batch(() => {
        // update this path multiple times
        result.current.setPath("filter", "update-1");
        result.current.setPath("filter", "update-2");
        result.current.setPath("filter", "update-3");

        // not called until the batch fn returns
        expect(mockFn).not.toHaveBeenCalled();
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
      // should be the last value
      expect(mockFn).toHaveBeenCalledWith("update-3");
    });

    test("call the function when the path changes", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn, "filter");
      result.current.setPath("filter", "completed");

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith("completed");
    });

    test("trigger multiple path watchers when state object is replaced", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const filterMock = mock(() => {});
      const todoTextMock = mock(() => {});

      // Watch two different paths
      result.current.__addSubscriber__(filterMock, "filter");
      result.current.__addSubscriber__(todoTextMock, "todos.1.text");

      const newState = {
        ...initialState, // Spread to include all keys
        filter: "completed",
      };

      act(() => {
        result.current.setState(newState);
      });

      // Both watchers should be called because setState notifies based on keys
      // present in the new state object, and the notification logic checks parent/child.
      expect(filterMock).toHaveBeenCalledTimes(1);
      expect(filterMock).toHaveBeenCalledWith("completed");
      expect(todoTextMock).toHaveBeenCalledTimes(1);
      expect(todoTextMock).toHaveBeenCalledWith("Build a project"); // Value didn't change, but watcher triggered
    });

    test("only call the function when the watched path changes", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn, "filter");
      result.current.setPath("nextId", 10);
      expect(mockFn).toHaveBeenCalledTimes(0);

      result.current.setPath("filter", "completed");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test("call the function when a parent path changes", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn, "todos.0.completed");
      result.current.setPath("todos.0.completed", false);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(false);
    });

    test("call the function when updating a parent path", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn, "todos.0.completed");

      const updatedTodo = { ...initialState.todos[0], completed: false };
      result.current.setPath("todos.0", updatedTodo);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(false);
    });

    test("call the function when a child path is updated", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn, "todos");
      result.current.setPath("todos.0.completed", false);

      expect(mockFn).toHaveBeenCalledTimes(1);

      const expectedTodos = [
        { ...initialState.todos[0], completed: false },
        initialState.todos[1],
      ];
      expect(mockFn).toHaveBeenCalledWith(expectedTodos);
    });

    test("no longer call the function after removing subscriber", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn, "filter");
      result.current.setPath("filter", "completed");
      expect(mockFn).toHaveBeenCalledTimes(1);

      result.current.__removeSubscriber__(mockFn);
      result.current.setPath("filter", "active");

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test("not call the function for partial path segment matches", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn, "completed");

      act(() => {
        result.current.setPath("todos.1.completed", true);
      });

      // The mock should NOT have been called because "completed" is not a
      // valid root path nor is it a parent/child of the updated path
      // in a way that should trigger based on the logic.
      expect(mockFn).toHaveBeenCalledTimes(0);
    });
  });

  test("properly handle undefined paths after removing all array items", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    expect(result.current.getPath("todos.0.tags")).toEqual([
      "frontend",
      "learning",
    ]);

    const mockFn = mock(() => {});
    result.current.__addSubscriber__(mockFn, "todos.0.tags");

    act(() => {
      result.current.setPath("todos", []);
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
