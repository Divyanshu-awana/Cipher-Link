from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import base64
import io

import pyotp
import qrcode

from .deps import db, current_user

router = APIRouter(prefix="/2fa", tags=["2fa"])


class TFASetupOut(BaseModel):
    secret: str
    otpauth_url: str
    qr_b64: str


class TFAVerifyIn(BaseModel):
    code: str
    secret: Optional[str] = None


@router.post("/setup", response_model=TFASetupOut)
async def tfa_setup(user=Depends(current_user)):
    secret = pyotp.random_base32()
    otpauth = pyotp.TOTP(secret).provisioning_uri(
        name=user["email"], issuer_name="CipherLink"
    )
    img = qrcode.make(otpauth)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return TFASetupOut(secret=secret, otpauth_url=otpauth, qr_b64=qr_b64)


@router.post("/verify")
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


@router.delete("")
async def tfa_disable(user=Depends(current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"two_factor_enabled": False, "totp_secret": None}},
    )
    return {"ok": True}
