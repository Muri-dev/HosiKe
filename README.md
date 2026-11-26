# HosiKe - Hospital Management System

> A complete and modern Hospital Management System built to ensure cross-platform accessibility, scalability, security, and real-time AI clinical intelligence.

### 💻 Technology Stack
- **Frontend:** React + Vite + Lucide Icons
- **Backend:** Python / Django REST Framework
- **Database:** Supabase PostgreSQL (with SQLite fallback)
- **AI Intelligence:** Google Gemini (`gemini-flash-lite-latest`) + Live-RAG (Role-scoped clinical context engine)

---

## 🚀 Quick Start

### 1. Backend Setup
The backend communicates with your Supabase PostgreSQL database (configured via `backend/.env`).

```bash
cd backend

# Create and activate virtual environment (recommended)
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Run migrations & populate database
python manage.py migrate
python manage.py loaddata data_backup.json

# Start the Django server
python manage.py runserver
```
The backend API is served at: `http://127.0.0.1:8000`.

### 2. Frontend Setup
```bash
cd frontend

# Install node modules
npm install

# Start the development server
npm run dev
```
The user interface is served at: `http://localhost:5173`.

---

## ✨ Core Features
- **HosiKe AI Assistant:** Live conversational assistant for Patients, Doctors, Nurses, and Admins. Computes remaining prescription doses, checks schedules, reviews vitals, and tracks hospital-wide rosters in real time with zero hallucinations.
- **Role-based Dashboards:** Dedicated interfaces for Admins, Doctors, Nurses, and Patients.
- **Clinical Workflows:** Seamless appointment scheduling, triage management, and automated nursing queues.
- **Inpatient & Remote Monitoring:** Complete inpatient admission management and remote prescription tracking with daily medication timelines.
- **Secure Architecture:** Robust JWT Authentication with role-based access control.

---

## 🔑 Demo Accounts
Use these credentials to explore the different dashboards:
- **Admin**: `admin1` / `pass1234`
- **Doctor**: `doctor1` / `pass1234`
- **Nurse**: `nurse1` / `pass1234`
- **Patient**: `patient1` / `pass1234`
