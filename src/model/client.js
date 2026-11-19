// The one file that names the model provider: Google's Gemini API, over plain HTTPS.
// The rest of the app gets a client with complete(prompt) and never knows the provider.
// Every failure is an Error with .reason: 'no_key', 'timeout', 'rate_limited' or 'down'.
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const failure = (reason, message) => Object.assign(new Error(message), { reason });

function createModelClient({
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.MODEL_NAME || 'gemini-2.5-flash',
  timeoutMs = 10_000,
  fetchImpl = (...args) => fetch(...args),
} = {}) {
  async function complete(prompt) {
    if (!apiKey) throw failure('no_key', 'GEMINI_API_KEY is not set');
    let res;
    try {
      res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429) throw failure('rate_limited', 'The provider is rate-limiting this key');
      if (!res.ok) throw failure('down', `The provider answered ${res.status}`);
      const body = await res.json();
      return (body.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');
    } catch (err) {
      if (err.reason) throw err;
      throw failure(err.name === 'TimeoutError' ? 'timeout' : 'down', `The model call failed: ${err.name}`);
    }
  }

  return { complete };
}

module.exports = { createModelClient };