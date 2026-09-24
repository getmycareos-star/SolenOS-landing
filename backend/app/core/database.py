from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

import app.models.care
import app.models.document
import app.models.uncertainty
import app.models.temporal
import app.models.change
import app.models.significance
import app.models.action
import app.models.caregiver_intelligence
import app.models.causal
import app.models.safety
import app.models.memory
import app.models.time_location
import app.models.prioritization
import app.models.meaning
import app.models.knowledge_revision

Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sqlite_column_type(col, dialect):
    try:
        return str(col.type.compile(dialect=dialect))
    except Exception:
        return "TEXT"


def ensure_database_schema(bind=None):
    """Idempotently add ORM columns that are missing from existing SQLite tables.

    The backend persists via Base.metadata.create_all only (no Alembic in use).
    create_all creates tables but cannot add columns to tables that already
    exist with an older shape, which previously surfaced as HTTP 500
    ("table changes has no column named ...") after a model change. This guard
    adds only missing columns and never drops or rewrites data, so it is safe to
    run at startup against a stale dev database.
    """
    from sqlalchemy import inspect, text

    target = bind or engine
    try:
        insp = inspect(target)
        dialect = target.dialect
    except Exception:
        return
    
    from sqlalchemy import text as _text
    new_tables = [
        (name, table) for name, table in Base.metadata.tables.items()
        if not insp.has_table(name)
    ]
    if new_tables:
        try:
            Base.metadata.create_all(bind=target)
        except Exception:
            pass
    
    for table_name, table in Base.metadata.tables.items():
        if not insp.has_table(table_name):
            continue  # create_all already handles table creation; this guard adds columns only
        existing = {c["name"] for c in (insp.get_columns(table_name) or [])}
        for col in table.columns:
            if col.name in existing:
                continue
            col_type = _sqlite_column_type(col, dialect) or "TEXT"
            nullable = "" if col.nullable else " NOT NULL"
            default = ""
            if col.server_default is not None:
                default = f" DEFAULT {col.server_default.arg}"
            elif col.default is not None and not callable(col.default):
                v = col.default
                if isinstance(v, bool):
                    default = f" DEFAULT {1 if v else 0}"
                elif isinstance(v, (int, float)):
                    default = f" DEFAULT {v}"
                elif isinstance(v, str):
                    default = f" DEFAULT '{v}'"
            stmt = text(f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {col_type}{default}{nullable}')
            try:
                with target.begin() as conn:
                    conn.execute(stmt)
            except Exception:
                # A single column that cannot be added should not block startup;
                # it will raise concretely if actually needed.
                pass


ensure_database_schema()
