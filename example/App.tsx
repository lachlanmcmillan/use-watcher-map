import { useState } from "react";
import { DarkToggle } from "./components/DarkToggle/DarkToggle";
import { TabBar } from "./components/TabBar/TabBar";
import { Simple } from "./views/Simple/Simple";
import { SubPathArraysExample } from "./views/SubPathArrays/SubPathArrays";
import { SubPathExample } from "./views/SubPath/SubPath";
import classes from "./App.module.css";

const tabs: { label: string; value: string }[] = [
  { label: "Simple", value: "simple" },
  { label: "SubPath", value: "subpath" },
  { label: "SubPath Arrays", value: "subpath-arrays" },
];

export const App = () => {
  const [tab, setTab] = useState<(typeof tabs)[number]["value"]>("simple");

  return (
    <div>
      <DarkToggle />

      <h1>WatcherMap</h1>
      <p className={classes.appDescription}>
        Fine-grained state updates in React without signals. WatcherMap uses path subscriptions 
        to ensure components re-render only when relevant data changes.
      </p>

      <TabBar
        tabs={tabs}
        selectedTab={tab}
        onChange={(value) => setTab(value)}
      />

      <div className={classes.tabContent}>
        {tab === "simple" && <Simple />}
        {tab === "subpath" && <SubPathExample />}
        {tab === "subpath-arrays" && <SubPathArraysExample />}
      </div>
    </div>
  );
};