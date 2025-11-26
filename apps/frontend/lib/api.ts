// API utility functions for UnifyOS Frontend
// Location: apps/frontend/lib/api.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface ApiError {
  message: string;
  statusCode: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
  message?: string;
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
      const error: ApiError = await response.json().catch(() => ({
        message: 'API request failed',
        statusCode: response.status,
      }));
      throw new Error(error.message || 'API request failed');
    }

    const result: ApiResponse<T> = await response.json();
    return result.data;
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
  timestamp?: number;
}

export const notificationsApi = {
  // Get all notifications
  getAll: async (): Promise<Notification[]> => {
    return fetchApi('/notifications');
  },

  // Create notification (for testing)
  create: async (notification: Partial<Notification>): Promise<Notification> => {
    return fetchApi('/notifications', {
      method: 'POST',
      body: JSON.stringify(notification),
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
  connectedAt?: string;
}

export const appsApi = {
  // Get all available apps
  getAll: async (): Promise<App[]> => {
    return fetchApi('/apps');
  },

  // Connect an app
  connect: async (appId: string): Promise<{ authUrl: string }> => {
    return fetchApi(`/apps/${appId}/connect`, {
      method: 'POST',
    });
  },

  // Disconnect an app
  disconnect: async (appId: string): Promise<void> => {
    return fetchApi(`/apps/${appId}/connect`, {
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
  updatedAt?: string;
  executions?: number;
}

export const workflowsApi = {
  // Get all workflows
  getAll: async (): Promise<Workflow[]> => {
    return fetchApi('/workflows');
  },

  // Get single workflow
  getById: async (id: string): Promise<Workflow> => {
    return fetchApi(`/workflows/${id}`);
  },

  // Create a workflow
  create: async (workflow: {
    name: string;
    trigger: { app: string; event: string };
    actions: Array<{ app: string; task: string }>;
  }): Promise<Workflow> => {
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
    const result = await fetchApi<any>(`/workflows/${id}/test`, {
      method: 'POST',
    });
    return {
      success: result.testResult?.status === 'success',
      message: 'Workflow test completed successfully',
    };
  },
};

// Analytics API
export interface AnalyticsData {
  connectedApps: number;
  totalApps: number;
  activeWorkflows: number;
  totalWorkflows: number;
  timeSaved: number;
  notificationsProcessed: number;
  workflowExecutions: number;
  lastSync: string;
}

export const analyticsApi = {
  // Get dashboard stats
  getStats: async (): Promise<AnalyticsData> => {
    return fetchApi('/analytics/stats');
  },
};

// Health API
export interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  services: {
    api: string;
    database: string;
    redis: string;
  };
}

export const healthApi = {
  check: async (): Promise<HealthStatus> => {
    return fetchApi('/health');
  },
};

// Export all APIs
export const api = {
  notifications: notificationsApi,
  apps: appsApi,
  workflows: workflowsApi,
  analytics: analyticsApi,
  health: healthApi,
};

export default api;
