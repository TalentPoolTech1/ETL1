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
    <div className="h-full flex flex-col bg-neutral-50 overflow-hidden">
      {/* Toolbar */}
      <div className="h-12 bg-white border-b border-neutral-200 px-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Search assets..." 
              className="pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded text-xs w-64 focus:ring-1 focus:ring-primary-500 transition-all outline-none"
            />
          </div>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded transition-colors">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-md transition-colors" title="Export Image">
            <Download className="w-4 h-4" />
          </button>
          <button className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-md transition-colors" title="Share Lineage">
            <Share2 className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-neutral-200 mx-1" />
          <button className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-md transition-colors" title="Fullscreen">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar for Node Info */}
        <div className="w-80 bg-white border-r border-neutral-200 p-6 space-y-6 overflow-y-auto">
          <div>
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Asset Information</h3>
            <div className="p-3 bg-primary-50 border border-primary-100 rounded-lg">
              <p className="text-sm font-semibold text-primary-900">Regional_Sales_Snowflake</p>
              <p className="text-xs text-primary-700 mt-1">Type: Data Warehouse Table</p>
              <p className="text-xs text-primary-700">Database: SALES_DW</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Downstream Impact</h3>
            <div className="space-y-2">
              <div className="p-2 bg-rose-50 border border-rose-100 rounded-md">
                <p className="text-xs font-medium text-rose-900 leading-tight">Sales_QBR_Dashboard</p>
                <p className="text-[10px] text-rose-700 mt-1">High severity • 12 active users</p>
              </div>
              <div className="p-2 bg-neutral-50 border border-neutral-200 rounded-md">
                <p className="text-xs font-medium text-neutral-700 leading-tight">Monthly_Finance_Sync</p>
                <p className="text-[10px] text-neutral-500 mt-1">Low severity • Scheduled daily</p>
              </div>
            </div>
          </div>
        </div>

        {/* Visualizer Canvas */}
        <div className="flex-1 relative overflow-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]">
          <div className="p-12 min-w-max min-h-full">
             <LineageVisualizer nodes={mockNodes} links={mockLinks} />
          </div>
        </div>
      </div>
    </div>
  );
}
