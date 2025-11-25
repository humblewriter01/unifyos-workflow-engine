// API utility functions for UnifyOS Frontend
// Location: apps/frontend/lib/api.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiError {
  message: string;
  statusCode: number;
}

// Generic fetch wrapper with error handling
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Notifications API
export interface Notification {
  id: number;
  app: string;
  message: string;
  time: string;
  unread: boolean;
  priority: 'high' | 'medium' | 'low';
  icon: string;
}

export const notificationsApi = {
  // Get all notifications
  getAll: async (): Promise<Notification[]> => {
    // Mock implementation - replace with real API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: 1,
            app: 'Slack',
            message: 'New message in #general',
            time: '2 min ago',
            unread: true,
            priority: 'high',
            icon: '💬',
          },
        ]);
      }, 500);
    });
  },

  // Mark notification as read
  markAsRead: async (id: number): Promise<void> => {
    return fetchApi(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  // Mark all as read
  markAllAsRead: async (): Promise<void> => {
    return fetchApi('/notifications/read-all', {
      method: 'PATCH',
    });
  },
};

// Apps API
export interface App {
  id: string;
  name: string;
  icon: string;
  description: string;
  connected: boolean;
  category: string;
}

export const appsApi = {
  // Get all available apps
  getAll: async (): Promise<App[]> => {
    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: 'gmail',
            name: 'Gmail',
            icon: '📧',
            description: 'Send and receive emails',
            connected: true,
            category: 'Communication',
          },
        ]);
      }, 500);
    });
  },

  // Connect an app
  connect: async (appId: string): Promise<{ authUrl: string }> => {
    return fetchApi(`/apps/${appId}/connect`, {
      method: 'POST',
    });
  },

  // Disconnect an app
  disconnect: async (appId: string): Promise<void> => {
    return fetchApi(`/apps/${appId}/disconnect`, {
      method: 'DELETE',
    });
  },
};

// Workflows API
export interface Workflow {
  id: string;
  name: string;
  trigger: {
    app: string;
    event: string;
  };
  actions: Array<{
    app: string;
    task: string;
  }>;
  active: boolean;
  createdAt: string;
}

export const workflowsApi = {
  // Get all workflows
  getAll: async (): Promise<Workflow[]> => {
    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            name: 'Email to Slack',
            trigger: { app: 'Gmail', event: 'New email received' },
            actions: [{ app: 'Slack', task: 'Send message' }],
            active: true,
            createdAt: new Date().toISOString(),
          },
        ]);
      }, 500);
    });
  },

  // Create a workflow
  create: async (workflow: Omit<Workflow, 'id' | 'createdAt'>): Promise<Workflow> => {
    return fetchApi('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  },

  // Update a workflow
  update: async (id: string, workflow: Partial<Workflow>): Promise<Workflow> => {
    return fetchApi(`/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(workflow),
    });
  },

  // Delete a workflow
  delete: async (id: string): Promise<void> => {
    return fetchApi(`/workflows/${id}`, {
      method: 'DELETE',
    });
  },

  // Test a workflow
  test: async (id: string): Promise<{ success: boolean; message: string }> => {
    return fetchApi(`/workflows/${id}/test`, {
      method: 'POST',
    });
  },
};

// Analytics API
export interface AnalyticsData {
  connectedApps: number;
  activeWorkflows: number;
  timeSaved: number;
  notificationsProcessed: number;
}

export const analyticsApi = {
  // Get dashboard stats
  getStats: async (): Promise<AnalyticsData> => {
    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          connectedApps: 3,
          activeWorkflows: 2,
          timeSaved: 4.5,
          notificationsProcessed: 127,
        });
      }, 500);
    });
  },
};

// User API
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export const userApi = {
  // Get current user
  getCurrent: async (): Promise<User> => {
    return fetchApi('/user/me');
  },

  // Update user profile
  updateProfile: async (data: Partial<User>): Promise<User> => {
    return fetchApi('/user/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// Export all APIs
export const api = {
  notifications: notificationsApi,
  apps: appsApi,
  workflows: workflowsApi,
  analytics: analyticsApi,
  user: userApi,
};

export default api;
