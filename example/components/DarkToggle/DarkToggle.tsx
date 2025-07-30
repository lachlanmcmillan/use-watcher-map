import { useEffect, useState } from 'react';
import classes from './darkToggle.module.css';

export const DarkToggle = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Check for user's preferred theme on initial load
    // if (
    //   window.matchMedia &&
    //   window.matchMedia("(prefers-color-scheme: dark)").matches
    // ) {
    //   return "dark";
    // }
    // return "light";
    return 'dark';
  });

  useEffect(() => {
    // Set the theme on the document element
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <button
      onClick={toggleTheme}
      className={classes.themeToggle}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode (Ctrl+D)`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
};
