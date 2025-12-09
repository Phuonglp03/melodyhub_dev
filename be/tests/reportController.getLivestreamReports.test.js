import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { getLivestreamReports } from "../src/controllers/admin/reportController.js";
import LiveRoom from "../src/models/LiveRoom.js";
import User from "../src/models/User.js";
import ContentReport from "../src/models/ContentReport.js";

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

describe("getLivestreamReports controller", () => {
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

  it("TC1 – Admin get livestream reports thành công (200)", async () => {
    const host = await User.create({
      email: "host@example.com",
      passwordHash: "hash",
      username: "host1",
      displayName: "Host 1",
    });

    const reporter = await User.create({
      email: "reporter@example.com",
      passwordHash: "hash",
      username: "reporter1",
      displayName: "Reporter 1",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-1",
    });

    await ContentReport.create({
      reporterId: reporter._id,
      targetContentType: "room",
      targetContentId: room._id,
      reason: "spam",
      status: "pending",
    });

    const req = { query: {} };
    const res = createMockRes();

    await getLivestreamReports(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reports).toHaveLength(1);
    expect(res.body.data.reports[0]).toHaveProperty("room");
    expect(res.body.data.reports[0]).toHaveProperty("reportCount");
    expect(res.body.data).toHaveProperty("pagination");
  });

  it("TC2 – Admin get livestream reports với filter status=pending (200)", async () => {
    const host = await User.create({
      email: "host2@example.com",
      passwordHash: "hash",
      username: "host2",
      displayName: "Host 2",
    });

    const reporter = await User.create({
      email: "reporter2@example.com",
      passwordHash: "hash",
      username: "reporter2",
      displayName: "Reporter 2",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 2",
      status: "live",
      privacyType: "public",
      streamKey: "key-2",
    });

    await ContentReport.create({
      reporterId: reporter._id,
      targetContentType: "room",
      targetContentId: room._id,
      reason: "spam",
      status: "pending",
    });

    await ContentReport.create({
      reporterId: reporter._id,
      targetContentType: "room",
      targetContentId: room._id,
      reason: "inappropriate",
      status: "resolved",
    });

    const req = { query: { status: "pending" } };
    const res = createMockRes();

    await getLivestreamReports(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.reports).toHaveLength(1);
    expect(res.body.data.reports[0].status).toBe("pending");
  });

  it("TC3 – Admin get livestream reports với pagination (200)", async () => {
    const host = await User.create({
      email: "host3@example.com",
      passwordHash: "hash",
      username: "host3",
      displayName: "Host 3",
    });

    const reporter = await User.create({
      email: "reporter3@example.com",
      passwordHash: "hash",
      username: "reporter3",
      displayName: "Reporter 3",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 3",
      status: "live",
      privacyType: "public",
      streamKey: "key-3",
    });

    // Create 5 reports
    for (let i = 0; i < 5; i++) {
      await ContentReport.create({
        reporterId: reporter._id,
        targetContentType: "room",
        targetContentId: room._id,
        reason: "spam",
        status: "pending",
      });
    }

    const req = { query: { page: 1, limit: 2 } };
    const res = createMockRes();

    await getLivestreamReports(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.reports).toHaveLength(2);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.limit).toBe(2);
    expect(res.body.data.pagination.total).toBe(5);
  });

  it("TC4 – Admin get livestream reports với filter status=resolved (200)", async () => {
    const host = await User.create({
      email: "host4@example.com",
      passwordHash: "hash",
      username: "host4",
      displayName: "Host 4",
    });

    const reporter = await User.create({
      email: "reporter4@example.com",
      passwordHash: "hash",
      username: "reporter4",
      displayName: "Reporter 4",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 4",
      status: "ended",
      privacyType: "public",
      streamKey: "key-4",
    });

    await ContentReport.create({
      reporterId: reporter._id,
      targetContentType: "room",
      targetContentId: room._id,
      reason: "spam",
      status: "resolved",
    });

    const req = { query: { status: "resolved" } };
    const res = createMockRes();

    await getLivestreamReports(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.reports).toHaveLength(1);
    expect(res.body.data.reports[0].status).toBe("resolved");
  });

  it("TC5 – Admin get livestream reports với page 2 (200)", async () => {
    const host = await User.create({
      email: "host5@example.com",
      passwordHash: "hash",
      username: "host5",
      displayName: "Host 5",
    });

    const reporter = await User.create({
      email: "reporter5@example.com",
      passwordHash: "hash",
      username: "reporter5",
      displayName: "Reporter 5",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 5",
      status: "live",
      privacyType: "public",
      streamKey: "key-5",
    });

    // Create 5 reports
    for (let i = 0; i < 5; i++) {
      await ContentReport.create({
        reporterId: reporter._id,
        targetContentType: "room",
        targetContentId: room._id,
        reason: "spam",
        status: "pending",
      });
    }

    const req = { query: { page: 2, limit: 2 } };
    const res = createMockRes();

    await getLivestreamReports(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.reports).toHaveLength(2);
    expect(res.body.data.pagination.page).toBe(2);
  });

  it("TC6 – Admin get livestream reports không có reports (200)", async () => {
    const req = { query: {} };
    const res = createMockRes();

    await getLivestreamReports(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reports).toHaveLength(0);
    expect(res.body.data.pagination.total).toBe(0);
  });
});

