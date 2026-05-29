import { createClient } from '@/lib/supabase/server'

export async function aggregateCharts(
  periodType: 'daily' | 'weekly' | 'monthly',
  date: Date
) {
  const supabase = await createClient()
  const dateStr = date.toISOString().split('T')[0]

  try {
    // 1. Supabase SQL RPC 호출 우선 시도
    const { error: rpcError } = await supabase.rpc('aggregate_charts', {
      period_type: periodType,
      period_date: dateStr
    })

    if (!rpcError) {
      console.log(`[Chart Engine] RPC aggregation successful for ${periodType} / ${dateStr}`)
      return { success: true, method: 'rpc' }
    }

    // RPC 함수가 존재하지 않거나 에러 발생 시 JS Fallback 연산 시작
    console.warn(`[Chart Engine] RPC failed or not installed. Fallback to JS engine...`, rpcError.message)
  } catch (err) {
    console.warn(`[Chart Engine] RPC trigger exception. Starting JS engine...`, err)
  }

  // 2. JS/TS Fallback 집계 시작
  let startTime: Date
  let endTime: Date

  const baseDate = new Date(date)
  baseDate.setUTCHours(0, 0, 0, 0)

  if (periodType === 'daily') {
    startTime = new Date(baseDate)
    endTime = new Date(baseDate)
    endTime.setUTCDate(endTime.getUTCDate() + 1)
  } else if (periodType === 'weekly') {
    // 해당 주의 월요일 구하기
    const day = baseDate.getUTCDay()
    const diff = baseDate.getUTCDate() - day + (day === 0 ? -6 : 1)
    startTime = new Date(baseDate)
    startTime.setUTCDate(diff)
    endTime = new Date(startTime)
    endTime.setUTCDate(endTime.getUTCDate() + 7)
  } else if (periodType === 'monthly') {
    startTime = new Date(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1)
    endTime = new Date(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1)
  } else {
    throw new Error('Invalid period type')
  }

  const startStr = startTime.toISOString()
  const endStr = endTime.toISOString()

  // 해당 기간 play_events 로드
  const { data: playEvents, error: fetchError } = await supabase
    .from('play_events')
    .select('track_id')
    .gte('played_at', startStr)
    .lt('played_at', endStr)

  if (fetchError) throw fetchError

  // 트랙별 횟수 계산
  const playCounts: Record<string, number> = {}
  ;(playEvents || []).forEach((evt) => {
    if (evt.track_id) {
      playCounts[evt.track_id] = (playCounts[evt.track_id] || 0) + 1
    }
  })

  // 내림차순 정렬 후 순위 산정
  const sortedTracks = Object.entries(playCounts)
    .map(([trackId, count]) => ({ trackId, count }))
    .sort((a, b) => b.count - a.count || a.trackId.localeCompare(b.trackId))
    .slice(0, 100) // 탑 100

  // 이전 기간 구하기
  let prevDate: Date
  if (periodType === 'daily') {
    prevDate = new Date(baseDate)
    prevDate.setUTCDate(prevDate.getUTCDate() - 1)
  } else if (periodType === 'weekly') {
    prevDate = new Date(startTime)
    prevDate.setUTCDate(prevDate.getUTCDate() - 7)
  } else {
    prevDate = new Date(startTime)
    prevDate.setUTCMonth(prevDate.getUTCMonth() - 1)
  }
  const prevDateStr = prevDate.toISOString().split('T')[0]

  // 이전 랭킹 스냅샷 로드
  const { data: prevSnapshots } = await supabase
    .from('chart_snapshots')
    .select('track_id, rank')
    .eq('period_type', periodType)
    .eq('period_date', prevDateStr)

  const prevRankMap: Record<string, number> = {}
  ;(prevSnapshots || []).forEach((snap) => {
    prevRankMap[snap.track_id] = snap.rank
  })

  // 신규 스냅샷 가공
  const newSnapshots = sortedTracks.map((item, idx) => {
    const currentRank = idx + 1
    const prevRank = prevRankMap[item.trackId]
    const rankChange = prevRank ? prevRank - currentRank : null // 상승은 양수, 하강은 음수

    return {
      period_type: periodType,
      period_date: dateStr,
      track_id: item.trackId,
      rank: currentRank,
      play_count: item.count,
      rank_change: rankChange
    }
  })

  // 기존 해당 날짜 스냅샷 삭제
  const { error: deleteError } = await supabase
    .from('chart_snapshots')
    .delete()
    .eq('period_type', periodType)
    .eq('period_date', dateStr)

  if (deleteError) throw deleteError

  // 신규 스냅샷 삽입
  if (newSnapshots.length > 0) {
    const { error: insertError } = await supabase
      .from('chart_snapshots')
      .insert(newSnapshots)

    if (insertError) throw insertError
  }

  console.log(`[Chart Engine] JS Fallback aggregation successful for ${periodType} / ${dateStr}`)
  return { success: true, method: 'js' }
}
