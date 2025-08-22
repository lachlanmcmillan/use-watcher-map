import classes from './usersPage.module.css';
import { RerenderIndicator } from '../../../components/RerenderIndicator/RerenderIndicator';
import { RefreshIcon } from '../../../components/icons/Refresh';
import { UsersTable } from './UsersTable';
import { appStore, fetchUsers, User } from '../appStore';

export const UsersPage = () => {
  const users = appStore.usePath('users.data') as User[];
  const lastFetched = appStore.usePath('users.lastFetched');

  return (
    <RerenderIndicator>
      <div className={classes.usersPage}>
        <div className={classes.pageHeader}>
          <h2>Users</h2>
          <div className={classes.pageActions}>
            {lastFetched && (
              <span className={classes.lastFetched}>
                Last updated: {new Date(lastFetched).toLocaleTimeString()}
              </span>
            )}
            <button onClick={fetchUsers} className={classes.refreshButton}>
              Refresh
              <RefreshIcon />
            </button>
          </div>
        </div>

        <UsersTable />
      </div>
    </RerenderIndicator>
  );
};
