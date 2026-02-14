import OpenAI from "openai";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

const MODEL = "text-embedding-3-small";
const MAX_BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface EmbeddingResult {
  embeddings: number[][];
  tokensUsed: number;
}

async function embedBatch(
  texts: string[],
  attempt = 1
): Promise<EmbeddingResult> {
  try {
    const response = await getOpenAI().embeddings.create({
      model: MODEL,
      input: texts,
      dimensions: 1536,
    });

    const embeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    return {
      embeddings,
      tokensUsed: response.usage?.total_tokens ?? 0,
    };
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw error;
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return embedBatch(texts, attempt + 1);
  }
}

export async function generateEmbeddings(
  texts: string[]
): Promise<EmbeddingResult> {
  if (texts.length === 0) {
    return { embeddings: [], tokensUsed: 0 };
  }

  const allEmbeddings: number[][] = [];
  let totalTokens = 0;

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const result = await embedBatch(batch);
    allEmbeddings.push(...result.embeddings);
    totalTokens += result.tokensUsed;
  }

  return {
    embeddings: allEmbeddings,
    tokensUsed: totalTokens,
  };
}
