import runpod


def handler(job):
  payload = job.get("input", {})
  survey_id = payload.get("survey_id")

  return {
    "ok": True,
    "message": "Worker scaffold ready",
    "survey_id": survey_id,
  }


if __name__ == "__main__":
  runpod.serverless.start({"handler": handler})
