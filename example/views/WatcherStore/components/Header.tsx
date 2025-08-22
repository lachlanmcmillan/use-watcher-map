import classes from './header.module.css';
import { RerenderIndicator } from '../../../components/RerenderIndicator/RerenderIndicator';
import { toggleSidebar, getCurrentUser } from '../appStore';

export const Header = () => {
  const currentUser = getCurrentUser();

  return (
    <RerenderIndicator>
      <div className={classes.header}>
        <div className={classes.headerLeft}>
          <button onClick={toggleSidebar} className={classes.menuButton}>
            ☰
          </button>
          <h1>Dashboard</h1>
        </div>

        <div className={classes.headerRight}>
          {currentUser && (
            <div className={classes.userAvatar}>
              <span className={classes.userInitials}>
                {getInitials(currentUser.name)}
              </span>
            </div>
          )}
        </div>
      </div>
    </RerenderIndicator>
  );
};

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('');
};
