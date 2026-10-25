# HCM Lite — AI-Assisted Human Capital Management System

**Built for the Saylani Hackathon (24 Oct 2026, Zaitoon Ashraf IT Park)**  
*Engineered by a 4-person full-stack engineering team standard.*

---

## 🌟 Executive Summary

**HCM Lite** is an enterprise-grade, full-stack, AI-assisted Human Capital Management platform delivering 25 end-to-end functionalities across 9 modules for **Admin**, **HR**, and **Employees**.

### 🛡️ Core Principles & Architecture
- **Strict Zero-Dummy-Data Guarantee**: The database initializes completely empty. No fake seed employees exist. Every dashboard graph, metric, attrition score, anomaly calculation, and AI response is derived strictly from real transactions performed by users in the app.
- **Layered Architecture**: `Routes -> Services -> Repositories/Database`. Zero business logic resides in route controllers.
- **Server-Side Role & Scope Security**: Every API endpoint enforces strict role validation (`require_roles`) and data scoping (Employees only ever access rows associated with their own `employee_id`).
- **Provider-Agnostic AI**: Supports both **Groq** (`llama-3.3-70b-versatile`) and **Google Gemini** (`gemini-2.0-flash`) with dynamic tool/function calling into verified database services. Graceful fallbacks activate if the AI key is unconfigured.
- **Biometric & Geolocation Check-In**: Camera face attendance check + Haversine geofence calculation (< 100m accuracy) on both Responsive Web and the Bonus Mobile App.

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph Clients ["Client Applications"]
        Web["Responsive Web App (React 18 + Vite + TS + Tailwind)"]
        Mobile["Bonus Mobile App (Expo + React Native)"]
    end

    subgraph Gateway ["FastAPI Gateway & Security"]
        Router["API Router (/api/v1)"]
        AuthGuard["JWT Security & Bcrypt 72-Byte Truncation"]
        RoleGuard["RBAC (Admin, HR, Employee)"]
        ScopeGuard["Employee Data Scope Guard"]
        RateLimiter["SlowAPI Rate Limiter"]
    end

    subgraph Services ["Core Business Service Layer"]
        OrgSvc["Organization & Governance Service"]
        AuthSvc["Auth & First-Run Lock Service"]
        EmpSvc["Employee & Dry-Run CSV Service"]
        AttSvc["Attendance & Haversine Geofence Service"]
        LeaveSvc["Working-Days Leave & Quota Service"]
        PayrollSvc["Payroll Lite & Tax Slab Engine"]
        PDFSvc["ReportLab PDF Payslip Generator"]
        AnalyticsSvc["Analytics, Attrition Risk & Anomaly Service"]
        AISvc["Provider-Agnostic AI Service (Groq / Gemini)"]
        AuditSvc["Append-Only Audit Trail Service"]
    end

    subgraph Data ["Data Persistence Layer"]
        Postgres[("PostgreSQL (Supabase Compatible) / SQLite Local")]
        Alembic["Alembic Migrations"]
    end

    Web -->|HTTP / REST + Bearer JWT| Router
    Mobile -->|HTTP / REST + Bearer JWT| Router
    Router --> AuthGuard
    AuthGuard --> RoleGuard
    RoleGuard --> ScopeGuard
    ScopeGuard --> RateLimiter
    RateLimiter --> Services
    Services --> Postgres
    AISvc -->|Function Calling| Services
```

---

## 📋 25-Functionality Implementation Matrix (M1 - M9)

| # | Module | Feature Description | Implemented In | Status |
|---|--------|---------------------|----------------|:------:|
| 1 | **M1: Auth & Access** | JWT Authentication with Bcrypt password hashing & 3 roles (`admin`, `hr`, `employee`) | `backend/app/services/auth_service.py` | **PASS** |
| 2 | **M1: Auth & Access** | Server-side role & data scope guard (Employees strictly see own records) | `backend/app/core/deps.py` | **PASS** |
| 3 | **M1: Auth & Access** | First-run setup locks permanently once Admin account exists | `backend/app/services/auth_service.py` | **PASS** |
| 4 | **M1: Auth & Access** | Temporary password generation for new employees with force change on first login | `backend/app/api/v1/auth.py` | **PASS** |
| 5 | **M2: Org Setup** | Company settings: 09:00 start, 15m grace, 5h half-day, Sat-Sun weekends | `backend/app/services/org_service.py` | **PASS** |
| 6 | **M2: Org Setup** | Departments, job designations, annual leave quotas, and public holidays | `backend/app/services/org_service.py` | **PASS** |
| 7 | **M3: Employees** | Employee registration with automatic user login creation | `backend/app/services/employee_service.py` | **PASS** |
| 8 | **M3: Employees** | CSV Import with pre-validation **DRY RUN** returning row, field & reason for errors | `backend/app/services/employee_service.py` | **PASS** |
| 9 | **M3: Employees** | Employee Directory & Employee 360 profile view (attendance, leaves, payroll) | `backend/app/api/v1/employees.py` | **PASS** |
| 10 | **M4: Attendance** | Server-stamped web check-in/out (client time is never trusted) | `backend/app/services/attendance_service.py` | **PASS** |
| 11 | **M4: Attendance** | Duplicate check-in prevention (returns `HTTP 409 Conflict`) | `backend/app/services/attendance_service.py` | **PASS** |
| 12 | **M4: Attendance** | Status calculation: Late (>09:15), Half-day (<5h), On Leave, Absent | `backend/app/services/attendance_service.py` | **PASS** |
| 13 | **M4: Attendance** | Attendance correction request & HR/Admin approval inbox | `backend/app/services/attendance_service.py` | **PASS** |
| 14 | **M4: Attendance** | Camera face verification + Haversine office geofencing (<100m accuracy) | `backend/app/services/attendance_service.py` | **PASS** |
| 15 | **M5: Leaves** | Working days calculation (automatically skips Sat-Sun weekends & holidays) | `backend/app/services/leave_service.py` | **PASS** |
| 16 | **M5: Leaves** | Overlapping dates & over-balance rejection (`HTTP 422`) | `backend/app/services/leave_service.py` | **PASS** |
| 17 | **M5: Leaves** | HR approval/rejection inbox with reviewer comments | `backend/app/services/leave_service.py` | **PASS** |
| 18 | **M6: Payroll** | Automated gross calculation (`1.5 x basic` with 40% HRA and 10% Medical) | `backend/app/services/payroll_service.py` | **PASS** |
| 19 | **M6: Payroll** | Daily rate deductions for unapproved absences, unpaid leave, and half-days | `backend/app/services/payroll_service.py` | **PASS** |
| 20 | **M6: Payroll** | Progressive annual tax slabs calculation (0%, 5%, 15%, 25%, 35%) | `backend/app/services/payroll_service.py` | **PASS** |
| 21 | **M6: Payroll** | HR creates/reviews monthly Draft; Admin locks with Finalize button | `backend/app/services/payroll_service.py` | **PASS** |
| 22 | **M6: Payroll** | ReportLab PDF Payslip download (Employee: own only; HR/Admin: all) | `backend/app/services/pdf_service.py` | **PASS** |
| 23 | **M7: Analytics** | Single source-of-truth KPIs, Attrition Risk score (0-100), Absence anomaly z-score | `backend/app/services/analytics_service.py` | **PASS** |
| 24 | **M8: AI Assistant** | Provider-agnostic Groq/Gemini tool calling, Smart Leave parser, Roman Urdu | `backend/app/services/ai_service.py` | **PASS** |
| 25 | **M9: Comms & Audit** | Broadcast announcements & Immutable append-only audit trail with JSON diff | `backend/app/services/audit_service.py` | **PASS** |

---

## 🚀 Quick Start (< 10 Minutes Setup)

### Automated Setup Scripts
The repository includes automated setup scripts that generate `.env` files with secure secrets, verify dependencies, start database services, and launch applications.

#### On Windows (PowerShell):
```powershell
.\setup.ps1
```

#### On Linux / macOS (Bash):
```bash
chmod +x setup.sh
./setup.sh
```

---

### Manual Step-by-Step Setup

### ⚡ Quick Start: One-Click Launch

Run both the Backend API and Web Frontend in a single click:
```powershell
.\run_all.bat
# Or in PowerShell:
.\run_all.ps1
```
This automatically initializes the backend on `http://localhost:8000`, the frontend on `http://localhost:5173`, and opens your default browser.

---

### 🛠️ Manual Step-by-Step Setup

#### 1. Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. Web Frontend Setup
```bash
cd web

# Install dependencies
npm install

# Build production bundle
npm run build

# Start preview server on port 5173
npm run preview -- --port 5173
# (Or run dev server: npm run dev)
```

#### 3. Access the Application
- **Web App**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 🔑 Environment Variables Reference

All real configuration lives in `backend/.env` (git-ignored). Committed template is in `backend/.env.example`.

| Variable | Description | Default / Example Value |
|---|---|---|
| `APP_NAME` | Name of the application | `HCM Lite` |
| `APP_ENV` | Environment mode | `development` |
| `TZ` | Company standard timezone | `Asia/Karachi` |
| `DATABASE_URL` | PostgreSQL connection string (or fallback SQLite) | `postgresql+psycopg2://hcm:hcm_password@localhost:5432/hcmlite` |
| `JWT_SECRET` | 64-character cryptographically random hex key | Auto-generated by setup script |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| Access token TTL | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | `7` |
| `ADMIN_EMAIL` | Default administrator email | `admin@hcmlite.com` |
| `ADMIN_PASSWORD` | Strong random initial admin password | Auto-generated in `.env` |
| `CORS_ORIGINS` | Permitted client origins | `http://localhost:5173,http://localhost:19006` |
| `AI_PROVIDER` | Selected LLM backend | `groq` or `gemini` |
| `GROQ_API_KEY` | Groq API Key (leave empty for friendly fallback) | `gsk_...` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `AI_MODEL_GROQ` | Groq model identifier | `llama-3.3-70b-versatile` |
| `AI_MODEL_GEMINI` | Gemini model identifier | `gemini-2.0-flash` |
| `AI_TIMEOUT_SECONDS` | API request timeout | `15` |
| `AI_RATE_LIMIT_PER_HOUR` | Per-user AI rate limit | `20` |
| `FACE_MIN_GPS_ACCURACY_M` | Minimum required GPS accuracy | `100` |
| `STORE_FACE_PHOTOS` | Persist captured attendance photos | `false` |

---

## 📷 Biometric & Geolocation Attendance Details

1. **Server-Side Timestamp**:
   The client clock is **never trusted**. Check-in and check-out timestamps are stamped directly by the server in UTC and formatted into `Asia/Karachi`.
2. **Haversine Geofencing**:
   Calculates the geodesic distance between employee GPS coordinates and the office location (`24.8607° N, 67.0011° E`).
   - If distance <= `geofence_radius_meters` (default 150m) and GPS accuracy <= 100m, attendance is flagged `location_verified = true`.
   - If outside the perimeter, the check-in is rejected or flagged as out-of-bounds.
3. **Camera Face Capture**:
   Utilizes HTML5 `<video>` / MediaDevices on Web and `expo-camera` on Mobile. Captures a live face frame to ensure physical presence.
4. **Attendance Business Rules**:
   - Check-in after 09:15 (09:00 start + 15m grace) -> **LATE**.
   - Total hours worked under 5.0 hours -> **HALF_DAY**.
   - Second check-in on the same day -> **HTTP 409 Conflict**.
   - Unapproved absence on a working day -> **ABSENT**.

---

## 📱 Bonus Mobile App (`/mobile`)

The `/mobile` directory contains an **Expo (React Native + TypeScript)** application configured for employee self-service:
- **Biometric Check-In**: Camera face capture + `expo-location` GPS geofencing.
- **Secure Token Storage**: Uses `expo-secure-store` to keep JWT tokens safe.
- **Unified Glassmorphism UI**: Consistent dark glass theme with gradient accents.
- **AI Copilot**: Native mobile chat interface supporting plain English and Roman Urdu.

To run the mobile app:
```bash
cd mobile
npm install
npx expo start
```
*(For camera & location hardware access, run on Expo Go on an iOS/Android device or emulator).*

---

## ☁️ Free Deployment Guide

### 1. Database on Supabase (Free Tier)
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings -> Database** and copy the **Connection URI** (Session pooler or direct).
3. In `backend/.env`, set:
   ```env
   DATABASE_URL=postgresql+psycopg2://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```

### 2. Backend on Render / Railway
1. Push this repository to GitHub.
2. In [render.com](https://render.com), create a new **Web Service** pointing to `/backend`.
3. Set Build Command: `pip install -r requirements.txt && alembic upgrade head`
4. Set Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add the environment variables from `backend/.env`.

### 3. Frontend on Vercel
1. In [vercel.com](https://vercel.com), create a new project pointing to the `/web` directory.
2. Set Framework Preset: **Vite**.
3. Add Environment Variable:
   ```env
   VITE_API_BASE_URL=https://your-backend.onrender.com
   ```
4. Deploy!

---

## 🧪 Automated Test Verification

Run the comprehensive pytest suite covering all 25 business rules:
```bash
pytest backend/tests -v
```
All 7 integration test suites execute against isolated, empty test environments and verify:
- First-run setup and permanent lock
- RBAC and data-scope isolation
- Attendance duplicate rejection and late thresholds
- Working days calculation excluding weekends and holidays
- Payroll gross calculation (1.5x basic), deductions, and progressive tax slabs
- CSV dry-run error reporting
- AI scope protection
