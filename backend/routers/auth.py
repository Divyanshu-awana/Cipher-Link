from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import uuid
import httpx

from .deps import (
    db,
    current_user,
    hash_pw,
    make_token,
    now_iso,
    public_user,
    verify_pw,
    EMERGENT_AUTH_URL,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    name: str
    phone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleOAuthIn(BaseModel):
    session_id: str


@router.post("/register")
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
    return {"token": make_token(user["id"]), "user": public_user(user)}


@router.post("/login")
async def login(payload: LoginIn):
    u = await db.users.find_one({"email": payload.email.lower()})
    if not u or not u.get("password_hash") or not verify_pw(payload.password, u["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    await db.users.update_one(
        {"id": u["id"]}, {"$set": {"online": True, "last_seen": now_iso()}}
    )
    return {"token": make_token(u["id"]), "user": public_user(u)}


@router.post("/google")
async def google_oauth(payload: GoogleOAuthIn):
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


@router.get("/me")
async def me(user=Depends(current_user)):
    return public_user(user)
