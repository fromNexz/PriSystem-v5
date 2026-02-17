from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import base64
from pathlib import Path

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


DATA_DIR = Path(__file__).parent.parent.parent / "data"
IMAGE_DIR = DATA_DIR / "image"
QR_PATH = IMAGE_DIR / "whatsapp_qr.png"


DATA_DIR.mkdir(exist_ok=True)
IMAGE_DIR.mkdir(exist_ok=True)


class WhatsAppStatus(BaseModel):
    status: str
    qr_code: Optional[str] = None
    phone_number: Optional[str] = None
    bot_type: Optional[str] = None


@router.get("/status", response_model=WhatsAppStatus)
def get_whatsapp_status():
    
    
    
    qr_base64 = None
    if QR_PATH.exists():
        try:
            with open(QR_PATH, "rb") as f:
                qr_bytes = f.read()
                qr_base64 = base64.b64encode(qr_bytes).decode('utf-8')
        except Exception as e:
            print(f"Erro ao ler QR code: {e}")
    
    
    status_file = DATA_DIR / "bot_status.json"
    
    if status_file.exists():
        import json
        try:
            with open(status_file, "r") as f:
                status_data = json.load(f)
                return WhatsAppStatus(
                    status=status_data.get("status", "disconnected"),
                    qr_code=qr_base64,
                    phone_number=status_data.get("phone_number"),
                    bot_type=status_data.get("bot_type", "rule")
                )
        except Exception as e:
            print(f"Erro ao ler status: {e}")
    
    
    if qr_base64:
        return WhatsAppStatus(status="qr_pending", qr_code=qr_base64)
    
    return WhatsAppStatus(status="disconnected")


@router.post("/clear-qr")
def clear_qr_code():
    
    try:
        if QR_PATH.exists():
            QR_PATH.unlink()
        return {"message": "QR code removido com sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao remover QR: {str(e)}")
