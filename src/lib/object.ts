/**
 * Set a value at a deep path, cloning any nested object which changes
 * 
 * Given an array of paths, eg. ['loadItems', '0', 'description'],
 * set the value at the end of the path
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
 * let result = setDeepPathClone(initial, ['key1', 'fruit'], 'oranges'); 
 * 
 * console.log(result.key1.fruit) // 'oranges'
 * console.log(result.key1.color) // 'red'
 * console.log(initial.key1 === result.key1) // false
 * console.log(initial.key2 === result.key2) // true
 * console.log(initial === result) // false
 * 
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