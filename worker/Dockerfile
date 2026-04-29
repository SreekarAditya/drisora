FROM python:3.11-slim

RUN pip install --no-cache-dir \
    torch torchvision \
    ultralytics \
    opencv-python-headless \
    numpy scipy boto3 \
    supabase requests runpod

COPY pipeline/ /app/pipeline/
COPY weights/ /app/weights/
COPY handler.py /app/handler.py

WORKDIR /app

CMD ["python", "handler.py"]
