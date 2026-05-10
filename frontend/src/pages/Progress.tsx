import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useGamificationStore } from '../store/gamificationStore';
import XPBar from '../components/Gamification/XPBar';
import BadgeGrid from '../components/Gamification/BadgeGrid';
import KnowledgeGraph from '../components/KnowledgeGraph/KnowledgeGraph';

export default function Progress() {
  const store = useGamificationStore();
  const { streak, topicsStudied, quizzesTaken, correctAnswers } = store;
  const accuracy = quizzesTaken > 0 ? Math.round((correctAnswers / quizzesTaken) * 100) : 0;

  const statsData = [
    { name: 'Topics', value: topicsStudied.length, color: '#6c5ce7' },
    { name: 'Quizzes', value: quizzesTaken, color: '#9b6cff' },
    { name: 'Correct', value: correctAnswers, color: '#22c55e' },
    { name: 'Streak', value: streak, color: '#ffb020' }
  ];

  const pieData = [
    { name: 'Correct', value: correctAnswers || 1 },
    { name: 'Wrong', value: Math.max(0, quizzesTaken - correctAnswers) || 1 }
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mb-2 text-3xl font-bold">Your Progress</h1>
        <p className="text-text-muted">Track your learning journey</p>
      </motion.div>

      {/* XP Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <XPBar />
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statsData.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            className="glass-card p-4 text-center"
          >
            <div className="text-3xl font-bold" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="mt-1 text-xs text-text-muted">{stat.name}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <h3 className="mb-4 text-sm font-semibold text-text-muted">Learning Stats</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statsData}>
              <XAxis dataKey="name" tick={{ fill: '#9aa3b2', fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: '#9aa3b2', fontSize: 12 }} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#16181d',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#e6eef6'
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {statsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card p-6"
        >
          <h3 className="mb-4 text-sm font-semibold text-text-muted">Quiz Accuracy: {accuracy}%</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                <Cell fill="#22c55e" />
                <Cell fill="#ff6b6b" />
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#16181d',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#e6eef6'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success" /> Correct
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-danger" /> Wrong
            </span>
          </div>
        </motion.div>
      </div>

      {/* Badges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h3 className="mb-4 text-sm font-semibold text-text-muted">Badges</h3>
        <BadgeGrid />
      </motion.div>

      {/* Knowledge Graph */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
      >
        <KnowledgeGraph />
      </motion.div>

      {/* Topics Studied */}
      {topicsStudied.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="glass-card p-6"
        >
          <h3 className="mb-4 text-sm font-semibold text-text-muted">Topics Explored</h3>
          <div className="flex flex-wrap gap-2">
            {topicsStudied.map((topic) => (
              <span
                key={topic}
                className="rounded-lg bg-accent-500/10 px-3 py-1.5 text-xs font-medium text-accent-400"
              >
                {topic}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
