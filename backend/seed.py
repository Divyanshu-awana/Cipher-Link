"""Seed CipherLink demo accounts."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from dotenv import load_dotenv
import os, uuid, bcrypt
from datetime import datetime, timezone

load_dotenv(Path(__file__).parent / ".env")

async def main():
    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = cli[os.environ["DB_NAME"]]
    users = [
        ("alice@cipherlink.app", "Alice", "+15550100"),
        ("bob@cipherlink.app", "Bob", "+15550101"),
        ("cara@cipherlink.app", "Cara", "+15550102"),
        ("dan@cipherlink.app", "Dan", "+15550103"),
    ]
    pw = "Test1234"
    h = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    for email, name, phone in users:
        if await db.users.find_one({"email": email}):
            continue
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": h,
            "name": name,
            "phone": phone,
            "avatar": None,
            "bio": f"Hi! I'm {name} and I love secure chat.",
            "online": True,
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "two_factor_enabled": False,
            "totp_secret": None,
            "auth_provider": "password",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        print(f"Seeded {email}")
    print("Done.")

if __name__ == "__main__":
    asyncio.run(main())
