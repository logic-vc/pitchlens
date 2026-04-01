// ─────────────────────────────────────────────
//  pitchUtils.ts
//  Hz ↔ 음계 변환, 색상 매핑, Canvas 좌표 계산
// ─────────────────────────────────────────────

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

// 음계별 고유 색상 (다크 배경에 최적화된 네온 컬러)
export const NOTE_COLORS: Record<string, string> = {
  'C':  '#00F5FF', // 사이언
  'C#': '#00BBCC',
  'D':  '#A855F7', // 보라
  'D#': '#8B3FD4',
  'E':  '#2ED573', // 초록
  'F':  '#FF6B35', // 오렌지
  'F#': '#E05525',
  'G':  '#FFD700', // 골드
  'G#': '#CCA800',
  'A':  '#FF4757', // 레드
  'A#': '#D43A46',
  'B':  '#FF85A1', // 핑크
}

// 한글 음이름 매핑 (도레미파솔라시)
const KOREAN_NOTE_NAMES: Record<string, string> = {
  'C':  '도',
  'C#': '도#',
  'D':  '레',
  'D#': '레#',
  'E':  '미',
  'F':  '파',
  'F#': '파#',
  'G':  '솔',
  'G#': '솔#',
  'A':  '라',
  'A#': '라#',
  'B':  '시',
}

/**
 * 영어 음이름+옥타브 → 한글 표기
 * C5 → "3옥 도", C4 → "2옥 도", C3 → "1옥 도"
 * 한국 보컬 교육 기준: 한글옥타브 = MIDI옥타브 - 2
 */
export function toKoreanNoteName(noteName: string, octave: number): string {
  const korNote = KOREAN_NOTE_NAMES[noteName] ?? noteName
  const korOctave = Math.max(0, octave - 2)
  return `${korOctave}옥 ${korNote}`
}

export interface NoteInfo {
  noteName: string
  octave: number
  cents: number
  midiNote: number
  midiFloat: number
  freq: number
  fullName: string
  color: string
}

/**
 * Hz → 음계 정보 변환
 * A4 = 440Hz 기준, 12-TET 평균율
 */
export function hzToNoteInfo(freq: number): NoteInfo | null {
  if (freq <= 0 || !isFinite(freq)) return null

  // MIDI 실수값: A4(440Hz) = 69
  const midiFloat = 12 * Math.log2(freq / 440) + 69
  const midiNote  = Math.round(midiFloat)
  const cents     = Math.round((midiFloat - midiNote) * 100)
  const noteIndex = ((midiNote % 12) + 12) % 12
  const octave    = Math.floor(midiNote / 12) - 1
  const noteName  = NOTE_NAMES[noteIndex]

  return {
    noteName,
    octave,
    cents,
    midiNote,
    midiFloat,
    freq,
    fullName: `${noteName}${octave}`,
    color: NOTE_COLORS[noteName],
  }
}

/** MIDI 번호 → Canvas Y 좌표 (높은 음 = 위) */
export function midiToY(
  midi: number,
  minMidi: number,
  maxMidi: number,
  height: number,
): number {
  return height - ((midi - minMidi) / (maxMidi - minMidi)) * height
}

/** MIDI 번호 → "C4" 형태 문자열 */
export function midiToFullName(midi: number): string {
  const noteIndex = ((midi % 12) + 12) % 12
  const octave    = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[noteIndex]}${octave}`
}
