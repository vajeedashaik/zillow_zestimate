'use client';

/**
 * app/monitoring/page.tsx
 *
 * Model Monitoring Dashboard for the Zillow Zestimate stacked ensemble.
 * All data is simulated — mirrors a real production monitoring system.
 *
 * Sections:
 *  1. Overview cards  (RMSE, baseline, drift status, predictions, uptime)
 *  2. RMSE over time  (52-week rolling, threshold at 0.08)
 *  3. Feature drift   (PSI histogram per feature)
 *  4. logerror dist   (baseline vs current overlay)
 *  5. Prediction vol  (30-day bar + 7-day MA)
 *  6. Alert log       (filterable table)
 *  7. Simulate drift event button
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  RMSE_DATA,
  FEATURE_DRIFT,
  LOGERROR_DIST,
  VOLUME_DATA,
  BASE_ALERTS,
  SIMULATED_DRIFT_ALERT,
  OVERVIEW,
  DRIFTED_OVERVIEW,
  type AlertEntry,
} from '@/data/mockMonitoringData';

// Recharts components that must be client-only via dynamic import when needed
const RmseChart       = dynamic(() => import('@/components/monitoring/RmseChart'),       { ssr: false });
const FeatureDriftPanel = dynamic(() => import('@/components/monitoring/FeatureDriftPanel'), { ssr: false });
const AlertLog        = dynamic(() => import('@/components/monitoring/AlertLog'),         { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function statusColor(status: 'OK' | 'Warning' | 'Alert') {
  if (status === 'Alert')   return { dot: 'bg-red-500',   text: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/30' };
  if (status === 'Warning') return { dot: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
  return                           { dot: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' };
}

function RmseGauge({ value, baseline, threshold }: { value: number; baseline: number; threshold: number }) {
  const pct = Math.min(100, ((value - baseline) / (threshold - baseline)) * 100);
  const color = value >= threshold ? '#ef4444' : value >= threshold * 0.95 ? '#f59e0b' : '#22c55e';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Baseline {baseline.toFixed(4)}</span>
        <span>Alert {threshold.toFixed(3)}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(4, pct)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview card
// ─────────────────────────────────────────────────────────────────────────────

function OverviewCard({
  label, value, sub, accent = false, children,
}: {
  label: string; value: string; sub?: string; accent?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className={`bg-gray-900/70 border ${accent ? 'border-amber-500/30' : 'border-gray-800'} rounded-xl p-4 flex flex-col gap-1`}>
      <p className="text-gray-500 text-xs uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-amber-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs">{sub}</p>}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-white font-semibold text-base">{title}</h2>
          {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// logerror distribution chart (inline, no separate file needed)
// ─────────────────────────────────────────────────────────────────────────────

function LogerrorChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={LOGERROR_DIST} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="baselineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6b7280" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="currentGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="bin"
          tick={{ fill: '#6b7280', fontSize: 9 }}
          tickLine={false}
          axisLine={{ stroke: '#374151' }}
          interval={3}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#9ca3af' }}
          formatter={(v: number, name: string) => [v.toFixed(2) + '%', name]}
        />
        <ReferenceLine x="0.000" stroke="#4b5563" strokeDasharray="4 3" strokeWidth={1}
          label={{ value: 'logerror=0', position: 'top', fill: '#4b5563', fontSize: 9 }} />
        <Area type="monotone" dataKey="baseline" name="Baseline"
          stroke="#6b7280" strokeWidth={1.5} fill="url(#baselineGrad)" />
        <Area type="monotone" dataKey="current" name="Current"
          stroke="#f59e0b" strokeWidth={2}   fill="url(#currentGrad)" />
        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prediction volume chart (inline)
// ─────────────────────────────────────────────────────────────────────────────

function VolumeChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={VOLUME_DATA} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#6b7280', fontSize: 9 }}
          tickLine={false}
          axisLine={{ stroke: '#374151' }}
          interval={4}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
        />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#9ca3af' }}
        />
        <Bar dataKey="predictions" name="Predictions" fill="#3b82f6" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
        <Line
          type="monotone"
          dataKey="ma7"
          name="7-day MA"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

interface FeedItem {
  county: string;
  risk: string;
  logerror: number;
  timestamp: string;
  zestimate: number;
}

export default function MonitoringPage() {
  const [drifted, setDrifted]       = useState(false);
  const [alerts, setAlerts]         = useState<AlertEntry[]>(BASE_ALERTS);
  const [simulating, setSimulating] = useState(false);
  const [liveCount, setLiveCount]   = useState<number | null>(null);
  const [feed, setFeed]             = useState<FeedItem[]>([]);

  // Live prediction counter from DynamoDB (AWS)
  useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_COUNT_URL!)
      .then((r) => r.json())
      .then((d) => setLiveCount(d.total ?? d.count ?? null))
      .catch(() => setLiveCount(null));
  }, []);

  // Real-time Firestore feed (GCP)
  useEffect(() => {
    const q = query(
      collection(db, 'predictions'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setFeed(snap.docs.map((d) => d.data() as FeedItem)),
      () => {/* Firestore listener error silently ignored */}
    );
    return () => unsub();
  }, []);

  const overview = drifted ? DRIFTED_OVERVIEW : OVERVIEW;
  const sc       = statusColor(overview.driftStatus);

  function handleSimulateDrift() {
    if (drifted) {
      // Reset
      setDrifted(false);
      setAlerts(BASE_ALERTS);
      return;
    }
    setSimulating(true);
    setTimeout(() => {
      setDrifted(true);
      setAlerts([SIMULATED_DRIFT_ALERT, ...BASE_ALERTS]);
      setSimulating(false);
    }, 900);
  }

  const openCount = alerts.filter((a) => a.status === 'open').length;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Navbar />
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <MonitorIcon />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">
              Model Monitoring
            </h1>
            <p className="text-gray-500 text-xs">
              Zestimate Ensemble · XGBoost + LightGBM + CatBoost + Ridge meta · {overview.modelVersion}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Drift status pill */}
          <div className={`hidden sm:flex items-center gap-2 text-xs border rounded-lg px-3 py-1.5 ${sc.bg}`}>
            <span className={`w-2 h-2 rounded-full ${sc.dot} ${overview.driftStatus !== 'OK' ? 'animate-pulse' : ''}`} />
            <span className={sc.text}>Drift: {overview.driftStatus}</span>
          </div>
          {/* Nav */}
          <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-1.5 transition-all">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Heatmap
          </Link>
          <Link href="/explainer" className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 rounded-lg px-3 py-1.5 transition-all">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
            SHAP Explainer
          </Link>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-screen-2xl mx-auto w-full">

        {/* ── Drift event banner ───────────────────────────────────────── */}
        {drifted && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-5 py-3 flex items-center justify-between gap-4 animate-pulse-once">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <p className="text-red-300 text-sm font-medium">
                Drift event detected — <span className="font-bold">tax_ratio</span> PSI spiked to 0.31 · RMSE crossed alert threshold (0.0819)
              </p>
            </div>
            <button
              onClick={handleSimulateDrift}
              className="text-xs text-red-400 border border-red-500/40 rounded-lg px-3 py-1 hover:bg-red-500/20 transition-colors whitespace-nowrap"
            >
              Reset
            </button>
          </div>
        )}

        {/* ── Live cloud metrics row ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* DynamoDB live counter */}
          <div className="bg-gray-900/70 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-1 lg:col-span-1">
            <p className="text-gray-500 text-xs uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Total predictions served
            </p>
            <p className="text-3xl font-bold text-amber-400">
              {liveCount !== null ? liveCount.toLocaleString() : '—'}
            </p>
            <p className="text-gray-600 text-xs">Live from AWS DynamoDB</p>
          </div>

          {/* Static metrics */}
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 flex flex-col gap-1">
            <p className="text-gray-500 text-xs uppercase tracking-wider">Current CV RMSE</p>
            <p className="text-2xl font-bold text-white">0.0742</p>
            <span className="self-start inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md border bg-green-500/10 border-green-500/30 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />HEALTHY
            </span>
          </div>
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 flex flex-col gap-1">
            <p className="text-gray-500 text-xs uppercase tracking-wider">AWS API Uptime</p>
            <p className="text-2xl font-bold text-white">99.8%</p>
            <p className="text-gray-600 text-xs">Lambda + CloudFront</p>
          </div>
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 flex flex-col gap-1">
            <p className="text-gray-500 text-xs uppercase tracking-wider">GCP Cloud Run</p>
            <p className="text-2xl font-bold text-white">ACTIVE</p>
            <span className="self-start inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md border bg-green-500/10 border-green-500/30 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Running
            </span>
          </div>
        </div>

        {/* ── Live Firestore feed + CloudWatch ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Firestore feed */}
          <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold text-base">Live prediction feed</h2>
                <p className="text-gray-500 text-xs mt-0.5">Updates in real time from GCP Firestore</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            </div>
            {feed.length === 0 ? (
              <p className="text-gray-600 text-sm">No predictions yet — submit one from the Demo page.</p>
            ) : (
              <div className="space-y-2">
                {feed.map((item, i) => {
                  const riskColor =
                    item.risk === 'OVERPRICED'  ? 'text-red-400 bg-red-500/10 border-red-500/30' :
                    item.risk === 'UNDERPRICED' ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' :
                                                  'text-gray-300 bg-gray-700/40 border-gray-600/30';
                  return (
                    <div key={i} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-2.5 text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${riskColor}`}>
                          {item.risk}
                        </span>
                        <span className="text-gray-400">{item.county}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="font-mono">{item.logerror > 0 ? '+' : ''}{(item.logerror ?? 0).toFixed(4)}</span>
                        <span>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CloudWatch link */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-white font-semibold text-base">AWS CloudWatch</h2>
              <p className="text-gray-500 text-xs mt-0.5">Live Lambda metrics &amp; logs</p>
            </div>
            <div className="space-y-3 flex-1">
              <div className="bg-gray-800/40 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                <p className="text-gray-300 font-medium">Prediction Lambda</p>
                <p>Invocations · Errors · Duration · Throttles</p>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                <p className="text-gray-300 font-medium">SES Lambda</p>
                <p>Email delivery rate · Bounce metrics</p>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                <p className="text-gray-300 font-medium">Count Lambda</p>
                <p>DynamoDB read metrics</p>
              </div>
            </div>
            <a
              href="https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors"
            >
              View live AWS CloudWatch metrics →
            </a>
          </div>
        </div>

        {/* ── 1. Overview cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <OverviewCard
            label="Current CV RMSE"
            value={overview.currentRmse.toFixed(4)}
            accent
          >
            <RmseGauge
              value={overview.currentRmse}
              baseline={overview.baselineRmse}
              threshold={overview.alertThreshold}
            />
          </OverviewCard>

          <OverviewCard
            label="Baseline RMSE"
            value={overview.baselineRmse.toFixed(4)}
            sub="Training CV (5-fold)"
          />

          <OverviewCard label="Drift Status" value={overview.driftStatus} sub="PSI across 5 features">
            <div className={`mt-1 inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md border ${sc.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${overview.driftStatus !== 'OK' ? 'animate-pulse' : ''}`} />
              <span className={sc.text}>{openCount} open alert{openCount !== 1 ? 's' : ''}</span>
            </div>
          </OverviewCard>

          <OverviewCard
            label="Total Predictions"
            value={overview.totalPredictions.toLocaleString()}
            sub={`${overview.uptimeDays} days uptime`}
          />

          <OverviewCard
            label="Last Retrained"
            value={overview.lastRetrained}
            sub={`Model ${overview.modelVersion}`}
          />
        </div>

        {/* ── 2. RMSE over time ───────────────────────────────────────── */}
        <Section
          title="Rolling Weekly RMSE"
          subtitle="52-week history · alert threshold at 0.080 · spike visible around weeks W44–W48"
          action={
            <button
              onClick={handleSimulateDrift}
              disabled={simulating}
              className={`flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg border transition-all whitespace-nowrap ${
                drifted
                  ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  : simulating
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-300 cursor-wait'
                  : 'bg-red-500/10 border-red-500/40 text-red-300 hover:bg-red-500/20'
              }`}
            >
              {simulating ? (
                <>
                  <span className="w-3 h-3 border border-orange-400 border-t-transparent rounded-full animate-spin" />
                  Injecting…
                </>
              ) : drifted ? (
                'Reset drift simulation'
              ) : (
                <>
                  <span className="text-red-400">⚡</span>
                  Simulate drift event
                </>
              )}
            </button>
          }
        >
          <RmseChart data={RMSE_DATA} />
        </Section>

        {/* ── 3. Feature drift ────────────────────────────────────────── */}
        <Section
          title="Feature Drift — PSI Analysis"
          subtitle="Population Stability Index per feature · baseline (training) vs current month · PSI > 0.2 triggers alert"
        >
          <FeatureDriftPanel features={FEATURE_DRIFT} drifted={drifted} />

          {/* PSI legend */}
          <div className="flex items-center gap-6 text-xs text-gray-500 border-t border-gray-800 pt-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" /> PSI &lt; 0.10 · No change
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> 0.10–0.20 · Moderate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" /> &gt; 0.20 · Significant drift
            </span>
          </div>
        </Section>

        {/* ── 4 & 5. logerror dist + volume (2-col) ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section
            title="logerror Distribution"
            subtitle="Baseline training distribution vs current-month predictions — right shift = increasing overestimation"
          >
            <LogerrorChart />
          </Section>

          <Section
            title="Prediction Volume"
            subtitle="Daily inference requests over the last 30 days · 7-day moving average overlay"
          >
            <VolumeChart />
          </Section>
        </div>

        {/* ── 6. Alert log ────────────────────────────────────────────── */}
        <Section
          title="Alert Log"
          subtitle={`${alerts.length} alerts recorded · ${openCount} open`}
        >
          <AlertLog alerts={alerts} />
        </Section>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 px-6 py-2 flex items-center justify-between flex-shrink-0">
        <p className="text-gray-600 text-xs">
          Stacked ensemble · XGBoost + LightGBM + CatBoost + Ridge meta · CV RMSE 0.0742
        </p>
        <p className="text-gray-700 text-xs">
          All monitoring data is simulated for showcase purposes
        </p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function MonitorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <polyline points="6 9 9 12 13 8 17 13" />
    </svg>
  );
}
