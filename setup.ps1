# HCM Lite Setup Script for Windows PowerShell
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "    HCM Lite - One-Command Setup Script   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Environment files check / generation
if (-not (Test-Path "backend\.env")) {
    Write-Host "[1/5] Generating backend\.env from backend\.env.example..." -ForegroundColor Yellow
    Copy-Item "backend\.env.example" "backend\.env"
    
    # Generate random JWT secret and Admin password
    $jwtSecret = [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")
    $adminPassword = [System.Web.Security.Membership]::GeneratePassword(16, 3) 2>$null
    if (-not $adminPassword) {
        $adminPassword = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | ForEach-Object {[char]$_})
    }
    
    (Get-Content "backend\.env") |
        ForEach-Object { $_ -replace "YOUR_64_CHAR_HEX_SECRET_HERE", $jwtSecret } |
        ForEach-Object { $_ -replace "YOUR_STRONG_ADMIN_PASSWORD", $adminPassword } |
        Set-Content "backend\.env"
        
    Write-Host "Generated JWT_SECRET and initial ADMIN_PASSWORD." -ForegroundColor Green
    Write-Host "Initial Admin Email: admin@hcmlite.local" -ForegroundColor White
    Write-Host "Initial Admin Password: $adminPassword" -ForegroundColor White
} else {
    Write-Host "[1/5] backend\.env already exists. Preserving existing secrets." -ForegroundColor Green
}

if (-not (Test-Path "web\.env")) {
    Copy-Item "web\.env.example" "web\.env"
    Write-Host "Created web\.env" -ForegroundColor Green
}
if (-not (Test-Path "mobile\.env")) {
    Copy-Item "mobile\.env.example" "mobile\.env"
    Write-Host "Created mobile\.env" -ForegroundColor Green
}

# 2. Database setup (Docker Compose)
Write-Host "[2/5] Checking Docker and starting database..." -ForegroundColor Yellow
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker compose up -d db
    Write-Host "Waiting for database to become healthy..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
} else {
    Write-Host "Docker not detected in PATH. Ensure PostgreSQL is running on port 5432 or SQLite will be used for testing." -ForegroundColor Yellow
}

# 3. Backend dependencies & migrations
Write-Host "[3/5] Installing backend dependencies..." -ForegroundColor Yellow
python -m pip install -r backend\requirements.txt

Write-Host "Running database migrations..." -ForegroundColor Yellow
python -m alembic -c backend\alembic.ini upgrade head

# 4. Frontend setup
Write-Host "[4/5] Installing web dependencies..." -ForegroundColor Yellow
if (Test-Path "web\package.json") {
    Push-Location web
    npm install
    Pop-Location
}

Write-Host "[5/5] Setup complete! You can now start the backend and web servers." -ForegroundColor Green
Write-Host "To start backend: cd backend; uvicorn app.main:app --reload --port 8000" -ForegroundColor White
Write-Host "To start web:     cd web; npm run dev" -ForegroundColor White
