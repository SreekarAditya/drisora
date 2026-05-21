# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""DJI SRT parser wrapper with additional fields.

Wraps the existing :func:`ingest.srt_parser.parse_srt` function and extends
each entry with:

- ``frame_index`` – 0-based sequential index assigned after sorting by
  timestamp.
- ``altitude_m``  – AGL altitude renamed from ``alt_m`` for clarity; missing altitudes in
  individual entries are filled with a 30 m fallback.  If *no* entry in the
  file contains an altitude the function raises :class:`ValueError`.
- ``fov_deg``     – field of view in degrees, defaulting to 73.7° (DJI Mavic
  3 standard) when absent from the SRT.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ingest.srt_parser import parse_srt

_DEFAULT_FOV_DEG: float = 73.7
_FALLBACK_ALT_M: float = 30.0

_NO_GPS_MSG = (
    "SRT file contains no GPS coordinates. Ensure drone GPS was enabled."
)


def parse_dji_srt(srt_path: str | Path | None) -> list[dict[str, Any]]:
    """Parse a DJI SRT file and return an enriched list of frame dicts.

    Parameters
    ----------
    srt_path:
        Path to the ``.srt`` file produced by the drone.  May be a
        :class:`str` or :class:`~pathlib.Path`.

    Returns
    -------
    list[dict]
        One dict per frame, sorted by ``timestamp_ms``, with keys:

        ``frame_index``  – 0-based sequential integer.
        ``timestamp_ms`` – milliseconds from clip start.
        ``lat``          – latitude in decimal degrees.
        ``lon``          – longitude in decimal degrees.
        ``altitude_m``   – altitude in metres (fallback 30.0 if missing for
                           that entry but other entries have a value).
        ``fov_deg``      – field of view in degrees (default 73.7).
        ``gimbal_yaw``   – yaw angle in degrees, or ``None`` if unavailable.

    Raises
    ------
    ValueError
        If *srt_path* is ``None`` / empty, if the file yields no entries, or
        if *no* entry in the file contains a GPS altitude.
    """
    if not srt_path:
        raise ValueError(_NO_GPS_MSG)

    raw_entries = parse_srt(srt_path)

    if not raw_entries:
        raise ValueError(_NO_GPS_MSG)

    # Determine whether any entry contains a real altitude value.
    has_any_altitude = any(
        entry.get("alt_m") is not None for entry in raw_entries
    )
    if not has_any_altitude:
        raise ValueError(_NO_GPS_MSG)

    result: list[dict[str, Any]] = []
    for idx, entry in enumerate(raw_entries):
        alt = entry.get("alt_m")
        altitude_m: float = alt if alt is not None else _FALLBACK_ALT_M

        result.append(
            {
                "frame_index": idx,
                "timestamp_ms": entry["timestamp_ms"],
                "lat": entry["lat"],
                "lon": entry["lon"],
                "altitude_m": altitude_m,
                "fov_deg": _DEFAULT_FOV_DEG,
                "gimbal_yaw": entry.get("gimbal_yaw"),
                "gps_signal_quality": entry.get("gps_signal_quality"),
            }
        )

    return result
