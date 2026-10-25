@echo off
title Launching HCM Lite System
echo ========================================================
echo      HCM Lite - Starting Backend ^& Frontend Servers
echo ========================================================
echo.

echo [1/3] Starting Backend API Server on http://localhost:8000 ...
start "HCM Lite - Backend API" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --reload --port 8000"

echo [2/3] Starting Web Frontend Server on http://localhost:5173 ...
start "HCM Lite - Web Frontend" cmd /k "cd /d "%~dp0web" && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 4 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================================
echo   HCM Lite is RUNNING!
echo   Main Web App: http://localhost:5173
echo   API Docs:     http://localhost:8000/docs
echo ========================================================
