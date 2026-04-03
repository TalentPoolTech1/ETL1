import React from 'react';
import { LineageVisualizer } from '@/components/advanced/AdvancedFeatures';
import { Search, Filter, Share2, Download, Maximize2 } from 'lucide-react';

export function LineageExplorer() {
  const mockNodes: any[] = [
    { id: 'src1', name: 'Sales_Records_S3', type: 'source', columns: ['id', 'amount', 'customer_id', 'date'] },
    { id: 'src2', name: 'Customer_Master_Postgres', type: 'source', columns: ['cust_id', 'name', 'email', 'country'] },
    { id: 'tr1', name: 'Join_Normalize', type: 'transform', columns: ['sale_id', 'revenue', 'cust_name', 'region'] },
    { id: 'tgt1', name: 'Regional_Sales_Snowflake', type: 'target', columns: ['sale_id', 'revenue', 'cust_name', 'region', 'processed_at'] },
  ];

  const mockLinks: any[] = [
    { source: 'src1', target: 'tr1', columns: [{ from: 'id', to: 'sale_id' }, { from: 'amount', to: 'revenue' }] },
    { source: 'src2', target: 'tr1', columns: [{ from: 'name', to: 'cust_name' }] },
    { source: 'tr1', target: 'tgt1', columns: [{ from: 'sale_id', to: 'sale_id' }, { from: 'revenue', to: 'revenue' }] },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0f1117] overflow-hidden">
      {/* Toolbar */}
      <div className="h-12 bg-[#161b25] border-b border-slate-700/60 px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search assets..."
              className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-white placeholder-slate-500 w-64 outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded transition-colors">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 text-slate-300 hover:bg-slate-800 rounded-md transition-colors" title="Export Image">
            <Download className="w-4 h-4" />
          </button>
          <button className="p-2 text-slate-300 hover:bg-slate-800 rounded-md transition-colors" title="Share Lineage">
            <Share2 className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button className="p-2 text-slate-300 hover:bg-slate-800 rounded-md transition-colors" title="Fullscreen">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar for Node Info */}
        <div className="w-80 bg-[#161b25] border-r border-slate-700/60 p-6 space-y-6 overflow-y-auto">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Asset Information</h3>
            <div className="p-3 bg-blue-900/20 border border-blue-700/40 rounded-lg">
              <p className="text-sm font-semibold text-white">Regional_Sales_Snowflake</p>
              <p className="text-xs text-blue-300 mt-1">Type: Data Warehouse Table</p>
              <p className="text-xs text-blue-300">Database: SALES_DW</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Downstream Impact</h3>
            <div className="space-y-2">
              <div className="p-2 bg-red-900/20 border border-red-700/40 rounded-md">
                <p className="text-xs font-medium text-white leading-tight">Sales_QBR_Dashboard</p>
                <p className="text-[12px] text-red-400 mt-1">High severity • 12 active users</p>
              </div>
              <div className="p-2 bg-slate-800 border border-slate-700 rounded-md">
                <p className="text-xs font-medium text-slate-200 leading-tight">Monthly_Finance_Sync</p>
                <p className="text-[12px] text-slate-400 mt-1">Low severity • Scheduled daily</p>
              </div>
            </div>
          </div>
        </div>

        {/* Visualizer Canvas */}
        <div className="flex-1 relative overflow-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
          <div className="p-12 min-w-max min-h-full">
             <LineageVisualizer nodes={mockNodes} links={mockLinks} />
          </div>
        </div>
      </div>
    </div>
  );
}
