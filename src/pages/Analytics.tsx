import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessageSquare, 
  UserCheck, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  Bot,
  Filter,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn } from '@/src/lib/utils';
import { generateAnalyticsInsights } from '@/src/services/gemini';

const data = [
  { name: 'Seg', leads: 40, qualified: 24 },
  { name: 'Ter', leads: 30, qualified: 13 },
  { name: 'Qua', leads: 20, qualified: 98 },
  { name: 'Qui', leads: 27, qualified: 39 },
  { name: 'Sex', leads: 18, qualified: 48 },
  { name: 'Sáb', leads: 23, qualified: 38 },
  { name: 'Dom', leads: 34, qualified: 43 },
];

const statusData = [
  { name: 'Novo', value: 400 },
  { name: 'Qualificando', value: 300 },
  { name: 'Qualificado', value: 300 },
  { name: 'Atendimento', value: 200 },
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function Analytics() {
  const [insights, setInsights] = useState<{ title: string; description: string }[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const summary = "Total de conversas: 154. Novos leads: 42. Leads qualificados: 18. Taxa de handoff AI: 85%. Tempo médio de resposta: 2min. Principais objeções: Valor da entrada, Localização.";
      const result = await generateAnalyticsInsights(summary);
      setInsights(result.insights || []);
      setRecommendations(result.recommendations || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Análise de Performance</h1>
            <p className="text-neutral-500 mt-1">Insights em tempo real sobre seus leads e atendimento AI.</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all">
              <Filter className="w-4 h-4" />
              Filtros
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20">
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
            title="Total de Conversas" 
            value="1,284" 
            trend="+12.5%" 
            trendUp={true} 
            icon={MessageSquare} 
          />
          <KPICard 
            title="Leads Qualificados" 
            value="432" 
            trend="+8.2%" 
            trendUp={true} 
            icon={UserCheck} 
          />
          <KPICard 
            title="Taxa de Qualificação" 
            value="33.6%" 
            trend="-2.4%" 
            trendUp={false} 
            icon={TrendingUp} 
          />
          <KPICard 
            title="Tempo Médio Resp." 
            value="1m 42s" 
            trend="-15s" 
            trendUp={true} 
            icon={Clock} 
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h3 className="font-bold text-lg mb-6">Volume de Leads vs Qualificados</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#999'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#999'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="leads" stroke="#10b981" fillOpacity={1} fill="url(#colorLeads)" strokeWidth={2} />
                  <Area type="monotone" dataKey="qualified" stroke="#3b82f6" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h3 className="font-bold text-lg mb-6">Status dos Leads</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {statusData.map((item, i) => (
                <div key={item.name} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-neutral-500">{item.name}</span>
                  </div>
                  <span className="font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Insights Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-600/20 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-6 h-6" />
                <h3 className="text-xl font-bold">Insights Comportamentais (AI)</h3>
              </div>
              
              <div className="space-y-6">
                {loading ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-20 bg-white/10 rounded-2xl" />
                    <div className="h-20 bg-white/10 rounded-2xl" />
                  </div>
                ) : (
                  insights.map((insight, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10">
                      <h4 className="font-bold mb-1">{insight.title}</h4>
                      <p className="text-sm text-emerald-50 leading-relaxed">{insight.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Bot className="w-6 h-6 text-emerald-600" />
              <h3 className="text-xl font-bold">Recomendações para Corretores</h3>
            </div>
            
            <div className="space-y-4">
              {loading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl" />
                  <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl" />
                  <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl" />
                </div>
              ) : (
                recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{rec}</p>
                  </div>
                ))
              )}
            </div>

            <button 
              onClick={fetchInsights}
              className="w-full mt-8 py-3 border-2 border-emerald-600 text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all text-sm uppercase tracking-widest"
            >
              Recalcular Insights
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, trend, trendUp, icon: Icon }: { title: string, value: string, trend: string, trendUp: boolean, icon: any }) {
  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
          <Icon className="w-6 h-6 text-neutral-500" />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
          trendUp ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" : "bg-red-50 text-red-600 dark:bg-red-900/20"
        )}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-sm text-neutral-500 font-medium">{title}</p>
        <h4 className="text-2xl font-bold mt-1">{value}</h4>
      </div>
    </div>
  );
}
