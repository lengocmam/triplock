import axios from 'axios';

const EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

export async function getEmbedding(apiKey: string, text: string): Promise<number[]> {
  const response = await axios.post(
    `${EMBED_URL}?key=${apiKey}`,
    { content: { parts: [{ text }] } },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 },
  );
  return response.data.embedding.values;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}