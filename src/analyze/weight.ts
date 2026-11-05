import { countTokens as ct } from 'gpt-tokenizer/encoding/o200k_base';
import type { HarnessId, ScannedItem } from '../model.js';
import { getAdapter } from '../harness/index.js';

export function countTokens(text: string): number {
  return ct(text);
}

export function computeWeights(item: ScannedItem): { weight: Partial<Record<HarnessId, number>>; weightTotal: number } {
  const weight: Partial<Record<HarnessId, number>> = {};
  let weightTotal = 0;
  for (const harness of item.loadedBy) {
    const tokens = countTokens(getAdapter(harness).listingLine(item));
    weight[harness] = tokens;
    weightTotal += tokens;
  }
  return { weight, weightTotal };
}
