#!/usr/bin/env bash
set -e

echo "=========================================="
echo "    HCM Lite - One-Command Setup Script   "
echo "=========================================="

# 1. Environment files check / generation
if [ ! -f "backend/.env" ]; then
    echo "[1/5] Generating backend/.env from backend/.env.example..."
    cp backend/.env.example backend/.env
    
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
    ADMIN_PASS=$(python3 -c "import secrets, string; alphabet = string.ascii_letters + string.digits + '!@#$%^&*'; print(''.join(secrets.choice(alphabet) for _ in range(16)))" 2>/dev/null || openssl rand -base64 12)
    
    sed -i.bak "s/YOUR_64_CHAR_HEX_SECRET_HERE/$JWT_SECRET/" backend/.env
    sed -i.bak "s/YOUR_STRONG_ADMIN_PASSWORD/$ADMIN_PASS/" backend/.env
    rm -f backend/.env.bak
    
    echo "Generated JWT_SECRET and initial ADMIN_PASSWORD."
    echo "Initial Admin Email: admin@hcmlite.local"
    echo "Initial Admin Password: $ADMIN_PASS"
else
    echo "[1/5] backend/.env already exists."
fi

[ ! -f "web/.env" ] && cp web/.env.example web/.env && echo "Created web/.env"
[ ! -f "mobile/.env" ] && cp mobile/.env.example mobile/.env && echo "Created mobile/.env"

# 2. Database setup
echo "[2/5] Starting database via Docker Compose..."
if command -v docker &> /dev/null; then
    docker compose up -d db
    sleep 4
fi

# 3. Backend dependencies & migrations
echo "[3/5] Installing backend dependencies..."
pip install -r backend/requirements.txt
alembic -c backend/alembic.ini upgrade head

# 4. Frontend setup
echo "[4/5] Installing web dependencies..."
if [ -f "web/package.json" ]; then
    (cd web && npm install)
fi

echo "[5/5] Setup complete! Start servers:"
echo "Backend: cd backend && uvicorn app.main:app --reload --port 8000"
echo "Web:     cd web && npm run dev"
