import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { adminUnbanUser } from "../src/controllers/admin/reportController.js";
import User from "../src/models/User.js";

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

describe("adminUnbanUser controller", () => {
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
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    vi.clearAllMocks();
  });

  it("TC1 – Admin unban user thành công (200)", async () => {
    const bannedUser = await User.create({
      email: "banned@example.com",
      passwordHash: "hash",
      username: "banned1",
      displayName: "Banned User",
      livestreamBanned: true,
      livestreamBannedAt: new Date(),
      livestreamBannedReason: "Vi phạm",
    });

    const req = {
      params: { userId: bannedUser._id.toString() },
      userId: "admin-id",
    };
    const res = createMockRes();

    await adminUnbanUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify DB
    const updatedUser = await User.findById(bannedUser._id);
    expect(updatedUser.livestreamBanned).toBe(false);
    expect(updatedUser.livestreamBannedAt).toBeNull();
    expect(updatedUser.livestreamBannedReason).toBeNull();
  });

  it("TC2 – User không tồn tại trả về 404", async () => {
    const nonExistentUserId = new mongoose.Types.ObjectId().toString();

    const req = {
      params: { userId: nonExistentUserId },
      userId: "admin-id",
    };
    const res = createMockRes();

    await adminUnbanUser(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("TC3 – User không bị ban trả về 400", async () => {
    const normalUser = await User.create({
      email: "normal@example.com",
      passwordHash: "hash",
      username: "normal",
      displayName: "Normal User",
      livestreamBanned: false,
    });

    const req = {
      params: { userId: normalUser._id.toString() },
      userId: "admin-id",
    };
    const res = createMockRes();

    await adminUnbanUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("không bị cấm");
  });

  it("TC4 – Admin unban user chưa có field livestreamBanned", async () => {
    const newUser = await User.create({
      email: "newuser@example.com",
      passwordHash: "hash",
      username: "newuser",
      displayName: "New User",
      // no livestreamBanned field
    });

    const req = {
      params: { userId: newUser._id.toString() },
      userId: "admin-id",
    };
    const res = createMockRes();

    await adminUnbanUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

