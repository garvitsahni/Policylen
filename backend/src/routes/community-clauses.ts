import express from 'express';
import { COMMUNITY_CLAUSES } from '../data/community-clauses.js';

const router = express.Router();

router.get('/community-clauses', (req, res) => {
  try {
    const { type, tag, sort } = req.query;

    let filtered = [...COMMUNITY_CLAUSES];

    if (type && typeof type === 'string') {
      filtered = filtered.filter(c => c.clauseType.toLowerCase() === type.toLowerCase());
    }
    if (tag && typeof tag === 'string') {
      filtered = filtered.filter(c => c.tags.includes(tag.toLowerCase()));
    }

    if (sort === 'confirmed') {
      filtered.sort((a, b) => b.confirmedCount - a.confirmedCount);
    } else if (sort === 'impact') {
      const order = { positive: 0, neutral: 1, negative: 2 };
      filtered.sort((a, b) => order[a.averageImpact] - order[b.averageImpact]);
    }

    res.json({
      success: true,
      total: filtered.length,
      clauses: filtered,
      note: 'This is a static seed dataset. Confirmed counts are illustrative and do not reflect actual user voting.',
    });
  } catch (err) {
    console.error('community-clauses error:', err);
    res.status(500).json({ error: 'Failed to load community clauses' });
  }
});

export default router;