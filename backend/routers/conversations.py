from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Literal, Optional, Dict, Any
import uuid

from .deps import db, current_user, now_iso, public_user, ensure_member

router = APIRouter(prefix="/conversations", tags=["conversations"])


class ConvCreateIn(BaseModel):
    type: Literal["dm", "group"] = "dm"
    member_ids: List[str]
    name: Optional[str] = None
    photo: Optional[str] = None


async def _hydrate_conv(c: Dict[str, Any], current_uid: str) -> Dict[str, Any]:
    members = await db.users.find(
        {"id": {"$in": c["member_ids"]}}, {"_id": 0, "password_hash": 0}
    ).to_list(100)
    members = [public_user(m) for m in members]
    last_msg = await db.messages.find_one(
        {"conversation_id": c["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    unread = await db.messages.count_documents(
        {
            "conversation_id": c["id"],
            "sender_id": {"$ne": current_uid},
            "read_by": {"$ne": current_uid},
        }
    )
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


@router.get("")
async def list_conversations(user=Depends(current_user)):
    convs = await db.conversations.find(
        {"member_ids": user["id"]}, {"_id": 0}
    ).to_list(500)
    out = [await _hydrate_conv(c, user["id"]) for c in convs]
    out.sort(
        key=lambda c: (c.get("last_message") or {}).get("created_at") or c.get("created_at") or "",
        reverse=True,
    )
    return out


@router.post("")
async def create_conversation(payload: ConvCreateIn, user=Depends(current_user)):
    member_ids = list(set(payload.member_ids + [user["id"]]))
    if payload.type == "dm":
        if len(member_ids) != 2:
            raise HTTPException(400, "DM requires exactly one other member")
        existing = await db.conversations.find_one(
            {"type": "dm", "member_ids": {"$all": member_ids, "$size": 2}},
            {"_id": 0},
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


@router.get("/{conv_id}")
async def get_conversation(conv_id: str, user=Depends(current_user)):
    c = await ensure_member(conv_id, user["id"])
    return await _hydrate_conv(c, user["id"])


@router.post("/{conv_id}/mute")
async def mute_conversation(conv_id: str, user=Depends(current_user)):
    c = await ensure_member(conv_id, user["id"])
    muted = c.get("muted_by", [])
    if user["id"] in muted:
        await db.conversations.update_one(
            {"id": conv_id}, {"$pull": {"muted_by": user["id"]}}
        )
        return {"muted": False}
    await db.conversations.update_one(
        {"id": conv_id}, {"$push": {"muted_by": user["id"]}}
    )
    return {"muted": True}


@router.delete("/{conv_id}")
async def delete_conversation(conv_id: str, user=Depends(current_user)):
    c = await ensure_member(conv_id, user["id"])
    if c["type"] == "dm":
        await db.conversations.delete_one({"id": conv_id})
        await db.messages.delete_many({"conversation_id": conv_id})
    else:
        await db.conversations.update_one(
            {"id": conv_id}, {"$pull": {"member_ids": user["id"], "admin_ids": user["id"]}}
        )
    return {"ok": True}
