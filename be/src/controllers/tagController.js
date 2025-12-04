import Tag from "../models/Tag.js";
import ContentTag from "../models/ContentTag.js";
import mongoose from "mongoose";

// GET /api/tags?type=genre
export const listTags = async (req, res) => {
  const { type } = req.query;
  const query = type ? { type } : {};
  const tags = await Tag.find(query).sort({ type: 1, name: 1 }).lean();
  // Group by type for convenient UI
  const grouped = tags.reduce((acc, t) => {
    acc[t.type] = acc[t.type] || [];
    acc[t.type].push({ tag_id: t._id, tag_name: t.name, tag_type: t.type });
    return acc;
  }, {});
  res.json({ success: true, data: grouped });
};

// POST /api/tags/bulk-upsert  body: [{ name, type }]
export const bulkUpsertTags = async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body?.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No items provided" });
    }

    // Filter out invalid items (empty or null names)
    const validItems = items.filter(
      (i) => i && i.name && String(i.name).trim().length > 0 && i.type
    );

    if (validItems.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid items provided" });
    }

    const ops = validItems.map((i) => {
      const normalizedName = String(i.name).trim().toLowerCase();
      const normalizedType = String(i.type).trim();
      return {
        updateOne: {
          filter: {
            type: normalizedType,
            name: normalizedName,
          },
          update: {
            $setOnInsert: {
              type: normalizedType,
              name: normalizedName,
            },
          },
          upsert: true,
        },
      };
    });

    await Tag.bulkWrite(ops, { ordered: false });

    const names = validItems.map((i) => String(i.name).trim().toLowerCase());
    const types = validItems.map((i) => String(i.type).trim());

    const out = await Tag.find({
      type: { $in: types },
      name: { $in: names },
    })
      .sort({ type: 1, name: 1 })
      .lean();

    res.json({ success: true, data: out });
  } catch (error) {
    console.error("Error in bulkUpsertTags:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upsert tags",
      error: error.message,
    });
  }
};

// PUT /api/content/:type/:id/tags  { tagIds: ObjectId[] }
export const replaceContentTags = async (req, res) => {
  const { type, id } = req.params;
  const tagIds = Array.isArray(req.body?.tagIds) ? req.body.tagIds : [];
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  await ContentTag.deleteMany({ contentType: type, contentId: id });
  if (tagIds.length > 0) {
    const docs = tagIds
      .filter((x) => mongoose.Types.ObjectId.isValid(x))
      .map((tagId) => ({ tagId, contentId: id, contentType: type }));
    if (docs.length) await ContentTag.insertMany(docs, { ordered: false });
  }
  res.json({ success: true });
};

// GET /api/tags/search?q=query - Search/suggest tags
export const searchTags = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const query = q.trim().toLowerCase();

    console.log("[DEBUG] (IS $) Tag search request:", { query, originalQ: req.query.q });

    let tagQuery = {};
    
    // If query is empty, return all tags (limit to reasonable number)
    // If query has characters, filter by matching name
    if (query.length > 0) {
      tagQuery.name = { $regex: query, $options: "i" };
    }

    console.log("[DEBUG] (IS $) Tag query:", tagQuery);

    const tags = await Tag.find(tagQuery)
      .sort({ name: 1 })
      .limit(50) // Limit results for performance
      .lean();

    console.log("[DEBUG] (IS $) Found tags:", tags.length);

    const formattedTags = tags.map((tag) => ({
      tag_id: tag._id,
      tag_name: tag.name,
      tag_type: tag.type,
    }));

    console.log("[DEBUG] (IS $) Formatted tags:", formattedTags.length);

    res.json({
      success: true,
      data: formattedTags,
    });
  } catch (error) {
    console.error("[DEBUG] (IS $) Error searching tags:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search tags",
      error: error.message,
    });
  }
};