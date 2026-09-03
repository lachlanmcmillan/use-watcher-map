type FilteredKeys<T> = keyof T & (string | number);

// Create a mapped type that generates all possible nested property paths as
// string literals
export type PathOf<T extends Record<string, any>> = {
  [Key in FilteredKeys<T>]: NonNullable<T[Key]> extends object
    ? `${Key}` | `${Key}.${PathOf<NonNullable<T[Key]>>}`
    : `${Key}`;
}[FilteredKeys<T>];

/**
 * Get the type at a specified path
 *
 * eg. TypeAtPath<MyType, 'address.city'> // evals to 'New York' | 'Los Angeles'
 */
export type TypeAtPath<
  T extends Record<string, any>,
  Path extends string,
> = Path extends `${infer Key}.${infer Rest}`
  ? NonNullable<T[Key]> extends Record<string, any>
    ? TypeAtPath<NonNullable<T[Key]>, Rest>
    : never
  : T[Path];
