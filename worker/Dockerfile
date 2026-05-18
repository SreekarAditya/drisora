FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

ARG DRISORA_BUILD_SHA=unknown
LABEL org.opencontainers.image.revision=$DRISORA_BUILD_SHA

WORKDIR /app
COPY requirements.txt .
# Install system deps for OpenCV and git-based Python packages
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install git+https://github.com/apple/ml-depth-pro.git
RUN pip install git+https://github.com/facebookresearch/sam2.git

COPY . .
COPY weights/ weights/

ENV SAM2_MODEL_PATH=/tmp/models/sam2.1_hiera_small.pt
ENV DEPTHPRO_MODEL_PATH=/tmp/models/depth_pro.pt
ENV DRISORA_DETERMINISTIC_SEED=1337
ENV DRISORA_DETERMINISTIC_EXTRACTOR=1
ENV DRISORA_YOLO_BATCH_SIZE=64
ENV DRISORA_DEPTHPRO_BATCH_SIZE=16
ENV DRISORA_BUILD_SHA=$DRISORA_BUILD_SHA
ENV PYTHONHASHSEED=1337
ENV CUBLAS_WORKSPACE_CONFIG=:4096:8

CMD ["python", "handler.py"]
