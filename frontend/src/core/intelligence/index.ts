import { IntelligenceFacade } from './api/IntelligenceFacade';
import { ForecastRefreshPipeline } from './api/ForecastRefreshPipeline';
import { IntelligenceCache } from './api/IntelligenceCache';
import { SupabasePersistenceAdapter } from './persistence/SupabasePersistenceAdapter';
import { IntelligencePersistenceGateway } from './persistence/IntelligencePersistenceGateway';

const adapter = new SupabasePersistenceAdapter();
export const intelligenceGateway = new IntelligencePersistenceGateway(adapter);

export const intelligenceCache = new IntelligenceCache();
export const forecastRefreshPipeline = new ForecastRefreshPipeline(intelligenceCache);

export const intelligenceFacade = new IntelligenceFacade();
