import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import location, weather, prediction, risk, relocation, saved, alerts

load_dotenv()

app = FastAPI(
    title="SURAKSHA-DRISHTI Backend API",
    version="1.0.0",
)

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(location.router)
app.include_router(weather.router)
app.include_router(prediction.router)
app.include_router(risk.router)
app.include_router(relocation.router)
app.include_router(saved.router)
app.include_router(alerts.router)


@app.get("/")
def root():
    return {"status": "running", "project": "SURAKSHA-DRISHTI Backend"}