import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { createLiveStream } from "../src/controllers/user/liveroomController.js";
import User from "../src/models/User.js";
import LiveRoom from "../src/models/LiveRoom.js";

// Helper tạo req/res giả cho Express
const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((data) => {
    res.body = data;
    return res;
  });
  return res;
};

describe("createLiveStream controller", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  afterEach(async () => {
    // Xoá toàn bộ collection sau mỗi test
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    vi.restoreAllMocks();
  });

  it("TC1 – tạo phòng thành công khi user không bị ban và title hợp lệ (201)", async () => {
    const user = await User.create({
      email: "ok@example.com",
      passwordHash: "hash",
      username: "okuser",
      displayName: "OK User",
      livestreamBanned: false,
    });

    const req = {
      body: { title: "Test stream", description: "desc", privacyType: "public" },
      userId: user._id.toString(),
    };
    const res = createMockRes();

    await createLiveStream(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("room");
    expect(res.body).toMatchObject({
      message: "Tạo phòng live thành công. Hãy dùng stream key để bắt đầu.",
    });

    const roomInDb = await LiveRoom.findOne({ hostId: user._id });
    expect(roomInDb).not.toBeNull();
    expect(roomInDb.title).toBe("Test stream");
    expect(roomInDb.status).toBe("waiting");
  });

  it("TC2 – trả về 403 nếu user bị cấm livestream (banned=true)", async () => {
    const bannedUser = await User.create({
      email: "banned@example.com",
      passwordHash: "hash",
      username: "banned",
      displayName: "Banned User",
      livestreamBanned: true,
      livestreamBannedReason: "Vi phạm",
      livestreamBannedAt: new Date(),
    });

    const req = {
      body: { title: "Banned stream" },
      userId: bannedUser._id.toString(),
    };
    const res = createMockRes();

    await createLiveStream(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      banned: true,
      reason: "Vi phạm",
    });

    const roomInDb = await LiveRoom.findOne({ hostId: bannedUser._id });
    expect(roomInDb).toBeNull();
  });

  it("TC3 – tạo phòng thành công với title rỗng (title được validate khi goLive)", async () => {
    // Note: createLiveStream không validate title, chỉ goLive mới validate
    const user = await User.create({
      email: "short@example.com",
      passwordHash: "hash",
      username: "shortuser",
      displayName: "Short User",
      livestreamBanned: false,
    });

    const req = {
      body: { title: "   " }, // chỉ whitespace - được chấp nhận ở createLiveStream
      userId: user._id.toString(),
    };
    const res = createMockRes();

    await createLiveStream(req, res);

    // createLiveStream chấp nhận title bất kỳ (validation xảy ra ở goLive)
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("room");

    const roomInDb = await LiveRoom.findOne({ hostId: user._id });
    expect(roomInDb).not.toBeNull();
    // Title có thể bị trim bởi model hoặc lưu rỗng
    expect(roomInDb.title === "   " || roomInDb.title === "" || roomInDb.title?.trim() === "").toBe(true);
  });

  it("TC4 – trả về 500 nếu lỗi khi lưu room (Internal Server Error)", async () => {
    const user = await User.create({
      email: "error@example.com",
      passwordHash: "hash",
      username: "erroruser",
      displayName: "Error User",
      livestreamBanned: false,
    });

    const req = {
      body: { title: "Valid title", privacyType: "public" },
      userId: user._id.toString(),
    };
    const res = createMockRes();

    // Mock lỗi khi save
    vi.spyOn(LiveRoom.prototype, "save").mockRejectedValue(new Error("DB error"));

    await createLiveStream(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      message: "Lỗi server khi tạo phòng.",
    });
  });

  it("TC5 – trả về 404 nếu user không tồn tại", async () => {
    const nonExistentUserId = new mongoose.Types.ObjectId().toString();

    const req = {
      body: { title: "Test stream", privacyType: "public" },
      userId: nonExistentUserId,
    };
    const res = createMockRes();

    await createLiveStream(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      message: "Không tìm thấy người dùng.",
    });
  });

  it("TC6 – tạo phòng với privacyType = follow_only (201)", async () => {
    const user = await User.create({
      email: "private@example.com",
      passwordHash: "hash",
      username: "privateuser",
      displayName: "Private User",
      livestreamBanned: false,
    });

    const req = {
      body: { title: "Private stream", description: "Private desc", privacyType: "follow_only" },
      userId: user._id.toString(),
    };
    const res = createMockRes();

    await createLiveStream(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("room");

    const roomInDb = await LiveRoom.findOne({ hostId: user._id });
    expect(roomInDb).not.toBeNull();
    expect(roomInDb.privacyType).toBe("follow_only");
  });

  it("TC7 – tạo phòng với description (201)", async () => {
    const user = await User.create({
      email: "desc@example.com",
      passwordHash: "hash",
      username: "descuser",
      displayName: "Desc User",
      livestreamBanned: false,
    });

    const req = {
      body: { title: "Stream with desc", description: "This is a test description" },
      userId: user._id.toString(),
    };
    const res = createMockRes();

    await createLiveStream(req, res);

    expect(res.statusCode).toBe(201);

    const roomInDb = await LiveRoom.findOne({ hostId: user._id });
    expect(roomInDb).not.toBeNull();
    expect(roomInDb.description).toBe("This is a test description");
  });

  it("TC8 – tạo phòng không có description (201, description = null)", async () => {
    const user = await User.create({
      email: "nodesc@example.com",
      passwordHash: "hash",
      username: "nodescuser",
      displayName: "NoDesc User",
      livestreamBanned: false,
    });

    const req = {
      body: { title: "Stream without desc" },
      userId: user._id.toString(),
    };
    const res = createMockRes();

    await createLiveStream(req, res);

    expect(res.statusCode).toBe(201);

    const roomInDb = await LiveRoom.findOne({ hostId: user._id });
    expect(roomInDb).not.toBeNull();
    expect(roomInDb.description).toBeNull();
  });
});


