import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import LandingPage from './components/Landing/LandingPage';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import DashboardHome from './components/Dashboard/DashboardHome';
import KanbanBoard from './components/Tasks/KanbanBoard';
import TeamManagement from './components/Team/TeamManagement';
import ChatSystem from './components/Chat/ChatSystem';
import CalendarView from './components/Calendar/CalendarView';
import SettingsPage from './components/Settings/SettingsPage';
import SuperAdminDashboard from './components/SuperAdmin/SuperAdminDashboard';

function OrgLayout() {
  const { orgSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isSuperAdmin } = useAuth();

  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (isSuperAdmin) return <SuperAdminDashboard />;

  // Determine active section from path
  const section = location.pathname.split('/')[2] || 'dashboard';

  return (
    <div className="h-screen bg-gray-900 flex overflow-hidden">
      <Sidebar 
        activeSection={section} 
        onSectionChange={(sec) => navigate(`/${orgSlug}/${sec}`)} 
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={section} />
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="dashboard" element={<DashboardHome />} />
            <Route path="tasks" element={<KanbanBoard />} />
            <Route path="team" element={<TeamManagement />} />
            <Route path="chat" element={<ChatSystem />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to={`/${orgSlug}/dashboard`} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, isSuperAdmin, organization, loading } = useAuth();
  if (loading) return null;
  return (
    <Routes>
      <Route path="/" element={isAuthenticated && organization ? <Navigate to={`/${organization.slug}/dashboard`} replace /> : <LandingPage />} />
      <Route path=":orgSlug/*" element={<OrgLayout />} />
      <Route path="*" element={<Navigate to={isAuthenticated && organization ? `/${organization.slug}/dashboard` : '/'} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;