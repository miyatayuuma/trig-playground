# AGENTS.md

## Mission
Build an interactive web app that makes trigonometry intuitive through direct manipulation and synchronized visual representations.

## Product principles
- Prefer interaction over exposition.
- Every important quantity should be visible as geometry before it is shown as a formula.
- Keep the unit circle, coordinates, and sine/cosine graphs synchronized from one shared angle state.
- Animation must remain smooth on desktop and mobile.
- Explanatory text should be short and subordinate to the visualization.
- Avoid adding dependencies unless they materially improve the learning interaction.

## Initial scope
1. Draggable point on a unit circle.
2. Angle control in degrees with radian display.
3. Live `sin θ` and `cos θ` values.
4. Projection lines from the point to the x/y axes.
5. Sine and cosine wave plots linked to the same angle.
6. Presets for notable angles: 0°, 30°, 45°, 60°, 90°, 180°, 270°, 360°.
7. Responsive layout usable on phones.

## Technical constraints
- React + TypeScript + Vite.
- Keep mathematical state and pure math helpers separate from rendering code.
- Prefer SVG for geometric/graph visualizations unless profiling shows a need for Canvas.
- No backend for the initial version.
- Accessibility: keyboard-operable controls, visible focus state, semantic labels, and sufficient contrast.
- Use CSS without a component framework initially.

## Quality gate
Before finishing a task, run:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

Add or update tests for pure math logic and any interaction that can regress.

## Working style for Codex
- Inspect existing code before editing.
- Keep changes narrowly scoped to the requested task.
- Do not silently change product behavior unrelated to the task.
- Reuse the shared angle state instead of duplicating derived values.
- Treat radians as the internal mathematical representation when practical; convert at UI boundaries.
- If a visual choice is ambiguous, optimize for immediate perceptual understanding rather than decoration.
- Update README when setup or commands change.
