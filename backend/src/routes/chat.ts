import express from 'express';
import prisma from '../prisma.js';

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

async function callAiService(endpoint: string, body: unknown) {
  const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || `AI service error: ${response.status}`);
  }
  return data;
}

router.post('/:documentId/embed', async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const clauseTexts = await prisma.extractedClause.findMany({
      where: { documentId },
      select: { rawText: true },
    });

    const fullText = clauseTexts.map(c => c.rawText).join('\n\n');

    if (!fullText) {
      return res.status(400).json({ error: 'No extracted text found for this document' });
    }

    const result = await callAiService('/embed', {
      documentId,
      text: fullText,
    });

    res.json(result);
  } catch (error) {
    console.error('Embed error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Embed failed' });
  }
});

router.post('/:documentId/chat', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { question, history } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const result = await callAiService('/chat', {
      documentId,
      question: question.trim(),
      history: history || [],
    });

    res.json(result);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Chat failed' });
  }
});

router.get('/:documentId/messages', async (req, res) => {
  try {
    const { documentId } = req.params;

    const messages = await prisma.chatMessage.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        groundedInDocument: true,
        citedClauseId: true,
        createdAt: true,
      },
    });

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export default router;