import scamKnowledgeText from '../../../sample_data/luadao.json.txt';
import { audit, demoCustomerId, json } from '../../_lib/core.js';
import { evaluateScamRisk } from '../../_lib/scam-risk.js';
import { buildScamRiskSummary } from '../../_lib/summary-ui.js';

let knowledgeCache;
function knowledge() {
  if (!knowledgeCache) knowledgeCache = JSON.parse(scamKnowledgeText);
  return knowledgeCache;
}

export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json();
    const userRequest = String(body.user_request || '').trim();
    if (!userRequest) return json({ error: 'user_request is required.' }, 400);
    const customerId = await demoCustomerId(env.DB);
    const assessment = evaluateScamRisk(userRequest, knowledge());
    const ui = assessment.level === 'high' ? buildScamRiskSummary(assessment) : null;
    await audit(env.DB, request, {
      type: 'scam_risk_evaluated', customerId, sessionId: body.session_id || null,
      userRequest, aiIntent: 'scam_risk_advisory', executionResult: assessment.level,
      metadata: { risk_level: assessment.level, matched_scam_patterns: assessment.matched_patterns.map((item) => item.id), recommendation: assessment.recommendation },
    });
    return json({ data: assessment, ui });
  } catch (error) {
    return json({ error: error.message || 'Could not evaluate scam risk.' }, 400);
  }
}
