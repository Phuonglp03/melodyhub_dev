import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { adminBanLivestream } from "../src/controllers/admin/reportController.js";
import LiveRoom from "../src/models/LiveRoom.js";
import User from "../src/models/User.js";
import ContentReport from "../src/models/ContentReport.js";
import { getSocketIo } from "../src/config/socket.js";

vi.mock("../src/config/socket.js", () => {
  const mockEmit = vi.fn();
  const mockTo = vi.fn(() => ({
    emit: mockEmit,
  }));
  const mockIo = {
    to: mockTo,
    emit: mockEmit,
  };
  return {
    getSocketIo: vi.fn(() => mockIo),
  };
});

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

describe("adminBanLivestream controller", () => {
  let mongo;
  let adminUser;

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

  it("TC1 – Admin ban livestream thành công với banUser=true (200)", async () => {
    // Create admin user with valid ObjectId
    adminUser = await User.create({
      email: "admin@example.com",
      passwordHash: "hash",
      username: "admin1",
      displayName: "Admin 1",
      role: "admin",
    });

    const host = await User.create({
      email: "host@example.com",
      passwordHash: "hash",
      username: "host1",
      displayName: "Host 1",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Live Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-1",
      startedAt: new Date(),
    });

    const req = {
      params: { roomId: room._id.toString() },
      body: { banUser: true, reason: "Vi phạm", resolveReports: false },
      userId: adminUser._id.toString(), // Use valid ObjectId
    };
    const res = createMockRes();

    await adminBanLivestream(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userBanned).toBe(true);

    // Verify DB
    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.status).toBe("ended");
    expect(updatedRoom.moderationStatus).toBe("banned");

    const updatedUser = await User.findById(host._id);
    expect(updatedUser.livestreamBanned).toBe(true);
    expect(updatedUser.livestreamBannedReason).toBe("Vi phạm");
  });

  it("TC2 – Admin ban livestream với banUser=false (200)", async () => {
    // Create admin user with valid ObjectId
    adminUser = await User.create({
      email: "admin2@example.com",
      passwordHash: "hash",
      username: "admin2",
      displayName: "Admin 2",
      role: "admin",
    });

    const host = await User.create({
      email: "host2@example.com",
      passwordHash: "hash",
      username: "host2",
      displayName: "Host 2",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Live Room 2",
      status: "live",
      privacyType: "public",
      streamKey: "key-2",
      startedAt: new Date(),
    });

    const req = {
      params: { roomId: room._id.toString() },
      body: { banUser: false, resolveReports: false },
      userId: adminUser._id.toString(), // Use valid ObjectId
    };
    const res = createMockRes();

    await adminBanLivestream(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.userBanned).toBe(false);

    const updatedUser = await User.findById(host._id);
    expect(updatedUser.livestreamBanned).toBeFalsy();
  });

  it("TC3 – Room không tồn tại trả về 404", async () => {
    const nonExistentRoomId = new mongoose.Types.ObjectId().toString();
    adminUser = await User.create({
      email: "admin3@example.com",
      passwordHash: "hash",
      username: "admin3",
      displayName: "Admin 3",
      role: "admin",
    });

    const req = {
      params: { roomId: nonExistentRoomId },
      body: {},
      userId: adminUser._id.toString(),
    };
    const res = createMockRes();

    await adminBanLivestream(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("TC4 – Admin ban livestream với resolveReports=true (200)", async () => {
    adminUser = await User.create({
      email: "admin4@example.com",
      passwordHash: "hash",
      username: "admin4",
      displayName: "Admin 4",
      role: "admin",
    });

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
      title: "Live Room 4",
      status: "live",
      privacyType: "public",
      streamKey: "key-4",
      startedAt: new Date(),
    });

    // Create pending reports
    await ContentReport.create({
      reporterId: reporter._id,
      targetContentType: "room",
      targetContentId: room._id,
      reason: "spam",
      status: "pending",
    });

    const req = {
      params: { roomId: room._id.toString() },
      body: { banUser: true, reason: "Vi phạm", resolveReports: true },
      userId: adminUser._id.toString(),
    };
    const res = createMockRes();

    await adminBanLivestream(req, res);

    expect(res.statusCode).toBe(200);

    // Verify reports are resolved
    const resolvedReports = await ContentReport.find({
      targetContentId: room._id,
      status: "resolved",
    });
    expect(resolvedReports.length).toBeGreaterThan(0);
  });

  it("TC5 – Admin ban livestream room đã ended (200)", async () => {
    adminUser = await User.create({
      email: "admin5@example.com",
      passwordHash: "hash",
      username: "admin5",
      displayName: "Admin 5",
      role: "admin",
    });

    const host = await User.create({
      email: "host5@example.com",
      passwordHash: "hash",
      username: "host5",
      displayName: "Host 5",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Live Room 5",
      status: "ended", // Already ended
      privacyType: "public",
      streamKey: "key-5",
      startedAt: new Date(),
      endedAt: new Date(),
    });

    const req = {
      params: { roomId: room._id.toString() },
      body: { banUser: true, reason: "Vi phạm", resolveReports: false },
      userId: adminUser._id.toString(),
    };
    const res = createMockRes();

    await adminBanLivestream(req, res);

    expect(res.statusCode).toBe(200);
    
    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.moderationStatus).toBe("banned");
  });

  it("TC6 – Admin ban livestream với default reason (200)", async () => {
    adminUser = await User.create({
      email: "admin6@example.com",
      passwordHash: "hash",
      username: "admin6",
      displayName: "Admin 6",
      role: "admin",
    });

    const host = await User.create({
      email: "host6@example.com",
      passwordHash: "hash",
      username: "host6",
      displayName: "Host 6",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Live Room 6",
      status: "live",
      privacyType: "public",
      streamKey: "key-6",
      startedAt: new Date(),
    });

    const req = {
      params: { roomId: room._id.toString() },
      body: { banUser: true, resolveReports: false }, // No reason provided
      userId: adminUser._id.toString(),
    };
    const res = createMockRes();

    await adminBanLivestream(req, res);

    expect(res.statusCode).toBe(200);
    
    const updatedUser = await User.findById(host._id);
    expect(updatedUser.livestreamBannedReason).toBe("Vi phạm quy định cộng đồng"); // Default reason
  });
});

