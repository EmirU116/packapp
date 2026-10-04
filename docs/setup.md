# Setup and running locally

Everything runs on your own machine. You need Python 3.12+ (developed on 3.14) and Node.js 20+ (developed on 24).

## First-time setup

In PowerShell, from the project folder:

```powershell
# backend
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
cd ..

# frontend
cd frontend
npm install
cd ..
```

Run the two install commands again whenever `requirements.txt` or `package.json` has changed.

## Starting the app

```powershell
.\dev.ps1
```

This opens two windows (backend and frontend) and then the app in your browser. Close the two windows to stop it.

If PowerShell refuses to run the script, start the two parts by hand in two terminals:

```powershell
# terminal 1, in backend/
.venv\Scripts\python -m uvicorn app.main:app --reload

# terminal 2, in frontend/
npm run dev
```

and open the address the frontend prints (normally http://localhost:5173; if that port is busy it picks the next free one).

- The app: the address above
- Backend API: http://localhost:8000
- Interactive API page (try every endpoint in the browser): http://localhost:8000/docs

On first start the backend creates the database file `backend/data/packapp.db` and fills it with the default roles and three demo users.

## Demo logins

| Username | Password | Role |
|---|---|---|
| `chief` | `chief123` | Chief |
| `employee` | `employee123` | Employee |
| `intern` | `intern123` | Intern |

These are for local testing only.

## Tests

Backend, from `backend/`:

```powershell
.venv\Scripts\python -m pytest            # all tests
.venv\Scripts\python -m pytest tests/test_auth.py::test_logout_ends_session   # one test
```

Backend tests use a throwaway in-memory database, so they never touch `packapp.db`.

Frontend, from `frontend/`:

```powershell
npm test                                  # all tests
npx vitest run src/pages/RegisterPage.test.tsx   # one file
npm run build                             # type-check and build
npm run lint
```

Frontend tests fake the backend, so it does not need to be running.

## Settings

Defaults work out of the box. To change one, copy `backend/.env.example` to `backend/.env` and edit it.

## Starting over

Stop the backend and delete `backend/data/packapp.db`. It is recreated with the seed data on the next start.
