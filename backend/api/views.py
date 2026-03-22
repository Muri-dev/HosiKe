from rest_framework import viewsets, permissions, status, generics, parsers
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from .models import User, Appointment, Vital, Consultation, PatientProfile, DoctorProfile, NurseProfile, Prescription, PrescriptionItem, Conversation, Message, NurseTask, Admission, InpatientOrder, MedicationItem, MedicationSchedule, NurseShift, AuditLog
from .serializers import (
    UserSerializer, FullUserSerializer, AppointmentSerializer, CreateAppointmentSerializer,
    VitalSerializer, ConsultationSerializer, CreateUserSerializer,
    ConversationSerializer, MessageSerializer, PrescriptionItemSerializer, NurseTaskSerializer,
    AdmissionSerializer, InpatientOrderSerializer, MedicationScheduleSerializer, NurseShiftSerializer,
    AuditLogSerializer, _create_or_update_profile,
)

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
        data['messages'] = Message.objects.filter(
            conversation__participants=user,
            is_read=False
        ).exclude(sender=user).count()

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
            data['appointments'] = Appointment.objects.filter(assigned_doctor=user, date_time__date=today, status='approved').count()

        elif user.role == 'nurse':
            # Due Medications (Schduled and time passed)
            now = timezone.now()
            # Logic: Scheduled, not administered, time <= now
            # This might be heavy if many records, limit to recent/today?
            # For now, just 'due'
            data['medications'] = MedicationSchedule.objects.filter(
                status='scheduled', 
                scheduled_time__lte=now
            ).count()

        elif user.role == 'patient':
            # Approved Appointments (Upcoming)
            # data['appointments'] = Appointment.objects.filter(patient=user, status='approved', date_time__gt=timezone.now()).count()
            pass

        return Response(data)

class AdminDashboardView(APIView):
    permission_classes = [IsAdmin]
    def get(self, request):
        today = timezone.now().date()
        last_30_days = today - timedelta(days=30)
        
        # KPIs
        total_patients = User.objects.filter(role='patient').count()
        total_doctors = User.objects.filter(role='doctor').count()
        total_nurses = User.objects.filter(role='nurse').count()
        appointments_today = Appointment.objects.filter(date_time__date=today).count()
        pending_appointments = Appointment.objects.filter(status='pending').count()
        completed_today = Appointment.objects.filter(date_time__date=today, status='completed').count()
        unassigned_today = Appointment.objects.filter(date_time__date=today, assigned_doctor__isnull=True).count()

        # Trend (Last 30 days)
        # SQLite doesn't support TruncDate easily in all versions, doing simple python processing for compatibility/simplicity
        # In production with Postgres, use TruncDate.
        trend_data = []
        for i in range(7):
            day = today - timedelta(days=i)
            count = Appointment.objects.filter(date_time__date=day).count()
            trend_data.append({"date": day.strftime('%Y-%m-%d'), "count": count})
        trend_data.reverse()

        # Status Distribution
        status_counts = Appointment.objects.values('status').annotate(count=Count('status'))
        
        # Doctor Workload Today
        doctor_workload = Appointment.objects.filter(date_time__date=today, assigned_doctor__isnull=False).values('assigned_doctor__username', 'assigned_doctor__first_name', 'assigned_doctor__last_name').annotate(count=Count('id'))
        
        # Recent Activity (Mocking simple activity from latest appointments)
        recent_activity = []
        latest_appts = Appointment.objects.all().order_by('-created_at')[:5]
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
                'unassigned_appointments': unassigned_today
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
        queryset = User.objects.all().order_by('-date_joined')

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
        qs = Appointment.objects.all().order_by('-date_time')
        
        # Filter by Status
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param)
            
        # Filter by Date Range
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(date_time__date__gte=date_from)
        if date_to:
            qs = qs.filter(date_time__date__lte=date_to)

        # Filter by Doctor
        doctor_id = self.request.query_params.get('doctor_id')
        if doctor_id:
            qs = qs.filter(assigned_doctor_id=doctor_id)
            
        # Filter by Nurse
        nurse_id = self.request.query_params.get('nurse_id')
        if nurse_id:
            qs = qs.filter(assigned_nurse_id=nurse_id)
            
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
        return Appointment.objects.filter(patient=self.request.user).order_by('-date_time')

    def create(self, request, *args, **kwargs):
        serializer = CreateAppointmentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(patient=request.user, status='pending')
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
        return Vital.objects.filter(patient=self.request.user).order_by('-created_at')

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
        return self.request.user.conversations.all().order_by('-updated_at')

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
        count = Message.objects.filter(
            conversation__participants=request.user,
            is_read=False
        ).exclude(sender=request.user).count()
        return Response({'count': count})

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        conversation = self.get_object()
        # Mark all messages in this conversation as read where user is NOT the sender
        updated_count = conversation.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)
        return Response({'marked_read': updated_count})

# --- Inpatient Workflows ---

class AdmissionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AdmissionSerializer
    queryset = Admission.objects.all().order_by('-admitted_at')

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get('status')
        if status: qs = qs.filter(status=status)
        
        patient_id = self.request.query_params.get('patient_id')
        if patient_id: qs = qs.filter(patient_id=patient_id)
            
        return qs

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
        data = request.data
        items_data = data.pop('medication_items', [])
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save(doctor=request.user)

        # Create Items & Generate Schedules (Simple logic)
        for item in items_data:
            med_item = MedicationItem.objects.create(order=order, **item)
            # Auto-schedule logic: Generate "n" doses based on duration * freq
            # Simplistic: Just create one "scheduled" dose for starts_at for demo
            MedicationSchedule.objects.create(
                medication_item=med_item,
                scheduled_time=med_item.start_datetime,
                status='scheduled'
            )
            # In a real app, parse "q8h" and loop

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
        qs = MedicationSchedule.objects.all().order_by('scheduled_time')
        
        if user.role == 'nurse':
            # My queue or my ward
            qs = qs.filter(assigned_nurse=user)
        
        scope = self.request.query_params.get('scope')
        now = timezone.now()
        if scope == 'due':
            qs = qs.filter(scheduled_time__lte=now, status='scheduled')
        elif scope == 'upcoming':
            qs = qs.filter(scheduled_time__gt=now, status='scheduled')
            
        return qs

    @action(detail=True, methods=['patch'])
    def administer(self, request, pk=None):
        ms = self.get_object()
        ms.status = 'administered'
        ms.administered_at = timezone.now()
        ms.administered_by = request.user
        ms.notes = request.data.get('notes', '')
        ms.save()
        log_action(request, 'medication_administered',
                   patient=ms.medication_item.order.admission.patient,
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
        
        # Appointments
        appointments = Appointment.objects.filter(assigned_doctor=request.user)
        
        kpis = {
            'appointments_today': appointments.filter(date_time__date=today).count(),
            'upcoming_7_days': appointments.filter(date_time__date__gt=today, date_time__date__lte=date_7_days).count(),
            'in_progress': appointments.filter(status='in_progress').count(),
            'completed_today': appointments.filter(date_time__date=today, status='completed').count(),
            'triaged_ready': appointments.filter(date_time__date=today, vitals__isnull=False).distinct().count(),
            'pending_review': appointments.filter(status='pending_approval').count() + Vital.objects.filter(assigned_to=request.user, status='pending').count()
        }
        
        # Today's Schedule
        todays_schedule = appointments.filter(date_time__date=today).order_by('date_time')
        schedule_data = AppointmentSerializer(todays_schedule, many=True).data
        
        return Response({'kpis': kpis, 'schedule': schedule_data})

class DoctorAppointmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsDoctor]
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        qs = Appointment.objects.filter(assigned_doctor=self.request.user).order_by('date_time')
        
        # Filters
        date_param = self.request.query_params.get('date')
        if date_param == 'today':
            qs = qs.filter(date_time__date=timezone.now().date())
        elif date_param == 'upcoming':
            qs = qs.filter(date_time__gte=timezone.now())
        elif date_param == 'all':
            pass # No date filter
        elif date_param == 'completed':
            qs = qs.filter(status='completed')
            
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
            
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
        
        for item in items_data:
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
         return Appointment.objects.filter(status__in=['pending', 'approved', 'in_progress']).order_by('date_time')

class NurseVitalsViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated] # Allow doctors to view
    queryset = Vital.objects.all().order_by('-created_at')
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
        return NurseTask.objects.filter(status__in=['pending', 'in_progress']).order_by('-priority', 'created_at')

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
    queryset = PrescriptionItem.objects.filter(administered=False)
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
            qs = qs.filter(timestamp__date__gte=date_from)
        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)
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
        ).order_by('-admitted_at').first()
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
