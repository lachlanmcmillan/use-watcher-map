import classes from './usersTable.module.css';
import { RerenderIndicator } from '../../../components/RerenderIndicator/RerenderIndicator';
import { appStore, User } from '../appStore';

export const UsersTable = () => {
  const users = appStore.usePath('users.data') as User[];
  return (
    <RerenderIndicator>
      <div className={classes.tableContainer}>
        <table className={classes.usersTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className={classes.userRow}>
                <td>{user.id}</td>
                <td>{user.name}</td>
                <td>{user.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RerenderIndicator>
  );
};
