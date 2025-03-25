import { PrismaClient } from '@prisma/client';
import { OpenAI } from 'openai';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export async function getEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

export async function findSimilarMessages(embedding: number[], limit: number = 5) {
  const result = await prisma.$queryRaw`
    SELECT id, content, role
    FROM "Message"
    WHERE embedding IS NOT NULL
    ORDER BY embedding <-> ${embedding}::vector
    LIMIT ${limit};
  `;
  return result;
}

export async function analyzeEmotions(text: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "Analyze the emotional content of the text and return a JSON array of emotions and their intensities (0-1). Focus on primary emotions like joy, sadness, anger, fear, surprise, etc."
      },
      {
        role: "user",
        content: text
      }
    ],
    response_format: { type: "json_object" }
  });

  return JSON.parse(response.choices[0].message.content || "{}").emotions;
}

export async function extractTopics(text: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "Extract key topics/themes from the text and return them as a JSON array of strings. Focus on psychological and emotional themes."
      },
      {
        role: "user",
        content: text
      }
    ],
    response_format: { type: "json_object" }
  });

  return JSON.parse(response.choices[0].message.content || "{}").topics;
} 