import { ImpactResult, ImpactInput } from '../../services/timelineImpactEngine';

type ProgressCallback = (processed: number, total: number) => void;

class CascadeQueueEngine {
  private isProcessing = false;

  async queueCascadeImpact(
    input: ImpactInput, 
    result: ImpactResult, 
    persistBatch: (input: ImpactInput, result: ImpactResult, entities: any[]) => Promise<void>,
    onProgress?: ProgressCallback
  ): Promise<void> {
    
    const entities = result.affectedEntities;
    const total = entities.length;

    if (total < 50) {
      // Small cascade: execute immediately
      await persistBatch(input, result, entities);
      if (onProgress) onProgress(total, total);
      return;
    }

    // Large cascade: Batch mode
    this.isProcessing = true;
    let processed = 0;
    const BATCH_SIZE = 50;

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = entities.slice(i, i + BATCH_SIZE);
        await persistBatch(input, result, chunk);
        
        processed += chunk.length;
        if (onProgress) onProgress(processed, total);

        // Yield thread
        await new Promise(r => setTimeout(r, 0));
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const cascadeQueueEngine = new CascadeQueueEngine();
