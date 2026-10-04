# Starts PackApp locally: the backend and the frontend, each in its own window.
# Usage (from the project folder):  .\dev.ps1
# Close the two windows to stop the app.

$root = $PSScriptRoot

if (-not (Test-Path "$root\backend\.venv")) {
    Write-Host "Backend is not installed yet. See docs/setup.md (first-time setup)." -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path "$root\frontend\node_modules")) {
    Write-Host "Frontend is not installed yet. See docs/setup.md (first-time setup)." -ForegroundColor Yellow
    exit 1
}

# Backend API on http://localhost:8000
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; .venv\Scripts\python -m uvicorn app.main:app --reload"

# Frontend; --open shows it in the browser on whichever port Vite ends up using
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev -- --open"
