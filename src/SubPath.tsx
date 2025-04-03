import { useRef } from "react";
import "./App.css";
import classes from "./App.module.css";
import { useWatcherMapSubPaths, WatcherMapSubPathsReturn } from "./useWatcherMapSubPaths";

type State = {
  objectOne: {
    counterOne: number;
    counterTwo: number;
  };
  counterThree: number;
};

export function SubPathExample() {
  const watcher = useWatcherMapSubPaths<State>({
    objectOne: {
      counterOne: 0,
      counterTwo: 0,
    },
    counterThree: 0,
  });

  return (
    <div className={classes.exampleContainer}>
      <h2>SubPath Example</h2>
      
      <WatchingState watcher={watcher} />

      <div style={{ display: "flex", gap: "10px" }}>
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

const WatchingObjectOne = ({
  watcher,
}: {
  watcher: WatcherMapSubPathsReturn<State>;
}) => {
  const objectOne = watcher.usePath("objectOne");

  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.usePath("objectOne")`}</span>
        <span className={classes.value}>{JSON.stringify(objectOne, null, 2)}</span>
      </div>
    </RerenderIndicator>
  );
};

const WatchingCounterOne = ({
  watcher,
}: {
  watcher: WatcherMapSubPathsReturn<State>;
}) => {
  const counterOne = watcher.usePath("objectOne.counterOne");

  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.usePath("objectOne.counterOne")`}</span>
        <span className={classes.value}>{counterOne}</span>
      </div>
    </RerenderIndicator>
  );
};

const WatchingCounterTwo = ({
  watcher,
}: {
  watcher: WatcherMapSubPathsReturn<State>;
}) => {
  const counterTwo = watcher.usePath("objectOne.counterTwo");

  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.usePath("objectOne.counterTwo")`}</span>
        <span className={classes.value}>{counterTwo}</span>
      </div>
    </RerenderIndicator>
  );
};

const ListeningCounterOne = ({
  watcher,
}: {
  watcher: WatcherMapSubPathsReturn<State>;
}) => {
  watcher.watchPath("objectOne.counterOne", (value) => {
    console.log(`Listening Path objectOne.counterOne ${value}`);
  });

  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.watchPath("objectOne.counterOne", (value) => { ... })`}</span>
      </div>
    </RerenderIndicator>
  );
};

const ListeningCounterTwo = ({
  watcher,
}: {
  watcher: WatcherMapSubPathsReturn<State>;
}) => {
  watcher.watchPath("objectOne.counterTwo", (value) => {
    console.log(`Listening Path objectOne.counterTwo ${value}`);
  });

  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.watchPath("objectOne.counterTwo", (value) => { ... })`}</span>
      </div>
    </RerenderIndicator>
  );
};

const ListeningState = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  watcher.watchState((value) => {
    console.log(`Listening State ${JSON.stringify(value)}`);
  });

  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.watchState((value) => { ... })`}</span>
      </div>
    </RerenderIndicator>
  );
};

/**
 * Forces react to rebuilt this part of the tree
 */
const RerenderIndicator = ({ children }: { children: React.ReactNode }) => {
  const renderCount = useRef(0);

  renderCount.current += 1;

  return (
    <div className={classes.rerenderIndicator} key={renderCount.current}>
      {children}
    </div>
  );
};
