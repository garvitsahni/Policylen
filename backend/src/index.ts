import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import documentsRouter from './routes/documents.js';
import chatRouter from './routes/chat.js';
import scenariosRouter from './routes/scenarios.js';
import pitchCompareRouter from './routes/pitch-compare.js';
import reportCardRouter from './routes/report-card.js';
import translateRouter from './routes/translate.js';
import grievanceRouter from './routes/grievance.js';
import renewalWatchRouter from './routes/renewal-watch.js';
import communityClausesRouter from './routes/community-clauses.js';
import { simplifyExplanation } from './explain-simplify/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api', scenariosRouter);
app.use('/api', pitchCompareRouter);
app.use('/api', reportCardRouter);
app.use('/api', translateRouter);
app.use('/api', grievanceRouter);
app.use('/api', renewalWatchRouter);
app.use('/api', communityClausesRouter);

app.post('/api/explain-simplify', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    const simplified = simplifyExplanation(text);
    res.json({ original: text, simplified });
  } catch (err) {
    res.status(500).json({ error: 'Simplification failed' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});