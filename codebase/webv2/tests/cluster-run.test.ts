import assert from 'node:assert/strict'
import { test } from 'node:test'
import { updateClusterRun, type ClusterRunState } from '../src/cluster-run.ts'

const initial: ClusterRunState = { status: 'loading', phase: 'preparing', count: 10 }
const progress = (phase: string, fell_back = false) => ({ type: 'CUSTOM', name: 'class_pulse.progress', value: { phase, fell_back } })

test('retries and fallback keep one pending run until the completed snapshot', () => {
  let state = updateClusterRun(initial, { type: 'RUN_STARTED' })
  state = updateClusterRun(state, progress('attempt'))
  assert.equal(state.phase, 'analyzing')
  for (let attempt = 0; attempt < 3; attempt++) {
    state = updateClusterRun(state, progress('attempt_failed'))
    assert.equal(state.status, 'loading')
    assert.equal(state.phase, 'retrying')
    state = updateClusterRun(state, progress('attempt'))
    assert.equal(state.phase, 'retrying')
  }
  state = updateClusterRun(state, progress('attempt', true))
  assert.equal(state.phase, 'fallback')
  state = updateClusterRun(state, { type: 'TEXT_MESSAGE_START', messageId: 'assistant-1' })
  assert.equal(state.messageId, 'assistant-1')
  state = updateClusterRun(state, { type: 'TEXT_MESSAGE_CONTENT', delta: '{"clusters":[]}' })
  assert.equal(state.phase, 'summarizing')
  state = updateClusterRun(state, { type: 'TEXT_MESSAGE_END' })
  assert.equal(state.status, 'loading')
  state = updateClusterRun(state, { type: 'STATE_SNAPSHOT', snapshot: { status: 'completed', result: {} } })
  state = updateClusterRun(state, { type: 'RUN_FINISHED' })
  assert.equal(state.status, 'completed')
  assert.equal(state.count, 10)
})

test('terminal errors and missing final snapshots do not leave a loading card', () => {
  assert.equal(updateClusterRun(initial, { type: 'RUN_ERROR' }).status, 'error')
  assert.equal(updateClusterRun(initial, { type: 'RUN_FINISHED' }).status, 'error')
})

test('runs without text can complete and subsequent runs clear the old message ID', () => {
  const completed = updateClusterRun(initial, { type: 'STATE_SNAPSHOT', snapshot: { status: 'completed' } })
  assert.equal(completed.status, 'completed')
  const next = updateClusterRun({ ...completed, messageId: 'old' }, { type: 'RUN_STARTED' })
  assert.equal(next.messageId, undefined)
  assert.equal(next.status, 'loading')
})

test('unrelated events and partial snapshots do not complete the run', () => {
  assert.equal(updateClusterRun(initial, { type: 'CUSTOM', name: 'other' }), initial)
  assert.equal(updateClusterRun(initial, { type: 'STATE_SNAPSHOT', snapshot: { status: 'processing' } }), initial)
  assert.equal(updateClusterRun(initial, { type: 'TEXT_MESSAGE_START', role: 'user', messageId: 'user-1' }), initial)
})
