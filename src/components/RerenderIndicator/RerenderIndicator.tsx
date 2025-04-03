import { useRef } from "react";
import classes from "./rerenderIndicator.module.css";

/**
 * A component wrapper that forces React to rebuild this part of the tree
 * and provides a visual indicator when a component re-renders.
 * 
 * The border of the component briefly highlights when it re-renders,
 * making it easy to visualize which components update in response to state changes.
 */
export const RerenderIndicator = ({ children }: { children: React.ReactNode }) => {
  const renderCount = useRef(0);

  renderCount.current += 1;

  return (
    <div className={classes.rerenderIndicator} key={renderCount.current}>
      <div className={classes.renderText}>render</div>
      {children}
    </div>
  );
}; 