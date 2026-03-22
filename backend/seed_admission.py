import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hospital_backend.settings")
django.setup()

from api.models import User, Admission

try:
    patient = User.objects.get(username='patient1')
    doctor = User.objects.filter(role='doctor').first()
    
    # Create admission
    adm = Admission.objects.create(
        patient=patient,
        admitting_doctor=doctor,
        ward='ICU',
        bed_number='101',
        status='admitted'
    )
    print(f"Created admission for {patient.username} in {adm.ward}")
except Exception as e:
    print(e)
