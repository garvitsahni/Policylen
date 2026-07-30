interface SimplifyRule {
  test: (text: string) => boolean;
  extract: (text: string) => string;
  rewrite: (value: string) => string;
}

const RULES: SimplifyRule[] = [
  {
    test: (t) => /co-payment|co.pay/i.test(t) && /no\s/i.test(t),
    extract: () => '',
    rewrite: () => 'You do not have to pay a share of the bills. The insurer covers the full amount of approved claims.',
  },
  {
    test: (t) => /co-payment|co.pay/i.test(t),
    extract: (t) => { const m = t.match(/(\d+)/); return m ? m[1] : ''; },
    rewrite: (v) => v
      ? `Every time you make a claim, you pay ${v}% of the bill yourself. The insurer pays the other ${100 - parseInt(v)}%.`
      : 'You have to pay a share of every bill from your own pocket.',
  },
  {
    test: (t) => /room rent/i.test(t) && /no/i.test(t),
    extract: () => '',
    rewrite: () => 'No limit on room rent. You can choose any room category without the insurer reducing your claim.',
  },
  {
    test: (t) => /proportionate|deduc/i.test(t) && /room/i.test(t),
    extract: () => '',
    rewrite: () => 'If you pick a hospital room that costs more than what the policy covers, the insurer can reduce what they pay for your entire bill — not just the room. Always check the room category before getting admitted.',
  },
  {
    test: (t) => /room rent/i.test(t),
    extract: () => '',
    rewrite: () => 'The policy limits how much it will pay per day for your hospital room. If you choose a costlier room, the insurer may pay less of your overall bill.',
  },
  {
    test: (t) => /waiting period/i.test(t) && /no/i.test(t),
    extract: () => '',
    rewrite: () => 'No waiting period. You can claim from day one.',
  },
  {
    test: (t) => /waiting period/i.test(t),
    extract: (t) => { const m = t.match(/(\d+)\s*(?:-|\s)?(month|year)s?/i); if (!m) return ''; const n = parseInt(m[1]); const u = m[2].toLowerCase(); return n + ' ' + u + (n !== 1 ? 's' : ''); },
    rewrite: (v) => v
      ? `You need to wait ${v} after buying the policy before you can claim for certain conditions. Any claims during this period will be rejected.`
      : 'There is a waiting period before some claims are accepted.',
  },
  {
    test: (t) => /sub.?limit/i.test(t) && /no/i.test(t),
    extract: () => '',
    rewrite: () => 'No sub-limits on any procedure. The full sum insured is available for all treatments.',
  },
  {
    test: (t) => /sub.?limit/i.test(t),
    extract: (t) => {
  const m = t.match(/(?:cataract|hernia|knee|hip|joint|surgery)/i);
  if (!m) return '';
  const after = t.slice(m.index + m[0].length);
  const numMatch = after.match(/[\s\S]{0,30}?₹?\s*(\d[\d,]*)/);
  return numMatch ? `₹${numMatch[1]}` : '';
},
    rewrite: (v) => v
      ? `The total coverage may be large, but the policy only pays up to ${v} for this specific procedure. If it costs more, you pay the rest.`
      : 'There is a cap on what the policy pays for certain specific treatments, regardless of your total coverage.',
  },
  {
    test: (t) => /matern/i.test(t) && /exclud|not|never/i.test(t),
    extract: () => '',
    rewrite: () => 'Pregnancy, delivery, and newborn care are never covered by this policy — no matter how long you hold it.',
  },
  {
    test: (t) => /matern/i.test(t),
    extract: () => '',
    rewrite: () => 'Maternity coverage may be available, but check the waiting period and any sub-limits that apply.',
  },
  {
    test: (t) => /permanent exclusion/i.test(t),
    extract: () => '',
    rewrite: () => 'This is something the policy will never cover, no matter how long you have it. These are listed in the policy exclusions.',
  },
  {
    test: (t) => /cashless/i.test(t),
    extract: () => '',
    rewrite: () => 'The insurer pays the hospital directly, so you do not need to pay upfront and then claim reimbursement.',
  },
  {
    test: (t) => /restoration|restore benefit/i.test(t),
    extract: () => '',
    rewrite: () => 'If you use up your full coverage amount in a year, it gets topped back up for claims later in the same year. Like a refill.',
  },
  {
    test: (t) => /settlement ratio|icr|incurred claim ratio/i.test(t),
    extract: (t) => { const m = t.match(/(\d+)/); return m ? m[1] : ''; },
    rewrite: (v) => v
      ? `This insurer paid out ${v}% of premiums as claims. Higher is better — it means they actually pay when people claim.`
      : 'This is the percentage of premiums the insurer paid back as claims.',
  },
  {
    test: (t) => /irdai|ir dai/i.test(t),
    extract: () => '',
    rewrite: () => 'The government body that regulates all insurance companies in India — the insurance watchdog.',
  },
  {
    test: (t) => /reimbursement/i.test(t),
    extract: () => '',
    rewrite: () => 'You pay the hospital first, then the insurer pays you back after you submit the bills.',
  },
  {
    test: (t) => /not stated|not mentioned/i.test(t),
    extract: () => '',
    rewrite: () => 'This information was not found anywhere in the policy document that was provided.',
  },
];

export function simplifyExplanation(text: string): string {
  if (!text || text.trim().length === 0) return '';

  for (const rule of RULES) {
    if (rule.test(text)) {
      const value = rule.extract(text);
      let result = rule.rewrite(value);

      if (result.length > 600) {
        result = result.slice(0, 597) + '...';
      }
      if (!result.endsWith('.') && !result.endsWith('!') && !result.endsWith('?')) {
        result += '.';
      }
      return result.charAt(0).toUpperCase() + result.slice(1);
    }
  }

  let result = text;

  const generic: Array<[RegExp, string]> = [
    [/\bis\s+applicable\b/gi, 'applies'],
    [/\bin\s+accordance\s+with\b/gi, 'as per'],
    [/\bnotwithstanding\b/gi, 'even though'],
    [/\bsubsequent\s+to\b/gi, 'after'],
    [/\bprior\s+to\b/gi, 'before'],
    [/\bfor\s+the\s+purpose\s+of\b/gi, 'for'],
    [/\bwith\s+effect\s+from\b/gi, 'starting from'],
    [/\bin\s+the\s+event\s+of\b/gi, 'if'],
  ];

  for (const [pattern, replacement] of generic) {
    result = result.replace(pattern, replacement);
  }

  result = result.replace(/\s+/g, ' ').trim();
  if (result.length > 600) result = result.slice(0, 597) + '...';
  if (!result.endsWith('.') && !result.endsWith('!') && !result.endsWith('?')) result += '.';
  if (result.length === 0) return '';
  return result.charAt(0).toUpperCase() + result.slice(1);
}