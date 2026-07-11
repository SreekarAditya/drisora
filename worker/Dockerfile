FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime@sha256:ac7c098a81512e719afa5d2d497f812d7db3498f340a4b819c69cb7b3b257126

ARG DRISORA_BUILD_SHA=unknown
ARG SAM2_COMMIT=c2ec8e14a185632b0a5d8b161928ceb50197eddc
ARG SAM2_MODEL_URL=https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_small.pt
ARG SAM2_MODEL_SHA256=6d1aa6f30de5c92224f8172114de081d104bbd23dd9dc5c58996f0cad5dc4d38
ARG YOLO_MODEL_SHA256=138d3c738d53fdb9dd53297607bc612a4835c0554d3c1acb3f272d9987ee3cb3

LABEL org.opencontainers.image.revision=$DRISORA_BUILD_SHA

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    git \
    libgomp1 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt constraints.txt ./
RUN python -m pip install pip==26.0.1 setuptools==82.0.1 wheel==0.47.0 \
    && python -m pip install --constraint constraints.txt --requirement requirements.txt \
    && python -m pip install --no-build-isolation --no-deps \
      "git+https://github.com/facebookresearch/sam2.git@${SAM2_COMMIT}" \
    && python -m pip uninstall --yes ninja \
    && python -m pip check

RUN mkdir -p /opt/models \
    && curl --fail --location --retry 3 --user-agent "Drisora/0.1 checkpoint fetch" \
      --output /opt/models/sam2.1_hiera_small.pt "$SAM2_MODEL_URL" \
    && echo "$SAM2_MODEL_SHA256  /opt/models/sam2.1_hiera_small.pt" | sha256sum --check --strict

COPY weights/yolov12s_rdd2022.pt /opt/models/yolov12s_rdd2022.pt
RUN echo "$YOLO_MODEL_SHA256  /opt/models/yolov12s_rdd2022.pt" | sha256sum --check --strict

COPY . .
RUN python -m compileall -q /app

ENV DRISORA_YOLO_WEIGHTS_PATH=/opt/models/yolov12s_rdd2022.pt \
    DRISORA_YOLO_WEIGHTS_SHA256=138d3c738d53fdb9dd53297607bc612a4835c0554d3c1acb3f272d9987ee3cb3 \
    SAM2_MODEL_PATH=/opt/models/sam2.1_hiera_small.pt \
    SAM2_MODEL_SHA256=6d1aa6f30de5c92224f8172114de081d104bbd23dd9dc5c58996f0cad5dc4d38 \
    SAM2_MODEL_CFG=configs/sam2.1/sam2.1_hiera_s.yaml \
    DRISORA_DETERMINISTIC_SEED=1337 \
    DRISORA_DETERMINISTIC_EXTRACTOR=1 \
    DRISORA_YOLO_BATCH_SIZE=64 \
    DRISORA_BUILD_SHA=$DRISORA_BUILD_SHA \
    PYTHONHASHSEED=1337 \
    CUBLAS_WORKSPACE_CONFIG=:4096:8 \
    PYTHONPATH=/app

CMD ["python", "handler.py"]
