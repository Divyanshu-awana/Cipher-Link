from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Literal, Optional, Dict, Any
import uuid

from .deps import db, current_user, now_iso, public_user, ensure_member

router = APIRouter(tags=["messages"])


class MessageIn(BaseModel):
    content: str
    type: Literal["text", "image", "video", "audio", "document", "cipher"] = "text"
    media_b64: Optional[str] = None
    media_name: Optional[str] = None
    media_size: Optional[int] = None
    reply_to: Optional[str] = None


class MessageEditIn(BaseModel):
    content: str


class ReactionIn(BaseModel):
    emoji: str


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


@router.get("/conversations/{conv_id}/messages")
async def list_messages(conv_id: str, user=Depends(current_user), limit: int = 200):
    await ensure_member(conv_id, user["id"])
    msgs = await db.messages.find(
        {"conversation_id": conv_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(limit)
    senders = {m["sender_id"] for m in msgs}
    users = await db.users.find(
        {"id": {"$in": list(senders)}}, {"_id": 0, "password_hash": 0}
    ).to_list(500)
    umap = {u["id"]: public_user(u) for u in users}
    for m in msgs:
        m["sender"] = umap.get(m["sender_id"])
    return msgs


@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: str, payload: MessageIn, user=Depends(current_user)):
    c = await ensure_member(conv_id, user["id"])
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


@router.post("/conversations/{conv_id}/read-all")
async def read_all(conv_id: str, user=Depends(current_user)):
    await ensure_member(conv_id, user["id"])
    await db.messages.update_many(
        {"conversation_id": conv_id},
        {"$addToSet": {"read_by": user["id"], "delivered_to": user["id"]}},
    )
    return {"ok": True}


@router.patch("/messages/{msg_id}")
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
    return await db.messages.find_one({"id": msg_id}, {"_id": 0})


@router.delete("/messages/{msg_id}")
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


@router.post("/messages/{msg_id}/read")
async def read_message(msg_id: str, user=Depends(current_user)):
    await db.messages.update_one(
        {"id": msg_id},
        {"$addToSet": {"read_by": user["id"], "delivered_to": user["id"]}},
    )
    return {"ok": True}


@router.post("/messages/{msg_id}/react")
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
