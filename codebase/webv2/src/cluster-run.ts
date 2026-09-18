export type ClusterRunState = {
  status: 'idle' | 'loading' | 'completed' | 'error'
  phase: 'preparing' | 'analyzing' | 'retrying' | 'fallback' | 'summarizing'
  count?: number
  messageId?: string
}

export function updateClusterRun(state: ClusterRunState, event: { type: string; [key: string]: unknown }): ClusterRunState {
  switch (event.type) {
    case 'RUN_STARTED':
      return { ...state, status: 'loading', phase: 'preparing', messageId: undefined }
    case 'CUSTOM': {
      if (state.status !== 'loading' || event.name !== 'class_pulse.progress' || !event.value || typeof event.value !== 'object') return state
      const progress = event.value as { phase?: string; fell_back?: boolean }
      if (progress.phase === 'attempt_failed') return { ...state, phase: 'retrying' }
      if (progress.phase === 'attempt') return { ...state, phase: progress.fell_back ? 'fallback' : state.phase === 'retrying' ? 'retrying' : 'analyzing' }
      return state
    }
    case 'TEXT_MESSAGE_START':
      // Some AG-UI providers omit role on TEXT_MESSAGE_START.
      return event.role !== 'user' && typeof event.messageId === 'string' ? { ...state, messageId: event.messageId } : state
    case 'TEXT_MESSAGE_CONTENT':
      return state.status === 'loading' ? { ...state, phase: 'summarizing' } : state
    case 'STATE_SNAPSHOT':
      return event.snapshot && typeof event.snapshot === 'object' && 'status' in event.snapshot && event.snapshot.status === 'completed' ? { ...state, status: 'completed' } : state
    case 'RUN_ERROR':
      return { ...state, status: 'error' }
    case 'RUN_FINISHED':
      return state.status === 'loading' ? { ...state, status: 'error' } : state
    default:
      return state
  }
}
