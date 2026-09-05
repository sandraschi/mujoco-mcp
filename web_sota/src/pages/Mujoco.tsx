export default function Mujoco() {
  return (
    <div className="max-w-5xl space-y-6" data-testid="mujoco-page">
      <div>
        <h1 className="text-2xl font-bold">MuJoCo — the Engine</h1>
        <p className="text-sm text-slate-300 mt-1">
          Multi-Joint dynamics with Contact — the physics engine behind{" "}
          <code className="bg-slate-800 px-1 rounded">mujoco-mcp</code>.
        </p>
      </div>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5" data-testid="mujoco-what">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">What is MuJoCo?</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          MuJoCo is a C/C++ physics engine for detailed, fast simulation of articulated bodies with contacts. Unlike
          game engines, it solves the Newton-Euler equations with a generalized-coordinate formulation — joints are not
          constraints, they are the coordinates. Contacts use a soft, convex solver with analytic gradients. That is why
          MuJoCo is the default for contact-rich robotics (grasping, legged locomotion) and differentiable simulation.
        </p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="text-sm font-semibold text-cyan-300">Newton solver</div>
            <div className="text-sm text-slate-300 mt-1">
              Recursive Newton-Euler + sparse Jacobians; no iterative drift like penalty methods.
            </div>
          </div>
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="text-sm font-semibold text-cyan-300">Soft contact</div>
            <div className="text-sm text-slate-300 mt-1">
              Elliptic cone + analytical derivatives; stable at large timesteps (2–5 ms).
            </div>
          </div>
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="text-sm font-semibold text-cyan-300">MJCF</div>
            <div className="text-sm text-slate-300 mt-1">
              One XML file: bodies, joints, actuators, sensors, equality constraints, tendons — no meshes needed.
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5" data-testid="mujoco-history">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">History</h2>
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex gap-3">
            <span className="font-mono text-cyan-400 w-24 shrink-0">2009–2012</span>
            <span>
              <strong>Emanuel Todorov</strong> (U. Washington) builds MuJoCo at <strong>Roboti LLC</strong> — the first
              engine that could simulate humanoids with contacts at faster than real-time on a CPU.
            </span>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-cyan-400 w-24 shrink-0">2015–2021</span>
            <span>
              DM Control Suite + OpenAI Gym adopt MuJoCo. Becomes the lingua franca for RL locomotion papers. Licensed
              commercial (~$3k/seat), but free for academics.
            </span>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-cyan-400 w-24 shrink-0">Oct 2021</span>
            <span>
              <strong>DeepMind acquires MuJoCo</strong>, open-sources it under <strong>Apache 2.0</strong> on GitHub
              <span className="font-mono text-slate-300"> google-deepmind/mujoco</span> — community explodes, Menagerie
              added.
            </span>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-cyan-400 w-24 shrink-0">2022–now</span>
            <span>
              ~12k GitHub stars, 200+ contributors, Python bindings (`mujoco&gt;=3.2` with `mjtNum` autodiff), Brax/JAX
              differentiable pipeline, MuJoCo Playground. This server uses <strong>MuJoCo 3.2+</strong> directly — no
              wrapper.
            </span>
          </div>
        </div>
      </section>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5" data-testid="mujoco-community">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Community</h2>
        <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <span className="font-mono text-cyan-400">mujoco.org</span> — docs, forum, 200+ MJCF examples
            </li>
            <li>
              <span className="font-mono text-cyan-400">Menagerie</span> — 30+ open robots (Unitree H1/Go2, Shadow Hand,
              Franka)
            </li>
            <li>
              <span className="font-mono text-cyan-400">DM Control</span> — benchmark suite (cheetah, walker, humanoid)
            </li>
          </ul>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <span className="font-mono text-cyan-400">Brax</span> — JAX + MuJoCo GPU, 10k parallel envs
            </li>
            <li>
              <span className="font-mono text-cyan-400">MuJoCo Playground</span> — interactive MJCF editor in the
              browser
            </li>
            <li>GitHub Discussions + Slack (~5k members) — fast answers for solver tuning</li>
          </ul>
        </div>
      </section>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5" data-testid="mujoco-strengths">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
          Strengths &amp; Weaknesses
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-green-300 mb-2">Strengths</h3>
            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
              <li>10–50× realtime on one CPU; 1k+ envs on one GPU (Brax)</li>
              <li>Analytic derivatives — trajectory opt, system ID, model-based RL without PPO</li>
              <li>
                One-file <code className="bg-slate-700 px-1 rounded">model.xml</code> — no mesh hell
              </li>
              <li>~10 MB pip wheel, &lt;1 s cold start (vs Gazebo ~2 GB, Isaac ~10 GB)</li>
              <li>Muscle, tendon, equality constraints, sensors out of the box</li>
              <li>First-class Python — no ROS/C++ toolchain required</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-300 mb-2">Weaknesses</h3>
            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
              <li>No lidar/camera noise, no aerodynamics, no hydrodynamics</li>
              <li>Sensor suite is minimal vs Gazebo’s plugins</li>
              <li>No built-in networking / multi-robot orchestration</li>
              <li>Headless EGL needed for offscreen rendering on Linux</li>
              <li>Deformables are experimental (better in PyBullet/Flex)</li>
              <li>Photoreal rendering requires Isaac Sim / Omniverse</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5" data-testid="mujoco-compare">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">MuJoCo vs Alternatives</h2>
        <p className="text-sm text-slate-300 mb-3">
          Short answer: RL + contacts + speed → MuJoCo. Photoreal/synthetic → Isaac. Sensors/ROS → Gazebo. Simplest pip
          → PyBullet. Full matrix in <code className="bg-slate-700 px-1 rounded">docs/MUJOCO_VS_OTHERS.md</code>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-300">
                <th className="pb-2 pr-4">Feature</th>
                <th className="pb-2 pr-4">MuJoCo</th>
                <th className="pb-2 pr-4">Gazebo</th>
                <th className="pb-2 pr-4">Isaac Sim</th>
                <th className="pb-2">PyBullet</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">License</td>
                <td className="py-2 pr-4 text-green-300">Apache 2.0</td>
                <td className="py-2 pr-4 text-slate-300">Apache 2.0</td>
                <td className="py-2 pr-4 text-amber-300">NVIDIA EULA</td>
                <td className="py-2 text-slate-300">MIT</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Contact</td>
                <td className="py-2 pr-4 text-cyan-300">Soft / analytic grad</td>
                <td className="py-2 pr-4 text-slate-300">Penalty</td>
                <td className="py-2 pr-4 text-slate-300">PhysX LCP</td>
                <td className="py-2 text-slate-300">Penalty</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Diff</td>
                <td className="py-2 pr-4 text-cyan-300">Yes — built-in</td>
                <td className="py-2 pr-4 text-slate-300">No</td>
                <td className="py-2 pr-4 text-slate-300">No</td>
                <td className="py-2 text-slate-300">No</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Speed</td>
                <td className="py-2 pr-4 text-green-300">10–50× RT (CPU)</td>
                <td className="py-2 pr-4 text-slate-300">0.5–1×</td>
                <td className="py-2 pr-4 text-slate-300">1–5× (GPU)</td>
                <td className="py-2 text-slate-300">2–10×</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Python</td>
                <td className="py-2 pr-4 text-green-300">First-class</td>
                <td className="py-2 pr-4 text-slate-300">No (C++)</td>
                <td className="py-2 pr-4 text-slate-300">Yes</td>
                <td className="py-2 text-slate-300">Yes</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Cold start</td>
                <td className="py-2 pr-4 text-green-300">&lt;1 s · ~10 MB</td>
                <td className="py-2 pr-4 text-amber-300">10–60 s · ~2 GB</td>
                <td className="py-2 pr-4 text-amber-300">30–120 s · ~10 GB</td>
                <td className="py-2 text-green-300">&lt;1 s · ~5 MB</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-300">When?</td>
                <td className="py-2 pr-4 text-slate-300">RL, contacts, diff</td>
                <td className="py-2 pr-4 text-slate-300">ROS, sensors</td>
                <td className="py-2 pr-4 text-slate-300">Photoreal, synth data</td>
                <td className="py-2 text-slate-300">Simple pip, soft bodies</td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre className="mt-4 bg-slate-900 text-green-300 text-sm p-3 rounded font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
          {`Need photoreal?                  -> Isaac Sim
Need camera/lidar/IMU plugins?    -> Gazebo
Need differentiable dynamics?     -> MuJoCo
Need 1000s parallel envs?         -> MuJoCo (Brax) or Isaac
On ROS already?                   -> Gazebo
Need soft bodies?                 -> PyBullet
CPU laptop only?                  -> MuJoCo or PyBullet`}
        </pre>
      </section>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5" data-testid="mujoco-mjcf">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">MJCF in 10 lines</h2>
        <div className="grid grid-cols-2 gap-4">
          <pre className="bg-slate-900 text-cyan-300 text-sm p-3 rounded font-mono whitespace-pre-wrap overflow-x-auto">
            {`<mujoco>
  <worldbody>
    <body name="pendulum" pos="0 0 0">
      <joint name="hinge" type="hinge" axis="0 1 0"/>
      <geom type="capsule" size="0.02"
            fromto="0 0 0 0 0 0.5" mass="0.1"/>
    </body>
  </worldbody>
</mujoco>`}
          </pre>
          <div className="text-sm text-slate-300 space-y-2">
            <p>One file. No meshes. No URDF joint dance. Actuators are siblings, not tags:</p>
            <pre className="bg-slate-900 text-slate-300 text-sm p-3 rounded font-mono whitespace-pre-wrap">
              {`<actuator>
  <motor joint="hinge" gear="1"/>
</actuator>
<sensor>
  <jointpos joint="hinge"/>
</sensor>`}
            </pre>
            <p className="text-slate-300">
              Compiler does convex decomposition, weld handling, and contact table generation. Try it live on the{" "}
              <span className="text-cyan-400">Editor</span> page.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
