#!/usr/bin/env python3
"""Build the short, offline Stinky Weasel showcase video.

The trailer is intentionally generated from committed fixture art instead of a
remote asset or stock music. ImageMagick rasterises the storyboard frames and
ffmpeg joins them with a small procedural sound-design track. The same script
can be rerun after changing the timing, captions, or source fixtures.

Requirements:
  * ImageMagick's `convert` command
  * ffmpeg (or set FFMPEG=/path/to/ffmpeg)
  * Python 3.10+

Example:
  python3 tools/video/create-trailer.py --output-dir /tmp/sw2d-trailer
"""

from __future__ import annotations

import argparse
import base64
import math
import html
import os
import re
import shutil
import struct
import subprocess
import wave
from pathlib import Path

WIDTH = 960
HEIGHT = 540
FPS = 24
DURATION = 12.0
SAMPLE_RATE = 44_100

ROOT = Path(__file__).resolve().parents[2]
PALACE = ROOT / "workbench/fixtures/palace.png"
WEASEL = ROOT / "workbench/fixtures/weasel.png"


def require_binary(name: str, env_name: str | None = None) -> str:
    candidate = os.environ.get(env_name or "", "") if env_name else ""
    path = candidate or shutil.which(name)
    if not path:
        hint = f" or set {env_name}" if env_name else ""
        raise SystemExit(f"Missing {name}{hint}. See the script header for requirements.")
    return path


def data_uri(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def esc(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease(value: float) -> float:
    value = clamp(value)
    return value * value * (3.0 - 2.0 * value)


def fade_opacity(t: float, start: float, end: float, hold: float = 0.0) -> float:
    fade_in = ease((t - start) / max(0.001, end - start))
    fade_out = 1.0
    if hold > 0:
        fade_out = ease((start + hold - t) / max(0.001, end - start))
    return clamp(min(fade_in, fade_out))


def circle(x: float, y: float, radius: float, fill: str, opacity: float = 1.0) -> str:
    return f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{radius:.2f}" fill="{fill}" opacity="{opacity:.3f}"/>'


def text(
    value: str,
    x: float,
    y: float,
    size: float,
    fill: str = "#fff7dc",
    anchor: str = "middle",
    weight: str = "700",
    opacity: float = 1.0,
    letter_spacing: float = 0.0,
) -> str:
    return (
        f'<text x="{x:.2f}" y="{y:.2f}" text-anchor="{anchor}" '
        f'font-family="DejaVu Sans" font-size="{size:.1f}px" font-weight="{weight}" '
        f'letter-spacing="{letter_spacing:.2f}px" fill="{fill}" opacity="{opacity:.3f}">{esc(value)}</text>'
    )


def glow_coin(x: float, y: float, pulse: float, label: str) -> str:
    radius = 15.0 + pulse * 3.0
    return (
        circle(x, y, radius * 2.2, "#ffe79a", 0.10 + pulse * 0.06)
        + circle(x, y, radius * 1.45, "#ffd56a", 0.18 + pulse * 0.10)
        + circle(x, y, radius, "#ffc857", 0.98)
        + circle(x - 4, y - 4, radius * 0.31, "#fff4b8", 0.92)
        + text(label, x, y + 5, 15, "#8c4d23", weight="700")
    )


def build_svg(t: float, palace_uri: str, weasel_uri: str) -> str:
    # The fixture palace is 480x270, exactly 16:9; doubling it keeps the
    # original pixel art crisp enough for the 960x540 delivery frame.
    seconds = t
    stars = "".join(
        circle(x, y, 2.0 if i % 3 else 2.8, "#fff1b8", 0.38 + 0.25 * ((i * 7) % 5) / 4)
        for i, (x, y) in enumerate(
            [(72, 58), (152, 92), (235, 42), (312, 78), (438, 48), (534, 104), (644, 55), (736, 94), (836, 48), (900, 118), (780, 31), (372, 132)]
        )
    )

    # A slow, gentle scale drift makes the still fixture feel like a camera
    # rather than a slideshow without changing the actual game artwork.
    zoom = 1.02 + 0.018 * math.sin(seconds * 0.42)
    image_x = (WIDTH - WIDTH * zoom) / 2
    image_y = (HEIGHT - HEIGHT * zoom) / 2
    background = (
        f'<image href="{palace_uri}" x="{image_x:.2f}" y="{image_y:.2f}" '
        f'width="{WIDTH * zoom:.2f}" height="{HEIGHT * zoom:.2f}" preserveAspectRatio="none"/>'
        '<rect width="960" height="540" fill="#101934" opacity="0.09"/>'
        f'<g opacity="{0.62 + 0.12 * math.sin(seconds * 0.7):.3f}">{stars}</g>'
    )

    content = background

    # Opening title card: the world is visible immediately, then the message
    # arrives in two clean beats instead of competing with the character.
    if seconds < 2.25:
        opacity = fade_opacity(seconds, 0.10, 0.55, 2.0)
        content += (
            '<rect width="960" height="540" fill="#111a38" opacity="0.25"/>'
            + circle(480, 224, 116, "#f7d77e", 0.09)
            + text("STINKY WEASEL", 480, 235, 58, "#fff6d4", opacity=opacity, letter_spacing=4.0)
            + text("THE MOONLIT RUN", 480, 279, 18, "#f7c96c", opacity=opacity, weight="400", letter_spacing=5.0)
            + text("a tiny adventure begins", 480, 470, 16, "#d9e5e2", opacity=opacity * 0.88, weight="400", letter_spacing=1.4)
            + f'<rect x="260" y="300" width="440" height="2" fill="#f7c96c" opacity="{opacity * 0.55:.3f}"/>'
        )
        # The hero enters at the bottom of the title card as a visual anchor.
        x = 420 + 10 * math.sin(seconds * 1.1)
        y = 315 + 4 * math.sin(seconds * 4.0)
        content += f'<image href="{weasel_uri}" x="{x:.1f}" y="{y:.1f}" width="96" height="128" opacity="{opacity:.3f}"/>'

    # Beat one: a clear left-to-right walk toward the lit doorway.
    elif seconds < 5.35:
        local = seconds - 2.25
        progress = ease(local / 3.1)
        x = 64 + 310 * progress
        y = 308 + 3.5 * math.sin(local * 8.0)
        content += (
            text("THE GATE IS OPEN", 64, 90, 14, "#f7c96c", anchor="start", weight="400", opacity=0.90, letter_spacing=3.0)
            + text("Follow the light.", 64, 119, 29, "#fff6d4", anchor="start", weight="700", opacity=0.95)
            + f'<path d="M64 138 H280" stroke="#f7c96c" stroke-width="2" opacity="0.55"/>'
            + f'<image href="{weasel_uri}" x="{x:.1f}" y="{y:.1f}" width="96" height="128"/>'
        )
        # Three small guiding lights pull the eye toward the palace door.
        for i, (lx, ly) in enumerate([(250, 302), (305, 277), (360, 302)]):
            pulse = (math.sin(local * 4.0 + i * 1.4) + 1.0) / 2.0
            content += glow_coin(lx, ly, pulse, "")

    # Beat two: the jump and three pickups are the visual payoff.
    elif seconds < 8.55:
        local = seconds - 5.35
        jump_progress = clamp((local - 0.20) / 1.55)
        jump = math.sin(jump_progress * math.pi) * 118 if jump_progress > 0 else 0
        x = 250 + 175 * clamp(local / 2.8)
        y = 310 - jump + 3.0 * math.sin(local * 8.0)
        content += (
            text("FOLLOW THE LIGHT", 480, 90, 14, "#f7c96c", weight="400", opacity=0.90, letter_spacing=3.0)
            + text("One brave leap.", 480, 119, 29, "#fff6d4", opacity=0.95)
        )
        for i, (lx, ly) in enumerate([(318, 244), (402, 194), (486, 245)]):
            appear = ease((local - 0.30 - i * 0.35) / 0.30)
            pulse = (math.sin(local * 7.0 + i) + 1.0) / 2.0
            if appear > 0:
                content += f'<g opacity="{appear:.3f}">' + glow_coin(lx, ly, pulse, str(i + 1)) + '</g>'
        content += f'<image href="{weasel_uri}" x="{x:.1f}" y="{y:.1f}" width="96" height="128"/>'
        # A brief impact ring sells the landing without hiding the art.
        if local > 1.55:
            impact = 1.0 - clamp((local - 1.55) / 0.75)
            content += f'<ellipse cx="{x + 48:.1f}" cy="438" rx="{38 + 30 * (1 - impact):.1f}" ry="{8 + 7 * (1 - impact):.1f}" fill="none" stroke="#ffe59b" stroke-width="3" opacity="{impact * 0.75:.3f}"/>'

    # Beat three: resolve on the palace, then give the viewer a clean CTA.
    elif seconds < 10.75:
        local = seconds - 8.55
        opacity = fade_opacity(local, 0.0, 0.35, 1.85)
        door_glow = 0.12 + 0.09 * ((math.sin(local * 5.5) + 1) / 2)
        content += (
            '<rect x="330" y="304" width="62" height="120" rx="12" fill="#ffd76e" opacity="' + f'{door_glow:.3f}' + '"/>'
            + text("THE NIGHT IS YOURS", 480, 101, 15, "#f7c96c", weight="400", opacity=opacity, letter_spacing=3.0)
            + text("RUN. JUMP. ESCAPE.", 480, 136, 36, "#fff6d4", opacity=opacity, letter_spacing=2.0)
            + f'<image href="{weasel_uri}" x="365" y="306" width="82" height="109" opacity="{opacity:.3f}"/>'
        )

    # End card: a memorable final frame that also makes the source obvious.
    else:
        local = seconds - 10.75
        opacity = ease(local / 0.45)
        content += (
            '<rect width="960" height="540" fill="#111a38" opacity="0.44"/>'
            + text("STINKY WEASEL", 480, 220, 52, "#fff6d4", opacity=opacity, letter_spacing=3.6)
            + text("PLAY THE ADVENTURE", 480, 270, 18, "#f7c96c", opacity=opacity, weight="400", letter_spacing=4.4)
            + f'<rect x="342" y="316" width="276" height="54" rx="27" fill="#e47b35" opacity="{opacity:.3f}"/>'
            + text("▶  RUN GAME", 480, 351, 21, "#fff6d4", opacity=opacity, letter_spacing=1.6)
            + text("SW2D  /  LOCAL GAME FACTORY", 480, 461, 13, "#d9e5e2", opacity=opacity * 0.78, weight="400", letter_spacing=2.0)
        )

    # Frame-level fades make the handoff between beats feel intentional.
    if seconds < 0.35:
        content += f'<rect width="960" height="540" fill="#0e1733" opacity="{1.0 - ease(seconds / 0.35):.3f}"/>'
    if seconds > DURATION - 0.45:
        content += f'<rect width="960" height="540" fill="#0e1733" opacity="{ease((seconds - (DURATION - 0.45)) / 0.45):.3f}"/>'

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">'
        + content
        + '</svg>'
    )


def add_tone(samples: list[float], start: float, duration: float, frequency: float, gain: float, wave_type: str = "sine", end_frequency: float | None = None) -> None:
    start_i = max(0, int(start * SAMPLE_RATE))
    end_i = min(len(samples), int((start + duration) * SAMPLE_RATE))
    for i in range(start_i, end_i):
        local = (i - start_i) / SAMPLE_RATE
        progress = local / max(duration, 0.001)
        freq = frequency if end_frequency is None else frequency + (end_frequency - frequency) * progress
        phase = 2.0 * math.pi * freq * local
        if wave_type == "square":
            value = 1.0 if math.sin(phase) >= 0 else -1.0
        elif wave_type == "triangle":
            value = 2.0 * abs(2.0 * (freq * local - math.floor(freq * local + 0.5))) - 1.0
        else:
            value = math.sin(phase)
        attack = min(1.0, local / 0.008)
        release = min(1.0, max(0.0, (duration - local) / 0.06))
        samples[i] += value * gain * attack * release


def add_noise(samples: list[float], start: float, duration: float, gain: float) -> None:
    # Deterministic pseudo-noise keeps the render repeatable and avoids a
    # separate ambience asset. A few very low harmonics stop it sounding harsh.
    start_i = max(0, int(start * SAMPLE_RATE))
    end_i = min(len(samples), int((start + duration) * SAMPLE_RATE))
    state = 0x12345678
    previous = 0.0
    for i in range(start_i, end_i):
        state = (1664525 * state + 1013904223) & 0xFFFFFFFF
        white = ((state / 0xFFFFFFFF) * 2.0) - 1.0
        previous = previous * 0.985 + white * 0.015
        local = (i - start_i) / SAMPLE_RATE
        samples[i] += previous * gain * (0.55 + 0.45 * math.sin(local * 0.7))


def write_soundtrack(path: Path) -> None:
    samples = [0.0] * int(DURATION * SAMPLE_RATE)
    # A barely-there night bed gives the quiet shots a sense of place.
    add_tone(samples, 0.0, DURATION, 92, 0.035, "sine")
    add_tone(samples, 0.0, DURATION, 184, 0.012, "sine")
    add_noise(samples, 0.0, DURATION, 0.028)

    # Title / start chime.
    add_tone(samples, 0.35, 0.23, 523, 0.18, "sine")
    add_tone(samples, 0.48, 0.35, 784, 0.16, "sine")
    add_tone(samples, 0.78, 0.55, 1047, 0.11, "sine")

    # Soft footfalls during the walk.
    for index, start in enumerate([2.55, 3.02, 3.49, 3.96, 4.43, 4.90]):
        add_tone(samples, start, 0.085, 145 + (index % 2) * 20, 0.11, "triangle")
        add_tone(samples, start, 0.045, 72, 0.08, "sine")

    # Jump whoosh: a falling sweep, followed by three ascending pickups.
    add_tone(samples, 5.53, 0.52, 980, 0.10, "sine", 220)
    for start, frequency in [(5.96, 660), (6.40, 830), (6.84, 1047)]:
        add_tone(samples, start, 0.24, frequency, 0.18, "sine")
        add_tone(samples, start + 0.08, 0.28, frequency * 1.5, 0.08, "sine")

    # Landing, doorway resolve, and end-card sting.
    add_tone(samples, 7.12, 0.16, 120, 0.16, "triangle")
    add_tone(samples, 8.78, 0.38, 392, 0.14, "sine")
    add_tone(samples, 8.91, 0.46, 523, 0.13, "sine")
    add_tone(samples, 9.05, 0.60, 784, 0.12, "sine")
    add_tone(samples, 10.82, 0.22, 660, 0.17, "sine")
    add_tone(samples, 10.96, 0.46, 990, 0.12, "sine")

    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        pcm = bytearray()
        for sample in samples:
            sample = max(-1.0, min(1.0, sample * 0.82))
            pcm.extend(struct.pack("<h", int(sample * 32767)))
        output.writeframes(bytes(pcm))


def svg_attributes(tag: str) -> dict[str, str]:
    return dict(re.findall(r'([A-Za-z][A-Za-z0-9_-]*)="([^"]*)"', tag))


def svg_to_mvg(svg: str, assets: dict[str, Path]) -> str:
    """Translate the small SVG vocabulary above into ImageMagick MVG.

    The sandbox's ImageMagick build does not ship the optional SVG delegate.
    MVG is ImageMagick's native vector format, so this tiny translator keeps
    the generator self-contained and avoids adding a browser or graphics
    runtime just to render a few deterministic frames.
    """
    commands = [f"viewbox 0 0 {WIDTH} {HEIGHT}"]
    opacity_stack = [1.0]
    token_pattern = re.compile(
        r'(<image\b[^>]*/>|<rect\b[^>]*/>|<circle\b[^>]*/>|<path\b[^>]*/>|'
        r'<ellipse\b[^>]*/>|<text\b[^>]*>.*?</text>|<g\b[^>]*>|</g>)',
        flags=re.DOTALL,
    )
    for token in token_pattern.findall(svg):
        if token.startswith("<g"):
            opacity_stack.append(opacity_stack[-1] * float(svg_attributes(token).get("opacity", "1")))
            continue
        if token == "</g>":
            if len(opacity_stack) > 1:
                opacity_stack.pop()
            continue
        attrs = svg_attributes(token)
        opacity = opacity_stack[-1] * float(attrs.get("opacity", "1"))
        if token.startswith("<image"):
            href = attrs.get("href", attrs.get("xlink:href", ""))
            path = next((path for uri, path in assets.items() if href == uri), None)
            if path is None:
                continue
            x = float(attrs.get("x", "0"))
            y = float(attrs.get("y", "0"))
            width = float(attrs.get("width", "0"))
            height = float(attrs.get("height", "0"))
            commands.append(f"opacity {opacity:.4f}")
            commands.append(f"image over {x:.2f},{y:.2f} {width:.2f},{height:.2f} '{path}'")
            continue
        if token.startswith("<rect"):
            x = float(attrs.get("x", "0"))
            y = float(attrs.get("y", "0"))
            width = float(attrs.get("width", str(WIDTH)))
            height = float(attrs.get("height", str(HEIGHT)))
            fill = attrs.get("fill", "none")
            commands.append(f"fill '{fill}'")
            commands.append(f"fill-opacity {opacity:.4f}")
            if "rx" in attrs:
                rx = float(attrs["rx"])
                commands.append(f"roundrectangle {x:.2f},{y:.2f} {x + width:.2f},{y + height:.2f} {rx:.2f},{rx:.2f}")
            else:
                commands.append(f"rectangle {x:.2f},{y:.2f} {x + width:.2f},{y + height:.2f}")
            continue
        if token.startswith("<circle"):
            x = float(attrs["cx"])
            y = float(attrs["cy"])
            radius = float(attrs["r"])
            commands.append(f"fill '{attrs.get('fill', 'none')}'")
            commands.append(f"fill-opacity {opacity:.4f}")
            commands.append(f"circle {x:.2f},{y:.2f} {x + radius:.2f},{y:.2f}")
            continue
        if token.startswith("<ellipse"):
            x = float(attrs["cx"])
            y = float(attrs["cy"])
            rx = float(attrs["rx"])
            ry = float(attrs["ry"])
            commands.append("fill 'none'")
            commands.append(f"stroke '{attrs.get('stroke', '#ffffff')}'")
            commands.append(f"stroke-width {attrs.get('stroke-width', '1')}")
            commands.append(f"stroke-opacity {opacity:.4f}")
            # MVG's ellipse primitive is not available in older ImageMagick
            # builds; a stroked circle still reads as a soft landing ring.
            commands.append(f"circle {x:.2f},{y:.2f} {x + rx:.2f},{y:.2f}")
            continue
        if token.startswith("<path"):
            # The storyboard only uses this as a short horizontal divider. MVG
            # supports a full path grammar, so preserve the path data directly.
            commands.append("fill 'none'")
            commands.append(f"stroke '{attrs.get('stroke', '#ffffff')}'")
            commands.append(f"stroke-width {attrs.get('stroke-width', '1')}")
            commands.append(f"stroke-opacity {opacity:.4f}")
            path_data = attrs.get("d", "")
            match = re.fullmatch(r"M\s*([0-9.]+)\s+([0-9.]+)\s+H\s*([0-9.]+)", path_data)
            if match:
                commands.append(f"line {match.group(1)},{match.group(2)} {match.group(3)},{match.group(2)}")
            continue
        if token.startswith("<text"):
            value = html.unescape(re.sub(r"<[^>]+>", "", token[token.find(">") + 1 : token.rfind("</")]))
            size = float(attrs.get("font-size", "16px").replace("px", ""))
            x = float(attrs.get("x", "0"))
            y = float(attrs.get("y", "0"))
            anchor = attrs.get("text-anchor", "start")
            # DejaVu Sans is close enough for layout; this estimate centers the
            # text in MVG where SVG's text-anchor would have done it.
            estimate = len(value) * size * (0.60 if attrs.get("font-weight") == "700" else 0.54)
            if anchor == "middle":
                x -= estimate / 2
            elif anchor == "end":
                x -= estimate
            commands.extend(
                [
                    f"fill '{attrs.get('fill', '#ffffff')}'",
                    f"fill-opacity {opacity:.4f}",
                    f"font 'DejaVu-Sans{'-Bold' if attrs.get('font-weight') == '700' else ''}'",
                    f"font-size {size:.2f}",
                    f"text {x:.2f},{y:.2f} '{value.replace(chr(39), chr(39) + chr(39))}'",
                ]
            )
    return "\n".join(commands) + "\n"


def render_frames(frames_dir: Path, convert: str, palace_uri: str, weasel_uri: str) -> None:
    frames_dir.mkdir(parents=True, exist_ok=True)
    total = int(DURATION * FPS)
    assets = {palace_uri: PALACE, weasel_uri: WEASEL}
    for index in range(total):
        t = index / FPS
        mvg_path = frames_dir / f"frame-{index:04d}.mvg"
        png_path = frames_dir / f"frame-{index:04d}.png"
        mvg_path.write_text(svg_to_mvg(build_svg(t, palace_uri, weasel_uri), assets), encoding="utf-8")
        subprocess.run(
            [convert, "-size", f"{WIDTH}x{HEIGHT}", "-depth", "8", f"mvg:{mvg_path}", str(png_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        mvg_path.unlink()
        if index % FPS == 0:
            print(f"  rendered {index // FPS:02d}s / {int(DURATION):02d}s", flush=True)


def encode(video_path: Path, frames_dir: Path, audio_path: Path, ffmpeg: str) -> None:
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            str(frames_dir / "frame-%04d.png"),
            "-i",
            str(audio_path),
            "-t",
            f"{DURATION:.2f}",
            "-c:v",
            "libx264",
            "-profile:v",
            "high",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "20",
            "-movflags",
            "+faststart",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-ar",
            "44100",
            "-shortest",
            str(video_path),
        ],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "video", help="Directory for the MP4 and WAV outputs")
    parser.add_argument("--keep-frames", action="store_true", help="Keep the intermediate PNG frame sequence")
    args = parser.parse_args()

    if not PALACE.exists() or not WEASEL.exists():
        raise SystemExit("Expected committed fixture art is missing.")
    convert = require_binary("convert")
    ffmpeg = require_binary("ffmpeg", "FFMPEG")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = args.output_dir / "_frames"
    audio_path = args.output_dir / "stinky-weasel-trailer.wav"
    video_path = args.output_dir / "stinky-weasel-trailer.mp4"
    palace_uri = data_uri(PALACE)
    weasel_uri = data_uri(WEASEL)

    print("Rendering storyboard frames…")
    render_frames(frames_dir, convert, palace_uri, weasel_uri)
    print("Designing sound effects…")
    write_soundtrack(audio_path)
    print("Encoding H.264 + AAC video…")
    encode(video_path, frames_dir, audio_path, ffmpeg)
    if not args.keep_frames:
        shutil.rmtree(frames_dir, ignore_errors=True)
    print(f"Wrote {video_path}")
    print(f"Wrote {audio_path}")


if __name__ == "__main__":
    main()
