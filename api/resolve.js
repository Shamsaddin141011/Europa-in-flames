// Vercel serverless function: POST /api/resolve
// Body: { state, orders, turn }
// Returns: { narrative, updated_state, events }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { state, orders, turn } = req.body;
  if (!state || !orders) {
    return res.status(400).json({ error: 'Missing state or orders' });
  }

  const prompt = `You are the impartial referee of a Napoleonic Wars alt-history wargame set in ${state.year} (${state.season}). The 8 factions are France, Britain, Russia, Prussia, Austria, Spain, Ottoman, Naples.

Current game state:
${JSON.stringify(state, null, 2)}

Player orders for Turn ${turn}:
${orders.map(o => `[${o.faction} - ${o.player_name}]: ${o.order_text}`).join('\n\n')}

Resolve this turn with HISTORICAL REALISM. Consider:
- Geography and supply lines
- Army size, treasury, morale
- Realistic outcomes of conflicts (no one-sided miracles unless justified)
- Diplomatic consequences
- Random misfortune (disease, weather, mutiny) where plausible

Be strictly impartial. No faction receives favored treatment. Outcomes follow purely from orders, geography, stats, and plausible historical logic.

Return ONLY valid JSON in this exact format:
{
  "narrative": "A 3-5 paragraph dramatic narrative of what happened this turn, written like a historical chronicle",
  "updated_state": { full updated state object with same structure: factions{}, year, season },
  "events": ["short bullet of key event 1", "key event 2"]
}

Advance the season (Spring->Summer->Autumn->Winter->next year Spring). Update armies, territories, treasury, morale based on what happened. Do not output anything except the JSON.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'Anthropic API error: ' + errText });
    }

    const data = await response.json();
    const text = data.content.filter(c => c.type === 'text').map(c => c.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
