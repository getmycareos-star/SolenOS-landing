import { Routes, Route } from 'react-router-dom'
import { RequireAuth } from './components/AuthProvider'
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
import Login from './pages/Login'
import InvestorDashboard from './pages/InvestorDashboard'

const secure = (element: React.ReactNode) => <RequireAuth>{element}</RequireAuth>

export default function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={secure(<Dashboard />)} />
        <Route path="/daily-care" element={secure(<DailyCare />)} />
        <Route path="/structured-daily-capture" element={secure(<StructuredDailyCapture />)} />
        <Route path="/timeline" element={secure(<Timeline />)} />
        <Route path="/record" element={secure(<Record />)} />
        <Route path="/memory" element={secure(<Memory />)} />
        <Route path="/care-circle" element={secure(<CareCircle />)} />
        <Route path="/companion" element={secure(<Companion />)} />
        <Route path="/insights" element={secure(<Insights />)} />
        <Route path="/community" element={secure(<Community />)} />
        <Route path="/professional" element={secure(<ProfessionalDashboard />)} />
        <Route path="/team" element={secure(<TeamDashboard />)} />
        <Route path="/investor/dashboard" element={secure(<InvestorDashboard />)} />
      </Routes>
    </div>
  )
}
