import type { ClusterRunState } from '../cluster-run'

const labels = {
  preparing: 'Đang chuẩn bị phân tích…',
  analyzing: 'Đang tìm các câu hỏi cùng chủ đề…',
  retrying: 'Kết nối tới mô hình bị gián đoạn, đang thử lại…',
  fallback: 'Đang chuyển sang mô hình dự phòng…',
  summarizing: 'Đang tổng hợp kết quả…',
}

export function ClusterLoading({ state, onRetry }: { state: ClusterRunState; onRetry: () => void }) {
  if (state.status !== 'loading' && state.status !== 'error') return null
  const failed = state.status === 'error'
  return (
    <section aria-label="Tiến trình gom câu hỏi" aria-busy={!failed} className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <div role="status" aria-live="polite" aria-atomic="true">
        <h2 className="text-sm font-semibold text-foreground">{failed ? 'Chưa thể hoàn tất phân tích' : `Đang gom${state.count !== undefined ? ` ${state.count}` : ''} câu hỏi`}</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{failed ? 'Không nhận được kết quả hoàn chỉnh. Bạn có thể thử lại.' : labels[state.phase]}</p>
      </div>
      {failed ? (
        <button type="button" onClick={onRetry} className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Thử lại</button>
      ) : (
        <div aria-hidden="true" className="mt-5 space-y-3 motion-safe:animate-pulse">
          <div className="h-3 w-2/5 rounded-full bg-muted" />
          <div className="h-2 w-4/5 rounded-full bg-muted" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-3 rounded-xl border border-border p-3"><div className="h-2 w-3/4 rounded-full bg-muted" /><div className="h-2 w-full rounded-full bg-muted" /><div className="h-2 w-1/2 rounded-full bg-muted" /></div>
            <div className="space-y-3 rounded-xl border border-border p-3"><div className="h-2 w-2/3 rounded-full bg-muted" /><div className="h-2 w-full rounded-full bg-muted" /><div className="h-2 w-3/5 rounded-full bg-muted" /></div>
          </div>
        </div>
      )}
    </section>
  )
}
