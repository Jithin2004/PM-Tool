import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Circle, CheckCircle, Clock, User } from 'lucide-react';
import { slideUp, stagger } from '../lib/animation';

interface ActivityEntry {
  id: number;
  actor: string;
  action: string;
  target: string;
  type: 'complete' | 'create' | 'update';
}

const ACTORS = ['alex', 'jordan', 'taylor', 'morgan', 'casey'];
const COLORS = ['text-emerald-400', 'text-amber-400', 'text-blue-400', 'text-purple-400', 'text-cyan-400'];
const BG_COLORS = ['bg-emerald-400/20', 'bg-amber-400/20', 'bg-blue-400/20', 'bg-purple-400/20', 'bg-cyan-400/20'];

const ACTIONS: { action: string; target: string; type: ActivityEntry['type'] }[] = [
  { action: 'completed', target: 'API integration spec', type: 'complete' },
  { action: 'created', target: 'sprint UI polish', type: 'create' },
  { action: 'updated', target: 'deployment pipeline', type: 'update' },
  { action: 'approved', target: 'design review request', type: 'complete' },
  { action: 'resolved', target: 'auth timeout bug', type: 'complete' },
  { action: 'submitted', target: 'weekly report', type: 'create' },
  { action: 'started', target: 'performance audit', type: 'create' },
  { action: 'assigned', target: 'code review task', type: 'update' },
];

function randomEntry(id: number): ActivityEntry {
  const pick = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  const actor = ACTORS[Math.floor(Math.random() * ACTORS.length)];
  return { id, actor, ...pick };
}

export function RealtimePreview() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx(i => i + 1);
      setEntries(prev => [randomEntry(Date.now()), ...prev].slice(0, 6));
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-32 px-6 border-t border-[var(--border-soft)]">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.06)}
          className="text-center mb-14"
        >
          <motion.p variants={slideUp} className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text)] dark:text-[var(--text-secondary)] mb-3">
            Realtime Collaboration
          </motion.p>
          <motion.h2 variants={slideUp} className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--pm-text)] dark:text-[var(--text-secondary)]">
            Live operational awareness
          </motion.h2>
        </motion.div>

        {/* Live activity feed */}
        <div className="bg-[#FFFFFF] dark:bg-[#0c0c0c] border border-[var(--pm-border)] dark:border-[var(--border-soft)]">
          {/* Feed header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-soft)]">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[var(--pm-text)] dark:text-[var(--text-secondary)]" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--pm-text)] dark:text-[var(--text-secondary)]">Activity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-pulse" />
              <span className="text-[9px] font-mono text-emerald-400/60">Live</span>
            </div>
          </div>

          {/* Activity entries */}
          <div className="px-3 py-2 space-y-1 min-h-[220px]">
            <AnimatePresence mode="popLayout">
              {entries.map((entry) => {
                const actorIdx = ACTORS.indexOf(entry.actor);
                const color = COLORS[actorIdx];
                const bgColor = BG_COLORS[actorIdx];
                return (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, scale: 0.97 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    className="flex items-center gap-3 px-3 py-2.5 bg-[var(--pm-surface)]/[0.01]"
                  >
                    {/* Actor avatar */}
                    <div className={`w-6 h-6 flex items-center justify-center ${bgColor}`}>
                      <span className={`text-[9px] font-mono font-medium ${color}`}>
                        {entry.actor[0].toUpperCase()}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)] truncate">
                        <span className="text-[var(--pm-text)] dark:text-[var(--text-secondary)]">{entry.actor}</span>
                        {' '}{entry.action}{' '}
                        <span className="text-[var(--pm-text)] dark:text-[var(--text-secondary)]">{entry.target}</span>
                      </p>
                    </div>

                    {/* Type indicator */}
                    <div className="shrink-0">
                      {entry.type === 'complete' && <CheckCircle className="w-3 h-3 text-emerald-400/50" />}
                      {entry.type === 'create' && <Clock className="w-3 h-3 text-amber-400/50" />}
                      {entry.type === 'update' && <Activity className="w-3 h-3 text-blue-400/50" />}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {entries.length === 0 && (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-[11px] font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)]">Awaiting activity...</p>
              </div>
            )}
          </div>

          {/* Presence bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--border-soft)] bg-[var(--pm-surface)]/[0.01]">
            <User className="w-3 h-3 text-[var(--pm-text)] dark:text-[var(--text-secondary)]" />
            <div className="flex items-center -space-x-1">
              {ACTORS.map((actor, i) => (
                <div
                  key={actor}
                  className={`w-5 h-5 flex items-center justify-center ${BG_COLORS[i]} border border-[#0a0a0a]`}
                >
                  <span className={`text-[7px] font-mono font-medium ${COLORS[i]}`}>
                    {actor[0].toUpperCase()}
                  </span>
                </div>
              ))}
              <div className="w-5 h-5 flex items-center justify-center bg-[var(--pm-surface)]/5 border border-[#0a0a0a]">
                <span className="text-[7px] font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)]">+2</span>
              </div>
            </div>
            <span className="text-[9px] font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)]">5 online</span>
          </div>
        </div>
      </div>
    </section>
  );
}
