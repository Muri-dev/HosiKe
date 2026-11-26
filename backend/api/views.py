from rest_framework import viewsets, permissions, status, generics, parsers
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from datetime import timedelta, datetime, date, time as dtime
from .models import User, Appointment, Vital, Consultation, PatientProfile, DoctorProfile, NurseProfile, Prescription, PrescriptionItem, Conversation, Message, NurseTask, Admission, InpatientOrder, MedicationItem, MedicationSchedule, NurseShift, AuditLog, RemoteMonitoring
from .serializers import (
    UserSerializer, FullUserSerializer, AppointmentSerializer, CreateAppointmentSerializer,
    VitalSerializer, ConsultationSerializer, CreateUserSerializer,
    ConversationSerializer, MessageSerializer, PrescriptionItemSerializer, NurseTaskSerializer,
    AdmissionSerializer, InpatientOrderSerializer, MedicationScheduleSerializer, NurseShiftSerializer,
    AuditLogSerializer, AdminAdmissionSerializer, RemoteMonitoringSerializer,
    _create_or_update_profile,
)

# ── Frequency parser ─────────────────────────────────────────────────────────
# Maps common frequency codes to (doses_per_day, [hour_offsets_from_midnight])
_FREQ_MAP = {
    'od': (1, [8]),
    'qd': (1, [8]),
    'once a day': (1, [8]),
    'daily': (1, [8]),
    'bd': (2, [8, 20]),
    'bid': (2, [8, 20]),
    'twice a day': (2, [8, 20]),
    'twice daily': (2, [8, 20]),
    'tid': (3, [8, 14, 20]),
    'three times a day': (3, [8, 14, 20]),
    'qid': (4, [8, 12, 16, 20]),
    'four times a day': (4, [8, 12, 16, 20]),
    'q4h': (6, [6, 10, 14, 18, 22, 2]),
    'q6h': (4, [6, 12, 18, 0]),
    'q8h': (3, [6, 14, 22]),
    'q12h': (2, [8, 20]),
    'nocte': (1, [22]),
    'at night': (1, [22]),
    'prn': (0, []),  # as-needed — no auto-schedule
}

def _parse_frequency(frequency_str):
    """Return list of hour-of-day integers for a given frequency string."""
    key = frequency_str.strip().lower()
    if key in _FREQ_MAP:
        return _FREQ_MAP[key][1]
    # Attempt to parse generic qNh pattern
    import re
    m = re.match(r'q(\d+)h', key)
    if m:
        interval = int(m.group(1))
        hours = []
        h = 6
        while h < 6 + 24 and len(hours) < (24 // interval):
            hours.append(h % 24)
            h += interval
        return hours
    # Default: once daily
    return [8]


def _generate_schedules(med_item):
    """
    Create MedicationSchedule entries for the full treatment duration based on booleans.
    med_item.duration_days   — how many days to run
    med_item.morning/afternoon/evening — boolean schedule flags
    """
    from .models import MedicationSchedule  # local import to avoid circular at module level
    
    hours = []
    if getattr(med_item, 'morning', False): hours.append(8)
    if getattr(med_item, 'afternoon', False): hours.append(14)
    if getattr(med_item, 'evening', False): hours.append(20)

    if not hours:
        return  # PRN — no scheduled doses

    start_date = timezone.now()
    to_create = []
    for day_offset in range(med_item.duration_days):
        current_date = start_date.date() + timedelta(days=day_offset)
        for hour in hours:
            scheduled_dt = timezone.make_aware(
                datetime.combine(current_date, dtime(hour=hour, minute=0)),
                timezone.get_current_timezone()
            )
            to_create.append(MedicationSchedule(
                medication_item=med_item,
                scheduled_time=scheduled_dt,
                status='scheduled',
            ))
    MedicationSchedule.objects.bulk_create(to_create)
    return len(to_create)


# ── Audit helper ─────────────────────────────────────────────────────────────
def log_action(request, action, patient=None, details=None):
    """Create an AuditLog entry for the given action."""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    ip = x_forwarded.split(',')[0].strip() if x_forwarded else request.META.get('REMOTE_ADDR')
    AuditLog.objects.create(
        actor=request.user,
        action=action,
        patient=patient,
        details=details or {},
        ip_address=ip,
    )

# Permissions
class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'

class IsDoctor(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'doctor'

class IsNurse(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'nurse'

class IsPatient(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'patient'

# Auth & User Views
class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        data = request.data.copy()
        # Non-admins cannot change permanent identity fields — only admin can via UserViewSet
        if not request.user.is_admin():
            for locked in ('first_name', 'last_name', 'username', 'role'):
                data.pop(locked, None)
        serializer = UserSerializer(request.user, data=data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class AvatarUploadView(APIView):
    """Self-service avatar upload/remove for the currently logged-in user."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request):
        return _save_avatar(request.user, request)

    def delete(self, request):
        user = request.user
        if user.avatar:
            user.avatar.delete(save=False)
            user.avatar = None
            user.save()
        return Response({'detail': 'Avatar removed.'})

class UserAvatarView(APIView):
    """Admin-only: upload or remove avatar for ANY user by ID."""
    permission_classes = [IsAdmin]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        return _save_avatar(user, request)

    def delete(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        if user.avatar:
            user.avatar.delete(save=False)
            user.avatar = None
            user.save()
        return Response({'detail': 'Avatar removed.'})

def _save_avatar(user, request):
    file = request.FILES.get('avatar')
    if not file:
        return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
    if user.avatar:
        user.avatar.delete(save=False)
    user.avatar = file
    user.save()
    return Response(UserSerializer(user, context={'request': request}).data)

class UserSearchView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer
    
    def get_queryset(self):
        query = self.request.query_params.get('q', '')
        role = self.request.query_params.get('role')
        
        if not query and not role:
            # If no query/role specified, restrict default list based on requester's role
            # This prevents dumping the whole user database
            # Only return results if a specific search or filter is applied, OR return a default list based on role permissions
            pass

        filters = Q(username__icontains=query) | \
                  Q(first_name__icontains=query) | \
                  Q(last_name__icontains=query)
        
        # If query is numeric, also search by ID
        if query.isdigit():
            filters |= Q(id=query)
            
        queryset = User.objects.filter(filters).exclude(id=self.request.user.id)
        
        # Role-based restriction logic
        user_role = self.request.user.role
        
        if user_role == 'patient':
            # Patient can only see doctors
            queryset = queryset.filter(role='doctor')
        
        elif user_role == 'nurse':
            # Nurse can see nurses, doctors, admins
            queryset = queryset.filter(role__in=['nurse', 'doctor', 'admin'])
            
        elif user_role == 'admin':
            # Admin can see doctors, nurses (and maybe other admins? logic said doctor/nurse)
            queryset = queryset.filter(role__in=['doctor', 'nurse', 'admin'])
            
        elif user_role == 'doctor':
             # Doctor can see everyone (patients, nurses, admins, other doctors)
             pass 

        # Optional extra filtering by param if allowed
        req_role = self.request.query_params.get('role')
        if req_role:
            queryset = queryset.filter(role=req_role)
            
        return queryset[:20]

# Admin Views
class NotificationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        data = {
            'messages': 0,
            'appointments': 0,
            'remote_referrals': 0,
            'medications': 0,
            'others': 0
        }

        # 1. Unread Messages (All Users)
        conv_ids = list(user.conversations.values_list('id', flat=True))
        messages = Message.objects.filter(
            conversation_id__in=conv_ids
        )
        data['messages'] = sum(1 for m in messages if not m.is_read and m.sender_id != user.id)

        # 2. Role-specific Notifications
        if user.role == 'admin':
            # Pending Appts
            data['appointments'] = Appointment.objects.filter(status='pending').count()
            # Unassigned Remote Vitals
            data['remote_referrals'] = Vital.objects.filter(assigned_to__isnull=True).count()
        
        elif user.role == 'doctor':
            # Remote Vitals Assigned but not Reviewed
            data['remote_referrals'] = Vital.objects.filter(assigned_to=user, status='pending').count()
            # Appointments Today
            today = timezone.now().date()
            today_start = timezone.make_aware(datetime.combine(today, dtime.min))
            today_end = timezone.make_aware(datetime.combine(today, dtime.max))
            data['appointments'] = Appointment.objects.filter(assigned_doctor=user, date_time__gte=today_start, date_time__lte=today_end, status='approved').count()

        elif user.role == 'nurse':
            now = timezone.now()
            window = now + timedelta(minutes=30)
            # Due = already scheduled and time has passed
            due_count = MedicationSchedule.objects.filter(
                assigned_nurse=user,
                status='scheduled',
                scheduled_time__lte=now,
            ).count()
            # Upcoming within 30 min (show as advisory)
            upcoming_count = MedicationSchedule.objects.filter(
                assigned_nurse=user,
                status='scheduled',
                scheduled_time__gt=now,
                scheduled_time__lte=window,
            ).count()
            data['medications'] = due_count + upcoming_count

        elif user.role == 'patient':
            # Count active prescription items with doses today
            today = timezone.now().date()
            active_items = PrescriptionItem.objects.filter(
                prescription__consultation__appointment__patient=user,
                status='active',
            ).filter(
                Q(active_until__isnull=True) | Q(active_until__gte=today)
            )
            data['medications'] = active_items.count()

        return Response(data)

def _with_appointment_relations(qs):
    """Prefetch related models used by AppointmentSerializer to avoid N+1 queries."""
    return qs.select_related(
        'patient',
        'patient__patient_profile',
        'assigned_doctor',
        'assigned_nurse',
        'consultation',
        'consultation__doctor',
        'consultation__prescription',
    ).prefetch_related(
        Prefetch('vitals', queryset=Vital.objects.select_related('recorded_by', 'patient')),
        Prefetch(
            'consultation__prescription__items',
            queryset=PrescriptionItem.objects.select_related('administered_by'),
        ),
        Prefetch('nurse_tasks', queryset=NurseTask.objects.select_related('doctor', 'completed_by')),
    )


class AdminDashboardView(APIView):
    permission_classes = [IsAdmin]
    def get(self, request):
        today = timezone.now().date()
        today_start = timezone.make_aware(datetime.combine(today, dtime.min))
        today_end = timezone.make_aware(datetime.combine(today, dtime.max))
        week_start = timezone.make_aware(datetime.combine(today - timedelta(days=6), dtime.min))

        # KPIs (batched to minimize database round-trips)
        role_counts = {
            row['role']: row['count']
            for row in User.objects.values('role').annotate(count=Count('id'))
        }
        total_patients = role_counts.get('patient', 0)
        total_doctors = role_counts.get('doctor', 0)
        total_nurses = role_counts.get('nurse', 0)

        appt_kpis = Appointment.objects.aggregate(
            appointments_today=Count('id', filter=Q(date_time__gte=today_start, date_time__lte=today_end)),
            pending_appointments=Count('id', filter=Q(status='pending')),
            completed_today=Count('id', filter=Q(date_time__gte=today_start, date_time__lte=today_end, status='completed')),
            unassigned_today=Count('id', filter=Q(date_time__gte=today_start, date_time__lte=today_end, assigned_doctor__isnull=True)),
        )
        appointments_today = appt_kpis['appointments_today']
        pending_appointments = appt_kpis['pending_appointments']
        completed_today = appt_kpis['completed_today']
        unassigned_today = appt_kpis['unassigned_today']

        admitted_count = Admission.objects.filter(status='admitted').count()
        remote_monitoring_count = RemoteMonitoring.objects.filter(active=True).count()

        # Trend (Last 7 days in 1 query)
        day_buckets = {(today - timedelta(days=i)).strftime('%Y-%m-%d'): 0 for i in range(6, -1, -1)}
        for dt in Appointment.objects.filter(date_time__gte=week_start, date_time__lte=today_end).values_list('date_time', flat=True):
            key = timezone.localtime(dt).date().strftime('%Y-%m-%d')
            if key in day_buckets:
                day_buckets[key] += 1
        trend_data = [{"date": d, "count": c} for d, c in day_buckets.items()]

        # Status Distribution
        status_counts = Appointment.objects.values('status').annotate(count=Count('status'))

        # Doctor Workload Today
        doctor_workload = Appointment.objects.filter(date_time__gte=today_start, date_time__lte=today_end, assigned_doctor__isnull=False).values('assigned_doctor__username', 'assigned_doctor__first_name', 'assigned_doctor__last_name').annotate(count=Count('id'))

        # Recent Activity
        recent_activity = []
        latest_appts = Appointment.objects.select_related('patient').order_by('-created_at')[:5]
        for appt in latest_appts:
            recent_activity.append({
                "type": "appointment_created",
                "message": f"Appointment for {appt.patient.username} created",
                "created_at": appt.created_at
            })

        stats = {
            'kpis': {
                'total_patients': total_patients,
                'total_doctors': total_doctors,
                'total_nurses': total_nurses,
                'appointments_today': appointments_today,
                'pending_appointments': pending_appointments,
                'completed_today': completed_today,
                'unassigned_appointments': unassigned_today,
                'admitted_count': admitted_count,
                'remote_monitoring_count': remote_monitoring_count
            },
            'trend': trend_data,
            'status_distribution': list(status_counts),
            'doctor_workload': list(doctor_workload),
            'recent_activity': recent_activity
        }
        return Response(stats)

class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = FullUserSerializer

    def get_serializer_class(self, *args, **kwargs):
        if self.action == 'create':
            return CreateUserSerializer
        return FullUserSerializer

    def get_queryset(self):
        queryset = User.objects.select_related(
            'patient_profile', 'doctor_profile', 'nurse_profile'
        ).order_by('-date_joined')

        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            active_bool = is_active.lower() == 'true'
            queryset = queryset.filter(is_active=active_bool)

        return queryset

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        profile_data = request.data.pop('profile', None)
        response = super().partial_update(request, *args, **kwargs)
        # Update profile if included in the request
        if profile_data:
            _create_or_update_profile(user, profile_data)
        return response

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get('password')
        if not password:
             return Response({"detail": "Password is required"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save()
        return Response({"detail": "Password reset successfully"})

class AdminAppointmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    
    def get_queryset(self):
        qs = _with_appointment_relations(Appointment.objects.all()).order_by('-date_time')
        
        # Filter by Status
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param)
            
        # Filter by Date Range
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            try:
                dt_from = datetime.strptime(date_from, '%Y-%m-%d').date()
                dt_start = timezone.make_aware(datetime.combine(dt_from, dtime.min))
                qs = qs.filter(date_time__gte=dt_start)
            except ValueError:
                pass
        if date_to:
            try:
                dt_to = datetime.strptime(date_to, '%Y-%m-%d').date()
                dt_end = timezone.make_aware(datetime.combine(dt_to, dtime.max))
                qs = qs.filter(date_time__lte=dt_end)
            except ValueError:
                pass

        # Filter by Doctor
        doctor_id = self.request.query_params.get('doctor_id')
        if doctor_id:
            qs = qs.filter(assigned_doctor_id=doctor_id)
            
        # Filter by Nurse
        nurse_id = self.request.query_params.get('nurse_id')
        if nurse_id:
            qs = qs.filter(assigned_nurse_id=nurse_id)

        # Filter by Urgency
        urgency_param = self.request.query_params.get('urgency')
        if urgency_param and urgency_param != 'all':
            qs = qs.filter(urgency=urgency_param)
            
        # Search Patient
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(patient__username__icontains=search) |
                Q(patient__first_name__icontains=search) |
                Q(patient__last_name__icontains=search)
            )

        return qs

    def create(self, request, *args, **kwargs):
        # Admin creation of appointment
        serializer = CreateAppointmentSerializer(data=request.data)
        if serializer.is_valid():
            patient_id = request.data.get('patient_id')
            doctor_id = request.data.get('doctor_id')
            nurse_id = request.data.get('nurse_id')
            notes = request.data.get('notes', '')
            status_val = request.data.get('status', 'pending')

            if not patient_id:
                return Response({"detail": "Patient ID is required."}, status=status.HTTP_400_BAD_REQUEST)

             # Validate Patient
            patient = get_object_or_404(User, pk=patient_id, role='patient')
            
            # Validate Doctor if provided
            doctor = None
            if doctor_id:
                doctor = get_object_or_404(User, pk=doctor_id, role='doctor')
            
            # Validate Nurse if provided
            nurse = None
            if nurse_id:
                nurse = get_object_or_404(User, pk=nurse_id, role='nurse')

            # Create Appointment
            appointment = Appointment.objects.create(
                patient=patient,
                assigned_doctor=doctor,
                assigned_nurse=nurse,
                date_time=serializer.validated_data['date_time'],
                reason=serializer.validated_data['reason'],
                status=status_val,
                notes=notes
            )
            
            return Response(AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'], url_path='assign-doctor')
    def assign_doctor(self, request, pk=None):
        appt = self.get_object()
        doctor_id = request.data.get('doctor_id')
        doctor = get_object_or_404(User, pk=doctor_id, role='doctor')
        appt.assigned_doctor = doctor
        appt.status = 'pending_approval' # Wait for doctor to accept
        appt.save()
        return Response(AppointmentSerializer(appt).data)

    @action(detail=True, methods=['patch'], url_path='assign-nurse')
    def assign_nurse(self, request, pk=None):
        appt = self.get_object()
        nurse_id = request.data.get('nurse_id')
        nurse = get_object_or_404(User, pk=nurse_id, role='nurse')
        appt.assigned_nurse = nurse
        appt.save()
        return Response(AppointmentSerializer(appt).data)

    @action(detail=True, methods=['patch'])
    def status(self, request, pk=None):
        appt = self.get_object()
        appt.status = request.data.get('status')
        appt.save()
        return Response(AppointmentSerializer(appt).data)

# Patient Views
class PatientAppointmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsPatient]
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        return _with_appointment_relations(
            Appointment.objects.filter(patient=self.request.user)
        ).order_by('-date_time')

    def create(self, request, *args, **kwargs):
        serializer = CreateAppointmentSerializer(data=request.data)
        if serializer.is_valid():
            doctor_id = request.data.get('doctor_id')
            serializer.save(
                patient=request.user, 
                status='pending',
                assigned_doctor_id=doctor_id if doctor_id else None
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'])
    def cancel(self, request, pk=None):
        appt = get_object_or_404(Appointment, pk=pk, patient=request.user)
        if appt.status in ('completed', 'cancelled'):
            return Response({'detail': 'Cannot cancel a completed or already-cancelled appointment.'}, status=400)
        appt.status = 'cancelled'
        appt.notes = request.data.get('reason', appt.notes)
        appt.save()
        return Response(AppointmentSerializer(appt).data)

class PatientVitalsView(generics.ListCreateAPIView):
    permission_classes = [IsPatient]
    serializer_class = VitalSerializer
    
    def get_queryset(self):
        return Vital.objects.filter(patient=self.request.user).select_related('recorded_by', 'patient').order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        # Allow patient to specify a doctor, or auto-assign their most recent doctor
        assigned_to_id = self.request.data.get('assigned_to')
        assigned_doctor = None
        if assigned_to_id:
            try:
                assigned_doctor = User.objects.get(pk=assigned_to_id, role='doctor')
            except User.DoesNotExist:
                pass
        if not assigned_doctor:
            # Auto-assign: find the doctor from their latest approved/in-progress appointment
            latest_appt = Appointment.objects.filter(
                patient=user,
                assigned_doctor__isnull=False,
                status__in=['approved', 'in_progress', 'completed']
            ).order_by('-date_time').first()
            if latest_appt:
                assigned_doctor = latest_appt.assigned_doctor

        vital = serializer.save(
            patient=user,
            recorded_by=user,
            assigned_to=assigned_doctor,
            status='pending',
        )
        log_action(self.request, 'vital_recorded', patient=user, details={
            'vital_id': vital.id,
            'assigned_to': assigned_doctor.username if assigned_doctor else None,
        })

# Messaging Views
class ConversationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return self.request.user.conversations.prefetch_related(
            'participants__doctor_profile',
            'participants__nurse_profile',
            'messages__sender',
        ).order_by('-updated_at')

    @action(detail=False, methods=['post'])
    def start(self, request):
        recipient_id = request.data.get('recipient_id')
        recipient = get_object_or_404(User, pk=recipient_id)
        
        # Check if conversation exists
        convs = self.request.user.conversations.all()
        for c in convs:
            if c.participants.count() == 2 and recipient in c.participants.all():
                return Response(ConversationSerializer(c).data)
        
        # Create new
        conv = Conversation.objects.create()
        conv.participants.add(self.request.user, recipient)
        return Response(ConversationSerializer(conv).data)

    @action(detail=True, methods=['post', 'get'])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        if request.data:
            content = request.data.get('content')
            msg = Message.objects.create(conversation=conversation, sender=request.user, content=content)
            conversation.updated_at = timezone.now()
            conversation.save()
            return Response(MessageSerializer(msg).data)
        else:
            msgs = conversation.messages.all()
            return Response(MessageSerializer(msgs, many=True).data)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        # Count messages where user is a participant but NOT the sender, and is_read is False
        # To do this efficiently, we query Messages directly
        conv_ids = list(request.user.conversations.values_list('id', flat=True))
        messages = Message.objects.filter(
            conversation_id__in=conv_ids
        )
        count = sum(1 for m in messages if not m.is_read and m.sender_id != request.user.id)
        return Response({'count': count})

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        conversation = self.get_object()
        msgs = conversation.messages.all()
        updated_count = 0
        for m in msgs:
            if not m.is_read and m.sender_id != request.user.id:
                m.is_read = True
                m.save(update_fields=['is_read'])
                updated_count += 1
        return Response({'marked_read': updated_count})

# --- Inpatient Workflows ---

class AdmissionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AdmissionSerializer
    queryset = Admission.objects.select_related(
        'patient', 'patient__patient_profile', 'admitting_doctor'
    ).order_by('-admitted_at')

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)

        return qs

    def create(self, request, *args, **kwargs):
        """Block admitting a patient who is already admitted."""
        patient_id = request.data.get('patient')
        if patient_id and Admission.objects.filter(patient_id=patient_id, status='admitted').exists():
            return Response(
                {'detail': 'This patient is already admitted. Discharge them first before creating a new admission.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """Auto-set discharged_at when status changes to discharged."""
        instance = self.get_object()
        new_status = request.data.get('status')
        if new_status == 'discharged' and instance.status != 'discharged':
            data = request.data.copy()
            data.setdefault('discharged_at', timezone.now().isoformat())
            serializer = self.get_serializer(instance, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            log_action(request, 'patient_discharged', patient=instance.patient,
                       details={'admission_id': instance.id, 'ward': instance.ward})
            return Response(serializer.data)
        return super().partial_update(request, *args, **kwargs)


class NurseShiftViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin] # Or IsNurse for viewing their own? Mixed.
    serializer_class = NurseShiftSerializer
    queryset = NurseShift.objects.all().order_by('-start_time')

class InpatientOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated] # Fine-tune later
    serializer_class = InpatientOrderSerializer
    queryset = InpatientOrder.objects.all().order_by('-created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        admission_id = self.request.query_params.get('admission')
        if admission_id:
            qs = qs.filter(admission_id=admission_id)
        return qs

    def create(self, request, *args, **kwargs):
        # Create Order + Items
        try:
            data = request.data.copy()
        except AttributeError:
            data = dict(request.data)
            
        items_data = data.pop('medication_items', [])
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save(doctor=request.user)

        # Create Items & Generate Full Schedules based on parsed frequency
        for item in items_data:
            med_item = MedicationItem.objects.create(order=order, **item)
            _generate_schedules(med_item)

        return Response(InpatientOrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'])
    def approve(self, request, pk=None):
        order = self.get_object()
        order.status = 'approved'
        order.save()
        log_action(request, 'appointment_status', patient=order.admission.patient,
                   details={'inpatient_order_id': order.id, 'new_status': 'approved'})
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'], url_path='allocate')
    def allocate(self, request, pk=None):
        # Allocate all schedules of this order to a nurse
        order = self.get_object()
        nurse_id = request.data.get('nurse_id')
        nurse = get_object_or_404(User, pk=nurse_id, role='nurse')
        
        schedules = MedicationSchedule.objects.filter(medication_item__order=order, status='scheduled')
        schedules.update(assigned_nurse=nurse)

        # Mark order as completed so the frontend reflects allocation immediately
        order.status = "completed"
        order.notes = "Nurse allocated: " + (nurse.get_full_name() or nurse.username)
        order.save()
        
        return Response({'status': 'allocated', 'nurse': nurse.get_full_name() or nurse.username, 'count': schedules.count()})

class MedicationScheduleViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MedicationScheduleSerializer

    def get_queryset(self):
        user = self.request.user
        now = timezone.now()
        qs = MedicationSchedule.objects.select_related(
            'medication_item__order__admission',
            'assigned_nurse',
            'administered_by',
        ).order_by('scheduled_time')

        if user.role == 'nurse':
            qs = qs.filter(assigned_nurse=user)

        scope = self.request.query_params.get('scope')
        if scope == 'due':
            # Due: scheduled time has passed but not yet administered (up to 4 h overdue)
            qs = qs.filter(
                scheduled_time__lte=now,
                scheduled_time__gte=now - timedelta(hours=4),
                status='scheduled',
            )
        elif scope == 'upcoming':
            # Next 8 hours
            qs = qs.filter(
                scheduled_time__gt=now,
                scheduled_time__lte=now + timedelta(hours=8),
                status='scheduled',
            )
        elif scope == 'overdue':
            # More than 15 minutes past due and not administered
            qs = qs.filter(
                scheduled_time__lt=now - timedelta(minutes=15),
                status='scheduled',
            )
        elif scope == 'today':
            today = now.date()
            t_start = timezone.make_aware(datetime.combine(today, dtime.min))
            t_end = timezone.make_aware(datetime.combine(today, dtime.max))
            qs = qs.filter(scheduled_time__gte=t_start, scheduled_time__lte=t_end)
        elif scope == 'administered_today':
            today = now.date()
            t_start = timezone.make_aware(datetime.combine(today, dtime.min))
            t_end = timezone.make_aware(datetime.combine(today, dtime.max))
            qs = qs.filter(status='administered', administered_at__gte=t_start, administered_at__lte=t_end)

        return qs

    @action(detail=True, methods=['patch'])
    def administer(self, request, pk=None):
        ms = self.get_object()
        ms.status = 'administered'
        ms.administered_at = timezone.now()
        ms.administered_by = request.user
        ms.notes = request.data.get('notes', '')
        ms.save()

        try:
            patient = ms.medication_item.order.admission.patient
        except Exception:
            patient = None

        log_action(request, 'medication_administered',
                   patient=patient,
                   details={
                       'schedule_id': ms.id,
                       'medicine': ms.medication_item.medicine_name,
                       'scheduled_time': str(ms.scheduled_time),
                   })
        return Response(MedicationScheduleSerializer(ms).data)



# Doctor Views
# Doctor Views
class DoctorDashboardView(APIView):
    permission_classes = [IsDoctor]
    def get(self, request):
        today = timezone.now().date()
        date_7_days = today + timedelta(days=7)
        
        t_start = timezone.make_aware(datetime.combine(today, dtime.min))
        t_end = timezone.make_aware(datetime.combine(today, dtime.max))
        d7_end = timezone.make_aware(datetime.combine(date_7_days, dtime.max))
        
        # Appointments (batched KPIs)
        appointments = Appointment.objects.filter(assigned_doctor=request.user)
        agg = appointments.aggregate(
            appointments_today=Count('id', filter=Q(date_time__gte=t_start, date_time__lte=t_end)),
            upcoming_7_days=Count('id', filter=Q(date_time__gt=t_end, date_time__lte=d7_end)),
            in_progress=Count('id', filter=Q(status='in_progress')),
            completed_today=Count('id', filter=Q(date_time__gte=t_start, date_time__lte=t_end, status='completed')),
            pending_approval=Count('id', filter=Q(status='pending_approval')),
        )
        kpis = {
            'appointments_today': agg['appointments_today'],
            'upcoming_7_days': agg['upcoming_7_days'],
            'in_progress': agg['in_progress'],
            'completed_today': agg['completed_today'],
            'triaged_ready': appointments.filter(date_time__gte=t_start, date_time__lte=t_end, vitals__isnull=False).distinct().count(),
            'pending_review': agg['pending_approval'] + Vital.objects.filter(assigned_to=request.user, status='pending').count()
        }

        # Today's Schedule
        todays_schedule = _with_appointment_relations(
            appointments.filter(date_time__gte=t_start, date_time__lte=t_end)
        ).order_by('date_time')
        schedule_data = AppointmentSerializer(todays_schedule, many=True).data
        
        return Response({'kpis': kpis, 'schedule': schedule_data})

class DoctorAppointmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsDoctor]
    serializer_class = AppointmentSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        # Sort in python for urgency priority
        urgency_map = {'emergency': 0, 'urgent': 1, 'normal': 2}
        results = list(queryset)
        results.sort(key=lambda x: urgency_map.get(x.urgency, 2))
        
        page = self.paginate_queryset(results)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(results, many=True)
        return Response(serializer.data)

    def get_queryset(self):
        qs = _with_appointment_relations(Appointment.objects.filter(assigned_doctor=self.request.user))
        qs = qs.order_by('date_time')
        
        # Date filter
        date_param = self.request.query_params.get('date')
        if date_param == 'today':
            today = timezone.now().date()
            dt_start = timezone.make_aware(datetime.combine(today, dtime.min))
            dt_end = timezone.make_aware(datetime.combine(today, dtime.max))
            qs = qs.filter(date_time__gte=dt_start, date_time__lte=dt_end)
        elif date_param == 'upcoming':
            qs = qs.filter(date_time__gte=timezone.now())
        elif date_param == 'all':
            pass # No date filter
        elif date_param == 'completed':
            qs = qs.filter(status='completed')
            
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        # Urgency filter
        urgency_param = self.request.query_params.get('urgency')
        if urgency_param and urgency_param != 'all':
            qs = qs.filter(urgency=urgency_param)
            
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(patient__username__icontains=search) |
                Q(patient__first_name__icontains=search) |
                Q(patient__last_name__icontains=search)
            )
            
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        appt = self.get_object()
        if appt.status != 'pending_approval':
             return Response({'detail': 'Appointment not pending approval'}, status=400)
        appt.status = 'approved'
        appt.save()
        log_action(request, 'appointment_status', patient=appt.patient,
                   details={'appointment_id': appt.id, 'new_status': 'approved'})
        return Response(AppointmentSerializer(appt).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        appt = self.get_object()
        if appt.status != 'pending_approval':
             return Response({'detail': 'Appointment not pending approval'}, status=400)
        appt.status = 'rejected'
        appt.notes += f"\nRejected by doctor: {request.data.get('reason', 'No reason provided')}"
        appt.save()
        return Response(AppointmentSerializer(appt).data)
    
    @action(detail=False, methods=['get'], url_path=r'patients/(?P<patient_id>\d+)/history')
    def patient_history(self, request, patient_id=None):
        # Strict check: Doctor can only view history if they have at least one appointment with this patient
        # Or if the patient is "assigned" to them in some way. 
        # For now, allow if they have ANY past or future appointment.
        if not Appointment.objects.filter(assigned_doctor=request.user, patient_id=patient_id).exists():
             return Response({"detail": "You do not have permission to view this patient."}, status=403)
        
        appointments = Appointment.objects.filter(patient_id=patient_id).order_by('-date_time')
        return Response(AppointmentSerializer(appointments, many=True).data)

    @action(detail=True, methods=['post'], url_path='nurse-tasks')
    def add_nurse_task(self, request, pk=None):
        appt = self.get_object()
        data = request.data
        
        task = NurseTask.objects.create(
            appointment=appt,
            doctor=request.user,
            task_type=data.get('task_type'),
            details=data.get('details'),
            priority=data.get('priority', 'normal'),
            status='pending'
        )
        return Response(NurseTaskSerializer(task).data)

    @action(detail=True, methods=['post'], url_path='follow-up')
    def follow_up(self, request, pk=None):
        appt = self.get_object()
        data = request.data
        
        # Create new appointment
        new_appt = Appointment.objects.create(
            patient=appt.patient,
            assigned_doctor=request.user, # Keep same doctor
            date_time=data.get('date_time'),
            reason=f"Follow-up: {data.get('reason')}",
            status='approved', # Auto approve follow-up?
            notes=f"Follow-up from appointment on {appt.date_time.date()}"
        )
        return Response(AppointmentSerializer(new_appt).data)

    @action(detail=True, methods=['post'], url_path='consultation')
    def add_consultation(self, request, pk=None):
        appt = self.get_object()
        
        # Check if consultation exists to update or create
        is_update = False
        try:
            consultation = appt.consultation
            serializer = ConsultationSerializer(consultation, data=request.data, partial=True)
            is_update = True
        except Consultation.DoesNotExist:
            serializer = ConsultationSerializer(data=request.data)
            
        if serializer.is_valid():
            serializer.save(appointment=appt, doctor=request.user)
            
            # Update appointment status if provided
            status_val = request.data.get('status_update')
            if status_val:
                appt.status = status_val
                appt.save()
            
            log_action(request,
                       'consultation_updated' if is_update else 'consultation_created',
                       patient=appt.patient,
                       details={'appointment_id': appt.id})
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], url_path='prescriptions')
    def add_prescription(self, request, pk=None):
        appt = self.get_object()
        
        # Ensure consultation exists (auto-create if needed, though ideally flow is Consultation -> Prescription)
        if not hasattr(appt, 'consultation'):
             # Create empty consultation if missing to link prescription
             Consultation.objects.create(appointment=appt, doctor=request.user, diagnosis="Prescription Only")
             appt.refresh_from_db()

        consultation = appt.consultation
        prescription, _ = Prescription.objects.get_or_create(consultation=consultation)
        
        items_data = request.data.get('items', [])
        log_action(request, 'prescription_added', patient=appt.patient,
                   details={'appointment_id': appt.id, 'item_count': len(items_data)})
        created_items = []
        
        # Clear old items if replacing? Or append? usually append or replace entire list. 
        # Let's assume append for now, or if frontend sends full list, we might want to sync.
        # Simple implementation: Add new items.
        
        from datetime import timedelta
        from django.utils import timezone
        
        for item in items_data:
            duration = int(item.get('duration', 1))
            active_until = timezone.now().date() + timedelta(days=duration)
            item['active_until'] = active_until
            item.pop('frequency', None) # Remove it in case old clients still send it
            pi = PrescriptionItem.objects.create(prescription=prescription, **item)
            created_items.append(pi)
            
        return Response({"detail": "Prescription added", "items_count": len(created_items)})

    @action(detail=True, methods=['patch'])
    def status(self, request, pk=None):
        appt = self.get_object()
        appt.status = request.data.get('status')
        appt.save()
        return Response(AppointmentSerializer(appt).data)

# Nurse Views
class NurseQueueView(generics.ListAPIView):
    permission_classes = [IsNurse]
    serializer_class = AppointmentSerializer

    def get_queryset(self):
         return _with_appointment_relations(
             Appointment.objects.filter(status__in=['pending', 'approved', 'in_progress'])
         ).order_by('date_time')

class NurseVitalsViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated] # Allow doctors to view
    queryset = Vital.objects.select_related('recorded_by', 'patient').order_by('-created_at')
    serializer_class = VitalSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    def perform_create(self, serializer):
        vital = serializer.save(recorded_by=self.request.user)
        log_action(self.request, 'vital_recorded', patient=vital.patient, details={'vital_id': vital.id})

    @action(detail=False, methods=['post'], url_path='add')
    def add_vital(self, request):
        patient_id = request.data.get('patient_id')
        # Allow linking to appointment if provided
        appointment_id = request.data.get('appointment_id')
        
        patient = get_object_or_404(User, pk=patient_id, role='patient')
        
        data = request.data.copy()
        data['patient'] = patient.id # Ensure patient is in data for validation
        if appointment_id:
            data['appointment'] = appointment_id
            
        serializer = VitalSerializer(data=data)
        if serializer.is_valid():
            vital = serializer.save(patient=patient, recorded_by=request.user)
            log_action(request, 'vital_recorded', patient=patient, details={
                'vital_id': vital.id,
                'appointment_id': appointment_id,
            })
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class NurseTaskViewSet(viewsets.ModelViewSet):
    permission_classes = [IsNurse]
    serializer_class = NurseTaskSerializer
    
    def get_queryset(self):
        return NurseTask.objects.filter(status__in=['pending', 'in_progress']).select_related('doctor', 'completed_by').order_by('-priority', 'created_at')

    @action(detail=True, methods=['patch'])
    def complete(self, request, pk=None):
        task = self.get_object()
        task.status = 'completed'
        task.completed_by = request.user
        task.completed_at = timezone.now()
        task.save()
        log_action(request, 'nurse_task_completed',
                   patient=task.appointment.patient,
                   details={'task_id': task.id, 'task_type': task.task_type})
        return Response(NurseTaskSerializer(task).data)

class NursePrescriptionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsNurse]
    queryset = PrescriptionItem.objects.filter(administered=False).select_related('administered_by')
    serializer_class = PrescriptionItemSerializer
    
    # Needs to show prescriptions for patients? Or just a list of tasks?
    # "Nurse dashboard must show prescriptions for assigned/related patients/appointments"
    # Implementing a list of unadministered items for now.
    
    @action(detail=True, methods=['patch'])
    def administer(self, request, pk=None):
        item = self.get_object()
        item.administered = True
        item.administered_by = request.user
        item.administered_at = timezone.now()
        item.save()
        # Resolve patient via appointment
        try:
            patient = item.prescription.consultation.appointment.patient
        except Exception:
            patient = None
        log_action(request, 'medication_administered', patient=patient,
                   details={'prescription_item_id': item.id, 'medicine': item.medicine_name})
        return Response({"detail": "Marked as administered"})

class DoctorRemoteVitalsViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsDoctor]
    serializer_class = VitalSerializer
    
    def get_queryset(self):
        # Return vitals assigned to this doctor
        return Vital.objects.filter(assigned_to=self.request.user).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def submit_feedback(self, request, pk=None):
        vital = self.get_object()
        feedback = request.data.get('feedback')
        
        if not feedback:
            return Response({'error': 'Feedback is required'}, status=400)
            
        vital.doctor_feedback = feedback
        vital.feedback_date = timezone.now()
        vital.status = 'reviewed'
        vital.save()
        log_action(request, 'feedback_submitted', patient=vital.patient,
                   details={'vital_id': vital.id, 'feedback_preview': feedback[:120]})
        return Response({'status': 'reviewed', 'feedback': feedback})

class AdminRemoteVitalsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = VitalSerializer
    
    def get_queryset(self):
        # Return all vitals, maybe filter by status if needed
        return Vital.objects.all().order_by('-created_at')

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        vital = self.get_object()
        doctor_id = request.data.get('doctor_id')
        
        doctor = get_object_or_404(User, pk=doctor_id, role='doctor')
        vital.assigned_to = doctor
        vital.status = 'assigned'
        vital.save()
        
        return Response({'status': 'assigned', 'doctor': doctor.username})



class IsAdminOrDoctor(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['admin', 'doctor']


class AuditLogView(generics.ListAPIView):
    """Admin-only: paginated, filterable audit log."""
    permission_classes = [IsAdmin]
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = AuditLog.objects.select_related('actor', 'patient').all()
        action_param = self.request.query_params.get('action')
        if action_param:
            qs = qs.filter(action=action_param)
        actor_id = self.request.query_params.get('actor_id')
        if actor_id:
            qs = qs.filter(actor_id=actor_id)
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        date_from = self.request.query_params.get('date_from')
        if date_from:
            try:
                dt_from = datetime.strptime(date_from, '%Y-%m-%d').date()
                dt_start = timezone.make_aware(datetime.combine(dt_from, dtime.min))
                qs = qs.filter(timestamp__gte=dt_start)
            except ValueError:
                pass
        date_to = self.request.query_params.get('date_to')
        if date_to:
            try:
                dt_to = datetime.strptime(date_to, '%Y-%m-%d').date()
                dt_end = timezone.make_aware(datetime.combine(dt_to, dtime.max))
                qs = qs.filter(timestamp__lte=dt_end)
            except ValueError:
                pass
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(actor__username__icontains=search) |
                Q(actor__first_name__icontains=search) |
                Q(actor__last_name__icontains=search) |
                Q(patient__username__icontains=search) |
                Q(patient__first_name__icontains=search) |
                Q(patient__last_name__icontains=search)
            )
        return qs


class PatientListView(generics.ListAPIView):
    """Search for patients by name, username or ID. Accessible by admin and doctor."""
    permission_classes = [IsAdminOrDoctor]
    serializer_class = UserSerializer

    def get_queryset(self):
        query = self.request.query_params.get('q', '').strip()
        qs = User.objects.filter(role='patient')
        if query:
            filters = (
                Q(username__icontains=query) |
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(email__icontains=query)
            )
            if query.isdigit():
                filters |= Q(id=query)
            qs = qs.filter(filters)
        return qs.order_by('first_name', 'last_name')[:30]


class PatientRecordView(APIView):
    """Return the full medical record of a patient. Accessible by admin and doctor."""
    permission_classes = [IsAdminOrDoctor]

    def get(self, request, patient_id):
        patient = get_object_or_404(User, pk=patient_id, role='patient')

        patient_data = UserSerializer(patient).data
        try:
            profile = patient.patient_profile
            patient_data['profile'] = {
                'date_of_birth': profile.date_of_birth,
                'address': profile.address,
            }
        except PatientProfile.DoesNotExist:
            patient_data['profile'] = None

        appointments = Appointment.objects.filter(patient=patient).order_by('-date_time')
        appointments_data = AppointmentSerializer(appointments, many=True).data

        vitals = Vital.objects.filter(patient=patient).order_by('-created_at')
        vitals_data = VitalSerializer(vitals, many=True).data

        admissions = Admission.objects.filter(patient=patient).order_by('-admitted_at')
        admissions_data = AdmissionSerializer(admissions, many=True).data

        return Response({
            'patient': patient_data,
            'appointments': appointments_data,
            'vitals': vitals_data,
            'admissions': admissions_data,
        })

# -- Patient self-service views ------------------------------------------------

class PatientProfileView(APIView):
    """GET/PATCH the current patient's own profile."""
    permission_classes = [permissions.IsAuthenticated]

    def _get_profile(self, user):
        profile, _ = PatientProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        from .serializers import PatientProfileFullSerializer
        profile = self._get_profile(request.user)
        serializer = PatientProfileFullSerializer(profile, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        from .serializers import PatientProfileFullSerializer
        profile = self._get_profile(request.user)
        serializer = PatientProfileFullSerializer(
            profile, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PatientMyAdmissionView(APIView):
    """GET the logged-in patient's current (latest) admission."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .serializers import PatientAdmissionSerializer
        admission = Admission.objects.filter(
            patient=request.user, status='admitted'
        ).select_related('admitting_doctor').order_by('-admitted_at').first()
        if not admission:
            return Response(None)
        serializer = PatientAdmissionSerializer(admission, context={'request': request})
        return Response(serializer.data)


class PatientPrescriptionsView(APIView):
    """GET all prescriptions for the logged-in patient."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .serializers import PatientPrescriptionSerializer
        prescriptions = Prescription.objects.filter(
            consultation__appointment__patient=request.user
        ).select_related(
            'consultation__appointment',
            'consultation__doctor',
        ).prefetch_related('items').order_by('-created_at')
        serializer = PatientPrescriptionSerializer(prescriptions, many=True, context={'request': request})
        return Response(serializer.data)


class PatientHistoryView(APIView):
    """GET completed appointment history for the logged-in patient."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .serializers import PatientHistorySerializer
        appointments = Appointment.objects.filter(
            patient=request.user,
            status__in=['completed', 'cancelled']
        ).select_related(
            'assigned_doctor',
            'consultation',
        ).prefetch_related(
            'consultation__prescription__items'
        ).order_by('-date_time')
        serializer = PatientHistorySerializer(appointments, many=True, context={'request': request})
        return Response(serializer.data)


class PatientMedicationScheduleView(APIView):
    """
    GET  /patient/med-schedule/
         Returns the authenticated patient's active prescription items with
         computed dose times for today, so the front-end can build a daily
         medication timeline and set up browser reminders.

    PATCH /patient/med-schedule/<item_id>/self-administer/
         Marks a prescription item as self-administered (remote patients).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        items = PrescriptionItem.objects.filter(
            prescription__consultation__appointment__patient=request.user,
            status='active',
        ).filter(
            Q(active_until__isnull=True) | Q(active_until__gte=today)
        ).select_related(
            'prescription__consultation__appointment__assigned_doctor',
            'administered_by',
        ).order_by('id')

        data = []
        for item in items:
            hours = _parse_frequency(item.frequency)
            dose_times = [f"{h:02d}:00" for h in hours]

            # Determine doctor name
            try:
                doc = item.prescription.consultation.appointment.assigned_doctor
                doctor_name = f"{doc.first_name} {doc.last_name}".strip() or doc.username if doc else "—"
            except Exception:
                doctor_name = "—"

            data.append({
                'id': item.id,
                'medicine_name': item.medicine_name,
                'dosage': item.dosage,
                'frequency': item.frequency,
                'route': item.route or '',
                'instructions': item.instructions,
                'duration': item.duration,
                'active_until': item.active_until,
                'status': item.status,
                'administered': item.administered,
                'administered_at': item.administered_at,
                'administered_by_name': item.administered_by.username if item.administered_by else None,
                'dose_times': dose_times,   # e.g. ["08:00", "20:00"]
                'morning': item.morning,
                'afternoon': item.afternoon,
                'evening': item.evening,
                'doctor_name': doctor_name,
            })

        return Response(data)

    def patch(self, request, item_id=None):
        """Mark a prescription item dose as self-administered by the patient."""
        item = get_object_or_404(
            PrescriptionItem,
            pk=item_id,
            prescription__consultation__appointment__patient=request.user,
        )
        
        period = request.data.get('period')
        today_str = timezone.now().strftime('%Y-%m-%d')
        
        if not period:
            item.administered = True
        else:
            doses = item.administered_doses or {}
            if today_str not in doses:
                doses[today_str] = []
            if period not in doses[today_str]:
                doses[today_str].append(period)
            item.administered_doses = doses

        item.administered_by = request.user
        item.administered_at = timezone.now()
        item.save()
        
        try:
            patient = item.prescription.consultation.appointment.patient
        except Exception:
            patient = request.user
        log_action(request, 'medication_administered', patient=patient,
                   details={'prescription_item_id': item.id, 'medicine': item.medicine_name, 'period': period})
        return Response({'detail': f'Marked {period or "all"} as taken.'})


# ─── Staff Availability Toggle ────────────────────────────────────────────────

class StaffAvailabilityView(APIView):
    """
    PATCH /me/availability/
    Toggles or sets is_on_duty for the logged-in doctor or nurse.
    Body: { "is_on_duty": true }   — or omit to flip current value.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        user = request.user
        if user.role not in ('doctor', 'nurse'):
            return Response(
                {'detail': 'Only doctors and nurses have an availability status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get or create the role-specific profile
        if user.role == 'doctor':
            profile, _ = DoctorProfile.objects.get_or_create(user=user)
        else:
            profile, _ = NurseProfile.objects.get_or_create(user=user)

        # If caller supplies explicit value use it; otherwise toggle
        new_value = request.data.get('is_on_duty')
        if new_value is None:
            profile.is_on_duty = not profile.is_on_duty
        else:
            profile.is_on_duty = bool(new_value)

        profile.save()
        return Response({
            'is_on_duty': profile.is_on_duty,
            'detail': f"You are now {'ON DUTY 🟢' if profile.is_on_duty else 'OFF DUTY 🔴'}",
        })


# ─── Admin: Remote Patients List ──────────────────────────────────────────────

class AdminRemotePatientsView(generics.ListAPIView):
    """
    GET /admin/remote-patients/
    Returns patients who have active prescriptions (status='active') but are NOT
    currently admitted (no Admission with status='admitted').
    Optional ?q= search by name / username.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        query = request.query_params.get('q', '').strip()

        # IDs of currently admitted patients
        admitted_ids = Admission.objects.filter(
            status='admitted'
        ).values_list('patient_id', flat=True)

        # Patients with at least one active prescription item
        today = timezone.now().date()
        patients_with_rx = User.objects.filter(
            role='patient',
            appointments__consultation__prescription__items__status='active',
        ).filter(
            Q(appointments__consultation__prescription__items__active_until__isnull=True) |
            Q(appointments__consultation__prescription__items__active_until__gte=today)
        ).exclude(
            id__in=admitted_ids
        ).distinct()

        if query:
            patients_with_rx = patients_with_rx.filter(
                Q(username__icontains=query) |
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query)
            )

        data = []
        for patient in patients_with_rx.order_by('first_name', 'last_name')[:50]:
            # Active prescription items
            active_items = PrescriptionItem.objects.filter(
                prescription__consultation__appointment__patient=patient,
                status='active',
            ).filter(
                Q(active_until__isnull=True) | Q(active_until__gte=today)
            )

            # Last doctor from appointment
            last_appt = Appointment.objects.filter(
                patient=patient,
                assigned_doctor__isnull=False,
            ).order_by('-date_time').first()

            # Last vital
            last_vital = Vital.objects.filter(patient=patient).order_by('-created_at').first()

            # Profile
            try:
                profile = patient.patient_profile
                phone = profile.contact_number
                blood_group = profile.blood_group
            except Exception:
                phone = None
                blood_group = None

            data.append({
                'id': patient.id,
                'username': patient.username,
                'full_name': f"{patient.first_name} {patient.last_name}".strip() or patient.username,
                'email': patient.email,
                'phone': phone,
                'blood_group': blood_group,
                'doctor_name': (
                    f"{last_appt.assigned_doctor.first_name} {last_appt.assigned_doctor.last_name}".strip()
                    or last_appt.assigned_doctor.username
                ) if last_appt else None,
                'active_prescriptions': active_items.count(),
                'active_medications': [
                    f"{i.medicine_name} {i.dosage} ({i.frequency})"
                    for i in active_items[:3]
                ],
                'last_vital_date': last_vital.created_at if last_vital else None,
                'last_vital_status': last_vital.status if last_vital else None,
            })

        return Response(data)


# ─── Admin: Admit Patient ─────────────────────────────────────────────────────

class AdminAdmitPatientView(APIView):
    """
    POST /admin/admit/
    Admits a patient (inpatient). Creates an Admission record.
    Body: { patient_id, ward, bed_number, doctor_id, nurse_id (opt), notes (opt) }
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        patient_id = request.data.get('patient_id')
        ward = request.data.get('ward', '').strip()
        bed_number = request.data.get('bed_number', '').strip()
        doctor_id = request.data.get('doctor_id')
        nurse_id = request.data.get('nurse_id')
        notes = request.data.get('notes', '')

        if not patient_id or not ward:
            return Response({'detail': 'patient_id and ward are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check patient exists and is a patient
        patient = get_object_or_404(User, pk=patient_id, role='patient')

        # Prevent double-admission
        if Admission.objects.filter(patient=patient, status='admitted').exists():
            return Response({'detail': f'{patient.first_name or patient.username} is already admitted.'}, status=status.HTTP_400_BAD_REQUEST)

        # Resolve doctor
        doctor = None
        if doctor_id:
            try: doctor = User.objects.get(pk=doctor_id, role='doctor')
            except User.DoesNotExist: pass

        # Resolve nurse
        nurse = None
        if nurse_id:
            try: nurse = User.objects.get(pk=nurse_id, role='nurse')
            except User.DoesNotExist: pass

        admission = Admission.objects.create(
            patient=patient,
            admitting_doctor=doctor,
            assigned_nurse=nurse,
            ward=ward,
            bed_number=bed_number,
            notes=notes,
        )
        log_action(request, 'patient_admitted', patient=patient, details={
            'admission_id': admission.id,
            'ward': ward,
            'bed_number': bed_number,
        })
        return Response(AdminAdmissionSerializer(admission).data, status=status.HTTP_201_CREATED)


class AdminAdmissionDetailView(APIView):
    """GET /admin/admissions/<id>/detail/ — Rich admission detail with patient, NOK, meds, allocation."""
    permission_classes = [IsAdmin]

    def get(self, request, pk):
        admission = get_object_or_404(Admission, pk=pk)
        return Response(AdminAdmissionSerializer(admission).data)

    def patch(self, request, pk):
        """Update ward/bed/doctor/nurse allocation."""
        admission = get_object_or_404(Admission, pk=pk)
        for field in ('ward', 'bed_number', 'notes'):
            if field in request.data:
                setattr(admission, field, request.data[field])
        if 'doctor_id' in request.data:
            try: admission.admitting_doctor = User.objects.get(pk=request.data['doctor_id'], role='doctor')
            except User.DoesNotExist: pass
        if 'nurse_id' in request.data:
            try: admission.assigned_nurse = User.objects.get(pk=request.data['nurse_id'], role='nurse')
            except User.DoesNotExist: admission.assigned_nurse = None
        if request.data.get('nurse_id') == '' or request.data.get('nurse_id') is None and 'nurse_id' in request.data:
            admission.assigned_nurse = None
        admission.save()
        return Response(AdminAdmissionSerializer(admission).data)


# ─── Admin: Remote Monitoring ─────────────────────────────────────────────────

class RemoteMonitoringViewSet(viewsets.ModelViewSet):
    """
    GET  /admin/remote-monitoring/         - list active monitored patients
    POST /admin/remote-monitoring/         - enroll a patient
    GET  /admin/remote-monitoring/<id>/    - detail
    PATCH /admin/remote-monitoring/<id>/   - update notes / doctor
    DELETE /admin/remote-monitoring/<id>/  - discharge from monitoring (sets active=False)
    POST /admin/remote-monitoring/<id>/feedback/ - send feedback on a vital record
    """
    permission_classes = [IsAdmin]
    serializer_class = RemoteMonitoringSerializer

    def get_queryset(self):
        qs = RemoteMonitoring.objects.all().order_by('-enrolled_at')
        active = self.request.query_params.get('active', 'true')
        if active == 'true':
            qs = qs.filter(active__in=[True])
        elif active == 'false':
            qs = qs.filter(active__in=[False])
        return qs

    def perform_create(self, serializer):
        patient_id = self.request.data.get('patient')
        # Prevent duplicate active monitoring for same patient
        if RemoteMonitoring.objects.filter(patient_id=patient_id, active__in=[True]).exists():
            raise serializers.ValidationError({'detail': 'This patient is already under active remote monitoring.'})
        rm = serializer.save(enrolled_by=self.request.user)
        log_action(self.request, 'remote_monitoring_enrolled', patient=rm.patient, details={})

    def destroy(self, request, *args, **kwargs):
        """Soft-delete: set active=False instead of deleting."""
        instance = self.get_object()
        instance.active = False
        instance.save()
        return Response({'detail': 'Patient removed from active monitoring.'})

    @action(detail=True, methods=['post'], url_path='feedback')
    def send_feedback(self, request, pk=None):
        """POST /admin/remote-monitoring/<id>/feedback/
        Body: { vital_id, feedback }
        Sends feedback on a specific vital submission.
        """
        monitoring = self.get_object()
        vital_id = request.data.get('vital_id')
        feedback_text = request.data.get('feedback', '').strip()

        if not vital_id or not feedback_text:
            return Response({'detail': 'vital_id and feedback are required.'}, status=status.HTTP_400_BAD_REQUEST)

        vital = get_object_or_404(Vital, pk=vital_id, patient=monitoring.patient)
        vital.doctor_feedback = feedback_text
        vital.feedback_date = timezone.now()
        vital.status = 'reviewed'
        vital.save()
        log_action(request, 'vital_feedback_sent', patient=monitoring.patient,
                   details={'vital_id': vital.id, 'monitoring_id': monitoring.id})
        return Response({'detail': 'Feedback sent successfully.', 'vital_id': vital.id})

class DoctorRemoteMonitoringViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /doctor/remote-monitoring-patients/
    POST /doctor/remote-monitoring-patients/<id>/feedback/
    """
    permission_classes = [IsDoctor]
    serializer_class = RemoteMonitoringSerializer

    def get_queryset(self):
        qs = RemoteMonitoring.objects.all().order_by('-enrolled_at')
        active = self.request.query_params.get('active', 'true')
        if active == 'true':
            qs = qs.filter(active__in=[True])
        elif active == 'false':
            qs = qs.filter(active__in=[False])
        return qs

    @action(detail=True, methods=['post'], url_path='feedback')
    def send_feedback(self, request, pk=None):
        monitoring = self.get_object()
        vital_id = request.data.get('vital_id')
        feedback_text = request.data.get('feedback', '').strip()

        if not vital_id or not feedback_text:
            return Response({'detail': 'vital_id and feedback are required.'}, status=status.HTTP_400_BAD_REQUEST)

        vital = get_object_or_404(Vital, pk=vital_id, patient=monitoring.patient)
        vital.doctor_feedback = feedback_text
        vital.feedback_date = timezone.now()
        vital.status = 'reviewed'
        vital.doctor = request.user
        vital.save()
        log_action(request, 'doctor_vital_feedback_sent', patient=monitoring.patient,
                   details={'vital_id': vital.id, 'monitoring_id': monitoring.id})
        return Response({'detail': 'Feedback sent successfully.', 'vital_id': vital.id})

    @action(detail=True, methods=['post'], url_path='prescribe')
    def prescribe(self, request, pk=None):
        monitoring = self.get_object()
        patient = monitoring.patient
        
        # Ensure a recent consultation exists
        latest_appt = Appointment.objects.filter(patient=patient, status='completed').order_by('-date_time').first()
        if not latest_appt:
            latest_appt = Appointment.objects.create(patient=patient, assigned_doctor=request.user, date_time=timezone.now(), reason='Remote Assessment Rx', status='completed')
            Consultation.objects.create(appointment=latest_appt, doctor=request.user, clinical_notes="Remote Assessment Rx")
            
        consultation = latest_appt.consultation
        prescription, _ = Prescription.objects.get_or_create(consultation=consultation)
        
        data = request.data
        item = PrescriptionItem.objects.create(
            prescription=prescription,
            medicine_name=data.get('medicine_name'),
            dosage=data.get('dosage'),
            route=data.get('route', 'PO'),
            morning=data.get('morning', False),
            afternoon=data.get('afternoon', False),
            evening=data.get('evening', False),
            duration=int(data.get('duration_days', 1)),
            instructions=data.get('instructions', ''),
            status='active'
        )
        
        from datetime import timedelta
        item.active_until = timezone.now().date() + timedelta(days=item.duration)
        item.save()
        
        return Response({'detail': 'Remote Prescription issued successfully.'}, status=status.HTTP_201_CREATED)


class AIAssistantContextView(APIView):
    """GET /api/ai/context/ — returns live role-scoped summary & suggested questions."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .ai_assistant import build_live_context, get_role_suggestions
        ctx = build_live_context(request.user)
        return Response({
            'role': ctx['role'],
            'generated_at': ctx['generated_at'],
            'summary': ctx.get('summary', {}),
            'suggestions': get_role_suggestions(ctx['role']),
        })


class AIAssistantChatView(APIView):
    """POST /api/ai/chat/ — answers user questions directly from live DB state."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .ai_assistant import generate_ai_reply
        question = request.data.get('message', '')
        history = request.data.get('history', [])
        if not isinstance(history, list):
            history = []
        result = generate_ai_reply(request.user, question, history=history)
        return Response(result)
