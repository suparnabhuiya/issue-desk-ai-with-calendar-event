from fastapi import APIRouter, HTTPException, status
from groq import AuthenticationError
from pydantic import BaseModel
from app.tool.tools import run_agent

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
    message: str


@router.post("/")
def call_agent(payload: AgentRequest):
    """Run the calendar agent with a user message."""
    try:
        result = run_agent(payload.message)
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except AuthenticationError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GROQ_API_KEY is invalid or expired. Update backend/.env.",
        ) from error
    return {"response": result}
