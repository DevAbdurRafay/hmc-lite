import os
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "HCM Lite"
    APP_ENV: str = "development"
    TZ: str = "Asia/Karachi"

    # Database
    DATABASE_URL: str = "postgresql+psycopg://hcm:hcm_password@localhost:5432/hcmlite"
    POSTGRES_USER: str = "hcm"
    POSTGRES_PASSWORD: str = "hcm_password"
    POSTGRES_DB: str = "hcmlite"

    # Security
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Initial Admin & Company Setup
    ADMIN_EMAIL: str = "admin@hcmlite.local"
    ADMIN_PASSWORD: str
    COMPANY_NAME: Optional[str] = "Saylani Tech Solutions"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000,http://localhost:3000,http://127.0.0.1:3000,http://localhost:19006,http://localhost:8081"

    # AI Configuration
    AI_PROVIDER: str = "groq"  # groq | gemini
    GROQ_API_KEY: Optional[str] = ""
    GEMINI_API_KEY: Optional[str] = ""
    AI_API_KEY: Optional[str] = ""
    AI_MODEL_GROQ: str = "qwen/qwen3.8-27b"
    AI_MODEL_GEMINI: str = "gemini-flash-latest"
    AI_TIMEOUT_SECONDS: int = 35
    AI_RATE_LIMIT_PER_HOUR: int = 120

    # Camera & Attendance Rules
    FACE_MIN_GPS_ACCURACY_M: float = 100.0
    STORE_FACE_PHOTOS: bool = False
    DEFAULT_TEMP_PASSWORD_LENGTH: int = 12

    @property
    def cors_origins_list(self) -> List[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        for default_dev_origin in ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "http://127.0.0.1:8000"]:
            if default_dev_origin not in origins:
                origins.append(default_dev_origin)
        return origins

    @property
    def active_ai_key(self) -> Optional[str]:
        if self.AI_API_KEY and self.AI_API_KEY.strip():
            return self.AI_API_KEY.strip()
        if self.AI_PROVIDER.lower() == "gemini":
            return self.GEMINI_API_KEY.strip() if self.GEMINI_API_KEY else ""
        return self.GROQ_API_KEY.strip() if self.GROQ_API_KEY else ""

    @property
    def is_ai_configured(self) -> bool:
        key = self.active_ai_key
        return bool(key and len(key) > 5)

    def get_missing_ai_key_name(self) -> str:
        if self.AI_PROVIDER.lower() == "gemini":
            return "GEMINI_API_KEY"
        return "GROQ_API_KEY"


try:
    settings = Settings()
except Exception as e:
    raise RuntimeError(
        f"Critical Configuration Error: Failed to load environment settings from .env file. "
        f"Ensure required variables (JWT_SECRET, ADMIN_PASSWORD) are set. Details: {e}"
    )
