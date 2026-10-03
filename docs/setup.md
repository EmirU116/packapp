# Setup and running locally

Everything runs on your own machine. You need Python 3.12+ (developed on 3.14).

## Backend

All commands are run from the `backend/` folder in PowerShell.

First time only:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Start the server:

```powershell
.venv\Scripts\python -m uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Interactive API page (try every endpoint in the browser): http://localhost:8000/docs

On first start the server creates the database file `backend/data/packapp.db` and fills it with the default roles and three demo users.

## Demo logins

| Username | Password | Role |
|---|---|---|
| `chief` | `chief123` | Chief |
| `employee` | `employee123` | Employee |
| `intern` | `intern123` | Intern |

These are for local testing only.

## Tests

```powershell
.venv\Scripts\python -m pytest            # all tests
.venv\Scripts\python -m pytest tests/test_auth.py::test_logout_ends_session   # one test
```

Tests use a throwaway in-memory database, so they never touch `packapp.db`.

## Settings

Defaults work out of the box. To change one, copy `backend/.env.example` to `backend/.env` and edit it.

## Starting over

Stop the server and delete `backend/data/packapp.db`. It is recreated with the seed data on the next start.
