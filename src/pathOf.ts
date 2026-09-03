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
 *
 * If any parent along the path is optional or nullable, `undefined` is added
 * to the result, because that is what getDeepPath returns when a parent is
 * missing. eg. with `emergencyContact?: { name: string }`,
 * TypeAtPath<MyType, 'emergencyContact.name'> is `string | undefined`.
 */
export type TypeAtPath<
  T extends Record<string, any>,
  Path extends string,
> = Path extends `${infer Key}.${infer Rest}`
  ? NonNullable<T[Key]> extends Record<string, any>
    ?
        // recurse into the parent with null/undefined stripped
        | TypeAtPath<NonNullable<T[Key]>, Rest>
        // parent may be undefined (optional) -> result may be undefined
        | (undefined extends T[Key] ? undefined : never)
        // parent may be null -> getDeepPath still returns undefined
        | (null extends T[Key] ? undefined : never)
    : never
  : T[Path];

/**
 * The type accepted when WRITING to a path with setPath.
 *
 * Same as TypeAtPath but without the `| undefined` added for optional or
 * nullable parents. A missing parent affects what you can read back, not
 * what a field is allowed to hold.
 */
export type SetTypeAtPath<
  T extends Record<string, any>,
  Path extends string,
> = Path extends `${infer Key}.${infer Rest}`
  ? NonNullable<T[Key]> extends Record<string, any>
    ? SetTypeAtPath<NonNullable<T[Key]>, Rest>
    : never
  : T[Path];
