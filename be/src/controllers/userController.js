import User from '../models/User.js';
import Post from '../models/Post.js';
import PostLike from '../models/PostLike.js';
import PostComment from '../models/PostComment.js';
import UserFollow from '../models/UserFollow.js';
import cloudinary, { uploadImage } from '../config/cloudinary.js';
import { notifyUserFollowed } from '../utils/notificationHelper.js';
import { normalizeAvatarUrl } from '../constants/userConstants.js';

// Get current user profile (authenticated user)
export const getCurrentUserProfile = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware

    const user = await User.findById(userId).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's post count
    const postCount = await Post.countDocuments({ 
      userId,
      $or: [
        { moderationStatus: 'approved' },
        { moderationStatus: { $exists: false } },
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          birthday: user.birthday,
          gender: user.gender,
          addressLine: user.addressLine,
          provinceCode: user.provinceCode,
          provinceName: user.provinceName,
          districtCode: user.districtCode,
          districtName: user.districtName,
          wardCode: user.wardCode,
          wardName: user.wardName,
          location: user.location,
          bio: user.bio,
          links: user.links || [],
          avatarUrl: normalizeAvatarUrl(user.avatarUrl),
          coverPhotoUrl: user.coverPhotoUrl,
          roleId: user.roleId,
          isActive: user.isActive,
          verifiedEmail: user.verifiedEmail,
          totalLikesReceived: user.totalLikesReceived,
          totalCommentsReceived: user.totalCommentsReceived,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          emailNotifications: user.emailNotifications,
          pushNotifications: user.pushNotifications,
          privacyProfile: user.privacyProfile,
          theme: user.theme,
          language: user.language,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        postCount
      }
    });

  } catch (error) {
    console.error('Error fetching current user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get other user profile by user ID
export const getUserProfileById = async (req, res) => {
  try {
    let { userId } = req.params;
    const currentUserId = req.userId; // From auth middleware (optional)

    // Ensure userId is a string, not an object
    if (typeof userId !== 'string') {
      userId = String(userId);
    }
    
    // Validate userId format (MongoDB ObjectId is 24 hex characters)
    if (!userId || userId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId).select('-passwordHash -email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    let canViewProfile = true;
    let isFollowing = false;

    if (user.privacyProfile === 'private') {
      canViewProfile = false;
    } else if (user.privacyProfile === 'followers') {
      if (currentUserId) {
        const followRelation = await UserFollow.findOne({
          followerId: currentUserId,
          followingId: userId
        });
        isFollowing = !!followRelation;
        canViewProfile = isFollowing;
      } else {
        canViewProfile = false;
      }
    }

    if (!canViewProfile) {
      return res.status(403).json({
        success: false,
        message: 'This profile is private'
      });
    }

    // Get user's post count
    const postCount = await Post.countDocuments({ 
      userId,
      $or: [
        { moderationStatus: 'approved' },
        { moderationStatus: { $exists: false } },
      ],
    });

    // Check if current user is following this user
    if (currentUserId && currentUserId !== userId) {
      const followRelation = await UserFollow.findOne({
        followerId: currentUserId,
        followingId: userId
      });
      isFollowing = !!followRelation;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          birthday: user.birthday,
          bio: user.bio,
          links: user.links || [],
          avatarUrl: normalizeAvatarUrl(user.avatarUrl),
          coverPhotoUrl: user.coverPhotoUrl,
          verifiedEmail: user.verifiedEmail,
          totalLikesReceived: user.totalLikesReceived,
          totalCommentsReceived: user.totalCommentsReceived,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          privacyProfile: user.privacyProfile,
          createdAt: user.createdAt
        },
        postCount,
        isFollowing
      }
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get other user profile by username
export const getUserProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.userId; // From auth middleware (optional)

    const user = await User.findOne({ username }).select('-passwordHash -email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    let canViewProfile = true;
    let isFollowing = false;

    if (user.privacyProfile === 'private') {
      canViewProfile = false;
    } else if (user.privacyProfile === 'followers') {
      if (currentUserId) {
        const followRelation = await UserFollow.findOne({
          followerId: currentUserId,
          followingId: user._id
        });
        isFollowing = !!followRelation;
        canViewProfile = isFollowing;
      } else {
        canViewProfile = false;
      }
    }

    if (!canViewProfile) {
      return res.status(403).json({
        success: false,
        message: 'This profile is private'
      });
    }

    // Get user's post count
    const postCount = await Post.countDocuments({ 
      userId: user._id,
      $or: [
        { moderationStatus: 'approved' },
        { moderationStatus: { $exists: false } },
      ],
    });

    // Check if current user is following this user
    if (currentUserId && currentUserId !== user._id.toString()) {
      const followRelation = await UserFollow.findOne({
        followerId: currentUserId,
        followingId: user._id
      });
      isFollowing = !!followRelation;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          birthday: user.birthday,
          bio: user.bio,
          links: user.links || [],
          avatarUrl: normalizeAvatarUrl(user.avatarUrl),
          coverPhotoUrl: user.coverPhotoUrl,
          verifiedEmail: user.verifiedEmail,
          totalLikesReceived: user.totalLikesReceived,
          totalCommentsReceived: user.totalCommentsReceived,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          privacyProfile: user.privacyProfile,
          createdAt: user.createdAt
        },
        postCount,
        isFollowing
      }
    });

  } catch (error) {
    console.error('Error fetching user profile by username:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    
    console.log('📝 Update profile - Content-Type:', req.headers['content-type']);
    console.log('📝 Update profile - req.file:', req.file ? 'File exists' : 'No file');
    console.log('📝 Update profile - req.body keys:', Object.keys(req.body || {}));

    // Parse body fields (có thể từ JSON hoặc multipart)
    const {
      displayName,
      bio,
      birthday,
      avatarUrl,
      coverPhotoUrl,
      privacyProfile,
      theme,
      language,
      gender,
      location,
      links,
      addressLine,
      provinceCode,
      provinceName,
      districtCode,
      districtName,
      wardCode,
      wardName
    } = req.body;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields
    if (displayName !== undefined) user.displayName = displayName;
    if (bio !== undefined) user.bio = bio;
    if (birthday !== undefined) user.birthday = birthday ? new Date(birthday) : undefined;
    
    // Xử lý avatar: CHỈ cho phép upload file, KHÔNG cho phép URL string từ JSON
    if (req.file) {
      // File đã được upload lên Cloudinary bởi multer-storage-cloudinary
      // CloudinaryStorage trả về file object với path (URL) hoặc secure_url
      const uploadedUrl = req.file.path || req.file.secure_url || req.file.url;
      console.log('📸 Uploaded file URL:', uploadedUrl);
      console.log('📸 Full file object keys:', Object.keys(req.file || {}));
      
      if (uploadedUrl) {
        user.avatarUrl = uploadedUrl;
        console.log('✅ Avatar URL updated from uploaded file:', uploadedUrl);
      } else {
        console.error('❌ No URL found in uploaded file object:', req.file);
      }
    } else if (avatarUrl !== undefined && avatarUrl !== null && avatarUrl !== '') {
      // Reject nếu có avatarUrl trong JSON body (chỉ cho phép upload file)
      return res.status(400).json({
        success: false,
        message: 'Avatar can only be updated via file upload. Please use POST /api/users/profile/avatar endpoint.'
      });
    }
    
    // Xử lý cover photo: CHỈ cho phép upload file, KHÔNG cho phép URL string từ JSON
    if (req.files && req.files.coverPhoto) {
      // File đã được upload lên Cloudinary bởi multer-storage-cloudinary
      const uploadedUrl = req.files.coverPhoto.path || req.files.coverPhoto.secure_url || req.files.coverPhoto.url;
      console.log('📸 Uploaded cover photo URL:', uploadedUrl);
      
      if (uploadedUrl) {
        user.coverPhotoUrl = uploadedUrl;
        console.log('✅ Cover photo URL updated from uploaded file:', uploadedUrl);
      } else {
        console.error('❌ No URL found in uploaded cover photo file object:', req.files.coverPhoto);
      }
    } else if (coverPhotoUrl !== undefined && coverPhotoUrl !== null && coverPhotoUrl !== '') {
      // Reject nếu có coverPhotoUrl trong JSON body (chỉ cho phép upload file)
      return res.status(400).json({
        success: false,
        message: 'Cover photo can only be updated via file upload. Please use POST /api/users/profile/cover-photo endpoint.'
      });
    }
    
    if (privacyProfile !== undefined) user.privacyProfile = privacyProfile;
    if (theme !== undefined) user.theme = theme;
    if (language !== undefined) user.language = language;
    if (gender !== undefined) user.gender = gender;
    if (location !== undefined) user.location = location;
    if (addressLine !== undefined) {
      user.addressLine = typeof addressLine === 'string' ? addressLine.trim() : '';
    }
    if (provinceCode !== undefined) {
      user.provinceCode = provinceCode ? provinceCode.toString() : '';
    }
    if (provinceName !== undefined) {
      user.provinceName = typeof provinceName === 'string' ? provinceName.trim() : '';
    }
    if (districtCode !== undefined) {
      user.districtCode = districtCode ? districtCode.toString() : '';
    }
    if (districtName !== undefined) {
      user.districtName = typeof districtName === 'string' ? districtName.trim() : '';
    }
    if (wardCode !== undefined) {
      user.wardCode = wardCode ? wardCode.toString() : '';
    }
    if (wardName !== undefined) {
      user.wardName = typeof wardName === 'string' ? wardName.trim() : '';
    }
    if (links !== undefined) {
      // Validate links là array và filter bỏ các link rỗng
      if (Array.isArray(links)) {
        user.links = links
          .map(link => typeof link === 'string' ? link.trim() : '')
          .filter(link => link !== '');
      } else {
        user.links = [];
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          birthday: user.birthday,
          gender: user.gender,
          location: user.location,
          bio: user.bio,
          links: user.links || [],
          avatarUrl: normalizeAvatarUrl(user.avatarUrl),
          coverPhotoUrl: user.coverPhotoUrl,
          roleId: user.roleId,
          verifiedEmail: user.verifiedEmail,
          totalLikesReceived: user.totalLikesReceived,
          totalCommentsReceived: user.totalCommentsReceived,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          emailNotifications: user.emailNotifications,
          pushNotifications: user.pushNotifications,
          privacyProfile: user.privacyProfile,
          theme: user.theme,
          language: user.language,
          updatedAt: user.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Upload avatar image and update user's avatarUrl
export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.userId;
    const file = req.file;
    
    console.log('📸 Upload avatar - file object:', JSON.stringify(file, null, 2));
    
    if (!file) {
      return res.status(400).json({ success: false, message: 'Missing avatar file' });
    }

    // With CloudinaryStorage, the file object should have path or secure_url
    // Try multiple possible properties from Cloudinary response
    const imageUrl = file.path || file.secure_url || file.url || (file.filename ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${file.filename}` : null);
    
    console.log('📸 Extracted imageUrl:', imageUrl);
    
    if (!imageUrl) {
      console.error('❌ No imageUrl found in file object:', file);
      return res.status(500).json({ 
        success: false, 
        message: 'Upload failed - no URL returned from Cloudinary',
        debug: { fileKeys: Object.keys(file || {}) }
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { avatarUrl: imageUrl },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('✅ Avatar updated successfully:', imageUrl);

    return res.status(200).json({
      success: true,
      message: 'Avatar updated',
      data: { 
        avatarUrl: normalizeAvatarUrl(user.avatarUrl), 
        user: {
          ...user.toObject(),
          avatarUrl: normalizeAvatarUrl(user.avatarUrl)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error uploading avatar:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
};

// Upload cover photo image and update user's coverPhotoUrl
export const uploadCoverPhoto = async (req, res) => {
  try {
    const userId = req.userId;
    const file = req.file;
    
    console.log('📸 Upload cover photo - file object:', JSON.stringify(file, null, 2));
    
    if (!file) {
      return res.status(400).json({ success: false, message: 'Missing cover photo file' });
    }

    // With CloudinaryStorage, the file object should have path or secure_url
    // Try multiple possible properties from Cloudinary response
    const imageUrl = file.path || file.secure_url || file.url || (file.filename ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${file.filename}` : null);
    
    console.log('📸 Extracted cover photo imageUrl:', imageUrl);
    
    if (!imageUrl) {
      console.error('❌ No imageUrl found in file object:', file);
      return res.status(500).json({ 
        success: false, 
        message: 'Upload failed - no URL returned from Cloudinary',
        debug: { fileKeys: Object.keys(file || {}) }
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { coverPhotoUrl: imageUrl },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('✅ Cover photo updated successfully:', imageUrl);

    return res.status(200).json({
      success: true,
      message: 'Cover photo updated',
      data: { 
        coverPhotoUrl: user.coverPhotoUrl || '', 
        user: {
          ...user.toObject(),
          coverPhotoUrl: user.coverPhotoUrl || ''
        }
      }
    });
  } catch (error) {
    console.error('❌ Error uploading cover photo:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
};

// Follow a user
export const followUser = async (req, res) => {
  try {
    const followerId = req.userId;
    const { userId } = req.params;

    if (followerId === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow yourself'
      });
    }

    // Check if user exists
    const userToFollow = await User.findById(userId);
    if (!userToFollow || !userToFollow.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already following
    const existingFollow = await UserFollow.findOne({
      followerId,
      followingId: userId
    });

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }

    // Create follow relationship
    const follow = new UserFollow({
      followerId,
      followingId: userId
    });
    await follow.save();

    // Update followers count
    await User.findByIdAndUpdate(userId, {
      $inc: { followersCount: 1 }
    });

    // Update following count
    await User.findByIdAndUpdate(followerId, {
      $inc: { followingCount: 1 }
    });

    // Tạo thông báo cho người được follow
    notifyUserFollowed(userId, followerId).catch(err => {
      console.error('Lỗi khi tạo thông báo follow:', err);
    });

    res.status(200).json({
      success: true,
      message: 'Successfully followed user'
    });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Unfollow a user
export const unfollowUser = async (req, res) => {
  try {
    const followerId = req.userId;
    const { userId } = req.params;

    // Find and delete follow relationship
    const follow = await UserFollow.findOneAndDelete({
      followerId,
      followingId: userId
    });

    if (!follow) {
      return res.status(400).json({
        success: false,
        message: 'Not following this user'
      });
    }

    // Update followers count
    await User.findByIdAndUpdate(userId, {
      $inc: { followersCount: -1 }
    });

    // Update following count
    await User.findByIdAndUpdate(followerId, {
      $inc: { followingCount: -1 }
    });

    res.status(200).json({
      success: true,
      message: 'Successfully unfollowed user'
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get follow suggestions - users to follow
export const getFollowSuggestions = async (req, res) => {
  try {
    const userId = req.userId;
    const userIdStr = userId?.toString();
    const limit = parseInt(req.query.limit, 10) || 10;

    const MUTUAL_WEIGHT = 3;
    const SHARED_FOLLOWER_WEIGHT = 2;
    const LIKE_INTERACTION_WEIGHT = 5; // Tăng trọng số để ưu tiên tương tác trực tiếp
    const COMMENT_INTERACTION_WEIGHT = 6; // Comment có trọng số cao hơn like
    const POPULARITY_WEIGHT = 1;
    const POOL_MULTIPLIER = 2; // build a slightly larger pool before slicing

    const [followingRelations, followerRelations, likedPosts, commentedPosts] = await Promise.all([
      UserFollow.find({ followerId: userId }).select('followingId').lean(),
      UserFollow.find({ followingId: userId }).select('followerId').lean(),
      PostLike.find({ userId }).select('postId').lean(),
      PostComment.find({ userId }).select('postId').lean(),
    ]);

    const followingIds = followingRelations.map((rel) => rel.followingId);
    const followedIdSet = new Set(followingRelations.map((rel) => rel.followingId.toString()));
    // Prevent recommending the current user
    followedIdSet.add(userIdStr);

    const followerIds = followerRelations.map((rel) => rel.followerId);

    const candidateScores = new Map();

    const defaultMeta = () => ({
      mutualFollowing: 0,
      sharedFollowers: 0,
      popularity: false,
      interactions: {
        likes: 0,
        comments: 0,
      },
    });

    const bumpCandidate = (candidateId, amount, metaKey) => {
      if (!candidateId || !amount) return;
      const candidateIdStr = candidateId.toString();
      if (followedIdSet.has(candidateIdStr) || candidateIdStr === userIdStr) return;

      const existing = candidateScores.get(candidateIdStr) || {
        score: 0,
        meta: defaultMeta(),
      };
      existing.score += amount;
      if (metaKey === 'mutualFollowing') {
        existing.meta.mutualFollowing = (existing.meta.mutualFollowing || 0) + 1;
      } else if (metaKey === 'sharedFollowers') {
        existing.meta.sharedFollowers = (existing.meta.sharedFollowers || 0) + 1;
      } else if (metaKey === 'popularity') {
        existing.meta.popularity = true;
      } else if (metaKey === 'contentLike') {
        existing.meta.interactions.likes = (existing.meta.interactions.likes || 0) + 1;
      } else if (metaKey === 'contentComment') {
        existing.meta.interactions.comments = (existing.meta.interactions.comments || 0) + 1;
      }

      candidateScores.set(candidateIdStr, existing);
    };

    // Heuristic 1: friends of friends (who people I follow are following)
    if (followingIds.length) {
      const secondDegreeFollows = await UserFollow.find({
        followerId: { $in: followingIds },
      })
        .select('followingId')
        .lean();

      secondDegreeFollows.forEach(({ followingId }) => {
        bumpCandidate(followingId, MUTUAL_WEIGHT, 'mutualFollowing');
      });
    }

    // Heuristic 2: shared followers (who people that follow me are also following)
    if (followerIds.length) {
      const sharedFollowerEdges = await UserFollow.find({
        followerId: { $in: followerIds },
      })
        .select('followingId')
        .lean();

      sharedFollowerEdges.forEach(({ followingId }) => {
        bumpCandidate(followingId, SHARED_FOLLOWER_WEIGHT, 'sharedFollowers');
      });
    }

    // Heuristic 3: content interactions (liked or commented posts)
    const interactionPostIds = Array.from(
      new Set(
        [...likedPosts, ...commentedPosts]
          .map((doc) => doc?.postId?.toString())
          .filter(Boolean)
      )
    );

    if (interactionPostIds.length) {
      const posts = await Post.find({ _id: { $in: interactionPostIds } })
        .select('_id userId')
        .lean();
      const postAuthorMap = new Map(posts.map((post) => [post._id.toString(), post.userId]));

      likedPosts.forEach(({ postId }) => {
        const authorId = postAuthorMap.get(postId?.toString());
        if (!authorId) return;
        bumpCandidate(authorId, LIKE_INTERACTION_WEIGHT, 'contentLike');
      });

      commentedPosts.forEach(({ postId }) => {
        const authorId = postAuthorMap.get(postId?.toString());
        if (!authorId) return;
        bumpCandidate(authorId, COMMENT_INTERACTION_WEIGHT, 'contentComment');
      });
    }

    // Fallback: add popular active users if pool is too small
    if (candidateScores.size < limit * POOL_MULTIPLIER) {
      const fallbackUsers = await User.find({ isActive: true })
        .sort({ followersCount: -1, createdAt: -1 })
        .limit(limit * 5)
        .select('_id');

      for (const user of fallbackUsers) {
        bumpCandidate(user._id, POPULARITY_WEIGHT, 'popularity');
        if (candidateScores.size >= limit * POOL_MULTIPLIER) break;
      }
    }

    const buildReasons = (meta = {}) => {
      const reasons = [];
      // Thứ tự 1: Follow chung (mutualFollowing và sharedFollowers)
      if (meta.mutualFollowing) {
        reasons.push(`Được ${meta.mutualFollowing} người bạn của bạn theo dõi`);
      }
      if (meta.sharedFollowers) {
        reasons.push(`${meta.sharedFollowers} người theo dõi bạn cũng theo dõi họ`);
      }
      // Thứ tự 2: Tương tác nội dung (interactions)
      const totalInteractions =
        (meta.interactions?.likes || 0) + (meta.interactions?.comments || 0);
      if (totalInteractions) {
        const likePart = meta.interactions?.likes || 0;
        const commentPart = meta.interactions?.comments || 0;
        if (commentPart && likePart) {
          reasons.push(`Bạn đã thích/bình luận ${totalInteractions} bài viết của họ`);
        } else if (commentPart) {
          reasons.push(`Bạn đã bình luận ${commentPart} bài viết của họ`);
        } else if (likePart) {
          reasons.push(`Bạn đã thích ${likePart} bài viết của họ`);
        }
      }
      // Thứ tự 3: Tài khoản nổi bật (chỉ hiển thị nếu không có tương tác)
      if (meta.popularity && !totalInteractions) {
        reasons.push('Tài khoản nổi bật trong cộng đồng');
      }
      if (!reasons.length) {
        reasons.push('Gợi ý phù hợp với bạn');
      }
      return reasons.slice(0, 2);
    };

    const sortedCandidates = Array.from(candidateScores.entries())
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (!sortedCandidates.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const candidateIds = sortedCandidates.map((candidate) => candidate.id);
    const users = await User.find({
      _id: { $in: candidateIds },
      isActive: true,
    })
      .select('username displayName avatarUrl followersCount')
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const data = sortedCandidates
      .map((candidate) => {
        const user = userMap.get(candidate.id);
        if (!user) return null;
        return {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: normalizeAvatarUrl(user.avatarUrl),
          followersCount: user.followersCount,
          score: Number(candidate.score.toFixed(2)),
          reasons: buildReasons(candidate.meta),
        };
      })
      .filter(Boolean);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error getting follow suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Get list of users that current user is following
export const getFollowingList = async (req, res) => {
  try {
    const userId = req.userId;
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || 50;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get list of user IDs that current user is following
    const followingRelations = await UserFollow.find({ followerId: userId })
      .select('followingId')
      .lean();
    
    const followingIds = followingRelations.map(f => f.followingId);

    console.log('[getFollowingList] userId:', userId);
    console.log('[getFollowingList] followingIds count:', followingIds.length);
    console.log('[getFollowingList] search term:', search);

    if (followingIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // Build query for users
    let userQuery = {
      _id: { $in: followingIds },
      isActive: true,
    };

    // Apply search filter in query if provided
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      userQuery.$or = [
        { displayName: searchRegex },
        { username: searchRegex },
      ];
    }

    // Fetch users directly
    const users = await User.find(userQuery)
      .select('username displayName avatarUrl isActive')
      .limit(limit)
      .lean();

    console.log('[getFollowingList] users found:', users.length);

    // Map to response format
    let followingUsers = users.map((user) => ({
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: normalizeAvatarUrl(user.avatarUrl),
    }));

    console.log('[getFollowingList] followingUsers after mapping:', followingUsers.length);

    res.status(200).json({
      success: true,
      data: followingUsers,
    });
  } catch (error) {
    console.error('Error getting following list:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Search users by displayName or username
export const searchUsers = async (req, res) => {
  try {
    const rawQuery = req.query.q || req.query.query || '';
    const q = typeof rawQuery === 'string' ? rawQuery.trim() : '';
    const limitParam = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(limitParam) ? 10 : Math.min(Math.max(limitParam, 1), 50);

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const searchRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const users = await User.find({
      isActive: true,
      $or: [
        { displayName: searchRegex },
        { username: searchRegex },
      ],
    })
      .select('username displayName avatarUrl followersCount')
      .sort({ followersCount: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const data = users.map((user) => ({
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: normalizeAvatarUrl(user.avatarUrl),
      followersCount: user.followersCount || 0,
    }));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
