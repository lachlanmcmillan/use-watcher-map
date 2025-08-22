import classes from './layout.module.css';
import { RerenderIndicator } from '../../../components/RerenderIndicator/RerenderIndicator';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { UsersPage } from './UsersPage';

export const Layout = () => {
  return (
    <RerenderIndicator>
      <div className={classes.app}>
        <Sidebar />
        <div className={classes.mainContent}>
          <Header />
          <UsersPage />
        </div>
      </div>
    </RerenderIndicator>
  );
};
