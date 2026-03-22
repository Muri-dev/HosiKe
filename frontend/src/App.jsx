import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UsersPage from './pages/admin/Users';
import AdminAppointments from './pages/admin/Appointments';
import ReportsPage from './pages/admin/Reports';

// Doctor Pages
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorAppointments from './pages/doctor/DoctorAppointments';
import DoctorWorkbench from './pages/doctor/DoctorWorkbench';
import RemoteMonitoring from './pages/doctor/RemoteMonitoring';
import DoctorRequests from './pages/doctor/DoctorRequests';

// Nurse Pages
import NurseDashboard from './pages/nurse/NurseDashboard';

// Patient Pages
import PatientDashboard from './pages/patient/PatientDashboard';

// Messaging
import MessagingPage from './pages/messaging/MessagingPage';

// Inpatient Pages
import DoctorInpatients from './pages/doctor/DoctorInpatients';
import AdmissionDetails from './pages/doctor/AdmissionDetails';
import AdminInpatientOrders from './pages/admin/AdminInpatientOrders';
import AdminRemoteReferrals from './pages/admin/AdminRemoteReferrals';
import AdminAdmissions from './pages/admin/AdminAdmissions';
import AuditLogPage from './pages/admin/AuditLog';
import NurseMedications from './pages/nurse/NurseMedications';
import PatientSearch from './pages/shared/PatientSearch';
import MyProfile from './pages/shared/MyProfile';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin', 'doctor', 'nurse', 'patient']} />}>
          <Route element={<Layout />}>
            {/* Common Routes — all authenticated roles */}
            <Route path="/messages" element={<MessagingPage />} />
            <Route path="/profile" element={<MyProfile />} />

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/overview" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/appointments" element={<AdminAppointments />} />
              <Route path="/admin/admissions" element={<AdminAdmissions />} />
              <Route path="/admin/reports" element={<ReportsPage />} />
              <Route path="/admin/inpatient-orders" element={<AdminInpatientOrders />} />
              <Route path="/admin/remote-referrals" element={<AdminRemoteReferrals />} />
              <Route path="/admin/patients" element={<PatientSearch />} />
              <Route path="/admin/audit-log" element={<AuditLogPage />} />
              <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
            </Route>

            {/* Doctor Routes */}
            <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
              <Route path="/doctor" element={<DoctorDashboard />} />
              <Route path="/doctor/appointments" element={<DoctorAppointments />} />
              <Route path="/doctor/appointments/:id" element={<DoctorWorkbench />} />
              <Route path="/doctor/inpatients" element={<DoctorInpatients />} />
              <Route path="/doctor/inpatients/:id" element={<AdmissionDetails />} />
              <Route path="/doctor/requests" element={<DoctorRequests />} />
              <Route path="/doctor/remote-monitoring" element={<RemoteMonitoring />} />
              <Route path="/doctor/patients" element={<PatientSearch />} />
            </Route>

            {/* Nurse Routes */}
            <Route element={<ProtectedRoute allowedRoles={['nurse']} />}>
              <Route path="/nurse/queue" element={<NurseDashboard />} />
              <Route path="/nurse/medications" element={<NurseMedications />} />
              <Route path="/nurse/vitals/add" element={<NurseDashboard />} />
              <Route path="/nurse/patients" element={<PatientSearch />} />
              <Route path="/nurse" element={<Navigate to="/nurse/queue" replace />} />
            </Route>

            {/* Patient Routes */}
            <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
              {/* Re-using same component, it should ideally handle tab switching via props or route */}
              <Route path="/patient/me" element={<PatientDashboard />} />
              <Route path="/patient/appointments" element={<PatientDashboard />} />
              <Route path="/patient/vitals" element={<PatientDashboard />} />
              <Route path="/patient/feedback" element={<PatientDashboard />} />
              <Route path="/patient/book" element={<PatientDashboard />} />
              <Route path="/patient" element={<Navigate to="/patient/me" replace />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
