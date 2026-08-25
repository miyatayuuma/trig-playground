# Math Labyrinth — Game Plot

## Core promise
The player should be able to make progress by touching, dragging, tracing, matching, squeezing, and aligning visible objects even when they do not know the mathematical vocabulary.

Mathematical names arrive **after** the player has caused the phenomenon. The puzzle is the relationship itself, not a quiz about terminology.

## Moment-to-moment rule
Each room follows the same rhythm:

1. **See something that looks touchable.** One or two affordances pulse; everything else stays quiet.
2. **Play freely.** Direct manipulation gives immediate, exaggerated geometric feedback.
3. **Accidentally approach a special state.** The world reacts before text explains why.
4. **Hold / snap / release.** A perceptible dwell or deliberate release prevents accidental transitions.
5. **Name the discovery.** Only after the event does the mathematical label become prominent.
6. **Reuse the same object.** The object becomes the tool for the next room instead of disappearing.

No room should require reading an instruction paragraph to be fun.

## Main labyrinth

```text
UNIT CIRCLE
│
├─ trace radius ─> VECTOR ─> COMPONENTS ─> ADDITION ─> DOT PRODUCT
│                                                        │
│                                                        └─ projection → 0
│                                                           ─> ORTHOGONAL BASIS
│                                                               │
│                                                               └─ grab the axes
│                                                                  ─> MATRIX TRANSFORMATION
│                                                                      │
│                                                                      ├─ squeeze a cell flat
│                                                                      │  ─> DETERMINANT
│                                                                      │
│                                                                      └─ find an unchanged direction
│                                                                         ─> EIGENVECTOR
│
├─ trace motion ─> SIN / COS WAVES ─┬─ pull tangent ─> DERIVATIVE
│                                    └─ sweep area ─> INTEGRAL
│
├─ reinterpret point ─> COMPLEX PLANE ─> ROTATION / SCALE ─> FOURIER
│
└─ unwrap circle ─> RADIANS ─> MODULAR ARITHMETIC ─> NUMBER THEORY
```

## Endgame convergence
The branches are not independent collectible-key routes. Each branch teaches a manipulation that changes what the player can perceive in the final space.

```text
LINEAR ALGEBRA ───────┐
CALCULUS / WAVES ─────┤
COMPLEX / FOURIER ────┼─> SPECTRAL SYNTHESIS ─> RECONSTRUCT THE SIGNAL
MODULAR / NUMBER ─────┘                              │
                                                     ▼
                                                UNIT CIRCLE
                                                     │
                                                    EXIT
```

The final reveal is that the simple circle from the first room was not a tutorial prop. Rotation, waves, complex phase, orthogonal components, basis changes, periodicity, and Fourier modes are different views of the same underlying structure.

The exit opens when the player rebuilds one coherent object from several rotating / oscillating components using gestures learned earlier. The final room should introduce almost no new controls.

## Current linear-algebra arc

### ORTHOGONAL BASIS
The player has made two arrows perpendicular. Their endpoints pulse rather than presenting a button.

### MATRIX TRANSFORMATION
Dragging either endpoint bends the entire lattice. This is intentionally toy-like: the grid should feel elastic and satisfying before the word “matrix” matters.

One fundamental cell remains slightly brighter than the rest. Its area changes automatically as the player distorts the space.

### DETERMINANT
When the player squeezes the cell nearly flat, a faint collapse seam appears. Keeping the cell flat for a short dwell causes the entire 2D lattice to snap into one line.

Only then does `DETERMINANT` / `det M` become the primary label.

The handles remain live. Pulling an axis back out restores 2D space; dragging it through the collapse line flips the cell orientation and changes the sign of `det M`. This makes positive / zero / negative determinant playable rather than explanatory.

## Game-quality constraints
- No generic NEXT button for concept transitions.
- No invisible swipe as the only way forward.
- No instant transition on a condition that can be crossed accidentally.
- At most one dominant new manipulation per room.
- Small mathematical marks may be precise; touch hit areas remain phone-sized.
- The room must still be enjoyable with all explanatory text mentally ignored.
- When a phenomenon is dramatic enough to teach itself, remove redundant labels rather than adding more instructions.
- Backtracking uses explicit UI and never competes with exploratory touch.
