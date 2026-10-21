"""Contract tests: response invariant + trajectory expected_start binding.

These cover the two conventions borrowed from ASPIRE's cap_harness (see
mcp-central-docs/robotics/research/2026-10-21_aspire-skill-discovery-probe.md):

1. A tool result may not be ambiguous - success never carries an error, and
   failure always carries one.
2. A trajectory recording is bound to the measured state it started from, and
   is reported invalid rather than silently usable when that binding breaks.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from mujoco_mcp import server as srv
from mujoco_mcp._sim_runner import _state_dict, _trajectory_meta
from mujoco_mcp.responses import (
    ResponseInvariantError,
    check_response,
    error_response,
    ok_response,
)


@pytest.fixture
def jobs_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the server at a temp jobs dir and return it."""
    jobs = tmp_path / "jobs"
    jobs.mkdir()
    monkeypatch.setattr(srv, "JOBS_DIR", jobs)
    return jobs


def _job(jobs: Path, job_id: str = "job1") -> Path:
    job = jobs / job_id
    job.mkdir()
    return job


def _write_recording(job: Path, *, nq: int = 2, frames: int = 3, **overrides: Any) -> None:
    """Write a well-formed recording, overridable for negative cases."""
    qpos0 = [0.0] * nq
    meta = {
        "schema_version": srv.TRAJECTORY_SCHEMA_VERSION,
        "recorded_at_step": 0,
        "expected_start": {"step": 0, "time": 0.0, "qpos": qpos0},
        "model_path": "pendulum.xml",
        "nq": nq,
        "nv": nq,
        "nu": 0,
        "joint_names": [f"j{i}" for i in range(nq)],
        "actuator_names": [],
    }
    meta.update(overrides.pop("meta_overrides", {}))
    (job / "trajectory.meta.json").write_text(json.dumps(meta), encoding="utf-8")

    rows = []
    for i in range(frames):
        row = {
            "time": 0.002 * i,
            "step": i,
            "qpos": list(qpos0),
            "qvel": [0.0] * nq,
        }
        if i == 0 and "first_qpos" in overrides:
            row["qpos"] = overrides.pop("first_qpos")
        if i == 1 and "second_time" in overrides:
            row["time"] = overrides.pop("second_time")
        rows.append(row)
    (job / "trajectory.jsonl").write_text(
        "".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8"
    )


class TestResponseInvariant:
    def test_ok_response_has_no_error(self):
        result = ok_response(job_id="a", count=2)
        assert result["success"] is True
        assert "error" not in result
        check_response(result)

    def test_ok_response_rejects_error_field(self):
        with pytest.raises(ResponseInvariantError):
            ok_response(error="should not be here")

    def test_ok_response_rejects_error_type_field(self):
        with pytest.raises(ResponseInvariantError):
            ok_response(error_type="oops")

    def test_error_response_carries_message(self):
        result = error_response("boom", error_type="job_not_found", job_id="a")
        assert result["success"] is False
        assert result["error"] == "boom"
        assert result["error_type"] == "job_not_found"
        assert result["job_id"] == "a"
        check_response(result)

    @pytest.mark.parametrize("bad", ["", "   ", None])
    def test_error_response_rejects_empty_error(self, bad):
        with pytest.raises(ResponseInvariantError):
            error_response(bad)  # type: ignore[arg-type]

    def test_check_response_rejects_success_with_error(self):
        with pytest.raises(ResponseInvariantError):
            check_response({"success": True, "error": "contradiction"})

    def test_check_response_rejects_failure_without_error(self):
        with pytest.raises(ResponseInvariantError):
            check_response({"success": False})

    def test_check_response_rejects_missing_success(self):
        with pytest.raises(ResponseInvariantError):
            check_response({"job_id": "a"})


class TestRecordTrajectory:
    def test_missing_job_returns_error_not_success(self, jobs_dir: Path):
        result = srv.record_trajectory("nope")
        assert result["success"] is False
        assert result["error"]
        assert result["error_type"] == "job_not_found"
        check_response(result)

    def test_arms_recording(self, jobs_dir: Path):
        job = _job(jobs_dir)
        result = srv.record_trajectory("job1")
        assert result["success"] is True
        assert result["armed"] is True
        assert (job / "record.signal").exists()
        check_response(result)

    def test_second_call_does_not_rearm(self, jobs_dir: Path):
        _job(jobs_dir)
        srv.record_trajectory("job1")
        result = srv.record_trajectory("job1")
        assert result["success"] is True
        assert result["armed"] is False


class TestListTrajectories:
    def test_missing_job_returns_error(self, jobs_dir: Path):
        result = srv.list_trajectories("nope")
        assert result["success"] is False
        assert result["error"]
        check_response(result)

    def test_no_recording_yet(self, jobs_dir: Path):
        _job(jobs_dir)
        result = srv.list_trajectories("job1")
        assert result["success"] is True
        assert result["has_trajectory"] is False
        assert result["integrity"]["ok"] is False
        assert "trajectory_present" in result["integrity"]["failures"]

    def test_valid_recording_passes_all_checks(self, jobs_dir: Path):
        job = _job(jobs_dir)
        _write_recording(job)
        result = srv.list_trajectories("job1")
        assert result["success"] is True
        assert result["has_trajectory"] is True
        assert result["frame_count"] == 3
        assert result["schema_version"] == srv.TRAJECTORY_SCHEMA_VERSION
        assert result["expected_start"]["qpos_dims"] == 2
        assert result["integrity"]["ok"] is True, result["integrity"]
        assert result["integrity"]["failures"] == []

    def test_dimension_mismatch_is_flagged(self, jobs_dir: Path):
        job = _job(jobs_dir)
        _write_recording(job, nq=2, meta_overrides={"nq": 3})
        result = srv.list_trajectories("job1")
        assert result["integrity"]["ok"] is False
        assert "model_consistent" in result["integrity"]["failures"]

    def test_non_monotonic_time_is_flagged(self, jobs_dir: Path):
        job = _job(jobs_dir)
        _write_recording(job, second_time=-5.0)
        result = srv.list_trajectories("job1")
        assert result["integrity"]["checks"]["time_monotonic"] is False
        assert "time_monotonic" in result["integrity"]["failures"]

    def test_drifted_start_state_is_flagged(self, jobs_dir: Path):
        job = _job(jobs_dir)
        # First frame no longer matches expected_start.qpos.
        _write_recording(job, first_qpos=[1.0, 1.0])
        result = srv.list_trajectories("job1")
        assert result["integrity"]["checks"]["start_state_matches"] is False
        assert "start_state_matches" in result["integrity"]["failures"]

    def test_missing_meta_is_flagged(self, jobs_dir: Path):
        job = _job(jobs_dir)
        _write_recording(job)
        (job / "trajectory.meta.json").unlink()
        result = srv.list_trajectories("job1")
        assert result["integrity"]["ok"] is False
        assert "meta_present" in result["integrity"]["failures"]
        assert result["schema_version"] is None

    def test_unknown_schema_version_is_flagged(self, jobs_dir: Path):
        job = _job(jobs_dir)
        _write_recording(job, meta_overrides={"schema_version": 999})
        result = srv.list_trajectories("job1")
        assert "schema_supported" in result["integrity"]["failures"]


class _FakeModel:
    nq = 2
    nv = 2
    nu = 1
    nbody = 1


class _FakeData:
    def __init__(self) -> None:
        self.time = 0.0
        self.qpos = np.array([0.1, 0.2])
        self.qvel = np.array([0.0, 0.0])
        self.ctrl = np.array([0.5])
        self.xpos = np.array([[0.0, 0.0, 0.0]])
        self.xquat = np.array([[1.0, 0.0, 0.0, 0.0]])
        self.sensordata = np.array([])


class TestRunnerMetaBinding:
    def test_expected_start_equals_first_frame(self):
        """The meta's expected_start must be the state the first frame records."""
        model = _FakeModel()
        data = _FakeData()
        metadata = {
            "model_path": "pendulum.xml",
            "nq": model.nq,
            "nv": model.nv,
            "nu": model.nu,
            "joint_names": ["j0", "j1"],
            "actuator_names": ["a0"],
        }
        state = _state_dict(model, data, 0, {"a0": 0}, {})
        meta = _trajectory_meta(model, data, 0, metadata, {"a0": 0}, {})

        assert meta["schema_version"] == 1
        assert meta["expected_start"] == state
        assert meta["expected_start"]["qpos"] == [0.1, 0.2]
        assert meta["nq"] == 2
        assert meta["model_path"] == "pendulum.xml"

    def test_meta_is_json_serializable(self):
        model = _FakeModel()
        data = _FakeData()
        meta = _trajectory_meta(
            model,
            data,
            7,
            {"model_path": "m.xml", "nq": 2, "nv": 2, "nu": 1},
            {"a0": 0},
            {},
        )
        assert json.loads(json.dumps(meta))["recorded_at_step"] == 7
