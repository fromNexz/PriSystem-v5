import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "204.157.124.199",
    "port": 5432,
    "dbname": "pri_system",
    "user": "postgres",
    "password": "003289"
}

def get_connection():
    conn = psycopg2.connect(
        cursor_factory=RealDictCursor,
        **DB_CONFIG
    )
    conn.autocommit = True
    return conn
