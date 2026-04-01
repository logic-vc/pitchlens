// ─────────────────────────────────────────────
//  PitchDisplay.tsx
//  좌측 정보 패널: 음계 / Hz / Cents / 세션 범위
// ─────────────────────────────────────────────
import type { NoteInfo } from '../utils/pitchUtils'
import { midiToFullName, toKoreanNoteName } from '../utils/pitchUtils'

interface Props {
  currentPitch:   NoteInfo | null
  sessionMin:     number | null
  sessionMax:     number | null
  onResetSession: () => void
  isActive:       boolean
}

/** Cents 값 → 색상 (초록=정확, 노랑=약간 벗어남, 빨강=크게 벗어남) */
function centsColor(cents: number | null): string {
  if (cents === null) return 'var(--text-muted)'
  const abs = Math.abs(cents)
  if (abs <= 10)  return 'var(--green)'
  if (abs <= 25)  return 'var(--gold)'
  return 'var(--red)'
}

/** Cents 문자열 포맷 */
function formatCents(cents: number): string {
  if (cents === 0) return '±0¢'
  return cents > 0 ? `+${cents}¢` : `${cents}¢`
}

export function PitchDisplay({
  currentPitch,
  sessionMin,
  sessionMax,
  onResetSession,
  isActive
}: Props) {
  const noteColor  = currentPitch?.color ?? 'var(--text-muted)'
  const cc         = centsColor(currentPitch?.cents ?? null)
  const hasSession = sessionMin !== null && sessionMax !== null

  return (
    <div className="pitch-display">

      <div className="note-group">
        {/* ── 현재 음계 (대형) ── */}
        <div className="note-hero" style={{ color: noteColor }}>
          <span className="note-name">
            {currentPitch?.noteName ?? '—'}
          </span>
          <span className="note-octave">
            {currentPitch ? currentPitch.octave : ''}
          </span>
        </div>
        {/* ── 한글 음이름 ── */}
        {currentPitch && (
          <div className="note-korean" style={{ color: noteColor }}>
            {toKoreanNoteName(currentPitch.noteName, currentPitch.octave)}
          </div>
        )}
      </div>

      {/* ── Hz + Cents ── */}
      <div className="info-card">
        <div className="info-row">
          <span className="info-label">FREQ</span>
          <span className="info-value mono">
            {currentPitch ? `${currentPitch.freq.toFixed(1)} Hz` : '— Hz'}
          </span>
        </div>
        <div className="divider" />
        <div className="info-row">
          <span className="info-label">PITCH</span>
          <span className="info-value mono cents-value" style={{ color: cc }}>
            {currentPitch ? formatCents(currentPitch.cents) : '—¢'}
          </span>
        </div>
        {/* Cents 시각 바 */}
        <div className="cents-bar-wrap">
          <div
            className="cents-bar-fill"
            style={{
              width:      `${Math.min(Math.abs(currentPitch?.cents ?? 0) / 50 * 50, 50)}%`,
              marginLeft: (currentPitch?.cents ?? 0) >= 0 ? '50%' : undefined,
              marginRight:(currentPitch?.cents ?? 0) < 0  ? '50%' : undefined,
              background: cc,
            }}
          />
          <div className="cents-bar-center" />
        </div>
      </div>

      {/* ── 세션 최저/최고 ── */}
      <div className="info-card session-card">
        <div className="card-header">
          <span className="info-label">SESSION RANGE</span>
          <button
            className="btn-tiny-reset"
            onClick={onResetSession}
            disabled={!isActive || !hasSession}
            title="초기화"
          >
            RESET
          </button>
        </div>
        <div className="session-range-row">
          <span className="session-note low mono">
            {hasSession ? midiToFullName(sessionMin!) : '—'}
          </span>
          <span className="session-arrow">→</span>
          <span className="session-note high mono">
            {hasSession ? midiToFullName(sessionMax!) : '—'}
          </span>
        </div>
        {hasSession && (
          <span className="session-span">
            {sessionMax! - sessionMin!} semitones
          </span>
        )}
      </div>

    </div>
  )
}
