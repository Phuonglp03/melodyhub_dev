// src/pages/admin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Users, Video, Music, FileText } from 'lucide-react';
import api from '../../../services/api';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalLiverooms: 0,
    activeLiverooms: 0,
    totalLicks: 0,
    pendingLicks: 0,
    totalReports: 0,
    pendingReports: 0
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/admin/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Fallback dummy data
      setStats({
        totalUsers: 1250,
        activeUsers: 892,
        totalLiverooms: 45,
        activeLiverooms: 12,
        totalLicks: 3420,
        pendingLicks: 38,
        totalReports: 156,
        pendingReports: 23
      });
    }
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color }) => (
    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-6 hover:bg-opacity-70 transition">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <h3 className="text-3xl font-bold mb-2">{value}</h3>
          <p className="text-gray-500 text-sm">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Users}
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          subtitle={`${stats.activeUsers} active`}
          color="bg-blue-600"
        />
        
        <StatCard
          icon={Video}
          title="Live Rooms"
          value={stats.totalLiverooms}
          subtitle={`${stats.activeLiverooms} currently live`}
          color="bg-purple-600"
        />
        
        <StatCard
          icon={Music}
          title="Licks"
          value={stats.totalLicks.toLocaleString()}
          subtitle={`${stats.pendingLicks} pending approval`}
          color="bg-green-600"
        />
        
        <StatCard
          icon={FileText}
          title="Reports"
          value={stats.totalReports}
          subtitle={`${stats.pendingReports} pending review`}
          color="bg-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 bg-opacity-40 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Recent Activities</h2>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-700">
                <div>
                  <p className="text-sm">User registered</p>
                  <p className="text-xs text-gray-400">2 minutes ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 bg-opacity-40 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Pending Actions</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-900 bg-opacity-20 rounded-lg">
              <span>{stats.pendingReports} Reports need review</span>
              <button className="px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-700">
                Review
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-900 bg-opacity-20 rounded-lg">
              <span>{stats.pendingLicks} Licks need approval</span>
              <button className="px-3 py-1 bg-yellow-600 rounded text-sm hover:bg-yellow-700">
                Review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;