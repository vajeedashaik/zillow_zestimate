'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import HeatmapSidebar, {
  DEFAULT_FILTERS,
  type FilterState,
} from '@/components/HeatmapSidebar';
import { PROPERTIES } from '@/data/mockGeoData';

const GeoHeatmap = dynamic(() => import('@/components/GeoHeatmap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900/50 rounded-xl border border-gray-800">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">Loading map…</p>
      </div>
    </div>
  ),
});

export default function HeatmapPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const filteredCount = PROPERTIES.filter(
    (p) =>
      (filters.counties.length === 0 || filters.counties.includes(p.county)) &&
      p.logerror >= filters.logerrorRange[0] &&
      p.logerror <= filters.logerrorRange[1] &&
      p.property_age >= filters.propertyAgeRange[0] &&
      p.property_age <= filters.propertyAgeRange[1]
  ).length;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Navbar />

      {/* Sub-header */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0 bg-gray-900/40">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">Zestimate Error Heatmap</h1>
            <p className="text-gray-500 text-xs">
              logerror = log(Zestimate) − log(SalePrice) · Southern California · 2016
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Ensemble: XGBoost + LightGBM + CatBoost · Ridge meta-model</span>
        </div>
      </div>

      {/* Note about sample */}
      <div className="px-6 py-2 bg-blue-500/5 border-b border-blue-500/10 text-center">
        <p className="text-blue-400 text-xs">
          Based on 12,500 representative sample properties across 25 KMeans spatial clusters
        </p>
      </div>

      {/* Body: Sidebar + Map */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 flex-shrink-0 border-r border-gray-800 bg-gray-900/60 p-5 overflow-y-auto">
          <HeatmapSidebar
            filters={filters}
            onChange={setFilters}
            filteredCount={filteredCount}
          />
        </aside>
        <main className="flex-1 p-4 min-w-0">
          <div className="w-full h-full">
            <GeoHeatmap filters={filters} />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-2 flex items-center justify-between flex-shrink-0">
        <p className="text-gray-600 text-xs">
          25 KMeans spatial clusters · {PROPERTIES.length.toLocaleString()} simulated properties ·
          FIPS 6037 (LA) · 6059 (Orange) · 6111 (Ventura)
        </p>
        <p className="text-gray-700 text-xs">SHAP explainability via XGBoost TreeExplainer</p>
      </footer>
    </div>
  );
}
