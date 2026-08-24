# AGENTS.md

## Mission
Build an interactive mathematical labyrinth where concepts are discovered by manipulating geometry and moving seamlessly between related representations. The existing trigonometry scene is the first room, not the final product.

## Product principles
- Prefer interaction over exposition.
- Every important quantity should be visible as geometry before it is shown as a formula.
- A concept transition must correspond to a meaningful mathematical operation; avoid topic-menu navigation in the primary experience.
- Preserve the same visual object across transitions whenever possible: radius → vector, curve point → tangent, basis → matrix transform.
- Keep mathematically shared state shared across rooms instead of re-creating equivalent values.
- Animation must remain smooth on desktop and mobile.
- Explanatory text should be short and subordinate to the visualization.
- Avoid adding dependencies unless they materially improve the learning interaction.

## Current live scope
1. Unit circle with a continuously rotating point.
2. Sine and cosine projections generated from the same angle state.
3. Camera transitions to unit-circle, sine, and cosine faces.
4. Accumulated angle display and visual trail.
5. First semantic concept gateway: swipe outward from the unit-circle origin to reinterpret the radius as a vector.
6. Responsive layout usable on phones.

See `ROADMAP.md` for the concept graph and implementation sequence.

## Technical constraints
- React + TypeScript + Vite.
- Keep mathematical state and pure math / concept-graph helpers separate from rendering code.
- Concept navigation is graph-based state, not page routing.
- Keep camera focus state separate from concept-room state.
- Prefer SVG for geometric/graph visualizations unless profiling shows a need for Canvas/WebGL.
- No backend unless a later cross-device feature clearly requires one.
- Accessibility: keyboard-operable gateways, visible focus state, semantic labels, and sufficient contrast.

## Quality gate
Before finishing a task, run:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

Add or update tests for pure math logic, concept-graph rules, and any interaction that can regress.

## Working style for Codex
- Inspect existing code before editing.
- Keep changes narrowly scoped to the requested task.
- Do not silently change product behavior unrelated to the task.
- Reuse the shared angle state instead of duplicating derived values.
- Treat radians as the internal mathematical representation when practical; convert at UI boundaries.
- If a visual choice is ambiguous, optimize for immediate perceptual understanding rather than decoration.
- Prefer a continuous geometric morph over hiding one model and mounting an unrelated replacement.
- Update `ROADMAP.md` when a concept transition becomes live or implementation order materially changes.
- Update README when setup or commands change.
