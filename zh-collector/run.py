"""zh-collector 入口：python run.py"""
import os, uvicorn
from app import app as wm_app  # noqa

if __name__ == "__main__":
    uvicorn.run(wm_app, host="0.0.0.0", port=int(os.getenv("PORT","8081")))