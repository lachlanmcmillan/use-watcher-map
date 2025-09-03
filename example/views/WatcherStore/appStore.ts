import { watcherStore } from '../../../src';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface AppState {
  auth: {
    userId: number | null;
    loginTokenExpiry: string | null;
  } | null;
  sidebarOpen: boolean;
  users: {
    lastFetched: string | null;
    data: {
      id: number;
      name: string;
      email: string;
    }[];
  };
}

/**
 * Global application store - single source of truth for entire app state
 * Demonstrates how WatcherStore can manage authentication, UI state, and data
 */
export const appStore = watcherStore<AppState>({
  auth: null,
  sidebarOpen: false,
  users: {
    lastFetched: null,
    data: [],
  },
});

// Global authentication actions
export const login = (email: string, password: string) => {
  // Simulate login logic
  if (email === 'jdoe@example.com' && password === 'password') {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 8); // 8 hour session

    appStore.batch(() => {
      appStore.setPath('auth.userId', 9);
      appStore.setPath('auth.loginTokenExpiry', expiry.toISOString());
    });
    return true;
  }
  return false;
};

export const toggleSidebar = () => {
  const isOpen = appStore.getPath('sidebarOpen');
  appStore.setPath('sidebarOpen', !isOpen);
};

export const fetchUsers = () => {
  // Simulate API call
  appStore.setPath('users', {
    lastFetched: new Date().toISOString(),
    data: [
      {
        id: 9,
        name: 'John Doe',
        email: 'jdoe@example.com',
      },
      {
        id: 12,
        name: 'Jane Smith',
        email: 'jsmith@example.com',
      },
      {
        id: 15,
        name: 'Mike Johnson',
        email: 'mjohnson@example.com',
      },
      {
        id: 18,
        name: 'Sarah Wilson',
        email: 'swilson@example.com',
      },
    ],
  });
};

// @todo convert this into a computed/derived store
export const getCurrentUser = (): User | null => {
  const currentUserId = appStore.usePath('auth.userId');
  console.log('currentUserId: ', currentUserId);
  const users = appStore.usePath('users.data') as User[];

  if (!currentUserId) return null;

  return users.find(user => user.id === currentUserId) || null;
};
