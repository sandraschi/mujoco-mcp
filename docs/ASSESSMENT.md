# mujoco-mcp — Assessment

**Date:** 2026-06-11 | **Version:** 0.2.0 | **Status:** Functional, e2e-verified, the fleet sim-MCP reference

## Verified working

- **Runner e2e:** pendulum MJCF, 2974 steps/5 s, live state.json sync, control.json
  consumption, clean stop.signal shutdown, completed.txt, offscreen frames.
- **All 7 README models** seeded into the repo depot (`models/`, registry in
  `models/.depot/`) via `scripts/seed_depot.py` — pendulum + double_pendulum
  hand-written, cartpole/hopper/walker/ant/humanoid from Gymnasium assets; every
  model validated by `mujoco.MjModel.from_xml_path` at seed time.
- 22 unit tests pass; ruff clean; state machine module genuinely integrated
  (IDLE→MODEL_LOADED→STARTING→RUNNING→… transitions exercised in start/stop).

## Fixed this session

| Issue | Fix |
|---|---|
| PNG encoder sliced (H,W,3) array with flat indices — every scanline after row 0 misaligned | `rgb[y].tobytes()` per scanline; verified by GDI+ decode + pixel check |
| `Popen(stdout=PIPE, stderr=PIPE)` never drained — 64 KB buffer fill freezes chatty runners | Log to `jobs/{id}/runner.log`; `analyze_sim_logs` reads the file |
| Empty `__init__.py` vs `mujoco_mcp:main` entry point — console script ImportError | Re-export `main`/`mcp` |
| README fiction: depot at `~/.mujoco-mcp/models`, "DM Control" model provenance, duplicate Webapp section | Corrected |
| Version split (pyproject 0.1.0) | 0.2.0 |

## Known limitations

- Runner paces with `sleep(max(dt*0.5, 0.001))` — roughly realtime for dt=0.002,
  not a hard realtime guarantee; no faster-than-realtime mode yet.
- `state.json` written every 5 steps — fine for small models, heavy disk churn
  for big ones; consider step-interval parameter.
- `export_frame`/render path verified for encoding correctness, not for visual
  content review.

## Next

mcpb manifest + pack; FLEET_INDEX entry; commit (uncommitted changes: encoder
fix, Popen fix, `__init__`, seeder, README). This repo is the template the
isaac-mcp runner was ported from — keep them protocol-aligned.

---

## Update 2026-06-12 (post OpenCode pass)

Pushed to GitHub (main). state_machine.py promoted to fleet reference in the
robotics-fleet architecture doc; gitignore now excludes models/ and jobs/
(depot is reproducible � fresh clones MUST run `scripts/seed_depot.py`;
scripts/ was briefly gitignored too, un-ignored since the seeder is source).
hatchling packaging added: `uv run python -m mujoco_mcp` verified booting to
stdio transport. FLEET_INDEX entry added (11046/11047).
