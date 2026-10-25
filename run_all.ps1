# HCM Lite - One Command Launch Script for PowerShell
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "     HCM Lite - Starting Backend & Frontend Servers     " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n[1/3] Starting Backend API Server (http://localhost:8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$scriptDir\backend'; python -m uvicorn app.main:app --reload --port 8000"

Write-Host "[2/3] Starting Web Frontend Server (http://localhost:5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$scriptDir\web'; npm run dev"

Write-Host "[3/3] Waiting for servers to initialize..." -ForegroundColor Green
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  HCM Lite is RUNNING!" -ForegroundColor Green
Write-Host "  Main Web App: http://localhost:5173" -ForegroundColor White
Write-Host "  API Docs:     http://localhost:8000/docs" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Green
