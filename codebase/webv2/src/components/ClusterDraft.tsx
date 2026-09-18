import { useRef, useState } from 'react'
import { SparklesIcon } from '@heroicons/react/20/solid'

type Draft = {
  misread: string
  different: string
  example: string
  check: string
  caveat: string
  confidence: string
  minutes?: number | null
  ai?: { model: string; latency_ms: number; tokens_out?: number | null }
}

type Payload = {
  lecture?: string
  name: string
  why?: string
  people?: number
  turn_ids: string[]
  questions: string[]
}

const fields = [
  ['misread', 'Học viên đang hiểu sai ở đâu'],
  ['different', 'Giảng lại theo cách khác'],
  ['example', 'Ví dụ cụ thể'],
  ['check', 'Câu kiểm tra nhanh'],
  ['caveat', 'Chỗ cần tự kiểm trước khi dùng'],
] as const

export function ClusterDraft({ payload }: { payload: Payload }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)

  async function requestDraft() {
    if (pending.current) return
    if (draft) {
      setVisible((value) => !value)
      return
    }
    pending.current = true
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/answer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Không thể tạo bản nháp. Vui lòng thử lại.')
      }
      if (!fields.every(([key]) => typeof data[key] === 'string') || typeof data.confidence !== 'string') {
        throw new Error('Phản hồi bản nháp không đúng định dạng. Vui lòng thử lại.')
      }
      setDraft(data)
      setVisible(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể kết nối đến máy chủ.')
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={requestDraft}
        disabled={loading}
        aria-expanded={visible}
        className="inline-flex items-center gap-2 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
      >
        <SparklesIcon aria-hidden="true" className={`size-4 ${loading ? 'animate-pulse' : ''}`} />
        {loading ? 'Đang soạn bản nháp…' : visible ? 'Ẩn bản nháp' : draft ? 'Xem bản nháp' : 'Draft nội dung cho cụm này'}
      </button>
      <div aria-live="polite">
        {error && <p role="alert" className="mt-3 text-xs text-destructive">{error} Bấm lại để thử lại.</p>}
        {visible && draft && (
          <div className="mt-3 space-y-4 rounded-xl border border-border border-l-2 border-l-primary/50 bg-background p-4">
            <div>
              <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground">Bản nháp</span>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Lab Coach là người quyết định cuối cùng — đây là vật liệu tham khảo.
                {draft.minutes != null && ` Ước lượng ~${draft.minutes} phút trên lớp.`}
                {` Độ chắc chắn model tự khai: ${draft.confidence}.`}
              </p>
            </div>
            {fields.map(([key, label]) => draft[key] && (
              <section key={key} className="border-t border-border pt-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</h4>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{draft[key]}</p>
              </section>
            ))}
            {draft.ai && <p className="text-[10px] leading-5 text-muted-foreground">Soạn bằng {draft.ai.model} · {(draft.ai.latency_ms / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} s{draft.ai.tokens_out != null && ` · ${draft.ai.tokens_out.toLocaleString('vi-VN')} token ra`}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
