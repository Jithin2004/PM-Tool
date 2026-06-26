from .ModelLoader import ModelLoader
from .PredictionValidator import PredictionValidator
from .PredictionExplainer import PredictionExplainer
from .ConfidenceEngine import ConfidenceEngine
from .FallbackEngine import FallbackEngine
from .PredictionTelemetry import PredictionTelemetry
from .PredictionHistory import PredictionHistory
import time
import uuid

class PredictionPipeline:
    def execute(self, workspace_id, target_type, features):
        start = time.time()
        telemetry = PredictionTelemetry()
        try:
            PredictionValidator().validate(features)
            model_meta = ModelLoader().load_champion(workspace_id)
            
            if not model_meta:
                return FallbackEngine().trigger_fallback("No champion model found")
                
            raw_prediction = model_meta['model'](features)
            explanation = PredictionExplainer().explain(model_meta, features)
            confidence = ConfidenceEngine().calculate(0.9, 0.95, 1.0)
            
            if confidence < 0.5:
                return FallbackEngine().trigger_fallback("Confidence below threshold")
                
            response = {
                "prediction": raw_prediction,
                "confidence": confidence,
                "model_version": model_meta['id'],
                "explanation": explanation,
                "inference_time_ms": (time.time() - start) * 1000,
                "prediction_id": str(uuid.uuid4())
            }
            PredictionHistory().save(features, response)
            telemetry.record({"latency": response["inference_time_ms"]})
            return response
            
        except Exception as e:
            telemetry.record({"error": str(e)})
            return FallbackEngine().trigger_fallback(str(e))
