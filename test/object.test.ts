import { setDeepPathClone, getDeepPath, deleteDeepPathClone } from "../src/object";
import { describe, it, expect } from "bun:test";

describe("setDeepPathClone", () => {
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

describe("deleteDeepPathClone", () => {
  it("should demonstrate the example from the function comment", () => {
    // return the clone
    let initial = {
      key1: {
        fruit: 'apples',
        color: 'red'
      },
      key2: {
        fruit: 'bananas',
        color: 'yellow'
      }
    }
    let result = deleteDeepPathClone(initial, ['key1', 'fruit']);
    
    expect(result.key1.fruit).toBeUndefined();
    expect(result.key1.color).toBe('red');
    // the result is a new object, not a reference to the original and
    // the nested object is cloned
    expect(initial.key1 === result.key1).toBe(false);
    expect(initial === result).toBe(false);
    expect(initial.key2 === result.key2).toBe(true);
  });

  it("should delete a property at a specified deep path", () => {
    const initial = {
      a: {
        b: {
          c: 123,
          d: 456,
        },
        e: 789,
      },
      f: 'hello',
    };

    const result = deleteDeepPathClone(initial, ['a', 'b', 'c']);

    // Verify the property is deleted
    expect(result.a.b.c).toBeUndefined();
    // Verify sibling property is untouched
    expect(result.a.b.d).toBe(456);
    // Verify other parts of the object are untouched
    expect(result.a.e).toBe(789);
    expect(result.f).toBe('hello');

    // Verify immutability
    expect(initial.a.b.c).toBe(123); // Original object unchanged
    expect(initial === result).toBe(false); // Root object cloned
    expect(initial.a === result.a).toBe(false); // Nested path cloned
    expect(initial.a.b === result.a.b).toBe(false); // Nested path cloned
  });

  it("should handle deleting from arrays", () => {
    const initial = {
      items: [
        { id: '101', name: "item1" },
        { id: '102', name: "item2", details: { value: 'v2' } },
        { id: '103', name: "item3" },
      ]
    };

    // Note the '1' is the index of the item in the array, not the id
    const result = deleteDeepPathClone(initial, ['items', '1', 'details']);

    expect(result.items[1].details).toBeUndefined();
    expect(result.items[1].id).toBe('102'); // Other properties of the item remain
    expect(result.items.length).toBe(3); // Array length unchanged

    // Immutability checks
    expect(initial.items[1].details).toEqual({ value: 'v2' }); // Original unchanged
    expect(initial.items === result.items).toBe(false); 
    expect(initial.items[0] === result.items[0]).toBe(true); // Unchanged item reference remains the same
    expect(initial.items[1] === result.items[1]).toBe(false); // Changed item cloned
    expect(initial.items[2] === result.items[2]).toBe(true); // Unchanged item reference remains the same
  });

  it("should handle deleting a non-existent path gracefully", () => {
    const initial = { a: { b: 1 } };
    const result = deleteDeepPathClone(initial, ['a', 'c']);

    expect(result).toEqual({ a: { b: 1 } });
    expect(result.a.c).toBeUndefined();

    // Immutability checks - path was NOT cloned because we didn't modify it
    expect(initial === result).toBe(true);
    expect(initial.a === result.a).toBe(true);
  });

  it("should handle deleting a non-existent path on a primitive value gracefully", () => {
    const initial = { a: { b: 1 } };
    const result = deleteDeepPathClone(initial, ['a', 'b', 'c']);

    expect(result).toEqual({ a: { b: 1 } });
    expect(result.a.b.c).toBeUndefined();

    // Immutability checks - path was NOT cloned because we didn't modify it
    expect(initial === result).toBe(true);
    expect(initial.a === result.a).toBe(true);
  });

  it("should return the original object if path is empty", () => {
    const initial = { a: 1 };
    const result = deleteDeepPathClone(initial, []);
    expect(result === initial).toBe(true);
  });
  
  it("should handle deleting the last property of an object", () => {
    const initial = { a: { b: 1 } };
    const result = deleteDeepPathClone(initial, ['a', 'b']);
    
    expect(result.a).toEqual({});
    expect(result.a.b).toBeUndefined();
    
    // Immutability
    expect(initial.a.b).toBe(1);
    expect(initial.a === result.a).toBe(false);
  });

  it("should remove nested empty object when removeEmptyObjects is true", () => {
    const initial = {
      a: {
        b: {
          c: 123, // Only property in b
        },
        e: 789,
      },
      f: 'hello',
    };

    const result = deleteDeepPathClone(initial, ['a', 'b', 'c'], true); // removeEmptyObjects = true

    // Verify property c is deleted and object b is also removed
    expect(result.a.b).toBeUndefined();
    // Verify sibling property e is untouched
    expect(result.a.e).toBe(789);
    expect(result.f).toBe('hello');

    // Verify immutability
    expect(initial.a.b.c).toBe(123);
    expect(initial.a.b).toEqual({ c: 123 });
    expect(initial === result).toBe(false);
    expect(initial.a === result.a).toBe(false);
  });

  it("should NOT remove nested empty object when removeEmptyObjects is false (default)", () => {
    const initial = {
      a: {
        b: {
          c: 123, // Only property in b
        },
        e: 789,
      },
      f: 'hello',
    };

    // Test with removeEmptyObjects = false
    const resultFalse = deleteDeepPathClone(initial, ['a', 'b', 'c'], false);
    expect(resultFalse.a.b).toEqual({}); // b becomes an empty object
    expect(resultFalse.a.e).toBe(789);
    expect(initial.a === resultFalse.a).toBe(false); // Still cloned
    expect(initial.a.b === resultFalse.a.b).toBe(false); // Still cloned

    // Test with removeEmptyObjects omitted (should default to false)
    const resultDefault = deleteDeepPathClone(initial, ['a', 'b', 'c']);
    expect(resultDefault.a.b).toEqual({}); // b becomes an empty object
    expect(resultDefault.a.e).toBe(789);
    expect(initial.a === resultDefault.a).toBe(false);
    expect(initial.a.b === resultDefault.a.b).toBe(false);
  });
  
  it("should not remove non-empty object even if removeEmptyObjects is true", () => {
     const initial = {
      a: {
        b: {
          c: 123,
          d: 456 // b has another property
        },
        e: 789,
      },
      f: 'hello',
    };

    const result = deleteDeepPathClone(initial, ['a', 'b', 'c'], true);

    expect(result.a.b).toEqual({ d: 456 }); // b is not removed, just c
    expect(result.a.e).toBe(789);
    expect(initial.a.b.c).toBe(123);
    expect(initial.a.b).toEqual({ c: 123, d: 456 });
  });
});

        