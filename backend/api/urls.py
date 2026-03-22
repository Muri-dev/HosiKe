from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    MeView,
    AvatarUploadView,
    UserAvatarView,
    UserSearchView,
    NotificationView,
    AdminDashboardView,
    DoctorDashboardView,
    UserViewSet,
    AdminAppointmentViewSet,
    DoctorAppointmentViewSet,
    PatientAppointmentViewSet,
    PatientVitalsView,
    NurseQueueView,
    NurseVitalsViewSet,
    ConversationViewSet,
    NursePrescriptionViewSet,
    NurseTaskViewSet,
    AdmissionViewSet,
    InpatientOrderViewSet,
    NurseShiftViewSet,
    MedicationScheduleViewSet,
    AdminRemoteVitalsViewSet,
    DoctorRemoteVitalsViewSet,
    PatientListView,
    PatientRecordView,
    PatientProfileView,
    PatientMyAdmissionView,
    PatientPrescriptionsView,
    PatientHistoryView,
    AuditLogView,
)

router = DefaultRouter()
router.register(r'admin/users', UserViewSet, basename='admin-users')
router.register(r'admin/appointments', AdminAppointmentViewSet, basename='admin-appointments')
router.register(r'doctor/appointments', DoctorAppointmentViewSet, basename='doctor-appointments')
router.register(r'patient/appointments', PatientAppointmentViewSet, basename='patient-appointments')
router.register(r'conversations', ConversationViewSet, basename='conversations')
router.register(r'nurse/prescriptions', NursePrescriptionViewSet, basename='nurse-prescriptions')
router.register(r'nurse/tasks', NurseTaskViewSet, basename='nurse-tasks')
router.register(r'admissions', AdmissionViewSet, basename='admissions')
router.register(r'inpatient-orders', InpatientOrderViewSet, basename='inpatient-orders')
router.register(r'admin/shifts', NurseShiftViewSet, basename='nurse-shifts')
router.register(r'nurse/med-queue', MedicationScheduleViewSet, basename='med-queue')
router.register(r'vitals', NurseVitalsViewSet, basename='vitals')
router.register(r'doctor/remote-vitals', DoctorRemoteVitalsViewSet, basename='remote-vitals')
router.register(r'admin/remote-vitals', AdminRemoteVitalsViewSet, basename='admin-remote-vitals')

urlpatterns = [
    # Auth
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('me/avatar/', AvatarUploadView.as_view(), name='me-avatar'),
    path('admin/users/<int:user_id>/avatar/', UserAvatarView.as_view(), name='user-avatar'),
    path('search/users/', UserSearchView.as_view(), name='search-users'),
    path('notifications/', NotificationView.as_view(), name='notifications'),

    # Admin
    path('admin/overview/', AdminDashboardView.as_view(), name='admin-overview'),
    path('admin/audit-log/', AuditLogView.as_view(), name='audit-log'),
    
    # Doctor
    path('doctor/dashboard/', DoctorDashboardView.as_view(), name='doctor-dashboard'),
    
    # Nurse
    path('nurse/queue/', NurseQueueView.as_view(), name='nurse-queue'),
    path('nurse/vitals/add/', NurseVitalsViewSet.as_view({'post': 'add_vital'}), name='nurse-add-vital'),
    
    # Patient Records (admin & doctor)
    path('patients/', PatientListView.as_view(), name='patient-list'),
    path('patients/<int:patient_id>/record/', PatientRecordView.as_view(), name='patient-record'),

    # Patient
    path('patient/me/', PatientProfileView.as_view(), name='patient-profile'),
    path('patient/admission/', PatientMyAdmissionView.as_view(), name='patient-admission'),
    path('patient/prescriptions/mine/', PatientPrescriptionsView.as_view(), name='patient-prescriptions'),
    path('patient/history/', PatientHistoryView.as_view(), name='patient-history'),
    path('patient/vitals/mine/', PatientVitalsView.as_view(), name='patient-vitals'),
    path('appointments/book/', PatientAppointmentViewSet.as_view({'post': 'create'}), name='book-appointment'),
    path('appointments/mine/', PatientAppointmentViewSet.as_view({'get': 'list'}), name='my-appointments'),
    path('appointments/<int:pk>/cancel/', PatientAppointmentViewSet.as_view({'patch': 'cancel'}), name='cancel-appointment'),

    # ViewSets
    path('', include(router.urls)),
]
