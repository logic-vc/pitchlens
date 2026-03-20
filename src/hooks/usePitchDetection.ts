// ─────────────────────────────────────────────
//  usePitchDetection.ts
//  Web Audio API + pitchy(McLeod) 실시간 피치 감지
// ─────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react'
import { PitchDetector } from 'pitchy'
import { hzToNoteInfo, type NoteInfo } from '../utils/pitchUtils'

// ── 상수 ──────────────────────────────────────
const SAMPLE_RATE       = 44100
const BUFFER_SIZE       = 2048   // 분석 윈도우 크기
const CLARITY_THRESHOLD = 0.90   // 신뢰도 임계값 (0~1, 높을수록 엄격)
const MIN_FREQ          = 60     // ~B1  노이즈 제거용 최저 주파수
const MAX_FREQ          = 1200   // ~D#6 최고 주파수
const HISTORY_SECONDS   = 30     // 그래프에 유지할 기록 시간(초) - 30초로 늘려 넓은 화면 대응

export interface PitchPoint {
  time:  number  // performance.now() 기준 경과 초
  midi:  number  // MIDI 번호
  color: string  // 음계 색상
}

export interface PitchDetectionResult {
  isActive:     boolean
  currentPitch: NoteInfo | null
  isHeld:       boolean
  sessionMin:   number | null   // 세션 최저 MIDI
  sessionMax:   number | null   // 세션 최고 MIDI
  pitchHistory: PitchPoint[]
  error:        string | null
  start:        () => Promise<void>
  stop:         () => void
  toggleHold:   () => void
  resetSession: () => void
}

export function usePitchDetection(): PitchDetectionResult {
  const [isActive,     setIsActive]     = useState(false)
  const [currentPitch, setCurrentPitch] = useState<NoteInfo | null>(null)
  const [isHeld,       setIsHeld]       = useState(false)
  const [sessionMin,   setSessionMin]   = useState<number | null>(null)
  const [sessionMax,   setSessionMax]   = useState<number | null>(null)
  const [pitchHistory, setPitchHistory] = useState<PitchPoint[]>([])
  const [error,        setError]        = useState<string | null>(null)

  // Refs: React 렌더링 사이클 밖에서 유지되는 값들
  const audioCtxRef   = useRef<AudioContext | null>(null)
  const analyserRef   = useRef<AnalyserNode | null>(null)
  const detectorRef   = useRef<PitchDetector<Float32Array> | null>(null)
  const bufferRef     = useRef(new Float32Array(BUFFER_SIZE))
  const streamRef     = useRef<MediaStream | null>(null)
  const rafRef        = useRef<number>(0)
  const isHeldRef     = useRef(false)       // HOLD 상태 (RAF 클로저에서 참조)
  const startTimeRef  = useRef<number>(0)   // 세션 시작 시각

  // ── 감지 루프 ─────────────────────────────────
  const detect = useCallback(() => {
    if (!analyserRef.current || !detectorRef.current) return

    analyserRef.current.getFloatTimeDomainData(bufferRef.current)
    const [freq, clarity] = detectorRef.current.findPitch(bufferRef.current, SAMPLE_RATE)

    if (clarity >= CLARITY_THRESHOLD && freq >= MIN_FREQ && freq <= MAX_FREQ) {
      const info = hzToNoteInfo(freq)
      if (!info) {
        rafRef.current = requestAnimationFrame(detect)
        return
      }

      if (!isHeldRef.current) {
        setCurrentPitch(info)

        // 세션 최저/최고음 업데이트
        setSessionMin(prev => prev === null ? info.midiNote : Math.min(prev, info.midiNote))
        setSessionMax(prev => prev === null ? info.midiNote : Math.max(prev, info.midiNote))

        // 히스토리 추가 (12초 롤링 윈도우)
        const now = performance.now() / 1000
        setPitchHistory(prev => {
          const cutoff = now - HISTORY_SECONDS
          const next = prev.filter(p => p.time > cutoff)
          next.push({ time: now, midi: info.midiFloat, color: info.color })
          return next
        })
      }
    }

    rafRef.current = requestAnimationFrame(detect)
  }, [])

  // ── 시작 ──────────────────────────────────────
  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioCtxRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize     = BUFFER_SIZE
      analyser.smoothingTimeConstant = 0  // 즉각 반응
      analyserRef.current  = analyser

      ctx.createMediaStreamSource(stream).connect(analyser)

      detectorRef.current  = PitchDetector.forFloat32Array(BUFFER_SIZE)
      // startTimeRef 는 이제 순수하게 세션 리셋용으로만 사용 가능

      setIsActive(true)
      rafRef.current = requestAnimationFrame(detect)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '마이크 접근 오류'
      setError(`마이크를 사용할 수 없습니다: ${msg}`)
    }
  }, [detect])

  // ── 중지 ──────────────────────────────────────
  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    detectorRef.current = null
    streamRef.current   = null
    setIsActive(false)
    setCurrentPitch(null)
    isHeldRef.current = false
    setIsHeld(false)
    // 중지 시 히스토리 비우기 (사용자 요청 사항: 재시작 시 깨끗하게)
    setPitchHistory([])
  }, [])

  // ── Hold 토글 ─────────────────────────────────
  const toggleHold = useCallback(() => {
    isHeldRef.current = !isHeldRef.current
    setIsHeld(prev => !prev)
  }, [])

  // ── 세션 리셋 ─────────────────────────────────
  const resetSession = useCallback(() => {
    setSessionMin(null)
    setSessionMax(null)
    setPitchHistory([])
    startTimeRef.current = performance.now()
  }, [])

  // ── 언마운트 클린업 ───────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close()
    }
  }, [])

  return {
    isActive, currentPitch, isHeld,
    sessionMin, sessionMax, pitchHistory,
    error, start, stop, toggleHold, resetSession,
  }
}
