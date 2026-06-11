"""Simulation state machine — reference implementation for fleet sim MCPs.

Replaces ad-hoc ``_jobs`` dicts with a proper state machine:
states, transitions, guards, lifecycle hooks. Pattern: inner loop (state machine)
for deterministic lifecycle, outer loop (AI agent) for planning and analysis.

::

    IDLE ──load_model()──→ MODEL_LOADED ──start_sim()──→ STARTING ──poll OK──→ RUNNING
     ↑                        ↑                            │                    │
     │                        │                            ├──poll fail──┐      ├──stop_sim()──┐
     │                        │                            │             ▼      │              ▼
     │                        │                            │          CRASHED   │          STOPPING
     │                        │                            │                    │              │
     │                        │                            │                    ├──terminate OK──→ STOPPED
     │                        │                            │                    └──kill timeout──→ CRASHED
     └──reset()───────────────┘                            │                    │
     └──reset()────────────────────────────────────────────┘◄───────────────────┘
"""

from __future__ import annotations

import enum
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable

logger = logging.getLogger(__name__)


class SimState(enum.Enum):
    """Finite states for a simulation lifecycle."""

    IDLE = "idle"
    MODEL_LOADED = "model_loaded"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    STOPPED = "stopped"
    CRASHED = "crashed"
    ERROR = "error"

    def terminal(self) -> bool:
        """States that expect no further transitions without explicit reset."""
        return self in (SimState.STOPPED, SimState.CRASHED, SimState.ERROR)

    def can_start(self) -> bool:
        """Can we call start_sim from this state?"""
        return self in (SimState.MODEL_LOADED, SimState.STOPPED, SimState.CRASHED)


@dataclass
class SimJob:
    """Stateful simulation job with lifecycle tracking."""

    job_id: str
    model_name: str
    state: SimState = SimState.IDLE

    # Process handle
    process: Any = None  # subprocess.Popen | None
    pid: int | None = None

    # Timing
    created_at: float = field(default_factory=time.time)
    started_at: float | None = None
    stopped_at: float | None = None
    state_changed_at: float = field(default_factory=time.time)

    # Metadata
    headless: bool = True
    render: bool = False
    error_message: str | None = None
    exit_code: int | None = None

    # Callbacks (registered by the server)
    _on_enter_state: dict[SimState, list[Callable]] = field(default_factory=dict)

    def transition_to(self, new_state: SimState, reason: str = "") -> None:
        """Transition the job to a new state with validation."""
        valid = self._valid_transitions().get(self.state, set())
        if new_state not in valid and self.state != new_state:
            logger.warning("Invalid transition %s -> %s for job %s", self.state.value, new_state.value, self.job_id)
            self.state = SimState.ERROR
            self.error_message = f"Invalid transition: {self.state.value} -> {new_state.value}"
            return

        old = self.state
        self.state = new_state
        self.state_changed_at = time.time()
        logger.info("Job %s: %s -> %s%s", self.job_id, old.value, new_state.value,
                     f" ({reason})" if reason else "")

        for cb in self._on_enter_state.get(new_state, []):
            try:
                cb(self)
            except Exception as e:
                logger.exception("State callback failed: %s", e)

    def uptime(self) -> float:
        if self.started_at and not self.stopped_at:
            return time.time() - self.started_at
        if self.started_at and self.stopped_at:
            return self.stopped_at - self.started_at
        return 0.0

    def info(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "model_name": self.model_name,
            "state": self.state.value,
            "state_changed_at": self.state_changed_at,
            "pid": self.pid,
            "uptime_s": round(self.uptime(), 1),
            "headless": self.headless,
            "render": self.render,
            "error": self.error_message,
            "exit_code": self.exit_code,
        }

    @staticmethod
    def _valid_transitions() -> dict[SimState, set[SimState]]:
        return {
            SimState.IDLE: {SimState.MODEL_LOADED, SimState.ERROR},
            SimState.MODEL_LOADED: {SimState.STARTING, SimState.IDLE, SimState.ERROR},
            SimState.STARTING: {SimState.RUNNING, SimState.CRASHED, SimState.ERROR},
            SimState.RUNNING: {SimState.STOPPING, SimState.CRASHED, SimState.ERROR},
            SimState.STOPPING: {SimState.STOPPED, SimState.CRASHED, SimState.ERROR},
            SimState.STOPPED: {SimState.MODEL_LOADED, SimState.IDLE, SimState.ERROR},
            SimState.CRASHED: {SimState.MODEL_LOADED, SimState.IDLE, SimState.ERROR},
            SimState.ERROR: {SimState.IDLE},
        }


# ---------------------------------------------------------------------------
# Concrete transition helpers used by the server tools
# ---------------------------------------------------------------------------

def on_enter(job: SimJob, state: SimState, fn: Callable) -> None:
    """Register a callback invoked when a job enters a given state."""
    if state not in job._on_enter_state:
        job._on_enter_state[state] = []
    job._on_enter_state[state].append(fn)


def transition_model_loaded(job: SimJob, model_name: str) -> None:
    """IDLE → MODEL_LOADED"""
    assert job.state == SimState.IDLE, f"Cannot load model from {job.state.value}"
    job.model_name = model_name
    job.error_message = None
    job.exit_code = None
    job.transition_to(SimState.MODEL_LOADED, f"model={model_name}")


def transition_starting(job: SimJob, process: Any, headless: bool, render: bool) -> None:
    """MODEL_LOADED → STARTING"""
    assert job.state == SimState.MODEL_LOADED, f"Cannot start from {job.state.value}"
    job.process = process
    job.pid = process.pid
    job.headless = headless
    job.render = render
    job.started_at = time.time()
    job.transition_to(SimState.STARTING)


def transition_running(job: SimJob) -> None:
    """STARTING → RUNNING (confirmed alive)"""
    job.transition_to(SimState.RUNNING)


def transition_stopping(job: SimJob) -> None:
    """RUNNING → STOPPING"""
    job.transition_to(SimState.STOPPING)


def transition_stopped(job: SimJob, exit_code: int = 0) -> None:
    """STOPPING → STOPPED"""
    job.exit_code = exit_code
    job.stopped_at = time.time()
    job.process = None
    job.transition_to(SimState.STOPPED, f"exit={exit_code}")


def transition_crashed(job: SimJob, reason: str, exit_code: int | None = None) -> None:
    """STARTING/RUNNING/STOPPING → CRASHED"""
    job.error_message = reason
    job.exit_code = exit_code
    job.stopped_at = time.time()
    job.process = None
    job.transition_to(SimState.CRASHED, reason)


def transition_reset(job: SimJob) -> None:
    """STOPPED/CRASHED/ERROR → IDLE"""
    assert job.state.terminal(), f"Can only reset from terminal states, got {job.state.value}"
    job.process = None
    job.error_message = None
    job.exit_code = None
    job.transition_to(SimState.IDLE)
