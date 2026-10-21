import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import DailyCare from './pages/DailyCare'
import StructuredDailyCapture from './pages/StructuredDailyCapture'
import Companion from './pages/Companion'
import Community from './pages/Community'
import ProfessionalDashboard from './pages/ProfessionalDashboard'
import TeamDashboard from './pages/TeamDashboard'
import Insights from './pages/Insights'
import Timeline from './pages/Timeline'
import Record from './pages/Record'
import Memory from './pages/Memory'
import CareCircle from './pages/CareCircle'
import Appointments from './pages/Appointments'
import Login from './pages/Login'
import InvestorDashboard from './pages/InvestorDashboard'

export default function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/daily-care" element={<DailyCare />} />
        <Route path="/structured-daily-capture" element={<StructuredDailyCapture />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/record" element={<Record />} />
        <Route path="/memory" element={<Memory />} />
        <Route path="/care-circle" element={<CareCircle />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/companion" element={<Companion />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/community" element={<Community />} />
        <Route path="/professional" element={<ProfessionalDashboard />} />
        <Route path="/team" element={<TeamDashboard />} />
        <Route path="/investor/dashboard" element={<InvestorDashboard />} />
       </Routes>
    </div>
  )
}
