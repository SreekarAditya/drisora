FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

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
COPY models/sam2.1_hiera_small.pt /app/models/sam2.1_hiera_small.pt
COPY models/depth_pro.pt /app/models/depth_pro.pt

ENV SAM2_MODEL_PATH=/app/models/sam2.1_hiera_small.pt
ENV DEPTHPRO_MODEL_PATH=/app/models/depth_pro.pt
ENV DRISORA_DETERMINISTIC_SEED=1337
ENV DRISORA_DETERMINISTIC_EXTRACTOR=1
ENV PYTHONHASHSEED=1337
ENV CUBLAS_WORKSPACE_CONFIG=:4096:8

CMD ["python", "handler.py"]
