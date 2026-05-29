/// <reference lib="webworker" />

import { computeImpactLocal } from './timelineImpactEngine';

self.onmessage = async (e: MessageEvent) => {
  try {
    const input = e.data;
    const result = await computeImpactLocal(input);
    self.postMessage({ type: 'success', result });
  } catch (error: any) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
