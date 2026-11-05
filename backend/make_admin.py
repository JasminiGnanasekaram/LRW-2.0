# lrw/backend/make_admin.py
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def make_admin():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["lrw"]
    email = "jasminsekar2001@gmail.com"  # ← change to your email
    result = await db["users"].update_one(
        {"email": email},
        {"$set": {"role": "admin"}}
    )
    if result.modified_count:
        print(f"✅ {email} is now admin")
    else:
        print(f"❌ User not found: {email}")

asyncio.run(make_admin())