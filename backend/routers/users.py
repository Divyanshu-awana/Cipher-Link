from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
import re

from .deps import db, current_user, public_user

router = APIRouter(prefix="/users", tags=["users"])


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    phone: Optional[str] = None


@router.get("/search")
async def users_search(q: str = "", user=Depends(current_user)):
    q = q.strip()
    if not q:
        users = await db.users.find(
            {"id": {"$ne": user["id"]}}, {"_id": 0, "password_hash": 0}
        ).limit(50).to_list(50)
    else:
        regex = {"$regex": re.escape(q), "$options": "i"}
        users = await db.users.find(
            {"id": {"$ne": user["id"]}, "$or": [{"name": regex}, {"email": regex}]},
            {"_id": 0, "password_hash": 0},
        ).limit(50).to_list(50)
    return [public_user(u) for u in users]


@router.patch("/me")
async def update_me(payload: UserUpdateIn, user=Depends(current_user)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    u = await db.users.find_one(
        {"id": user["id"]}, {"_id": 0, "password_hash": 0}
    )
    return public_user(u)


@router.delete("/me")
async def delete_me(user=Depends(current_user)):
    """GDPR: wipe all data for the current user."""
    uid = user["id"]
    await db.messages.delete_many({"sender_id": uid})
    convs = await db.conversations.find(
        {"member_ids": uid}, {"_id": 0, "id": 1}
    ).to_list(1000)
    for c in convs:
        await db.conversations.update_one(
            {"id": c["id"]}, {"$pull": {"member_ids": uid}}
        )
    await db.cipher_sessions.delete_many({"user_id": uid})
    await db.users.delete_one({"id": uid})
    return {"ok": True}
