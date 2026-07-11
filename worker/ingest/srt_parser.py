# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

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
    relative_altitude_m: Optional[float]
    absolute_altitude_m: Optional[float]
    altitude_source: str
    gimbal_yaw: Optional[float]
    gimbal_pitch: Optional[float]
    gimbal_roll: Optional[float]
    gps_signal_quality: Optional[str]


_TIMECODE_RE = re.compile(
    r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})"
)
_LAT_RE = re.compile(r"latitude\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_LON_RE = re.compile(r"longitude\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_GPS_TUPLE_RE = re.compile(
    r"GPS\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*(-?\d+(?:\.\d+)?))?\s*\)",
    re.IGNORECASE,
)
_ABS_ALT_RE = re.compile(r"abs_alt\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_REL_ALT_RE = re.compile(r"rel_alt\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_ALT_RE = re.compile(
    r"(?:^|\s|\[)alt(?:itude)?\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE
)
_YAW_RE = re.compile(r"gimbal_yaw\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_PITCH_RE = re.compile(r"gimbal_pitch\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_ROLL_RE = re.compile(r"gimbal_roll\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_GPS_QUALITY_RE = re.compile(
    r"(gps(?:_signal)?(?:_quality|_level|_num|_used|_status)?|satellites)\s*[:=]\s*([A-Za-z0-9_.+-]+)",
    re.IGNORECASE,
)


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
        gps_tuple_m = _GPS_TUPLE_RE.search(block)

        tuple_alt_m: Optional[float] = None
        if lat_m and lon_m:
            try:
                lat = float(lat_m.group(1))
                lon = float(lon_m.group(1))
            except ValueError:
                continue
        elif gps_tuple_m:
            try:
                # DJI compact SRT format writes GPS as (longitude, latitude, altitude).
                lon = float(gps_tuple_m.group(1))
                lat = float(gps_tuple_m.group(2))
                if gps_tuple_m.group(3) is not None:
                    tuple_alt_m = float(gps_tuple_m.group(3))
            except ValueError:
                continue
        else:
            # Skip frames without GPS — they're not useful for georeferencing.
            continue

        relative_altitude_m: Optional[float] = None
        absolute_altitude_m: Optional[float] = tuple_alt_m
        generic_altitude_m: Optional[float] = None

        rel_match = _REL_ALT_RE.search(block)
        if rel_match:
            try:
                relative_altitude_m = float(rel_match.group(1))
            except ValueError:
                relative_altitude_m = None

        abs_match = _ABS_ALT_RE.search(block)
        if abs_match:
            try:
                absolute_altitude_m = float(abs_match.group(1))
            except ValueError:
                absolute_altitude_m = tuple_alt_m

        generic_match = _ALT_RE.search(block)
        if generic_match:
            try:
                generic_altitude_m = float(generic_match.group(1))
            except ValueError:
                generic_altitude_m = None

        # Physical area/GSD must use height above ground level.  We expose a
        # generic or MSL altitude for telemetry, but never label it as AGL.
        if relative_altitude_m is not None:
            alt_m = relative_altitude_m
            altitude_source = "relative_agl"
        elif generic_altitude_m is not None:
            alt_m = generic_altitude_m
            altitude_source = "generic_unknown"
        elif absolute_altitude_m is not None:
            alt_m = absolute_altitude_m
            altitude_source = "absolute_msl_only"
        else:
            alt_m = None
            altitude_source = "unavailable"

        yaw: Optional[float] = None
        ym = _YAW_RE.search(block)
        if ym:
            try:
                yaw = float(ym.group(1))
            except ValueError:
                yaw = None

        pitch: Optional[float] = None
        pm = _PITCH_RE.search(block)
        if pm:
            try:
                pitch = float(pm.group(1))
            except ValueError:
                pitch = None

        roll: Optional[float] = None
        rm = _ROLL_RE.search(block)
        if rm:
            try:
                roll = float(rm.group(1))
            except ValueError:
                roll = None

        gps_signal_quality: Optional[str] = None
        qm = _GPS_QUALITY_RE.search(block)
        if qm:
            gps_signal_quality = qm.group(2)

        entries.append(
            {
                "timestamp_ms": start_ms,
                "lat": lat,
                "lon": lon,
                "alt_m": alt_m,
                "relative_altitude_m": relative_altitude_m,
                "absolute_altitude_m": absolute_altitude_m,
                "altitude_source": altitude_source,
                "gimbal_yaw": yaw,
                "gimbal_pitch": pitch,
                "gimbal_roll": roll,
                "gps_signal_quality": gps_signal_quality,
            }
        )

    # Sort by timestamp just in case
    entries.sort(key=lambda e: e["timestamp_ms"])
    return entries
