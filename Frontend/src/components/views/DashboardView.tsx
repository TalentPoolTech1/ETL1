import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { fetchKpis } from '@/store/slices/monitorSlice';
import { DataQualityDashboard } from '@/components/advanced/AdvancedFeatures';
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  ShieldCheck,
  BarChart3,
  RefreshCw
} from 'lucide-react';

type MetricStatus = 'good' | 'warning' | 'critical';

export function DashboardView() {
  const dispatch = useAppDispatch();
  const { kpis, loading } = useAppSelector(s => s.monitor);

  useEffect(() => {
    dispatch(fetchKpis());
  }, [dispatch]);

  // Derived metrics based on real KPI data
  const qualityScore = kpis?.successRateToday ?? 90;
  const metricsStatus: MetricStatus = qualityScore > 98 ? 'good' : (qualityScore > 90 ? 'warning' : 'critical');

  const qualityMetrics = [
    { name: 'Workflow Success', value: kpis?.successRateToday ?? 0, target: 99.9, status: metricsStatus },
    { name: 'Data Freshness', value: 0, target: 95, status: 'warning' as MetricStatus },
    { name: 'Processing Volume', value: kpis?.dataVolumeGbToday ?? 0, target: 100, status: 'good' as MetricStatus },
    { name: 'Active Pipelines', value: kpis?.activePipelines ?? 0, target: 10, status: 'good' as MetricStatus },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Platform Overview</h1>
          <p className="text-sm text-neutral-500 mt-1">Real-time health and performance metrics across all projects.</p>
        </div>
        <button 
          onClick={() => dispatch(fetchKpis())}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 active:bg-neutral-100 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary-500' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile 
          icon={Activity} 
          label="Active Pipelines" 
          value={kpis?.activePipelines ?? 0} 
          sub="Registered workflows"
          color="blue"
        />
        <KpiTile 
          icon={CheckCircle2} 
          label="Success Rate" 
          value={`${kpis?.successRateToday?.toFixed(1) ?? 0}%`} 
          sub="Last 24 hours"
          color="emerald"
        />
        <KpiTile 
          icon={AlertCircle} 
          label="Failed Runs" 
          value={kpis?.failedToday ?? 0} 
          sub="Requires attention"
          color="rose"
        />
        <KpiTile 
          icon={Database} 
          label="Data Volume" 
          value={`${kpis?.dataVolumeGbToday?.toFixed(1) ?? 0} GB`} 
          sub="Processed today"
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quality Section */}
        <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary-600" />
              <h2 className="text-sm font-semibold text-neutral-900">Platform Governance</h2>
            </div>
            <button className="text-xs text-primary-600 font-medium hover:underline">View Detailed Report</button>
          </div>
          <div className="p-2">
            <DataQualityDashboard metrics={qualityMetrics} />
          </div>
        </div>

        {/* System Health */}
        <div className="col-span-1 bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-600" />
            <h2 className="text-sm font-semibold text-neutral-900">Compute Resources</h2>
          </div>
          <div className="p-6 space-y-6 flex-1 flex flex-col justify-center">
            {/* Resource utilization derived from real KPIs where possible */}
            <ResourceGauge label="Running Jobs" percent={Math.min(100, (kpis?.runningNow ?? 0) * 20)} color="emerald" />
            <ResourceGauge label="Today's Volume" percent={Math.min(100, (kpis?.dataVolumeGbToday ?? 0))} color="amber" />
            <ResourceGauge label="Success Rate" percent={Math.round(kpis?.successRateToday ?? 0)} color={kpis?.successRateToday && kpis.successRateToday < 90 ? 'rose' : 'emerald'} />
            <ResourceGauge label="SLA Compliance" percent={kpis?.slaBreachesToday === 0 ? 100 : Math.max(0, 100 - (kpis?.slaBreachesToday ?? 0) * 10)} color={kpis?.slaBreachesToday ? 'rose' : 'emerald'} />
          </div>
        </div>
      </div>
    </div>
  );
}


function KpiTile({ icon: Icon, label, value, sub, color }: any) {
  const colors: any = {
    blue:    'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose:    'bg-rose-50 text-rose-600 border-rose-100',
    amber:   'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm flex flex-col justify-between h-32">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg border ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-medium text-neutral-400">{sub}</span>
      </div>
      <div>
        <div className="text-2xl font-bold text-neutral-900">{value}</div>
        <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function ResourceGauge({ label, percent, color }: any) {
  const colors: any = {
    emerald: 'bg-emerald-500',
    amber:   'bg-amber-500',
    rose:    'bg-rose-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-neutral-600">{label}</span>
        <span className="text-neutral-900">{percent}%</span>
      </div>
      <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${colors[color]}`} 
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
