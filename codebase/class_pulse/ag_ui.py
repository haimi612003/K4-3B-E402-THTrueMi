"""One AG-UI lifecycle per action, including chunking and model fallbacks."""
import asyncio
from contextlib import suppress

import anyio
from ag_ui.core import (
    RunAgentInput, RunErrorEvent, RunFinishedEvent, RunStartedEvent, StateSnapshotEvent,
)
from pydantic_ai.ui.ag_ui import AGUIEventStream
from starlette.responses import StreamingResponse

from . import pydantic_ai_client, service


async def action_events(prepared, run_input: RunAgentInput):
    thread_id, run_id = run_input.thread_id, run_input.run_id
    yield RunStartedEvent(thread_id=thread_id, run_id=run_id)
    # Bounded buffering applies backpressure rather than accumulating an entire
    # provider response when the browser consumes events slowly.
    queue = asyncio.Queue(maxsize=32)
    done = object()

    async def work():
        try:
            result = await service.execute(
                prepared, call_id="ag-ui:%s:%s:%s" % (thread_id, run_id, prepared.operation),
                emit=queue.put, thread_id=thread_id, run_id=run_id,
            )
            await queue.put(StateSnapshotEvent(snapshot={
                "operation": prepared.operation, "status": "completed",
                "result": result.model_dump(mode="json", exclude_unset=True),
            }))
            await queue.put(RunFinishedEvent(thread_id=thread_id, run_id=run_id))
        except asyncio.CancelledError:
            raise
        except Exception as error:
            await queue.put(RunErrorEvent(message=pydantic_ai_client._safe_error(error)))
        await queue.put(done)

    task = asyncio.create_task(work())
    try:
        while True:
            event = await queue.get()
            if event is done:
                break
            yield event
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


class ActionStreamingResponse(StreamingResponse):
    """Close both nested generators even if ASGI send fails on disconnect."""
    def __init__(self, encoded_events, source_events):
        super().__init__(encoded_events, media_type="text/event-stream",
                         headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
        self.source_events = source_events

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            # Starlette's disconnect cancel scope must not interrupt provider
            # cleanup before the action worker has actually stopped.
            with anyio.CancelScope(shield=True):
                await self.body_iterator.aclose()
                await self.source_events.aclose()


def streaming_response(prepared, run_input):
    encoder = AGUIEventStream(run_input=run_input, accept="text/event-stream")
    events = action_events(prepared, run_input)
    return ActionStreamingResponse(encoder.encode_stream(events), events)
