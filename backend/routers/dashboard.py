from fastapi import APIRouter
from datetime import date
from db import get_connection

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats():
    """Retorna estatísticas gerais para o dashboard"""
    conn = get_connection()
    cur = conn.cursor()
    
    today = date.today()
    
    try:
        # Total de agendamentos hoje
        cur.execute("""
            SELECT COUNT(*) as total
            FROM appointments
            WHERE date = %s
        """, (today,))
        appointments_today = cur.fetchone()["total"]
        
        # Agendamentos pendentes (hoje)
        cur.execute("""
            SELECT COUNT(*) as total
            FROM appointments
            WHERE date = %s AND status = 'pending'
        """, (today,))
        pending_today = cur.fetchone()["total"]
        
        # Agendamentos confirmados (hoje)
        cur.execute("""
            SELECT COUNT(*) as total
            FROM appointments
            WHERE date = %s AND status = 'confirmed'
        """, (today,))
        confirmed_today = cur.fetchone()["total"]
        
        # Total de clientes cadastrados
        cur.execute("""
            SELECT COUNT(*) as total
            FROM customers
        """)
        total_customers = cur.fetchone()["total"]
        
        # Clientes bloqueados
        cur.execute("""
            SELECT COUNT(*) as total
            FROM customers
            WHERE is_blocked = true
        """)
        blocked_customers = cur.fetchone()["total"]
        
        # Status do chatbot (da tabela settings) - com tratamento de erro
        chatbot_status = "none"
        try:
            cur.execute("""
                SELECT active_mode
                FROM settings
                WHERE key = 'chatbot'
                LIMIT 1
            """)
            chatbot_row = cur.fetchone()
            if chatbot_row and "active_mode" in chatbot_row:
                chatbot_status = chatbot_row["active_mode"]
        except Exception:
            # Se não existir a tabela ou coluna, ignora
            pass
        
        # Próximos agendamentos (hoje, ordenados por hora)
        cur.execute("""
            SELECT 
                a.id,
                a.start_time,
                c.name as customer_name,
                c.phone as customer_phone,
                s.name as service_name,
                a.status
            FROM appointments a
            LEFT JOIN customers c ON c.id = a.customer_id
            LEFT JOIN services s ON s.id = a.service_id
            WHERE a.date = %s
            ORDER BY a.start_time ASC
            LIMIT 5
        """, (today,))
        next_appointments = cur.fetchall()
        
        return {
            "appointments_today": appointments_today,
            "pending_today": pending_today,
            "confirmed_today": confirmed_today,
            "total_customers": total_customers,
            "blocked_customers": blocked_customers,
            "chatbot_status": chatbot_status,
            "next_appointments": next_appointments
        }
    
    except Exception as e:
        print(f"Erro no dashboard stats: {e}")
        raise
    finally:
        cur.close()
        conn.close()
