# Neon Asteroids - Current State

This document captures what is currently implemented in the game.

## Core Mechanics

### Player Ship
| Feature | Status | Notes |
|---------|--------|-------|
| Movement via thrust | Done | Velocity-based with max speed cap (1.25) |
| Rotation | Done | Smooth acceleration/deceleration with friction |
| Screen wrapping | Done | Exits one edge, appears on opposite |
| Shooting | Done | Bullets inherit ship velocity |
| Motion trail | Done | 300-point trail that fades over time |
| Thrust flame | Done | Gradient effect (yellow → orange → red) |

### Asteroids
| Feature | Status | Notes |
|---------|--------|-------|
| Random spawn | Done | 5 initial asteroids, safe radius around ship |
| Random shapes | Done | 7-9 vertices per asteroid |
| Neon colors | Done | Random HSL with 100% saturation |
| Movement | Done | Random speed and direction |
| Screen wrapping | Done | Same as player |
| Splitting | Done | Large → 2 medium → 2 small → destroyed |

### Scoring
| Asteroid Size | Points |
|---------------|--------|
| Large (40px) | 10 |
| Medium (20px) | 30 |
| Small (10px) | 50 |

### Controls
- **Desktop**: Touch/click buttons (no keyboard support yet)
- **Mobile**: On-screen buttons (Thrust, Rotate Left, Rotate Right, Shoot)

## Visual Effects
- Neon glow on asteroids (10px shadow blur)
- Motion blur via semi-transparent frame clearing
- Ship trail with alpha fade

## Technical Details
- Canvas size: 800x600 (fixed)
- Framework: React 18 with hooks
- Rendering: HTML5 Canvas API
- Styling: Tailwind CSS

## Not Yet Implemented
- [ ] Keyboard controls
- [ ] Player-asteroid collision (death)
- [ ] Lives system
- [ ] Game over screen
- [ ] High score tracking
- [ ] Sound effects
- [ ] Wave progression
- [ ] Mobile-responsive canvas
- [ ] Pause functionality
