from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from datetime import datetime
import json
import re
import uuid

from .deps import db, current_user, now_iso, ensure_member, EMERGENT_LLM_KEY, logger

router = APIRouter(prefix="/cipher", tags=["cipher"])


class CipherAskIn(BaseModel):
    prompt: str
    conversation_id: Optional[str] = None


class CipherSuggestIn(BaseModel):
    conversation_id: str


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
    "- restaurant: {type:'restaurant', name, cuisine, rating (1-5 float, 1 decimal), price (one of '$','$$','$$$','$$$$'), distance_km (1 decimal), address (real-looking street address that matches the requested city/neighbourhood), image_url, book_url}\n"
    "- weather: {type:'weather', location, current_temp_c (seasonal realistic integer for that city), condition (e.g. 'Clear', 'Partly Cloudy', 'Light Rain'), icon ('sunny'|'cloudy'|'rainy'|'snowy'|'stormy'|'partly-cloudy'), forecast: [{day:'Tomorrow'|'Wed'|..., high_c, low_c, icon}] (exactly 4 entries)}\n"
    "- calendar: {type:'calendar', title, date (YYYY-MM-DD resolved from the user's phrasing), time (HH:MM 24h), duration_min, attendees:[names], meet_link ('https://meet.google.com/xxx-xxxx-xxx')}\n"
    "- reminder: {type:'reminder', title, when_iso, note}\n"
    "- general: omit cards or use [{type:'general', text}].\n"
    "Realism rules (VERY IMPORTANT):\n"
    "- Restaurant names should sound native to the cuisine and city (e.g. 'Trattoria Piccolo' in Delhi, 'The Spotted Pig' in NYC).\n"
    "- Restaurant addresses must include the actual neighbourhood or landmark the user mentioned.\n"
    "- For restaurant image_url, ALWAYS use a real Unsplash photo URL in the form 'https://images.unsplash.com/photo-<id>?w=600&q=80'. Pick an id that evokes the cuisine (Italian → pasta/pizza, Japanese → sushi, Indian → curry, cafe → latte). If unsure, use 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80'.\n"
    "- For book_url, use 'https://cipherlink.app/book/<restaurant-slug>'.\n"
    "- Weather temperature must be plausible for the city + time of year (Delhi summer 35-42°C, London winter 2-8°C, etc.).\n"
    "- Calendar meet_link must look like a real Google Meet code (3 chars-4 chars-3 chars).\n"
    "- When a follow-up is ambiguous ('cheaper', 'something else', 'what about X'), INFER missing slots (cuisine, city, party size, date) from the earlier conversation. Never re-ask.\n"
    "- Never apologise, never refuse, never say 'as an AI'. Always return valid JSON."
)

SUGGEST_SYSTEM = (
    "You are a silent observer assistant that scans a short chat transcript "
    "and decides if the participants are actively trying to schedule a meeting, "
    "call, sync, standup, catch-up, or in-person gathering. "
    "Return ONLY a JSON object: "
    '{"should_suggest": bool, "reason": "<one short sentence>", '
    '"prompt": "<a ready-to-send @Cipher prompt that would schedule the meeting, '
    'e.g. Schedule a 30 min sync Tue 4pm with the group>"}. '
    "Be conservative — only suggest when there is clear intent "
    "(words like meet, call, sync, catch up, schedule, let's hop on, when are you free). "
    "Do NOT suggest for casual mentions like 'meeting went well yesterday'."
)

RESTAURANT_IMAGES: Dict[str, List[str]] = {
    "italian": ["1565299624946-b28f40a0ae38", "1574071318508-1cdbab80d002", "1555396273-367ea4eb4db5"],
    "japanese": ["1579027989536-b7b1f875659b", "1617196034796-73dfa7b1fd56"],
    "indian": ["1565557623262-b51c2513a641", "1589302168068-964664d93dc0"],
    "chinese": ["1585032226651-759b368d7246", "1563245372-f21724e3856d"],
    "mexican": ["1565299585323-38d6b0865b47", "1504544750208-dc0358e63f7f"],
    "cafe": ["1495474472287-4d71bcdd2085", "1453614512568-c4024d13c247"],
    "french": ["1504754524776-8f4f37790ca0", "1550304943-4f24f54ddde9"],
    "default": ["1517248135467-4c7edcad34c4", "1559339352-11d035aa65de"],
}


def _strip_fences(t: str) -> str:
    t = t.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def _pick_restaurant_image(card: Dict[str, Any]) -> str:
    cuisine = (card.get("cuisine") or "").lower()
    for key, ids in RESTAURANT_IMAGES.items():
        if key in cuisine:
            photo = ids[hash(card.get("name", "")) % len(ids)]
            return f"https://images.unsplash.com/photo-{photo}?w=600&q=80"
    ids = RESTAURANT_IMAGES["default"]
    photo = ids[hash(card.get("name", "")) % len(ids)]
    return f"https://images.unsplash.com/photo-{photo}?w=600&q=80"


@router.post("/ask")
async def cipher_ask(payload: CipherAskIn, user=Depends(current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Cipher unavailable: missing LLM key")
    session_key = payload.conversation_id or f"user-{user['id']}"
    session_id = f"cipher-{session_key}"

    # Replay last 20 turns from Mongo for multi-turn context across restarts.
    history = await db.cipher_sessions.find(
        {"user_id": user["id"], "conversation_id": payload.conversation_id},
        {"_id": 0, "role": 1, "content": 1},
    ).sort("created_at", 1).to_list(40)
    initial_messages = [{"role": "system", "content": CIPHER_SYSTEM}]
    for h in history[-20:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            initial_messages.append({"role": h["role"], "content": h["content"]})

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
            initial_messages=initial_messages,
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

    try:
        parsed = json.loads(_strip_fences(reply))
    except Exception:
        parsed = {
            "intent": "general",
            "summary": reply,
            "cards": [{"type": "general", "text": reply}],
        }

    parsed.setdefault("intent", "general")
    parsed.setdefault("summary", "")
    parsed.setdefault("cards", [])

    # Overwrite hallucinated restaurant image URLs with curated, known-good ones.
    for c in parsed.get("cards") or []:
        if isinstance(c, dict) and c.get("type") == "restaurant":
            c["image_url"] = _pick_restaurant_image(c)

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


@router.post("/suggest")
async def cipher_suggest(payload: CipherSuggestIn, user=Depends(current_user)):
    """Proactively scan recent messages and decide if a meeting should be scheduled."""
    if not EMERGENT_LLM_KEY:
        return {"should_suggest": False, "reason": "llm unavailable", "prompt": ""}
    await ensure_member(payload.conversation_id, user["id"])
    msgs = await db.messages.find(
        {"conversation_id": payload.conversation_id, "type": {"$in": ["text"]}, "deleted": {"$ne": True}},
        {"_id": 0, "sender_id": 1, "content": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(15)
    if len(msgs) < 2:
        return {"should_suggest": False, "reason": "not enough messages", "prompt": ""}
    msgs.reverse()
    id_to_name = {
        m["id"]: m.get("name", "User")
        for m in await db.users.find(
            {"id": {"$in": list({x["sender_id"] for x in msgs})}}, {"_id": 0, "id": 1, "name": 1}
        ).to_list(100)
    }
    transcript = "\n".join(
        f"{id_to_name.get(m['sender_id'], 'User')}: {m['content']}"
        for m in msgs
        if m.get("content") and not m["content"].lower().startswith("@cipher")
    )
    if not transcript.strip():
        return {"should_suggest": False, "reason": "empty", "prompt": ""}

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"suggest-{payload.conversation_id}-{datetime.now().timestamp()}",
            system_message=SUGGEST_SYSTEM,
        ).with_model("openai", "gpt-4o")
        reply = await chat.send_message(UserMessage(text=f"Transcript:\n{transcript}"))
        parsed = json.loads(_strip_fences(reply))
    except Exception as exc:
        logger.warning("cipher suggest failed: %s", exc)
        return {"should_suggest": False, "reason": "error", "prompt": ""}

    return {
        "should_suggest": bool(parsed.get("should_suggest")),
        "reason": str(parsed.get("reason", ""))[:200],
        "prompt": str(parsed.get("prompt", ""))[:300],
    }
