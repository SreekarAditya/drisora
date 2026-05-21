# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""Backward-compatible shim for the former depth module name.

The open-source backend uses Depth Anything V2 for metric depth. This module
keeps older imports working while delegating to the current implementation.
"""

from pipeline.depth_anything_v2_inference import *  # noqa: F401,F403
