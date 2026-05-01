"""Shared dependencies and helpers for all CipherLink routers."""
import os
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Header, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

# -- DB --------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# -- Constants -------------------------------------------------------
JWT_SECRET = os.environ.get("JWT_SECRET", "cipherlink-dev-secret-change-me")
JWT_ALGO = "HS256"
JWT_EXP_HOURS = 24 * 7  # 7 days
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
EMERGENT_AUTH_URL = (
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
)

logger = logging.getLogger("cipherlink")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError as exc:
        raise HTTPException(401, f"Invalid token: {exc}")
    user = await db.users.find_one(
        {"id": payload["sub"]}, {"_id": 0, "password_hash": 0}
    )
    if not user:
        raise HTTPException(401, "User not found")
    return user


def public_user(u: Dict[str, Any]) -> Dict[str, Any]:
    if not u:
        return {}
    return {
        "id": u.get("id"),
        "email": u.get("email"),
        "name": u.get("name"),
        "phone": u.get("phone"),
        "avatar": u.get("avatar"),
        "bio": u.get("bio"),
        "online": bool(u.get("online")),
        "last_seen": u.get("last_seen"),
        "two_factor_enabled": bool(u.get("two_factor_enabled")),
    }


async def ensure_member(conv_id: str, uid: str) -> Dict[str, Any]:
    c = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Conversation not found")
    if uid not in c.get("member_ids", []):
        raise HTTPException(403, "Not a member")
    return c


UserDep = Depends(current_user)
