import express from 'express';
import { translateText } from '../translate/index.js';

const router = express.Router();

router.post('/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'text and targetLang are required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'sk-or-placeholder') {
      return res.status(503).json({
        error: 'Translation is not configured',
        detail: 'Set OPENROUTER_API_KEY in .env to enable translation. Currently showing English by default.',
      });
    }

    const translation = await translateText(text, targetLang, apiKey);
    res.json({ original: text, translation, targetLang });
  } catch (err) {
    console.error('translate error:', err);
    res.status(500).json({
      error: 'Translation failed',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;