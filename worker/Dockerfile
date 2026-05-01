FROM python:3.11-slim

RUN pip install --no-cache-dir \
    torch torchvision \
    ultralytics \
    opencv-python-headless \
    numpy scipy \
    boto3 \
    supabase requests \
    Pillow piexif \
    python-dotenv \
    redis \
    runpod

COPY pipeline/ /app/pipeline/
COPY ingest/ /app/ingest/
COPY jobs/ /app/jobs/
COPY weights/ /app/weights/
COPY main.py /app/main.py

WORKDIR /app

CMD ["python", "main.py"]
