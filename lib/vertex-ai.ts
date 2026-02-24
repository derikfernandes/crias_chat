/**
 * Vertex AI (Gemini) via OAuth2 + generateContent.
 * O token OAuth é obtido com refresh_token e guardado em memória.
 */

const OAUTH_TOKEN_URL = "https://accounts.google.com/o/oauth2/token";
const VERTEX_GENERATE_URL =
  "https://us-central1-aiplatform.googleapis.com/v1/projects/crias-mvp/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent";

const DEFAULT_SYSTEM_PROMPT = "Você é um assistente prestativo e amigável. Responda em português de forma clara e objetiva.";

let cachedOAuth: { access_token: string; expires_at: number } | null = null;
const TOKEN_BUFFER_MS = 60 * 1000; // renovar 1 min antes de expirar

async function getOAuthToken(): Promise<string> {
  if (cachedOAuth && Date.now() < cachedOAuth.expires_at - TOKEN_BUFFER_MS) {
    return cachedOAuth.access_token;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Variáveis GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN são obrigatórias.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth token falhou: ${res.status} ${err}`);
  }

  const oauth = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedOAuth = {
    access_token: oauth.access_token,
    expires_at: Date.now() + (oauth.expires_in ?? 3600) * 1000,
  };
  return cachedOAuth.access_token;
}

export interface GenerateContentOptions {
  userMessage: string;
  systemPrompt?: string;
}

export async function generateContent(options: GenerateContentOptions): Promise<string> {
  const { userMessage, systemPrompt = DEFAULT_SYSTEM_PROMPT } = options;
  const accessToken = await getOAuthToken();

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: `${userMessage}.` }] }],
    generationConfig: {
      responseModalities: ["TEXT"],
      temperature: 0.13,
      topK: 8,
      topP: 0.55,
      maxOutputTokens: 50000,
      stopSequences: [],
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  const res = await fetch(VERTEX_GENERATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vertex generateContent falhou: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
    "";

  return text || "Não consegui gerar uma resposta.";
}
