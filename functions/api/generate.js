// POST /api/generate — SlothCommit: commit message + PR description via open-weight AI
export async function onRequestPost({ request, env }) {
  try {
    if (!env.AI) {
      return json({ error: 'AI binding missing (env.AI is undefined). Check Pages Functions bindings.' }, 503);
    }
    const { diff, style, withPr } = await request.json();
    if (!diff || typeof diff !== 'string' || diff.length > 12000) {
      return json({ error: 'Invalid diff (max 12k chars).' }, 400);
    }

    const styleGuide = {
      conventional: 'Follow Conventional Commits: type(scope): subject. Types: feat, fix, docs, style, refactor, test, chore.',
      simple: 'Write a short, plain-English summary line under 72 chars. No prefixes.',
      emoji: 'Start the subject with one relevant emoji, then a short summary under 72 chars.'
    }[style] || 'Follow Conventional Commits.';

    const prompt = `You are SlothCommit, a lazy-but-precise commit message generator. ${styleGuide}

Rules:
- Subject line: imperative mood, under 72 characters, no trailing period.
- Then a blank line, then 1-3 bullet body lines explaining WHAT changed and WHY (not HOW).
- Never invent file names or details not in the diff. Never add "Co-authored-by".
- Output ONLY the commit message, no commentary, no code fences.

Git diff:
${diff.slice(0, 8000)}`;

    let ai;
    try {
      ai = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400
      });
    } catch (aiErr) {
      return json({ error: 'AI.run failed: ' + (aiErr.message || aiErr) }, 502);
    }
    const commit = ((ai && ai.response) || '').trim().replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
    if (!commit) {
      return json({ error: 'AI returned empty response.' }, 502);
    }

    let pr = '';
    if (withPr) {
      const prPrompt = `Write a concise PR description for this change. Format:
## What changed
- bullet list
## Why
- bullet list
## Testing
- bullet list (infer reasonable checks from the diff; mark as suggested if unsure)

Keep it under 150 words. No commentary outside the description.

Git diff:
${diff.slice(0, 6000)}`;
      try {
        const prai = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
          messages: [{ role: 'user', content: prPrompt }],
          max_tokens: 500
        });
        pr = ((prai && prai.response) || '').trim();
      } catch (prErr) {
        pr = ''; // PR is optional; don't fail the whole request
      }
    }

    return json({ commit, pr });
  } catch (e) {
    return json({ error: 'Server error: ' + (e.message || e) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
