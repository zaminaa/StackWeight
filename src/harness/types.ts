import type { HarnessId, ObservedListing, ScanContext, ScannedItem } from '../model.js';
import type { HarnessUsage } from '../model.js';

export interface HarnessAdapter {
  id: HarnessId;
  detect(ctx: ScanContext): Promise<boolean>;
  pluginItems(ctx: ScanContext): Promise<{ items: ScannedItem[]; notes: string[] }>;
  mineUsage(ctx: ScanContext): Promise<HarnessUsage>;
  listingLine(item: ScannedItem): string;
  listingEvidence: 'observed' | 'assumed';
  observedListing?(ctx: ScanContext, countTokens: (text: string) => number): Promise<ObservedListing | null>;
}
