import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';
import Learn from './pages/Learn';
import Quiz from './pages/Quiz';
import Progress from './pages/Progress';
import Upload from './pages/Upload';
import FlashcardView from './components/Flashcards/FlashcardView';
import BreakReminder from './components/common/BreakReminder';
import OfflineBanner from './components/common/OfflineBanner';
import { useAuth } from './hooks/useAuth';
import { AuthGuard } from './components/Auth/AuthGuard';
import { LoginPage } from './components/Auth/LoginPage';

// This component triggers the auth state listener
function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuth(); // sets up onAuthStateChanged listener
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden bg-bg-900">
        <BreakReminder />
        {/* Sidebar — collapses on mobile */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <OfflineBanner />
          <Navbar />

          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected — all app routes */}
              <Route path="/" element={<AuthGuard><Navigate to="/learn" replace /></AuthGuard>} />
              <Route path="/learn" element={<AuthGuard><Learn /></AuthGuard>} />
              <Route path="/quiz" element={<AuthGuard><Quiz /></AuthGuard>} />
              <Route path="/progress" element={<AuthGuard><Progress /></AuthGuard>} />
              <Route path="/upload" element={<AuthGuard><Upload /></AuthGuard>} />
              <Route path="/flashcards" element={<AuthGuard><FlashcardView /></AuthGuard>} />
              
              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/learn" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
