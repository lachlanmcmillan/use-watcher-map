# CHANGELOG

## 2.1.0

- Improve function comments to work with TS language server
- Change React to a peerDependency

## 2.0.0

- Remove `mergePaths()`, add `batch()`

  The function behaviour was inconsistent with other functions and broke the
  mental model. This was a source of bugs in downstream application code.

  For example

  `mergePaths({ "a.b": "example" })`

  would set a path "a.b" (rather than `{ a: { b: "example" } }`), and

  `mergePaths({ a: { b: "example" } })` would overwrite any existing data
  at path "a".

  Instead use the new function `batch` to delay notifying until all sets
  have finished.

  ```javascript
  batch(() => {
    setPath('a.b', 'example-1');
    setPath('a.c', 'example-2');
  });
  ```

## 1.3.0

- Add `useWatcher` hook to more easily work with primitives

## 1.2.0

- `deleteDeepPathClone` implements a `removeEmptyObjects` flag

## 1.1.0

- Add `deleteDeepPathClone` and improve `clearPath`

## 1.0.0

- Initial Release
