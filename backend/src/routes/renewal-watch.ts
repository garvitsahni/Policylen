import express from 'express';
import { MOCK_POLICY_VERSIONS, getRenewalImpact } from '../renewal-watch/index.js';

const router = express.Router();

router.get('/renewal-watch/:documentId', (req, res) => {
  try {
    if (MOCK_POLICY_VERSIONS.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 mock versions for comparison' });
    }

    const v1 = MOCK_POLICY_VERSIONS[0];
    const v2 = MOCK_POLICY_VERSIONS[1];
    const impact = getRenewalImpact(v1, v2);

    res.json({
      success: true,
      documentId: req.params.documentId,
      versions: [v1, v2],
      impact,
      note: 'This is a demo using sample policy data. Replace with actual policy versions in production.',
    });
  } catch (err) {
    console.error('renewal-watch error:', err);
    res.status(500).json({ error: 'Failed to load renewal watch data' });
  }
});

export default router;