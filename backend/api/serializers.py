from rest_framework import serializers
from .models import User, PatientProfile, DoctorProfile, NurseProfile, Appointment, Vital, Consultation, Prescription, PrescriptionItem, Conversation, Message, NurseTask, Admission, InpatientOrder, MedicationItem, MedicationSchedule, NurseShift, AuditLog

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name', 'is_active', 'avatar']

class PatientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        exclude = ['user']

class DoctorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorProfile
        exclude = ['user']

class NurseProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = NurseProfile
        exclude = ['user']

class FullUserSerializer(serializers.ModelSerializer):
    """UserSerializer that embeds the role-specific profile."""
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name', 'is_active', 'avatar', 'profile']

    def get_profile(self, obj):
        try:
            if obj.role == 'patient':
                return PatientProfileSerializer(obj.patient_profile).data
            elif obj.role == 'doctor':
                return DoctorProfileSerializer(obj.doctor_profile).data
            elif obj.role == 'nurse':
                return NurseProfileSerializer(obj.nurse_profile).data
        except Exception:
            pass
        return None

class VitalSerializer(serializers.ModelSerializer):
    recorder_name = serializers.SerializerMethodField()
    recorder_role = serializers.CharField(source='recorded_by.role', read_only=True, default='')
    patient_name  = serializers.CharField(source='patient.username', read_only=True)

    class Meta:
        model = Vital
        fields = '__all__'
        read_only_fields = ['created_at', 'recorded_by', 'patient']

    def get_recorder_name(self, obj):
        if not obj.recorded_by:
            return '—'
        full = f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}".strip()
        return full or obj.recorded_by.username

class PrescriptionItemSerializer(serializers.ModelSerializer):
    administered_by_name = serializers.CharField(source='administered_by.username', read_only=True)
    class Meta:
        model = PrescriptionItem
        fields = '__all__'
        read_only_fields = ['administered_by', 'administered_at']

class PrescriptionSerializer(serializers.ModelSerializer):
    items = PrescriptionItemSerializer(many=True, read_only=True)
    class Meta:
        model = Prescription
        fields = ['id', 'created_at', 'items']

class ConsultationSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.username', read_only=True)
    prescription = PrescriptionSerializer(read_only=True)
    class Meta:
        model = Consultation
        fields = '__all__'
        read_only_fields = ['appointment', 'created_at', 'doctor', 'updated_at']

class NurseTaskSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.username', read_only=True)
    completed_by_name = serializers.CharField(source='completed_by.username', read_only=True)
    
    class Meta:
        model = NurseTask
        fields = '__all__'
        read_only_fields = ['created_at', 'doctor', 'completed_by', 'completed_at']

class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.username', read_only=True)
    patient_details = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    nurse_name = serializers.SerializerMethodField()
    consultation = ConsultationSerializer(read_only=True)
    vitals = VitalSerializer(many=True, read_only=True)
    nurse_tasks = NurseTaskSerializer(many=True, read_only=True)
    
    class Meta:
        model = Appointment
        fields = '__all__'
        read_only_fields = ['created_at', 'patient']

    def get_doctor_name(self, obj):
        return obj.assigned_doctor.username if obj.assigned_doctor else None

    def get_nurse_name(self, obj):
        return obj.assigned_nurse.username if obj.assigned_nurse else None

    def get_patient_details(self, obj):
        # Return basic patient profile info directly in appointment
        # Ideally we'd have a PatientProfile serializer, but let's stick to User + Profile details
        try:
             profile = obj.patient.patient_profile
             return {
                 "dob": profile.date_of_birth,
                 "gender": profile.gender,
                 "phone": profile.contact_number,
                 "blood_group": profile.blood_group
             }
        except:
            return None

class CreateAppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['date_time', 'reason', 'notes']

class CreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    profile = serializers.DictField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'role', 'first_name', 'last_name', 'email', 'profile']

    def create(self, validated_data):
        profile_data = validated_data.pop('profile', {}) or {}
        user = User.objects.create_user(**validated_data)
        _create_or_update_profile(user, profile_data)
        return user

def _create_or_update_profile(user, profile_data):
    """Create or update the role-specific profile for a user."""
    if user.role == 'patient':
        PatientProfile.objects.update_or_create(user=user, defaults={
            'date_of_birth': profile_data.get('date_of_birth') or None,
            'gender': profile_data.get('gender', ''),
            'blood_group': profile_data.get('blood_group', ''),
            'contact_number': profile_data.get('contact_number', ''),
            'address': profile_data.get('address', ''),
        })
    elif user.role == 'doctor':
        DoctorProfile.objects.update_or_create(user=user, defaults={
            'specialization': profile_data.get('specialization', ''),
            'department': profile_data.get('department', ''),
            'license_number': profile_data.get('license_number', ''),
            'phone': profile_data.get('phone', ''),
            'bio': profile_data.get('bio', ''),
        })
    elif user.role == 'nurse':
        NurseProfile.objects.update_or_create(user=user, defaults={
            'department': profile_data.get('department', ''),
            'phone': profile_data.get('phone', ''),
        })

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    class Meta:
        model = Message
        fields = '__all__'
        read_only_fields = ['sender', 'created_at']

class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    participants = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = ['id', 'participants', 'messages', 'last_message', 'created_at', 'updated_at']

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return f"{last_msg.sender.username}: {last_msg.content[:30]}..."
        return None

# --- Inpatient Serializers ---

class AdmissionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.username', read_only=True)
    patient_details = serializers.SerializerMethodField()
    doctor_name = serializers.CharField(source='admitting_doctor.username', read_only=True)
    
    class Meta:
        model = Admission
        fields = '__all__'

    def get_patient_details(self, obj):
        try:
             profile = obj.patient.patient_profile
             return { "dob": profile.date_of_birth, "gender": profile.gender, "blood": profile.blood_group }
        except: return None

class MedicationScheduleSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medication_item.medicine_name', read_only=True)
    dosage = serializers.CharField(source='medication_item.dosage', read_only=True)
    route = serializers.CharField(source='medication_item.route', read_only=True)
    patient_name = serializers.CharField(source='medication_item.order.admission.patient.username', read_only=True)
    ward = serializers.CharField(source='medication_item.order.admission.ward', read_only=True)
    bed = serializers.CharField(source='medication_item.order.admission.bed_number', read_only=True)

    class Meta:
        model = MedicationSchedule
        fields = '__all__'

class MedicationItemSerializer(serializers.ModelSerializer):
    schedules = MedicationScheduleSerializer(many=True, read_only=True)
    class Meta:
        model = MedicationItem
        fields = '__all__'

class InpatientOrderSerializer(serializers.ModelSerializer):
    medication_items = MedicationItemSerializer(many=True, read_only=True)
    doctor_name = serializers.CharField(source='doctor.username', read_only=True)
    patient_name = serializers.CharField(source='admission.patient.username', read_only=True)
    ward = serializers.CharField(source='admission.ward', read_only=True)
    bed_number = serializers.CharField(source='admission.bed_number', read_only=True)
    
    class Meta:
        model = InpatientOrder
        fields = '__all__'
        read_only_fields = ['doctor']

class NurseShiftSerializer(serializers.ModelSerializer):
    nurse_name = serializers.CharField(source='nurse.username', read_only=True)
    class Meta:
        model = NurseShift
        fields = '__all__'

# ── Patient-facing serializers ────────────────────────────────────────────────

class PatientProfileFullSerializer(serializers.ModelSerializer):
    """Combined user + patient profile for the patient's own view/edit."""
    first_name       = serializers.CharField(source='user.first_name')
    last_name        = serializers.CharField(source='user.last_name')
    email            = serializers.EmailField(source='user.email')
    username         = serializers.CharField(source='user.username', read_only=True)
    avatar           = serializers.SerializerMethodField()
    role             = serializers.CharField(source='user.role', read_only=True)
    user_id          = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = PatientProfile
        fields = [
            'user_id', 'username', 'first_name', 'last_name', 'email', 'role', 'avatar',
            'date_of_birth', 'gender', 'blood_group', 'contact_number', 'address',
        ]

    def get_avatar(self, obj):
        request = self.context.get('request')
        if obj.user.avatar and request:
            return request.build_absolute_uri(obj.user.avatar.url)
        return None

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        for attr, val in user_data.items():
            setattr(instance.user, attr, val)
        instance.user.save()
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        return instance

class PatientAdmissionSerializer(serializers.ModelSerializer):
    doctor_name        = serializers.SerializerMethodField()
    doctor_first_name  = serializers.CharField(source='admitting_doctor.first_name', read_only=True)
    doctor_last_name   = serializers.CharField(source='admitting_doctor.last_name', read_only=True)

    class Meta:
        model = Admission
        fields = [
            'id', 'ward', 'bed_number', 'status', 'admitted_at', 'discharged_at', 'notes',
            'doctor_name', 'doctor_first_name', 'doctor_last_name',
        ]

    def get_doctor_name(self, obj):
        if obj.admitting_doctor:
            return f"{obj.admitting_doctor.first_name} {obj.admitting_doctor.last_name}".strip() or obj.admitting_doctor.username
        return None

class PatientPrescriptionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionItem
        fields = ['id', 'medicine_name', 'dosage', 'frequency', 'duration', 'route', 'instructions', 'status']

class PatientPrescriptionSerializer(serializers.ModelSerializer):
    items       = PatientPrescriptionItemSerializer(many=True, read_only=True)
    doctor_name = serializers.SerializerMethodField()
    date_time   = serializers.SerializerMethodField()
    reason      = serializers.SerializerMethodField()

    class Meta:
        model = Prescription
        fields = ['id', 'created_at', 'items', 'doctor_name', 'date_time', 'reason']

    def get_doctor_name(self, obj):
        doc = obj.consultation.doctor
        return f"{doc.first_name} {doc.last_name}".strip() or doc.username

    def get_date_time(self, obj):
        return obj.consultation.appointment.date_time

    def get_reason(self, obj):
        return obj.consultation.appointment.reason

class PatientHistorySerializer(serializers.ModelSerializer):
    doctor_name     = serializers.SerializerMethodField()
    diagnosis       = serializers.CharField(source='consultation.diagnosis', default='')
    clinical_notes  = serializers.CharField(source='consultation.clinical_notes', default='')
    treatment_plan  = serializers.CharField(source='consultation.treatment_plan', default='')
    lab_results     = serializers.CharField(source='consultation.lab_results', default='')
    follow_up_notes = serializers.CharField(source='consultation.follow_up_notes', default='')
    prescription    = serializers.SerializerMethodField()
    has_consultation = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id', 'date_time', 'reason', 'status', 'notes',
            'doctor_name', 'has_consultation',
            'diagnosis', 'clinical_notes', 'treatment_plan', 'lab_results', 'follow_up_notes',
            'prescription',
        ]

    def get_doctor_name(self, obj):
        if obj.assigned_doctor:
            return f"{obj.assigned_doctor.first_name} {obj.assigned_doctor.last_name}".strip() or obj.assigned_doctor.username
        return 'Unassigned'

    def get_has_consultation(self, obj):
        return hasattr(obj, 'consultation')

    def get_prescription(self, obj):
        try:
            p = obj.consultation.prescription
            return PatientPrescriptionItemSerializer(p.items.all(), many=True).data
        except Exception:
            return []


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name   = serializers.SerializerMethodField()
    actor_role   = serializers.CharField(source='actor.role', read_only=True, default='')
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model  = AuditLog
        fields = ['id', 'timestamp', 'action', 'actor_name', 'actor_role', 'patient_name', 'details', 'ip_address']

    def get_actor_name(self, obj):
        if not obj.actor:
            return '—'
        full = f"{obj.actor.first_name} {obj.actor.last_name}".strip()
        return full or obj.actor.username

    def get_patient_name(self, obj):
        if not obj.patient:
            return None
        full = f"{obj.patient.first_name} {obj.patient.last_name}".strip()
        return full or obj.patient.username
