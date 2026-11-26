# Agent Sprite Assets

Each agent can have its own image file. Drop a PNG/WebP figurine here and set the
agent's **Sprite Asset** field (Hire / Edit modal) to the file name, e.g.:

```
asset/agents/claude-1.png
asset/agents/nova/sprite.png
```

Sprites are drawn ~104px tall, anchored at the agent's feet, and bob while walking.
If the file is missing the studio falls back to the built-in procedural chibi renderer.

## Suggested structure

```
apps/web/asset/
├── agents/
│   ├── claude-1.png
│   ├── codex-1.png
│   ├── nova/
│   │   └── sprite.png
│   └── ...
├── objects/        # desks, plants, server racks, mugs ...
└── rooms/          # floor tiles, wall panels, rugs ...
```

Transparent background, 256x256 or taller, front-facing works best.