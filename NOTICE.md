# Notices

Drisora integrates the following third-party research and engineering components. Each project retains its original copyright and license.

- YOLOv12 / Ultralytics runtime is used with the project RDD2022 detector checkpoint for four trained classes (D00, D10, D20, D40). The deployed checkpoint is pinned by SHA-256 in code and the Docker build. Review the upstream and derived-checkpoint license before redistribution.
- SAM2 by Meta AI is used for promptable segmentation. The source is pinned to commit `c2ec8e14a185632b0a5d8b161928ceb50197eddc`; the SAM2.1 Hiera Small checkpoint is downloaded from Meta's official host and verified by SHA-256. SAM2 is distributed under its upstream license.
- RDD2022 by IIT Roorkee and the University of Tokyo is the road-damage dataset associated with detector training and is published under CC BY 4.0.
- IRC:82-2023 is an Indian Roads Congress publication. Drisora does not redistribute the standard. The software implements equation functions and a partial, bounded assessment contract; it does not claim that imagery measures all six functional parameters or that the output is a certified compliance result.
- Depth Anything V2 diagnostic code may be used separately to inspect relative monocular depth. It is excluded from the active physical measurement and PCI path.
