// Single source of truth for the evidence base.
// Also feeds the FAQPage schema on /evidence, so the page and its markup
// can never drift apart.

export const lastReviewed = '2026-07-30';

export const claims = [
  {
    claim: 'ChatGPT is replacing Google as the way people find businesses.',
    verdict: 'bad',
    verdictLabel: 'Overstated',
    finding:
      'Every AI chatbot combined — ChatGPT, Gemini, Claude, Copilot, Perplexity — accounts for roughly 0.29% of search referrals. Google still sends about 87.6%. DuckDuckGo on its own sends several times more traffic than all the AI assistants put together.',
    soDoWhat:
      'Do not rebuild your strategy around AI referral traffic yet. Within that small slice, ChatGPT sends about 74.8% and Perplexity punches far above its user share, so if you do chase it, chase those two.',
    source: 'Search engine market share 2026, TechnologyChecker; SE Ranking AI traffic study',
    href: 'https://technologychecker.io/blog/search-engine-market-share',
  },
  {
    claim: 'AI Overviews are costing you clicks on Google itself.',
    verdict: 'ok',
    verdictLabel: 'Supported',
    finding:
      'Every serious study agrees on direction and argues about size. Amsive measured -15.5% across 700,000 keywords, Pew -46.7% across 68,000 queries, Seer -61% across 2.43 billion impressions. CTR bottomed at 1.3% in December 2025 and recovered to 2.4% by February 2026, but a roughly 37% gap between AI-Overview-present and absent results is now the baseline.',
    soDoWhat:
      'This is the real problem, and it is happening inside Google rather than outside it. Measure your own exposure in Search Console before buying any solution.',
    source: 'Ahrefs; Pew Research; Seer Interactive; Search Engine Land',
    href: 'https://ahrefs.com/blog/ai-overviews-reduce-clicks/',
  },
  {
    claim: 'Every business is equally exposed to AI Overviews.',
    verdict: 'bad',
    verdictLabel: 'False',
    finding:
      'Informational queries trigger an AI Overview as often as 89% of the time. E-commerce and transactional queries trigger one only 3-4% of the time.',
    soDoWhat:
      'If your traffic is how-to posts and guides, you have an urgent problem. If it is product and service pages with buying intent, you have almost none. Check which you are before spending anything.',
    source: 'Aggregated AI Overview trigger-rate analyses, 2026',
    href: 'https://searchengineland.com/google-ai-overviews-ctr-recovery-study-475566',
  },
  {
    claim: 'You need an llms.txt file.',
    verdict: 'bad',
    verdictLabel: 'Theatre',
    finding:
      'Ahrefs analysed server logs from 137,000 domains and found 97% of llms.txt files received zero AI crawler requests in May 2026. GPTBot fetched 4.51% of them, ClaudeBot 0.80%. On 15 June 2026 Google stated plainly that llms.txt is not used by Google Search — not for rankings, not for AI Overviews. Adoption is around 10% of sites and rising, which tells you about marketing, not about crawlers.',
    soDoWhat:
      'It costs ten minutes, so publish one if you like — it is plausibly useful for autonomous agents navigating your site. But if an agency lists it as a deliverable, ask them what else is on the invoice.',
    source: 'Ahrefs server-log study, June 2026; Google AI optimisation guidance',
    href: 'https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/',
  },
  {
    claim: 'Schema markup gets you cited by AI.',
    verdict: 'mid',
    verdictLabel: 'Contested',
    finding:
      'BrightEdge found structured data plus FAQ blocks lifted AI citations 44%. A 73-site analysis found 3.2x more citations with valid schema. Ahrefs found no correlation at all. Google says no special schema is needed for AI Overviews or AI Mode; Bing confirms schema helps Copilot.',
    soDoWhat:
      'Treat schema as hygiene, not leverage. If your fundamentals are weak, schema will not rescue them. If they are strong, schema is cheap insurance and it definitely helps Bing and Copilot.',
    source: 'BrightEdge; Ahrefs; Fischman, SSRN cross-platform study',
    href: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6284518',
  },
  {
    claim: 'How you structure a page changes whether it gets quoted.',
    verdict: 'ok',
    verdictLabel: 'Supported',
    finding:
      'This is where the evidence is strongest and the industry talks least. Tables are extracted far more reliably than the same facts in prose. Adding statistics is associated with roughly 22% higher AI visibility and adding quotations roughly 37%. Sequential heading structure correlates with about 2.8x higher citation odds. Around 44% of ChatGPT citations come from the first 30% of a page.',
    soDoWhat:
      'This is the highest-return work available and it is almost entirely editorial. Answer in the first paragraph, put facts in tables, cite figures, order your headings properly.',
    source: 'Frase AEO research synthesis, 2026',
    href: 'https://www.frase.io/blog/what-is-answer-engine-optimization-the-complete-guide-to-getting-cited-by-ai',
  },
  {
    claim: 'AEO is a different discipline that replaces SEO.',
    verdict: 'mid',
    verdictLabel: 'Half true',
    finding:
      'The technical foundation is identical: crawlable, fast, well-structured, authoritative pages. What differs is the target. SEO competes for a click; AEO competes for the sentence the model produces and the source it credits. In practice most AEO wins are things a good SEO would have done anyway.',
    soDoWhat:
      'Be suspicious of anyone selling AEO as a separate product line with a separate invoice. It is a shift in emphasis, not a new stack.',
    source: 'Contently AEO definition guide, February 2026',
    href: 'https://contently.com/2026/02/03/what-is-aeo-answer-engine-optimization/',
  },
  {
    claim: 'Under $1,500 a month buys you real AEO work.',
    verdict: 'bad',
    verdictLabel: 'Unlikely',
    finding:
      'Market rates in 2026 run $2,000-$15,000 per month, with growth-stage engagements typically $3,000-$8,000 and enterprise scopes starting near $15,000. Monitoring tooling alone runs $200-$500 per month. Below roughly $1,500 you are generally buying rebranded SEO with new vocabulary.',
    soDoWhat:
      'Cheap is the tell. Ask any prospective agency which of the claims on this page they believe, and what they would refuse to sell you.',
    source: 'HumansWith.ai; Outreach Bloom AEO/GEO pricing surveys 2026',
    href: 'https://humanswith.ai/blog/what-aeo-and-geo-actually-cost-in-2026/',
  },
];

export const verdictCounts = claims.reduce((acc, c) => {
  acc[c.verdict] = (acc[c.verdict] || 0) + 1;
  return acc;
}, {});
