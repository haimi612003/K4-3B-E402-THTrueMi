# Class Pulse AG-UI backend

Python 3.10+. Install `requirements.txt` in the repository-local `.venv`, then run
`python codebase/serve.py`. The backend installs `pydantic-ai-slim[google,ag-ui]`;
no other Pydantic AI extras are requested. The current frontend remains on JSON.

## Request

`POST /api/ag-ui/{operation}`, with `operation` one of `cluster`, `generate`,
`answer`, or `faq`. Use `Content-Type: application/json` and `Accept: text/event-stream`.
Authenticate through the existing `/api/login` route and include its `cp_session`
cookie when `CLASS_PULSE_PASSCODE` is configured. No API key goes to the browser.

The body is a standard AG-UI `RunAgentInput`. `forwardedProps.payload` holds the
same input as the corresponding JSON route. Supply a `threadId` and a fresh
`runId`; they correlate events and server call logs, without persisting a chat.

```json
{
  "threadId": "class-pulse-D04",
  "runId": "cluster-001",
  "messages": [],
  "state": {},
  "tools": [],
  "context": [],
  "forwardedProps": {
    "payload": {
      "label": "K4P1/D04",
      "questions": ["Agent là gì?", "Chatbot khác agent thế nào?"]
    }
  }
}
```

This example returns SPARSE without calling the model. To test a model run,
supply at least six non-empty questions.

| Operation | Payload |
|---|---|
| `cluster` | `questions`: strings or `{q, student?, turn_id?}` records; optional `label` |
| `generate` | Optional `topic`, `n` (default 14, clamped to 6–60) |
| `answer` | Optional `lecture`, `name`, `why`, `people`; `turn_ids` and/or `questions` |
| `faq` | Same draft input; output may refuse publication |

Clustering permits at most 60 input questions. Empty questions are skipped;
explicit duplicate turn IDs are rejected. Drafts prefer chatlog lookup by IDs,
falling back to supplied questions when no IDs resolve, and use at most 24
questions. Existing redaction, defaults, and text truncation still apply.
Messages, state, context, and frontend tools do not control execution. These are
action endpoints with server-built prompts, rather than conversational agents.

## Event contract

Events are encoded by the AG-UI protocol encoder as SSE `data:` records.

1. One `RUN_STARTED` echoes `threadId` and `runId`.
2. `STEP_STARTED` opens the operation. Each model attempt opens a nested step
   named `<call_id>:attempt:<number>` and closes it with `STEP_FINISHED`.
3. `CUSTOM` events named `class_pulse.progress` report actual attempts. `value`
   includes `phase` (`attempt` or `attempt_failed`), `call_id`, global `attempt`
   number for that call, `model`, and `fell_back`. Clustering adds `stage`, `chunk`
   (one-based), and `chunks`; merging adds `stage: "merge"`. Failed attempts also
   include `error`. These describe execution, not model reasoning.
4. Native model events are translated using Pydantic AI's AG-UI event stream.
   Text or tool output may be incomplete or belong to an unsuccessful attempt.
   Treat it as provisional; do not parse it into the authoritative application result.
5. After validation and deterministic postprocessing, the operation step closes
   and one `STATE_SNAPSHOT` provides the result below.
6. One `RUN_FINISHED` echoes the caller's IDs. Internal chunk calls, merging,
   retries, and fallback models never create additional run lifecycles.

```json
{
  "type": "STATE_SNAPSHOT",
  "snapshot": {
    "operation": "cluster",
    "status": "completed",
    "result": {"sparse": true, "clusters": [], "ai_call": {"called": false}}
  }
}
```

The result above is abbreviated. The full `result` has the same shape as the
corresponding `/api/cluster`, `/api/generate`, `/api/answer`, or `/api/faq` JSON
response, including metadata. Call IDs and timings naturally differ between runs.
No partial structured state is committed. A model-declared SPARSE result and a
FAQ refusal are successful outcomes, not protocol errors.

## Errors and disconnects

- Authentication fails with HTTP 401 and `{error, need_login}` before streaming.
- Malformed or incorrectly typed requests fail with HTTP 422 and `{error}`.
- Empty business inputs and question-limit violations fail with HTTP 400 and `{error}`.
- Recoverable model failures emit progress and retry within the explicit budget:
  three attempts per model, increasing backoff, then the existing fallback order.
  SDK and agent retries are disabled. Non-retryable HTTP failures stop immediately.
- Once streaming has started, an unrecoverable failure ends with one `RUN_ERROR`;
  there is no result snapshot or `RUN_FINISHED` afterwards. Errors do not contain API keys.
- Disconnect cancels the action worker, closes provider resources, and prevents
  remaining retries/chunks. No terminal event is guaranteed after disconnect.
  Reconnection does not resume or automatically replay an action; submit a fresh
  run explicitly if needed. There is no persisted history or cancellation endpoint.

The existing JSON endpoints remain supported for the current dashboard, standalone
HTML fallback, and evaluation scripts. A future frontend can use an AG-UI client
SDK and render progress plus the final snapshot without understanding provider JSON.

## Offline checks

```bash
python -m unittest discover -s codebase -p test_backend.py -v
python codebase/test_serve.py
python eval/run_eval_answer.py --selftest
```

These checks use Pydantic AI test models, mocked Google transport, and a real
localhost Uvicorn HTTP/SSE run; they do not make paid provider requests. Full live
evaluation needs the external chatlog pack and must write a new evaluation run.
