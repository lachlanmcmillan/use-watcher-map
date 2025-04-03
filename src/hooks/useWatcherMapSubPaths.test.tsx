import "../setup-tests";
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useWatcherMap } from "./useWatcherMapSubPaths";

describe("useWatcherMapSubPaths", () => {
  const initialState = {
    todos: [
      { id: 1, text: "Learn React", completed: true, tags: ["frontend", "learning"] },
      { id: 2, text: "Build a project", completed: false, tags: ["coding", "project"] }
    ],
    filter: "all",
    nextId: 3
  };

  beforeEach(() => {
    mock.restore();
  });


  it("should initialize with the default state", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    expect(result.current.getState()).toEqual(initialState);
  });

  it("should get a specific path", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    expect(result.current.getPath("todos.0.text")).toBe("Learn React");
    expect(result.current.getPath("todos.1.completed")).toBe(false);
    expect(result.current.getPath("filter")).toBe("all");
  });

  it("should update the entire state", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    
    const newState = {
      ...initialState,
      filter: "completed",
      nextId: 5
    };
    
    act(() => {
      result.current.setState(newState);
    });
    
    expect(result.current.getState()).toEqual(newState);
    expect(result.current.getPath("filter")).toBe("completed");
    expect(result.current.getPath("nextId")).toBe(5);
  });

  it("should update a specific path", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    
    act(() => {
      result.current.setPath("todos.0.completed", false);
    });
    
    expect(result.current.getPath("todos.0.completed")).toBe(false);
    expect(result.current.getPath("todos.0.text")).toBe("Learn React");
  });

  it("should update a deeply nested path", () => {
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

  it("should merge paths", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    
    act(() => {
      result.current.mergePaths({
        filter: "active",
        nextId: 10
      });
    });
    
    expect(result.current.getPath("filter")).toBe("active");
    expect(result.current.getPath("nextId")).toBe(10);
    expect(result.current.getPath("todos")).toEqual(initialState.todos);
  });

  it("should clear a specific path", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    
    act(() => {
      result.current.clearPath("filter");
    });
    
    expect(result.current.getPath("filter")).toBeUndefined();
    expect(result.current.getPath("todos")).toEqual(initialState.todos);
  });
  
  it("should handle path updates correctly", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    
    act(() => {
      result.current.setPath("filter", "completed");
    });
    
    const updatedValue = result.current.getPath("filter");
    expect(updatedValue).toBe("completed");
  });
  
  it("should perform a shallow merge with mergePaths, not recursive", () => {
    const nestedInitialState = {
      a: { b: 1, d: 2 },
      e: 3
    };
    const { result } = renderHook(() => useWatcherMap<any>(nestedInitialState));

    act(() => {
      // Merge a new object for key 'a', replacing the original { b: 1, d: 2 }
      result.current.mergePaths({ a: { c: 3 } });
    });

    expect(result.current.getPath("a")).toEqual({ c: 3 });
    expect(result.current.getPath("a.c")).toBe(3);
    expect(result.current.getPath("a.b")).toBeUndefined();
    expect(result.current.getPath("e")).toBe(3);
  });
  
  it("should handle updates to nested objects correctly", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    
    act(() => {
      result.current.setPath("todos.0.priority", "high");
    });
    
    expect(result.current.getPath("todos.0.priority")).toBe("high");
    expect(result.current.getPath("todos.0.text")).toBe("Learn React");
    expect(result.current.getPath("todos.0.completed")).toBe(true);
  });
  
  it("should handle array operations correctly", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    
    const newTodo = { id: 3, text: "Test Hook", completed: false, tags: ["test"] };
    
    act(() => {
      const currentTodos = result.current.getPath("todos");
      result.current.setPath("todos", [...currentTodos, newTodo]);
    });
    
    const updatedTodos = result.current.getPath("todos");
    expect(updatedTodos.length).toBe(3);
    expect(result.current.getPath("todos.2.text")).toBe("Test Hook");
  });

  /**
   * NOTE. getting react hooks like useEffect and useSyncExternalStore to work
   * in tests is a pain, so we're calling addSubscriber and removeSubscriber
   * directly to test that functionality.
   */
  describe("watchState", () => {
    it("should call the function when the state changes", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});

      result.current.__addSubscriber__(mockFn);
      result.current.setState({ ...initialState, filter: "completed" });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should call the function with the updated state", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      const updatedState = { ...initialState, filter: "completed" };
      
      result.current.__addSubscriber__(mockFn);
      result.current.setState(updatedState);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(updatedState);
    });
    
    it("should no longer call the function after removing subscriber", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      
      result.current.__addSubscriber__(mockFn);
      result.current.setState({ ...initialState, filter: "completed" });
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      result.current.__removeSubscriber__(mockFn);
      result.current.setState({ ...initialState, filter: "active" });
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should trigger multiple path watchers when state object is replaced", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const filterMock = mock(() => {});
      const todoTextMock = mock(() => {});

      // Watch two different paths
      result.current.__addSubscriber__(filterMock, "filter");
      result.current.__addSubscriber__(todoTextMock, "todos.0.text");

      const newState = { 
        ...initialState, // Spread to include all keys
        filter: "completed" 
      };
      
      act(() => {
        result.current.setState(newState);
      });

      // Both watchers should be called because setState notifies based on keys 
      // present in the new state object, and the notification logic checks parent/child.
      expect(filterMock).toHaveBeenCalledTimes(1);
      expect(filterMock).toHaveBeenCalledWith("completed");
      expect(todoTextMock).toHaveBeenCalledTimes(1);
      expect(todoTextMock).toHaveBeenCalledWith("Learn React"); // Value didn't change, but watcher triggered
    });
  });

  describe("watchPath", () => {
    it("should call the function when the path changes", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      
      result.current.__addSubscriber__(mockFn, "filter");
      result.current.setPath("filter", "completed");
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith("completed");
    });
    
    it("should only call the function when the watched path changes", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      
      result.current.__addSubscriber__(mockFn, "filter");
      result.current.setPath("nextId", 10);
      expect(mockFn).toHaveBeenCalledTimes(0);
      
      result.current.setPath("filter", "completed");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
    
    it("should call the function when a parent path changes", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      
      result.current.__addSubscriber__(mockFn, "todos.0.completed");
      result.current.setPath("todos.0.completed", false);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(false);
    });
    
    it("should call the function when updating a parent path", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      
      result.current.__addSubscriber__(mockFn, "todos.0.completed");
      
      const updatedTodo = { ...initialState.todos[0], completed: false };
      result.current.setPath("todos.0", updatedTodo);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(false);
    });
    
    it("should call the function when a child path is updated", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      
      result.current.__addSubscriber__(mockFn, "todos");
      result.current.setPath("todos.0.completed", false);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      const expectedTodos = [
        { ...initialState.todos[0], completed: false },
        initialState.todos[1]
      ];
      expect(mockFn).toHaveBeenCalledWith(expectedTodos);
    });
    
    it("should no longer call the function after removing subscriber", () => {
      const { result } = renderHook(() => useWatcherMap(initialState));
      const mockFn = mock(() => {});
      
      result.current.__addSubscriber__(mockFn, "filter");
      result.current.setPath("filter", "completed");
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      result.current.__removeSubscriber__(mockFn);
      result.current.setPath("filter", "active");
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should not call the function for partial path segment matches", () => {
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

  it("should properly handle undefined paths after removing all array items", () => {
    const { result } = renderHook(() => useWatcherMap(initialState));
    expect(result.current.getPath("todos.0.tags")).toEqual(["frontend", "learning"]);

    const mockFn = mock(() => {});
    result.current.__addSubscriber__(mockFn, "todos.0.tags");
    
    act(() => {
      result.current.setPath("todos", []);
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
  });
}); 