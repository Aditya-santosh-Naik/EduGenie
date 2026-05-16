import { useState } from 'react';
import { Loader2, UserX } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export function GuestButton() {
  const { continueAsGuest } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try { await continueAsGuest(); }
    finally { setLoading(false); }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 text-muted
                 hover:text-text-main text-sm py-2 transition-colors
                 disabled:opacity-60"
    >
      {loading
        ? <Loader2 size={14} className="animate-spin" />
        : <UserX size={14} />
      }
      Continue as Guest
      <span className="text-xs opacity-60">(progress won't be saved)</span>
    </button>
  );
}
