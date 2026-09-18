"""Typed Gemini calls, explicit retry/fallback budgets, and per-attempt evidence."""
import asyncio
from contextlib import asynccontextmanager
import json
import os
import threading
import time
from typing import TypeVar

import httpx2
from google.genai.types import HttpRetryOptions
from pydantic import BaseModel
from pydantic_ai import Agent, NativeOutput, UnexpectedModelBehavior
from pydantic_ai.exceptions import ModelAPIError, ModelHTTPError
from pydantic_ai.messages import PartDeltaEvent, PartStartEvent, TextPart, TextPartDelta
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.run import AgentRunResultEvent
from ag_ui.core import CustomEvent, StepFinishedEvent, StepStartedEvent
from pydantic_ai.ui.ag_ui import AGUIEventStream

from . import config
from .models import CallMetadata, SelfTestOutput

LOG_FILE = "gemini-calls.jsonl"
FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3-flash-preview"]
RETRYABLE_STATUS = (429, 500, 502, 503, 504)
_LOG_LOCK = threading.Lock()
OutputT = TypeVar("OutputT", bound=BaseModel)


class GeminiError(RuntimeError):
    pass


def _log(record):
    with _LOG_LOCK:
        os.makedirs(config.LOG_DIR, exist_ok=True)
        with open(os.path.join(config.LOG_DIR, LOG_FILE), "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


@asynccontextmanager
async def _agent_for(model, output_type, temperature, timeout):
    # Explicit ownership keeps clients local to this event loop and closes them
    # on success, errors, and disconnect cancellation alike.
    async with httpx2.AsyncClient(timeout=timeout) as http_client:
        provider = GoogleProvider(
            api_key=config.api_key(), http_client=http_client,
            retry_options=HttpRetryOptions(attempts=1),
        )
        try:
            yield Agent(
                GoogleModel(model, provider=provider),
                output_type=NativeOutput(output_type), retries=0,
                model_settings={"temperature": temperature},
            )
        finally:
            await provider.client.aio.aclose()
            provider.client.close()


class AttemptEventStream(AGUIEventStream):
    """Translate native model events without starting a nested AG-UI run."""
    async def before_stream(self):
        if False:
            yield

    async def after_stream(self):
        if False:
            yield

    async def on_error(self, error):
        # The workflow owns retries and the sole terminal RUN_ERROR. The base
        # transformer closes open message/tool parts before calling this hook.
        raise error
        yield  # pragma: no cover


async def _emit(emit, event):
    if emit is not None:
        await emit(event)


def _safe_error(error):
    # SDK exceptions may include URLs/headers; never write a configured key.
    detail = str(error)
    key = os.environ.get("GEMINI_API_KEY", "")
    if key:
        detail = detail.replace(key, "[REDACTED]")
    return "%s: %s" % (type(error).__name__, detail[:400])


async def generate_json_async(prompt, output_type: type[OutputT], *, call_id,
                              temperature=0.0, model=None, max_retries=3,
                              timeout=180, emit=None, thread_id=None, run_id=None,
                              progress_context=None):
    """Return (validated output, metadata); each attempt makes one model request."""
    if max_retries < 1:
        raise ValueError("max_retries must be at least 1")
    primary = model or config.model_name()
    chain = [primary] + [m for m in FALLBACK_MODELS if m != primary]
    last_err = None
    total_attempts = 0
    for mdl in chain:
        for attempt in range(1, max_retries + 1):
            total_attempts += 1
            started = time.monotonic()
            parts, result = {}, None
            cancelled = False
            step = "%s:attempt:%d" % (call_id, total_attempts)
            progress = {"phase": "attempt", "call_id": call_id,
                        "attempt": total_attempts, "model": mdl,
                        "fell_back": mdl != primary, **(progress_context or {})}
            await _emit(emit, StepStartedEvent(step_name=step))
            await _emit(emit, CustomEvent(name="class_pulse.progress", value=progress))
            try:
                async with _agent_for(mdl, output_type, temperature, timeout) as agent:
                    async with agent.run_stream_events(
                        prompt, conversation_id=thread_id,
                        metadata={"call_id": call_id, "ag_ui_run_id": run_id},
                    ) as events:
                        async def capture():
                            nonlocal result
                            async for event in events:
                                if isinstance(event, PartStartEvent) and isinstance(event.part, TextPart):
                                    parts[event.index] = event.part.content
                                elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                    parts[event.index] = parts.get(event.index, "") + event.delta.content_delta
                                elif isinstance(event, AgentRunResultEvent):
                                    result = event.result
                                yield event

                        if emit is None:
                            async for _ in capture():
                                pass
                        else:
                            translator = AttemptEventStream(
                                thread_id=thread_id, run_id=run_id,
                            )
                            async for event in translator.transform_stream(capture()):
                                await emit(event)
                if result is None:
                    raise UnexpectedModelBehavior("Model did not return a validated result")
                text = "".join(parts.values())
                usage = result.usage
                elapsed = int((time.monotonic() - started) * 1000)
                meta = CallMetadata(
                    model=mdl, fell_back=mdl != primary, latency_ms=elapsed,
                    tokens_in=usage.input_tokens or None,
                    tokens_out=usage.output_tokens or None,
                    attempts=total_attempts, raw_text=text,
                )
                # Pydantic AI output_tokens already includes Google's thoughts.
                thoughts = usage.details.get("thoughts_tokens", 0)
                _log({
                    "call_id": call_id, "thread_id": thread_id, "run_id": run_id,
                    "ok": True, "attempt": total_attempts, "model": mdl,
                    "fell_back": mdl != primary, "latency_ms": elapsed,
                    "usage": {"promptTokenCount": meta.tokens_in,
                              "candidatesTokenCount": max(0, usage.output_tokens - thoughts),
                              "thoughtsTokenCount": thoughts},
                    "prompt": prompt, "raw_response": text,
                })
                return result.output, meta
            except (ModelAPIError, UnexpectedModelBehavior, httpx2.HTTPError,
                    TimeoutError, json.JSONDecodeError) as error:
                elapsed = int((time.monotonic() - started) * 1000)
                last_err = _safe_error(error)
                _log({
                    "call_id": call_id, "thread_id": thread_id, "run_id": run_id,
                    "ok": False, "attempt": total_attempts, "model": mdl,
                    "fell_back": mdl != primary, "latency_ms": elapsed,
                    "error": last_err, "prompt_chars": len(prompt), "prompt": prompt,
                    "raw_response": "".join(parts.values()),
                })
                if isinstance(error, ModelHTTPError) and error.status_code not in RETRYABLE_STATUS:
                    raise GeminiError("Gemini trả %s: %s" % (error.status_code, last_err)) from error
                await _emit(emit, CustomEvent(name="class_pulse.progress", value={
                    **progress, "phase": "attempt_failed", "error": last_err,
                }))
            except asyncio.CancelledError:
                cancelled = True
                _log({"call_id": call_id, "thread_id": thread_id, "run_id": run_id,
                      "ok": False, "cancelled": True, "attempt": total_attempts,
                      "model": mdl, "latency_ms": int((time.monotonic() - started) * 1000)})
                raise
            finally:
                # On disconnect, don't queue events into a stream nobody reads.
                if not cancelled:
                    await _emit(emit, StepFinishedEvent(step_name=step))
            if attempt < max_retries:
                await asyncio.sleep(3 * attempt)
    raise GeminiError(
        "Gọi Gemini thất bại sau %d lần trên %d model (%s). Lỗi cuối: %s"
        % (total_attempts, len(chain), ", ".join(chain), last_err))


def generate_json(prompt, output_type, **kwargs):
    """Synchronous CLI wrapper; use generate_json_async inside an event loop."""
    return asyncio.run(generate_json_async(prompt, output_type, **kwargs))


def selftest():
    return generate_json(
        "Trả JSON: echo = chuỗi 'class-pulse-selftest', sum = 17 + 25.",
        SelfTestOutput, call_id="selftest",
    )
