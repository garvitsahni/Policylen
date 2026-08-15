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

// The full analysis pipeline, run in the background after the upload request
// responds. The frontend polls GET /:id/status for progress instead of
// blocking on a single synchronous request (which previously showed a fake
// animation for 10+ minutes while free-tier LLM extraction ran).
async function runAnalysisPipeline(documentId: string, filePath: string, originalName: string): Promise<void> {
  const fs = await import('fs');

  try {
    // Step 1: Extract raw text from PDF
    // undici's fetch only recognizes undici's own FormData; the global
    // FormData produces a body FastAPI cannot parse (missing "file" part).
    const formData = new UndiciFormData();
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, originalName);

    const aiResponse = await fetchWithTimeout(`${AI_SERVICE_URL}/extract`, {
      method: 'POST',
      body: formData,
    }, 60000);

    if (!aiResponse.ok) {
      const error = await aiResponse.json();
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'failed' },
      });
      console.error('Extraction failed:', error);
      return;
    }

    const { extractedText } = await aiResponse.json();

    // Step 2: Extract structured clauses via AI
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'analyzing' },
    });

    const clauseTimeout = Number(process.env.CLAUSE_EXTRACTION_TIMEOUT_MS) || 300000;
    const clauseRes = await fetchWithTimeout(`${AI_SERVICE_URL}/extract-clauses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId,
        extractedText,
      }),
    }, clauseTimeout);

    if (!clauseRes.ok) {
      const error = await clauseRes.json();
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'failed' },
      });
      console.error('Clause extraction failed:', error);
      return;
    }

    const clauseData = await clauseRes.json();

    // Step 3: Fetch stored clauses and run flag engine
    const storedClauses = await prisma.extractedClause.findMany({
      where: { documentId },
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
    const { flags: flagEngineFlags } = matchFlags(flagEngineClauses);
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
          documentId,
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
      where: { documentId },
    });

    if (existingScore) {
      await prisma.policyHealthScore.update({
        where: { documentId },
        data: {
          score: policyScore.score,
          breakdown: policyScore.breakdown,
          settlementRatio: policyScore.settlementRatio,
        },
      });
    } else {
      await prisma.policyHealthScore.create({
        data: {
          documentId,
          score: policyScore.score,
          breakdown: policyScore.breakdown,
          settlementRatio: policyScore.settlementRatio,
        },
      });
    }

    await prisma.document.update({
      where: { id: documentId },
      data: updateData,
    });

    // Step 7: Store retrieval chunks so grounded chat works
    try {
      const embedRes = await fetchWithTimeout(`${AI_SERVICE_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          text: extractedText,
        }),
      }, 60000);
      if (!embedRes.ok) {
        const embedErr = await embedRes.json();
        console.error('Embed failed:', embedErr.detail || `Embed failed with status ${embedRes.status}`);
      }
    } catch (embedError) {
      console.error('Embed failed:', embedError);
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);
    console.log(`Analysis complete for document ${documentId}`);
  } catch (error) {
    console.error('Analysis pipeline error:', error);
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'failed' },
      });
    } catch (_) {
      // document may not exist if this raced a deletion
    }
    try {
      fs.unlinkSync(filePath);
    } catch (_) {
      // file may already be gone
    }
  }
}

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

    // Respond immediately with the document id and initial status; the heavy
    // pipeline (raw extract → LLM clause extraction → flag engine → embed)
    // runs in the background and the frontend polls /:id/status for progress.
    res.status(202).json({
      documentId: document.id,
      status: 'extracting',
    });

    runAnalysisPipeline(document.id, req.file.path, req.file.originalname).catch((err) => {
      console.error('Unhandled pipeline error:', err);
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Polling endpoint the frontend uses to track the background pipeline.
router.get('/:id/status', async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { flags: true, score: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.status !== 'analyzed') {
      return res.json({ documentId: document.id, status: document.status });
    }

    const flags = document.flags;
    const score = document.score;

    res.json({
      documentId: document.id,
      status: 'analyzed',
      flags,
      score: score ? {
        score: score.score,
        maxScore: 100,
        breakdown: score.breakdown,
        settlementRatio: score.settlementRatio,
      } : null,
      insurerName: document.insurerName,
      sumInsured: document.sumInsured,
    });
  } catch (error) {
    console.error('Document status error:', error);
    res.status(500).json({ error: 'Failed to fetch document status' });
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