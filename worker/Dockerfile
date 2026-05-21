FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

ARG DRISORA_BUILD_SHA=unknown
LABEL org.opencontainers.image.revision=$DRISORA_BUILD_SHA

WORKDIR /app
COPY requirements.txt .
# Install system deps for OpenCV and git-based Python packages
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    git \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install git+https://github.com/facebookresearch/sam2.git
RUN git clone --depth 1 https://github.com/DepthAnything/Depth-Anything-V2.git /opt/depth-anything-v2

COPY . .
COPY weights/ weights/

ENV SAM2_MODEL_PATH=/tmp/models/sam2.1_hiera_small.pt
ENV DEPTH_ANYTHING_V2_REPO=/opt/depth-anything-v2
ENV DEPTH_ANYTHING_V2_MODEL_PATH=/tmp/models/depth_anything_v2_metric_vkitti_vitl.pth
ENV DEPTH_ANYTHING_V2_ENCODER=vitl
ENV DEPTH_ANYTHING_V2_MAX_DEPTH_M=80
ENV DRISORA_DETERMINISTIC_SEED=1337
ENV DRISORA_DETERMINISTIC_EXTRACTOR=1
ENV DRISORA_YOLO_BATCH_SIZE=64
ENV DRISORA_DEPTH_BATCH_SIZE=4
ENV DRISORA_ENABLE_DEPTH_DEFAULT=1
ENV DRISORA_BUILD_SHA=$DRISORA_BUILD_SHA
ENV PYTHONHASHSEED=1337
ENV CUBLAS_WORKSPACE_CONFIG=:4096:8
ENV PYTHONPATH=/opt/depth-anything-v2:/app

CMD ["python", "handler.py"]
