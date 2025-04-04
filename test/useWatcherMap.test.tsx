import "./setup-tests";
import { describe, test, expect, mock, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useWatcherMap } from "../src/useWatcherMap";

describe("useWatcherMapSubPaths", () => {
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

  describe("mergePaths", () => {
    test("merge paths", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));

      act(() => {
        result.current.mergePaths({
          filter: "active",
          nextId: 10,
        });
      });

      expect(result.current.getPath("filter")).toBe("active");
      expect(result.current.getPath("nextId")).toBe(10);
      expect(result.current.getPath("todos")).toEqual(initialState.todos);
    });

    test("perform a shallow merge with mergePaths, not recursive", () => {
      const nestedInitialState = {
        a: { b: 1, d: 2 },
        e: 3,
      };
      const { result } = renderHook(() =>
        useWatcherMap<any>(nestedInitialState)
      );

      act(() => {
        // Merge a new object for key 'a', replacing the original { b: 1, d: 2 }
        result.current.mergePaths({ a: { c: 3 } });
      });

      expect(result.current.getPath("a")).toEqual({ c: 3 });
      expect(result.current.getPath("a.c")).toBe(3);
      expect(result.current.getPath("a.b")).toBeUndefined();
      expect(result.current.getPath("e")).toBe(3);
    });
  });

  describe("clearPath", () => {
    test("clear a specific path", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));

      act(() => {
        result.current.clearPath("filter");
      });

      expect(result.current.getPath("filter")).toBeUndefined();
      expect(result.current.getPath("todos")).toEqual(initialState.todos);
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
    });

    test("call the subscriber when mergePaths is called", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn);
      result.current.mergePaths({ filter: "completed", nextId: 10 });

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

    test("call the subscriber when mergePaths is called", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      const mockFn2 = mock(() => {});

      result.current.__addSubscriber__(mockFn, "filter");
      result.current.__addSubscriber__(mockFn2, "nextId");
      result.current.mergePaths({ filter: "completed", nextId: 10 });

      expect(mockFn).toHaveBeenCalledTimes(1);
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
