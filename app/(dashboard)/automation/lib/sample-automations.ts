export interface SampleAutomation {
  id: string;
  name: string;
  apps: string[];
  lastModified: Date;
  lastRun?: Date;
  status: "draft" | "on" | "off";
  owner: string;
  nodes: Array<{
    id: string;
    type: "trigger" | "action" | "filter";
    label: string;
    service?: string;
    event?: string;
    config?: Record<string, any>;
  }>;
}

// Sample data removed - now using database
export const sampleAutomations: SampleAutomation[] = [];
