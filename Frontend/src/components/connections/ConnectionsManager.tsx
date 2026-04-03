import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Database, 
  Server, 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical,
  RefreshCw,
  Plug2
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchConnectors, openCreateConnection, selectAllConnectors } from '@/store/slices/connectionsSlice';

export function ConnectionsManager() {
  const dispatch = useAppDispatch();
  const connectorsByTech = useAppSelector(s => s.connections.connectorsByTech);
  const connections = selectAllConnectors(connectorsByTech);
  const loading = useAppSelector(s => s.connections.isLoading);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    dispatch(fetchConnectors());
  }, [dispatch]);

  const getIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('postgres') || t.includes('sql')) return <Database size={18} />;
    if (t.includes('s3') || t.includes('cloud')) return <Cloud size={18} />;
    return <Server size={18} />;
  };

  const filteredConnections = connections.filter(c => 
    c.connectorDisplayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.connectorTypeCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Connections</h1>
          <p className="text-sm text-neutral-500 font-medium">Manage your data sources and destinations</p>
        </div>
        <button onClick={() => dispatch(openCreateConnection(undefined))}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-brand-100 transition-all active:scale-[0.98]">
          <Plus size={18} />
          <span>New Connection</span>
        </button>
      </div>

      <div className="bg-[#161b25] rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input 
              type="text" 
              placeholder="Search connections..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#161b25] border border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all"
            />
          </div>
          <button 
            onClick={() => dispatch(fetchConnectors())}
            className="p-2 hover:bg-neutral-200 rounded-lg text-neutral-500 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
            <p className="text-sm text-neutral-500 font-medium italic">Loading connections...</p>
          </div>
        ) : filteredConnections.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
              <Plug2 className="w-8 h-8 text-neutral-300" />
            </div>
            <h3 className="text-base font-bold text-neutral-900">No connections found</h3>
            <p className="text-sm text-neutral-500 mt-1 max-w-xs">
              {searchQuery ? `No results for "${searchQuery}"` : "Get started by adding your first data connection."}
            </p>
            {!searchQuery && (
              <button className="mt-6 text-brand-600 font-bold text-sm hover:underline">
                Create new connection
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 lg:p-6">
            {filteredConnections.map(conn => {
              const isActive = conn.healthStatusCode === 'HEALTHY';
              const isError = conn.healthStatusCode === 'UNHEALTHY' || conn.healthStatusCode === 'ERROR';

              return (
              <div 
                key={conn.connectorId}
                className="group border border-slate-800 rounded-2xl p-5 hover:border-brand-500 hover:shadow-lg hover:shadow-brand-50 transition-all cursor-pointer bg-[#161b25] relative overflow-hidden"
              >
                {/* Status bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  isActive ? 'bg-success-500' : 
                  isError ? 'bg-danger-500' : 'bg-brand-400'
                }`} />

                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-600 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors`}>
                    {getIcon(conn.connectorTypeCode)}
                  </div>
                  <button className="p-1 px-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 transition-colors">
                    <MoreVertical size={16} />
                  </button>
                </div>

                <div className="mb-4">
                  <h3 className="font-bold text-neutral-900 group-hover:text-brand-700 transition-colors">{conn.connectorDisplayName}</h3>
                  <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mt-0.5">{conn.connectorTypeCode}</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                  <div className="flex items-center gap-1.5">
                    {isActive ? (
                      <CheckCircle2 className="text-success-500" size={14} />
                    ) : isError ? (
                      <AlertCircle className="text-danger-500" size={14} />
                    ) : (
                      <RefreshCw className="text-brand-500" size={14} />
                    )}
                    <span className={`text-[12px] font-bold uppercase tracking-tight ${
                      isActive ? 'text-success-700' : isError ? 'text-danger-700' : 'text-brand-700'
                    }`}>
                      {conn.healthStatusCode || 'UNKNOWN'}
                    </span>
                  </div>
                  <span className="text-[12px] text-neutral-400 font-medium italic">
                    {conn.updatedDtm ? new Date(conn.updatedDtm).toLocaleDateString() : 'Never tested'}
                  </span>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
