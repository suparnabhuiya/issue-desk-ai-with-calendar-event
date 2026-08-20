from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.agent import router as agent_router
from app.routes.issues import router as issues_router

load_dotenv()

app = FastAPI(title="Issue Desk API")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:5173"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(issues_router)
app.include_router(agent_router)


@app.get("/api/v1/health", tags=["health"])
def health_check():
	return {"status": "ok"}