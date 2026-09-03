import type { PathOf, SetTypeAtPath, TypeAtPath } from './pathOf';

// Type-level examples for PathOf / TypeAtPath. Typechecked by `bun run compile`
// but excluded from the build, so nothing here ships in dist.

type FilteredKeys<T> = keyof T & (string | number);

// ----------------------------------------------------------------------------
// EXAMPLE USAGE
// ----------------------------------------------------------------------------

interface MyType {
  name: string;
  age?: number;
  friends: string[]; // array
  address: {
    street: {
      line1: string;
      line2?: string;
    };
    city: 'New York' | 'Los Angeles';
  };
  // optional object
  emergencyContact?: {
    name: string;
    phone: string;
  };
  // nullable object
  spouse?: {
    name: string;
    age: number;
  } | null;
  sub: SubType;
  record: Record<string, any>;
}

type SubType = {
  a: {
    b: number;
  };
};

// expected success
const example01: PathOf<MyType> = 'name';
const example02: PathOf<MyType> = 'address';
const example03: PathOf<MyType> = 'address.street';
const example04: PathOf<MyType> = 'address.street.line1';
const example05: PathOf<MyType> = 'address.street.line2';
const example06: PathOf<MyType> = 'address.city';
const example07: PathOf<MyType> = 'emergencyContact.name';
const example08: PathOf<MyType> = 'emergencyContact.phone';
const example09: PathOf<MyType> = 'spouse.name';
const example10: PathOf<MyType> = 'spouse.age';
const example11: PathOf<MyType> = 'friends';
const example12: PathOf<MyType> = 'friends.0'; // array access
const example13: PathOf<MyType> = 'sub.a.b'; // sub-type-access
const example84: PathOf<MyType> = 'record.key1'; // record access

// expected errors
// @ts-expect-error - no such key
const badExample10: PathOf<MyType> = 'color';
// @ts-expect-error - no such nested key
const badExample11: PathOf<MyType> = 'address.friends.sam';
// @ts-expect-error - no such key on emergencyContact
const badExample12: PathOf<MyType> = 'emergencyContact.age';
// members inherited from Object.prototype are not declared keys, so not paths
// @ts-expect-error
const badProtoExample01: PathOf<MyType> = 'address.toString';
// @ts-expect-error
const badProtoExample02: PathOf<MyType> = 'address.constructor';
// @ts-expect-error
const badProtoExample03: PathOf<MyType> = 'address.hasOwnProperty';
// @ts-expect-error
const badProtoExample04: PathOf<MyType> = 'toString';
// @ts-expect-error
const badProtoExample05: PathOf<MyType> = 'sub.a.valueOf';

// ----------------------------------------------------------------------------
// ARRAYS
// ----------------------------------------------------------------------------

// Arrays offer numeric indices and `length` as paths. Array METHODS are not
// paths: `friends.map` is not state, and setPath('friends.push', fn) would
// write a `push` property onto the array.
interface ListType {
  friends: string[];
  todos: { text: string; tags: string[] }[];
  matrix: number[][];
  readonlyIds: readonly number[];
  pair: [number, string];
}

// indices and length are valid
const arrExample01: PathOf<ListType> = 'friends.0';
const arrExample02: PathOf<ListType> = 'friends.length';
const arrExample03: PathOf<ListType> = 'todos.3.text';
const arrExample04: PathOf<ListType> = 'todos.3.tags.1';
const arrExample05: PathOf<ListType> = 'todos.3.tags.length';
const arrExample06: PathOf<ListType> = 'matrix.0.1'; // array of arrays
const arrExample07: PathOf<ListType> = 'readonlyIds.0'; // readonly array
const arrExample08: PathOf<ListType> = 'pair.1'; // tuple

// method names are not valid paths
// @ts-expect-error - find is an array method, not a path
const badArrExample01: PathOf<ListType> = 'friends.find';
// @ts-expect-error - push is an array method, not a path
const badArrExample02: PathOf<ListType> = 'friends.push';
// @ts-expect-error - map on a nested array is not a path either
const badArrExample03: PathOf<ListType> = 'todos.0.tags.map';
// @ts-expect-error - readonly arrays have methods too
const badArrExample04: PathOf<ListType> = 'readonlyIds.includes';

// TypeAtPath through arrays
const arrTypeExample01: TypeAtPath<ListType, 'friends.0'> = 'Alice'; // string
const arrTypeExample02: TypeAtPath<ListType, 'friends.length'> = 2; // number
const arrTypeExample03: TypeAtPath<ListType, 'todos.0.tags.1'> = 'tag'; // string
const arrTypeExample04: TypeAtPath<ListType, 'matrix.0.1'> = 7; // number

// Test TypeAtPath examples - corresponding to PathOf examples above
const typeExample01: TypeAtPath<MyType, 'name'> = 'John Doe'; // string
const typeExample02: TypeAtPath<MyType, 'address'> = {
  street: { line1: '123 Main St' },
  city: 'New York',
}; // address object
const typeExample03: TypeAtPath<MyType, 'address.street'> = {
  line1: '123 Main St',
  line2: 'Apt 1',
}; // street object
const typeExample04: TypeAtPath<MyType, 'address.street.line1'> = '123 Main St'; // string
const typeExample05: TypeAtPath<MyType, 'address.street.line2'> = 'Apt 1'; // string | undefined
const typeExample06: TypeAtPath<MyType, 'address.city'> = 'New York'; // 'New York' | 'Los Angeles'
const typeExample07: TypeAtPath<MyType, 'emergencyContact.name'> = 'Jane Doe'; // string
const typeExample08: TypeAtPath<MyType, 'emergencyContact.phone'> = '555-1234'; // string
const typeExample09: TypeAtPath<MyType, 'spouse.name'> = 'Jane'; // string
const typeExample10: TypeAtPath<MyType, 'spouse.age'> = 30; // number
const typeExample11: TypeAtPath<MyType, 'friends'> = ['Alice', 'Bob']; // string[]
const typeExample12: TypeAtPath<MyType, 'friends.0'> = 'Alice'; // string
const typeExample13: TypeAtPath<MyType, 'sub.a.b'> = 42; // number
const typeExample84: TypeAtPath<MyType, 'record.key1'> = 'value1'; // string

// Test with undefined values for optional properties
const typeExampleUndef1: TypeAtPath<MyType, 'age'> = undefined; // number | undefined
const typeExampleUndef2: TypeAtPath<MyType, 'age'> = 25; // number | undefined
const typeExampleUndef3: TypeAtPath<MyType, 'address.street.line2'> = undefined; // string | undefined

// A path through an optional or nullable PARENT must also include undefined,
// because getDeepPath returns undefined when any parent along the way is
// missing. `emergencyContact` is optional, so `emergencyContact.name` is
// string | undefined even though `name` itself is required.
const typeExampleUndef4: TypeAtPath<MyType, 'emergencyContact.name'> = undefined; // string | undefined
const typeExampleUndef5: TypeAtPath<MyType, 'emergencyContact.name'> = 'Jane'; // string | undefined
// `spouse` is optional AND nullable. A null parent still reads as undefined.
const typeExampleUndef6: TypeAtPath<MyType, 'spouse.name'> = undefined; // string | undefined
const typeExampleUndef7: TypeAtPath<MyType, 'spouse.age'> = undefined; // number | undefined

// Reading through an optional parent must not be assignable to the bare type
// @ts-expect-error - string | undefined is not assignable to string
const typeExampleUndef8: string = {} as TypeAtPath<MyType, 'emergencyContact.name'>;
// @ts-expect-error - number | undefined is not assignable to number
const typeExampleUndef9: number = {} as TypeAtPath<MyType, 'spouse.age'>;

// A path whose parents are all required stays narrow, no undefined added
const typeExampleReq1: string = {} as TypeAtPath<MyType, 'address.street.line1'>; // string
const typeExampleReq2: 'New York' | 'Los Angeles' = {} as TypeAtPath<MyType, 'address.city'>;
const typeExampleReq3: number = {} as TypeAtPath<MyType, 'sub.a.b'>; // number

// SetTypeAtPath is the WRITE type used by setPath. An optional parent does not
// make the field itself accept undefined.
const setExample1: SetTypeAtPath<MyType, 'emergencyContact.name'> = 'Jane'; // string
// @ts-expect-error - undefined is not assignable to string
const setExample2: SetTypeAtPath<MyType, 'emergencyContact.name'> = undefined;
// @ts-expect-error - undefined is not assignable to number
const setExample3: SetTypeAtPath<MyType, 'spouse.age'> = undefined;
// A field that is itself optional still accepts undefined on write
const setExample4: SetTypeAtPath<MyType, 'address.street.line2'> = undefined; // string | undefined
const setExample5: SetTypeAtPath<MyType, 'age'> = undefined; // number | undefined

// ----------------------------------------------------------------------------
// EXPLANATION OF THE TYPES
// ----------------------------------------------------------------------------

// NonNullable is a built in that removes null and undefined from a union type
type OnlyString = NonNullable<string | null | undefined>;
let example27: OnlyString = 'example';
// let badExample27: OnlyString = null; // expected error

// Typescript's template literal types automatically distribute over union types
type Distributed = `prefix.${'a' | 'b'}`; // evals to "prefix.a" | "prefix.b"
let example14: Distributed = 'prefix.a';
let example15: Distributed = 'prefix.b';
// we expect a non-existant literal to fail
// let badDxample14: Distributed = 'prefix.c'; // expected error

// all the literals are unioned
type Distributed2 = 'x' | 'y' | `prefix2.${Distributed}`;
let example16: Distributed2 = 'x';
let example17: Distributed2 = 'prefix2.prefix.b';

// The & creates an *intersection type* that filters the keys:
// This takes all the keys from T and keeps only the ones that are either string
// or number types. We need this to filter out symbols because template literal
// types (like ${Key}) cannot work with symbols
// this is valid with unfiltered-keys
let example18: keyof Array<any> = Symbol.iterator;
// however with filtered keys it should fail
// let example18: FilteredKeys<Array<any>> = Symbol.iterator; // expected error
// However string and number are valid
let example19: FilteredKeys<Array<any>> = 'find';
let example20: FilteredKeys<Array<any>> = 1;

// Mapped types allow you iterate over each key in the object type
// this example mapped type adds a prefix to each key
type PrefixedKeys<T, Prefix extends string> = {
  [Key in keyof T & (string | number) as `${Prefix}.${Key}`]: T[Key];
};

// NOTE. the optionality of the keys is lost here, so age is now required
let exampleM1: PrefixedKeys<MyType, 'my'> = {
  'my.name': 'John',
  'my.age': 30,
  'my.address': { street: { line1: '123 Main St' }, city: 'New York' },
  'my.friends': ['Jane', 'Jim'],
  'my.spouse': { name: 'Jane', age: 30 },
  'my.emergencyContact': { name: 'John', phone: '1234567890' },
  'my.sub': { a: { b: 10 } },
  'my.record': { key1: 'value1' },
};

// this example mapped type changes the type of each key to boolean
type BooleanRecord<T> = {
  [Key in keyof T]: boolean;
};

let example21: BooleanRecord<MyType> = {
  name: true,
  record: false,
  address: false,
  friends: true,
  sub: false,
};

// Indexed Access - extracting the types of an object's properties
// you can get the type of an object propety with the brackets syntax
type NameIsAString = MyType['name'];
const example22: NameIsAString = 'some kind of string';
// supplying a union to the brackets will result in a union of the property types
type NameOrAge = MyType['name' | 'age']; // evals to "string" | "number" | "undefined"
const example23: NameOrAge = 'some kind of string';
const example24: NameOrAge = 123;
// `keyof T` evaluates to a union of keys in T
type AllPropertyTypes = MyType[keyof MyType];
const example25: AllPropertyTypes = 'some kind of string';
const example26: AllPropertyTypes = 123;
