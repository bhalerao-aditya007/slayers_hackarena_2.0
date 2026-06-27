"""QUANTIS FastAPI Backend — Main Application Entry Point."""
from __future__ import annotations

import asyncio
import logging
import random
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from quantis.api.router import router as api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("quantis.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("QUANTIS backend starting (no Mamba, real ML pipeline)...")
    yield
    logger.info("QUANTIS backend shutting down...")


app = FastAPI(
    title="QUANTIS API",
    description="Regime-Aware Quant Intelligence Platform — KAN + LightGBM + PatchTST + IL",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


# ── WebSocket connection manager ──────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.job_connections: dict[str, list[WebSocket]] = {}
        self.live_connections: list[WebSocket] = []

    async def connect_job(self, ws: WebSocket, job_id: str):
        await ws.accept()
        self.job_connections.setdefault(job_id, []).append(ws)

    async def connect_live(self, ws: WebSocket):
        await ws.accept()
        self.live_connections.append(ws)

    def disconnect_job(self, ws: WebSocket, job_id: str):
        conns = self.job_connections.get(job_id, [])
        if ws in conns:
            conns.remove(ws)

    def disconnect_live(self, ws: WebSocket):
        if ws in self.live_connections:
            self.live_connections.remove(ws)

    async def broadcast_live(self, message: dict):
        dead = []
        for ws in self.live_connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.live_connections.remove(ws)


manager = ConnectionManager()


@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    """Global live WebSocket — NIFTY price ticks + regime updates."""
    await manager.connect_live(websocket)
    logger.info("Live WebSocket connected (total: %d)", len(manager.live_connections))
    try:
        nifty_base = 22184.0
        while True:
            await asyncio.sleep(15)
            # Simulate live NIFTY tick
            nifty_base += random.uniform(-50, 50)
            india_vix = 14.5 + random.uniform(-2, 3)
            await websocket.send_json({
                "type": "price_tick",
                "data": {
                    "nifty_level": round(nifty_base, 2),
                    "india_vix": round(india_vix, 2),
                    "timestamp": datetime.utcnow().isoformat(),
                },
                "timestamp": datetime.utcnow().isoformat(),
            })
    except WebSocketDisconnect:
        manager.disconnect_live(websocket)
        logger.info("Live WebSocket disconnected")


@app.websocket("/ws/job/{job_id}")
async def websocket_job(websocket: WebSocket, job_id: str):
    """Per-job WebSocket for streaming pipeline progress."""
    await manager.connect_job(websocket, job_id)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "pong", "job_id": job_id})
    except WebSocketDisconnect:
        manager.disconnect_job(websocket, job_id)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "models": ["hmm_regime", "kan_alpha", "lgbm_alpha", "patchtst", "il"],
        "timestamp": datetime.utcnow().isoformat(),
    }
