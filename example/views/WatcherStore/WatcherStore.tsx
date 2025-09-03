import classes from './watcherStore.module.css';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { appStore } from './appStore';
import { WatcherStore } from '../../../src';
import { RerenderIndicator } from '../../components/RerenderIndicator/RerenderIndicator';

export function WatcherStoreExample() {
  // Check authentication status to determine which view to show
  const auth = appStore.usePath('auth');
  const loggedIn = !!auth;

  return (
    <div className={classes.exampleContainer}>
      <h2>WatcherStore Website Mockup</h2>

      <p className={classes.description}>
        Complete website mockup demonstrating single global state management.
        All application state (auth, UI, data) is stored in one WatcherStore.
        Try logging in with email: "jdoe@example.com" and password: "password".
      </p>

      <WatchingState />

      {!loggedIn ? <LoginPage /> : <Layout />}
    </div>
  );
}

const WatchingState = () => {
  const state = appStore.useState();

  return (
    <RerenderIndicator>
      <pre className={classes.stateDisplay}>
        {JSON.stringify(state, null, 2)}
      </pre>
    </RerenderIndicator>
  );
};
