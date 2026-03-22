# Hospital Management System

A complete Hospital Management System with Django Backend and React Frontend.

## Quick Start

### Backend
```bash
cd backend
# Create venv (optional but recommended)
# python -m venv venv
# .\venv\Scripts\activate

# Install dependencies
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers

# Initialize Database
python manage.py migrate
python manage.py seed_data

# Run Server
python manage.py runserver
```
Backend runs on `http://127.0.0.1:8000`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`.

## Features
- Role-based Dashboards (Admin, Doctor, Nurse, Patient)
- Appointment Scheduling and Management
- Vitals Recording
- Consultation Notes
- JWT Authentication

## Demo Accounts
- **Admin**: admin1 / pass1234
- **Doctor**: doctor1 / pass1234
- **Nurse**: nurse1 / pass1234
- **Patient**: patient1 / pass1234
