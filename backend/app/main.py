import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.deps import limiter
import app.models  # ensure models are registered

# Routers
from app.api.v1.auth import router as auth_router
from app.api.v1.org import router as org_router
from app.api.v1.employees import router as employees_router
from app.api.v1.attendance import router as attendance_router
from app.api.v1.leave import router as leave_router
from app.api.v1.payroll import router as payroll_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.ai import router as ai_router
from app.api.v1.comms import router as comms_router
from app.api.v1.audit import router as audit_router

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("hcmlite")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup verification
    logger.info(f"Starting {settings.APP_NAME} ({settings.APP_ENV})...")

    # Ensure database schema is present
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema verified.")
    except Exception as e:
        logger.error(f"Database schema initialization warning: {e}")

    # Startup check for AI provider key
    if not settings.is_ai_configured:
        missing_var = settings.get_missing_ai_key_name()
        logger.warning(
            f"--> AI PROVIDER '{settings.AI_PROVIDER.upper()}' IS NOT CONFIGURED! "
            f"The application will run normally, but AI endpoints will return friendly fallbacks. "
            f"To enable AI features, please paste your key into `{missing_var}` in backend/.env"
        )
    else:
        logger.info(f"AI Provider '{settings.AI_PROVIDER.upper()}' is configured and ready.")

    yield
    logger.info("Shutting down HCM Lite...")


app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise-grade Human Capital Management System for Admin, HR, and Employees",
    version="1.0.0",
    lifespan=lifespan
)

# SlowAPI Limiter state & handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Standardized error format handler: {code, message, detail, details}
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    human_msg = "Please verify your input fields."
    clean_details = []
    for err in errors:
        raw_msg = err.get("msg", "")
        if raw_msg.startswith("Value error, "):
            raw_msg = raw_msg[len("Value error, "):]
        clean_details.append({
            "loc": [str(x) for x in err.get("loc", [])],
            "msg": raw_msg,
            "type": str(err.get("type", "value_error"))
        })
    if clean_details:
        human_msg = clean_details[0]["msg"] or human_msg

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "code": "VALIDATION_ERROR",
            "message": human_msg,
            "detail": human_msg,
            "details": clean_details
        }
    )


# Health endpoint reporting db and ai status (no secrets exposed)
@app.get("/health", tags=["System"])
def health_check():
    db_status = "unhealthy"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
            db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database_status": db_status,
        "ai_configured": settings.is_ai_configured,
        "ai_provider": settings.AI_PROVIDER,
        "timezone": settings.TZ,
        "status": "online"
    }


# Mount v1 Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(org_router, prefix="/api/v1")
app.include_router(employees_router, prefix="/api/v1")
app.include_router(attendance_router, prefix="/api/v1")
app.include_router(leave_router, prefix="/api/v1")
app.include_router(payroll_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(comms_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")


@app.get("/", tags=["System"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "documentation": "/docs",
        "health": "/health"
    }
