from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import User, PatientProfile, DoctorProfile, NurseProfile, Appointment, Vital
from datetime import timedelta

class Command(BaseCommand):
    help = 'Seeds the database with initial data'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding data...')
        
        # Create Users
        admin, _ = User.objects.get_or_create(username='admin1', defaults={'email': 'admin@hospital.com', 'role': 'admin', 'first_name': 'Super', 'last_name': 'Admin'})
        admin.set_password('pass1234')
        admin.save()

        doctor, _ = User.objects.get_or_create(username='doctor1', defaults={'email': 'doctor@hospital.com', 'role': 'doctor', 'first_name': 'Gregory', 'last_name': 'House'})
        doctor.set_password('pass1234')
        doctor.save()
        DoctorProfile.objects.get_or_create(user=doctor, defaults={'specialization': 'Diagnostic Medicine', 'department': 'Diagnostics'})

        nurse, _ = User.objects.get_or_create(username='nurse1', defaults={'email': 'nurse@hospital.com', 'role': 'nurse', 'first_name': 'Carla', 'last_name': 'Espinosa'})
        nurse.set_password('pass1234')
        nurse.save()
        NurseProfile.objects.get_or_create(user=nurse, defaults={'department': 'General'})

        patient, _ = User.objects.get_or_create(username='patient1', defaults={'email': 'patient@hospital.com', 'role': 'patient', 'first_name': 'John', 'last_name': 'Doe'})
        patient.set_password('pass1234')
        patient.save()
        PatientProfile.objects.get_or_create(user=patient, defaults={'date_of_birth': '1990-01-01', 'address': '123 Baker St'})

        # Create Appointments
        now = timezone.now()
        Appointment.objects.get_or_create(patient=patient, date_time=now + timedelta(days=1), defaults={'reason': 'Checkup', 'status': 'pending'})
        Appointment.objects.get_or_create(patient=patient, date_time=now - timedelta(days=1), defaults={'reason': 'Flu', 'status': 'completed', 'assigned_doctor': doctor})
        
        # Create Vitals
        Vital.objects.get_or_create(patient=patient, defaults={'recorded_by': nurse, 'temperature': 36.6, 'blood_pressure': '120/80', 'heart_rate': 72, 'weight': 70.5})

        self.stdout.write(self.style.SUCCESS('Data seeded successfully'))
