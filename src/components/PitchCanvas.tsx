// ─────────────────────────────────────────────
//  PitchCanvas.tsx
//  실시간 피치 그래프 (Canvas + requestAnimationFrame)
// ─────────────────────────────────────────────
import { useRef, useEffect } from 'react'
import { midiToY, NOTE_NAMES, NOTE_COLORS } from '../utils/pitchUtils'
import type { PitchPoint } from '../hooks/usePitchDetection'

// ── 상수 ──────────────────────────────────────
const MIN_MIDI      = 36   // C2
const MAX_MIDI      = 84   // C6  (노래 범위 커버)
const PX_PER_SEC    = 60   // 스크롤 속도: 초당 픽셀
const LABEL_WIDTH   = 34   // 좌측 음계 레이블 폭

interface Props {
  pitchHistory: PitchPoint[]
  currentMidi:  number | null
  isActive:     boolean
}

export function PitchCanvas({ pitchHistory, currentMidi, isActive }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)
  // pitchHistory 는 매 프레임 최신값 참조 (ref로 stale closure 방지)
  const historyRef   = useRef<PitchPoint[]>(pitchHistory)
  const currentRef   = useRef<number | null>(currentMidi)

  useEffect(() => { historyRef.current = pitchHistory }, [pitchHistory])
  useEffect(() => { currentRef.current = currentMidi  }, [currentMidi])

  // ── Canvas 크기 동기화 ────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const sync = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // ── 그리기 루프 ───────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const draw = () => {
      const W    = canvas.width
      const H    = canvas.height
      const now  = performance.now() / 1000
      const hist = historyRef.current
      const cur  = currentRef.current

      // ① 배경
      ctx.fillStyle = '#0A0A0F'
      ctx.fillRect(0, 0, W, H)

      // ② 그리드 라인 (반음 단위)
      for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
        const y          = midiToY(midi, MIN_MIDI, MAX_MIDI, H)
        const noteIdx    = ((midi % 12) + 12) % 12
        const name       = NOTE_NAMES[noteIdx]
        const isNatural  = !name.includes('#')
        const isC        = name === 'C'

        // 그리드 선
        ctx.strokeStyle = isC
          ? 'rgba(255,255,255,0.18)'
          : isNatural
            ? 'rgba(255,255,255,0.07)'
            : 'rgba(255,255,255,0.03)'
        ctx.lineWidth   = isC ? 1.5 : isNatural ? 0.8 : 0.4
        ctx.beginPath()
        ctx.moveTo(LABEL_WIDTH, y)
        ctx.lineTo(W, y)
        ctx.stroke()

        // 레이블 (자연음만)
        if (isNatural) {
          const oct = Math.floor(midi / 12) - 1
          ctx.fillStyle = isC
            ? 'rgba(255,255,255,0.6)'
            : 'rgba(255,255,255,0.25)'
          ctx.font      = isC
            ? 'bold 10px "JetBrains Mono", monospace'
            : '9px "JetBrains Mono", monospace'
          ctx.textAlign = 'left'
          ctx.fillText(`${name}${oct}`, 4, y - 2)
        }
      }

      // ③ 현재 음 행 하이라이트
      if (cur !== null) {
        const y      = midiToY(cur, MIN_MIDI, MAX_MIDI, H)
        const ni     = ((cur % 12) + 12) % 12
        const color  = NOTE_COLORS[NOTE_NAMES[ni]]
        const grad   = ctx.createLinearGradient(LABEL_WIDTH, 0, W, 0)
        grad.addColorStop(0,   color + '00')
        grad.addColorStop(0.3, color + '22')
        grad.addColorStop(1,   color + '18')
        ctx.fillStyle = grad
        ctx.fillRect(LABEL_WIDTH, y - 7, W - LABEL_WIDTH, 14)
      }

      // ④ 피치 트레일 (부드러운 곡선)
      if (hist.length > 1) {
        ctx.save()
        
        // 라벨 영역(좌측)에 피치 트레일이 겹치지 않게 클리핑
        ctx.beginPath()
        ctx.rect(LABEL_WIDTH, 0, W - LABEL_WIDTH, H)
        ctx.clip()

        const pts = hist.map(p => ({
          x: W - (now - p.time) * PX_PER_SEC,
          y: midiToY(p.midi, MIN_MIDI, MAX_MIDI, H),
          color: p.color,
          midi: p.midi,
          time: p.time
        }))

        ctx.lineCap     = 'round'
        ctx.lineJoin    = 'round'
        ctx.lineWidth   = 3

        const segments: typeof pts[] = []
        let curSeg: typeof pts = [pts[0]]
        
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1]
          const curr = pts[i]
          
          if (Math.abs(curr.midi - prev.midi) > 12 || (curr.time - prev.time) > 0.2) {
            segments.push(curSeg)
            curSeg = [curr]
          } else {
            curSeg.push(curr)
          }
        }
        if (curSeg.length > 0) segments.push(curSeg)

        for (const seg of segments) {
          if (seg.length < 2) continue
          if (seg[seg.length - 1].x < 0) continue

          for (let i = 1; i < seg.length; i++) {
            const prev = seg[i - 1]
            const curr = seg[i]
            
            if (curr.x < -50 && prev.x < -50) continue

            // 페이드아웃 계산 (좌측 25% 구간에서 서서히 투명해짐)
            const graphWidth = W - LABEL_WIDTH
            const fadeStartX = LABEL_WIDTH + graphWidth * 0.25
            let alpha = 1.0
            
            if (curr.x < fadeStartX) {
              alpha = Math.max(0, (curr.x - LABEL_WIDTH) / (fadeStartX - LABEL_WIDTH))
              // Ease-in-out 느낌을 위해 곡선 적용 (가속 페이드아웃)
              alpha = alpha * alpha
            }

            ctx.globalAlpha = alpha
            ctx.shadowColor = curr.color
            ctx.shadowBlur  = 10
            ctx.strokeStyle = curr.color

            ctx.beginPath()

            if (i === 1) {
              const midX = (prev.x + curr.x) / 2
              const midY = (prev.y + curr.y) / 2
              ctx.moveTo(prev.x, prev.y)
              ctx.lineTo(midX, midY)
            } 
            
            if (i > 1) {
              const prevPrev = seg[i - 2]
              const startX = (prevPrev.x + prev.x) / 2
              const startY = (prevPrev.y + prev.y) / 2
              const endX = (prev.x + curr.x) / 2
              const endY = (prev.y + curr.y) / 2
              
              ctx.moveTo(startX, startY)
              ctx.quadraticCurveTo(prev.x, prev.y, endX, endY)
            }

            if (i === seg.length - 1) {
              const midX = (prev.x + curr.x) / 2
              const midY = (prev.y + curr.y) / 2
              ctx.moveTo(midX, midY)
              ctx.lineTo(curr.x, curr.y)
            }

            ctx.stroke()
            ctx.shadowBlur = 0
          }
        }
        ctx.globalAlpha = 1.0 // 투명도 원상복구
        ctx.restore()
      }

      // ⑤ 현재 위치 커서 (우측 끝 점선)
      if (isActive) {
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'
        ctx.lineWidth   = 1
        ctx.setLineDash([3, 5])
        ctx.beginPath()
        ctx.moveTo(W - 1, 0)
        ctx.lineTo(W - 1, H)
        ctx.stroke()
        ctx.setLineDash([])
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isActive])   // isActive만 의존 — hist/cur는 ref로 처리

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
