"""DJI SRT log parser.

DJI drones (Mini, Air, Mavic) record one SRT entry per video frame. The
exact format varies by firmware, but every variant we've seen embeds:

    - latitude / longitude (decimal degrees)
    - absolute altitude (m, MSL) and / or relative altitude (m AGL)
    - gimbal yaw angle (deg)
    - a wall-clock timestamp

We normalize these into a list of dicts keyed by `timestamp_ms` (ms offset
from the start of the clip) so downstream code can match frames by time.

Example block (DJI Mini 2 firmware 01.04.0500):

    1
    00:00:00,000 --> 00:00:00,033
    <font size="28">FrameCnt: 1, DiffTime: 33ms
    2024-08-01 10:13:45.812
    [iso : 100] [shutter : 1/640.0] [fnum : 280] [ev : 0] ...
    [latitude: 18.541234] [longitude: 73.901112] [rel_alt: 12.300 abs_alt: 564.230]
    [gimbal_yaw: -91.4 gimbal_pitch: -90.0 gimbal_roll: 0.0]
    </font>
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import List, Optional, TypedDict


class SrtEntry(TypedDict):
    timestamp_ms: int
    lat: float
    lon: float
    alt_m: Optional[float]
    gimbal_yaw: Optional[float]


_TIMECODE_RE = re.compile(
    r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})"
)
_LAT_RE = re.compile(r"latitude\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_LON_RE = re.compile(r"longitude\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_ABS_ALT_RE = re.compile(r"abs_alt\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_REL_ALT_RE = re.compile(r"rel_alt\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_ALT_RE = re.compile(
    r"(?:^|\s|\[)alt(?:itude)?\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE
)
_YAW_RE = re.compile(r"gimbal_yaw\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)


def _timecode_to_ms(h: str, m: str, s: str, ms: str) -> int:
    return ((int(h) * 3600) + (int(m) * 60) + int(s)) * 1000 + int(ms)


def parse_srt(srt_path: str | Path) -> List[SrtEntry]:
    """Parse a DJI SRT file. Returns an empty list on parse failure."""
    path = Path(srt_path)
    if not path.is_file():
        return []

    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []

    # SRT blocks are separated by a blank line.
    blocks = re.split(r"\r?\n\r?\n", text.strip())
    entries: List[SrtEntry] = []

    for block in blocks:
        tc = _TIMECODE_RE.search(block)
        if not tc:
            continue

        # Use the start of the time range as the frame timestamp
        start_ms = _timecode_to_ms(tc.group(1), tc.group(2), tc.group(3), tc.group(4))

        lat_m = _LAT_RE.search(block)
        lon_m = _LON_RE.search(block)
        if not (lat_m and lon_m):
            # Skip frames without GPS — they're not useful for georeferencing.
            continue

        try:
            lat = float(lat_m.group(1))
            lon = float(lon_m.group(1))
        except ValueError:
            continue

        # Prefer absolute altitude (MSL); fall back to relative or generic alt.
        alt_m: Optional[float] = None
        for rx in (_ABS_ALT_RE, _REL_ALT_RE, _ALT_RE):
            am = rx.search(block)
            if am:
                try:
                    alt_m = float(am.group(1))
                    break
                except ValueError:
                    continue

        yaw: Optional[float] = None
        ym = _YAW_RE.search(block)
        if ym:
            try:
                yaw = float(ym.group(1))
            except ValueError:
                yaw = None

        entries.append(
            {
                "timestamp_ms": start_ms,
                "lat": lat,
                "lon": lon,
                "alt_m": alt_m,
                "gimbal_yaw": yaw,
            }
        )

    # Sort by timestamp just in case
    entries.sort(key=lambda e: e["timestamp_ms"])
    return entries
