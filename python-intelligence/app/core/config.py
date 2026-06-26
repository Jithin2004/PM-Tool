from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "Resolve Intelligence Platform"
    
    class Config:
        env_file = ".env"

settings = Settings()
