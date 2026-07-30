import express from 'express';
import { generateReportCard } from '../report-card/index.js';
import prisma from '../prisma.js';

const router = express.Router();

router.get('/report-card/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const includeSimplified = req.query.simplified === 'true';

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { clauses: true, flags: true, score: true },
    });
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!document.score) {
      return res.status(400).json({ error: 'Score not computed yet. Run extraction first.' });
    }

    const scoreData = {
      score: document.score.score,
      flags: document.flags,
      settlementRatio: document.score.settlementRatio,
      settlementRatioMatchedInsurer: document.score.settlementRatioMatchedInsurer,
      breakdown: document.score.breakdown as Record<string, number>,
    };

    const reportCard = generateReportCard(scoreData, {
      insurerName: document.insurerName,
      sumInsured: document.sumInsured,
      premium: document.premium,
    });

    res.json({
      success: true,
      documentId,
      reportCard,
    });
  } catch (err) {
    console.error('report-card error:', err);
    res.status(500).json({
      success: false,
      error: 'Report card generation failed',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;