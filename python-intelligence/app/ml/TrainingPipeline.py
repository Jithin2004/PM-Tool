
from .DatasetLoader import DatasetLoader
from .TrainingPolicyEngine import TrainingPolicyEngine
from .FeatureSelector import FeatureSelector
from .HyperParameterSearch import HyperParameterSearch
from .CrossValidation import CrossValidation
from .ModelTrainer import ModelTrainer
from .CalibrationEngine import CalibrationEngine
from .ModelEvaluator import ModelEvaluator
from .TrainingArtifacts import TrainingArtifacts
from .ModelRegistry import ModelRegistry
from .ExperimentRegistry import ExperimentRegistry
from .ChampionChallenger import ChampionChallenger
from .TrainingTelemetry import TrainingTelemetry

class TrainingPipeline:
    def execute(self, dataset_id: str):
        telemetry = TrainingTelemetry()
        try:
            df = DatasetLoader().load(dataset_id)
            TrainingPolicyEngine().validate_dataset(df)
            
            X, selected, rejected = FeatureSelector().select_features(df[['f1']])
            y = df['target']
            
            params = HyperParameterSearch().search(X, y, 'RandomForest')
            cv_splits = CrossValidation().split(X, y)
            
            model = ModelTrainer().train(X, y, 'RandomForest', params)
            cal_metrics = CalibrationEngine().calibrate(model, X, y)
            eval_metrics = ModelEvaluator().evaluate(model, X, y)
            
            artifacts = TrainingArtifacts().save(model, eval_metrics, 'v1.0')
            mod_id = ModelRegistry().register({"version": "1.0", "metrics": eval_metrics})
            ExperimentRegistry().log({"model": mod_id, "params": params})
            
            champ_res = ChampionChallenger().evaluate_candidate(eval_metrics, {})
            
            return {
                "status": "success",
                "model_id": mod_id,
                "metrics": eval_metrics,
                "promoted": champ_res['promoted']
            }
        except Exception as e:
            telemetry.record({"status": "failed", "error": str(e)})
            raise e
