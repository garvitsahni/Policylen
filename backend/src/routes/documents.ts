import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fetch as undiciFetch, FormData as UndiciFormData, Agent as UndiciAgent } from 'undici';
import prisma from '../prisma.js';
import { matchFlags } from '../flag-engine/index.js';
import { computePolicyScore } from '../flag-engine/score.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

const upload = multer({ dest: join(__dirname, '../../uploads') });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

// Helper function with timeout.
// Node's built-in fetch (undici) applies a default 300s headersTimeout that can
// fire before our AbortController timeout. Use undici's own fetch with a
// dedicated Agent whose built-in timeouts are disabled so the AbortController
// is the single authority. (Both must come from the same undici instance.)
const noHeaderTimeoutAgent = new UndiciAgent({ headersTimeout: 0, bodyTimeout: 0 });
const fetchWithTimeout = async (url, options = {}, timeout = 60000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await undiciFetch(url, {
      ...options,
      dispatcher: noHeaderTimeoutAgent,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
};

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const document = await prisma.document.create({
      data: {
        fileName: req.file.originalname,
        status: 'extracting',
      },
    });

    const fs = await import('fs');

    // Step 1: Extract raw text from PDF
    // undici's fetch only recognizes undici's own FormData; the global
    // FormData produces a body FastAPI cannot parse (missing "file" part).
    const formData = new UndiciFormData();
    const fileBuffer = fs.readFileSync(req.file.path);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, req.file.originalname);

    const aiResponse = await fetchWithTimeout(`${AI_SERVICE_URL}/extract`, {
      method: 'POST',
      body: formData,
    }, 60000);

    if (!aiResponse.ok) {
      const error = await aiResponse.json();
      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'failed' },
      });
      return res.status(500).json({ error: error.detail || 'Extraction failed' });
    }

    const { extractedText } = await aiResponse.json();

    // Step 2: Extract structured clauses via AI
    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'analyzing' },
    });

    const clauseTimeout = Number(process.env.CLAUSE_EXTRACTION_TIMEOUT_MS) || 300000;
    const clauseRes = await fetchWithTimeout(`${AI_SERVICE_URL}/extract-clauses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: document.id,
        extractedText,
      }),
    }, clauseTimeout);

    if (!clauseRes.ok) {
      const error = await clauseRes.json();
      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'failed' },
      });
      return res.status(500).json({ error: error.detail || 'Clause extraction failed' });
    }

    const clauseData = await clauseRes.json();

    // Step 3: Fetch stored clauses and run flag engine
    const storedClauses = await prisma.extractedClause.findMany({
      where: { documentId: document.id },
    });

    const flagEngineClauses = storedClauses.map(c => ({
      clauseType: c.clauseType,
      rawText: c.rawText,
      pageNumber: c.pageNumber,
      fieldsJson: c.fieldsJson as Record<string, unknown>,
      confidence: c.confidence,
    }));

    // Find insurer name from extraction
    const extraction = clauseData.extraction || {};
    const insurerName = extraction.insurer_name || null;

    // Update document with insurer and sum insured
    const updateData: Record<string, unknown> = { status: 'analyzed' };
    if (insurerName) updateData.insurerName = insurerName;
    // sum_insured may be a single number or (for plans with SI options per
    // plan) an object listing the options. The DB column is Int, and we never
    // fabricate a figure — only store a real number when one is stated.
    if (typeof extraction.sum_insured === 'number' && Number.isFinite(extraction.sum_insured)) {
      updateData.sumInsured = extraction.sum_insured;
    }

    // Step 4: Run flag matching and scoring
    const { flags: flagEngineFlags, score: flagScore } = matchFlags(flagEngineClauses);
    const policyScore = computePolicyScore(flagEngineClauses, insurerName);

    // Step 5: Store flags in DB
    const storedFlags = [];
    for (const flag of flagEngineFlags) {
      const matchClause = storedClauses.find(c =>
        c.fieldsJson && typeof c.fieldsJson === 'object' &&
        Object.keys(c.fieldsJson as Record<string, unknown>).some(k =>
          flag.explanation.includes(k)
        )
      );

      const stored = await prisma.flag.create({
        data: {
          documentId: document.id,
          clauseId: matchClause?.id || null,
          taxonomyId: flag.taxonomyId,
          colorType: flag.colorType,
          severity: flag.severity || null,
          explanation: flag.explanation,
          rupeeAtRisk: flag.rupeeAtRisk ?? null,
          sourceExcerpt: flag.sourceExcerpt,
        },
      });
      storedFlags.push(stored);
    }

    // Step 6: Store policy health score
    const existingScore = await prisma.policyHealthScore.findUnique({
      where: { documentId: document.id },
    });

    if (existingScore) {
      await prisma.policyHealthScore.update({
        where: { documentId: document.id },
        data: {
          score: policyScore.score,
          breakdown: policyScore.breakdown,
          settlementRatio: policyScore.settlementRatio,
        },
      });
    } else {
      await prisma.policyHealthScore.create({
        data: {
          documentId: document.id,
          score: policyScore.score,
          breakdown: policyScore.breakdown,
          settlementRatio: policyScore.settlementRatio,
        },
      });
    }

    await prisma.document.update({
      where: { id: document.id },
      data: updateData,
    });

    // Step 7: Store retrieval chunks so grounded chat works
    let embedWarning: string | undefined;
    try {
      const embedRes = await fetchWithTimeout(`${AI_SERVICE_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          text: extractedText,
        }),
      }, 60000);
      if (!embedRes.ok) {
        const embedErr = await embedRes.json();
        embedWarning = embedErr.detail || `Embed failed with status ${embedRes.status}`;
      }
    } catch (embedError) {
      embedWarning = embedError instanceof Error ? embedError.message : 'Embed failed';
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      documentId: document.id,
      status: 'analyzed',
      flags: storedFlags,
      score: {
        score: policyScore.score,
        maxScore: policyScore.maxScore,
        breakdown: policyScore.breakdown,
        settlementRatio: policyScore.settlementRatio,
        settlementRatioMatchedInsurer: policyScore.settlementRatioMatchedInsurer,
      },
      insurerName,
      sumInsured: typeof extraction.sum_insured === 'number' ? extraction.sum_insured : null,
      embedWarning,
      message: 'Analysis complete',
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        clauses: true,
        flags: true,
        score: true,
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

export default router;