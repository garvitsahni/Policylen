import express from 'express';
import { generateGrievanceDraft } from '../grievance/index.js';
import prisma from '../prisma.js';

const router = express.Router();

router.post('/grievance-draft', async (req, res) => {
  try {
    const { documentId, claimantName, reason, amount, date, clauseExcerpt } = req.body;

    if (!claimantName || !reason) {
      return res.status(400).json({ error: 'claimantName and reason are required' });
    }

    let policy: { policyNumber?: string | null; insurerName?: string | null } = {};
    if (documentId) {
      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (doc) {
        policy = { policyNumber: doc.policyNumber, insurerName: doc.insurerName };
      }
    }

    const draft = generateGrievanceDraft({
      policyNumber: policy.policyNumber || null,
      insurerName: policy.insurerName || null,
      claimantName,
      reason: reason || 'rejected / not processed as expected',
      amount: amount || null,
      date: date || null,
      clauseExcerpt: clauseExcerpt || null,
    });

    res.json({
      success: true,
      subject: draft.subject,
      body: draft.body,
      warning: 'This is an editable draft. Review before sending. PolicyLens does not send or file this document.',
    });
  } catch (err) {
    console.error('grievance-draft error:', err);
    res.status(500).json({ error: 'Failed to generate grievance draft' });
  }
});

export default router;