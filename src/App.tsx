import { ReactNode } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import DailyCare from './pages/DailyCare';
import StructuredDailyCapture from './pages/StructuredDailyCapture';
import Companion from './pages/Companion';
import Community from './pages/Community';
import ProfessionalDashboard from './pages/ProfessionalDashboard';
import TeamDashboard from './pages/TeamDashboard';
import Insights from './pages/Insights';
import Timeline from './pages/Timeline';
import Record from './pages/Record';
import Memory from './pages/Memory';
import CareCircle from './pages/CareCircle';
import Login from './pages/Login';
import { getAccessToken } from './api/client';
import InvestorDashboard from './pages/InvestorDashboard';

function ProtectedRoute({ children }: { children: ReactNode }) {
  return getAccessToken()
    ? <>{children}</>
    : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/daily-care" element={<ProtectedRoute><DailyCare /></ProtectedRoute>} />
        <Route path="/structured-daily-capture" element={<ProtectedRoute><StructuredDailyCapture /></ProtectedRoute>} />
        <Route path="/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
        <Route path="/record" element={<ProtectedRoute><Record /></ProtectedRoute>} />
        <Route path="/memory" element={<ProtectedRoute><Memory /></ProtectedRoute>} />
        <Route path="/care-circle" element={<ProtectedRoute><CareCircle /></ProtectedRoute>} />
        <Route path="/companion" element={<ProtectedRoute><Companion /></ProtectedRoute>} />
        <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
        <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
        <Route path="/professional" element={<ProtectedRoute><ProfessionalDashboard /></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute><TeamDashboard /></ProtectedRoute>} />
        <Route path="/investor/dashboard" element={<ProtectedRoute><InvestorDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
