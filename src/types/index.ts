export interface JournalEntry {
  id: string;
  content: string;
  startTime: string;
  endTime: string;
  duration: string;
  image?: string;
  createdAt: string;
}

export interface RoamConfig {
  apiToken: string;
  graphName: string;
}

export interface Settings {
  roamConfig: RoamConfig | null;
  isConfigured: boolean;
}
