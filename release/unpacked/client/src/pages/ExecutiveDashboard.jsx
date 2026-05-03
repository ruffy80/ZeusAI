import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function ExecutiveDashboard() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [modules, setModules] = useState(null);
  const [innovations, setInnovations] = useState([]);
  const [health, setHealth] = useState(null);
  const [growth, setGrowth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    const token = localStorage.getItem('adminToken') || '';
    try {
      const config = { headers: { 'x-auth-token': token } };
      const [statsRes, revenueRes, modulesRes, innovationsRes, healthRes, growthRes] = await Promise.all([
        axios.get('/api/admin/executive/stats', config),
        axios.get('/api/admin/executive/revenue', config),
        axios.get('/api/admin/executive/modules', config),
        axios.get('/api/admin/executive/innovations', config),
        axios.get('/api/admin/executive/health', config),
        axios.get('/api/admin/executive/growth', config)
      ]);

      setStats(statsRes.data);
      setRevenue(revenueRes.data);
      setModules(modulesRes.data);
      setInnovations(innovationsRes.data);
      setHealth(healthRes.data);
      setGrowth(growthRes.data);
    } catch (err) {
      console.error('Eroare la încărcare date:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center p-12">Se încarcă dashboard-ul executiv...</div>;

  const revenueData = [
    { day: 'Luni', value: 1250 },
    { day: 'Marți', value: 1890 },
    { day: 'Miercuri', value: 2100 },
    { day: 'Joi', value: 2450 },
    { day: 'Vineri', value: 2980 },
    { day: 'Sâmbătă', value: 3120 },
    { day: 'Duminică', value: 2870 }
  ];

  const moduleData = [
    { name: 'Active', value: modules?.total || 0, color: '#00ffff' },
    { name: 'Auto-create', value: modules?.autoCreated || 0, color: '#ff00ff' },
    { name: 'În dezvoltare', value: modules?.inDevelopment || 0, color: '#ffaa00' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-5xl font-bold neon-text">📊 Executive Dashboard</h1>
          <p className="text-gray-400 mt-2">Monitorizează evoluția autonomă a Unicornului</p>
          <p className="text-xs text-cyan-400 mt-1">Ultima actualizare: {new Date().toLocaleString()}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-cyan-500/30">
            <div className="text-cyan-400 text-sm mb-2">💰 VENITURI TOTALE</div>
            <div className="text-4xl font-bold text-white">${revenue?.total?.toLocaleString() || 0}</div>
            <div className="text-sm text-gray-400 mt-1">{revenue?.btc?.toFixed(4)} BTC</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-cyan-500/30">
            <div className="text-cyan-400 text-sm mb-2">🧠 MODULE ACTIVE</div>
            <div className="text-4xl font-bold text-white">{modules?.total || 0}</div>
            <div className="text-sm text-gray-400 mt-1">+{modules?.autoCreated || 0} create automat</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-cyan-500/30">
            <div className="text-cyan-400 text-sm mb-2">📈 CREȘTERE</div>
            <div className="text-4xl font-bold text-white">{growth?.users?.toLocaleString() || 0}</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-cyan-500/30">
            <div className="text-cyan-400 text-sm mb-2">🩺 SĂNĂTATE SISTEM</div>
            <div className="text-4xl font-bold text-white">{health?.uptime ? Math.floor(health.uptime / 3600) : 0}h</div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-cyan-500/30">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">📈 Evoluție venituri</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ffff" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#00ffff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', borderColor: '#00ffff' }} />
                <Area type="monotone" dataKey="value" stroke="#00ffff" fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-cyan-500/30">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">📦 Distribuție module</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={moduleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {moduleData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-cyan-500/30">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">🔮 Predicții venituri (30 zile)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats?.predictions?.revenue || []}>
                <XAxis dataKey="day" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#00ffff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-cyan-500/30">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">🏆 Inteligență competiție</h2>
            <div className="space-y-3">
              {stats?.competitors && Object.entries(stats.competitors)
                .filter(([, value]) => typeof value === 'number')
                .map(([name, value]) => (
                  <div key={name} className="flex justify-between items-center">
                    <span className="capitalize">{name}</span>
                    <div className="flex-1 mx-4 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${value}%` }} />
                    </div>
                    <span className="text-sm font-bold">{value}%</span>
                  </div>
                ))}
            </div>
            <p className="text-sm text-gray-400 mt-4">{stats?.competitors?.message}</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 mb-8 border border-cyan-500/30">
          <h2 className="text-xl font-bold mb-4 text-cyan-400">⚠️ Alerte și notificări</h2>
          <div className="space-y-2">
            {(stats?.alerts || []).map((alert, idx) => (
              <div key={idx} className={`p-3 rounded-lg ${alert.type === 'warning' ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-green-500/20 border border-green-500/30'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold">{alert.title}</span>
                  <span className="text-xs text-cyan-400">{alert.action}</span>
                </div>
                <p className="text-sm text-gray-300 mt-1">{alert.message}</p>
              </div>
            ))}
            {(!stats?.alerts || stats.alerts.length === 0) && <p className="text-gray-400 text-center">Nu există alerte noi.</p>}
          </div>
        </div>

        <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 backdrop-blur rounded-2xl p-6 border border-cyan-500/30">
          <h2 className="text-xl font-bold mb-4 text-cyan-400">📈 Proiecții profit</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">${stats?.projectedProfit?.next30?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-400">Următoarele 30 de zile</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">${stats?.projectedProfit?.next90?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-400">Următoarele 90 de zile</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">${stats?.projectedProfit?.next365?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-400">Următoarele 365 de zile</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 mt-8 border border-cyan-500/30">
          <h2 className="text-xl font-bold mb-4 text-cyan-400">💡 Inovații recente</h2>
          <div className="space-y-2">
            {innovations.length > 0 ? innovations.map((inv, idx) => (
              <div key={idx} className="bg-gray-700/50 p-3 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-bold text-cyan-400">{inv.name}</span>
                  <span className="text-xs text-gray-400">{new Date(inv.generatedAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-300 mt-1">{inv.description}</p>
              </div>
            )) : (
              <p className="text-gray-400">Nu există inovații recente.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
