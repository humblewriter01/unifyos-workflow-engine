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
