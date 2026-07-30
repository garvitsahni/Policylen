export const LANGUAGES = [
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
]

export function buildPrompt(text: string, targetLang: string): string {
  return (
    `Translate the following insurance explanation text to ${LANGUAGES.find(l => l.code === targetLang)?.name || targetLang} (${targetLang}). ` +
    `Keep all rupee amounts (₹), percentages (%), and numbers exactly as-is. ` +
    `Use simple, everyday language that a first-time insurance buyer would understand. ` +
    `Output ONLY the translation, no preamble or quotes around it.\n\n` +
    `Text: ${text}`
  )
}

export async function translateText(
  text: string,
  targetLang: string,
  apiKey: string
): Promise<string> {
  const prompt = buildPrompt(text, targetLang)

  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    }
  )

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`Translation API error ${response.status}: ${errBody}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('Empty translation response')

  return content
}