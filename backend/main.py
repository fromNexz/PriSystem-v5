from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import appointments, customers, settings, chatbot, dashboard, chatbot_messages, whatsapp

app = FastAPI(title="PriSystem API")

# CORS pode manter ou remover, já que agora tudo vem da mesma origem
origins = [
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # pode deixar * já que está tudo junto
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers da API PRIMEIRO (antes do mount de static)
app.include_router(appointments.router)
app.include_router(customers.router)
app.include_router(settings.router)
app.include_router(chatbot.router)
app.include_router(dashboard.router)
app.include_router(chatbot_messages.router)
app.include_router(whatsapp.router)

@app.get("/api")
def root():
    return {"message": "PriSystem API online"}

# Servir arquivos estáticos (HTML, CSS, JS) por último
app.mount("/", StaticFiles(directory="../painel", html=True), name="painel")
