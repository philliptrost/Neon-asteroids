# Feature Backlog

Prioritized list of features to implement. Move items to `specs/features/` when ready to work on them.

## Priority Legend
- **P0**: Critical - game is broken without it
- **P1**: High - core gameplay
- **P2**: Medium - polish and UX
- **P3**: Low - nice to have

---

## Backlog

| Priority | Feature | Description | Spec |
|----------|---------|-------------|------|
| P0 | Player Death | Ship destroyed on asteroid collision | Not started |
| P0 | Game Over | End game when lives = 0, show restart | Not started |
| P1 | Lives System | 3 lives, respawn with invincibility | Not started |
| P1 | Keyboard Controls | WASD/Arrow keys for desktop play | Not started |
| P1 | Wave Progression | New wave when all asteroids cleared | Not started |
| P2 | Responsive Canvas | Scale to fit mobile screens | Not started |
| P2 | Sound Effects | Thrust, shoot, explosion sounds | Not started |
| P2 | Pause Menu | Pause/resume with ESC or button | Not started |
| P3 | High Scores | Local storage leaderboard | Not started |
| P3 | Particle Effects | Explosions when asteroids destroyed | Not started |
| P3 | Power-ups | Shield, rapid fire, etc. | Not started |

---

## Completed Features
_Move features here after merging to main._

| Feature | PR | Date |
|---------|----|----- |
| Vite + Firebase Setup | #1 | 2026-01-22 |

---

## How to Use This Backlog

1. **Pick a feature** from the backlog (usually highest priority)
2. **Create a spec** by copying `TEMPLATE.md` to `specs/features/[feature-name].md`
3. **Fill out the spec** with acceptance criteria and design
4. **Create a branch** (`git checkout -b feature/feature-name`)
5. **Implement** against the spec
6. **Test** using the spec's test plan
7. **Create PR** and reference the spec
8. **Update this backlog** after merge
