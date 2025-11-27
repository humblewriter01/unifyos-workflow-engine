export interface Notification {
  id: number;
  app: string;
  message: string;
  time: string;
  unread: boolean;
}

export interface AppConnection {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  lastSynced: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  trigger: { app: string; event: string };
  actions: Array<{ app: string; action: string }>;
  enabled: boolean;
}
