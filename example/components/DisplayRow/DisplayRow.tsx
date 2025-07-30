import classes from './displayRow.module.css';

export const DisplayRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => {
  return (
    <div className={classes.displayRow}>
      <span>{label}</span>
      <span data-is-undefined={children === undefined}>{children}</span>
    </div>
  );
};
