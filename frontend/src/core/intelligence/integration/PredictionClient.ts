export class PredictionClient {
    public async postPrediction(type: string, workspaceId: string, features: any): Promise<any> {
        // Stub for fetch to Python FastAPI
        return { prediction: 42, confidence: 0.9, explanation: { top_features: [] } };
    }
}
