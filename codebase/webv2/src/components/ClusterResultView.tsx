import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion'
import { ClusterDraft } from './ClusterDraft'

type Question = { turn_id: string; q: string }
type Cluster = {
  name: string
  why?: string
  turn_ids: string[]
  turns?: number
  people?: number
  weak?: boolean
  skew?: boolean
  examples?: Question[]
  questions?: Question[]
}
export type Result = {
  lecture?: string
  sparse?: boolean
  sparse_reason?: string
  clusters: Cluster[]
  total_turns?: number
  students?: number
  input?: Question[]
  scatter?: { turns: number; turn_ids: string[] }
  scatter_turn_ids?: string[]
  wall_ms?: number
  ai_call?: { latency_ms?: number; n_calls?: number; tokens_in?: number; tokens_out?: number }
}

const number = (value: number) => value.toLocaleString('vi-VN')

export function ClusterResultView({ result }: { result: Result }) {
  const scatter = result.scatter?.turns ?? result.scatter_turn_ids?.length ?? 0
  const total = result.total_turns ?? result.input?.length ??
    result.clusters.reduce((sum, cluster) => sum + (cluster.turns ?? cluster.turn_ids.length), scatter)
  const duration = result.wall_ms ?? result.ai_call?.latency_ms
  const metrics = [
    { label: 'Câu hỏi đầu vào', value: number(total) },
    { label: 'Cụm chủ đề', value: number(result.clusters.length) },
    { label: 'Câu rải rác', value: number(scatter) },
  ]

  return (
    <section aria-label="Kết quả gom câu hỏi" className="w-full min-w-0 space-y-3 text-foreground">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Class Pulse · Phân tích lớp học</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Bức tranh câu hỏi</h2>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Đã phân tích</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border bg-background p-3 sm:p-4">
            <p className="text-[11px] leading-4 text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{metric.value}</p>
          </div>
        ))}
      </div>

      {result.sparse && (
        <div role="status" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6">
          <p className="font-medium">Chưa đủ tín hiệu để kết luận</p>
          <p className="mt-1 text-muted-foreground">{result.sparse_reason || 'Chưa tìm được cụm vấn đề đáng tin trong tập câu hỏi này.'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {result.clusters.map((cluster, index) => {
          const turns = cluster.turns ?? cluster.turn_ids.length
          const share = total ? Math.round(turns / total * 100) : 0
          const inputQuestions = result.input?.filter((question) => cluster.turn_ids.includes(question.turn_id))
          const questions = cluster.questions?.length ? cluster.questions :
            inputQuestions?.length ? inputQuestions : cluster.examples ?? []
          return (
            <article key={`${cluster.name}-${index}`} className={`min-w-0 rounded-2xl border border-border bg-background p-4 ${index === 0 ? 'sm:col-span-2 sm:p-5' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{String(index + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-5">{cluster.name}</h3>
                  {(cluster.weak !== undefined || cluster.skew) && (
                    <span className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${cluster.weak || cluster.skew ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
                      {cluster.skew ? 'Tín hiệu lệch' : cluster.weak ? 'Cụm yếu' : 'Cụm rõ'}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">{cluster.why || 'Các câu hỏi có cùng chủ đề.'}</p>
              <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span><span className="font-medium text-foreground">{turns}</span> lượt{cluster.people !== undefined ? ` · ${cluster.people} người` : ''}</span>
                <span className="tabular-nums">{share}% câu hỏi</span>
              </div>
              <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(share, 100)}%` }} />
              </div>
              {questions.length > 0 && (
                <Accordion className="mt-3 rounded-none border-0">
                  <AccordionItem value="questions">
                    <AccordionTrigger className="px-0 py-2 text-xs text-muted-foreground">Xem câu hỏi trong cụm</AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 pt-2">
                        {questions.map((question) => <li key={question.turn_id} className="text-xs leading-5"><span className="mr-2 font-mono text-[10px] text-muted-foreground">{question.turn_id}</span>{question.q}</li>)}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
              <ClusterDraft payload={{
                lecture: result.lecture,
                name: cluster.name,
                why: cluster.why,
                people: cluster.people,
                turn_ids: cluster.turn_ids,
                questions: questions.map((question) => question.q),
              }} />
            </article>
          )
        })}
        {result.ai_call && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border bg-background px-4 py-3 text-[11px] text-muted-foreground sm:col-span-2">
            {duration !== undefined && <span>Thời gian <span className="ml-1 font-medium tabular-nums text-foreground">{(duration / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} s</span></span>}
            <span>{result.ai_call.n_calls ?? 0} lần gọi AI</span>
            {result.ai_call.tokens_in !== undefined && <span>Token vào <span className="font-medium text-foreground">{number(result.ai_call.tokens_in)}</span></span>}
            {result.ai_call.tokens_out !== undefined && <span>Token ra <span className="font-medium text-foreground">{number(result.ai_call.tokens_out)}</span></span>}
          </div>
        )}
      </div>
    </section>
  )
}
