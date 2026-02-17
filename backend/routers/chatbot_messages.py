from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from db import get_connection
import os
import uuid

router = APIRouter(prefix="/chatbot-messages", tags=["chatbot-messages"])


class ChatbotMessage(BaseModel):
    id: Optional[int] = None
    order_position: int
    message_type: str = "message" 
    message_text: str
    wait_for_reply: bool = True
    delay_seconds: int = 0
    media_type: Optional[str] = None
    media_url: Optional[str] = None
    media_filename: Optional[str] = None
    is_active: bool = True


@router.get("/", response_model=List[dict])
def list_messages():
    """Lista todas as mensagens programadas em ordem"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT * FROM chatbot_messages
                WHERE is_active = true
                ORDER BY order_position ASC
            """)
            messages = cur.fetchall()
            return messages
    finally:
        conn.close()


@router.post("/", status_code=201)
def create_message(payload: ChatbotMessage):
    """Cria uma nova mensagem programada"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO chatbot_messages (
                    order_position, message_type, message_text, wait_for_reply,
                    delay_seconds, media_type, media_url, media_filename
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                payload.order_position,
                payload.message_type,
                payload.message_text,
                payload.wait_for_reply,
                payload.delay_seconds,
                payload.media_type,
                payload.media_url,
                payload.media_filename
            ))
            result = cur.fetchone()
            conn.commit()
            return {"id": result["id"], "message": "Mensagem criada com sucesso"}
    finally:
        conn.close()


@router.put("/{message_id}")
def update_message(message_id: int, payload: ChatbotMessage):
    """Atualiza uma mensagem existente"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE chatbot_messages
                SET message_text = %s,
                    message_type = %s,
                    wait_for_reply = %s,
                    delay_seconds = %s,
                    media_type = %s,
                    media_url = %s,
                    media_filename = %s,
                    order_position = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (
                payload.message_text,
                payload.message_type,  # ← NOVO
                payload.wait_for_reply,
                payload.delay_seconds,
                payload.media_type,
                payload.media_url,
                payload.media_filename,
                payload.order_position,
                message_id
            ))
            conn.commit()
            return {"message": "Mensagem atualizada com sucesso"}
    finally:
        conn.close()


@router.delete("/{message_id}")
def delete_message(message_id: int):
    """Remove uma mensagem (soft delete)"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE chatbot_messages
                SET is_active = false
                WHERE id = %s
            """, (message_id,))
            conn.commit()
            return {"message": "Mensagem removida com sucesso"}
    finally:
        conn.close()


@router.post("/reorder")
def reorder_messages(message_ids: List[int]):
    """Reordena as mensagens baseado na lista de IDs"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for index, msg_id in enumerate(message_ids):
                cur.execute("""
                    UPDATE chatbot_messages
                    SET order_position = %s
                    WHERE id = %s
                """, (index + 1, msg_id))
            conn.commit()
            return {"message": "Mensagens reordenadas com sucesso"}
    finally:
        conn.close()


@router.post("/upload-media")
async def upload_media(file: UploadFile = File(...)):
    """Faz upload de mídia (imagem, PDF, etc)"""

    # Criar diretório se não existir
    upload_dir = "uploads/chatbot"
    os.makedirs(upload_dir, exist_ok=True)

    # Gerar nome único
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(upload_dir, unique_filename)

    # Salvar arquivo
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    return {
        "filename": unique_filename,
        "original_name": file.filename,
        "url": f"/uploads/chatbot/{unique_filename}",
        "size": len(content)
    }
