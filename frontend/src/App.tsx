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
import { useAuthBootstrap } from './hooks/useAuth';
import { AuthGuard } from './components/Auth/AuthGuard';
import { LoginPage } from './components/Auth/LoginPage';

// Restores the saved session once for the whole app
function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuthBootstrap();
  return <>{children}</>;
}

/**
 * The signed-in application: sidebar, navbar, and the routed pages.
 * Nothing in here renders until AuthGuard has a user, so the login screen
 * is never framed by the app chrome.
 */
function AppShell() {
  return (
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
            <Route path="/" element={<Navigate to="/learn" replace />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/flashcards" element={<FlashcardView />} />
            <Route path="/upload" element={<Upload />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/learn" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public — full screen, no app chrome */}
        <Route path="/login" element={<LoginPage />} />

        {/* Everything else requires a session */}
        <Route
          path="/*"
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
