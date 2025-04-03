/**
 * Set a value at a deep path
 * 
 * Given an array of paths, eg. ['loadItems', '0', 'description'],
 * set the value at the end of the path
 * 
 * @example
 * let initial = { 
 *   key1: { 
 *     description: 'apples' 
 *   },
 *   key2: {
 *     description: 'bananas'
 *   }
 * }
 * let result = setDeepPathClone(initial, ['key1', 'description'], 'oranges'); 
 * 
 * console.log(result.key1.description) // 'oranges'
 * console.log(initial === result) // false
 * console.log(initial.key1 === result.key1) // false
 * console.log(initial.key2 === result.key2) // true
 * 
 * This version of the function will not modify the original object in place.
 * Instead it will return a new object with the value set at the deep path.
 */
export const setDeepPathClone = (obj: Record<any, any>, paths: string[], value: any) => {
  // If paths is empty, return the original object
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
export const getDeepPath = (obj: Record<any, any>, paths: string[]): any => {
  const [first, ...rest] = paths;
  const result = obj[first];
  if (rest.length === 0) {
    return result;
  }
  return getDeepPath(result, rest);
}