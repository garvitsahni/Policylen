import express from 'express';
import { comparePitch } from '../pitch-compare/index.js';
import prisma from '../prisma.js';

const router = express.Router();

async function getDocumentWithClauses(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { clauses: true, flags: true, score: true },
  });
  if (!document) return null;
  return document;
}

router.post('/pitch-compare', async (req, res) => {
  try {
    const { documentId, pitchText } = req.body;

    if (!documentId || !pitchText) {
      return res.status(400).json({ error: 'documentId and pitchText are required' });
    }

    const document = await getDocumentWithClauses(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const result = comparePitch(pitchText, document.clauses);

    res.json({
      success: true,
      documentId,
      pitchSnippet: pitchText.slice(0, 200) + (pitchText.length > 200 ? '...' : ''),
      ...result,
    });
  } catch (err) {
    console.error('pitch-compare error:', err);
    res.status(500).json({
      success: false,
      error: 'Pitch comparison failed',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;