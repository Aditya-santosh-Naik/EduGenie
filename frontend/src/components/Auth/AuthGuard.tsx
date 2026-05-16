import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Loader2 } from 'lucide-react';

interface Props { children: React.ReactNode }

export function AuthGuard({ children }: Props) {
  const { user, isLoading, isHydrated } = useAuthStore();

  // Still resolving Firebase auth state
  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-bg-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center
                          justify-center mx-auto mb-3">
            <Loader2 size={20} className="text-accent animate-spin" />
          </div>
          <p className="text-muted text-sm">Loading EduGenie...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
