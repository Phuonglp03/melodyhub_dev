import mongoose from 'mongoose';
import Post from '../models/Post.js';
import User from '../models/User.js';
import PostLike from '../models/PostLike.js';
import PostComment from '../models/PostComment.js';
import Lick from '../models/Lick.js';
import UserFollow from '../models/UserFollow.js';
import Project from '../models/Project.js';
import ProjectCollaborator from '../models/ProjectCollaborator.js';
import { uploadToCloudinary } from '../middleware/file.js';

// Helper function to detect media type from mimetype
const detectMediaType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'unknown';
};

// Parse JSON only when input is a JSON string; otherwise return as-is
const parseJsonIfString = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return value;
  }
};

const normalizeIdListInput = (raw) => {
  if (raw === undefined || raw === null) {
    return { provided: false, ids: [] };
  }

  const parsed = parseJsonIfString(raw);
  const arr = Array.isArray(parsed) ? parsed : [parsed];

  const ids = arr
    .map((item) => {
      if (item === undefined || item === null) return null;
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'number') return String(item);
      if (item instanceof mongoose.Types.ObjectId) return item.toString();
      if (typeof item === 'object') {
        const candidate = item._id || item.id || item.value || item;
        if (candidate instanceof mongoose.Types.ObjectId) return candidate.toString();
        if (typeof candidate === 'string') return candidate.trim();
        if (typeof candidate === 'number') return String(candidate);
      }
      try {
        return String(item).trim();
      } catch {
        return null;
      }
    })
    .filter((id) => typeof id === 'string' && id.length > 0);

  const unique = Array.from(new Set(ids));
  return { provided: true, ids: unique };
};

// Create a new post
export const createPost = async (req, res) => {
  try {
    // Get userId from token (set by verifyToken middleware) - more secure than from body
    const userId = req.userId;
    
    // Debug logging
    console.log('[createPost] Request body:', JSON.stringify(req.body, null, 2));
    console.log('[createPost] Request files:', req.files ? req.files.length : 0);
    console.log('[createPost] Content-Type:', req.headers['content-type']);
    console.log('[createPost] UserId from token:', userId);
    
    const { postType, textContent } = req.body;
    const linkPreviewInput = parseJsonIfString(req.body.linkPreview);
    
    // Parse originalPostId if it's a string
    const originalPostId = req.body.originalPostId;

    const { provided: attachedLicksProvided, ids: attachedLickIdsInput } = normalizeIdListInput(
      req.body.attachedLickIds ?? req.body.attachedLicks
    );
    let validatedAttachedLickIds = null;
    if (attachedLicksProvided) {
      if (attachedLickIdsInput.length === 0) {
        validatedAttachedLickIds = [];
      } else {
        const invalidIds = attachedLickIdsInput.filter((id) => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'ID của lick không hợp lệ',
            invalidIds,
          });
        }

        const objectIds = attachedLickIdsInput.map((id) => new mongoose.Types.ObjectId(id));
        const ownedActiveLicks = await Lick.find({
          _id: { $in: objectIds },
          userId,
          status: 'active',
        })
          .select('_id')
          .lean();

        const ownedSet = new Set(ownedActiveLicks.map((lick) => lick._id.toString()));
        const missing = attachedLickIdsInput.filter((id) => !ownedSet.has(id));

        if (missing.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Bạn chỉ có thể đính kèm những lick active thuộc về bạn',
            invalidIds: missing,
          });
        }

        validatedAttachedLickIds = objectIds;
      }
    }

    // Validate projectId if provided
    let validatedProjectId = null;
    if (req.body.projectId) {
      const projectIdInput = req.body.projectId;
      if (!mongoose.Types.ObjectId.isValid(projectIdInput)) {
        return res.status(400).json({
          success: false,
          message: 'ID của project không hợp lệ',
        });
      }

      const project = await Project.findById(projectIdInput);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project không tồn tại',
        });
      }

      // Check if project is active
      if (project.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Chỉ có thể chọn project có trạng thái active',
        });
      }

      // Check if user is the owner or collaborator
      const isOwner = project.creatorId.toString() === userId.toString();
      if (!isOwner) {
        // Check if user is a collaborator
        const collaborator = await ProjectCollaborator.findOne({
          projectId: project._id,
          userId: userId,
        });
        if (!collaborator) {
          return res.status(403).json({
            success: false,
            message: 'Bạn chỉ có thể chọn project mà bạn sở hữu hoặc là cộng tác viên',
          });
        }
      }

      validatedProjectId = new mongoose.Types.ObjectId(projectIdInput);
    }

    // Validate userId from token
    if (!userId) {
      console.error('[createPost] Missing userId from token - authentication required');
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login to create a post.'
      });
    }
    
    // Validate required fields
    if (!postType) {
      console.error('[createPost] Missing postType in request body');
      return res.status(400).json({
        success: false,
        message: 'postType is required',
        received: { postType: req.body.postType }
      });
    }

    // Validate postType enum
    const validPostTypes = ['status_update', 'shared_post'];
    if (!validPostTypes.includes(postType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid postType. Must be one of: status_update, shared_post'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate originalPostId exists if provided (for shared_post)
    if (postType === 'shared_post' && !originalPostId) {
      return res.status(400).json({
        success: false,
        message: 'originalPostId is required for shared_post type'
      });
    }

    if (originalPostId) {
      const originalPost = await Post.findById(originalPostId);
      if (!originalPost) {
        return res.status(404).json({
          success: false,
          message: 'Original post not found'
        });
      }
    }

    let mediaArray = [];
    if (req.files && req.files.length > 0) {
      // Upload each file to Cloudinary
      for (const file of req.files) {
        const mediaType = detectMediaType(file.mimetype);
        if (mediaType === 'image') {
          return res.status(400).json({
            success: false,
            message: 'Không cho phép upload hình ảnh cho bài đăng này'
          });
        }
        const folder = `melodyhub/posts/${mediaType}`;
        const resourceType = mediaType === 'video' ? 'video' : 'video'; // audio dùng resource_type 'video' trên Cloudinary
        
        let result;
        try {
          result = await uploadToCloudinary(file.buffer, folder, resourceType);
        } catch (e) {
          return res.status(400).json({ success: false, message: 'Upload media thất bại', error: e.message });
        }
        
        mediaArray.push({
          url: result.secure_url,
          type: mediaType
        });
      }
    } else if (req.body.media) {
      // If media is provided as array in body (for external URLs)
      const mediaBody = parseJsonIfString(req.body.media);
      if (Array.isArray(mediaBody)) {
        for (const item of mediaBody) {
          if (!item.url || !item.type) {
            return res.status(400).json({
              success: false,
              message: 'Each media item must have url and type'
            });
          }
          if (!['video', 'audio'].includes(item.type)) {
            return res.status(400).json({
              success: false,
              message: 'Media type must be one of: video, audio'
            });
          }
          if (item.type === 'image') {
            return res.status(400).json({
              success: false,
              message: 'Không cho phép ảnh trong media'
            });
          }
          mediaArray.push(item);
        }
      }
    }

    // Create new post
    const newPost = new Post({
      userId,
      postType,
      textContent,
      linkPreview: linkPreviewInput,
      media: mediaArray.length > 0 ? mediaArray : undefined,
      originalPostId,
      projectId: validatedProjectId,
      moderationStatus: 'approved', // Default to approved
      attachedLicks: validatedAttachedLickIds !== null ? validatedAttachedLickIds : undefined,
    });

    const savedPost = await newPost.save();

    // Populate user information for response
    const populatedPost = await Post.findById(savedPost._id)
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId')
      .populate('projectId', 'title description coverImageUrl status')
      .populate('attachedLicks', 'title description audioUrl waveformData duration tabNotation key tempo difficulty status isPublic createdAt updatedAt')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: populatedPost
    });

  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all posts with pagination
export const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Convert userId to ObjectId if available and valid
    let currentUserIdObj = null;
    if (req.userId && mongoose.Types.ObjectId.isValid(req.userId)) {
      currentUserIdObj = new mongoose.Types.ObjectId(req.userId);
    }

    // Lấy danh sách user mà current user đang follow (để ưu tiên trong feed)
    let followingIds = [];
    if (currentUserIdObj) {
      const followingDocs = await UserFollow.find({
        followerId: currentUserIdObj,
      })
        .select('followingId')
        .lean();
      followingIds = followingDocs.map((doc) => doc.followingId).filter(Boolean);
    }
    const hasFollowing = currentUserIdObj && followingIds.length > 0;

    // Include legacy posts that may not have moderationStatus field
    // Exclude archived posts
    // NEW: Nếu có currentUserIdObj thì loại trừ các bài của chính user đó khỏi community feed
    const visibilityAndConditions = [
      {
        $or: [
          { moderationStatus: 'approved' },
          { moderationStatus: { $exists: false } },
        ],
      },
      {
        $or: [
          { archived: false },
          { archived: { $exists: false } },
        ],
      },
    ];

    if (currentUserIdObj) {
      visibilityAndConditions.push({
        userId: { $ne: currentUserIdObj },
      });
    }

    const visibilityFilter = {
      $and: visibilityAndConditions,
    };

    // Get collection names from models to ensure correctness
    // Mongoose automatically pluralizes model names: PostLike -> postlikes, PostComment -> postcomments
    const postLikesCollection = PostLike.collection.name || 'postlikes';
    const postCommentsCollection = PostComment.collection.name || 'postcomments';
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[getPosts] Using collections:', { postLikesCollection, postCommentsCollection });
    }

    // Xác định stage sort dựa trên việc user có follow ai không:
    // - Nếu có following: ưu tiên bài của người đang follow (isFollowed = true) mới đến bài khác.
    //   Trong mỗi nhóm, sort theo thời gian tạo (mới nhất trước), sau đó mới đến engagementScore.
    // - Nếu không có following: giữ nguyên logic cũ, sort theo engagementScore rồi createdAt.
    const sortStage = hasFollowing
      ? {
          $sort: {
            isFollowed: -1,
            createdAt: -1,
            engagementScore: -1,
          },
        }
      : {
          $sort: {
            engagementScore: -1,
            createdAt: -1,
          },
        };

    // Use aggregation pipeline to sort by follow priority + likes + comments
    const pipeline = [
      // Match posts with visibility filter
      { $match: visibilityFilter },
      
      // Lookup likes count
      {
        $lookup: {
          from: postLikesCollection,
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$postId', '$$postId'] }
              }
            }
          ],
          as: 'likes'
        }
      },
      
      // Lookup comments count (only top-level comments, not replies)
      {
        $lookup: {
          from: postCommentsCollection,
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postId', '$$postId'] },
                    {
                      $or: [
                        { $eq: [{ $type: '$parentCommentId' }, 'missing'] },
                        { $eq: ['$parentCommentId', null] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: 'comments'
        }
      },
      
      // Calculate engagement score (likes + comments)
      {
        $addFields: {
          likesCount: { $size: '$likes' },
          commentsCount: { $size: '$comments' },
          engagementScore: {
            $add: [
              { $size: '$likes' },
              { $size: '$comments' }
            ]
          }
        }
      },

      // Check if current user has liked this post (if userId is available)
      ...(currentUserIdObj
        ? [
            {
              $lookup: {
                from: postLikesCollection,
                let: {
                  postId: '$_id',
                  currentUserId: currentUserIdObj,
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$postId', '$$postId'] },
                          { $eq: ['$userId', '$$currentUserId'] },
                        ],
                      },
                    },
                  },
                ],
                as: 'userLike',
              },
            },
            {
              $addFields: {
                isLiked: { $gt: [{ $size: '$userLike' }, 0] },
              },
            },
          ]
        : []),

      // Đánh dấu bài viết của người mà current user đang follow (nếu có)
      ...(hasFollowing
        ? [
            {
              $addFields: {
                // userId ở thời điểm này vẫn là ObjectId gốc,
                // so sánh trực tiếp với mảng ObjectId followingIds
                isFollowed: {
                  $cond: [{ $in: ['$userId', followingIds] }, true, false],
                },
              },
            },
          ]
        : []),

      // Sort theo ưu tiên follow + thời gian + engagement
      sortStage,
      
      // Skip and limit for pagination
      { $skip: skip },
      { $limit: limit },
      
      // Populate userId
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userIdData'
        }
      },
      {
        $unwind: {
          path: '$userIdData',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          userId: {
            _id: '$userIdData._id',
            username: '$userIdData.username',
            displayName: '$userIdData.displayName',
            avatarUrl: '$userIdData.avatarUrl'
          }
        }
      },
      
      // Populate originalPostId if exists
      {
        $lookup: {
          from: 'posts',
          localField: 'originalPostId',
          foreignField: '_id',
          as: 'originalPostData'
        }
      },
      {
        $addFields: {
          originalPostId: {
            $cond: {
              if: { $gt: [{ $size: '$originalPostData' }, 0] },
              then: { $arrayElemAt: ['$originalPostData', 0] },
              else: null
            }
          }
        }
      },
      
      // Populate attachedLicks
      {
        $lookup: {
          from: 'licks',
          localField: 'attachedLicks',
          foreignField: '_id',
          as: 'attachedLicksData'
        }
      },
      {
        $addFields: {
          attachedLicks: {
            $map: {
              input: '$attachedLicksData',
              as: 'lick',
              in: {
                _id: '$$lick._id',
                title: '$$lick.title',
                description: '$$lick.description',
                audioUrl: '$$lick.audioUrl',
                waveformData: '$$lick.waveformData',
                duration: '$$lick.duration',
                tabNotation: '$$lick.tabNotation',
                key: '$$lick.key',
                tempo: '$$lick.tempo',
                difficulty: '$$lick.difficulty',
                status: '$$lick.status',
                isPublic: '$$lick.isPublic',
                createdAt: '$$lick.createdAt',
                updatedAt: '$$lick.updatedAt'
              }
            }
          }
        }
      },
      
      // Remove temporary fields but keep likesCount and commentsCount for debugging
      {
        $project: {
          likes: 0,
          comments: 0,
          userIdData: 0,
          originalPostData: 0,
          attachedLicksData: 0,
          engagementScore: 0,
          userLike: 0
          // Note: likesCount and commentsCount are removed but engagement score is used for sorting
          // isLiked is kept if userId is available
        }
      }
    ];

    const posts = await Post.aggregate(pipeline);
    
    // Debug: log first post's engagement score if available
    if (posts.length > 0 && process.env.NODE_ENV === 'development') {
      console.log('[getPosts] First post engagement:', {
        postId: posts[0]._id,
        likesCount: posts[0].likesCount,
        commentsCount: posts[0].commentsCount,
        engagementScore: (posts[0].likesCount || 0) + (posts[0].commentsCount || 0)
      });
    }

    // Get total count for pagination (sử dụng cùng visibilityFilter, nên cũng không đếm bài của chính user)
    const totalPosts = await Post.countDocuments(visibilityFilter);
    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      success: true,
      data: {
        posts,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get posts by user ID
export const getPostsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const visibilityFilter = {
      $and: [
        {
          $or: [
            { moderationStatus: 'approved' },
            { moderationStatus: { $exists: false } },
          ],
        },
        {
          $or: [
            { archived: false },
            { archived: { $exists: false } },
          ],
        },
      ],
    };

    const posts = await Post.find({ 
      userId,
      ...visibilityFilter,
    })
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId')
      .populate('projectId', 'title description coverImageUrl status')
      .populate('attachedLicks', 'title description audioUrl waveformData duration tabNotation key tempo difficulty status isPublic createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments({ 
      userId,
      ...visibilityFilter,
    });
    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      success: true,
      data: {
        posts,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get post by ID
export const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId)
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId')
      .populate('projectId', 'title description coverImageUrl status')
      .populate('attachedLicks', 'title description audioUrl waveformData duration tabNotation key tempo difficulty status isPublic createdAt updatedAt')
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    res.status(200).json({
      success: true,
      data: post
    });

  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update post
export const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { textContent, linkPreview, postType } = req.body;
    const { provided: attachedLicksProvided, ids: attachedLickIdsInput } = normalizeIdListInput(
      req.body.attachedLickIds ?? req.body.attachedLicks
    );

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Update allowed fields
    if (textContent !== undefined) post.textContent = textContent;
    if (linkPreview !== undefined) {
      post.linkPreview = typeof linkPreview === 'string' ? JSON.parse(linkPreview) : linkPreview;
    }
    
    // Handle uploaded files
    if (req.files && req.files.length > 0) {
      let mediaArray = [];
      // Upload each file to Cloudinary
      for (const file of req.files) {
        const mediaType = detectMediaType(file.mimetype);
        if (mediaType === 'image') {
          return res.status(400).json({
            success: false,
            message: 'Không cho phép upload hình ảnh cho bài đăng này'
          });
        }
        const folder = `melodyhub/posts/${mediaType}`;
        const resourceType = mediaType === 'video' ? 'video' : 'video'; // audio dùng resource_type 'video' trên Cloudinary
        
        const result = await uploadToCloudinary(file.buffer, folder, resourceType);
        
        mediaArray.push({
          url: result.secure_url,
          type: mediaType
        });
      }
      post.media = mediaArray;
    } else if (req.body.media !== undefined) {
      // Validate media array if provided
      if (Array.isArray(req.body.media)) {
        for (const item of req.body.media) {
          if (!item.url || !item.type) {
            return res.status(400).json({
              success: false,
              message: 'Each media item must have url and type'
            });
          }
          if (!['video', 'audio'].includes(item.type)) {
            return res.status(400).json({
              success: false,
              message: 'Media type must be one of: video, audio'
            });
          }
          if (item.type === 'image') {
            return res.status(400).json({
              success: false,
              message: 'Không cho phép ảnh trong media'
            });
          }
        }
        post.media = req.body.media;
      } else if (req.body.media === null) {
        post.media = [];
      }
    }
    
    if (attachedLicksProvided) {
      if (attachedLickIdsInput.length === 0) {
        post.attachedLicks = [];
      } else {
        const invalidIds = attachedLickIdsInput.filter((id) => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'ID của lick không hợp lệ',
            invalidIds,
          });
        }

        const objectIds = attachedLickIdsInput.map((id) => new mongoose.Types.ObjectId(id));
        const ownerId = post.userId;

        const ownedActiveLicks = await Lick.find({
          _id: { $in: objectIds },
          userId: ownerId,
          status: 'active',
        })
          .select('_id')
          .lean();

        const ownedSet = new Set(ownedActiveLicks.map((lick) => lick._id.toString()));
        const missing = attachedLickIdsInput.filter((id) => !ownedSet.has(id));

        if (missing.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Bạn chỉ có thể đính kèm những lick active thuộc về bạn',
            invalidIds: missing,
          });
        }

        post.attachedLicks = objectIds;
      }
    }

    if (postType !== undefined) {
      const validPostTypes = ['status_update', 'shared_post'];
      if (!validPostTypes.includes(postType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid postType. Must be one of: status_update, shared_post'
        });
      }
      post.postType = postType;
    }

    const updatedPost = await post.save();

    const populatedPost = await Post.findById(updatedPost._id)
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId')
      .populate('projectId', 'title description coverImageUrl status')
      .populate('attachedLicks', 'title description audioUrl waveformData duration tabNotation key tempo difficulty status isPublic createdAt updatedAt')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: populatedPost
    });

  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Archive post (move to archive, will be auto-deleted after 30 days)
export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const requesterId = req.userId; // From auth middleware

    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if requester is the owner of the post
    const isOwner = String(post.userId) === String(requesterId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to archive this post'
      });
    }

    // Check if already archived
    if (post.archived) {
      return res.status(400).json({
        success: false,
        message: 'Post is already archived'
      });
    }

    // Archive the post instead of deleting
    post.archived = true;
    post.archivedAt = new Date();
    await post.save();

    res.status(200).json({
      success: true,
      message: 'Post archived successfully. It will be permanently deleted after 30 days if not restored.'
    });

  } catch (error) {
    console.error('Error archiving post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Permanently delete archived post (only for archived posts)
export const permanentlyDeletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const requesterId = req.userId;

    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if requester is the owner
    const isOwner = String(post.userId) === String(requesterId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this post'
      });
    }

    // Check if post is archived
    if (!post.archived) {
      return res.status(400).json({
        success: false,
        message: 'Only archived posts can be permanently deleted'
      });
    }

    // Delete related data
    await Promise.all([
      PostLike.deleteMany({ postId }),
      PostComment.deleteMany({ postId }),
    ]);

    // Delete the post
    await Post.findByIdAndDelete(postId);

    res.status(200).json({
      success: true,
      message: 'Post permanently deleted'
    });

  } catch (error) {
    console.error('Error permanently deleting post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Restore archived post
export const restorePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const requesterId = req.userId;

    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if requester is the owner
    const isOwner = String(post.userId) === String(requesterId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to restore this post'
      });
    }

    // Check if post is archived
    if (!post.archived) {
      return res.status(400).json({
        success: false,
        message: 'Post is not archived'
      });
    }

    // Check if post is archived by reports (cannot restore by user)
    if (post.archivedByReports) {
      return res.status(403).json({
        success: false,
        message: 'Post này bị ẩn do báo cáo. Chỉ admin mới có thể khôi phục.'
      });
    }

    // Restore the post
    post.archived = false;
    post.archivedAt = null;
    await post.save();

    res.status(200).json({
      success: true,
      message: 'Post restored successfully'
    });

  } catch (error) {
    console.error('Error restoring post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get archived posts for current user
export const getArchivedPosts = async (req, res) => {
  try {
    const requesterId = req.userId;
    
    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({
      userId: requesterId,
      archived: true,
    })
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId')
      .populate('projectId', 'title description coverImageUrl status')
      .populate('attachedLicks', 'title description audioUrl waveformData duration tabNotation key tempo difficulty status isPublic createdAt updatedAt')
      .sort({ archivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments({
      userId: requesterId,
      archived: true,
    });
    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      success: true,
      data: {
        posts,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching archived posts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Like a post (idempotent)
export const likePost = async (req, res) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    try {
      const like = await PostLike.create({ postId, userId });
      
      // Tạo thông báo cho chủ bài đăng (nếu không phải tự like)
      if (String(post.userId) !== String(userId)) {
        const { notifyPostLiked } = await import('../utils/notificationHelper.js');
        notifyPostLiked(post.userId, userId, postId).catch(err => {
          console.error('Lỗi khi tạo thông báo like:', err);
        });
      }
      
      return res.status(201).json({ success: true, liked: true, data: { id: like._id } });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(200).json({ success: true, liked: true, message: 'Already liked' });
      }
      throw err;
    }
  } catch (error) {
    console.error('likePost error:', error);
    return res.status(500).json({ success: false, message: 'Failed to like post' });
  }
};

// Unlike a post (idempotent)
export const unlikePost = async (req, res) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const deleted = await PostLike.findOneAndDelete({ postId, userId });
    if (!deleted) {
      return res.status(200).json({ success: true, liked: false, message: 'Not liked yet' });
    }
    return res.status(200).json({ success: true, liked: false });
  } catch (error) {
    console.error('unlikePost error:', error);
    return res.status(500).json({ success: false, message: 'Failed to unlike post' });
  }
};

// Get post stats: likes count and top-level comments count
export const getPostStats = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId).lean();
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    const [likesCount, commentsCount] = await Promise.all([
      PostLike.countDocuments({ postId }),
      PostComment.countDocuments({ postId, parentCommentId: { $exists: false } })
    ]);
    return res.status(200).json({ success: true, data: { likesCount, commentsCount } });
  } catch (error) {
    console.error('getPostStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get post stats' });
  }
};

// Get list of users who liked a post
export const getPostLikes = async (req, res) => {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const post = await Post.findById(postId).lean();
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const likes = await PostLike.find({ postId })
      .populate('userId', 'username displayName avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalLikes = await PostLike.countDocuments({ postId });

    const users = likes
      .filter(like => like.userId && like.userId._id) // Filter out deleted users
      .map(like => ({
        id: like.userId._id,
        username: like.userId.username,
        displayName: like.userId.displayName,
        avatarUrl: like.userId.avatarUrl,
        likedAt: like.createdAt
      }));

    return res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalLikes / limit),
          totalLikes,
          hasNextPage: page < Math.ceil(totalLikes / limit),
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('getPostLikes error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get post likes' });
  }
};
