# Stinky Weasel trailer

`stinky-weasel-trailer.mp4` is a short, coherent 12-second showcase assembled from the repository's committed `palace.png` and `weasel.png` fixtures. It has a simple three-beat story:

1. **Opening** — the moonlit world and title establish the setting.
2. **Action** — the weasel walks toward the gate, leaps through three lights, and lands.
3. **Resolution** — the palace opens into a clear `RUN GAME` call to action.

The MP4 includes a mono AAC soundtrack with a quiet night bed, title chimes, soft footfalls, edit-transition whooshes, a jump sweep, three ascending pickup tones, a landing hit, and a resolve/end-card sting. The picture uses short dip-to-night transitions at each story beat so the still-art shots cut as one coherent piece. The generated WAV is included beside it so the sound design can be auditioned independently.

## Rebuild

From the repository root, run:

```bash
python3 tools/video/create-trailer.py
```

The renderer is offline and deterministic. It only reads committed fixture images, generates the sound effects procedurally, rasterises the storyboard with ImageMagick, and encodes with ffmpeg. Use `--keep-frames` while iterating on the storyboard to retain the intermediate PNG sequence.

The MP4 is 960×540 at 24 fps and 12 seconds long. `video/trailer-manifest.json` records the edit beats and sound cue timings.
