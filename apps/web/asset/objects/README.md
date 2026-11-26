# Object Assets — Isometric 3D Office

Drop object sprites here. Each file is loaded by name and drawn as an isometric
3D-style sprite in the rotating office view.

## Expected files

```
apps/web/asset/objects/
├── server_rack.png       # Server rack with blinking LEDs
├── desk_monitor.png      # Office desk with dual monitors
├── coffee_machine.png    # Espresso machine / breakroom
├── arcade_cabinet.png    # Retro arcade cabinet
├── glass_partition.png   # Glass wall partition
└── office_chair.png      # Ergonomic chair
```

## Sprite guidelines

- Transparent background (PNG/WebP)
- Isometric (2:1 diamond) projection, front-facing
- 128–256 px, clean pixel-art edges
- The studio rotates the view, so assets should look good from all four
  cardinal isometric angles (N, E, S, W)

## Fallback

If an asset file is missing, the studio draws a procedural pixel-art placeholder
instead of leaving a gap.