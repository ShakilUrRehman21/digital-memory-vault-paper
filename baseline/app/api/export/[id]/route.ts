import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decisions, outcomes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id')!;

    const [decision] = await db.select().from(decisions)
      .where(and(eq(decisions.id, id), eq(decisions.userId, userId)))
      .limit(1);

    if (!decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    const [outcome] = await db.select().from(outcomes)
      .where(eq(outcomes.decisionId, id))
      .limit(1);

    // Build HTML for PDF
    const riskColor = decision.riskLevel === 'high' ? '#ff6b6b' : decision.riskLevel === 'medium' ? '#ffd93d' : '#6bcb77';
    const confGap = outcome ? Math.abs(decision.confidenceLevel - outcome.successRating) : null;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, sans-serif; background: #0a0a0a; color: #e8e8e8; padding: 40px; }
    .header { border-bottom: 1px solid #2a2a2a; padding-bottom: 24px; margin-bottom: 32px; }
    .label { display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin-bottom: 4px; }
    .title { font-size: 28px; font-weight: 600; color: #fff; margin-bottom: 12px; }
    .meta { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 12px; }
    .badge { padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 500; background: #1a1a1a; border: 1px solid #2a2a2a; }
    .risk-badge { border-color: ${riskColor}; color: ${riskColor}; }
    .section { margin-bottom: 28px; }
    .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin-bottom: 8px; }
    .section-content { font-size: 14px; line-height: 1.6; color: #ccc; background: #111; border: 1px solid #1e1e1e; border-radius: 6px; padding: 16px; }
    .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; }
    .metric-card { background: #111; border: 1px solid #1e1e1e; border-radius: 6px; padding: 20px; }
    .metric-value { font-size: 36px; font-weight: 700; color: #fff; }
    .metric-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-top: 4px; }
    .score-bar { height: 4px; background: #1a1a1a; border-radius: 2px; margin-top: 12px; overflow: hidden; }
    .score-fill { height: 100%; background: linear-gradient(90deg, #4a9eff, #7b5ea7); border-radius: 2px; }
    .divider { border: none; border-top: 1px solid #1e1e1e; margin: 24px 0; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #1e1e1e; font-size: 11px; color: #444; }
    .calibration { padding: 16px; background: #111; border: 1px solid #1e1e1e; border-radius: 6px; }
    .cal-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .cal-label { font-size: 12px; color: #888; }
    .cal-value { font-size: 14px; color: #e8e8e8; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div class="label">Digital Memory Vault · Decision Report</div>
    <div class="title">${decision.title}</div>
    <div class="meta">
      <span class="badge">${decision.category}</span>
      <span class="badge risk-badge">${decision.riskLevel} risk</span>
      <span class="badge">${decision.emotionalState}</span>
      <span class="badge">${new Date(decision.decisionDate).toLocaleDateString()}</span>
      <span class="badge">${decision.status === 'outcome_recorded' ? 'Outcome Recorded' : 'Pending Outcome'}</span>
    </div>
  </div>

  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-value">${decision.confidenceLevel}/10</div>
      <div class="metric-label">Confidence Level</div>
      <div class="score-bar"><div class="score-fill" style="width: ${decision.confidenceLevel * 10}%"></div></div>
    </div>
    ${outcome ? `<div class="metric-card">
      <div class="metric-value">${outcome.successRating}/10</div>
      <div class="metric-label">Actual Success Rating</div>
      <div class="score-bar"><div class="score-fill" style="width: ${outcome.successRating * 10}%"></div></div>
    </div>` : `<div class="metric-card">
      <div class="metric-value">—</div>
      <div class="metric-label">Awaiting Outcome</div>
    </div>`}
  </div>

  <div class="section">
    <div class="section-label">Description</div>
    <div class="section-content">${decision.description}</div>
  </div>

  <div class="section">
    <div class="section-label">Expected Outcome</div>
    <div class="section-content">${decision.expectedOutcome}</div>
  </div>

  ${outcome ? `
  <div class="section">
    <div class="section-label">Actual Outcome</div>
    <div class="section-content">${outcome.actualOutcome}</div>
  </div>

  <div class="section">
    <div class="section-label">Calibration Analysis</div>
    <div class="calibration">
      <div class="cal-row">
        <div class="cal-label">Confidence</div>
        <div class="cal-value">${decision.confidenceLevel}/10</div>
      </div>
      <div class="cal-row">
        <div class="cal-label">Outcome</div>
        <div class="cal-value">${outcome.successRating}/10</div>
      </div>
      <div class="cal-row">
        <div class="cal-label">Calibration Gap</div>
        <div class="cal-value" style="color: ${confGap! > 3 ? '#ff6b6b' : confGap! > 1 ? '#ffd93d' : '#6bcb77'}">${confGap}</div>
      </div>
      <div class="cal-row">
        <div class="cal-label">Calibration Score</div>
        <div class="cal-value">${Math.max(0, 100 - confGap! * 10)}/100</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Lesson Learned</div>
    <div class="section-content">${outcome.lessonLearned}</div>
  </div>

  <div class="section">
    <div class="section-label">Reflection</div>
    <div class="section-content">${outcome.reflection}</div>
  </div>
  ` : ''}

  <div class="footer">
    Generated by Digital Memory Vault · ${new Date().toLocaleDateString()} · Behavioral Intelligence Dashboard
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="decision-${id.substring(0, 8)}.html"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
