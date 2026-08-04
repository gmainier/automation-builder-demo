// Enhanced step result interface for Zapier-like execution display

export interface EnhancedStepResult {
  // Identity
  nodeId: string;
  stepNumber: number;
  stepType: "trigger" | "action";

  // Display info
  service: string; // "meta-ads", "google-sheets", "google-drive"
  event: string; // "Performance Threshold", "Duplicate Ad", "Launch Ad"

  // Timing
  startedAt: string;
  completedAt: string;
  durationMs: number;

  // Status
  status: "success" | "failed" | "skipped";
  error?: string;

  // Data - inputs and outputs
  inputs: StepInputs;
  outputs: StepOutputs;

  // Resources created (ads, ad sets, campaigns)
  resources?: ResourceLink[];

  // User-friendly summary for display
  summary: string;

  // Legacy compatibility - Ads Manager link
  adsManagerLink?: string;
}

export interface StepInputs {
  // Configuration used for this step
  config?: Record<string, any>;

  // Data received from previous step(s)
  fromPreviousStep?: DataFlowItem[];
}

export interface DataFlowItem {
  nodeId: string;
  field: string;
  value: any;
}

export interface StepOutputs {
  // Generic outputs - varies by step type
  [key: string]: any;

  // Common trigger outputs
  totalAdsChecked?: number;
  qualifyingAdsCount?: number;
  qualifyingAds?: QualifyingAd[];
  qualifyingAdIds?: string[];
  matchedCampaigns?: { id: string; name: string }[];
  matchedAdSets?: { id: string; name: string; campaignName?: string }[];

  // Common action outputs
  successfulCopies?: number;
  failedCopies?: number;
  createdAdIds?: string[];
  operations?: any[];
}

export interface QualifyingAd {
  adId: string;
  adName: string;
  thumbnailUrl?: string;
  spend?: number;
  roas?: number;
  cpa?: number;
  cpc?: number;
  ctr?: number;
  conversions?: number;
  status?: string;
}

export interface ResourceLink {
  type: "ad" | "adset" | "campaign" | "batch";
  id: string;
  name: string;
  url: string;
}

// Helper to check if a step result is enhanced format
export function isEnhancedStepResult(step: any): step is EnhancedStepResult {
  return (
    step &&
    typeof step === "object" &&
    "stepNumber" in step &&
    "stepType" in step &&
    "inputs" in step &&
    "summary" in step
  );
}

// Ads Manager link helpers — use getAdsManagerLink / getBatchAdsManagerLink
// from "@/app/api/automation-rules/execute/utils/ads-manager-links"
