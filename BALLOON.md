# BALLOON — Executive Summary
*A living design document. For future Claude instances, collaborators, and the team.*
*Last updated: May 25, 2026*

---

## What This Is

A daily mobile game where players build things out of virtual balloons — long, tubular 260Q-style modeling balloons, the kind used by professional balloon artists. The medium is the mechanic. The physics of inflating, twisting, segmenting, and connecting balloons is both the interface and the creative challenge.

It is simultaneously:
- A toy for an 8-year-old who just wants to blow things up
- A daily puzzle game for a 27-year-old who wants to be surprised by their own creativity
- A deep creative platform for a 60-year-old who wants to make something beautiful

**One game. Three audiences. No condescension to any of them.**

---

## The Core Loop

1. **A riddle drops** — daily, AI-generated, same for every player. Oblique, not literal.
2. **Player decodes** — what does the riddle mean? What should I build?
3. **Player builds** — using balloon gestures: blow, twist, pinch, connect, weave
4. **AI judges** — not pass/fail. It *responds* to what you made. Specifically. Generously.
5. **Score lands** — Olympic style: time + attempts + impact
6. **Creation enters gallery** — where it lives, rotates in 3D, and can be voted on forever
7. **Score evolves** — crowd votes change the impact score. Creations can go viral weeks later.
8. **Social spread** — share card is the creation itself rotating in 3D, with riddle and score

---

## The Philosophical Foundation

This game emerged from a conversation about AI, human nature, and the capacity for distinction.

The core argument: AI trained on human output risks amplifying the worst human tendencies — tribalism, fear, othering — not because those are more "real" than altruism and creativity, but because they dominate the training signal. The counter: all human tendencies are equally native. The question is what gets selected for.

The game is an implicit argument for the better tendencies. It rewards creativity, interpretation, generosity of imagination. It expands the player's option set rather than narrowing it.

**Mechanically:** every choice in the game bottoms out in a binary — blow more or stop, twist here or there, this color or that one. Complexity is emergent. The balloon is undifferentiated potential. The twist is the act of distinction. The shape that emerges is the world that choice created.

Balloons creating balloons creating balloons.

---

## The Medium

Professional balloon artists work with **260Q modeling balloons** — long, tubular, roughly 60 inches inflated, 2 inches wide. The fundamental unit is not a sphere. It is a pressurized tube that, when twisted, creates fat sausage-shaped bubbles connected by tight necks.

The ceiling of this art form is extraordinary. Artist **Masayoshi Matsumoto** (Isopresso Balloon) creates photorealistic insects, birds, and marine creatures using only balloons — no glue, tape, markers, or embellishments. Works take 2-6 hours. This is what the "hard" tier of the game aspires toward.

**The five primitive operations:**
1. **Blow** — inflate a tube to chosen size; over-inflation pops it
2. **Twist** — rotate to segment a tube into bubbles
3. **Pinch** — mark and lock a twist point
4. **Connect** — lock two twist points together (creates ears, legs, loops, wings)
5. **Weave** — thread one balloon through or around another (advanced)

**The building palette:**
- Multiple balloons available per creation
- Different lengths, colors, inflation levels
- Color choice is part of the creative expression
- Deflated tips become claws, beaks, tapers — negative space matters

**How a 260Q actually inflates:**
Air enters from the nozzle end and fills progressively toward the tip. The balloon grows from the knot upward. Width stays constant — only length increases. The tip end stays slightly tapered. This is the inflation model for the game.

---

## Difficulty Layers

Difficulty lives entirely in the **interpretation**, never the interface. The building tools are the same at every level. An 8-year-old and a master use the same gestures.

| Level | Riddle Style | Balloon Count | AI Tolerance |
|-------|-------------|---------------|--------------|
| Easy | Literal — "make a dog" | 1-2 | Wide. Many shapes accepted. |
| Medium | Metaphorical | 3-5 | Color and form both matter |
| Hard | Oblique, poetic, philosophical | Unlimited | Matsumoto territory |

---

## Scoring — Olympic Style

Three components, all visible:

- **Time** — how fast from riddle to submission. Objective.
- **Attempts** — how many resets before final build. Objective.
- **Impact** — how the creation is received. Initially AI-scored; evolves with crowd votes.

**Impact scoring philosophy:** The AI rates not just *did you answer the riddle* but *how surprising, delightful, and unexpected was your interpretation*. A technically correct answer scores differently than a technically correct answer that nobody expected. Surprise is rewarded.

**The reveal moment is designed.** Not a number appearing. A moment. The score lands with weight.

---

## The Gallery

Creations don't disappear after scoring. They enter a gallery where they:
- Rotate slowly in 3D on a dark background
- Can be voted on by anyone, forever
- Have scores that evolve — a creation made three weeks ago can go viral
- Trigger notifications when they receive votes or share attention
- Generate social cards: the creation rotating in 3D, with the original riddle and current score

The gallery is a living leaderboard. It creates the long-game addiction loop that pure puzzle games lack.

---

## The Joy Moment

When the AI recognizes what you made, it doesn't say "correct."

It says something about *your specific creation*. It responds to your dog, not *a* dog. The 8-year-old and the 60-year-old both feel the same thing: **recognition**. *I made that and it was seen.*

That moment — not the score, not the gallery, not the social spread — is the emotional core of the game. Everything else is infrastructure around it.

---

## Technical Architecture

**Platform:** Mobile and tablet first. No mouse. Gestures only. The interface is the body.

**Rendering:** Three.js via expo-gl. Real 3D geometry. Real lighting. Phong material with translucency and specular highlights. The balloon must feel alive.

**Gesture system — three modes, tap to cycle:**
- **INFLATE mode** (default) — two-finger pinch/spread inflates/deflates
- **MOVE mode** (one tap) — single finger moves balloon around screen
- **ROTATE mode** (two taps) — single finger rotates on all axes, two-finger twist = rotation.z

**Balloon geometry:**
- Three-part mesh: SphereGeometry top cap + CylinderGeometry body + SphereGeometry bottom cap
- 14 radial segments — creates visible vertical light channels
- BALLOON_RADIUS = 0.18 (constant, never changes)
- Only body height grows with inflation (scale.y)
- Caps always full hemisphere size
- Balloon grows upward from fixed bottom anchor
- Rotation pivot at balloon center (offset by half total height)

**AI layer (Claude API):**
- Daily riddle generation — Haiku 4.5, cached across all players, near-zero marginal cost
- Build judgment — Sonnet 4.6, generous and specific, responds to the actual creation
- Difficulty calibration — riddle complexity matched to player history

**Stack:**
- React Native / Expo SDK 54
- Three.js v0.166.0 (do NOT upgrade — expo-gl compatibility)
- expo-gl for WebGL rendering
- Claude API for riddle + judgment
- Supabase for gallery, scores, votes
- GitHub: https://github.com/cormacmahoney/balloon

**Cost at scale:** Under $20/day in AI costs at 10,000 daily active players, before caching discounts.

---

## The Team

**Cormac** — vision, taste, product decisions, final judge of every *oh* moment. No code required.

**Claude** — architecture, Cursor prompts, verification, plain English explanations. Waits for approval before anything. Never touches a terminal directly.

**Cursor agent** — executes the actual code changes. Writes to disk. Claude writes the prompts, Cursor executes them.

**The constraint:** Claude has no memory between sessions. The doc is the memory. Paste it at the top of every new conversation.

---

## How We Work — Session Protocol

### The division of labor
- Claude writes Cursor prompts
- Cursor agent executes code changes
- Cormac verifies with grep before running anything
- Claude never writes code directly to terminal

### Starting a session
Paste this document. State in one sentence what you want to do. Claude confirms understanding. Go.

### The verification rule — NON-NEGOTIABLE
After EVERY Cursor change, before running anything:
```
grep "THE_KEY_THING" ~/balloon54/App.js
```
If grep returns nothing — the change didn't save. Do not proceed. Fix first.

### STOP is a hard interrupt
When Cormac types STOP — output stops immediately. Mid-sentence. No completion. No "just one more." Acknowledged and waiting.

### Ending a session
Update Current Build State and Next Action. Commit to GitHub. No loose files.

### Commit message format
`build_00N — what we did in one sentence`

---

## Folder Structure

```
~/balloon54/          — the active project (Expo SDK 54)
  App.js              — main file, all balloon logic
  package.json
  ...
```

**GitHub:** https://github.com/cormacmahoney/balloon
**Branch:** main

---

## Lessons Log

**May 2026 — prototype phase:**
- 2D canvas cannot achieve the physical feel required for tube geometry.
- The balloon shape is a 260Q tube — long, sausage bubbles, cosine necks — not a sphere.
- The blow gesture must be immediate — any lag kills the feeling of breath.
- No string on the balloon. Players rejected it immediately.
- The geometry must be solved before any game mechanic is added. Feel first. Everything else second.

**May 2026 — Three.js in widget:**
- Three.js LatheGeometry in the chat widget is blind guesswork — no live viewport.
- MeshPhysicalMaterial with transmission washes out color — everything goes pale.
- NEVER attempt complex 3D scene assembly in the chat widget.

**May 2026 — CSS breakthrough:**
- CSS radial gradients achieved the approved balloon look.
- The balloon material is translucent glossy — like colored glass. Not opaque. Not latex.
- Spring physics in JS gives natural bouncy squish feel.

**May 2026 — Expo setup:**
- SDK 56 is incompatible with current Expo Go. Use SDK 54.
- expo-three requires expo-file-system which Snack doesn't support. Use raw THREE.WebGLRenderer.
- three@0.184 incompatible with expo-three. Use three@0.166.0 exactly.
- Tunnel works via @expo/ngrok — must be in PATH. Fix: `mkdir -p ~/.npm-global && npm config set prefix ~/.npm-global`.
- Kill conflicting ports before starting: `kill $(PID)`.

**May 2026 — Cursor file saving:**
- Cursor agent writes changes but they are NOT saved to disk until accepted in diff view.
- ALWAYS verify with `grep` in terminal after every Cursor change.
- `cat App.js | head -3` or `grep "KEY_TERM" App.js` — if empty, file not saved.
- Fix: use TextEdit to paste code directly, or `cat > file << 'EOF'` in terminal.
- Opening balloon54 as ROOT project (not subfolder of balloon) fixes Cursor saving.
- The workspace root matters — balloon54 must be opened directly, not as subfolder.

**May 2026 — Claude behavior:**
- Claude has a "problem-capture" failure mode — locks onto technical problems and ignores STOP.
- Claude has "optimization for apparent progress" — generates code to appear helpful even when wrong.
- The fix: Claude writes Cursor prompts only. Cursor executes. Claude never touches terminal directly.
- STOP is a hard interrupt. No output after STOP under any circumstances.
- Verify before assuming. The terminal is the source of truth, not Cursor's UI.

**May 2026 — Three.js balloon geometry:**
- Three-part mesh (top cap + cylinder + bottom cap) gives always-round ends regardless of inflation.
- LatheGeometry with scale.y produces flat ends at low inflation — wrong approach.
- Rotation pivot must be offset to balloon center: `balloon.position.y = -(BALLOON_RADIUS + bodyHeight / 2)`
- 14 radial segments creates visible light channels that make it look real.
- DoubleSide + depthWrite: false required for translucent balloon material.

---

## Current Build State

**Last session:** May 25, 2026
**Build:** build_001
**GitHub:** https://github.com/cormacmahoney/balloon — pushed and archived

**What works:**
- Single 260Q balloon rendering in 3D via Three.js + expo-gl on iPhone
- Inflates from bottom upward (knot anchored, tip rises)
- Round hemisphere caps at all inflation levels
- Three gesture modes (tap to cycle): INFLATE / MOVE / ROTATE
- INFLATE: two-finger pinch/spread
- MOVE: single finger translates balloon around screen
- ROTATE: single finger rotates on X and Y axes, two-finger twist rotates on Z axis
- Rotation pivot at balloon center
- Mode indicator visible on screen

**What needs work:**
- Visual polish — material not yet matching approved CSS balloon look
- Inflation feel — needs to feel more like breath, less mechanical
- Colors — only red, needs full palette
- No pinch-to-segment yet
- No multiple balloons
- No riddle or game mechanics

---

## Next Action

**Visual polish sprint:**
Get the single balloon looking like the approved CSS reference — translucent, glossy, deep color with soft highlight. Match the material to what was approved in the widget prototype.

Then: add pinch gesture to create segments (bubbles) on the inflated balloon.

**Success criteria:** Cormac inflates the balloon, pinches it into 3 segments, and it looks like the reference balloon dog photo.

---

## What Success Feels Like

A child blows up a balloon, twists it twice, the AI says *"that's the loneliest dog I've ever seen — and somehow that's exactly right"* — and the child screenshots it and sends it to their grandmother.

The grandmother plays the next day.

---

## The Governing Rules

This project follows the **CONSTITUTION.md** protocol:
- Ask before building
- Build exactly what was asked
- Flag conflicts before proceeding
- Security is not a phase
- Never close without committing

*When uncertain, ask. When asked, answer.*

---
also this:

STRICT ENGINEERING MODE

Your job is to implement ONLY the explicitly requested change.

Constraints:
- Minimal diff only
- Preserve architecture
- No opportunistic refactors
- No speculative improvements
- No new dependencies without approval
- No file renames/moves
- No style rewrites
- No hidden behavior changes

Process:
1. Restate task
2. List assumptions
3. List files touched
4. Explain exact modifications
5. Identify risks
6. WAIT FOR APPROVAL before coding

When coding:
- prefer surgical edits
- preserve existing patterns
- avoid abstractions unless necessary
- keep changes localized

After coding:
- summarize blast radius
- list possible regressions
- list follow-up improvements separately

Non-goals:
- no caching
- no auth redesign
- no UI changes
- no retry system
- no performance optimization

Label all assumptions explicitly.
Do not convert assumptions into implementation decisions silently.

Act as:
1. IMPLEMENTER
2. REVIEWER

IMPLEMENTER writes minimal code.
REVIEWER critiques for:
- scope drift
- hidden side effects
- unnecessary abstractions
- architecture violations


*The game is called BALLOON until it earns a better name.*
*Last updated: May 25, 2026*
