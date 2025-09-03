type FilteredKeys<T> = keyof T & (string | number);

// Create a mapped type that generates all possible nested property paths as
// string literals
export type PathOf<T extends Record<string, any>> = {
  [Key in FilteredKeys<T>]: T[Key] extends object
    ? `${Key}` | `${Key}.${PathOf<T[Key]>}`
    : `${Key}`;
}[FilteredKeys<T>];

// ----------------------------------------------------------------------------
// EXAMPLE USAGE
// ----------------------------------------------------------------------------

interface MyType {
  name: string;
  age?: number;
  address: {
    street: {
      line1: string;
      line2?: string;
    };
    city: 'New York' | 'Los Angeles';
  };
  friends: string[];
  sub: SubType;
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
const example07: PathOf<MyType> = 'friends';
const example08: PathOf<MyType> = 'friends.0'; // array access
const example09: PathOf<MyType> = 'sub.a.b'; // sub-type-access

// expected errors
// const example10: MyTypePath = 'color'; // expected error
// const example11: MyTypePath = 'address.friends.sam'; // expected error

// ----------------------------------------------------------------------------
// EXPLANATION OF THE TYPES
// ----------------------------------------------------------------------------

// Typescript's template literal types automatically distribute over union types
type Distributed = `prefix.${'a' | 'b'}`; // evals to "prefix.a" | "prefix.b"
let example12: Distributed = 'prefix.a';
let example13: Distributed = 'prefix.b';
// we expect a non-existant literal to fail
// let example14: Distributed = 'prefix.c'; // expected error

// all the literals are unioned
type Distributed2 = 'x' | 'y' | `prefix2.${Distributed}`;
let example15: Distributed2 = 'x';
let example16: Distributed2 = 'prefix2.prefix.b';

// The & creates an *intersection type* that filters the keys:
// This takes all the keys from T and keeps only the ones that are either string
// or number types. We need this to filter out symbols because template literal
// types (like ${Key}) cannot work with symbols
// this is valid with unfiltered-keys
let example17: keyof Array<any> = Symbol.iterator;
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
  'my.sub': { a: { b: 10 } },
};

// this example mapped type changes the type of each key to boolean
type BooleanRecord<T> = {
  [Key in keyof T]: boolean;
};

let example21: BooleanRecord<MyType> = {
  name: true,
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
