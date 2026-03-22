from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = (
        ('patient', 'Patient'),
        ('doctor', 'Doctor'),
        ('nurse', 'Nurse'),
        ('admin', 'Admin'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)

    def is_patient(self): return self.role == 'patient'
    def is_doctor(self): return self.role == 'doctor'
    def is_nurse(self): return self.role == 'nurse'
    def is_admin(self): return self.role == 'admin'

    def __str__(self):
        return f"{self.username} ({self.role})"

class PatientProfile(models.Model):
    GENDER_CHOICES = (('male', 'Male'), ('female', 'Female'), ('other', 'Other'))
    BLOOD_GROUP_CHOICES = (
        ('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'),
        ('O+', 'O+'), ('O-', 'O-'), ('AB+', 'AB+'), ('AB-', 'AB-'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUP_CHOICES, blank=True, null=True)
    contact_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True)
    
    def __str__(self): return f"Profile of {self.user.username}"

class DoctorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile')
    specialization = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=100, blank=True)
    license_number = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)

    def __str__(self): return f"Dr. {self.user.username} - {self.specialization}"

class NurseProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='nurse_profile')
    department = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    
    def __str__(self): return f"Nurse {self.user.username}"

class Appointment(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('pending_approval', 'Pending Doctor Approval'),
        ('approved', 'Approved'),
        ('in_progress', 'In Progress'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )
    
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='appointments_as_patient')
    assigned_doctor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='appointments_as_doctor')
    assigned_nurse = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='appointments_as_nurse')
    date_time = models.DateTimeField()
    reason = models.TextField()
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.patient.username} - {self.date_time}"

class Vital(models.Model):
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vitals')
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name='vitals')
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='recorded_vitals')
    temperature = models.FloatField(null=True, blank=True)
    blood_pressure = models.CharField(max_length=20, null=True, blank=True) # e.g. "120/80"
    heart_rate = models.IntegerField(null=True, blank=True)
    weight = models.FloatField(null=True, blank=True)
    symptoms = models.TextField(blank=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_vitals')
    status = models.CharField(max_length=20, default='pending', choices=[('pending', 'Pending'), ('assigned', 'Assigned'), ('reviewed', 'Reviewed')])
    doctor_feedback = models.TextField(blank=True, null=True)
    feedback_date = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Consultation(models.Model):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name='consultation')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='consultations_conducted')
    chief_complaint = models.TextField(blank=True, null=True)
    diagnosis = models.TextField(default='')
    clinical_notes = models.TextField(default='')
    treatment_plan = models.TextField(blank=True, null=True)
    lab_results = models.TextField(blank=True, null=True) # Doctor enters results here manually for now
    follow_up_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Legacy field, keeping for backward compatibility if needed, but prefer Prescription model
    prescription_text = models.TextField(blank=True, null=True)

class Prescription(models.Model):
    consultation = models.OneToOneField(Consultation, on_delete=models.CASCADE, related_name='prescription')
    created_at = models.DateTimeField(auto_now_add=True)

class PrescriptionItem(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('discontinued', 'Discontinued'),
        ('completed', 'Completed'),
    )
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='items')
    medicine_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=255)
    frequency = models.CharField(max_length=255) # e.g. "BID", "Once a day"
    duration = models.CharField(max_length=255) # e.g. "5 days"
    route = models.CharField(max_length=100, blank=True, null=True) # e.g. Oral, IV
    instructions = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    discontinued_reason = models.TextField(blank=True, null=True)
    
    administered = models.BooleanField(default=False)
    administered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='administered_items')
    administered_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.medicine_name} - {self.dosage}"

class NurseTask(models.Model):
    PRIORITY_CHOICES = (
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    )
    
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name='nurse_tasks')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='requested_tasks')
    task_type = models.CharField(max_length=100) # e.g. "Observation", "Injection", "Dressing"
    details = models.TextField()
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='normal')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    completed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='completed_tasks')
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.task_type} - {self.status}"

class Conversation(models.Model):
    participants = models.ManyToManyField(User, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Conversation {self.id}"

class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender.username} at {self.created_at}"

# --- Inpatient / Admission Models ---

class Admission(models.Model):
    STATUS_CHOICES = (('admitted', 'Admitted'), ('discharged', 'Discharged'))
    
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='admissions')
    admitting_doctor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='admitted_patients')
    ward = models.CharField(max_length=100)
    bed_number = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='admitted')
    admitted_at = models.DateTimeField(auto_now_add=True)
    discharged_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.patient.username} - {self.ward}"

class NurseShift(models.Model):
    nurse = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shifts')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    ward = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.nurse.username} ({self.start_time} - {self.end_time})"

class InpatientOrder(models.Model):
    TYPE_CHOICES = (('medication', 'Medication'), ('lab', 'Lab'), ('procedure', 'Procedure'))
    PRIORITY_CHOICES = (('routine', 'Routine'), ('urgent', 'Urgent'), ('stat', 'STAT'))
    STATUS_CHOICES = (
        ('pending_review', 'Pending Review'),
        ('approved', 'Approved'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed')
    )

    admission = models.ForeignKey(Admission, on_delete=models.CASCADE, related_name='orders')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='inpatient_orders_created')
    order_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='medication')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='routine')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_review')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class MedicationItem(models.Model):
    order = models.ForeignKey(InpatientOrder, on_delete=models.CASCADE, related_name='medication_items')
    medicine_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=100)
    route = models.CharField(max_length=50) # PO, IV, etc
    frequency = models.CharField(max_length=100) # q8h, bid, etc
    duration_days = models.IntegerField(default=1)
    instructions = models.TextField(blank=True)
    start_datetime = models.DateTimeField()
    status = models.CharField(max_length=20, default='active') # active, stopped

class MedicationSchedule(models.Model):
    STATUS_CHOICES = (
        ('scheduled', 'Scheduled'),
        ('due', 'Due'),
        ('overdue', 'Overdue'),
        ('administered', 'Administered'),
        ('missed', 'Missed'),
        ('skipped', 'Skipped')
    )

    medication_item = models.ForeignKey(MedicationItem, on_delete=models.CASCADE, related_name='schedules')
    scheduled_time = models.DateTimeField()
    assigned_nurse = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='med_schedules')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    
    administered_at = models.DateTimeField(null=True, blank=True)
    administered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='meds_administered')
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.medication_item.medicine_name} @ {self.scheduled_time}"


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('vital_recorded',         'Vital Signs Recorded'),
        ('vital_updated',          'Vital Signs Updated'),
        ('consultation_created',   'Consultation Created'),
        ('consultation_updated',   'Consultation Updated'),
        ('prescription_added',     'Prescription Added'),
        ('medication_administered','Medication Administered'),
        ('admission_created',      'Patient Admitted'),
        ('patient_discharged',     'Patient Discharged'),
        ('nurse_task_completed',   'Nurse Task Completed'),
        ('appointment_status',     'Appointment Status Changed'),
        ('feedback_submitted',     'Doctor Feedback Submitted'),
    ]
    actor      = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action     = models.CharField(max_length=50, choices=ACTION_CHOICES)
    patient    = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='patient_audit_logs')
    details    = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        ts = self.timestamp.strftime('%Y-%m-%d %H:%M') if self.timestamp else '?'
        actor_str = self.actor.username if self.actor else '—'
        return f"[{ts}] {actor_str} → {self.action}"
