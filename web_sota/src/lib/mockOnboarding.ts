/** Declared doubles — MOCK-until-onboarded. See docs/ONBOARDING.md § Declared doubles. */

export const MOCK_USERS = [
  { name: "Joe Mocky", model: "pendulum", job: "mock_joe_a1b2" },
  { name: "Sandra Mockinger", model: "cartpole", job: "mock_sandra_c3d4" },
] as const;

export const MOCK_KPIS = {
  mujoco_version: "3.2.7 (MOCK)",
  models_in_depot: 3,
  active_jobs: 1,
  tool_count: 20,
} as const;

export const isMockOnboarding = (
  status: { mujoco_available?: boolean; mujoco_version?: string | null; status?: string } | null,
): boolean => {
  if (!status) return false;
  return status.mujoco_available === false || status.mujoco_version == null || status.status === "degraded";
};
