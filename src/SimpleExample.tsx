import { useRef } from "react";
import "./App.css";
import classes from "./App.module.css";
import { useWatcherMap, WatcherMapReturn } from "./useWatcherMap";
import { RerenderIndicator } from "./RerenderIndicator";

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

      <WatchingState watcher={watcher} />

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={() =>
            watcher.setPath("counterOne", watcher.getPath("counterOne") + 1)
          }
        >
          CounterOne++
        </button>

        <button
          onClick={() =>
            watcher.setPath("counterTwo", watcher.getPath("counterTwo") + 1)
          }
        >
          CounterTwo++
        </button>

        <button
          onClick={() =>
            watcher.setState({ counterOne: 0, counterTwo: 0 })
          }
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

const WatchingState = ({ watcher }: { watcher: WatcherMapReturn<State> }) => {
  const state = watcher.useState();

  return (
    <RerenderIndicator>
      <pre className={classes.stateDisplay}>{JSON.stringify(state, null, 2)}</pre>
    </RerenderIndicator>
  );
};

const WatchingCounterOne = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  const counterOne = watcher.usePath("counterOne");

  return (
    <RerenderIndicator>
      <p>Watching Path CounterOne {counterOne}</p>
    </RerenderIndicator>
  );
};

const WatchingCounterTwo = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  const counterTwo = watcher.usePath("counterTwo");

  return (
    <RerenderIndicator>
      <p>Watching Path CounterTwo {counterTwo}</p>
    </RerenderIndicator>
  );
};

const ListeningCounterOne = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  watcher.watchPath("counterOne", (value) => {
    console.log(`Listening Path CounterOne ${value}`);
  });

  return (
    <RerenderIndicator>
      <p>Listening Path CounterOne</p>
    </RerenderIndicator>
  );
};

const ListeningCounterTwo = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  watcher.watchPath("counterTwo", (value) => {
    console.log(`Listening Path CounterTwo ${value}`);
  });

  return (
    <RerenderIndicator>
      <p>Listening Path CounterTwo</p>
    </RerenderIndicator>
  );
};

const ListeningState = ({ watcher }: { watcher: WatcherMapReturn<State> }) => {
  watcher.watchState((value) => {
    console.log(`Listening State ${JSON.stringify(value)}`);
  });

  return (
    <RerenderIndicator>
      <p>Listening State</p>
    </RerenderIndicator>
  );
};

