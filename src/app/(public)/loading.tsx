/**
 * 첫 페이지(/music)가 캐시 없이 매번 서버에서 여러 쿼리를 새로 돌려서
 * 진입할 때마다 1.6초쯤 아무 반응이 없어 보였다(대표 보고 2026-08-30:
 * "쿠키뮤직 클릭시 조금 딜레이있음, 바로 들어가지 못함"). 데이터를 캐싱하면
 * 로그인 상태 같은 사용자별 값도 같이 캐시될 위험이 있어(대표 확인
 * 2026-08-30) 캐싱 대신 이 파일로 해결한다 — Next.js 는 이 파일이 있으면
 * `app/(public)/page.tsx` 가 서버에서 데이터를 불러오는 동안 이 화면을
 * 즉시 보여준다(스트리밍). 실제 로딩 시간은 그대로지만 클릭하자마자
 * 반응이 오므로 "멈춘 것 같다"는 느낌은 사라진다.
 */
export default function Loading() {
  return (
    <div className="bg-surface min-h-screen animate-pulse">
      {/* 히어로 배너 자리 */}
      <div className="relative w-full h-[360px] bg-surface-container-lowest border-b border-outline-variant/10" />

      <div className="px-6 py-6 space-y-8">
        {/* 실시간 인기 트랙 목록 자리 */}
        <div className="space-y-3">
          <div className="h-5 w-32 rounded bg-surface-container-lowest" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 h-14">
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-surface-container-lowest" />
                <div className="h-2 w-1/5 rounded bg-surface-container-lowest" />
              </div>
            </div>
          ))}
        </div>

        {/* 아티스트 카드 자리 */}
        <div className="space-y-3">
          <div className="h-5 w-40 rounded bg-surface-container-lowest" />
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-20 h-20 rounded-full bg-surface-container-lowest shrink-0" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
