// src/pages/admin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Users, Video, Music, FileText, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalLiverooms: 0,
    liveLiverooms: 0,
    totalLicks: 0,
    pendingLicks: 0,
    totalReports: 0,
    pendingReports: 0
  });
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsResponse, activitiesResponse] = await Promise.allSettled([
        api.get('/admin/dashboard/stats'),
        api.get('/admin/dashboard/activities?limit=10')
      ]);
      
      // Handle stats response
      if (statsResponse.status === 'fulfilled' && statsResponse.value?.data?.success) {
        setStats(statsResponse.value.data.data);
      } else if (statsResponse.status === 'rejected') {
        console.error('Error fetching dashboard stats:', statsResponse.reason?.response?.data || statsResponse.reason?.message);
      }
      
      // Handle activities response
      if (activitiesResponse.status === 'fulfilled' && activitiesResponse.value?.data?.success) {
        setActivities(activitiesResponse.value.data.data);
      } else if (activitiesResponse.status === 'rejected') {
        console.error('Error fetching dashboard activities:', activitiesResponse.reason?.response?.data || activitiesResponse.reason?.message);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color }) => (
    <div className="bg-gray-800/40 backdrop-blur-xl rounded-xl p-6 border border-gray-700/50 hover:bg-gray-800/60 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <h3 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {value}
          </h3>
          <p className="text-gray-500 text-sm">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
          <Icon size={24} className={color.replace('bg-', 'text-')} />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Dashboard
        </h1>
        <p className="text-gray-400">Overview of your platform statistics</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Users}
          title="Total Users"
          value={(stats.totalUsers || 0).toLocaleString()}
          subtitle={`${(stats.activeUsers || 0).toLocaleString()} active`}
          color="bg-blue-600"
        />
        
        <StatCard
          icon={Video}
          title="Live Rooms"
          value={(stats.totalLiverooms || 0).toLocaleString()}
          subtitle={`${stats.liveLiverooms || 0} currently live`}
          color="bg-purple-600"
        />
        
        <StatCard
          icon={Music}
          title="Licks"
          value={(stats.totalLicks || 0).toLocaleString()}
          subtitle={`${stats.pendingLicks || 0} pending approval`}
          color="bg-green-600"
        />
        
        <StatCard
          icon={FileText}
          title="Reports"
          value={(stats.totalReports || 0).toLocaleString()}
          subtitle={`${stats.pendingReports || 0} pending review`}
          color="bg-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/40 backdrop-blur-xl rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center space-x-2">
              <Clock size={20} className="text-blue-400" />
              <span>Recent Activities</span>
            </h2>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activities.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No recent activities</p>
            ) : (
              activities.map((activity, index) => (
                <div 
                  key={index} 
                  className="flex items-start justify-between py-3 border-b border-gray-700/50 last:border-0"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">{activity.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.timeAgo}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl rounded-xl p-6 border border-gray-700/50">
          <h2 className="text-xl font-bold mb-4">Pending Actions</h2>
          <div className="space-y-3">
            {stats.pendingReports > 0 && (
              <div className="flex items-center justify-between p-4 bg-red-900/20 border border-red-700/30 rounded-lg hover:bg-red-900/30 transition">
                <div>
                  <p className="font-medium text-red-200">
                    {stats.pendingReports} Report{stats.pendingReports !== 1 ? 's' : ''} need review
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Click to review reports</p>
                </div>
                <button 
                  onClick={() => navigate('/admin/reports-management')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Review
                </button>
              </div>
            )}
            {stats.pendingLicks > 0 && (
              <div className="flex items-center justify-between p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg hover:bg-yellow-900/30 transition">
                <div>
                  <p className="font-medium text-yellow-200">
                    {stats.pendingLicks} Lick{stats.pendingLicks !== 1 ? 's' : ''} need approval
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Click to review licks</p>
                </div>
                <button 
                  onClick={() => navigate('/admin/lick-approvement')}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Review
                </button>
              </div>
            )}
            {stats.pendingReports === 0 && stats.pendingLicks === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No pending actions</p>
                <p className="text-gray-600 text-xs mt-2">All items are up to date!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;