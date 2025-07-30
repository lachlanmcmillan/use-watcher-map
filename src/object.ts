/**
 * object.ts
 * 
 * Functions for working with deeply nested objects.
 * 
 * These are designed to work with React, as React will check for reference 
 * equality to determine if the component should re-render.
 */

/**
 * Set a value at a deep path, cloning any nested object which changes
 * 
 * Given an array of paths, eg. ['loadItems', '0', 'description'],
 * set the value at the end of the path
 * 
 * @example
 * const initial = { 
 *   key1: { 
 *     fruit: 'apples',
 *     color: 'red'
 *   },
 *   key2: {
 *     fruit: 'bananas',
 *     color: 'yellow'
 *   }
 * }
 * const result = setDeepPathClone(initial, ['key1', 'fruit'], 'oranges'); 
 * // key1.fruit is changed 
 * console.log(result.key1.fruit) // 'oranges'
 * // key1.color is unchanged
 * console.log(result.key1.color) // 'red'
 * // the result is a new object, not a reference to the original and
 * // the nested object is cloned
 * console.log(initial === result) // false
 * // result.key1 is a new object
 * console.log(initial.key1 === result.key1) // false
 * // result.key2 is a reference to the original
 * console.log(initial.key2 === result.key2) // true
 */
export const setDeepPathClone = (obj: Record<any, any>, paths: string[], value: any) => {
  if (paths.length === 0) {
    return obj;
  }

  const [first, ...rest] = paths;
  const result = copyObj(obj);

  if (rest.length === 0) {
    // We're at the last path element, set the value
    result[first] = value;
  } else {
    // Create a nested path if it doesn't exist
    const existingValue = obj[first] !== undefined ? obj[first] : {};
    // Recursively set the value for the rest of the path
    result[first] = setDeepPathClone(
      typeof existingValue === 'object' ? copyObj(existingValue) : {},
      rest,
      value
    );
  }

  return result;
}

/**
 * Helper function to copy an object or array while preserving its type
 */
function copyObj(obj: any): any {
  if (Array.isArray(obj)) {
    return [...obj];
  }
  return { ...obj };
}

/**
 * Get a value at a deep path
 * 
 * @example
 * let obj = {
 *   key1: {
 *     description: 'apples'
 *   }
 * }
 * let result = getDeepPath(obj, ['key1', 'description']);
 * 
 * console.log(result) // 'apples'
 */
export const getDeepPath = (obj: Record<any, any> | undefined | null, paths: string[]): any => {
  // Handle undefined or null objects
  if (obj === undefined || obj === null || paths.length === 0) {
    return undefined;
  }

  const [first, ...rest] = paths;
  const result = obj[first];
  if (rest.length === 0) {
    return result;
  }
  return getDeepPath(result, rest);
}

/**
 * Delete a value at a deep path, cloning any nested object which changes
 *
 * Similar to setDeepPathClone, but deletes the property at the end of the path.
 * If the path does not exist, the original object reference is returned.
 * 
 * @example
 * let initial = {
 *   key1: {
 *     fruit: 'apples',
 *     color: 'red'
 *   },
 *   key2: {
 *     fruit: 'bananas',
 *     color: 'yellow'
 *   }
 * }
 * let result = deleteDeepPathClone(initial, ['key1', 'fruit']);
 * 
 * console.log(result.key1.fruit) // undefined
 * console.log(result.key1.color) // 'red'
 * // the result is a new object, not a reference to the original and
 * // the nested object is cloned
 * console.log(initial === result) // false
 * // result.key1 is a new object
 * console.log(initial.key1 === result.key1) // false
 * // result.key2 is a reference to the original
 * console.log(initial.key2 === result.key2) // true
 */
export const deleteDeepPathClone = (obj: Record<any, any>, paths: string[], removeEmptyObjects = false): Record<any, any> => {
  if (paths.length === 0) {
    return obj;
  }

  const [first, ...rest] = paths;

  if (!(first in obj)) {
    return obj;
  }

  // if it's the final path segment, then we clone the current object
  // to update the reference
  if (rest.length === 0) {
    const result = copyObj(obj);
    delete result[first];
    return result;
  }

  // if it's a nested path
  const nestedValue = obj[first];

  // if the nested value is not an object, we can't go deeper, return original
  if (typeof nestedValue !== 'object' || nestedValue === null) {
    return obj;
  }

  // recursively call delete on the nested object
  const newNestedValue = deleteDeepPathClone(nestedValue, rest, removeEmptyObjects);

  // if the nested object was not changed, return original
  if (newNestedValue === nestedValue) {
    return obj;
  } else {
    // if the nested object *was* changed, clone the current level object
    // to update the reference
    const result = copyObj(obj);
    if (removeEmptyObjects && Object.keys(newNestedValue).length === 0) {
      delete result[first];
    } else {
      result[first] = newNestedValue;
    }
    return result;
  }
};