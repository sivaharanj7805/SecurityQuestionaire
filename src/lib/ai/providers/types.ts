export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateResult {
  answer: string;
  tokensUsed: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheCreation?: number;
  };
  cost: number;
  model: string;
}

export interface AIProvider {
  generateAnswer(
    system: string,
    user: string,
    opts?: GenerateOptions
  ): Promise<GenerateResult>;
}
