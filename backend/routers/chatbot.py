from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from db import get_connection

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


class ChatbotMessage(BaseModel):
    session_id: str = Field(..., example="sess-123")
    channel: str = Field(..., example="site")  # site, whatsapp
    phone: str | None = Field(None, example="5511999999999")
    message: str = Field(..., example="Oi, quero agendar um horário")


class ChatbotReply(BaseModel):
    reply: str
    active_bot_type: str
    session_id: str

def get_current_settings(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   active_bot_type,
                   welcome_message,
                   closing_message,
                   timezone
            FROM chatbot_settings
            ORDER BY id
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=500, detail="Configurações do chatbot não encontradas")
        return row

@router.post("/message", response_model=ChatbotReply)
def handle_message(payload: ChatbotMessage):
    """
    Endpoint único para o chatbot JS.
    - Lê active_bot_type (rule ou ai).
    - Registra log da mensagem.
    - Retorna uma resposta simples (por enquanto).
    """
    conn = get_connection()
    try:
        with conn:
            settings = get_current_settings(conn)
            bot_type = settings["active_bot_type"]

            # 1) Log da mensagem recebida
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO chatbot_logs (
                        customer_id,
                        channel,
                        message_from,
                        message_type,
                        content
                    ) VALUES (
                        NULL,  -- depois podemos linkar via customers
                        %s,
                        'user',
                        'text',
                        %s
                    )
                    """,
                    (payload.channel, payload.message)
                )

            # 2) Decidir resposta conforme bot_type
            if bot_type == "rule":
                reply_text = rule_based_reply(payload, settings)
            else:  # 'ai'
                reply_text = ai_based_reply_mock(payload, settings)

            # 3) Log da resposta do bot
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO chatbot_logs (
                        customer_id,
                        channel,
                        message_from,
                        message_type,
                        content
                    ) VALUES (
                        NULL,
                        %s,
                        'bot',
                        'text',
                        %s
                    )
                    """,
                    (payload.channel, reply_text)
                )

        return ChatbotReply(
            reply=reply_text,
            active_bot_type=bot_type,
            session_id=payload.session_id,
        )
    finally:
        conn.close()

def rule_based_reply(payload: ChatbotMessage, settings) -> str:
    text = payload.message.strip().lower()

    # Exemplo bem simples só pra teste
    if any(x in text for x in ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"]):
        return settings.get("welcome_message") or "Oi! Vamos agendar seu horário?"

    if "agendar" in text or "horário" in text or "horario" in text:
        return "Claro! Me diga o dia e horário que você prefere."

    return "Não entendi muito bem. Você quer agendar um horário, remarcar ou cancelar?"


def ai_based_reply_mock(payload: ChatbotMessage, settings) -> str:
    # Placeholder: depois você conecta em um modelo de IA de verdade
    base = "Sou a versão IA da Pri. "
    return base + "Ainda estou em configuração, mas já posso anotar seu pedido: \"" + payload.message + "\""


