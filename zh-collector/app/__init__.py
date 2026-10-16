"""zh-collector 包入口 — 实际实现见 app/main.py (v0.2 multi-source)
run.py: `from app import app` → 这里 re-export
"""
from app.main import app  # noqa: F401
from app.main import SOURCES  # noqa: F401
__version__ = "0.2"
