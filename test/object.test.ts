import { setDeepPathClone, getDeepPath } from "../src/object";
import { describe, it, expect } from "bun:test";

describe("setDeepPathCopy", () => {
  it("should set a value at a deep path", () => {
    const obj = {
      a: {
        b: {
          c: "test",
        },
      },
    };
    const result = setDeepPathClone(obj, ["a", "b", "c"], "test2");
    expect(result.a.b.c).toBe("test2");

    // Original object should remain unchanged
    expect(obj.a.b.c).toBe("test");
  });

  it("should match the example from the function comments", () => {
    const initial = {
      key1: {
        description: "key1-description",
      },
      key2: {
        description: "key2-description",
      },
    };

    const result = setDeepPathClone(initial, ["key1", "description"], "example");

    // Test the value was updated correctly
    expect(result.key1.description).toBe("example");

    // Test immutability - original object should not be modified
    expect(initial === result).toBe(false);
    expect(initial.key1 === result.key1).toBe(false);

    // Test that unrelated parts of the object remain reference equal
    expect(initial.key2 === result.key2).toBe(true);

    // Test the original value wasn't changed
    expect(initial.key1.description).toBe("key1-description");
  });

  it("should create intermediate objects if they do not exist", () => {
    const obj = { a: {} };
    const result = setDeepPathClone(obj, ["a", "b", "c"], "value");
    expect(result.a.b.c).toBe("value");

    // Original object should remain unchanged
    expect("b" in obj.a).toBe(false);
  });

  it("should add paths to existing objects and return a new object", () => {
    const initial = {
      key1: {
        description: "apples",
      },
      key2: {
        description: "bananas",
      },
    };

    const result = setDeepPathClone(initial, ["key1", "colors"], "red");
    expect(result.key1.colors).toBe("red");
    expect((initial.key1 as any).colors).toBe(undefined);
    expect(initial.key1 === result.key1).toBe(false);
    expect(initial.key1.description).toBe("apples");
    expect(initial.key2 === result.key2).toBe(true);
  });

  it("should handle array indices as path segments", () => {
    const obj = { items: [{ name: "item1" }, { name: "item2" }] };
    const result = setDeepPathClone(obj, ["items", "0", "name"], "updated");

    expect(result.items[0].name).toBe("updated");
    // array reference is not the same
    expect(obj.items === result.items).toBe(false);
    // result type is still an array
    expect(Array.isArray(result.items)).toBe(true);
    // object reference is not the same
    expect(obj.items[0] === result.items[0]).toBe(false);
    // original is unchanged
    expect(obj.items[0].name).toBe("item1");
    // the second item is the same
    expect(obj.items[1] === result.items[1]).toBe(true);
  });

  it("should handle empty paths gracefully", () => {
    const obj = { a: 1 };
    const result = setDeepPathClone(obj, [], "value");

    // When path is empty, function should return a copy of the original object
    expect(result).toEqual({ a: 1 });
    expect(result === obj).toBe(true);
  });
  
  it("should maintain array order when replacing an entire array item", () => {
    const obj = { 
      items: [
        { id: 1, name: "item1" }, 
        { id: 2, name: "item2" }, 
        { id: 3, name: "item3" }
      ] 
    };
    
    // Replace the middle item completely
    const result = setDeepPathClone(obj, ["items", "1"], { id: 4, name: "new item" });
    
    // Verify array structure and order is maintained
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBe(3);
    
    // Check that items are in the correct order
    expect(result.items[0].id).toBe(1);
    expect(result.items[1].id).toBe(4); // New item
    expect(result.items[2].id).toBe(3);
    
    // Check that the replaced item has the new values
    expect(result.items[1].name).toBe("new item");
    
    // Original array should be unchanged
    expect(obj.items[1].id).toBe(2);
    expect(obj.items[1].name).toBe("item2");
  });
});

describe("getDeepPath", () => {
  it("should get a value at a deep path", () => {
    const obj = {
      key1: {
        description: "apples",
        color: "red"
      },
      key2: {
        description: "bananas",
        color: "yellow"
      }
    };
    
    expect(getDeepPath(obj, ["key1", "description"])).toBe("apples");
    expect(getDeepPath(obj, ["key2", "color"])).toBe("yellow");
  });
  
  it("should return undefined for non-existent paths", () => {
    const obj = {
      key1: {
        description: "apples"
      }
    };
    
    expect(getDeepPath(obj, ["key1", "color"])).toBeUndefined();
    expect(getDeepPath(obj, ["key3"])).toBeUndefined();
    expect(getDeepPath(obj, ["key1", "description", "nested"])).toBeUndefined();
  });
  
  it("should handle array indices as path segments", () => {
    const obj = {
      items: [
        { name: "item1", tags: ["tag1", "tag2"] },
        { name: "item2", tags: ["tag3", "tag4"] }
      ]
    };
    
    expect(getDeepPath(obj, ["items", "0", "name"])).toBe("item1");
    expect(getDeepPath(obj, ["items", "1", "name"])).toBe("item2");
    expect(getDeepPath(obj, ["items", "0", "tags", "1"])).toBe("tag2");
    expect(getDeepPath(obj, ["items", "1", "tags", "0"])).toBe("tag3");
  });
  
  it("should handle empty paths gracefully", () => {
    const obj = { a: 1 };
    expect(getDeepPath(obj, [])).toBeUndefined();
  });

  it("should handle undefined or null objects", () => {
    expect(getDeepPath(undefined, ["key1", "description"])).toBeUndefined();
    expect(getDeepPath(null, ["key1", "description"])).toBeUndefined();
  });
  
  it("should handle accessing nested paths on undefined values", () => {
    const obj = {
      items: []
    };
    
    // Accessing a property on an undefined array element
    expect(getDeepPath(obj, ["items", "0", "name"])).toBeUndefined();
    
    // Accessing deeply nested properties that don't exist
    expect(getDeepPath(obj, ["nonexistent", "deeply", "nested", "path"])).toBeUndefined();
  });
});

        