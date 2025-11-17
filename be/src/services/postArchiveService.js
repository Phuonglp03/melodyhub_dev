import Post from '../models/Post.js';
import PostLike from '../models/PostLike.js';
import PostComment from '../models/PostComment.js';

/**
 * Permanently delete archived posts that are older than 30 days
 * This function should be called periodically (e.g., daily)
 */
export const deleteOldArchivedPosts = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find all archived posts that were archived more than 30 days ago
    const oldArchivedPosts = await Post.find({
      archived: true,
      archivedAt: { $lte: thirtyDaysAgo },
    });

    if (oldArchivedPosts.length === 0) {
      console.log('[PostArchive] No old archived posts to delete');
      return { deleted: 0 };
    }

    const postIds = oldArchivedPosts.map((post) => post._id);

    // Delete related data
    await Promise.all([
      PostLike.deleteMany({ postId: { $in: postIds } }),
      PostComment.deleteMany({ postId: { $in: postIds } }),
    ]);

    // Delete the posts
    const result = await Post.deleteMany({
      _id: { $in: postIds },
    });

    console.log(`[PostArchive] Permanently deleted ${result.deletedCount} archived posts older than 30 days`);

    return { deleted: result.deletedCount };
  } catch (error) {
    console.error('[PostArchive] Error deleting old archived posts:', error);
    throw error;
  }
};

