import ssl
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import create_engine
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)


def _strip_asyncpg_unsupported_params(url: str) -> tuple[str, dict]:
    """
    asyncpg does not understand psycopg2-style query params such as
    `sslmode` or `channel_binding`. Strip them from the URL and return
    the appropriate `connect_args` dict instead.

    Neon (and many managed PG services) append ?sslmode=require&channel_binding=require
    which breaks asyncpg. We replace that with an SSL context in connect_args.
    """
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    sslmode = params.pop("sslmode", ["disable"])[0]
    params.pop("channel_binding", None)   # asyncpg ignores / rejects this

    connect_args: dict = {}

    if sslmode in ("require", "verify-ca", "verify-full", "prefer"):
        ctx = ssl.create_default_context()
        # Neon uses a valid CA — keep verification enabled for require/verify-full.
        # For 'require' without a local CA bundle it's common to disable hostname check.
        if sslmode == "require":
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ctx

    new_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url = urlunparse(parsed._replace(query=new_query))
    return clean_url, connect_args


def _strip_sync_unsupported_params(url: str) -> tuple[str, dict]:
    """
    psycopg2 (sync engine) understands sslmode natively in the URL,
    but channel_binding is not a standard libpq parameter on all versions.
    Remove it so psycopg2 doesn't complain.
    """
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    params.pop("channel_binding", None)
    new_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url = urlunparse(parsed._replace(query=new_query))
    return clean_url, {}


# ── Async engine — FastAPI ─────────────────────────────────────────────────────

_async_url, _async_connect_args = _strip_asyncpg_unsupported_params(settings.database_url)

async_engine = create_async_engine(
    _async_url,
    connect_args=_async_connect_args,
    echo=settings.debug,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# ── Sync engine — Celery workers ───────────────────────────────────────────────

_sync_url, _sync_connect_args = _strip_sync_unsupported_params(settings.sync_database_url)

sync_engine = create_engine(
    _sync_url,
    connect_args=_sync_connect_args,
    echo=settings.debug,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db(retries: int = 5, delay: float = 3.0) -> None:
    import asyncio
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            async with async_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("database_initialized")
            return
        except Exception as exc:
            last_err = exc
            logger.warning(
                "database_init_retry",
                attempt=attempt,
                max=retries,
                error=str(exc),
            )
            if attempt < retries:
                await asyncio.sleep(delay)
    raise RuntimeError(f"Database unreachable after {retries} attempts: {last_err}") from last_err


async def close_db() -> None:
    await async_engine.dispose()
    logger.info("database_closed")
