import { useState } from 'react'
import {
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  unstable_useSlashCommandAdapter as useSlashCommandAdapter,
  unstable_useMentionAdapter as useMentionAdapter,
  unstable_defaultDirectiveFormatter,
} from '@assistant-ui/react'
import { ArrowDownIcon, ArrowUpIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { ClusterResultView } from './ClusterResultView'
import { isClusterResult } from './cluster-result'
import type { Sample } from './SamplePanel'
import { ClusterLoading } from './ClusterLoading'
import type { ClusterRunState } from '../cluster-run'

export type StateSnapshot = {
  operation?: string
  status?: string
  result?: unknown
  messageId?: string
  resultsByMessage?: Record<string, unknown>
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[min(80%,42rem)] rounded-[28px] rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground shadow-lg shadow-black/10">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantText({ text }: { text: string }) {
  // Structured results are rendered only from the enriched STATE_SNAPSHOT.
  if (text.trimStart().startsWith('{')) return null
  return <span className="whitespace-pre-wrap break-words">{text}</span>
}

function AssistantMessage({ result, hidden }: { result?: unknown; hidden?: boolean }) {
  if (hidden) return null
  return (
    <MessagePrimitive.Root className="flex items-start gap-3">
      <div className="min-w-0 flex-1 py-3 text-sm leading-6 text-card-foreground">
        {isClusterResult(result) ? <ClusterResultView result={result} /> :
          <MessagePrimitive.Parts components={{ Text: AssistantText }} />}
      </div>
    </MessagePrimitive.Root>
  )
}

function Welcome() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h2 className="text-2xl font-semibold leading-relaxed text-foreground">
        Nhanh chóng quyết định điểm cần ôn lại cho lớp của bạn chỉ với ‘@’
      </h2>
    </div>
  )
}

function Composer({
  samples,
  onSlashCommandChange,
}: {
  samples: Sample[]
  onSlashCommandChange?: (commandId: string | null) => void
}) {
  const [activeCommand, setActiveCommand] = useState<{
    id: string
    label: string
  } | null>(null)
  const mention = useMentionAdapter({
    includeModelContextTools: false,
    items: samples.filter((sample) => sample.items.length > 0).map((sample) => ({
      id: sample.id,
      type: 'cluster',
      label: sample.title,
      description: `${sample.items.length} câu hỏi · ${sample.hint}`,
    })),
    formatter: {
      ...unstable_defaultDirectiveFormatter,
      serialize: (item) => {
        const sample = samples.find((sample) => sample.id === item.id)
        return `\n${sample?.items.map((question) => question.q.trim()).filter(Boolean).join('\n') ?? ''}\n`
      },
    },
    onInserted: () => {
      setActiveCommand({ id: 'gom', label: 'Gom' })
      onSlashCommandChange?.('gom')
    },
  })
  const slash = useSlashCommandAdapter({
    removeOnExecute: true,
    commands: [
      {
        id: 'gom',
        label: 'Gom',
        description: 'Gom các câu hỏi có điểm tương đồng với nhau',
        execute: () => undefined,
      },
    ],
  })

  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <div className="relative">
        <ComposerPrimitive.Root
          onSubmit={() => setActiveCommand(null)}
          className="rounded-[28px] border border-border bg-card/95 p-2 shadow-2xl shadow-black/10 backdrop-blur"
        >
          {activeCommand && (
            <div className="flex items-center px-3 pt-2">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
                <SparklesIcon className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{activeCommand.label}</span>
                <button
                  type="button"
                  aria-label={`Xóa lệnh ${activeCommand.label}`}
                  onClick={() => {
                    setActiveCommand(null)
                    onSlashCommandChange?.(null)
                  }}
                  className="-mr-1 rounded-full p-0.5 transition hover:bg-primary/15"
                >
                  <XMarkIcon className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            </div>
          )}
          <ComposerPrimitive.Input
            aria-label="Tin nhắn"
            placeholder="Nhàn hơn với Class Pulse (gõ / để xem lệnh, @ để nạp cụm câu hỏi)"
            className="max-h-60 min-h-10 w-full resize-none overflow-y-auto bg-transparent px-5 pt-3 pb-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            rows={1}
          />
          <div className="flex items-center justify-end px-3 pb-3">
            <ComposerPrimitive.Send className="grid size-9 place-items-center rounded-full bg-primary text-lg text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-35">
              <ArrowUpIcon className="size-4 text-primary-foreground" />
            </ComposerPrimitive.Send>
          </div>
        </ComposerPrimitive.Root>

        <ComposerPrimitive.Unstable_TriggerPopover
          char="@"
          adapter={mention.adapter}
          className="absolute bottom-full left-0 mb-2 max-h-72 w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-1 text-card-foreground shadow-xl"
        >
          <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
          <ComposerPrimitive.Unstable_TriggerPopoverItems>
            {(items) => items.length ? items.map((item, index) => (
              <ComposerPrimitive.Unstable_TriggerPopoverItem
                key={item.id}
                item={item}
                index={index}
                className="flex w-full flex-col items-start gap-1 rounded-lg px-3 py-2 text-left hover:bg-accent"
              >
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs leading-5 text-muted-foreground">{item.description}</span>
              </ComposerPrimitive.Unstable_TriggerPopoverItem>
            )) : <p className="px-3 py-2 text-xs text-muted-foreground">Không có cụm câu hỏi phù hợp.</p>}
          </ComposerPrimitive.Unstable_TriggerPopoverItems>
        </ComposerPrimitive.Unstable_TriggerPopover>

        <ComposerPrimitive.Unstable_TriggerPopover
          char="/"
          adapter={slash.adapter}
          className="absolute bottom-full left-0 mb-2 min-w-48 rounded-xl border border-border bg-card p-1 text-card-foreground shadow-xl"
        >
          <ComposerPrimitive.Unstable_TriggerPopover.Action
            {...slash.action}
            onExecute={(item) => {
              setActiveCommand({
                id: item.id,
                label: item.label || 'Gom',
              })
              onSlashCommandChange?.(item.id)
              slash.action.onExecute(item)
            }}
          />
          <ComposerPrimitive.Unstable_TriggerPopoverItems>
            {(items) =>
              items.map((item, index) => (
                <ComposerPrimitive.Unstable_TriggerPopoverItem
                  key={item.id}
                  item={item}
                  index={index}
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  {item.label}
                </ComposerPrimitive.Unstable_TriggerPopoverItem>
              ))
            }
          </ComposerPrimitive.Unstable_TriggerPopoverItems>
        </ComposerPrimitive.Unstable_TriggerPopover>
      </div>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  )
}

export function ChatThread({
  runState,
  onRetry,
  samples,
  latestSnapshot,
  onSlashCommandChange,
}: {
  runState: ClusterRunState
  onRetry: () => void
  samples: Sample[]
  latestSnapshot: StateSnapshot | null
  onSlashCommandChange?: (commandId: string | null) => void
}) {
  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 md:px-8 md:py-4"
      >
        <AuiIf condition={(state) => state.thread.isEmpty}>
          <Welcome />
        </AuiIf>

        <ThreadPrimitive.Messages>
          {({ message }) =>
            message.role === 'user' ? <UserMessage /> : <AssistantMessage hidden={runState.status !== 'completed' && message.id === runState.messageId} result={latestSnapshot?.resultsByMessage?.[message.id]} />
          }
        </ThreadPrimitive.Messages>
        <ClusterLoading state={runState} onRetry={onRetry} />
        {latestSnapshot?.status === 'completed' && !latestSnapshot.messageId && isClusterResult(latestSnapshot.result) && runState.status === 'completed' && <ClusterResultView result={latestSnapshot.result} />}

        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 z-10 -mx-4 mt-auto bg-background px-4 pt-4 md:-mx-8 md:px-8">
          <ThreadPrimitive.ScrollToBottom
            behavior="smooth"
            aria-label="Cuộn xuống tin nhắn mới nhất"
            title="Cuộn xuống tin nhắn mới nhất"
            className="absolute -top-12 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:hidden"
          >
            <ArrowDownIcon className="size-4" />
          </ThreadPrimitive.ScrollToBottom>
          <Composer samples={samples} onSlashCommandChange={onSlashCommandChange} />
          {/*<div aria-hidden="true" className="h-16 bg-background" />*/}
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}
