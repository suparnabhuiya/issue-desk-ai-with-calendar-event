import os
import subprocess
import tempfile
import uuid
from datetime import datetime
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langchain.tools import tool
from langchain.agents import create_agent
from app.storage import load_data, save_data


load_dotenv()

calendar_agent = None
email_agent = None
supervisor_agent = None


def get_supervisor_agent():
    global calendar_agent, email_agent, supervisor_agent

    if supervisor_agent is not None:
        return supervisor_agent

    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError("GROQ_API_KEY is required for the assistant endpoint")

    model = ChatGroq(model="openai/gpt-oss-120b", api_key=os.getenv("GROQ_API_KEY"))
    calendar_agent = create_agent(
        model,
        tools=[create_calendar_event, get_available_time_slots],
        system_prompt=CALENDAR_AGENT_PROMPT,
    )
    email_agent = create_agent(
        model,
        tools=[send_email],
        system_prompt=EMAIL_AGENT_PROMPT,
    )
    supervisor_agent = create_agent(
        model,
        tools=[create_issue, schedule_event, manage_email],
        system_prompt=SUPERVISOR_PROMPT,
    )
    return supervisor_agent


@tool
def create_issue(title: str, description: str, priority: str = "medium") -> str:
    """Create an issue in the Issue Desk JSON store."""
    if priority not in {"low", "medium", "high"}:
        priority = "medium"

    issues = load_data()
    issue = {
        "id": str(__import__("uuid").uuid4()),
        "title": title,
        "description": description,
        "priority": priority,
        "status": "open",
    }
    issues.append(issue)
    save_data(issues)
    return f"Issue created: {issue['title']} (#{issue['id'][:8]})"


@tool
def create_calendar_event(
    title: str,
    start_time: str,       # ISO format: "2024-01-15T14:00:00"
    end_time: str,         # ISO format: "2024-01-15T15:00:00"
    attendees: list[str],  # email addresses
    location: str = ""
) -> str:
    """Create a local calendar invite and open it in the system calendar."""
    try:
        start = datetime.fromisoformat(start_time).strftime("%Y%m%dT%H%M%S")
        end = datetime.fromisoformat(end_time).strftime("%Y%m%dT%H%M%S")
    except ValueError as error:
        raise ValueError("Calendar times must use ISO format") from error

    event = (
        "BEGIN:VCALENDAR\n"
        "VERSION:2.0\n"
        "PRODID:-//Issue Desk//System Calendar//EN\n"
        "BEGIN:VEVENT\n"
        f"UID:{uuid.uuid4()}\n"
        f"DTSTART:{start}\n"
        f"DTEND:{end}\n"
        f"SUMMARY:{title}\n"
        f"DESCRIPTION:{title}\n"
        f"LOCATION:{location}\n"
        "END:VEVENT\n"
        "END:VCALENDAR\n"
    )
    calendar_file = os.path.join(tempfile.gettempdir(), f"issue-desk-{uuid.uuid4()}.ics")
    with open(calendar_file, "w", encoding="utf-8", newline="\r\n") as file:
        file.write(event)

    if os.name == "nt":
        os.startfile(calendar_file)
    else:
        subprocess.Popen(["xdg-open", calendar_file])

    return f"Calendar event opened: {title}"


@tool
def send_email(
    from_email: str,  # sender email address
    to: list[str],  # recipient email addresses
    subject: str,
    body: str,
    cc: list[str] = []
) -> str:
    """Send an email via email API. Requires properly formatted addresses including a from_email."""
    return f"Email sent from {from_email} to {', '.join(to)} - Subject: {subject}"


@tool
def get_available_time_slots(
    attendees: list[str],
    date: str,  # ISO format: "2024-01-15"
    duration_minutes: int
) -> list[str]:
    """Check calendar availability for given attendees on a specific date."""
    return ["09:00", "14:00", "16:00"]


CALENDAR_AGENT_PROMPT = (
    "You are a calendar scheduling assistant. "
    "Parse natural language scheduling requests (e.g., 'next Tuesday at 2pm') "
    "into proper ISO datetime formats. "
    "Use get_available_time_slots to check availability when needed. "
    "If there is no suitable time slot, stop and confirm unavailability in your response. "
    "Use create_calendar_event to schedule events. "
    "Always confirm what was scheduled in your final response."
)

EMAIL_AGENT_PROMPT = (
    "You are an email assistant. "
    "Compose professional emails based on natural language requests. "
    "Extract recipient information and craft appropriate subject lines and body text. "
    "Use send_email to send the message. "
    "Always confirm what was sent in your final response."
)

@tool
def schedule_event(request: str) -> str:
    """Schedule calendar events using natural language.

    Use this when the user wants to create, modify, or check calendar appointments.
    Handles date/time parsing, availability checking, and event creation.

    Input: Natural language scheduling request (e.g., 'meeting with design team
    next Tuesday at 2pm')
    """
    result = calendar_agent.invoke({
        "messages": [{"role": "user", "content": request}]
    })
    return result["messages"][-1].text


@tool
def manage_email(request: str) -> str:
    """Send emails using natural language.

    Use this when the user wants to send notifications, reminders, or any email
    communication. Handles recipient extraction, subject generation, and email
    composition.

    Input: Natural language email request (e.g., 'send them a reminder about
    the meeting')
    """
    result = email_agent.invoke({
        "messages": [{"role": "user", "content": request}]
    })
    return result["messages"][-1].text


SUPERVISOR_PROMPT = (
    "You are a helpful personal assistant. "
    "You can create issues, schedule calendar events, and send emails. "
    "When the user asks to create an issue and put it on a calendar, create the issue "
    "first and then schedule the calendar event. "
    "Break down requests into appropriate tool calls and coordinate the results. "
    "When a request involves multiple actions, use multiple tools in sequence."
)

def run_agent(user_message: str) -> str:
    """Run the assistant with a user message and return the final response."""
    # query = "Schedule a team meeting next Tuesday at 2pm for 1 hour"

    # for step in calendar_agent.stream(
    #     {"messages": [{"role": "user", "content": query}]}
    # ):
    #     for update in step.values():
    #         for message in update.get("messages", []):
    #             message.pretty_print()

    # query1 = "Send the design team a reminder about reviewing the new mockups"

    # for step in email_agent.stream(
    #     {"messages": [{"role": "user", "content": query1}]}
    # ):
    #     for update in step.values():
    #         for message in update.get("messages", []):
    #             message.pretty_print()
    # messages = [
    #     SystemMessage(content=CALENDAR_AGENT_PROMPT),
    #     HumanMessage(content=user_message),
    # ]

    # # Invoke model with tools bound
    # response = model_with_tools.invoke(messages)

    # # If the model wants to call tools, execute them and get final response
    # tool_map = {t.name: t for t in tools}

    # while response.tool_calls:
    #     messages.append(response)
    #     for tool_call in response.tool_calls:
    #         tool_fn = tool_map[tool_call["name"]]
    #         result = tool_fn.invoke(tool_call["args"])
    #         from langchain_core.messages import ToolMessage
    #         messages.append(
    #             ToolMessage(content=str(result), tool_call_id=tool_call["id"])
    #         )
    #     response = model_with_tools.invoke(messages)
    # print(response)

    # return response.content

    # query = "Schedule a team standup for tomorrow at 9am"

    # for step in supervisor_agent.stream(
    #     {"messages": [{"role": "user", "content": query}]}
    # ):
    #     for update in step.values():
    #         for message in update.get("messages", []):
    #             message.pretty_print()

    final_response = ""
    for step in get_supervisor_agent().stream(
        {"messages": [{"role": "user", "content": user_message}]}
    ):
        for update in step.values():
            for message in update.get("messages", []):
                message.pretty_print()
                message_text = getattr(message, "text", "")
                if message_text:
                    final_response = message_text

    return final_response or "Assistant request completed."
