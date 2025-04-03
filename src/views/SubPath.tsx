import classes from "./subPath.module.css";
import { useWatcherMap, WatcherMapSubPathsReturn } from "../hooks/useWatcherMapSubPaths";
import { RerenderIndicator } from "../components/RerenderIndicator/RerenderIndicator";
import { DisplayRow } from "../components/DisplayRow/DisplayRow";

/**
 * SubPathExample - Demonstrates nested object state watching with useWatcherMapSubPaths
 * Shows how to access and update nested properties using string paths
 * Includes examples of watching nested paths and selective re-rendering
 */

type State = {
  objectOne: {
    counterOne: number;
    counterTwo: number;
  };
  counterThree: number;
};

export function SubPathExample() {
  const watcher = useWatcherMap<State>({
    objectOne: {
      counterOne: 0,
      counterTwo: 0,
    },
    counterThree: 0,
  });

  return (
    <div className={classes.exampleContainer}>
      <h2>SubPath Example</h2>
      
      <p className={classes.description}>
        Nested object updates via string paths.
      </p>
      
      <WatchingState watcher={watcher} />

      <div className={classes.buttonContainer}>
        <button
          onClick={() =>
            watcher.setPath("objectOne.counterOne", watcher.getPath("objectOne.counterOne") + 1)
          }
        >
          CounterOne++
        </button>

        <button
          onClick={() =>
            watcher.setPath("objectOne.counterTwo", watcher.getPath("objectOne.counterTwo") + 1)
          }
        >
          CounterTwo++
        </button>

        <button
          onClick={() =>
            watcher.setPath("counterThree", watcher.getPath("counterThree") + 1)
          }
        >
          CounterThree++
        </button>

        <button
          onClick={() =>
            watcher.setState({ objectOne: { counterOne: 0, counterTwo: 0 }, counterThree: 0 })
          }
        >
          Reset
        </button>
      </div>

      <WatchingObjectOne watcher={watcher} />
      <WatchingCounterOne watcher={watcher} />
      <WatchingCounterTwo watcher={watcher} />
      <ListeningCounterOne watcher={watcher} />
      <ListeningCounterTwo watcher={watcher} />
      <ListeningState watcher={watcher} />
    </div>
  );
}

const WatchingState = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  const state = watcher.useState();

  return (
    <RerenderIndicator>
      <pre className={classes.stateDisplay}>{JSON.stringify(state, null, 2)}</pre>
    </RerenderIndicator>
  );
};

const WatchingObjectOne = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  const objectOne = watcher.usePath("objectOne");
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.usePath("objectOne")'>
        {JSON.stringify(objectOne, null, 2)}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const WatchingCounterOne = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  const counterOne = watcher.usePath("objectOne.counterOne");
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.usePath("objectOne.counterOne")'>
        {counterOne}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const WatchingCounterTwo = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  const counterTwo = watcher.usePath("objectOne.counterTwo");
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.usePath("objectOne.counterTwo")'>
        {counterTwo}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const ListeningCounterOne = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  watcher.watchPath("objectOne.counterOne", (value) => {
    console.log(`Listening Path objectOne.counterOne ${value}`);
  });
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.watchPath("objectOne.counterOne", (value) => { ... })'>{null}</DisplayRow>
    </RerenderIndicator>
  );
};

const ListeningCounterTwo = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  watcher.watchPath("objectOne.counterTwo", (value) => {
    console.log(`Listening Path objectOne.counterTwo ${value}`);
  });
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.watchPath("objectOne.counterTwo", (value) => { ... })'>{null}</DisplayRow>
    </RerenderIndicator>
  );
};

const ListeningState = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  watcher.watchState((value) => {
    console.log(`Listening State ${JSON.stringify(value)}`);
  });
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.watchState((value) => { ... })'>{null}</DisplayRow>
    </RerenderIndicator>
  );
};