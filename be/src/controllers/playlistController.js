import mongoose from "mongoose";
import Playlist from "../models/Playlist.js";
import PlaylistLick from "../models/PlaylistLick.js";
import Lick from "../models/Lick.js";
import User from "../models/User.js";
import LickLike from "../models/LickLike.js";
import LickComment from "../models/LickComment.js";
import ContentTag from "../models/ContentTag.js";

// Get community playlists (public playlists)
export const getCommunityPlaylists = async (req, res) => {
  try {
    const { search, sortBy = "newest", page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build match stage - only public playlists
    const matchStage = { isPublic: true };

    // Apply search filter
    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort stage
    let sortStage = {};
    switch (sortBy) {
      case "popular":
        // Sort by licks count (calculated in aggregation)
        sortStage = { licksCount: -1, createdAt: -1 };
        break;
      case "newest":
      default:
        sortStage = { createdAt: -1 };
    }

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "owner",
        },
      },
      {
        $lookup: {
          from: "playlistlicks",
          localField: "_id",
          foreignField: "playlistId",
          as: "licks",
        },
      },
      {
        $addFields: {
          licksCount: { $size: "$licks" },
          owner: { $arrayElemAt: ["$owner", 0] },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          coverImageUrl: 1,
          isPublic: 1,
          createdAt: 1,
          updatedAt: 1,
          licksCount: 1,
          owner: {
            _id: 1,
            username: 1,
            displayName: 1,
            avatarUrl: 1,
          },
        },
      },
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limitNum },
    ];

    // Get total count
    const totalCountPipeline = [{ $match: matchStage }, { $count: "count" }];

    const [playlists, totalResult] = await Promise.all([
      Playlist.aggregate(pipeline),
      Playlist.aggregate(totalCountPipeline),
    ]);

    const totalPlaylists = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(totalPlaylists / limitNum);

    // Format response
    const formattedPlaylists = playlists.map((playlist) => ({
      playlist_id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      cover_image_url: playlist.coverImageUrl,
      is_public: playlist.isPublic,
      licks_count: playlist.licksCount,
      created_at: playlist.createdAt,
      updated_at: playlist.updatedAt,
      owner: playlist.owner
        ? {
            user_id: playlist.owner._id,
            display_name:
              playlist.owner.displayName ||
              playlist.owner.username ||
              "Unknown",
            username: playlist.owner.username || "",
            avatar_url: playlist.owner.avatarUrl || null,
          }
        : null,
    }));

    res.status(200).json({
      success: true,
      data: formattedPlaylists,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalPlaylists,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching community playlists:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UC-15, Screen 29: Get user's playlists (My Playlists)
// Note: If route has :userId param (e.g. /playlists/user/:userId) we should
// prioritise that over the authenticated user so that we can view playlists
// of other users (public only) on their profile page.
export const getMyPlaylists = async (req, res) => {
  try {
    const userId = req.params.userId || req.userId || req.user?.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId",
      });
    }

    const { search, isPublic, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    let query = { userId: new mongoose.Types.ObjectId(userId) };

    // Apply search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Apply isPublic filter
    if (isPublic !== undefined) {
      query.isPublic = isPublic === "true" || isPublic === true;
    }

    // Get playlists with lick counts
    const playlists = await Playlist.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "playlistlicks",
          localField: "_id",
          foreignField: "playlistId",
          as: "licks",
        },
      },
      {
        $addFields: {
          licksCount: { $size: "$licks" },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          coverImageUrl: 1,
          isPublic: 1,
          createdAt: 1,
          updatedAt: 1,
          licksCount: 1,
        },
      },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
    ]);

    // Get total count for pagination
    const totalPlaylists = await Playlist.countDocuments(query);
    const totalPages = Math.ceil(totalPlaylists / limitNum);

    // Format response
    const formattedPlaylists = playlists.map((playlist) => ({
      playlist_id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      cover_image_url: playlist.coverImageUrl,
      is_public: playlist.isPublic,
      licks_count: playlist.licksCount,
      created_at: playlist.createdAt,
      updated_at: playlist.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedPlaylists,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalPlaylists,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching user's playlists:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Screen 31: Get playlist detail with all licks
export const getPlaylistById = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const userId = req.userId || req.user?.id; // Optional: for checking ownership

    // Guard: avoid casting errors when route params are non-ObjectId (e.g., 'community')
    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid playlist id",
      });
    }

    // Get playlist
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    // Check if user can view this playlist
    if (!playlist.isPublic && String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this playlist",
      });
    }

    // Get playlist owner info
    const owner = await User.findById(playlist.userId).select(
      "username displayName avatarUrl"
    );

    // Get all licks in this playlist with full details
    const playlistLicks = await PlaylistLick.find({ playlistId })
      .sort({ position: 1, addedAt: 1 })
      .populate({
        path: "lickId",
        populate: [
          {
            path: "userId",
            select: "username displayName avatarUrl",
          },
        ],
      })
      .lean();

    // Get additional data for each lick (likes, comments, tags)
    const licksWithDetails = await Promise.all(
      playlistLicks.map(async (pl) => {
        if (!pl.lickId) return null;

        const lick = pl.lickId;
        const lickId = lick._id;

        // Get likes count
        const likesCount = await LickLike.countDocuments({ lickId });

        // Get comments count
        const commentsCount = await LickComment.countDocuments({ lickId });

        // Get tags using unified content tagging model
        const lickTags = await ContentTag.find({
          contentId: lickId,
          contentType: "lick",
        })
          .populate("tagId")
          .lean();
        const tags = lickTags
          .filter((lt) => !!lt.tagId)
          .map((lt) => ({
            tag_id: lt.tagId._id,
            tag_name: lt.tagId.name,
            tag_type: lt.tagId.type,
          }));

        return {
          lick_id: lick._id,
          title: lick.title,
          description: lick.description,
          audio_url: lick.audioUrl,
          waveform_data: lick.waveformData,
          duration: lick.duration,
          tab_notation: lick.tabNotation,
          key: lick.key,
          tempo: lick.tempo,
          difficulty: lick.difficulty,
          is_featured: lick.isFeatured,
          creator: {
            user_id: lick.userId?._id,
            display_name: lick.userId?.displayName || lick.userId?.username,
            username: lick.userId?.username || "",
            avatar_url: lick.userId?.avatarUrl,
          },
          tags: tags,
          likes_count: likesCount,
          comments_count: commentsCount,
          position: pl.position,
          added_at: pl.addedAt,
          created_at: lick.createdAt,
        };
      })
    );

    // Filter out null values (in case of deleted licks)
    const validLicks = licksWithDetails.filter((lick) => lick !== null);

    // Format response
    const formattedPlaylist = {
      playlist_id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      cover_image_url: playlist.coverImageUrl,
      is_public: playlist.isPublic,
      owner: {
        user_id: owner?._id,
        display_name: owner?.displayName || owner?.username,
        username: owner?.username || "",
        avatar_url: owner?.avatarUrl,
      },
      licks: validLicks,
      licks_count: validLicks.length,
      created_at: playlist.createdAt,
      updated_at: playlist.updatedAt,
    };

    res.status(200).json({
      success: true,
      data: formattedPlaylist,
    });
  } catch (error) {
    console.error("Error fetching playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UC-16, Screen 30: Create a new playlist
export const createPlaylist = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { name, description, coverImageUrl, isPublic, lickIds } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Playlist name is required",
      });
    }

    // Create playlist
    const newPlaylist = new Playlist({
      userId,
      name: name.trim(),
      description: description?.trim() || "",
      coverImageUrl: coverImageUrl || "",
      isPublic: isPublic !== undefined ? isPublic : true,
    });

    await newPlaylist.save();

    // Add licks to playlist if provided
    if (lickIds && Array.isArray(lickIds) && lickIds.length > 0) {
      // Validate that all licks exist
      const validLickIds = lickIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );

      // Build query based on playlist privacy
      // Business Rule: Public playlists can only contain public licks
      // Private playlists can contain both public and private licks (owned by user)
      const lickQuery = { _id: { $in: validLickIds } };

      if (newPlaylist.isPublic) {
        // Only public licks for public playlists
        lickQuery.isPublic = true;
      } else {
        // For private playlists: public licks OR private licks owned by user
        // Optimize query at database level instead of filtering in memory
        lickQuery.$or = [
          { isPublic: true },
          { isPublic: false, userId: new mongoose.Types.ObjectId(userId) },
        ];
      }

      const existingLicks = await Lick.find(lickQuery)
        .select("_id isPublic userId")
        .lean(); // Use lean() for better performance when we only need plain objects

      // Validate that all requested licks were found and allowed
      const foundLickIds = new Set(
        existingLicks.map((lick) => lick._id.toString())
      );
      const missingLickIds = validLickIds.filter((id) => !foundLickIds.has(id));

      if (missingLickIds.length > 0) {
        if (newPlaylist.isPublic) {
          return res.status(400).json({
            success: false,
            message:
              "Public playlists can only contain public licks. Some selected licks are private or not found.",
          });
        } else {
          // For private playlists, check missing licks in a single optimized query
          // Query all missing licks to determine if they exist and are valid
          const missingLicks = await Lick.find({
            _id: { $in: missingLickIds },
          })
            .select("_id isPublic userId")
            .lean();

          const missingLickIdsSet = new Set(
            missingLicks.map((lick) => lick._id.toString())
          );
          const nonExistentLickIds = missingLickIds.filter(
            (id) => !missingLickIdsSet.has(id)
          );

          // Check for invalid private licks (private licks from other users)
          const invalidLicks = missingLicks.filter(
            (lick) => !lick.isPublic && String(lick.userId) !== String(userId)
          );

          if (invalidLicks.length > 0) {
            return res.status(400).json({
              success: false,
              message:
                "Private playlists can only contain your own private licks or community licks.",
            });
          }

          if (nonExistentLickIds.length > 0) {
            return res.status(400).json({
              success: false,
              message: "Some selected licks were not found.",
            });
          }
        }
      }

      const existingLickIds = existingLicks.map((lick) => lick._id.toString());

      // Add licks to playlist with positions
      const playlistLicksToAdd = existingLickIds.map((lickId, index) => ({
        playlistId: newPlaylist._id,
        lickId: new mongoose.Types.ObjectId(lickId),
        position: index + 1,
      }));

      if (playlistLicksToAdd.length > 0) {
        await PlaylistLick.insertMany(playlistLicksToAdd);
      }
    }

    // Get the created playlist with lick count
    const playlistWithCount = await Playlist.aggregate([
      { $match: { _id: newPlaylist._id } },
      {
        $lookup: {
          from: "playlistlicks",
          localField: "_id",
          foreignField: "playlistId",
          as: "licks",
        },
      },
      {
        $addFields: {
          licksCount: { $size: "$licks" },
        },
      },
    ]);

    const formattedPlaylist = {
      playlist_id: playlistWithCount[0]._id,
      name: playlistWithCount[0].name,
      description: playlistWithCount[0].description,
      cover_image_url: playlistWithCount[0].coverImageUrl,
      is_public: playlistWithCount[0].isPublic,
      licks_count: playlistWithCount[0].licksCount,
      created_at: playlistWithCount[0].createdAt,
      updated_at: playlistWithCount[0].updatedAt,
    };

    res.status(201).json({
      success: true,
      message: "Playlist created successfully",
      data: formattedPlaylist,
    });
  } catch (error) {
    console.error("Error creating playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UC-17, Screen 32: Update playlist
export const updatePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Find playlist and check ownership
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    if (String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to edit this playlist",
      });
    }

    // Update allowed fields
    const allowedFields = ["name", "description", "coverImageUrl", "isPublic"];
    const update = {};

    for (const field of allowedFields) {
      if (field in req.body) {
        if (field === "name" && req.body[field]) {
          update[field] = req.body[field].trim();
        } else if (field === "description") {
          update[field] = req.body[field]?.trim() || "";
        } else if (field === "isPublic") {
          update[field] =
            typeof req.body[field] === "string"
              ? req.body[field] === "true"
              : req.body[field];
        } else {
          update[field] = req.body[field];
        }
      }
    }

    // Validate name if being updated
    if (update.name && update.name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Playlist name cannot be empty",
      });
    }

    // Business Rule: If changing playlist from private to public,
    // check that all licks in the playlist are public
    if (update.isPublic === true && playlist.isPublic === false) {
      // Get all licks in the playlist
      const playlistLicks = await PlaylistLick.find({ playlistId }).populate(
        "lickId",
        "isPublic"
      );

      // Check if any lick is private
      const hasPrivateLicks = playlistLicks.some(
        (pl) => pl.lickId && !pl.lickId.isPublic
      );

      if (hasPrivateLicks) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot make playlist public. It contains private licks. Please remove private licks first or make them public.",
        });
      }
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      update,
      { new: true, runValidators: true }
    );

    // Get lick count
    const licksCount = await PlaylistLick.countDocuments({ playlistId });

    const formattedPlaylist = {
      playlist_id: updatedPlaylist._id,
      name: updatedPlaylist.name,
      description: updatedPlaylist.description,
      cover_image_url: updatedPlaylist.coverImageUrl,
      is_public: updatedPlaylist.isPublic,
      licks_count: licksCount,
      created_at: updatedPlaylist.createdAt,
      updated_at: updatedPlaylist.updatedAt,
    };

    res.status(200).json({
      success: true,
      message: "Playlist updated successfully",
      data: formattedPlaylist,
    });
  } catch (error) {
    console.error("Error updating playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Screen 33: Delete playlist
export const deletePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Find playlist and check ownership
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    if (String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this playlist",
      });
    }

    // Delete all playlist-lick relationships
    await PlaylistLick.deleteMany({ playlistId });

    // Delete the playlist
    await Playlist.findByIdAndDelete(playlistId);

    res.status(200).json({
      success: true,
      message: "Playlist deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Screen 24: Add lick to playlist
export const addLickToPlaylist = async (req, res) => {
  try {
    const { playlistId, lickId } = req.params;
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Validate playlist exists and user owns it
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    if (String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to modify this playlist",
      });
    }

    // Validate lick exists - use lean() for better performance since we only need plain object
    const lick = await Lick.findById(lickId).select("isPublic userId").lean();
    if (!lick) {
      return res.status(404).json({
        success: false,
        message: "Lick not found",
      });
    }

    // Business Rule: If playlist is public, only allow public licks
    if (playlist.isPublic && !lick.isPublic) {
      return res.status(400).json({
        success: false,
        message: "Public playlists can only contain public licks",
      });
    }

    // Business Rule: If playlist is private and lick is private,
    // only allow if the lick belongs to the playlist owner
    if (!playlist.isPublic && !lick.isPublic) {
      if (String(lick.userId) !== String(userId)) {
        return res.status(403).json({
          success: false,
          message:
            "Private playlists can only contain your own private licks or community licks",
        });
      }
    }

    // Check if lick is already in playlist
    const existingPlaylistLick = await PlaylistLick.findOne({
      playlistId,
      lickId,
    });

    if (existingPlaylistLick) {
      return res.status(400).json({
        success: false,
        message: "Lick is already in this playlist",
      });
    }

    // Get current max position
    const maxPositionDoc = await PlaylistLick.findOne({ playlistId })
      .sort({ position: -1 })
      .select("position")
      .lean();

    const nextPosition = maxPositionDoc ? maxPositionDoc.position + 1 : 1;

    // Add lick to playlist
    const newPlaylistLick = new PlaylistLick({
      playlistId,
      lickId,
      position: nextPosition,
    });

    await newPlaylistLick.save();

    res.status(201).json({
      success: true,
      message: "Lick added to playlist successfully",
      data: {
        playlist_id: playlistId,
        lick_id: lickId,
        position: nextPosition,
        added_at: newPlaylistLick.addedAt,
      },
    });
  } catch (error) {
    console.error("Error adding lick to playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Remove lick from playlist
export const removeLickFromPlaylist = async (req, res) => {
  try {
    const { playlistId, lickId } = req.params;
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Validate playlist exists and user owns it
    const playlist = await Playlist.findById(playlistId).lean();
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    if (String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to modify this playlist",
      });
    }

    // Get the lick being removed to know its position
    const lickToRemove = await PlaylistLick.findOne({
      playlistId,
      lickId,
    })
      .select("position")
      .lean();

    if (!lickToRemove) {
      return res.status(404).json({
        success: false,
        message: "Lick not found in this playlist",
      });
    }

    const removedPosition = lickToRemove.position;

    // Remove lick from playlist
    const result = await PlaylistLick.deleteOne({ playlistId, lickId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Lick not found in this playlist",
      });
    }

    // Reorder positions: decrement positions of all licks after the removed one
    await PlaylistLick.updateMany(
      {
        playlistId,
        position: { $gt: removedPosition },
      },
      {
        $inc: { position: -1 },
      }
    );

    res.status(200).json({
      success: true,
      message: "Lick removed from playlist successfully",
    });
  } catch (error) {
    console.error("Error removing lick from playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Reorder licks in playlist
export const reorderPlaylistLicks = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { lickIds } = req.body; // Array of lick IDs in new order
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!Array.isArray(lickIds) || lickIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "lickIds must be a non-empty array",
      });
    }

    // Validate playlist exists and user owns it
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    if (String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to modify this playlist",
      });
    }

    // Update positions for all licks
    const updatePromises = lickIds.map((lickId, index) => {
      return PlaylistLick.updateOne(
        { playlistId, lickId },
        { $set: { position: index + 1 } }
      );
    });

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "Playlist order updated successfully",
    });
  } catch (error) {
    console.error("Error reordering playlist licks:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
