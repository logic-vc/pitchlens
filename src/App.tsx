// ─────────────────────────────────────────────
//  App.tsx
//  루트 레이아웃 조립
// ─────────────────────────────────────────────
import { usePitchDetection } from './hooks/usePitchDetection'
import { PitchCanvas }        from './components/PitchCanvas'
import { PitchDisplay }       from './components/PitchDisplay'
import './index.css'

export default function App() {
  const {
    isActive, currentPitch, isHeld,
    sessionMin, sessionMax, pitchHistory,
    error, start, stop, toggleHold, resetSession,
  } = usePitchDetection()

  return (
    <div className="app">

      {/* ── 헤더 ── */}
      <header className="app-header">
        <div className="logo">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="#00F5FF" strokeWidth="1.5"/>
            <path d="M7 13V7l7 3-7 3z" fill="#00F5FF"/>
          </svg>
          <span className="logo-text">PitchLens</span>
          {isHeld && <span className="held-badge">HOLD</span>}
        </div>

        <div className="header-right">
          {error && <span className="error-msg">{error}</span>}
        </div>
      </header>

      {/* ── 메인 영역 ── */}
      <main className="app-main">

        {/* 좌측: 수치 패널 */}
        <aside className="side-panel">
          <PitchDisplay
            currentPitch={currentPitch}
            sessionMin={sessionMin}
            sessionMax={sessionMax}
            onResetSession={resetSession}
            isActive={isActive}
          />
        </aside>

        {/* 우측: Canvas 그래프 */}
        <div className="canvas-area">
          <PitchCanvas
            pitchHistory={pitchHistory}
            currentMidi={currentPitch?.midiNote ?? null}
            isActive={isActive}
          />

          {/* 비활성 오버레이 */}
          {!isActive && (
            <div className="idle-overlay">
              <div className="idle-content">
                <div className="idle-icon">🎙</div>
                <p className="idle-text">시작 버튼을 누르면 마이크가 활성화됩니다</p>
                {error && <p className="idle-error">{error}</p>}
              </div>
            </div>
          )}
        </div>

      </main>

      {/* ── 컨트롤 바 ── */}
      <footer className="app-footer">
        <div className="controls">

          {/* 시작 / 중지 */}
          <button
            className={`btn-primary ${isActive ? 'is-stop' : ''}`}
            onClick={isActive ? stop : start}
          >
            {isActive ? (
              <>
                <span className="btn-icon">⏹</span> 중지
              </>
            ) : (
              <>
                <span className="btn-icon">▶</span> 시작
              </>
            )}
          </button>

          {/* Hold */}
          <button
            className={`btn-secondary ${isHeld ? 'is-held' : ''}`}
            onClick={toggleHold}
            disabled={!isActive}
          >
            <span className="btn-icon">{isHeld ? '🔒' : '⏸'}</span>
            {isHeld ? 'HELD' : 'HOLD'}
          </button>

        </div>

        {/* 푸터 카피라이트 (상시 노출) */}
        <span className="footer-hint">
          © 2026 VOCAL LOGIC · v0.1
        </span>
        </footer>

    </div>
  )
}
