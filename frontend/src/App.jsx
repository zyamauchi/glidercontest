import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthPage     from './pages/AuthPage';
import Dashboard    from './pages/Dashboard';
import ProfilePage  from './pages/ProfilePage';
import ContestPage  from './pages/ContestPage';
import NewContest   from './pages/NewContest';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Outfit,sans-serif', color:'#1a6fba' }}>Loading…</div>;
  return user ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
          <Route path="/contests/new" element={<Protected><NewContest /></Protected>} />
          <Route path="/contests/:contestId" element={<Protected><ContestPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
