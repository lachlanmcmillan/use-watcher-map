import classes from './sidebar.module.css';
import { RerenderIndicator } from '../../../components/RerenderIndicator/RerenderIndicator';
import { DiamondIcon } from '../../../components/icons/Diamond';
import { appStore } from '../appStore';
import { GroupIcon } from '../../../components/icons/Group';

export const Sidebar = () => {
  const isOpen = appStore.usePath('sidebarOpen');

  return (
    <RerenderIndicator>
      <div className={classes.sidebar} data-open={isOpen}>
        <h3 className={classes.sidebarHeader}>
          <DiamondIcon />
          {isOpen && 'Your App'}
        </h3>

        <nav className={classes.sidebarNav}>
          <a href="#" className={classes.navItem}>
            <GroupIcon />
            {isOpen && 'Dashboard'}
          </a>
        </nav>
      </div>
    </RerenderIndicator>
  );
};
