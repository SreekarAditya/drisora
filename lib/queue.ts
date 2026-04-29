import { Queue } from "bullmq";

const connection = {
  host: process.env.UPSTASH_REDIS_REST_URL,
  password: process.env.UPSTASH_REDIS_REST_TOKEN,
  tls: {},
} as const;

export const surveyQueue = new Queue("survey-processing", { connection });

export async function enqueueSurveyJob(surveyId: string) {
  return surveyQueue.add(
    "process-survey",
    { surveyId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
}
