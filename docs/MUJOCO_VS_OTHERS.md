# MuJoCo vs Other Physics Simulators

MuJoCo (Multi-Joint dynamics with Contact) is an open-source physics engine developed by Roboti LLC (2012), acquired by Google DeepMind (2021), and released under Apache 2.0.

## Comparison Matrix

| Feature | MuJoCo | Gazebo (Ignition) | Isaac Sim / Lab | PyBullet | PhysX 5 |
|---------|--------|-------------------|------------------|----------|----------|
| License | Apache 2.0 | Apache 2.0 | NVIDIA EULA | MIT | NVIDIA EULA |
| Physics backend | Native C/C++ (Newton) | ODE, DART, Bullet | PhysX | Bullet | PhysX |
| Contact model | Soft/hard, elliptic | Penalty-based | LCP | Penalty-based | LCP |
| Differentiable | Yes, built-in | No | No | No | No |
| GPU parallel | Yes, native CUDA | No | Yes (Omniverse) | No | Yes |
| Python API | Yes, first-class | No (ROS/C++ only) | Yes | Yes | No (C++/CUDA) |
| ROS integration | No | Yes, native | No | No | No |
| Headless | Yes | Yes | Yes | Yes | Yes |
| Sim speed (relative) | 10-50x realtime | 0.5-1x realtime | 1-5x realtime | 2-10x realtime | 5-20x realtime |
| MJCF format | Yes, native | No | No | No | No |
| URDF support | Yes | Yes | Yes | Yes | No |
| Sensor simulation | Minimal | Yes, full | Yes | Basic | No |
| Terrain/heightfield | Yes | Yes | Yes | Yes | No |
| RL ecosystem | DM Control Suite, Brax | Small | Isaac Gym/Lab | PyBullet Gym | No |
| Windows support | Yes | Partial | Yes | Yes | Yes |
| Startup time | < 1s | 10-60s | 30-120s | < 1s | < 1s |
| Package size | ~10 MB | ~2 GB | ~10 GB | ~5 MB | ~500 MB |
| GPU memory (idle) | ~200 MB | ~500 MB | ~4 GB | — | ~1 GB |
| Popularity (GitHub stars) | ~12k | ~5k | ~8k | ~5k | — |

## When to Use MuJoCo

**Best for:**
- Reinforcement learning research (sim2real, policy optimization)
- Contact-rich manipulation (grasping, stacking, assembly)
- Legged locomotion (walking, running, jumping)
- Differentiable physics pipelines (trajectory optimization, system identification)
- Fast parallel simulation (thousands of environments for RL training)
- Minimal-dependency setups (no ROS, no Docker)
- Rapid prototyping (MJCF is clean and compact)

**Not ideal for:**
- Autonomous driving (no lidar/camera noise models, no road surface models)
- Aerial robotics (no aerodynamics, no wind models)
- Underwater robotics (no buoyancy, no hydrodynamics)
- Multi-robot collaboration (no built-in networking)
- Production-level sensor validation (Gazebo's sensor suite is far richer)
- Projects already invested in ROS ecosystem (Gazebo integrates natively)

## When to Use Gazebo Instead

- You need realistic camera, lidar, IMU, GPS, sonar simulation
- Your stack already runs on ROS 2
- You need terrain rendering with textures and elevation data
- You're simulating outdoor environments at scale
- You need plugin-based sensor models
- Community support for specific robots (Clearpath, ARL, etc.)

## When to Use Isaac Sim / Lab Instead

- You have NVIDIA GPUs and want photorealistic rendering
- You need synthetic data generation for perception training
- You want integrated RL training (Isaac Gym/Lab)
- You're working on manipulation with GPU-accelerated physics
- You need domain randomization with RTX rendering

## When to Use PyBullet Instead

- You want the simplest possible Python API
- You need quick-and-dirty physics for RL prototyping
- You're working with soft bodies or deformable objects (PyBullet is better here)
- You want a pure pip-install experience with no binary dependencies

## Key Differentiators for MuJoCo

**Differentiability**: MuJoCo is the only open-source physics engine with built-in derivatives. `mujoco.mjd_transitionFD()` computes the Jacobian of the dynamics w.r.t. state and control. This enables:
- Analytical policy gradients (no PPO/TRPO needed)
- Trajectory optimization (ALTRO, iLQR)
- System identification (gradient-based parameter tuning)
- Model-based RL (learn the dynamics, plan through them)

**Speed**: MuJoCo can simulate 10-50x realtime on a single CPU core for moderate scenes. With GPU acceleration (`mujoco.mjsimulate`), you can run thousands of parallel environments — essential for RL training at scale.

**MJCF Format**: MuJoCo's XML format is more expressive than URDF:
- Native actuator models (muscle, motor, cylinder, tendon)
- Contact parameters per geom (friction, solref, solimp)
- Built-in sensors (accelerometer, gyroscope, force-torque, magnetometer)
- Compiler auto-generates mesh collisions from convex decomposition
- Weld joints, equality constraints, tendon routing
- One file defines everything — no separate mesh files needed

## Appendix: File Format Comparison

```xml
<!-- MuJoCo MJCF — one file, clean -->
<mujoco>
  <worldbody>
    <body name="pendulum" pos="0 0 0">
      <joint name="hinge" type="hinge" axis="0 1 0"/>
      <geom type="capsule" size="0.02" fromto="0 0 0 0 0 0.5" mass="0.1"/>
    </body>
  </worldbody>
</mujoco>
```

```xml
<!-- URDF — verbose, needs separate mesh files -->
<robot name="pendulum">
  <link name="base">
    <visual><geometry><box size="0.1 0.1 0.1"/></geometry></visual>
  </link>
  <link name="arm">
    <inertial><mass value="0.1"/></inertial>
    <visual><geometry><cylinder length="0.5" radius="0.02"/></geometry></visual>
  </link>
  <joint name="hinge" type="continuous">
    <parent link="base"/>
    <child link="arm"/>
    <axis xyz="0 1 0"/>
    <limit effort="1.0" velocity="10"/>
  </joint>
</robot>
```

## Decision Flowchart

```
Need photorealistic rendering?                    -> Isaac Sim
Need camera/lidar/IMU sensor models?              -> Gazebo
Need differentiable physics?                      -> MuJoCo
Need GPU-parallel RL training?                    -> MuJoCo or Isaac
Need ROS integration?                             -> Gazebo
Need soft body simulation?                        -> PyBullet or MuJoCo
Need fast prototyping, no dependencies?           -> MuJoCo or PyBullet
Need terrain, outdoor environments?               -> Gazebo
Need synthetic data for perception?               -> Isaac Sim
Need to simulate 1000s of envs in parallel?       -> MuJoCo
Only have a CPU laptop?                           -> MuJoCo or PyBullet
```

## References

- MuJoCo: https://mujoco.org, https://github.com/google-deepmind/mujoco
- Gazebo: https://gazebosim.org
- Isaac Sim: https://developer.nvidia.com/isaac-sim
- PyBullet: https://pybullet.org
- PhysX: https://github.com/NVIDIA-Omniverse/PhysX
