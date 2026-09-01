import { SKILLS } from '../train/skills'
import {
  DAILY_GOAL, dueCount, isUnlocked, levelProgress, lockReason, skillMastery, training, useTraining,
} from '../state/training'
import { streakOf, useProgress } from '../state/progress'

export function Training({ onStart, onExit }: { onStart: () => void; onExit: () => void }) {
  const state = useTraining()
  const progress = useProgress()
  const { level, into, needed } = levelProgress(state.xp)
  const due = dueCount(state)
  const streak = streakOf(progress.practiceDays)
  const goalFraction = Math.min(1, state.todayXp / DAILY_GOAL)

  return (
    <div className="training">
      <header className="player-head">
        <button className="ghost" onClick={onExit} aria-label="Back">←</button>
        <div className="titles">
          <h1>Away from the piano</h1>
          <p>Reading is mostly decoding, and decoding trains anywhere.</p>
        </div>
      </header>

      <section className="today">
        <GoalRing fraction={goalFraction} />
        <div className="today-stats">
          <div className="stat">
            <strong>Level {level}</strong>
            <div className="level-bar-track"><div className="fill" style={{ width: `${(into / needed) * 100}%` }} /></div>
            <span>{into}/{needed} XP to level {level + 1}</span>
          </div>
          <div className="stat-row">
            <span><b>{streak}</b> day{streak === 1 ? '' : 's'} in a row</span>
            <span><b>{state.sessions}</b> sessions</span>
            <span><b>{state.bestStreak}</b> best run</span>
          </div>
        </div>
      </section>

      <button className="start-session" onClick={onStart}>
        <strong>{due > 0 ? `Review ${due} item${due === 1 ? '' : 's'}` : 'Start a round'}</strong>
        <span>
          {due > 0
            ? 'These are the ones you are about to forget — the best moment to see them again.'
            : 'Twelve questions, about three minutes.'}
        </span>
      </button>

      <section className="block">
        <h2>Skills</h2>
        <p className="sub">
          Questions are mixed rather than grouped, and each one comes back just as you are about to
          forget it. That spacing is doing the teaching; the points are only here to get you to open
          the app.
        </p>
        <ul className="skill-list">
          {SKILLS.map((skill) => {
            const unlocked = isUnlocked(state, skill)
            const level = skillMastery(state, skill)
            const seen = skill.items.filter((id) => state.memories[id]).length
            return (
              <li key={skill.id} className={unlocked ? '' : 'locked'}>
                <div className="skill-head">
                  <strong>{skill.name}</strong>
                  <span className="skill-pct">
                    {unlocked ? `${Math.round(level * 100)}%` : 'Locked'}
                  </span>
                </div>
                <div className="mastery-track">
                  <div className="fill" style={{ width: `${level * 100}%` }} />
                </div>
                <p className="skill-why">{skill.why}</p>
                <p className="skill-meta">
                  {unlocked
                    ? `${seen} of ${skill.items.length} items seen`
                    : lockReason(state, skill)}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      <footer className="home-foot">
        <p>{state.xp} XP all time</p>
        <button className="ghost small" onClick={() => {
          if (confirm('Clear training progress, levels and review schedules?')) training.reset()
        }}>Reset training</button>
      </footer>
    </div>
  )
}

/** The daily goal, as a ring that fills. */
function GoalRing({ fraction }: { fraction: number }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const done = fraction >= 1
  return (
    <svg className={`goal-ring ${done ? 'done' : ''}`} viewBox="0 0 84 84" role="img"
      aria-label={`Daily goal ${Math.round(fraction * 100)} per cent`}>
      <circle className="track" cx={42} cy={42} r={radius} strokeWidth={7} fill="none" />
      <circle className="value" cx={42} cy={42} r={radius} strokeWidth={7} fill="none"
        strokeLinecap="round" strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        transform="rotate(-90 42 42)" />
      <text x={42} y={46} textAnchor="middle" fontSize={done ? 22 : 17} className="goal-text">
        {done ? '✓' : `${Math.round(fraction * 100)}%`}
      </text>
    </svg>
  )
}
