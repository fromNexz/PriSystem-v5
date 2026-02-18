# Arquivo COMPLETO: prisystem/backend/routers/appointments.py
# Substitua TODO o conteúdo:

from datetime import date as date_type, time as time_type
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from db import get_connection

router = APIRouter(prefix="/appointments", tags=["appointments"])


class AppointmentCreate(BaseModel):
    name: str = Field(..., example="Cliente Teste")
    phone: str = Field(..., example="5511999999999")
    email: Optional[str] = Field(None, example="cliente@teste.com")
    service_id: int = Field(..., example=5)
    date: date_type
    start_time: time_type
    channel: str = Field(..., example="site")


class AppointmentUpdate(BaseModel):
    service_id: Optional[int] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


@router.post("/", status_code=201)
def create_appointment(payload: AppointmentCreate):
    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                # 1) Buscar cliente
                cur.execute(
                    """
                    SELECT id, is_blocked
                    FROM customers
                    WHERE phone = %s
                    """,
                    (payload.phone,)
                )
                row = cur.fetchone()

                if row:
                    customer_id = row["id"]
                    is_blocked = row["is_blocked"]
                else:
                    cur.execute(
                        """
                        INSERT INTO customers (name, phone, email, channel)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id, is_blocked
                        """,
                        (payload.name, payload.phone,
                         payload.email, payload.channel)
                    )
                    res = cur.fetchone()
                    customer_id = res["id"]
                    is_blocked = res["is_blocked"]

                if is_blocked:
                    raise HTTPException(
                        status_code=403,
                        detail="Cliente bloqueado. Entre em contato com o atendimento."
                    )

                # 3) Criar agendamento
                cur.execute(
                    """
                    INSERT INTO appointments (
                        customer_id,
                        service_id,
                        date,
                        start_time,
                        status,
                        channel,
                        notes,
                        created_by
                    ) VALUES (
                        %s, %s, %s, %s, 'pending', %s, %s, NULL
                    )
                    RETURNING id
                    """,
                    (
                        customer_id,
                        payload.service_id,
                        payload.date,
                        payload.start_time,
                        payload.channel,
                        "Criado via API"
                    )
                )
                appointment = cur.fetchone()
                appointment_id = appointment["id"]

        return {
            "id": appointment_id,
            "customer_id": customer_id,
            "status": "pending"
        }
    finally:
        conn.close()


@router.get("/", response_model=list[dict])
def list_appointments(
    date_filter: Optional[date_type] = Query(None, alias="date")
):
    """
    Lista agendamentos.
    - Se `date` vier na query (?date=2026-02-20), filtra por dia.
    - Senão, retorna os próximos agendamentos futuros.
    """
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            if date_filter:
                cur.execute(
                    """
                    SELECT a.id,
                           a.customer_id,
                           a.date,
                           a.start_time,
                           a.status,
                           a.channel,
                           c.name AS customer_name,
                           c.phone AS customer_phone,
                           s.name AS service_name
                    FROM appointments a
                    JOIN customers c ON c.id = a.customer_id
                    JOIN services  s ON s.id = a.service_id
                    WHERE a.date = %s
                    ORDER BY a.start_time
                    """,
                    (date_filter,)
                )
            else:
                cur.execute(
                    """
                    SELECT a.id,
                           a.customer_id,
                           a.date,
                           a.start_time,
                           a.status,
                           a.channel,
                           c.name AS customer_name,
                           c.phone AS customer_phone,
                           s.name AS service_name
                    FROM appointments a
                    JOIN customers c ON c.id = a.customer_id
                    JOIN services  s ON s.id = a.service_id
                    WHERE a.date >= CURRENT_DATE
                    ORDER BY a.date, a.start_time
                    LIMIT 100
                    """
                )

            rows = cur.fetchall()
            return rows
    finally:
        conn.close()


@router.put("/{appointment_id}")
def update_appointment(appointment_id: int, payload: AppointmentUpdate):
    """Atualiza um agendamento existente"""
    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                # Verifica se o agendamento existe
                cur.execute("SELECT id FROM appointments WHERE id = %s", (appointment_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Agendamento não encontrado")
                
                # Monta query dinâmica com campos a atualizar
                update_fields = []
                params = []
                
                if payload.service_id is not None:
                    update_fields.append("service_id = %s")
                    params.append(payload.service_id)
                if payload.date is not None:
                    update_fields.append("date = %s")
                    params.append(payload.date)
                if payload.start_time is not None:
                    update_fields.append("start_time = %s")
                    params.append(payload.start_time)
                if payload.status is not None:
                    update_fields.append("status = %s")
                    params.append(payload.status)
                if payload.notes is not None:
                    update_fields.append("notes = %s")
                    params.append(payload.notes)
                
                if not update_fields:
                    raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
                
                params.append(appointment_id)
                query = f"UPDATE appointments SET {', '.join(update_fields)} WHERE id = %s"
                
                cur.execute(query, params)
                
        return {"message": "Agendamento atualizado com sucesso", "id": appointment_id}
    finally:
        conn.close()


@router.delete("/{appointment_id}")
def delete_appointment(appointment_id: int):
    """Exclui um agendamento"""
    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                # Verifica se existe
                cur.execute("SELECT id FROM appointments WHERE id = %s", (appointment_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Agendamento não encontrado")
                
                # Exclui
                cur.execute("DELETE FROM appointments WHERE id = %s", (appointment_id,))
                
        return {"message": "Agendamento excluído com sucesso", "id": appointment_id}
    finally:
        conn.close()
