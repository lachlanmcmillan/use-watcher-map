import { useState } from 'react';
import classes from './loginPage.module.css';
import { login } from '../appStore';

export const LoginPage = () => {
  const [email, setEmail] = useState('jdoe@example.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const success = login(email, password);
    if (!success) {
      setError('Invalid email or password');
    }
  };

  return (
    <div className={classes.loginPage}>
      <div className={classes.loginBox}>
        <h3>Login to Your Account</h3>
        <form onSubmit={handleLogin} className={classes.loginForm}>
          <div className={classes.formGroup}>
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={classes.input}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className={classes.formGroup}>
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={classes.input}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <div className={classes.error}>{error}</div>}

          <button type="submit" className={classes.loginButton}>
            Login
          </button>
        </form>

        <div className={classes.loginHint}>
          <p>
            <strong>Demo credentials:</strong>
          </p>
          <p>Email: jdoe@example.com</p>
          <p>Password: password</p>
        </div>
      </div>
    </div>
  );
};
