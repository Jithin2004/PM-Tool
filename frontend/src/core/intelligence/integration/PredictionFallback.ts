export class PredictionFallback {
    public executeDeterministic(type: string, features: any): any {
        return { prediction: 'deterministic_calc', confidence: 1.0, is_fallback: true };
    }
}
