# Math Labyrinth Roadmap

## Product vision
Turn the current trigonometry visualization into a seamless explorable mathematical world. The user should discover relationships by manipulating the geometry itself rather than choosing topics from a menu.

A transition is only valid when the gesture has mathematical meaning. The same object should survive the transition whenever possible: a radius becomes a vector, a wave point becomes a tangent, a coordinate grid becomes a linear transformation, and a rotating complex number becomes a Fourier component.

## Interaction grammar
- **Drag / swipe from an object**: reinterpret that object in a related concept.
- **Pull apart / decompose**: reveal components, factors, or basis directions.
- **Overlay / align**: reveal projection, dot product, equality, or equivalence.
- **Distort the space**: enter matrix / transformation concepts.
- **Trace motion**: create a graph, derivative, accumulated quantity, or orbit.
- **Cut / unwrap / join boundaries**: move between circular, linear, and modular representations.
- **Tap / swipe background**: reverse the most recent conceptual transition.

No permanent topic menu in the main experience. A discovered-concept map can exist as a secondary navigation layer later.

## Concept graph

```text
UNIT CIRCLE
├─ radius swipe ─> VECTOR
│                  ├─ decompose ─> VECTOR COMPONENTS
│                  ├─ summon second vector ─> VECTOR ADDITION
│                  ├─ project onto second vector ─> DOT PRODUCT
│                  └─ distort grid ─> MATRIX TRANSFORMATION
│                                      ├─ area tile ─> DETERMINANT
│                                      └─ invariant direction ─> EIGENVECTOR
├─ trace rotation ─> SIN / COS WAVES
│                    ├─ touch a point ─> TANGENT / DERIVATIVE
│                    └─ sweep area ─> INTEGRAL / ACCUMULATION
├─ relabel coordinates ─> COMPLEX PLANE
│                         ├─ multiply ─> ROTATION + SCALE
│                         └─ combine rotations ─> FOURIER
└─ unwrap circumference ─> RADIANS / NUMBER LINE
                           └─ join endpoints ─> MODULAR ARITHMETIC
                                              └─ cycles / factors ─> NUMBER THEORY
```

## Delivery phases

### Phase 0 — Foundation
- [x] Existing unit-circle / sin / cos 3D room.
- [x] Camera-based face focus and reverse navigation.
- [x] Continuous angle history and auto-play.
- [x] Define the concept graph in code.
- [x] Add the first semantic gateway: **unit-circle origin → vector**.
- [x] Preserve the same radius as it becomes a vector while the circle fades and an XY grid appears.
- [ ] Add lightweight discovery telemetry in local state so the app knows which gateways were found during the session.

### Phase 1 — Vector room
- [ ] Make vector endpoint directly draggable after entry.
- [ ] Allow magnitude to leave the unit circle while preserving angle.
- [ ] Pull horizontal / vertical projections out into `x = r cos θ`, `y = r sin θ` components.
- [ ] Add a second vector through a gesture rather than a button.
- [ ] Discover vector addition via parallelogram completion.
- [ ] Discover dot product by dropping one vector onto the other.

### Phase 2 — Linear algebra room
- [ ] Promote vector basis arrows into draggable basis vectors.
- [ ] Warp the entire grid from the basis vectors: matrix as a spatial transformation.
- [ ] Show determinant as signed area scale.
- [ ] Let the grid collapse at `det = 0`.
- [ ] Discover eigenvectors by searching for directions that do not rotate under the transform.

### Phase 3 — Calculus room
- [ ] Enter from a sin/cos curve point by holding / dragging its tangent.
- [ ] Move the point along the curve and trace tangent slope into the derivative graph.
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
- [ ] Discovered-concept map; undiscovered nodes remain hidden.
- [ ] Contextual idle hints that reveal only possible manipulation, never the answer.
- [ ] Small discovery reactions instead of tutorial dialogs.
- [ ] Optional challenge rooms that require a mathematical property to open a route.
- [ ] Persist discoveries locally; backend remains unnecessary unless cross-device progression is added.

## Technical architecture
- Keep a single mathematical state when two rooms are two interpretations of the same object.
- Concept navigation is a graph of semantic edges, not page routes.
- A room transition owns an animation progress `0..1`; geometry is interpolated rather than replaced at a hard cut.
- Camera state and concept state remain separate: a camera focus is not itself a concept change.
- Put pure graph definitions and transition eligibility rules outside rendering code and unit-test them.
- Prefer SVG while the scene remains tractable; only move to Canvas/WebGL when profiling demonstrates a real rendering bottleneck.

## Immediate next implementation order
1. Finish VECTOR: draggable endpoint + magnitude.
2. VECTOR → COMPONENTS semantic pull gesture.
3. VECTOR → DOT PRODUCT using a second vector and projection.
4. Refactor the current trig scene into smaller room/layer components before adding MATRIX or CALCULUS.
5. Add the discovered-concept map only after at least four meaningful transitions exist.
