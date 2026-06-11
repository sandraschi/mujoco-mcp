"""Seed the mujoco-mcp model depot with the seven models the README promises.

Run from repo root with the project venv:
    .venv\\Scripts\\python.exe scripts\\seed_depot.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import httpx
from mujoco_mcp.server import MODEL_DIR, _load_depot, _parse_mjcf, _save_depot

GYM_RAW = "https://raw.githubusercontent.com/Farama-Foundation/Gymnasium/main/gymnasium/envs/mujoco/assets"

DOWNLOADS = {
    "cartpole": f"{GYM_RAW}/inverted_pendulum.xml",
    "hopper": f"{GYM_RAW}/hopper.xml",
    "walker": f"{GYM_RAW}/walker2d.xml",
    "ant": f"{GYM_RAW}/ant.xml",
    "humanoid": f"{GYM_RAW}/humanoid.xml",
}

HANDWRITTEN = {
    "pendulum": """<mujoco model="pendulum">
  <option timestep="0.002" gravity="0 0 -9.81"/>
  <worldbody>
    <light pos="0 0 3" dir="0 0 -1"/>
    <geom type="plane" size="2 2 0.1" rgba="0.85 0.85 0.85 1"/>
    <body pos="0 0 1.2">
      <joint name="hinge" type="hinge" axis="0 1 0" damping="0.05"/>
      <geom type="capsule" size="0.04" fromto="0 0 0 0 0 -0.6" rgba="0.2 0.4 0.8 1"/>
      <body pos="0 0 -0.6">
        <geom type="sphere" size="0.08" mass="1.0" rgba="0.8 0.3 0.2 1"/>
      </body>
    </body>
  </worldbody>
  <actuator>
    <motor name="hinge_motor" joint="hinge" gear="1" ctrlrange="-3 3"/>
  </actuator>
</mujoco>
""",
    "double_pendulum": """<mujoco model="double_pendulum">
  <option timestep="0.002" gravity="0 0 -9.81"/>
  <worldbody>
    <light pos="0 0 3" dir="0 0 -1"/>
    <geom type="plane" size="2 2 0.1" rgba="0.85 0.85 0.85 1"/>
    <body pos="0 0 1.5">
      <joint name="hinge1" type="hinge" axis="0 1 0" damping="0.02"/>
      <geom type="capsule" size="0.035" fromto="0 0 0 0 0 -0.5" rgba="0.2 0.4 0.8 1"/>
      <body pos="0 0 -0.5">
        <joint name="hinge2" type="hinge" axis="0 1 0" damping="0.02"/>
        <geom type="capsule" size="0.03" fromto="0 0 0 0 0 -0.5" rgba="0.3 0.7 0.3 1"/>
        <body pos="0 0 -0.5">
          <geom type="sphere" size="0.06" mass="0.5" rgba="0.8 0.3 0.2 1"/>
        </body>
      </body>
    </body>
  </worldbody>
  <actuator>
    <motor name="hinge1_motor" joint="hinge1" gear="1" ctrlrange="-3 3"/>
    <motor name="hinge2_motor" joint="hinge2" gear="1" ctrlrange="-3 3"/>
  </actuator>
</mujoco>
""",
}


def main() -> None:
    import mujoco  # validate every model actually loads

    depot = _load_depot()
    ok, failed = [], []

    for name, xml in HANDWRITTEN.items():
        dest = MODEL_DIR / f"{name}.xml"
        dest.write_text(xml, encoding="utf-8")
        try:
            mujoco.MjModel.from_xml_path(str(dest))
            depot[name] = {"uri": "builtin", "path": str(dest.resolve()), "metadata": _parse_mjcf(str(dest))}
            ok.append(name)
        except Exception as e:
            failed.append((name, str(e)))

    for name, url in DOWNLOADS.items():
        dest = MODEL_DIR / f"{name}.xml"
        try:
            resp = httpx.get(url, follow_redirects=True, timeout=60)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            mujoco.MjModel.from_xml_path(str(dest))
            depot[name] = {"uri": url, "path": str(dest.resolve()), "metadata": _parse_mjcf(str(dest))}
            ok.append(name)
        except Exception as e:
            failed.append((name, str(e)))

    _save_depot(depot)
    print(f"seeded: {ok}")
    if failed:
        print(f"FAILED: {failed}")
        sys.exit(1)


if __name__ == "__main__":
    main()
