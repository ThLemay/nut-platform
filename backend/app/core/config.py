from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ENV: str = "development"
    DATABASE_URL: str
    SECRET_KEY: str
    NUT_ORG_ID: int = 1

    class Config:
        env_file = ".env"

settings = Settings()