import classes from "./tabBar.module.css";

export const TabBar = ({
  tabs,
  onChange,
  selectedTab,
}: {
  tabs: { label: string; value: string }[];
  onChange: (value: string) => void;
  selectedTab: string;
}) => {
  return (
    <div className={classes.tabNavigation}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          className={`${classes.tabButton} ${tab.value === selectedTab ? classes.active : ""}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
