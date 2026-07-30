import express from 'express';
import { matchFlags } from '../flag-engine/index.js';
import { simulateScenario, simulateAllScenarios, SCENARIO_METADATA } from '../scenario-simulator/index.js';
import { computePolicyScore } from '../flag-engine/score.js';
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

// List available scenarios
router.get('/scenarios', (_req, res) => {
  res.json({ scenarios: SCENARIO_METADATA });
});

// Simulate a single scenario
router.post('/documents/:documentId/simulate/:scenarioId', async (req, res) => {
  try {
    const { documentId, scenarioId } = req.params;
    const document = await getDocumentWithClauses(documentId);
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const clauses = document.clauses.map(c => ({
      clauseType: c.clauseType,
      rawText: c.rawText,
      pageNumber: c.pageNumber,
      fieldsJson: c.fieldsJson as Record<string, unknown>,
      confidence: c.confidence,
    }));

    if (clauses.length === 0) {
      return res.status(400).json({ error: 'No extracted clauses found. Run extraction first.' });
    }

    const { flags } = matchFlags(clauses);
    const result = simulateScenario(scenarioId, clauses, flags);

    if (!result) {
      return res.status(404).json({ error: `Scenario '${scenarioId}' not found` });
    }

    res.json(result);
  } catch (error) {
    console.error('Scenario simulate error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Simulation failed' });
  }
});

// Simulate all scenarios for a document
router.post('/documents/:documentId/simulate', async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await getDocumentWithClauses(documentId);
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const clauses = document.clauses.map(c => ({
      clauseType: c.clauseType,
      rawText: c.rawText,
      pageNumber: c.pageNumber,
      fieldsJson: c.fieldsJson as Record<string, unknown>,
      confidence: c.confidence,
    }));

    if (clauses.length === 0) {
      return res.status(400).json({ error: 'No extracted clauses found. Run extraction first.' });
    }

    const { flags } = matchFlags(clauses);
    const results = simulateAllScenarios(clauses, flags);

    res.json({ scenarios: results, documentId });
  } catch (error) {
    console.error('Scenario simulate all error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Simulation failed' });
  }
});

// Compare up to 3 documents
router.post('/documents/compare', async (req, res) => {
  try {
    const { documentIds } = req.body as { documentIds: string[] };
    if (!documentIds || documentIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 document IDs are required' });
    }
    if (documentIds.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 documents can be compared' });
    }

    const docs = await Promise.all(documentIds.map(id => getDocumentWithClauses(id)));
    const missing = docs.findIndex(d => !d);
    if (missing >= 0) {
      return res.status(404).json({ error: `Document ${documentIds[missing]} not found` });
    }

    const results = docs.map(doc => {
      const clauses = doc!.clauses.map(c => ({
        clauseType: c.clauseType,
        rawText: c.rawText,
        pageNumber: c.pageNumber,
        fieldsJson: c.fieldsJson as Record<string, unknown>,
        confidence: c.confidence,
      }));
      const { flags, score } = matchFlags(clauses);
      const policyScore = computePolicyScore(clauses, doc!.insurerName);
      return {
        documentId: doc!.id,
        fileName: doc!.fileName,
        insurerName: doc!.insurerName,
        score: policyScore.score,
        breakdown: score.breakdown,
        settlementRatio: policyScore.settlementRatio,
        flags,
      };
    });

    // Identify materially differing flags
    const allTaxonomyIds = [...new Set(results.flatMap(r => r.flags.map(f => f.taxonomyId)))];
    const flagPresence = allTaxonomyIds.map(taxId => {
      const perDoc = results.map(r => r.flags.find(f => f.taxonomyId === taxId));
      const allSame = perDoc.every(f => f !== undefined) || perDoc.every(f => f === undefined);
      return { taxonomyId: taxId, perDoc, allSame };
    });

    const differingFlags = flagPresence.filter(f => !f.allSame);
    const sameFlags = flagPresence.filter(f => f.allSame);

    res.json({
      documents: results.map(r => ({
        documentId: r.documentId,
        fileName: r.fileName,
        insurerName: r.insurerName,
        score: r.score,
        breakdown: r.breakdown,
        settlementRatio: r.settlementRatio,
      })),
      materiallyDifferentFlags: differingFlags.map(f => ({
        taxonomyId: f.taxonomyId,
        perDocument: results.map(r => {
          const flag = r.flags.find(fl => fl.taxonomyId === f.taxonomyId);
          return flag || null;
        }),
      })),
      identicalFlags: sameFlags.map(f => ({
        taxonomyId: f.taxonomyId,
        commonState: f.perDoc[0] || 'absent',
      })),
      flagsSummary: {
        total: allTaxonomyIds.length,
        differing: differingFlags.length,
        identical: sameFlags.length,
      },
    });
  } catch (error) {
    console.error('Compare error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Compare failed' });
  }
});

// Get a document's full status (for comparison dashboard)
router.get('/documents/:documentId/status', async (req, res) => {
  try {
    const { documentId } = req.params;
    const doc = await getDocumentWithClauses(documentId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const clauses = doc.clauses.map(c => ({
      clauseType: c.clauseType,
      rawText: c.rawText,
      pageNumber: c.pageNumber,
      fieldsJson: c.fieldsJson as Record<string, unknown>,
      confidence: c.confidence,
    }));
    const { flags, score } = matchFlags(clauses);
    const policyScore = computePolicyScore(clauses, doc.insurerName);

    res.json({
      document: {
        id: doc.id, fileName: doc.fileName, insurerName: doc.insurerName,
        status: doc.status, sumInsured: doc.sumInsured,
      },
      score: policyScore.score,
      breakdown: score.breakdown,
      settlementRatio: policyScore.settlementRatio,
      flags,
    });
  } catch (error) {
    console.error('Document status error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get status' });
  }
});

export default router;