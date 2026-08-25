# AGENTS.md

## Mission
Build an interactive mathematical labyrinth where concepts are discovered by manipulating geometry and moving seamlessly between related representations. The existing trigonometry scene is the first room, not the final product.

## Primary platform
The primary product surface is a **smartphone browser**, especially portrait touch use. Desktop is a compatible secondary presentation, not the reference layout.

When mobile and desktop needs conflict:
- Preserve touch reliability, readable labels, safe-area handling, and portrait use of space first.
- Avoid desktop-card or fixed-landscape-canvas conventions that leave visible frames or large dead margins on phones.
- Treat browser chrome as dynamic: layout must tolerate address/tool bars expanding or collapsing without scrolling the playfield.
- Direct manipulation must not trigger page scroll, text selection, long-press callouts, or accidental conceptual back navigation.
- Important touch targets should be at least roughly 44 CSS px, with larger invisible hit areas when the visible mathematical object must stay small.
- Backtracking uses an explicit control when background taps would compete with exploration.
- Do not disable browser pinch zoom globally; accessibility zoom remains available.

## Product principles
- Prefer interaction over exposition.
- Every important quantity should be visible as geometry before it is shown as a formula.
- A concept transition must correspond to a meaningful mathematical operation; avoid topic-menu navigation in the primary experience.
- Preserve the same visual object across transitions whenever possible: radius → vector, curve point → tangent, basis → matrix transform.
- Keep mathematically shared state shared across rooms instead of re-creating equivalent values.
- Animation and direct manipulation must remain smooth on the primary smartphone-browser surface; desktop follows from the same state and geometry.
- Explanatory text should be short and subordinate to the visualization.
- Avoid adding dependencies unless they materially improve the learning interaction.

## Current live scope
1. Unit circle with a continuously rotating point.
2. Sine and cosine projections generated from the same angle state.
3. Camera transitions to unit-circle, sine, and cosine faces.
4. Accumulated angle display and visual trail.
5. First semantic concept gateway: trace outward along the rotating unit-circle radius to reinterpret it as a vector.
6. Fixed, touch-owned smartphone playfield with bottom information dock and semantic room fitting.
7. Vector decomposition and vector-addition discovery interactions.

See `ROADMAP.md` for the concept graph and implementation sequence.

## Technical constraints
- React + TypeScript + Vite.
- Keep mathematical state and pure math / concept-graph helpers separate from rendering code.
- Concept navigation is graph-based state, not page routing.
- Keep camera focus state separate from concept-room state.
- Prefer SVG for geometric/graph visualizations unless profiling shows a need for Canvas/WebGL.
- No backend unless a later cross-device feature clearly requires one.
- Accessibility: keyboard-operable gateways, visible non-rectangular focus state, semantic labels, sufficient contrast, and browser zoom left enabled.
- Use `VisualViewport`/dynamic viewport sizing only to follow browser chrome at normal scale; do not fight user pinch zoom.

## Quality gate
Before finishing a task, run:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

Add or update tests for pure math logic, concept-graph rules, viewport helpers, and any interaction that can regress.

## Working style for Codex
- Inspect existing code before editing.
- Keep changes narrowly scoped to the requested task.
- Do not silently change product behavior unrelated to the task.
- Reuse the shared angle state instead of duplicating derived values.
- Treat radians as the internal mathematical representation when practical; convert at UI boundaries.
- If a visual choice is ambiguous, optimize for immediate perceptual understanding on a portrait phone rather than desktop decoration.
- Prefer a continuous geometric morph over hiding one model and mounting an unrelated replacement.
- Avoid generic background-tap navigation in rooms whose primary interaction is exploratory touch/drag.
- Keep mobile layout rules centralized so multiple CSS files do not fight over transforms or viewport sizing.
- Update `ROADMAP.md` when a concept transition becomes live or implementation order materially changes.
- Update README when setup or commands change.
