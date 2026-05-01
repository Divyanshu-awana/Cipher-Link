"""CipherLink backend — FastAPI app composition.

All business logic lives in /app/backend/routers/*.py. This file only:
  • Creates the FastAPI app and CORS
  • Mounts router modules under the /api prefix
  • Registers Mongo startup/shutdown hooks
"""
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from routers.deps import client, db, logger
from routers.auth import router as auth_router
from routers.users import router as users_router
from routers.conversations import router as conversations_router
from routers.messages import router as messages_router
from routers.cipher import router as cipher_router
from routers.search import router as search_router
from routers.tfa import router as tfa_router

app = FastAPI(title="CipherLink API")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"app": "CipherLink", "ok": True}


api.include_router(auth_router)
api.include_router(users_router)
api.include_router(conversations_router)
api.include_router(messages_router)
api.include_router(cipher_router)
api.include_router(search_router)
api.include_router(tfa_router)

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.conversations.create_index("id", unique=True)
    await db.messages.create_index("id", unique=True)
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    logger.info("CipherLink ready (modular)")


@app.on_event("shutdown")
async def shutdown():
    client.close()
