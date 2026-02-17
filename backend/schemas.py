from datetime import date
from pydantic import BaseModel

class CustomerWithStats(BaseModel):
    id: int
    name: str | None = None
    phone: str
    is_blocked: bool
    blocked_reason: str | None = None
    total_appointments: int
    last_appointment_date: date | None = None

    class Config:
        from_attributes = True
