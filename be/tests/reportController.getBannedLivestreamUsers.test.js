import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { getBannedLivestreamUsers } from "../src/controllers/admin/reportController.js";
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

describe("getBannedLivestreamUsers controller", () => {
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

  it("TC1 – Admin get banned users thành công (200)", async () => {
    const bannedUser1 = await User.create({
      email: "banned1@example.com",
      passwordHash: "hash",
      username: "banned1",
      displayName: "Banned User 1",
      livestreamBanned: true,
      livestreamBannedAt: new Date(),
      livestreamBannedReason: "Vi phạm",
    });

    const bannedUser2 = await User.create({
      email: "banned2@example.com",
      passwordHash: "hash",
      username: "banned2",
      displayName: "Banned User 2",
      livestreamBanned: true,
      livestreamBannedAt: new Date(),
      livestreamBannedReason: "Spam",
    });

    const req = { query: {} };
    const res = createMockRes();

    await getBannedLivestreamUsers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users).toHaveLength(2);
    expect(res.body.data.users[0]).toHaveProperty("livestreamBanned", true);
    expect(res.body.data).toHaveProperty("pagination");
  });

  it("TC2 – Admin get banned users với pagination (200)", async () => {
    // Create 5 banned users
    for (let i = 0; i < 5; i++) {
      await User.create({
        email: `banned${i}@example.com`,
        passwordHash: "hash",
        username: `banned${i}`,
        displayName: `Banned User ${i}`,
        livestreamBanned: true,
        livestreamBannedAt: new Date(),
      });
    }

    const req = { query: { page: 1, limit: 2 } };
    const res = createMockRes();

    await getBannedLivestreamUsers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.users).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(5);
  });

  it("TC3 – Admin get banned users chỉ lấy users bị ban (200)", async () => {
    await User.create({
      email: "banned@example.com",
      passwordHash: "hash",
      username: "banned",
      displayName: "Banned User",
      livestreamBanned: true,
      livestreamBannedAt: new Date(),
    });

    await User.create({
      email: "normal@example.com",
      passwordHash: "hash",
      username: "normal",
      displayName: "Normal User",
      livestreamBanned: false,
    });

    const req = { query: {} };
    const res = createMockRes();

    await getBannedLivestreamUsers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0].livestreamBanned).toBe(true);
  });
});

