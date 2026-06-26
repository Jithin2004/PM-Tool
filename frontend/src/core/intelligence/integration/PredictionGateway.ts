import { PredictionClient } from './PredictionClient';
import { PredictionFallback } from './PredictionFallback';

export class PredictionGateway {
    private client = new PredictionClient();
    private fallback = new PredictionFallback();
    private failureCount = 0;
    private circuitOpen = false;
    private lastFailureTime = 0;
    private CIRCUIT_TIMEOUT = 60000; // 1 minute

    public async getPrediction(type: string, workspaceId: string, features: any): Promise<any> {
        // Circuit Breaker
        if (this.circuitOpen) {
            if (Date.now() - this.lastFailureTime > this.CIRCUIT_TIMEOUT) {
                this.circuitOpen = false;
            } else {
                return this.fallback.executeDeterministic(type, features);
            }
        }

        try {
            // Timeout Policy (3000ms)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const result = await this.client.postPrediction(type, workspaceId, features);
            clearTimeout(timeoutId);

            if (result.status === 'fallback_triggered' || result.confidence < 0.5) {
                return this.fallback.executeDeterministic(type, features);
            }
            
            this.failureCount = 0;
            return result;
        } catch (e) {
            this.failureCount++;
            this.lastFailureTime = Date.now();
            if (this.failureCount >= 3) {
                this.circuitOpen = true; // Trip breaker
            }
            return this.fallback.executeDeterministic(type, features);
        }
    }
}
