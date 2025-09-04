import classes from './simple.module.css';
import { useWatcherMap, WatcherMap } from '../../../src/useWatcherMap';
import { RerenderIndicator } from '../../components/RerenderIndicator/RerenderIndicator';
import { DisplayRow } from '../../components/DisplayRow/DisplayRow';

/**
 * SimpleExample - Demonstrates basic state watching with useWatcherMap
 * Shows how to watch and update primitive state values at the root level
 * Includes examples of watching specific paths and listening for changes
 */

type State = {
  counterOne: number;
  counterTwo: number;
};

export function Simple() {
  const watcher = useWatcherMap<State>({
    counterOne: 0,
    counterTwo: 0,
  });

  return (
    <div className={classes.exampleContainer}>
      <h2>Simple Example</h2>

      <p className={classes.description}>
        Root-level state watching and updates.
      </p>

      <WatchingState watcher={watcher} />

      <div className={classes.buttonContainer}>
        <button
          onClick={() =>
            watcher.setPath('counterOne', watcher.getPath('counterOne') + 1)
          }
        >
          CounterOne++
        </button>

        <button
          onClick={() =>
            watcher.setPath('counterTwo', watcher.getPath('counterTwo') + 1)
          }
        >
          CounterTwo++
        </button>

        <button
          onClick={() => watcher.setState({ counterOne: 0, counterTwo: 0 })}
        >
          Reset
        </button>
      </div>
      <WatchingCounterOne watcher={watcher} />
      <WatchingCounterTwo watcher={watcher} />
      <ListeningCounterOne watcher={watcher} />
      <ListeningCounterTwo watcher={watcher} />
      <ListeningState watcher={watcher} />
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

const WatchingCounterOne = ({
  watcher,
}: {
  watcher: WatcherMap<State>;
}) => {
  const counterOne = watcher.usePath('counterOne');
  return (
    <RerenderIndicator>
      <DisplayRow label="watcher.usePath('counterOne')">
        {counterOne}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const WatchingCounterTwo = ({
  watcher,
}: {
  watcher: WatcherMap<State>;
}) => {
  const counterTwo = watcher.usePath('counterTwo');
  return (
    <RerenderIndicator>
      <DisplayRow label="watcher.usePath('counterTwo')">
        {counterTwo}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const ListeningCounterOne = ({
  watcher,
}: {
  watcher: WatcherMap<State>;
}) => {
  watcher.watchPath('counterOne', value => {
    console.log(`watcher.watchpath("counterOne") =>`, value);
  });
  return (
    <RerenderIndicator>
      <DisplayRow label="watcher.watchPath('counterOne', (value) => { ... })">
        {null}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const ListeningCounterTwo = ({
  watcher,
}: {
  watcher: WatcherMap<State>;
}) => {
  watcher.watchPath('counterTwo', value => {
    console.log(`watcher.watchpath("counterTwo") =>`, value);
  });
  return (
    <RerenderIndicator>
      <DisplayRow label="watcher.watchPath('counterTwo', (value) => { ... })">
        {null}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const ListeningState = ({ watcher }: { watcher: WatcherMap<State> }) => {
  watcher.watchState(value => {
    console.log(`watcher.watchState((value) => { ... }) =>`, value);
  });
  return (
    <RerenderIndicator>
      <DisplayRow label="watcher.watchState((value) => { ... })">
        {null}
      </DisplayRow>
    </RerenderIndicator>
  );
};
