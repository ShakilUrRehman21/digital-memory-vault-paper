'use client';

import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts';

interface Props {
    analytics: {
        confidenceVsOutcome: Array<{ confidence: number; outcome: number; title: string; date: string }>;
        monthlyTrend: Array<{ month: string; count: number; avgScore: number }>;
        emotionalDistribution: Record<string, number>;
        riskDistribution: Record<string, number>;
        decisionsByCategory: Record<string, number>;
    };
}

const COLORS = ['#0284c7', '#7c3aed', '#059669', '#b7791f', '#dc2626'];

const TOOLTIP_STYLE = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    color: '#0f172a',
    fontSize: 12,
    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)',
};

export default function AnalyticsCharts({ analytics }: Props) {
    const emotionalData = Object.entries(analytics.emotionalDistribution).map(([name, value]) => ({ name, value }));
    const categoryData = Object.entries(analytics.decisionsByCategory).map(([name, value]) => ({ name, value }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Confidence vs Outcome Scatter */}
            <div className="card">
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Confidence vs Outcome Scatter
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    Each point represents one completed decision. Ideal calibration aligns along the diagonal.
                </div>
                {analytics.confidenceVsOutcome.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No completed decisions recorded yet
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis
                                dataKey="confidence"
                                type="number"
                                domain={[0, 10]}
                                name="Confidence"
                                label={{ value: 'Confidence Level', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 11 }}
                                tick={{ fill: '#64748b', fontSize: 11 }}
                            />
                            <YAxis
                                dataKey="outcome"
                                type="number"
                                domain={[0, 10]}
                                name="Outcome"
                                label={{ value: 'Outcome', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                                tick={{ fill: '#64748b', fontSize: 11 }}
                            />
                            <Tooltip
                                contentStyle={TOOLTIP_STYLE}
                                cursor={{ stroke: '#cbd5e1' }}
                                content={({ active, payload }) => {
                                    if (active && payload?.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div style={{ ...TOOLTIP_STYLE, padding: '10px 14px' }}>
                                                <div style={{ fontWeight: 600, marginBottom: 4, maxWidth: 200, color: '#0f172a' }}>{d.title}</div>
                                                <div style={{ color: '#0284c7' }}>Confidence: {d.confidence}/10</div>
                                                <div style={{ color: '#059669' }}>Outcome: {d.outcome}/10</div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Scatter name="Decisions" data={analytics.confidenceVsOutcome} fill="#0284c7" fillOpacity={0.8} />
                        </ScatterChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="grid-2">
                {/* Monthly Calibration Trend */}
                <div className="card">
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Calibration Score Trend
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        Average calibration score per month (0–100)
                    </div>
                    {analytics.monthlyTrend.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>No trend data yet</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={analytics.monthlyTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                <Line type="monotone" dataKey="avgScore" stroke="#059669" strokeWidth={2.5} dot={{ fill: '#059669', r: 4 }} name="Avg Score" />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Emotional State Breakdown */}
                <div className="card">
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Emotional State at Decision
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        Distribution of emotional conditions
                    </div>
                    {emotionalData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>No data yet</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={emotionalData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                                    {emotionalData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Decisions by Category */}
            <div className="card">
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Decisions by Domain
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    Volume across core strategic categories
                </div>
                {categoryData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>No data yet</div>
                ) : (
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={categoryData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                            <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} name="Decisions" />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
