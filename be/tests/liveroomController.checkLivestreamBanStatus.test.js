import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { checkLivestreamBanStatus } from "../src/controllers/user/liveroomController.js";
import User from "../src/models/User.js";

const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

describe("checkLivestreamBanStatus controller", () => {
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
  });

  it("TC1 – 200 OK: user không bị ban", async () => {
    const user = await User.create({
      email: "ok@example.com",
      passwordHash: "hash",
      username: "okuser",
      displayName: "OK User",
      livestreamBanned: false,
    });

    const req = { userId: user._id.toString() };
    const res = createMockRes();

    await checkLivestreamBanStatus(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      banned: false,
      bannedAt: null,
      reason: null,
    });
  });

  it("TC2 – 200 OK: user bị ban, trả về banned=true + reason", async () => {
    const bannedAt = new Date("2025-01-01T00:00:00.000Z");
    const user = await User.create({
      email: "banned@example.com",
      passwordHash: "hash",
      username: "banned",
      displayName: "Banned User",
      livestreamBanned: true,
      livestreamBannedAt: bannedAt,
      livestreamBannedReason: "Vi phạm cộng đồng",
    });

    const req = { userId: user._id.toString() };
    const res = createMockRes();

    await checkLivestreamBanStatus(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.banned).toBe(true);
    expect(new Date(res.body.bannedAt).getTime()).toBe(bannedAt.getTime());
    expect(res.body.reason).toBe("Vi phạm cộng đồng");
  });

  it("TC3 – 404 Not Found: user không tồn tại", async () => {
    const req = { userId: new mongoose.Types.ObjectId().toString() };
    const res = createMockRes();

    await checkLivestreamBanStatus(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: "Không tìm thấy người dùng." });
  });

  it("TC4 – 200 OK: user bị ban nhưng không có reason", async () => {
    const bannedAt = new Date("2025-01-15T00:00:00.000Z");
    const user = await User.create({
      email: "bannednoreason@example.com",
      passwordHash: "hash",
      username: "bannednoreason",
      displayName: "Banned No Reason",
      livestreamBanned: true,
      livestreamBannedAt: bannedAt,
      // không có livestreamBannedReason
    });

    const req = { userId: user._id.toString() };
    const res = createMockRes();

    await checkLivestreamBanStatus(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.banned).toBe(true);
    expect(new Date(res.body.bannedAt).getTime()).toBe(bannedAt.getTime());
    expect(res.body.reason).toBeNull();
  });

  it("TC5 – 200 OK: user mới tạo (chưa có field livestreamBanned)", async () => {
    const user = await User.create({
      email: "newuser@example.com",
      passwordHash: "hash",
      username: "newuser",
      displayName: "New User",
      // không có livestreamBanned, livestreamBannedAt, livestreamBannedReason
    });

    const req = { userId: user._id.toString() };
    const res = createMockRes();

    await checkLivestreamBanStatus(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.banned).toBe(false);
    expect(res.body.bannedAt).toBeNull();
    expect(res.body.reason).toBeNull();
  });
});


