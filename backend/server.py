"""CipherLink backend — FastAPI + MongoDB.

Endpoints (all under /api):
  Auth:           /auth/register, /auth/login, /auth/me, /auth/google
  Users:          /users/search, /users/me (PATCH/DELETE)
  Conversations:  /conversations (GET/POST), /conversations/{id}
  Messages:       /conversations/{id}/messages (GET/POST),
                  /messages/{id} (PATCH/DELETE),
                  /messages/{id}/read, /messages/{id}/react
  Cipher AI:      /cipher/ask
  Search:         /search
  2FA:            /2fa/setup, /2fa/verify
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal, Any, Dict
from pathlib import Path
from datetime import datetime, timezone, timedelta
import os, uuid, logging, json, re, base64, io, hashlib
import jwt
import bcrypt
import pyotp
import qrcode
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# -- DB --------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# -- Constants -------------------------------------------------------
JWT_SECRET = os.environ.get("JWT_SECRET", "cipherlink-dev-secret-change-me")
JWT_ALGO = "HS256"
JWT_EXP_HOURS = 24 * 7  # 7 days for MVP
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

logger = logging.getLogger("cipherlink")
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(title="CipherLink API")
api = APIRouter(prefix="/api")


# ===================================================================
# MODELS
# ===================================================================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    name: str
    phone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleOAuthIn(BaseModel):
    session_id: str  # session_id from Emergent auth fragment


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    avatar: Optional[str] = None  # base64 or url
    bio: Optional[str] = None
    online: bool = False
    last_seen: Optional[str] = None
    two_factor_enabled: bool = False


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    phone: Optional[str] = None


class ConvCreateIn(BaseModel):
    type: Literal["dm", "group"] = "dm"
    member_ids: List[str]
    name: Optional[str] = None  # group name
    photo: Optional[str] = None  # base64


class MessageIn(BaseModel):
    content: str
    type: Literal["text", "image", "video", "audio", "document", "cipher"] = "text"
    media_b64: Optional[str] = None
    media_name: Optional[str] = None
    media_size: Optional[int] = None
    reply_to: Optional[str] = None  # message id


class MessageEditIn(BaseModel):
    content: str


class ReactionIn(BaseModel):
    emoji: str


class CipherAskIn(BaseModel):
    prompt: str
    conversation_id: Optional[str] = None


class TFASetupOut(BaseModel):
    secret: str
    otpauth_url: str
    qr_b64: str


class TFAVerifyIn(BaseModel):
    code: str
    secret: Optional[str] = None  # supplied during initial enrollment


# ===================================================================
# AUTH HELPERS
# ===================================================================
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
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
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


# ===================================================================
# AUTH ROUTES
# ===================================================================
@api.post("/auth/register")
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(409, "Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "password_hash": hash_pw(payload.password),
        "name": payload.name,
        "phone": payload.phone,
        "avatar": None,
        "bio": None,
        "online": True,
        "last_seen": now_iso(),
        "two_factor_enabled": False,
        "totp_secret": None,
        "auth_provider": "password",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = make_token(user["id"])
    return {"token": token, "user": public_user(user)}


@api.post("/auth/login")
async def login(payload: LoginIn):
    u = await db.users.find_one({"email": payload.email.lower()})
    if not u or not u.get("password_hash") or not verify_pw(payload.password, u["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    await db.users.update_one({"id": u["id"]}, {"$set": {"online": True, "last_seen": now_iso()}})
    return {"token": make_token(u["id"]), "user": public_user(u)}


@api.post("/auth/google")
async def google_oauth(payload: GoogleOAuthIn):
    """Exchange Emergent session_id for user data, then create/find user."""
    async with httpx.AsyncClient(timeout=15) as h:
        r = await h.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": payload.session_id})
    if r.status_code != 200:
        raise HTTPException(401, f"Google auth failed: {r.text[:120]}")
    data = r.json()
    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    avatar = data.get("picture")
    if not email:
        raise HTTPException(401, "No email returned from provider")

    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": None,
            "name": name,
            "phone": None,
            "avatar": avatar,
            "bio": None,
            "online": True,
            "last_seen": now_iso(),
            "two_factor_enabled": False,
            "totp_secret": None,
            "auth_provider": "google",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"online": True, "last_seen": now_iso(), "avatar": avatar or user.get("avatar")}},
        )
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return public_user(user)


# ===================================================================
# USERS
# ===================================================================
@api.get("/users/search")
async def users_search(q: str = "", user=Depends(current_user)):
    q = q.strip()
    if not q:
        users = await db.users.find({"id": {"$ne": user["id"]}}, {"_id": 0, "password_hash": 0}).limit(50).to_list(50)
    else:
        regex = {"$regex": re.escape(q), "$options": "i"}
        users = await db.users.find(
            {"id": {"$ne": user["id"]}, "$or": [{"name": regex}, {"email": regex}]},
            {"_id": 0, "password_hash": 0},
        ).limit(50).to_list(50)
    return [public_user(u) for u in users]


@api.patch("/users/me")
async def update_me(payload: UserUpdateIn, user=Depends(current_user)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return public_user(u)


@api.delete("/users/me")
async def delete_me(user=Depends(current_user)):
    """GDPR: remove all user data."""
    uid = user["id"]
    await db.messages.delete_many({"sender_id": uid})
    convs = await db.conversations.find({"member_ids": uid}, {"_id": 0, "id": 1}).to_list(1000)
    for c in convs:
        # remove from group or delete dm
        await db.conversations.update_one({"id": c["id"]}, {"$pull": {"member_ids": uid}})
    await db.cipher_sessions.delete_many({"user_id": uid})
    await db.users.delete_one({"id": uid})
    return {"ok": True}


# ===================================================================
# CONVERSATIONS
# ===================================================================
async def _ensure_member(conv_id: str, uid: str) -> Dict[str, Any]:
    c = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Conversation not found")
    if uid not in c.get("member_ids", []):
        raise HTTPException(403, "Not a member")
    return c


async def _hydrate_conv(c: Dict[str, Any], current_uid: str) -> Dict[str, Any]:
    members = await db.users.find({"id": {"$in": c["member_ids"]}}, {"_id": 0, "password_hash": 0}).to_list(100)
    members = [public_user(m) for m in members]
    last_msg = await db.messages.find_one(
        {"conversation_id": c["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    unread = await db.messages.count_documents({
        "conversation_id": c["id"],
        "sender_id": {"$ne": current_uid},
        "read_by": {"$ne": current_uid},
    })
    title = c.get("name")
    photo = c.get("photo")
    if c["type"] == "dm":
        other = next((m for m in members if m["id"] != current_uid), None)
        if other:
            title = other["name"]
            photo = other.get("avatar")
    return {
        "id": c["id"],
        "type": c["type"],
        "name": title,
        "photo": photo,
        "members": members,
        "admin_ids": c.get("admin_ids", []),
        "muted_by": c.get("muted_by", []),
        "created_at": c.get("created_at"),
        "last_message": last_msg,
        "unread": unread,
    }


@api.get("/conversations")
async def list_conversations(user=Depends(current_user)):
    convs = await db.conversations.find({"member_ids": user["id"]}, {"_id": 0}).to_list(500)
    out = [await _hydrate_conv(c, user["id"]) for c in convs]
    out.sort(
        key=lambda c: (c.get("last_message") or {}).get("created_at") or c.get("created_at") or "",
        reverse=True,
    )
    return out


@api.post("/conversations")
async def create_conversation(payload: ConvCreateIn, user=Depends(current_user)):
    member_ids = list(set(payload.member_ids + [user["id"]]))
    if payload.type == "dm":
        if len(member_ids) != 2:
            raise HTTPException(400, "DM requires exactly one other member")
        # Find existing dm between these two
        existing = await db.conversations.find_one(
            {"type": "dm", "member_ids": {"$all": member_ids, "$size": 2}}, {"_id": 0}
        )
        if existing:
            return await _hydrate_conv(existing, user["id"])
    conv = {
        "id": str(uuid.uuid4()),
        "type": payload.type,
        "name": payload.name,
        "photo": payload.photo,
        "member_ids": member_ids,
        "admin_ids": [user["id"]] if payload.type == "group" else [],
        "muted_by": [],
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.conversations.insert_one(conv)
    return await _hydrate_conv(conv, user["id"])


@api.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, user=Depends(current_user)):
    c = await _ensure_member(conv_id, user["id"])
    return await _hydrate_conv(c, user["id"])


@api.post("/conversations/{conv_id}/mute")
async def mute_conversation(conv_id: str, user=Depends(current_user)):
    c = await _ensure_member(conv_id, user["id"])
    muted = c.get("muted_by", [])
    if user["id"] in muted:
        await db.conversations.update_one({"id": conv_id}, {"$pull": {"muted_by": user["id"]}})
        return {"muted": False}
    await db.conversations.update_one({"id": conv_id}, {"$push": {"muted_by": user["id"]}})
    return {"muted": True}


@api.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, user=Depends(current_user)):
    c = await _ensure_member(conv_id, user["id"])
    if c["type"] == "dm":
        await db.conversations.delete_one({"id": conv_id})
        await db.messages.delete_many({"conversation_id": conv_id})
    else:
        # leave group
        await db.conversations.update_one({"id": conv_id}, {"$pull": {"member_ids": user["id"], "admin_ids": user["id"]}})
    return {"ok": True}


# ===================================================================
# MESSAGES
# ===================================================================
@api.get("/conversations/{conv_id}/messages")
async def list_messages(conv_id: str, user=Depends(current_user), limit: int = 200):
    await _ensure_member(conv_id, user["id"])
    msgs = await db.messages.find({"conversation_id": conv_id}, {"_id": 0}).sort("created_at", 1).to_list(limit)
    # hydrate sender
    senders = {m["sender_id"] for m in msgs}
    users = await db.users.find({"id": {"$in": list(senders)}}, {"_id": 0, "password_hash": 0}).to_list(500)
    umap = {u["id"]: public_user(u) for u in users}
    for m in msgs:
        m["sender"] = umap.get(m["sender_id"])
    return msgs


def _delivery_status(msg: Dict[str, Any], total_members: int) -> str:
    read_by = msg.get("read_by", [])
    delivered_to = msg.get("delivered_to", [])
    others = total_members - 1
    if others <= 0:
        return "sent"
    if len(read_by) >= others:
        return "read"
    if len(delivered_to) >= others:
        return "delivered"
    return "sent"


@api.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: str, payload: MessageIn, user=Depends(current_user)):
    c = await _ensure_member(conv_id, user["id"])
    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv_id,
        "sender_id": user["id"],
        "content": payload.content,
        "type": payload.type,
        "media_b64": payload.media_b64,
        "media_name": payload.media_name,
        "media_size": payload.media_size,
        "reply_to": payload.reply_to,
        "reactions": {},
        "edited": False,
        "edit_history": [],
        "deleted": False,
        "delivered_to": [user["id"]],
        "read_by": [user["id"]],
        "created_at": now_iso(),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    msg["sender"] = public_user(user)
    msg["status"] = _delivery_status(msg, len(c["member_ids"]))
    return msg


@api.patch("/messages/{msg_id}")
async def edit_message(msg_id: str, payload: MessageEditIn, user=Depends(current_user)):
    m = await db.messages.find_one({"id": msg_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Not found")
    if m["sender_id"] != user["id"]:
        raise HTTPException(403, "Not your message")
    history = m.get("edit_history", [])
    history.append({"content": m["content"], "at": now_iso()})
    await db.messages.update_one(
        {"id": msg_id},
        {"$set": {"content": payload.content, "edited": True, "edit_history": history}},
    )
    m2 = await db.messages.find_one({"id": msg_id}, {"_id": 0})
    return m2


@api.delete("/messages/{msg_id}")
async def delete_message(msg_id: str, user=Depends(current_user)):
    m = await db.messages.find_one({"id": msg_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Not found")
    if m["sender_id"] != user["id"]:
        raise HTTPException(403, "Not your message")
    await db.messages.update_one(
        {"id": msg_id}, {"$set": {"deleted": True, "content": ""}}
    )
    return {"ok": True}


@api.post("/messages/{msg_id}/read")
async def read_message(msg_id: str, user=Depends(current_user)):
    await db.messages.update_one(
        {"id": msg_id}, {"$addToSet": {"read_by": user["id"], "delivered_to": user["id"]}}
    )
    return {"ok": True}


@api.post("/conversations/{conv_id}/read-all")
async def read_all(conv_id: str, user=Depends(current_user)):
    await _ensure_member(conv_id, user["id"])
    await db.messages.update_many(
        {"conversation_id": conv_id},
        {"$addToSet": {"read_by": user["id"], "delivered_to": user["id"]}},
    )
    return {"ok": True}


@api.post("/messages/{msg_id}/react")
async def react_message(msg_id: str, payload: ReactionIn, user=Depends(current_user)):
    m = await db.messages.find_one({"id": msg_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Not found")
    reactions = m.get("reactions", {}) or {}
    users_for = set(reactions.get(payload.emoji, []))
    if user["id"] in users_for:
        users_for.remove(user["id"])
    else:
        users_for.add(user["id"])
    reactions[payload.emoji] = list(users_for)
    if not reactions[payload.emoji]:
        reactions.pop(payload.emoji)
    await db.messages.update_one({"id": msg_id}, {"$set": {"reactions": reactions}})
    return {"reactions": reactions}


# ===================================================================
# CIPHER AI
# ===================================================================
CIPHER_SYSTEM = (
    "You are 'Cipher', an embedded AI assistant inside a secure mobile messenger called CipherLink. "
    "Users invoke you with @Cipher. You handle: restaurant/venue search, weather queries, "
    "calendar scheduling, reminders, document summarization, and general Q&A. "
    "You ALWAYS respond with a single JSON object (no markdown, no fences) matching this schema:\n"
    "{\n"
    '  "intent": "restaurant" | "weather" | "calendar" | "reminder" | "general",\n'
    '  "summary": "<short natural language reply, 1-2 sentences>",\n'
    '  "cards": [ ... up to 3 structured cards ... ]\n'
    "}\n"
    "Card schemas by intent:\n"
    "- restaurant: {type:'restaurant', name, cuisine, rating (1-5 float), price (one of '$','$$','$$$','$$$$'), distance_km, address, image_url, book_url}\n"
    "- weather: {type:'weather', location, current_temp_c, condition, icon ('sunny'|'cloudy'|'rainy'|'snowy'|'stormy'|'partly-cloudy'), forecast: [{day, high_c, low_c, icon}]}\n"
    "- calendar: {type:'calendar', title, date (YYYY-MM-DD), time (HH:MM 24h), duration_min, attendees:[names], meet_link}\n"
    "- reminder: {type:'reminder', title, when_iso, note}\n"
    "- general: omit cards or use [{type:'general', text}].\n"
    "When external data is unknown, INVENT plausible realistic values (this is a demo, not production). "
    "Never apologise, never refuse. Always return valid JSON."
)


def _strip_fences(t: str) -> str:
    t = t.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


@api.post("/cipher/ask")
async def cipher_ask(payload: CipherAskIn, user=Depends(current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Cipher unavailable: missing LLM key")
    session_key = payload.conversation_id or f"user-{user['id']}"
    session_id = f"cipher-{session_key}"

    # Save question to cipher session log for context UI
    await db.cipher_sessions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "conversation_id": payload.conversation_id,
        "role": "user",
        "content": payload.prompt,
        "created_at": now_iso(),
    })

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=CIPHER_SYSTEM,
        ).with_model("openai", "gpt-4o")
        reply = await chat.send_message(UserMessage(text=payload.prompt))
    except Exception as exc:
        logger.exception("cipher LLM call failed")
        return {
            "intent": "general",
            "summary": "Cipher is running in limited mode right now. Please try again shortly.",
            "cards": [{"type": "general", "text": str(exc)[:200]}],
            "fallback": True,
        }

    parsed: Dict[str, Any]
    try:
        parsed = json.loads(_strip_fences(reply))
    except Exception:
        parsed = {"intent": "general", "summary": reply, "cards": [{"type": "general", "text": reply}]}

    parsed.setdefault("intent", "general")
    parsed.setdefault("summary", "")
    parsed.setdefault("cards", [])

    # log assistant reply
    await db.cipher_sessions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "conversation_id": payload.conversation_id,
        "role": "assistant",
        "content": parsed.get("summary", ""),
        "payload": parsed,
        "created_at": now_iso(),
    })
    return parsed


# ===================================================================
# SEARCH
# ===================================================================
@api.get("/search")
async def search(q: str, type: str = "all", user=Depends(current_user)):
    q = q.strip()
    if not q:
        return {"messages": [], "contacts": [], "ai": []}
    regex = {"$regex": re.escape(q), "$options": "i"}
    out = {"messages": [], "contacts": [], "ai": []}

    if type in ("all", "messages"):
        # find conversations user is part of
        my_convs = await db.conversations.find({"member_ids": user["id"]}, {"_id": 0, "id": 1}).to_list(500)
        ids = [c["id"] for c in my_convs]
        msgs = await db.messages.find(
            {"conversation_id": {"$in": ids}, "content": regex, "deleted": {"$ne": True}}, {"_id": 0}
        ).sort("created_at", -1).limit(50).to_list(50)
        out["messages"] = msgs

    if type in ("all", "contacts"):
        users = await db.users.find(
            {"id": {"$ne": user["id"]}, "$or": [{"name": regex}, {"email": regex}]},
            {"_id": 0, "password_hash": 0},
        ).limit(20).to_list(20)
        out["contacts"] = [public_user(u) for u in users]

    if type in ("all", "ai"):
        ai = await db.cipher_sessions.find(
            {"user_id": user["id"], "content": regex}, {"_id": 0}
        ).sort("created_at", -1).limit(30).to_list(30)
        out["ai"] = ai
    return out


# ===================================================================
# 2FA
# ===================================================================
@api.post("/2fa/setup", response_model=TFASetupOut)
async def tfa_setup(user=Depends(current_user)):
    secret = pyotp.random_base32()
    otpauth = pyotp.TOTP(secret).provisioning_uri(name=user["email"], issuer_name="CipherLink")
    img = qrcode.make(otpauth)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return TFASetupOut(secret=secret, otpauth_url=otpauth, qr_b64=qr_b64)


@api.post("/2fa/verify")
async def tfa_verify(payload: TFAVerifyIn, user=Depends(current_user)):
    secret = payload.secret or user.get("totp_secret")
    if not secret:
        raise HTTPException(400, "No TOTP secret to verify against")
    if not pyotp.TOTP(secret).verify(payload.code, valid_window=1):
        raise HTTPException(400, "Invalid TOTP code")
    if payload.secret:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"totp_secret": payload.secret, "two_factor_enabled": True}},
        )
    return {"ok": True}


@api.delete("/2fa")
async def tfa_disable(user=Depends(current_user)):
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"two_factor_enabled": False, "totp_secret": None}}
    )
    return {"ok": True}


# ===================================================================
# HEALTH
# ===================================================================
@api.get("/")
async def root():
    return {"app": "CipherLink", "ok": True}


# Mount router
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
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.conversations.create_index("id", unique=True)
    await db.messages.create_index("id", unique=True)
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    logger.info("CipherLink ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()
