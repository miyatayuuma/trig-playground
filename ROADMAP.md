# Math Labyrinth Roadmap

## Product vision
Turn the current trigonometry visualization into a seamless explorable mathematical world. The user should discover relationships by manipulating the geometry itself rather than choosing topics from a menu.

A transition is only valid when the gesture has mathematical meaning. The same object should survive the transition whenever possible: a radius becomes a vector, a wave point becomes a tangent, a coordinate grid becomes a linear transformation, and a rotating complex number becomes a Fourier component.

## Interaction grammar
- **Trace an existing object**: reinterpret the same object in a related concept.
- **Pull apart / decompose**: reveal components, factors, or basis directions.
- **Match a mathematical target**: move an object until a special condition is satisfied; the target should attract / snap rather than behave like a generic UI button.
- **Overlay / align**: reveal projection, dot product, equality, or equivalence.
- **Distort the space**: enter matrix / transformation concepts.
- **Trace motion**: create a graph, derivative, accumulated quantity, or orbit.
- **Cut / unwrap / join boundaries**: move between circular, linear, and modular representations.
- **Explicit back control or background tap**: reverse one conceptual step without competing with the room's primary drag gesture.

No permanent topic menu in the main experience. A discovered-concept map can exist as a secondary navigation layer later.

## Interaction safety rules
- Direct manipulation handles own their pointer gesture and must not bubble into room navigation.
- A concept gateway must have a dedicated target and a distance/direction/condition threshold; arbitrary swipes do not unlock it.
- A mathematical gateway should reveal itself only when its prerequisite state is meaningful. Avoid showing every possible control at once.
- Use hysteresis around reveal thresholds so handles do not flicker when a draggable object sits on a boundary.
- Large transparent hit areas may surround small visible handles, but overlapping semantic controls must be avoided.
- While a direct-manipulation room is active, page scrolling is disabled and the model owns touch gestures.
- Every drag interaction needs a keyboard alternative.
- Small SVG labels should prefer clean high-contrast fills over thick outline strokes that collapse glyph counters on phones.
- Move persistent numeric/detail readouts outside the SVG when possible; reserve the model itself for geometry and essential labels.

## Mobile presentation rules
- Treat the experience as a fixed `100dvh` application, not a scrolling document.
- Use the portrait display vertically: model above, numerical / textual readout dock below.
- Fit each room differently. Unit circle, vector, components, and 3D box do not need the same on-screen scale.
- On portrait phones, enlarge the SVG beyond its normal document width and crop only unused scene margins so the active geometry fills the screen.
- Do not let informational labels compete with puzzle affordances.
- Annotation text such as `θ` should settle into a stable location rather than orbit indefinitely or jump at wrap boundaries.

## Concept graph

```text
UNIT CIRCLE
├─ trace rotating radius ─> VECTOR
│                           ├─ extend + place PULL on joint ─> VECTOR COMPONENTS
│                           │                                  └─ pull + from origin ─> VECTOR ADDITION
│                           │                                                                     └─ project / drop ─> DOT PRODUCT
│                           └─ distort grid ─> MATRIX TRANSFORMATION
│                                               ├─ area tile ─> DETERMINANT
│                                               └─ invariant direction ─> EIGENVECTOR
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
- [x] Replace the hidden origin swipe with a visible **trace-the-rotating-radius** gateway.
- [x] Preserve the same radius as it becomes a vector while the circle fades and an XY grid appears.
- [x] Separate the unit-circle back control from exploratory tapping / tracing.
- [ ] Add lightweight discovery telemetry in local state so the app knows which gateways were found during the session.

### Phase 1 — Vector room
- [x] Make vector endpoint directly draggable after entry.
- [x] Allow magnitude to leave the unit circle while preserving the vector angle/state.
- [x] Reveal the PULL gateway only after the vector crosses an outer ring and has meaningful x/y components.
- [x] Let PULL move semi-freely and reveal the component geometry as it approaches the white component joint.
- [x] Magnetically snap PULL onto that joint to enter `x = r cos θ`, `y = r sin θ` components.
- [x] Pull a dedicated `+` handle from the origin to create a second vector.
- [x] Discover vector addition through the parallelogram and resultant `A + B` vector.
- [ ] Discover dot product by projecting / dropping one vector onto the other.

### Phase 1.5 — Touch / mobile UX pass
- [x] Lock the experience to the viewport and suppress page scrolling during exploration.
- [x] Move persistent angle / component readouts into a bottom information dock.
- [x] Increase minimum label sizes and remove unnecessary tiny SVG text.
- [x] Scale focused mathematical rooms more aggressively on portrait phones.
- [x] Remove the orbiting / wrapping θ label and replace it with a stable annotation that settles once.
- [ ] Validate the phone framing on several portrait aspect ratios and tune per-room scaling from real screenshots.

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
- Put pure graph definitions, drag-coordinate conversion, transition eligibility rules, threshold hysteresis, and target-hit rules outside rendering code and unit-test them.
- Keep newly added concepts and interaction gateways in isolated layers/components so the monolithic trig renderer does not keep growing.
- Prefer SVG while the scene remains tractable; only move to Canvas/WebGL when profiling demonstrates a real rendering bottleneck.

## Immediate next implementation order
1. **VECTOR ADDITION escape puzzle**: make `A + B` satisfy a visible mathematical target rather than advancing from a generic gesture. The resultant should not be directly draggable; A and B must be adjusted to move it.
2. **VECTOR ADDITION → DOT PRODUCT**: reuse A/B and turn projection onto one vector into the next semantic gateway.
3. **Touch framing validation**: tune portrait scale factors / target hit radii from real phone screenshots before adding larger rooms.
4. **Room/layer refactor**: move more of the original vector/component scene out of `LabApp` before MATRIX or CALCULUS expands the renderer.
5. **MATRIX → DETERMINANT**: make signed area scale the first linear-algebra escape condition.
6. Add a discovered-concept map after at least four meaningful transitions are stable on touch devices.
