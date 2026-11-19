import { useEffect, useState } from 'react';
import ProfileEditorView from './ProfileEditorView.js';
import ProfileOverview from './ProfileOverview.js';

interface User {
  id: string;
  email: string;
  email_verified: boolean;
  name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  onboarding_completed: boolean;
  created_at: string;
  last_login_at?: string | null;
  login_methods?: Array<{ id: string; type: string; created_at: string }>;
}

interface UserDashboardProps {
  user: User;
  apiUrl: string;
  initialMode?: 'view' | 'edit';
  onLogout: () => void;
  onRefresh: () => void;
  onViewPublicProfile?: (username: string) => void;
}

export default function UserDashboard({
  user,
  apiUrl,
  initialMode = 'view',
  onLogout,
  onRefresh,
  onViewPublicProfile,
}: UserDashboardProps) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [connectedMethods, setConnectedMethods] = useState<
    Array<{ id: string; type: string; created_at: string }>
  >(user.login_methods || []);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const fetchLoginMethods = async () => {
    try {
      const res = await fetch(`${apiUrl}/account/login-methods`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.login_methods)) {
          setConnectedMethods(data.login_methods);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchLoginMethods();
  }, [apiUrl]);

  return (
    <div className="user-dashboard-wrapper">
      {mode === 'view' ? (
        <ProfileOverview
          user={user}
          apiUrl={apiUrl}
          connectedMethods={connectedMethods}
          onEditProfile={() => setMode('edit')}
          onViewPublicProfile={onViewPublicProfile}
          onLogout={onLogout}
          onRefresh={onRefresh}
        />
      ) : (
        <ProfileEditorView
          user={user}
          apiUrl={apiUrl}
          connectedMethods={connectedMethods}
          onBackToOverview={() => setMode('view')}
          onViewPublicProfile={onViewPublicProfile}
          onProfileUpdated={onRefresh}
        />
      )}
    </div>
  );
}
