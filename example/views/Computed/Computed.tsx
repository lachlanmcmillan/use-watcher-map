import classes from './computed.module.css';
import { useComputed, WatcherComputed } from '../../../src/useComputed';
import { useWatcherMap, WatcherMap } from '../../../src/useWatcherMap';
import { RerenderIndicator } from '../../components/RerenderIndicator/RerenderIndicator';

type ItemType = 'fruits' | 'vegetables';

type Item = {
  id: number;
  type: ItemType;
  name: string;
};

type State = {
  items: Item[];
  nextId: number;
};

type ItemStats = {
  total: number;
  fruitCount: number;
  vegetableCount: number;
  vegetableSummary: string;
  dominantType: ItemType | 'balanced' | 'empty';
};

const fruitNames = ['apple', 'banana', 'pear', 'orange'];
const vegetableNames = ['lettuce', 'carrot', 'broccoli', 'spinach'];

export function ComputedExample() {
  const allItems = useWatcherMap<State>({
    items: [
      { id: 1, type: 'fruits', name: 'apple' },
      { id: 2, type: 'vegetables', name: 'lettuce' },
    ],
    nextId: 3,
  });

  const vegetables = useComputed([allItems, 'items'], (items: Item[]) =>
    items.filter(item => item.type === 'vegetables')
  );

  const hasVegetables = useComputed([allItems, 'items'], (items: Item[]) =>
    items.some(item => item.type === 'vegetables')
  );

  const itemStats = useComputed([allItems, 'items'], (items: Item[]) => {
    const fruitCount = items.filter(item => item.type === 'fruits').length;
    const vegetableCount = items.filter(
      item => item.type === 'vegetables'
    ).length;
    const dominantType: ItemStats['dominantType'] =
      items.length === 0
        ? 'empty'
        : fruitCount === vegetableCount
          ? 'balanced'
          : fruitCount > vegetableCount
            ? 'fruits'
            : 'vegetables';

    return {
      total: items.length,
      fruitCount,
      vegetableCount,
      vegetableSummary: `${vegetableCount} vegetable${vegetableCount === 1 ? '' : 's'}`,
      dominantType,
    };
  });

  const addItem = (type: ItemType) => {
    const items = allItems.getPath('items');
    const nextId = allItems.getPath('nextId');
    const names = type === 'fruits' ? fruitNames : vegetableNames;
    const name = names[nextId % names.length];

    allItems.setPath('items', [...items, { id: nextId, type, name }]);
    allItems.setPath('nextId', nextId + 1);
  };

  const removeItem = (type: ItemType) => {
    const items = allItems.getPath('items');
    const index = items.findIndex(item => item.type === type);

    if (index === -1) {
      return;
    }

    allItems.setPath(
      'items',
      items.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  return (
    <div className={classes.exampleContainer}>
      <h2>Computed Example</h2>

      <p className={classes.description}>
        A computed store subscribes to <code>[allItems, 'items']</code> and
        filters the list to vegetables. The vegetables view only re-renders
        when the filtered vegetable result changes.
      </p>

      <WatchingState watcher={allItems} />

      <div className={classes.buttonContainer}>
        <button onClick={() => addItem('fruits')}>Add Fruit</button>
        <button onClick={() => addItem('vegetables')}>Add Vegetable</button>
        <button onClick={() => removeItem('fruits')}>Remove Fruit</button>
        <button onClick={() => removeItem('vegetables')}>
          Remove Vegetable
        </button>
      </div>

      <div className={classes.columns}>
        <AllItems watcher={allItems} />
        <div className={classes.computedColumn}>
          <Vegetables vegetables={vegetables} />
          <HasVegetables hasVegetables={hasVegetables} />
          <VegetableSummary stats={itemStats} />
        </div>
      </div>
    </div>
  );
}

const WatchingState = ({ watcher }: { watcher: WatcherMap<State> }) => {
  const state = watcher.useState();

  return (
    <RerenderIndicator>
      <pre className={classes.stateDisplay}>
        {JSON.stringify(state, null, 2)}
      </pre>
    </RerenderIndicator>
  );
};

const AllItems = ({ watcher }: { watcher: WatcherMap<State> }) => {
  const items = watcher.usePath('items');

  return (
    <section>
      <h3>All Items</h3>
      <RerenderIndicator>
        <ItemList items={items} />
      </RerenderIndicator>
    </section>
  );
};

const Vegetables = ({
  vegetables,
}: {
  vegetables: WatcherComputed<Item[]>;
}) => {
  const items = vegetables.useState();

  return (
    <section>
      <h3>Computed Vegetables</h3>
      <RerenderIndicator>
        <ItemList items={items} />
      </RerenderIndicator>
    </section>
  );
};

const HasVegetables = ({
  hasVegetables,
}: {
  hasVegetables: WatcherComputed<boolean>;
}) => {
  const value = hasVegetables.useState();

  return (
    <section>
      <h3>Computed Boolean</h3>
      <RerenderIndicator>
        <p className={classes.booleanValue}>
          hasVegetables: <strong>{String(value)}</strong>
        </p>
      </RerenderIndicator>
    </section>
  );
};

const VegetableSummary = ({ stats }: { stats: WatcherComputed<ItemStats> }) => {
  const label = stats.usePath('vegetableSummary');

  return (
    <section>
      <h3>Computed Object Path</h3>
      <RerenderIndicator>
        <p className={classes.booleanValue}>
          stats.usePath('vegetableSummary'): <strong>{String(label)}</strong>
        </p>
      </RerenderIndicator>
    </section>
  );
};

const ItemList = ({ items }: { items: Item[] }) => {
  if (items.length === 0) {
    return <p className={classes.empty}>No items</p>;
  }

  return (
    <ul className={classes.itemList}>
      {items.map(item => (
        <li key={item.id}>
          <span className={classes.itemType}>{item.type}</span>
          <span>{item.name}</span>
        </li>
      ))}
    </ul>
  );
};
