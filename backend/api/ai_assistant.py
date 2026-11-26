import difflib
import json
import os
import re
from datetime import datetime, time as dtime, timedelta

import requests
from django.db.models import Count, Q
from django.utils import timezone

from .models import (
    Admission,
    Appointment,
    AuditLog,
    DoctorProfile,
    InpatientOrder,
    MedicationSchedule,
    NurseProfile,
    NurseTask,
    PatientProfile,
    Prescription,
    PrescriptionItem,
    RemoteMonitoring,
    User,
    Vital,
)


def _full_name(user):
    if not user:
        return None
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.username


def _fmt_dt(dt):
    if not dt:
        return None
    local_dt = timezone.localtime(dt)
    return local_dt.strftime("%a, %d %b %Y at %I:%M %p")


def _fmt_date(d):
    if not d:
        return None
    return d.strftime("%d %b %Y")


def _compute_remaining_doses(item, now_dt):
    """Compute remaining daily slots, remaining days, and total remaining doses for a PrescriptionItem."""
    today = now_dt.date()
    local_now = timezone.localtime(now_dt)

    slots = []
    if item.morning:
        slots.append(("Morning", 8))
    if item.afternoon:
        slots.append(("Afternoon", 14))
    if item.evening:
        slots.append(("Evening", 20))

    doses_per_day = max(len(slots), 1)
    start_date = timezone.localtime(item.prescription.created_at).date()
    end_date = item.active_until or (start_date + timedelta(days=max((item.duration or 1) - 1, 0)))

    if item.status != "active" or today > end_date:
        return {
            "remaining_days": 0,
            "remaining_today_slots": [],
            "remaining_total_doses": 0,
            "end_date": _fmt_date(end_date),
            "slots": [s[0] for s in slots] or ["As directed"],
        }

    remaining_days = (end_date - today).days + 1
    if item.administered:
        remaining_today_slots = []
    elif slots:
        remaining_today_slots = [label for label, hour in slots if hour > local_now.hour]
        # If past evening slot today, no slots remain today unless not administered yet
    else:
        remaining_today_slots = ["As directed"]

    future_days = max(remaining_days - 1, 0)
    remaining_total = len(remaining_today_slots) + (future_days * doses_per_day)

    return {
        "remaining_days": remaining_days,
        "remaining_today_slots": remaining_today_slots,
        "remaining_total_doses": remaining_total,
        "end_date": _fmt_date(end_date),
        "slots": [s[0] for s in slots] or ["As directed"],
    }


def _build_patient_context(user):
    now_dt = timezone.now()
    today = now_dt.date()

    profile = PatientProfile.objects.filter(user=user).first()
    appointments = list(
        Appointment.objects.filter(patient=user)
        .select_related("assigned_doctor", "assigned_nurse", "consultation")
        .order_by("-date_time")[:20]
    )
    upcoming_appts = [
        a for a in appointments
        if a.date_time >= now_dt and a.status not in ("cancelled", "rejected", "completed")
    ]
    upcoming_appts.sort(key=lambda a: a.date_time)

    prescriptions = list(
        Prescription.objects.filter(consultation__appointment__patient=user)
        .select_related("consultation__doctor", "consultation__appointment")
        .prefetch_related("items")
        .order_by("-created_at")[:15]
    )

    active_items = []
    past_items = []
    for rx in prescriptions:
        doc_name = _full_name(rx.consultation.doctor)
        for item in rx.items.all():
            dose_info = _compute_remaining_doses(item, now_dt)
            entry = {
                "id": item.id,
                "medicine": item.medicine_name,
                "dosage": item.dosage,
                "frequency": item.frequency,
                "route": item.route or "Oral",
                "instructions": item.instructions or "Take as directed",
                "duration_days": item.duration,
                "status": item.status,
                "prescribed_by": doc_name,
                "prescribed_on": _fmt_date(timezone.localtime(rx.created_at).date()),
                "active_until": dose_info["end_date"],
                "administered": item.administered,
                "remaining_days": dose_info["remaining_days"],
                "remaining_today_slots": dose_info["remaining_today_slots"],
                "remaining_total_doses": dose_info["remaining_total_doses"],
            }
            if item.status == "active" and dose_info["remaining_days"] > 0:
                active_items.append(entry)
            else:
                past_items.append(entry)

    inpatient_pending_doses = list(
        MedicationSchedule.objects.filter(
            medication_item__order__admission__patient=user,
            medication_item__order__admission__status="admitted",
            status__in=["scheduled", "due", "overdue"],
        )
        .select_related("medication_item")
        .order_by("scheduled_time")[:20]
    )

    vitals = list(
        Vital.objects.filter(patient=user)
        .select_related("recorded_by")
        .order_by("-created_at")[:10]
    )

    admission = (
        Admission.objects.filter(patient=user, status="admitted")
        .select_related("admitting_doctor", "assigned_nurse")
        .order_by("-admitted_at")
        .first()
    )

    remote_monitoring = (
        RemoteMonitoring.objects.filter(patient=user, active=True)
        .select_related("assigned_doctor")
        .first()
    )

    return {
        "role": "patient",
        "generated_at": _fmt_dt(now_dt),
        "user": {
            "name": _full_name(user),
            "username": user.username,
            "blood_group": profile.blood_group if profile else None,
            "gender": profile.gender if profile else None,
            "date_of_birth": _fmt_date(profile.date_of_birth) if profile and profile.date_of_birth else None,
            "contact": profile.contact_number if profile else None,
        },
        "summary": {
            "active_prescriptions": len(active_items),
            "remaining_doses_total": sum(i["remaining_total_doses"] for i in active_items) + len(inpatient_pending_doses),
            "upcoming_appointments": len(upcoming_appts),
            "next_appointment": _fmt_dt(upcoming_appts[0].date_time) if upcoming_appts else None,
        },
        "upcoming_appointments": [
            {
                "id": a.id,
                "date_time": _fmt_dt(a.date_time),
                "reason": a.reason,
                "status": a.status,
                "urgency": a.urgency,
                "doctor": _full_name(a.assigned_doctor) or "Pending assignment",
                "nurse": _full_name(a.assigned_nurse),
            }
            for a in upcoming_appts
        ],
        "recent_appointments": [
            {
                "id": a.id,
                "date_time": _fmt_dt(a.date_time),
                "reason": a.reason,
                "status": a.status,
                "doctor": _full_name(a.assigned_doctor) or "Unassigned",
                "diagnosis": a.consultation.diagnosis if hasattr(a, "consultation") else None,
                "treatment_plan": a.consultation.treatment_plan if hasattr(a, "consultation") else None,
                "lab_results": a.consultation.lab_results if hasattr(a, "consultation") else None,
                "follow_up_notes": a.consultation.follow_up_notes if hasattr(a, "consultation") else None,
            }
            for a in appointments[:8]
        ],
        "active_prescriptions": active_items,
        "past_prescriptions": past_items[:10],
        "inpatient_remaining_doses": [
            {
                "medicine": s.medication_item.medicine_name,
                "dosage": s.medication_item.dosage,
                "route": s.medication_item.route,
                "scheduled_time": _fmt_dt(s.scheduled_time),
                "status": s.status,
            }
            for s in inpatient_pending_doses
        ],
        "recent_vitals": [
            {
                "recorded_at": _fmt_dt(v.created_at),
                "blood_pressure": v.blood_pressure,
                "heart_rate": v.heart_rate,
                "temperature": v.temperature,
                "weight": v.weight,
                "symptoms": v.symptoms,
                "status": v.status,
                "doctor_feedback": v.doctor_feedback,
            }
            for v in vitals[:5]
        ],
        "admission": (
            {
                "ward": admission.ward,
                "bed_number": admission.bed_number,
                "doctor": _full_name(admission.admitting_doctor),
                "nurse": _full_name(admission.assigned_nurse),
                "admitted_at": _fmt_dt(admission.admitted_at),
                "notes": admission.notes,
            }
            if admission
            else None
        ),
        "remote_monitoring": (
            {
                "active": True,
                "doctor": _full_name(remote_monitoring.assigned_doctor),
                "notes": remote_monitoring.notes,
            }
            if remote_monitoring
            else None
        ),
    }


def _build_nurse_context(user):
    now_dt = timezone.now()
    queue = list(
        Appointment.objects.filter(status__in=["pending", "approved", "in_progress"])
        .select_related("patient", "assigned_doctor")
        .order_by("date_time")[:20]
    )
    tasks = list(
        NurseTask.objects.filter(status__in=["pending", "in_progress"])
        .select_related("appointment__patient", "doctor")
        .order_by("-priority", "created_at")[:20]
    )
    unadministered_rx = list(
        PrescriptionItem.objects.filter(administered=False, status="active")
        .select_related("prescription__consultation__appointment__patient")
        .order_by("id")[:20]
    )
    med_schedules = list(
        MedicationSchedule.objects.filter(status__in=["due", "overdue", "scheduled"])
        .select_related("medication_item__order__admission__patient")
        .order_by("scheduled_time")[:25]
    )
    admissions = list(
        Admission.objects.filter(status="admitted")
        .select_related("patient", "admitting_doctor", "assigned_nurse")
        .order_by("-admitted_at")[:15]
    )
    recent_vitals = list(
        Vital.objects.select_related("patient", "recorded_by")
        .order_by("-created_at")[:10]
    )

    return {
        "role": "nurse",
        "generated_at": _fmt_dt(now_dt),
        "user": {"name": _full_name(user), "username": user.username},
        "summary": {
            "queue_count": len(queue),
            "pending_tasks": len(tasks),
            "pending_medications": len(unadministered_rx) + len(med_schedules),
            "admitted_patients": len(admissions),
        },
        "queue": [
            {
                "id": a.id,
                "patient": _full_name(a.patient),
                "patient_username": a.patient.username,
                "date_time": _fmt_dt(a.date_time),
                "reason": a.reason,
                "status": a.status,
                "urgency": a.urgency,
                "doctor": _full_name(a.assigned_doctor) or "Unassigned",
            }
            for a in queue
        ],
        "tasks": [
            {
                "id": t.id,
                "patient": _full_name(t.appointment.patient),
                "task_type": t.task_type,
                "priority": t.priority,
                "status": t.status,
                "details": t.details,
                "doctor": _full_name(t.doctor),
            }
            for t in tasks
        ],
        "unadministered_prescriptions": [
            {
                "id": p.id,
                "patient": _full_name(p.prescription.consultation.appointment.patient),
                "medicine": p.medicine_name,
                "dosage": p.dosage,
                "frequency": p.frequency,
                "route": p.route,
            }
            for p in unadministered_rx
        ],
        "inpatient_med_schedules": [
            {
                "id": s.id,
                "patient": _full_name(s.medication_item.order.admission.patient),
                "ward": s.medication_item.order.admission.ward,
                "bed": s.medication_item.order.admission.bed_number,
                "medicine": s.medication_item.medicine_name,
                "dosage": s.medication_item.dosage,
                "scheduled_time": _fmt_dt(s.scheduled_time),
                "status": s.status,
            }
            for s in med_schedules
        ],
        "admissions": [
            {
                "patient": _full_name(ad.patient),
                "ward": ad.ward,
                "bed": ad.bed_number,
                "doctor": _full_name(ad.admitting_doctor),
                "nurse": _full_name(ad.assigned_nurse),
            }
            for ad in admissions
        ],
        "recent_vitals": [
            {
                "patient": _full_name(v.patient),
                "bp": v.blood_pressure,
                "hr": v.heart_rate,
                "temp": v.temperature,
                "recorded_at": _fmt_dt(v.created_at),
            }
            for v in recent_vitals
        ],
    }


def _build_doctor_context(user):
    now_dt = timezone.now()
    today = now_dt.date()
    t_start = timezone.make_aware(datetime.combine(today, dtime.min))
    t_end = timezone.make_aware(datetime.combine(today, dtime.max))

    my_appts = list(
        Appointment.objects.filter(assigned_doctor=user)
        .select_related("patient", "assigned_nurse", "consultation")
        .order_by("date_time")[:30]
    )
    todays = [a for a in my_appts if t_start <= a.date_time <= t_end]
    upcoming = [
        a for a in my_appts
        if a.date_time >= now_dt and a.status not in ("completed", "cancelled", "rejected")
    ]
    pending_approval = [a for a in my_appts if a.status == "pending_approval"]

    pending_vitals = list(
        Vital.objects.filter(assigned_to=user, status="pending")
        .select_related("patient")
        .order_by("-created_at")[:15]
    )
    admissions = list(
        Admission.objects.filter(status="admitted")
        .filter(Q(admitting_doctor=user) | Q(orders__doctor=user))
        .distinct()
        .select_related("patient", "assigned_nurse")[:15]
    )
    remote_patients = list(
        RemoteMonitoring.objects.filter(assigned_doctor=user, active=True)
        .select_related("patient")[:15]
    )
    recent_rx = list(
        PrescriptionItem.objects.filter(prescription__consultation__doctor=user, status="active")
        .select_related("prescription__consultation__appointment__patient")
        .order_by("-id")[:15]
    )

    return {
        "role": "doctor",
        "generated_at": _fmt_dt(now_dt),
        "user": {"name": _full_name(user), "username": user.username},
        "summary": {
            "appointments_today": len(todays),
            "upcoming_appointments": len(upcoming),
            "pending_approvals": len(pending_approval),
            "vitals_pending_review": len(pending_vitals),
            "active_inpatients": len(admissions),
            "remote_patients": len(remote_patients),
        },
        "upcoming_appointments": [
            {
                "id": a.id,
                "patient": _full_name(a.patient),
                "patient_username": a.patient.username,
                "date_time": _fmt_dt(a.date_time),
                "reason": a.reason,
                "status": a.status,
                "urgency": a.urgency,
                "nurse": _full_name(a.assigned_nurse),
            }
            for a in upcoming[:15]
        ],
        "pending_approvals": [
            {
                "id": a.id,
                "patient": _full_name(a.patient),
                "date_time": _fmt_dt(a.date_time),
                "reason": a.reason,
                "urgency": a.urgency,
            }
            for a in pending_approval
        ],
        "pending_vitals": [
            {
                "id": v.id,
                "patient": _full_name(v.patient),
                "bp": v.blood_pressure,
                "hr": v.heart_rate,
                "temp": v.temperature,
                "symptoms": v.symptoms,
                "recorded_at": _fmt_dt(v.created_at),
            }
            for v in pending_vitals
        ],
        "admissions": [
            {
                "patient": _full_name(ad.patient),
                "ward": ad.ward,
                "bed": ad.bed_number,
                "nurse": _full_name(ad.assigned_nurse),
                "notes": ad.notes,
            }
            for ad in admissions
        ],
        "remote_patients": [
            {"patient": _full_name(r.patient), "notes": r.notes}
            for r in remote_patients
        ],
        "recent_active_prescriptions": [
            {
                "patient": _full_name(p.prescription.consultation.appointment.patient),
                "medicine": p.medicine_name,
                "dosage": p.dosage,
                "frequency": p.frequency,
                "duration": p.duration,
            }
            for p in recent_rx
        ],
    }


def _build_admin_context(user):
    now_dt = timezone.now()
    today = now_dt.date()
    today_start = timezone.make_aware(datetime.combine(today, dtime.min))
    today_end = timezone.make_aware(datetime.combine(today, dtime.max))

    role_counts = {
        row["role"]: row["count"]
        for row in User.objects.values("role").annotate(count=Count("id"))
    }
    appt_agg = Appointment.objects.aggregate(
        total=Count("id"),
        today=Count("id", filter=Q(date_time__gte=today_start, date_time__lte=today_end)),
        pending=Count("id", filter=Q(status="pending")),
        pending_approval=Count("id", filter=Q(status="pending_approval")),
        unassigned=Count("id", filter=Q(assigned_doctor__isnull=True, status__in=["pending", "approved"])),
    )

    doctors_list = []
    for doc in User.objects.filter(role="doctor").select_related("doctor_profile"):
        dp = getattr(doc, "doctor_profile", None)
        doctors_list.append({
            "name": _full_name(doc),
            "specialization": (dp.specialization if dp and dp.specialization else "General"),
            "department": (dp.department if dp and dp.department else "General"),
            "is_on_duty": bool(dp.is_on_duty) if dp else False,
        })
    nurses_list = []
    for nrs in User.objects.filter(role="nurse").select_related("nurse_profile"):
        np = getattr(nrs, "nurse_profile", None)
        nurses_list.append({
            "name": _full_name(nrs),
            "department": (np.department if np and np.department else "General"),
            "is_on_duty": bool(np.is_on_duty) if np else False,
        })
    doctors_on_duty = [d["name"] for d in doctors_list if d["is_on_duty"]]
    nurses_on_duty = [n["name"] for n in nurses_list if n["is_on_duty"]]

    upcoming_appts = list(
        Appointment.objects.filter(date_time__gte=now_dt)
        .exclude(status__in=["cancelled", "rejected", "completed"])
        .select_related("patient", "assigned_doctor", "assigned_nurse")
        .order_by("date_time")[:15]
    )
    pending_appts = list(
        Appointment.objects.filter(status__in=["pending", "pending_approval"])
        .select_related("patient", "assigned_doctor")
        .order_by("date_time")[:15]
    )
    admissions = list(
        Admission.objects.filter(status="admitted")
        .select_related("patient", "admitting_doctor", "assigned_nurse")
        .order_by("-admitted_at")[:15]
    )
    pending_orders = InpatientOrder.objects.filter(status="pending_review").count()
    remote_count = RemoteMonitoring.objects.filter(active=True).count()
    recent_logs = list(
        AuditLog.objects.select_related("actor", "patient").order_by("-timestamp")[:10]
    )

    return {
        "role": "admin",
        "generated_at": _fmt_dt(now_dt),
        "user": {"name": _full_name(user), "username": user.username},
        "summary": {
            "total_patients": role_counts.get("patient", 0),
            "total_doctors": role_counts.get("doctor", 0),
            "total_nurses": role_counts.get("nurse", 0),
            "appointments_today": appt_agg["today"],
            "pending_appointments": appt_agg["pending"] + appt_agg["pending_approval"],
            "unassigned_appointments": appt_agg["unassigned"],
            "active_admissions": len(admissions),
            "pending_inpatient_orders": pending_orders,
            "remote_monitoring_patients": remote_count,
        },
        "staff_on_duty": {
            "doctors": doctors_on_duty,
            "nurses": nurses_on_duty,
        },
        "staff_directory": {
            "doctors": doctors_list,
            "nurses": nurses_list,
        },
        "upcoming_appointments": [
            {
                "id": a.id,
                "patient": _full_name(a.patient),
                "date_time": _fmt_dt(a.date_time),
                "status": a.status,
                "urgency": a.urgency,
                "doctor": _full_name(a.assigned_doctor) or "Unassigned",
                "reason": a.reason,
            }
            for a in upcoming_appts
        ],
        "pending_appointments": [
            {
                "id": a.id,
                "patient": _full_name(a.patient),
                "date_time": _fmt_dt(a.date_time),
                "status": a.status,
                "doctor": _full_name(a.assigned_doctor) or "Unassigned",
                "reason": a.reason,
            }
            for a in pending_appts
        ],
        "admissions": [
            {
                "patient": _full_name(ad.patient),
                "ward": ad.ward,
                "bed": ad.bed_number,
                "doctor": _full_name(ad.admitting_doctor),
                "nurse": _full_name(ad.assigned_nurse),
            }
            for ad in admissions
        ],
        "recent_audit_logs": [
            {
                "action": log.action,
                "actor": _full_name(log.actor) or "System",
                "patient": _full_name(log.patient),
                "timestamp": _fmt_dt(log.timestamp),
            }
            for log in recent_logs
        ],
    }


def build_live_context(user):
    """Build a fresh, role-scoped snapshot directly from the database."""
    if user.role == "patient":
        return _build_patient_context(user)
    if user.role == "nurse":
        return _build_nurse_context(user)
    if user.role == "doctor":
        return _build_doctor_context(user)
    if user.role == "admin":
        return _build_admin_context(user)
    return {"role": user.role, "generated_at": _fmt_dt(timezone.now()), "summary": {}}


def get_role_suggestions(role):
    if role == "patient":
        return [
            "What are my active prescriptions and remaining doses?",
            "When is my next appointment?",
            "Show my latest vitals and doctor feedback",
            "Give me a full summary of my care",
        ]
    if role == "nurse":
        return [
            "Which medications or doses are due now?",
            "Show the current patient queue",
            "What nurse tasks are pending?",
            "Who is currently admitted?",
        ]
    if role == "doctor":
        return [
            "What appointments and approvals do I have?",
            "Which vitals are waiting for my review?",
            "Show my admitted and remote patients",
            "What prescriptions did I issue recently?",
        ]
    return [
        "Give me today's hospital overview",
        "Which appointments are pending or unassigned?",
        "Which doctors and nurses are on duty?",
        "Show current admissions and recent activity",
    ]


_SHORTHAND_MAP = {
    "mny": "many",
    "mni": "many",
    "dctr": "doctor",
    "dctrs": "doctors",
    "dctor": "doctor",
    "dctors": "doctors",
    "doc": "doctor",
    "docs": "doctors",
    "dr": "doctor",
    "drs": "doctors",
    "nrs": "nurse",
    "nrses": "nurses",
    "pt": "patient",
    "pts": "patients",
    "rx": "prescriptions",
    "med": "medicine",
    "meds": "medicines",
    "appt": "appointment",
    "appts": "appointments",
    "app": "appointment",
    "gm": "good morning",
    "ga": "good afternoon",
    "ge": "good evening",
    "hw": "how",
    "u": "you",
    "r": "are",
    "ur": "your",
    "pls": "please",
    "plz": "please",
    "thx": "thanks",
    "ty": "thank you",
    "info": "information",
    "abt": "about",
    "wht": "what",
    "whn": "when",
    "whr": "where",
    "hv": "have",
    "cnt": "count",
}

_DOMAIN_VOCAB = [
    "many", "doctor", "doctors", "nurse", "nurses", "patient", "patients",
    "prescription", "prescriptions", "medicine", "medicines", "medication", "medications",
    "dose", "doses", "remaining", "schedule", "appointment", "appointments",
    "vital", "vitals", "pressure", "temperature", "heart", "weight", "feedback",
    "admission", "admissions", "admitted", "ward", "inpatient", "remote", "monitoring",
    "consultation", "diagnosis", "treatment", "queue", "task", "tasks",
    "duty", "available", "pending", "approval", "approvals", "unassigned",
    "overview", "summary", "audit", "report", "morning", "afternoon", "evening",
    "hello", "thanks", "today", "tomorrow", "history", "staff",
]


def _normalize_question(text):
    """Expand common chat shorthand and fix typos using fuzzy matching."""
    cleaned = re.sub(r"[^\w\s'?/-]", " ", (text or "").lower())
    tokens = cleaned.split()
    out = []
    for tok in tokens:
        if tok in _SHORTHAND_MAP:
            out.extend(_SHORTHAND_MAP[tok].split())
            continue
        if len(tok) >= 4 and tok not in _DOMAIN_VOCAB:
            match = difflib.get_close_matches(tok, _DOMAIN_VOCAB, n=1, cutoff=0.72)
            if match:
                out.append(match[0])
                continue
        out.append(tok)
    return " ".join(out)


def _time_greeting():
    hour = timezone.localtime(timezone.now()).hour
    if hour < 12:
        return "Good morning"
    if hour < 17:
        return "Good afternoon"
    return "Good evening"


def _has_domain_intent(norm_q, role):
    domain_keywords = {
        "doctor", "doctors", "nurse", "nurses", "patient", "patients",
        "prescription", "prescriptions", "medicine", "medicines", "medication", "medications",
        "dose", "doses", "remaining", "schedule", "appointment", "appointments",
        "vital", "vitals", "bp", "pressure", "temperature", "heart", "weight", "feedback",
        "admission", "admissions", "admitted", "ward", "bed", "inpatient", "remote", "monitoring",
        "consultation", "diagnosis", "treatment", "queue", "task", "tasks",
        "duty", "pending", "approval", "approvals", "unassigned",
        "overview", "summary", "audit", "report", "staff", "count", "how many", "who is", "who are",
        "when", "drug", "pill", "tablet", "history", "record", "records", "order", "orders",
    }
    words = set(norm_q.split())
    if words & domain_keywords:
        return True
    return any(phrase in norm_q for phrase in ("how many", "who is", "who are", "blood pressure", "what is my", "check my"))


def _handle_conversation_and_chitchat(ctx, raw_q, norm_q, has_patient_ref=False):
    """
    Handle natural greetings, small talk, thanks, and capability questions.
    Returns (direct_reply, greeting_prefix):
      - If direct_reply is not None, return it immediately as a conversational answer.
      - If greeting_prefix is not None, prepend it to the live-data answer.
    """
    name = (ctx.get("user") or {}).get("name") or "there"
    first_name = name.split()[0]
    role = ctx["role"]
    if "good morning" in norm_q:
        time_greet = "Good morning"
    elif "good afternoon" in norm_q:
        time_greet = "Good afternoon"
    elif "good evening" in norm_q:
        time_greet = "Good evening"
    else:
        time_greet = _time_greeting()

    has_greeting = any(
        re.search(rf"\b{re.escape(g)}\b", norm_q)
        for g in ("good morning", "good afternoon", "good evening", "hello", "hi", "hey", "hola", "sasa", "habari", "mambo")
    )
    asks_wellbeing = any(
        phrase in norm_q
        for phrase in ("how are you", "how are things", "how is it going", "how are you doing", "whats up", "what is up", "how do you do")
    )
    asks_identity = any(
        phrase in norm_q
        for phrase in ("who are you", "what are you", "what can you do", "help me", "how do you work")
    )
    says_thanks = any(
        re.search(rf"\b{re.escape(t)}\b", norm_q)
        for t in ("thanks", "thank you", "appreciate", "grateful")
    )
    says_bye = any(
        re.search(rf"\b{re.escape(b)}\b", norm_q)
        for b in ("bye", "goodbye", "see you", "good night")
    )
    simple_ack = norm_q.strip() in {"ok", "okay", "cool", "great", "nice", "alright", "fine", "good"}

    has_domain = has_patient_ref or _has_domain_intent(norm_q, role)

    role_hint = {
        "patient": "your prescriptions, remaining doses, upcoming appointments, vitals, or doctor feedback",
        "nurse": "the nursing queue, pending tasks, due medications, or admitted patients",
        "doctor": "your schedule, pending approvals, vitals for review, inpatients, or a specific patient's chart",
        "admin": "hospital counts (doctors, nurses, patients), staff on duty, pending appointments, admissions, or audit logs",
    }.get(role, "your hospital records")

    if not has_domain:
        if says_bye:
            return f"Goodbye, **{first_name}**! Have a great rest of your day—I'm here whenever you need live HosiKe updates.", None
        if says_thanks:
            return f"You're very welcome, **{first_name}**! Let me know anytime if you want to check {role_hint}.", None
        if asks_identity or norm_q.strip() == "help":
            return (
                f"I'm **HosiKe AI**, your live hospital assistant connected directly to the HosiKe database.\n\n"
                f"Because you're signed in as **{role}**, you can naturally ask me things about {role_hint}—even casually or with typos!"
            ), None
        if asks_wellbeing:
            greet = f"{time_greet}, **{first_name}**! " if has_greeting else f"Hello **{first_name}**! "
            return (
                f"{greet}I'm doing great and synced with your live HosiKe records (`{ctx['generated_at']}`). "
                f"How can I help you today? You can ask about {role_hint}."
            ), None
        if has_greeting:
            return (
                f"{time_greet}, **{first_name}**! Hope you're having a good one. "
                f"What would you like to check today—{role_hint}?"
            ), None
        if simple_ack:
            return f"Got it, **{first_name}**! Just ask whenever you'd like me to check {role_hint}.", None

    # User combined a greeting/well-being with a real data question
    prefix_parts = []
    if has_greeting:
        prefix_parts.append(f"{time_greet}, **{first_name}**!")
    if asks_wellbeing:
        prefix_parts.append("I'm doing great, thanks for asking!")
    if says_thanks:
        prefix_parts.append("You're welcome!")
    prefix = (" ".join(prefix_parts) + " ") if prefix_parts else ""
    return None, prefix


def _lookup_patient_for_staff(query_text, history=None):
    """Allow doctors/nurses/admins to ask about a specific patient by username or name (including follow-up pronouns)."""
    patients = list(User.objects.filter(role="patient").select_related("patient_profile"))

    def _find_in_text(text):
        q = (text or "").lower()
        for p in patients:
            tokens = [t.lower() for t in (p.username, p.first_name, p.last_name, _full_name(p)) if t]
            if any(re.search(rf"\b{re.escape(tok)}\b", q) for tok in tokens):
                return p
        return None

    matched = _find_in_text(query_text)
    if matched:
        return _build_patient_context(matched)

    # Check if user is asking a follow-up question referencing previous turn ("his vitals", "their meds")
    q_lower = (query_text or "").lower()
    if history and any(re.search(rf"\b{p}\b", q_lower) for p in ("his", "her", "their", "them", "he", "she", "that patient")):
        for msg in reversed(history):
            matched = _find_in_text(msg.get("text", ""))
            if matched:
                return _build_patient_context(matched)
    return None


def _format_patient_reply(ctx, raw_q, norm_q):
    name = ctx["user"]["name"]
    matched_sections = []

    asks_rx = any(k in norm_q for k in ("prescription", "prescriptions", "medicine", "medicines", "medication", "medications", "drug", "pill", "tablet", "syrup"))
    asks_dose = any(k in norm_q for k in ("dose", "doses", "remaining", "left", "schedule", "take", "today", "due"))
    asks_appt = any(k in norm_q for k in ("appointment", "appointments", "date", "time", "when", "visit", "doctor", "next"))
    asks_vital = any(k in norm_q for k in ("vital", "vitals", "bp", "blood pressure", "temperature", "heart", "weight", "feedback", "symptom"))
    asks_adm = any(k in norm_q for k in ("admission", "admissions", "admitted", "ward", "bed", "inpatient", "remote", "monitoring", "history", "diagnosis", "treatment"))
    asks_all = any(k in norm_q for k in ("all", "summary", "everything", "overview", "status", "full", "information", "profile"))

    if asks_rx or asks_dose or asks_all:
        active = ctx["active_prescriptions"]
        inpatient_doses = ctx["inpatient_remaining_doses"]
        lines = ["**Active Prescriptions & Remaining Doses:**"]
        if active:
            for i in active:
                today_slots = ", ".join(i["remaining_today_slots"]) if i["remaining_today_slots"] else "None left today"
                lines.append(
                    f"- **{i['medicine']}** ({i['dosage']}, {i['route']}) — {i['frequency']} | "
                    f"**{i['remaining_total_doses']} dose(s) remaining** over **{i['remaining_days']} day(s)** "
                    f"(until {i['active_until']}). Today remaining: {today_slots}. "
                    f"Instructions: {i['instructions']} (Dr. {i['prescribed_by']})"
                )
        elif not inpatient_doses:
            lines.append("- No active outpatient prescriptions found right now.")
        past = ctx.get("past_prescriptions") or []
        if past and (not active or any(k in norm_q for k in ("past", "history", "previous", "old", "all"))):
            lines.append("**Recent / Past Prescriptions:**")
            for p in past[:5]:
                lines.append(
                    f"- **{p['medicine']}** ({p['dosage']}, {p['route']}) — {p['frequency']} | "
                    f"Status: `{p['status']}` | Ended/Until: {p['active_until']} (Dr. {p['prescribed_by']})"
                )
        if inpatient_doses:
            lines.append("**Scheduled Inpatient Doses Remaining:**")
            for d in inpatient_doses:
                lines.append(f"- **{d['medicine']}** ({d['dosage']}, {d['route']}) — {d['scheduled_time']} [{d['status']}]")
        matched_sections.append("\n".join(lines))

    if asks_appt or asks_all:
        upcoming = ctx["upcoming_appointments"]
        recent = ctx["recent_appointments"]
        lines = ["**Appointments:**"]
        if upcoming:
            for a in upcoming:
                lines.append(
                    f"- **{a['date_time']}** — {a['reason']} | Doctor: {a['doctor']} | "
                    f"Status: `{a['status']}` | Urgency: `{a['urgency']}`"
                )
        else:
            lines.append("- No upcoming appointments scheduled.")
            if recent:
                lines.append("Recent appointments:")
                for a in recent[:3]:
                    diag = f" | Diagnosis: {a['diagnosis']}" if a.get("diagnosis") else ""
                    lines.append(f"  - {a['date_time']} — {a['reason']} (`{a['status']}`, Dr. {a['doctor']}){diag}")
        matched_sections.append("\n".join(lines))

    if asks_vital or asks_all:
        vitals = ctx["recent_vitals"]
        lines = ["**Latest Vitals & Doctor Feedback:**"]
        if vitals:
            for v in vitals[:3]:
                fb = f" | Feedback: {v['doctor_feedback']}" if v.get("doctor_feedback") else ""
                lines.append(
                    f"- {v['recorded_at']}: BP `{v['blood_pressure'] or '—'}`, "
                    f"HR `{v['heart_rate'] or '—'} bpm`, Temp `{v['temperature'] or '—'} °C`, "
                    f"Weight `{v['weight'] or '—'} kg` [{v['status']}]{fb}"
                )
        else:
            lines.append("- No vitals recorded yet.")
        matched_sections.append("\n".join(lines))

    if asks_adm or asks_all:
        lines = []
        if ctx["admission"]:
            ad = ctx["admission"]
            lines.append(
                f"**Current Admission:** Ward **{ad['ward']}**, Bed `{ad['bed_number'] or '—'}` | "
                f"Doctor: {ad['doctor'] or '—'} | Nurse: {ad['nurse'] or '—'} (since {ad['admitted_at']})"
            )
        if ctx["remote_monitoring"]:
            rm = ctx["remote_monitoring"]
            lines.append(f"**Remote Monitoring:** Active (Doctor: {rm['doctor'] or '—'})")
        consultations = [a for a in ctx["recent_appointments"] if a.get("diagnosis") or a.get("treatment_plan")]
        if consultations:
            lines.append("**Recent Consultations:**")
            for c in consultations[:3]:
                lines.append(
                    f"- {c['date_time']} (Dr. {c['doctor']}): Diagnosis: {c['diagnosis'] or '—'} | "
                    f"Plan: {c['treatment_plan'] or '—'}"
                )
        if lines:
            matched_sections.append("\n".join(lines))

    if not matched_sections:
        return (
            f"I didn't quite catch which specific record you meant, **{name.split()[0]}**, "
            f"so here is your live care summary (synced {ctx['generated_at']}):\n\n"
            + _format_patient_reply(ctx, "summary", "summary").split("\n\n", 1)[-1]
        )

    header = f"Here is the live care info for **{name}** (synced {ctx['generated_at']}):\n\n"
    return header + "\n\n".join(matched_sections)


def _format_admin_targeted(ctx, norm_q):
    """Answer targeted natural-language admin questions directly instead of dumping everything."""
    s = ctx["summary"]
    directory = ctx.get("staff_directory", {})
    docs = directory.get("doctors", [])
    nurses = directory.get("nurses", [])

    asks_count_or_list = any(
        p in norm_q for p in ("how many", "count", "number of", "total", "who are", "list", "which", "any")
    )
    asks_doctor = any(w in norm_q.split() for w in ("doctor", "doctors"))
    asks_nurse = any(w in norm_q.split() for w in ("nurse", "nurses"))
    asks_patient = any(w in norm_q.split() for w in ("patient", "patients"))
    asks_duty = "duty" in norm_q or "available" in norm_q

    if asks_count_or_list and (asks_doctor or asks_nurse or asks_patient) and not any(
        k in norm_q for k in ("overview", "summary", "everything", "all", "report")
    ):
        parts = []
        if asks_doctor:
            on_duty_count = len(ctx["staff_on_duty"]["doctors"])
            lines = [f"We currently have **{s['total_doctors']} doctor(s)** in HosiKe (**{on_duty_count}** marked on duty):"]
            for d in docs:
                duty_tag = "On Duty" if d["is_on_duty"] else "Off Duty"
                lines.append(f"- **Dr. {d['name']}** — {d['department']} ({d['specialization']}) [`{duty_tag}`]")
            parts.append("\n".join(lines))
        if asks_nurse:
            on_duty_count = len(ctx["staff_on_duty"]["nurses"])
            lines = [f"We currently have **{s['total_nurses']} nurse(s)** in HosiKe (**{on_duty_count}** marked on duty):"]
            for n in nurses:
                duty_tag = "On Duty" if n["is_on_duty"] else "Off Duty"
                lines.append(f"- **{n['name']}** — {n['department']} [`{duty_tag}`]")
            parts.append("\n".join(lines))
        if asks_patient:
            parts.append(
                f"We currently have **{s['total_patients']} registered patient(s)** "
                f"(**{s['active_admissions']}** currently admitted, **{s['remote_monitoring_patients']}** on remote monitoring)."
            )
        if parts and not asks_duty:
            return "\n\n".join(parts)
    return None


def _format_staff_reply(ctx, raw_q, norm_q, history=None):
    role = ctx["role"]

    # Check if staff is asking about a specific patient by name/username (or follow-up pronoun)
    patient_ctx = _lookup_patient_for_staff(raw_q, history=history)
    if patient_ctx:
        return _format_patient_reply(patient_ctx, raw_q, norm_q)

    if role == "admin":
        targeted = _format_admin_targeted(ctx, norm_q)
        if targeted:
            return targeted

    sections = []
    asks_all = any(k in norm_q for k in ("all", "summary", "overview", "everything", "status", "brief"))

    if role == "nurse":
        if asks_all or any(k in norm_q for k in ("medicine", "medicines", "medication", "medications", "dose", "doses", "prescription", "prescriptions", "due", "overdue", "drug")):
            lines = ["**Pending Medications & Doses:**"]
            for s in ctx["inpatient_med_schedules"][:10]:
                lines.append(f"- **{s['patient']}** ({s['ward']} {s['bed']}): {s['medicine']} {s['dosage']} at {s['scheduled_time']} [`{s['status']}`]")
            for p in ctx["unadministered_prescriptions"][:10]:
                lines.append(f"- **{p['patient']}**: {p['medicine']} {p['dosage']} ({p['frequency']}) — unadministered")
            if len(lines) == 1:
                lines.append("- No pending medications right now.")
            sections.append("\n".join(lines))

        if asks_all or any(k in norm_q for k in ("queue", "appointment", "appointments", "patient", "patients", "waiting")):
            lines = ["**Current Nursing Queue:**"]
            for a in ctx["queue"][:10]:
                lines.append(f"- **{a['patient']}** — {a['date_time']} | {a['reason']} (`{a['status']}`, `{a['urgency']}`, Dr. {a['doctor']})")
            if len(lines) == 1:
                lines.append("- Queue is currently empty.")
            sections.append("\n".join(lines))

        if asks_all or any(k in norm_q for k in ("task", "tasks", "todo", "order", "orders")):
            lines = ["**Pending Nurse Tasks:**"]
            for t in ctx["tasks"][:10]:
                lines.append(f"- **{t['task_type']}** (`{t['priority']}`) for **{t['patient']}**: {t['details']} (Dr. {t['doctor']})")
            if len(lines) == 1:
                lines.append("- No pending tasks.")
            sections.append("\n".join(lines))

        if asks_all or any(k in norm_q for k in ("admission", "admissions", "admitted", "ward", "bed", "vital", "vitals")):
            lines = ["**Admitted Patients:**"]
            for ad in ctx["admissions"][:10]:
                lines.append(f"- **{ad['patient']}** — {ad['ward']} Bed `{ad['bed'] or '—'}` (Dr. {ad['doctor'] or '—'})")
            if len(lines) == 1:
                lines.append("- No active admissions.")
            sections.append("\n".join(lines))

    elif role == "doctor":
        if asks_all or any(k in norm_q for k in ("appointment", "appointments", "schedule", "approval", "approvals", "request", "today", "next")):
            lines = [f"**Appointments ({ctx['summary']['appointments_today']} today, {ctx['summary']['pending_approvals']} pending approval):**"]
            for a in ctx["upcoming_appointments"][:10]:
                lines.append(f"- **{a['date_time']}** — **{a['patient']}**: {a['reason']} (`{a['status']}`, `{a['urgency']}`)")
            if len(lines) == 1:
                lines.append("- No upcoming appointments assigned.")
            sections.append("\n".join(lines))

        if asks_all or any(k in norm_q for k in ("vital", "vitals", "review", "triage", "feedback")):
            lines = ["**Vitals Pending Your Review:**"]
            for v in ctx["pending_vitals"][:10]:
                lines.append(f"- **{v['patient']}** ({v['recorded_at']}): BP `{v['bp'] or '—'}`, HR `{v['hr'] or '—'}`, Temp `{v['temp'] or '—'}` — {v['symptoms'] or 'No symptoms noted'}")
            if len(lines) == 1:
                lines.append("- No vitals pending review.")
            sections.append("\n".join(lines))

        if asks_all or any(k in norm_q for k in ("admission", "admissions", "admitted", "inpatient", "remote", "monitoring")):
            lines = ["**Inpatients & Remote Monitoring:**"]
            for ad in ctx["admissions"][:10]:
                lines.append(f"- Inpatient: **{ad['patient']}** in {ad['ward']} Bed `{ad['bed'] or '—'}` (Nurse: {ad['nurse'] or '—'})")
            for r in ctx["remote_patients"][:10]:
                lines.append(f"- Remote Monitoring: **{r['patient']}** ({r['notes'] or 'Active'})")
            if len(lines) == 1:
                lines.append("- No active inpatients or remote patients assigned.")
            sections.append("\n".join(lines))

        if asks_all or any(k in norm_q for k in ("prescription", "prescriptions", "medicine", "medicines", "medication", "medications")):
            lines = ["**Recent Active Prescriptions Issued:**"]
            for p in ctx["recent_active_prescriptions"][:10]:
                lines.append(f"- **{p['patient']}**: {p['medicine']} {p['dosage']} ({p['frequency']}, {p['duration']}d)")
            if len(lines) == 1:
                lines.append("- No recent active prescriptions.")
            sections.append("\n".join(lines))

    elif role == "admin":
        s = ctx["summary"]
        if asks_all or any(k in norm_q for k in ("overview", "kpi", "report", "stat", "count", "how many", "patient", "patients")):
            sections.append(
                "**Hospital Live Overview:**\n"
                f"- Patients: **{s['total_patients']}** | Doctors: **{s['total_doctors']}** | Nurses: **{s['total_nurses']}**\n"
                f"- Appointments Today: **{s['appointments_today']}** | Pending: **{s['pending_appointments']}** | Unassigned: **{s['unassigned_appointments']}**\n"
                f"- Active Admissions: **{s['active_admissions']}** | Pending Inpatient Orders: **{s['pending_inpatient_orders']}** | Remote Monitoring: **{s['remote_monitoring_patients']}**"
            )

        if asks_all or any(k in norm_q for k in ("duty", "staff", "doctor", "doctors", "nurse", "nurses", "available")):
            docs = ", ".join(ctx["staff_on_duty"]["doctors"]) or "None marked on duty"
            nurses = ", ".join(ctx["staff_on_duty"]["nurses"]) or "None marked on duty"
            sections.append(f"**Staff On Duty:**\n- Doctors: {docs}\n- Nurses: {nurses}")

        if asks_all or any(k in norm_q for k in ("appointment", "appointments", "pending", "unassigned", "schedule")):
            lines = ["**Pending / Upcoming Appointments:**"]
            for a in (ctx["pending_appointments"] or ctx["upcoming_appointments"])[:10]:
                lines.append(f"- **{a['patient']}** — {a['date_time']} | {a['reason']} (`{a['status']}`, Doctor: {a['doctor']})")
            if len(lines) == 1:
                lines.append("- None right now.")
            sections.append("\n".join(lines))

        if asks_all or any(k in norm_q for k in ("admission", "admissions", "admitted", "ward", "audit", "activity", "log")):
            lines = ["**Active Admissions & Recent Audit Activity:**"]
            for ad in ctx["admissions"][:5]:
                lines.append(f"- Admitted: **{ad['patient']}** ({ad['ward']} Bed `{ad['bed'] or '—'}`, Dr. {ad['doctor'] or '—'})")
            for log in ctx["recent_audit_logs"][:5]:
                p_str = f" for {log['patient']}" if log.get("patient") else ""
                lines.append(f"- [{log['timestamp']}] {log['actor']} → `{log['action']}`{p_str}")
            sections.append("\n".join(lines))

    if not sections:
        return _format_staff_reply(ctx, "overview summary", "overview summary", history=history)

    return f"Live **{role}** snapshot (synced {ctx['generated_at']}):\n\n" + "\n\n".join(sections)


def _build_llm_system_prompt(ctx, question, history):
    extra_patient = None
    if ctx["role"] in ("doctor", "nurse", "admin"):
        extra_patient = _lookup_patient_for_staff(question, history=history)

    system_text = (
        f"You are HosiKe AI, a warm, intelligent, conversational hospital assistant for a {ctx['role']} user.\n"
        "Respond naturally to human conversation, greetings, small talk, follow-ups, and typos.\n"
        "For any hospital facts, counts, prescriptions, doses, vitals, or dates, answer ONLY from the live database JSON below.\n"
        "If data is missing or empty, clearly say so—never invent medical records.\n\n"
        f"LIVE_CONTEXT:\n{json.dumps(ctx, default=str)}"
    )
    if extra_patient:
        system_text += f"\n\nMATCHED_PATIENT_CONTEXT:\n{json.dumps(extra_patient, default=str)}"
    return system_text


def _call_gemini_if_configured(ctx, question, history):
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    primary_model = os.environ.get("GEMINI_MODEL", "gemini-flash-lite-latest")
    models_to_try = [primary_model]
    if "gemini-flash-lite-latest" not in models_to_try:
        models_to_try.append("gemini-flash-lite-latest")
    if "gemini-flash-latest" not in models_to_try:
        models_to_try.append("gemini-flash-latest")
    system_text = _build_llm_system_prompt(ctx, question, history)

    contents = []
    for msg in (history or [])[-8:]:
        role_name = "user" if msg.get("role") == "user" else "model"
        text = (msg.get("text") or "").strip()
        if text:
            contents.append({"role": role_name, "parts": [{"text": text}]})
    contents.append({"role": "user", "parts": [{"text": question}]})

    payload = {
        "system_instruction": {"parts": [{"text": system_text}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 900},
    }
    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            resp = requests.post(url, json=payload, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates") or []
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts") or []
                    text = "".join(p.get("text", "") for p in parts).strip()
                    if text:
                        return text
            elif resp.status_code != 404:
                break
        except Exception:
            break
    return None


def _call_openai_compatible(url, api_key, model, ctx, question, history, headers=None):
    system_text = _build_llm_system_prompt(ctx, question, history)
    messages = [{"role": "system", "content": system_text}]
    for msg in (history or [])[-8:]:
        text = (msg.get("text") or "").strip()
        if text:
            messages.append({"role": "user" if msg.get("role") == "user" else "assistant", "content": text})
    messages.append({"role": "user", "content": question})

    req_headers = headers or {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        resp = requests.post(
            url,
            headers=req_headers,
            json={"model": model, "messages": messages, "temperature": 0.3, "max_tokens": 900},
            timeout=12,
        )
        if resp.status_code == 200:
            choices = resp.json().get("choices") or []
            if choices:
                text = (choices[0].get("message", {}).get("content") or "").strip()
                if text:
                    return text
    except Exception:
        return None
    return None


def _call_groq_if_configured(ctx, question, history):
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        return None
    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
    return _call_openai_compatible(
        "https://api.groq.com/openai/v1/chat/completions", api_key, model, ctx, question, history
    )


def _call_openai_if_configured(ctx, question, history):
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    return _call_openai_compatible(
        "https://api.openai.com/v1/chat/completions", api_key, model, ctx, question, history
    )


def _call_ollama_if_configured(ctx, question, history):
    model = os.environ.get("OLLAMA_MODEL", "").strip()
    if not model:
        return None
    url = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/chat").strip()
    system_text = _build_llm_system_prompt(ctx, question, history)
    messages = [{"role": "system", "content": system_text}]
    for msg in (history or [])[-8:]:
        text = (msg.get("text") or "").strip()
        if text:
            messages.append({"role": "user" if msg.get("role") == "user" else "assistant", "content": text})
    messages.append({"role": "user", "content": question})
    try:
        resp = requests.post(url, json={"model": model, "messages": messages, "stream": False}, timeout=15)
        if resp.status_code == 200:
            text = (resp.json().get("message", {}).get("content") or "").strip()
            if text:
                return text
    except Exception:
        return None
    return None


def generate_ai_reply(user, question, history=None):
    """Query fresh live database context and produce a conversational, role-scoped response."""
    ctx = build_live_context(user)
    clean_q = (question or "").strip() or "hello"

    for mode_name, fn in (
        ("gemini", _call_gemini_if_configured),
        ("groq", _call_groq_if_configured),
        ("openai", _call_openai_if_configured),
        ("ollama", _call_ollama_if_configured),
    ):
        llm_reply = fn(ctx, clean_q, history)
        if llm_reply:
            return {
                "reply": llm_reply,
                "mode": mode_name,
                "role": ctx["role"],
                "generated_at": ctx["generated_at"],
                "summary": ctx.get("summary", {}),
                "suggestions": get_role_suggestions(ctx["role"]),
            }

    norm_q = _normalize_question(clean_q)
    has_patient_ref = bool(
        ctx["role"] in ("doctor", "nurse", "admin")
        and _lookup_patient_for_staff(clean_q, history=history)
    )
    direct_chitchat, greeting_prefix = _handle_conversation_and_chitchat(
        ctx, clean_q, norm_q, has_patient_ref=has_patient_ref
    )
    if direct_chitchat is not None:
        reply = direct_chitchat
    else:
        if ctx["role"] == "patient":
            body = _format_patient_reply(ctx, clean_q, norm_q)
        else:
            body = _format_staff_reply(ctx, clean_q, norm_q, history=history)
        reply = f"{greeting_prefix}{body}" if greeting_prefix else body

    return {
        "reply": reply,
        "mode": "live-engine",
        "role": ctx["role"],
        "generated_at": ctx["generated_at"],
        "summary": ctx.get("summary", {}),
        "suggestions": get_role_suggestions(ctx["role"]),
    }
