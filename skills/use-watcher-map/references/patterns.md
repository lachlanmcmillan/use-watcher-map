# Patterns

## Local form, split subscriptions

```tsx
import { useWatcherMap, type WatcherMap } from 'use-watcher-map';

type FormState = {
  user: { name: string; email: string };
  submitted: boolean;
};

export function Form() {
  const $form = useWatcherMap<FormState>({
    user: { name: '', email: '' },
    submitted: false,
  });

  const onSubmit = () => {
    const { user } = $form.getState();
    $form.batch(() => {
      $form.setPath('user.name', user.name.trim());
      $form.setPath('submitted', true);
    });
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <NameField $form={$form} />
      <EmailField $form={$form} />
      <Submit $form={$form} />
    </form>
  );
}

function NameField({ $form }: { $form: WatcherMap<FormState> }) {
  const name = $form.usePath('user.name');
  return (
    <input
      value={name}
      onChange={e => $form.setPath('user.name', e.target.value)}
    />
  );
}

function EmailField({ $form }: { $form: WatcherMap<FormState> }) {
  const email = $form.usePath('user.email');
  return (
    <input
      value={email}
      onChange={e => $form.setPath('user.email', e.target.value)}
    />
  );
}

function Submit({ $form }: { $form: WatcherMap<FormState> }) {
  const submitted = $form.usePath('submitted');
  return <button disabled={submitted}>Save</button>;
}
```

## Global store + module computed

```tsx
// stores/app.ts
import { watcherStore, computedStore } from 'use-watcher-map';

export type Item = { id: number; type: 'fruit' | 'veg'; name: string };

export const $app = watcherStore({
  items: [] as Item[],
  filter: 'all' as 'all' | 'fruit' | 'veg',
});

export const $visible = computedStore(
  $app,
  (state: { items: Item[]; filter: 'all' | 'fruit' | 'veg' }) =>
    state.filter === 'all'
      ? state.items
      : state.items.filter(i => i.type === state.filter)
);

export function addItem(item: Item) {
  $app.setPath('items', [...$app.getPath('items'), item]);
}
```

```tsx
// VisibleList.tsx
import { $visible } from './stores/app';

export function VisibleList() {
  const items = $visible.useState();
  return (
    <ul>
      {items.map(i => (
        <li key={i.id}>{i.name}</li>
      ))}
    </ul>
  );
}
```

If the computed result is an object and you only need one field:

```tsx
const label = $stats.usePath('vegetableSummary');
```

## Chain computeds (hook)

```tsx
const $items = useWatcherMap({ items: [] as Item[] });
const $veg = useComputed({ watcher: $items, path: 'items' }, items =>
  items.filter(i => i.type === 'veg')
);
const $hasVeg = useComputed($veg, veg => veg.length > 0);
const $ok = useComputed(
  [$hasVeg, $hasFruit],
  ([hasVeg, hasFruit]) => hasVeg && hasFruit
);
```

## Primitive watchers as computed deps

```tsx
const $a = useWatcher(2);
const $b = useWatcher(3);
const $product = useComputed([$a, $b], ([a, b]) => a * b);
```

## Skip notify for values shallow-equal cannot see

`isShallowEqual` does not look inside nested objects or compare `Map` contents. Return `prev` when nothing meaningful changed:

```tsx
const $byId = useComputed({ watcher: $app, path: 'items' }, (items, prev) => {
  const next = new Map(items.map(i => [i.id, i]));
  const prevMap = prev?.map;
  const unchanged =
    prevMap !== undefined &&
    next.size === prevMap.size &&
    [...next].every(([k, v]) => prevMap.get(k) === v);
  return unchanged ? prev : { map: next };
});
```

## Array item row (subscribe to one index)

```tsx
function TodoRow({
  $todos,
  index,
}: {
  $todos: WatcherMap<{ todos: { text: string; completed: boolean }[] }>;
  index: number;
}) {
  const text = $todos.usePath(`todos.${index}.text`);
  const completed = $todos.usePath(`todos.${index}.completed`);
  return (
    <label>
      <input
        type="checkbox"
        checked={completed}
        onChange={() => $todos.setPath(`todos.${index}.completed`, !completed)}
      />
      {text}
    </label>
  );
}
```

Prefer stable `id` keys in lists. After `filter`/`splice`, index-based `usePath` follows the new occupant of that index.

## Actions live next to the store

```tsx
export const $auth = watcherStore({
  userId: null as number | null,
  token: null as string | null,
});

export function login(userId: number, token: string) {
  $auth.batch(() => {
    $auth.setPath('userId', userId);
    $auth.setPath('token', token);
  });
}

export function logout() {
  $auth.setState({ userId: null, token: null });
}
```

Components call `login()` from click handlers; they do not need `usePath` unless they render those fields.

## Context (only if the tree is deep)

Put the watcher in context. Do **not** subscribe in the provider.

```tsx
const FormCtx = createContext<WatcherMap<FormState> | null>(null);

function FormProvider({ children }: { children: React.ReactNode }) {
  const $form = useWatcherMap<FormState>({
    user: { name: '', email: '' },
    submitted: false,
  });
  return <FormCtx.Provider value={$form}>{children}</FormCtx.Provider>;
}

function useForm() {
  const $form = useContext(FormCtx);
  if (!$form) throw new Error('missing FormProvider');
  return $form;
}

function NameInput() {
  const $form = useForm();
  const name = $form.usePath('user.name');
  return (
    <input
      value={name}
      onChange={e => $form.setPath('user.name', e.target.value)}
    />
  );
}
```
