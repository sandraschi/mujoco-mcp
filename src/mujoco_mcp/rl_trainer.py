"""RL training for MuJoCo sims — optional stable-baselines3 integration."""

from __future__ import annotations

from pathlib import Path


def train_rl_policy(
    model_path: str,
    job_dir: str,
    total_timesteps: int = 50000,
    algorithm: str = "PPO",
    policy: str = "MlpPolicy",
    reward_fn: str = "",
) -> dict:
    """Run an RL training loop inside a sim job.

    Requires `pip install mujoco-mcp[rl]` (stable-baselines3 + extras).
    """
    try:
        import importlib
        importlib.import_module("gymnasium")
        import numpy as np
        from stable_baselines3 import PPO, SAC
    except ImportError:
        return {
            "success": False,
            "error": "RL extras not installed. Run: uv sync --extra rl",
        }

    import mujoco
    from gymnasium import Env
    from gymnasium.spaces import Box

    class MuJoCoEnv(Env):
        """Gymnasium env wrapping a MuJoCo model."""

        metadata: dict = {"render_modes": []}

        def __init__(self, xml_path: str):
            super().__init__()
            self.model = mujoco.MjModel.from_xml_path(xml_path)
            self.data = mujoco.MjData(self.model)
            self.nq = self.model.nq
            self.nv = self.model.nv
            self.nu = self.model.nu

            high = np.ones(self.nu, dtype=np.float32) * 1.0
            self.action_space = Box(-high, high, dtype=np.float32)
            obs_high = np.ones(self.nq + self.nv + 1, dtype=np.float32) * 100
            self.observation_space = Box(-obs_high, obs_high, dtype=np.float32)
            self._step = 0

        def reset(self, *, seed=None, options=None):
            super().reset(seed=seed)
            mujoco.mj_resetData(self.model, self.data)
            self._step = 0
            return self._get_obs(), {}

        def step(self, action):
            self.data.ctrl[:] = np.clip(action, -1.0, 1.0)
            mujoco.mj_step(self.model, self.data)
            self._step += 1
            obs = self._get_obs()
            reward = self._compute_reward()
            terminated = (
                self._step > 1000 or abs(self.data.qpos[0]) > 10
                if self.nq > 0
                else False
            )
            truncated = False
            return obs, reward, terminated, truncated, {}

        def _get_obs(self):
            parts = []
            if self.nq > 0:
                parts.append(self.data.qpos[: self.nq])
            if self.nv > 0:
                parts.append(self.data.qvel[: self.nv])
            parts.append(np.array([self.data.time], dtype=np.float32))
            return np.concatenate(parts).astype(np.float32)

        def _compute_reward(self):
            if self.nq < 1:
                return 0.0
            height = self.data.qpos[0]
            vel = abs(self.data.qvel[0]) if self.nv > 0 else 0
            return height - vel

    env = MuJoCoEnv(model_path)
    algo_map = {"PPO": PPO, "SAC": SAC}
    cls = algo_map.get(algorithm.upper(), PPO)
    model = cls(policy, env, verbose=0)

    log_dir = Path(job_dir) / "rl_logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    model.learn(total_timesteps=total_timesteps, progress_bar=False)
    model.save(str(log_dir / "policy.zip"))

    return {
        "success": True,
        "algorithm": algorithm,
        "total_timesteps": total_timesteps,
        "model_saved": str(log_dir / "policy.zip"),
    }
