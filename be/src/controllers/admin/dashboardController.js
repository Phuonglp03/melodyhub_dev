import User from '../../models/User.js';
import Lick from '../../models/Lick.js';
import ContentReport from '../../models/ContentReport.js';
import LiveRoom from '../../models/LiveRoom.js';

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard/stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Get total users and active users
    const totalUsers = await User.countDocuments({ roleId: 'user' });
    const activeUsers = await User.countDocuments({ 
      roleId: 'user',
      isActive: true 
    });

    // Get total liverooms and live liverooms
    const totalLiverooms = await LiveRoom.countDocuments();
    const liveLiverooms = await LiveRoom.countDocuments({ status: 'live' });

    // Get total licks and pending licks
    const totalLicks = await Lick.countDocuments();
    const pendingLicks = await Lick.countDocuments({ status: 'pending' });

    // Get total reports and pending reports
    const totalReports = await ContentReport.countDocuments();
    const pendingReports = await ContentReport.countDocuments({ 
      status: 'pending' 
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalLiverooms,
        liveLiverooms,
        totalLicks,
        pendingLicks,
        totalReports,
        pendingReports
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

/**
 * Get recent activities
 * GET /api/admin/dashboard/activities
 */
export const getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get recent user registrations
    const recentUsers = await User.find({ roleId: 'user' })
      .select('username displayName createdAt')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Get recent licks
    const recentLicks = await Lick.find()
      .populate('userId', 'username displayName')
      .select('title status createdAt')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Get recent reports
    const recentReports = await ContentReport.find()
      .populate('reporterId', 'username displayName')
      .select('targetContentType reason status createdAt')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Combine and sort all activities by createdAt
    const activities = [
      ...recentUsers.map(user => ({
        type: 'user_registered',
        title: 'User registered',
        description: `${user.displayName} (@${user.username})`,
        timestamp: user.createdAt
      })),
      ...recentLicks.map(lick => ({
        type: 'lick_created',
        title: 'Lick created',
        description: `${lick.title} by ${lick.userId?.displayName || 'Unknown'}`,
        timestamp: lick.createdAt
      })),
      ...recentReports.map(report => ({
        type: 'report_created',
        title: 'Report created',
        description: `${report.targetContentType} reported by ${report.reporterId?.displayName || 'Unknown'}`,
        timestamp: report.createdAt
      }))
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
      .map(activity => ({
        ...activity,
        timeAgo: getTimeAgo(activity.timestamp)
      }));

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities'
    });
  }
};

/**
 * Helper function to calculate time ago
 */
function getTimeAgo(date) {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''} ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks !== 1 ? 's' : ''} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
}

