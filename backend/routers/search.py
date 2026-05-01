from fastapi import APIRouter, Depends
import re

from .deps import db, current_user, public_user

router = APIRouter(tags=["search"])


@router.get("/search")
async def search(q: str, type: str = "all", user=Depends(current_user)):
    q = q.strip()
    if not q:
        return {"messages": [], "contacts": [], "ai": []}
    regex = {"$regex": re.escape(q), "$options": "i"}
    out = {"messages": [], "contacts": [], "ai": []}

    if type in ("all", "messages"):
        my_convs = await db.conversations.find(
            {"member_ids": user["id"]}, {"_id": 0, "id": 1}
        ).to_list(500)
        ids = [c["id"] for c in my_convs]
        msgs = await db.messages.find(
            {"conversation_id": {"$in": ids}, "content": regex, "deleted": {"$ne": True}},
            {"_id": 0},
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
