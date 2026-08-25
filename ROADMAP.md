# Math Labyrinth Roadmap

## Product vision
Turn the current trigonometry visualization into a seamless explorable mathematical world. The user should discover relationships by manipulating the geometry itself rather than choosing topics from a menu.

A transition is only valid when the gesture has mathematical meaning. The same object should survive the transition whenever possible: a radius becomes a vector, a wave point becomes a tangent, a coordinate grid becomes a linear transformation, and a rotating complex number becomes a Fourier component.

The player must not need the vocabulary in advance. The preferred order is **touch → reaction → special state → discovery → mathematical name**. Explanatory prose that does not emerge from an interaction is treated as noise in the main playfield.

## Primary platform
The reference experience is a **portrait smartphone browser**. Desktop remains supported, but new interaction and layout decisions are validated against touch phones first.

The browser viewport is dynamic, not a fixed rectangle: address/tool bars can expand and collapse. The playfield must follow the visual viewport without creating document scroll. Model chrome is full-bleed on phones, persistent readouts live in the lower dock, and safe-area insets are respected.

Do not trade mobile reliability for desktop decoration. Browser zoom remains enabled for accessibility.

## Interaction grammar
- **Trace an existing object**: reinterpret the same object in a related concept.
- **Pull apart / decompose**: reveal components, factors, or basis directions.
- **Match a mathematical target**: move an object until a special condition is satisfied; the target should attract / snap rather than behave like a generic UI button.
- **Hold a satisfied condition**: when a moving object can merely pass through a valid state, require a short visible dwell before the gateway becomes true.
- **Overlay / align**: reveal projection, dot product, equality, eigen-directions, or equivalence.
- **Distort the space**: enter matrix / transformation concepts.
- **Trace motion**: create a graph, derivative, accumulated quantity, or orbit.
- **Cut / unwrap / join boundaries**: move between circular, linear, and modular representations.
- **Explicit back control**: reverse one conceptual step without competing with exploratory taps or drags.

No permanent topic menu in the main experience. A discovered-concept map is a secondary layer, not the primary navigation system.

## Interaction safety rules
- Direct manipulation handles own their pointer gesture and must not bubble into room navigation.
- A concept gateway must have a dedicated target and a distance/direction/condition threshold; arbitrary swipes do not unlock it.
- A state that is easy to cross accidentally should not fire on the first matching animation frame. Prefer roughly 0.5–0.8 seconds of visible dwell, or require release after snap.
- Internal eligibility thresholds should normally remain invisible unless the threshold itself has mathematical meaning.
- A mathematical gateway should reveal itself only when its prerequisite state is meaningful. Avoid showing every possible control at once.
- Use hysteresis around reveal thresholds so handles do not flicker when a draggable object sits on a boundary.
- Visible mathematical handles may stay small, but their invisible touch target should be roughly 44 CSS px or larger when space allows.
- While a direct-manipulation room is active, page scrolling, text selection, and browser long-press callouts must not steal the gesture.
- Empty-space taps must not perform conceptual back navigation in rooms built around exploratory touch/drag.
- Every drag interaction needs a keyboard alternative.
- Small SVG labels should prefer clean high-contrast fills over thick outline strokes that collapse glyph counters on phones.
- Prefer **definition labels on the geometry** (`cos θ`, `sin θ`, `r cos θ`, `r sin θ`) and keep changing numerical values in the lower information dock.
- Do not introduce a concept only because a mathematically correct caption can be written. For example, `tan θ` should appear when slope/tangent is being manipulated, not as a detached unit-circle explanation.

## Mobile presentation rules
- Treat the experience as a fixed visual-viewport application, not a scrolling document.
- Use the portrait display vertically: model above, numerical / textual readout dock below.
- Follow `VisualViewport` changes caused by browser chrome at normal scale, but do not fight pinch zoom.
- Use `viewport-fit=cover`, safe-area insets, and `interactive-widget=resizes-content` where supported.
- The phone model area is full-bleed; avoid decorative card borders or landscape viewport outlines around the mathematical world.
- Fit each room differently. Unit circle, vector, components, waves, matrix grids, and eigen-direction hunts do not need the same on-screen scale.
- A focused room exposes a **semantic safe frame**: all geometry and labels required to understand or manipulate the current concept must remain inside the visible frame.
- Never maximize a room by blindly cropping its semantic left/right edges. SIN/COS prioritize complete horizontal extent; the unit circle prioritizes size while preserving its definition labels; expanding vector rooms fit their live geometry.
- Labels attached to moving points should choose the inward/available side instead of using a fixed rightward offset.
- Remove generic instructions when the visible object itself already teaches the gesture. Keep only the current, short interaction hint.
- Annotation text such as `θ` should settle into a stable location rather than orbit indefinitely or jump at wrap boundaries.
- Unit-circle orientation should follow the standard visual convention: `cos > 0` to the right, `sin > 0` upward, positive `θ` counterclockwise.

## Concept graph

```text
UNIT CIRCLE
├─ trace rotating radius ─> VECTOR
│                           └─ extend + place PULL on joint ─> VECTOR COMPONENTS
│                                                              └─ pull + from origin ─> VECTOR ADDITION
│                                                                                         └─ hold A+B in target
│                                                                                            + drop B shadow onto A
│                                                                                            ─> DOT PRODUCT
│                                                                                                └─ make A·B = 0
│                                                                                                   ─> ORTHOGONAL BASIS
│                                                                                                       └─ distort grid
│                                                                                                          ─> MATRIX TRANSFORMATION
│                                                                                                              └─ flatten / flip area ─> DETERMINANT
│                                                                                                                                       └─ find invariant line ─> EIGENVECTOR
│                                                                                                                                                                     └─ find second line ─> EIGENBASIS
│                                                                                                                                                                                               └─ re-base grid ─> DIAGONALIZATION
├─ trace rotation ─> SIN / COS WAVES
│                    ├─ touch / drag tangent ─> TANGENT / DERIVATIVE
│                    └─ sweep area ─> INTEGRAL / ACCUMULATION
├─ reinterpret coordinates ─> COMPLEX PLANE
│                              ├─ multiply ─> ROTATION + SCALE
│                              └─ combine rotations ─> FOURIER
└─ unwrap circumference ─> RADIANS / NUMBER LINE
                           └─ join endpoints ─> MODULAR ARITHMETIC
                                              └─ cycles / factors ─> NUMBER THEORY

LINEAR + CALCULUS + COMPLEX/FOURIER
                  └─> FINAL SYNTHESIS ─> UNIT CIRCLE ─> EXIT
```

## Delivery phases

### Phase 0 — Foundation
- [x] Existing unit-circle / sin / cos 3D room.
- [x] Camera-based face focus and reverse navigation.
- [x] Continuous angle history and auto-play.
- [x] Define the concept graph in code.
- [x] Replace the hidden origin swipe with a visible **trace-the-rotating-radius** gateway.
- [x] Preserve the same radius as it becomes a vector while the circle fades and an XY grid appears.
- [x] Separate the unit-circle back control from exploratory tapping / tracing.
- [x] Present the focused unit circle in the standard positive-angle orientation while keeping the underlying θ progression unchanged.
- [x] Label unit-circle projections as `cos θ` / `sin θ` and the point as `(cos θ, sin θ)` so the later vector formulas are visibly continuous.
- [x] Add lightweight persistent discovery state so deep discoveries backfill their live prerequisite path.

### Phase 1 — Vector room
- [x] Make vector endpoint directly draggable after entry.
- [x] Allow magnitude to leave the unit circle while preserving the vector angle/state.
- [x] Reveal the PULL gateway only after the vector reaches a meaningful hidden threshold and has usable x/y components.
- [x] Keep that eligibility threshold out of the visible model because it is an interaction rule, not a mathematical object.
- [x] Let PULL move semi-freely and reveal the component geometry as it approaches the white component joint.
- [x] Magnetically snap PULL onto that joint to enter `x = r cos θ`, `y = r sin θ` components.
- [x] Put `x = r cos θ`, `y = r sin θ`, and `(r cos θ, r sin θ)` directly on the decomposed model; keep changing x/y/r values in the information dock.
- [x] Pull a dedicated `+` handle from the origin to create a second vector.
- [x] Discover vector addition through the parallelogram and resultant `A + B` vector.
- [x] Make vector addition a real escape puzzle: `A + B` must be moved into a glowing mathematical target by manipulating A / B; the resultant itself is not draggable.
- [x] Require `A + B` to remain inside the target for about 700 ms and show the hold progress on the target before the state becomes true.
- [x] Discover dot product by dragging the **shadow of B** onto its perpendicular foot on A, rather than moving B itself onto A.
- [x] Keep A and B visible in the DOT PRODUCT room, show `projₐ(B)`, the perpendicular guide/right angle, and `A · B = |A||B| cos φ`.
- [x] Keep B draggable after discovery so positive, zero, and negative projection / dot product states are explorable.
- [x] Turn `A · B = 0` into a dwell escape condition and lock A/B into an orthogonal basis.

### Phase 1.5 — Smartphone browser UX
- [x] Lock the experience to the viewport and suppress document scrolling during exploration.
- [x] Follow the normal-scale `VisualViewport` so expanding/collapsing mobile browser chrome resizes the playfield.
- [x] Opt into `viewport-fit=cover` and mobile interactive-widget resizing without disabling pinch zoom.
- [x] Make the phone model surface full-bleed instead of a bordered landscape card.
- [x] Move persistent numerical readouts into a compact bottom information dock.
- [x] Increase minimum label sizes and remove unnecessary tiny SVG text.
- [x] Replace fixed SIN/COS portrait zoom with semantic safe-frame fitting so the full wave extent and labels stay visible.
- [x] Use inward / edge-aware labels for focused SIN/COS instead of fixed rightward offsets.
- [x] Fit the unit circle semantically and prioritize its size on phones.
- [x] Remove legacy 3D box/wave scaffolding once the scene has become a vector.
- [x] Keep expanding vector/linear rooms on dynamic fit from their current live geometry.
- [x] Remove legacy focus outlines / invisible SVG hit-box outlines from touch presentation.
- [x] Replace exploratory background-tap backtracking with explicit back controls.
- [x] Enlarge important interaction hit areas without enlarging the mathematical object.
- [ ] Validate framing on multiple real portrait browsers and tune safe padding / scale from screenshots.
- [ ] Validate one-handed reach and accidental-trigger rates for every live gateway.

### Phase 2 — Linear algebra room
- [x] Use the orthogonal A/B pair from dot product as the first explicit basis.
- [x] Promote basis arrows into draggable basis vectors.
- [x] Warp the entire grid from the basis vectors: matrix as a spatial transformation.
- [x] Show determinant as signed area scale.
- [x] Let the grid collapse at `det = 0` and continue through an orientation flip.
- [x] Discover the first eigenvector by searching for a direction that does not rotate under the transform.
- [x] Lock the first invariant line and search separately for the second real invariant direction.
- [x] Promote the pair to EIGENBASIS and morph the grid onto those two directions.
- [x] Reveal DIAGONALIZATION only after the transform is visibly reduced to independent scaling/flipping on the two invariant axes.

### Phase 3 — Calculus room
- [ ] Enter from a sin/cos curve point by holding / dragging its tangent.
- [ ] Move the point along the curve and trace tangent slope into the derivative graph.
- [ ] Introduce `tan` only when a line/tangent slope is directly manipulated and the relationship is visually earned.
- [ ] Sweep under a curve to accumulate area.
- [ ] Link accumulated area and derivative as inverse transformations.

### Phase 4 — Complex / Fourier room
- [ ] Reinterpret `(cos θ, sin θ)` as `cos θ + i sin θ` without moving the geometry.
- [ ] Complex multiplication becomes rotation + scale.
- [ ] Compose rotating vectors / epicycles.
- [ ] Let the user rebuild a waveform from frequency components.

### Phase 5 — Circular arithmetic / number theory
- [ ] Unwrap the unit circle into radians on a number line.
- [ ] Join number-line endpoints into modular arithmetic.
- [ ] Visualize modular addition / multiplication as circular motion.
- [ ] Transition repeated cycles into factors, gcd, and prime structure.

### Phase 6 — Game layer
- [x] Persist discovered concepts locally without requiring a backend.
- [x] Add a secondary discovered-concept map; undiscovered branch names remain hidden.
- [x] Add short discovery reactions instead of tutorial dialogs.
- [ ] Add contextual idle hints that reveal only possible manipulation, never the answer.
- [ ] Add optional challenge rooms that require a mathematical property to open a route.
- [ ] Decide whether discovered nodes should eventually become optional reverse-navigation anchors without turning the map into a topic menu.

### Phase 7 — Final convergence
- [ ] Reconnect LINEAR, CALCULUS, and COMPLEX/FOURIER into one final synthesis room.
- [ ] Reuse only previously learned gestures in the final puzzle.
- [ ] Let discoveries change the final room's capabilities rather than acting as inventory keys.
- [ ] Reconstruct a signal / structure from multiple modes and collapse the result back into the original UNIT CIRCLE.
- [ ] Open EXIT only after that return-to-origin transformation is complete.

## Technical architecture
- Keep a single mathematical state when two rooms are two interpretations of the same object.
- Concept navigation is a graph of semantic edges, not page routes.
- A room transition owns an animation progress `0..1`; geometry is interpolated rather than replaced at a hard cut.
- Camera state and concept state remain separate: a camera focus is not itself a concept change.
- Put pure graph definitions, drag-coordinate conversion, transition eligibility rules, threshold hysteresis, target-hit rules, dwell timing, vector projection, eigenpair math, viewport metrics, and semantic-frame fitting outside rendering code and unit-test them.
- Keep newly added concepts and interaction gateways in isolated layers/components so the monolithic trig renderer does not keep growing.
- Fit scenes from their actual semantic geometry instead of assuming a fixed crop will remain valid.
- Centralize mobile layout behavior so imported CSS layers do not compete over width/transform/viewport rules.
- Migrate long-lived Room state away from DOM reconstruction / MutationObserver bridges before adding several more simultaneous branches.
- Prefer SVG while the scene remains tractable; only move to Canvas/WebGL when profiling demonstrates a real rendering bottleneck.

## Immediate next implementation order
1. **Real-phone full-route validation (#38)**: run UNIT CIRCLE → DIAGONALIZATION end-to-end and use screenshots to fix remaining scale, reach, and stale-layer problems.
2. **Room state refactor (#39)**: make mathematical state explicit across long-lived rooms and reduce DOM reconstruction before CALCULUS / COMPLEX branches multiply.
3. **SIN/COS → TANGENT / DERIVATIVE (#41)**: let slope emerge from manipulating a tangent rather than from explanatory text.
4. **SIN/COS → INTEGRAL / ACCUMULATION (#42)**: make area accumulation a sweep mechanic sharing the same wave interaction foundation.
5. **Finish game-layer hints (#43)** after the live route is stable enough that hints can point to real affordances rather than compensate for layout bugs.
6. **COMPLEX / FOURIER (#44)**, then prototype the final convergence / EXIT (#45).
