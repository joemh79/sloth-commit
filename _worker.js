// SlothCommit — Pages advanced mode worker (_worker.js)
// Handles /api/generate with the project's Workers AI binding (env.AI);
// everything else is served from the static assets (env.ASSETS).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/generate') {
      return handleGenerate(request, env);
    }

    // Static assets, with the same SPA-style fallback the site had before:
    // unknown GET paths return the homepage instead of a bare 404.
    let res = await env.ASSETS.fetch(request);
    if (res.status === 404 && request.method === 'GET') {
      res = await env.ASSETS.fetch(new Request(new URL('/', url), request));
    }
    return res;
  }
};

async function handleGenerate(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    if (!env.AI) {
      return json({ error: 'AI binding missing (env.AI is undefined). Check Pages bindings.' }, 503);
    }
    const body = await request.json();
    const diff = body.diff;
    const style = body.style;
    const withPr = body.withPr;
    if (!diff || typeof diff !== 'string' || diff.length > 12000) {
      return json({ error: 'Invalid diff (max 12k chars).' }, 400);
    }

    const styleGuide = {
      conventional: 'Follow Conventional Commits: type(scope): subject. Types: feat, fix, docs, style, refactor, test, chore.',
      simple: 'Write a short, plain-English summary line under 72 chars. No prefixes.',
      emoji: 'Start the subject with one relevant emoji, then a short summary under 72 chars.'
    }[style] || 'Follow Conventional Commits.';

    const prompt = 'You are SlothCommit, a lazy-but-precise commit message generator. ' + styleGuide + '\n\n' +
      'Rules:\n' +
      '- Subject line: imperative mood, under 72 characters, no trailing period.\n' +
      '- Then a blank line, then 1-3 bullet body lines explaining WHAT changed and WHY (not HOW).\n' +
      '- Never invent file names or details not in the diff. Never add "Co-authored-by".\n' +
      '- Output ONLY the commit message, no commentary, no code fences.\n\n' +
      'Git diff:\n' + diff.slice(0, 8000);

    let ai;
    try {
      ai = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400
      });
    } catch (aiErr) {
      return json({ error: 'AI.run failed: ' + (aiErr.message || aiErr) }, 502);
    }
    let commit = ((ai && ai.response) || '').trim();
    commit = commit.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
    if (!commit) {
      return json({ error: 'AI returned empty response.' }, 502);
    }

    let pr = '';
    if (withPr) {
      const prPrompt = 'Write a concise PR description for this change. Format:\n' +
        '## What changed\n- bullet list\n## Why\n- bullet list\n## Testing\n- bullet list (infer reasonable checks from the diff; mark as suggested if unsure)\n\n' +
        'Keep it under 150 words. No commentary outside the description.\n\n' +
        'Git diff:\n' + diff.slice(0, 6000);
      try {
        const prai = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
          messages: [{ role: 'user', content: prPrompt }],
          max_tokens: 500
        });
        pr = ((prai && prai.response) || '').trim();
      } catch (prErr) {
        pr = '';
      }
    }

    return json({ commit: commit, pr: pr });
  } catch (e) {
    return json({ error: 'Server error: ' + (e.message || e) }, 500);
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(obj, status) {
  if (status === undefined) status = 200;
  const headers = corsHeaders();
  headers['Content-Type'] = 'application/json';
  return new Response(JSON.stringify(obj), { status: status, headers: headers });
}
