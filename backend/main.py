"""QUANTIS FastAPI Backend — Main Application Entry Point."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

import redis.asyncio as aioredis
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from rq import Queue
from rq.job import Job
import redis as sync_redis

from quantis.api.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    JobStatus,
    ScenarioRequest,
    StatusResponse,
    StocksResponse,
)
from quantis.api.router import router as api_router
from quantis.config import REDIS_URL

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("quantis.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("QUANTIS backend starting...")
    try:
        r = sync_redis.from_url(REDIS_URL)
        r.ping()
        app.state.redis_sync = r
        app.state.queue = Queue(connection=r)
        logger.info("Redis connected at %s", REDIS_URL)
    except Exception as e:
        logger.warning("Redis not available (%s) — running in mock mode", e)
        app.state.redis_sync = None
        app.state.queue = None

    yield

    logger.info("QUANTIS backend shutting down...")


app = FastAPI(
    title="QUANTIS API",
    description="Regime-Aware Quant Intelligence Platform for Indian Markets",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


# ── WebSocket connection manager ───────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, job_id: str):
        await ws.accept()
        self.active_connections.setdefault(job_id, []).append(ws)

    def disconnect(self, ws: WebSocket, job_id: str):
        conns = self.active_connections.get(job_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast(self, job_id: str, message: dict):
        for ws in self.active_connections.get(job_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def broadcast_all(self, message: dict):
        for conns in self.active_connections.values():
            for ws in conns:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass


manager = ConnectionManager()


@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    """Global live WebSocket — regime updates, price ticks, agent messages."""
    await websocket.accept()
    logger.info("WebSocket client connected")
    try:
        while True:
            # Heartbeat + mock live data every 15 seconds
            await asyncio.sleep(15)
            import random
            await websocket.send_json({
                "type": "price_tick",
                "data": {
                    "nifty_level": round(22000 + random.uniform(-200, 200), 2),
                    "india_vix": round(14 + random.uniform(-2, 4), 2),
                    "timestamp": datetime.utcnow().isoformat(),
                },
                "timestamp": datetime.utcnow().isoformat(),
            })
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")


@app.websocket("/ws/job/{job_id}")
async def websocket_job(websocket: WebSocket, job_id: str):
    """Per-job WebSocket for streaming pipeline progress."""
    await manager.connect(websocket, job_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo heartbeat
            await websocket.send_json({"type": "pong", "job_id": job_id})
    except WebSocketDisconnect:
        manager.disconnect(websocket, job_id)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "timestamp": datetime.utcnow().isoformat()}
