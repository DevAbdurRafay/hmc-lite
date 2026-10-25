import logging
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger("hcmlite.database")

db_url = settings.DATABASE_URL
if db_url.startswith("postgresql+psycopg://"):
    try:
        import psycopg
    except ImportError:
        db_url = db_url.replace("postgresql+psycopg://", "postgresql+psycopg2://")

try:
    if "sqlite" in db_url:
        engine = create_engine(
            db_url,
            connect_args={"check_same_thread": False, "timeout": 30}
        )
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()
        logger.info("Connected to local SQLite database with WAL mode.")
    else:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20
        )
        with engine.connect() as conn:
            pass
        logger.info("Connected to PostgreSQL database successfully.")
except Exception as e:
    logger.warning(
        f"Database connection to {db_url} failed ({e}). "
        f"Falling back to local SQLite database 'sqlite:///./hcmlite_dev.db' for continuous local development/testing."
    )
    fallback_url = "sqlite:///./hcmlite_dev.db"
    engine = create_engine(
        fallback_url,
        connect_args={"check_same_thread": False, "timeout": 30}
    )
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
