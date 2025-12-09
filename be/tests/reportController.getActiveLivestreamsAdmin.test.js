import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { getActiveLivestreamsAdmin } from "../src/controllers/admin/reportController.js";
import LiveRoom from "../src/models/LiveRoom.js";
import User from "../src/models/User.js";
import { getSocketIo } from "../src/config/socket.js";

vi.mock("../src/config/socket.js", () => {
  const mockFetchSockets = vi.fn().mockResolvedValue([]);
  const mockIn = vi.fn(() => ({
    fetchSockets: mockFetchSockets,
  }));
  const mockIo = {
    in: mockIn,
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

describe("getActiveLivestreamsAdmin controller", () => {
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

  it("TC1 – Admin get active livestreams thành công (có streams) (200)", async () => {
    const host1 = await User.create({
      email: "host1@example.com",
      passwordHash: "hash",
      username: "host1",
      displayName: "Host 1",
    });

    const host2 = await User.create({
      email: "host2@example.com",
      passwordHash: "hash",
      username: "host2",
      displayName: "Host 2",
    });

    const room1 = await LiveRoom.create({
      hostId: host1._id,
      title: "Live Room 1",
      status: "live",
      privacyType: "public",
      streamKey: "key-1",
      startedAt: new Date(),
    });

    const room2 = await LiveRoom.create({
      hostId: host2._id,
      title: "Live Room 2",
      status: "live",
      privacyType: "follow_only",
      streamKey: "key-2",
      startedAt: new Date(),
    });

    // Mock socket
    const mockIo = getSocketIo();
    mockIo.in().fetchSockets.mockResolvedValue([
      { handshake: { query: { userId: "viewer1" } } },
    ]);

    const req = { userId: "admin-id" };
    const res = createMockRes();

    await getActiveLivestreamsAdmin(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toHaveProperty("currentViewers");
    // Admin thấy cả public và follow_only (không filter privacy)
    expect(res.body.data.some((r) => r.privacyType === "public")).toBe(true);
    expect(res.body.data.some((r) => r.privacyType === "follow_only")).toBe(true);
  });

  it("TC2 – Admin get active livestreams thành công (không có streams) (200)", async () => {
    const req = { userId: "admin-id" };
    const res = createMockRes();

    await getActiveLivestreamsAdmin(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it("TC3 – Admin get active livestreams chỉ lấy status='live' (200)", async () => {
    const host = await User.create({
      email: "host@example.com",
      passwordHash: "hash",
      username: "host",
      displayName: "Host",
    });

    await LiveRoom.create({
      hostId: host._id,
      title: "Live Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-live",
      startedAt: new Date(),
    });

    await LiveRoom.create({
      hostId: host._id,
      title: "Ended Room",
      status: "ended",
      privacyType: "public",
      streamKey: "key-ended",
    });

    await LiveRoom.create({
      hostId: host._id,
      title: "Waiting Room",
      status: "waiting",
      privacyType: "public",
      streamKey: "key-waiting",
    });

    const req = { userId: "admin-id" };
    const res = createMockRes();

    await getActiveLivestreamsAdmin(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe("live");
  });
});

