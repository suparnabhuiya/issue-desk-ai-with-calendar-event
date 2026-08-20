# Issue Desk

Issue Desk is a small issue-tracking application with a React frontend and a FastAPI backend.

## Features

- View, search, filter, create, update, and delete issues
- Track issue priority and status
- Store issues in `backend/data/issues.json`
- Use the optional Groq-powered assistant
- Access automatic FastAPI documentation

## Project Structure

```text
frontend/                 React and Vite frontend
backend/                  Python and FastAPI backend
  main.py                 FastAPI application entrypoint
  app/routes/issues.py    Issue CRUD API routes
  app/routes/agent.py     Assistant API route
  app/schema.py           Request and response models
  app/storage.py          JSON file storage
  app/tool/tools.py       LangChain assistant tools
  data/issues.json        Local issue data
  pyproject.toml          Backend dependencies
```

## Run The Backend

Open PowerShell in the `backend` folder:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -e .
python -m uvicorn main:app --reload
```

The backend runs at `http://127.0.0.1:8000`.

API documentation:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

If PowerShell blocks activation, run the commands through the virtual environment directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

## Run The Frontend

Open another terminal in the `frontend` folder:

```powershell
npm i
npm run dev
```

The frontend runs at `http://localhost:5173`.

If PowerShell blocks `npm`, use the Windows command wrapper:

```powershell
npm.cmd i
npm.cmd run dev
```

## Assistant Setup

The assistant uses ChatGroq. Add your Groq API key to `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key
```

Restart the backend after changing `.env`.

No Ollama installation or model download is required.

The assistant endpoint is:

```text
POST http://127.0.0.1:8000/agent/
```

Example request:

```json
{
  "message": "Create a high-priority issue titled 'Fix login bug' with description 'Users cannot log in' and schedule it tomorrow from 2 PM to 3 PM."
}
```

The assistant will:

1. Create the issue in `backend/data/issues.json`.
2. Create a local `.ics` calendar invite.
3. Open the invite using your computer's default calendar application.

The invite is initially saved in the Windows temporary folder as:

```text
C:\Users\<your-user>\AppData\Local\Temp\issue-desk-<id>.ics
```

Click **Save** or **Add** in the calendar application to add it to your system calendar. This project does not connect to Google Calendar or Outlook online.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/v1/health` | Check backend status |
| GET | `/api/v1/issues/` | List all issues |
| GET | `/api/v1/issues/{id}` | Get one issue |
| POST | `/api/v1/issues` | Create an issue |
| PUT | `/api/v1/issues/{id}` | Update an issue |
| DELETE | `/api/v1/issues/{id}` | Delete an issue |
| POST | `/agent/` | Send a request to the assistant |
