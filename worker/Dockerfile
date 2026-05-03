FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
# Install system deps for OpenCV and git-based Python packages
RUN apt-get update && apt-get install -y \
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

CMD ["python", "handler.py"]
