import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { HistoryItem } from '../types';

interface HistoryChartProps {
  history: HistoryItem[];
}

const HistoryChart: React.FC<HistoryChartProps> = ({ history }) => {
  // robustness check: ensure we handle missing nested properties safely
  const data = history.map((item) => ({
    date: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: item.report?.overallScore ?? 0,
    fluency: item.report?.fluency?.score ?? 0,
    grammar: item.report?.grammar?.score ?? 0,
  })).reverse(); // Show oldest to newest

  if (history.length === 0) {
    return <div className="text-gray-400 text-sm text-center py-4">No history available yet.</div>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 10]} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            itemStyle={{ fontSize: '12px' }}
          />
          <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Overall" />
          <Line type="monotone" dataKey="fluency" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Fluency" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistoryChart;