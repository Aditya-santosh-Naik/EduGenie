import { NavLink } from 'react-router-dom';
import { BookOpen, Brain, BarChart3, Upload, Library } from 'lucide-react';
import { cn } from '../../lib/utils';
import XPBar from '../Gamification/XPBar';
import StreakCounter from '../Gamification/StreakCounter';
import { UserMenu } from '../Auth/UserMenu';

const navItems = [
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/quiz', label: 'Quiz', icon: Brain },
  { to: '/flashcards', label: 'Flashcards', icon: Library },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/upload', label: 'Upload', icon: Upload }
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/5 bg-bg-900/80 px-4 py-3 backdrop-blur-xl md:px-6">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-lg font-bold text-white shadow-lg shadow-accent-500/20">
          E
        </div>
        <span className="hidden text-xl font-bold gradient-text md:block">EduGenie</span>
      </div>

      {/* Tab Navigation */}
      <nav className="flex items-center gap-1 rounded-2xl bg-bg-800/60 p-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-accent-500/20 text-accent-400 shadow-sm'
                  : 'text-text-muted hover:bg-white/5 hover:text-text-main'
              )
            }
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Right side: XP + Streak + Avatar */}
      <div className="flex items-center gap-4">
        <div className="hidden md:block">
          <XPBar compact />
        </div>
        <StreakCounter />
        <UserMenu />
      </div>
    </header>
  );
}
