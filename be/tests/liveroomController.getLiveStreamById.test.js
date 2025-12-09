import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { getLiveStreamById } from "../src/controllers/user/liveroomController.js";
import LiveRoom from "../src/models/LiveRoom.js";
import User from "../src/models/User.js";
import UserFollow from "../src/models/UserFollow.js";
import { getSocketIo } from "../src/config/socket.js";

vi.mock("../src/config/socket.js", () => {
  const mockIo = {
    in: vi.fn(() => ({
      fetchSockets: vi.fn().mockResolvedValue([]),
    })),
  };
  return {
    getSocketIo: vi.fn(() => mockIo),
  };
});

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

describe("getLiveStreamById controller", () => {
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

  it("TC1 – host xem phòng của chính mình (200, isHost=true)", async () => {
    const host = await User.create({
      email: "host@example.com",
      passwordHash: "hash",
      username: "host1",
      displayName: "Host 1",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Room A",
      status: "live",
      privacyType: "public",
      streamKey: "key-a",
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await getLiveStreamById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isHost).toBe(true);
    expect(res.body.isFollowing).toBe(false);
    expect(res.body.title).toBe("Room A");
  });

  it("TC2 – viewer xem stream public, không follow (200, isFollowing=false)", async () => {
    const host = await User.create({
      email: "host2@example.com",
      passwordHash: "hash",
      username: "host2",
      displayName: "Host 2",
    });
    const viewer = await User.create({
      email: "viewer@example.com",
      passwordHash: "hash",
      username: "viewer1",
      displayName: "Viewer 1",
    });
    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Public room",
      status: "live",
      privacyType: "public",
      streamKey: "key-b",
    });

    const req = {
      params: { id: room._id.toString() },
      userId: viewer._id.toString(),
    };
    const res = createMockRes();

    await getLiveStreamById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isHost).toBe(false);
    expect(res.body.isFollowing).toBe(false);
  });

  it("TC3 – viewer xem stream public, đã follow host (200, isFollowing=true)", async () => {
    const host = await User.create({
      email: "host3@example.com",
      passwordHash: "hash",
      username: "host3",
      displayName: "Host 3",
    });
    const viewer = await User.create({
      email: "viewer2@example.com",
      passwordHash: "hash",
      username: "viewer2",
      displayName: "Viewer 2",
    });
    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Public followed",
      status: "live",
      privacyType: "public",
      streamKey: "key-c",
    });

    await UserFollow.create({
      followerId: viewer._id,
      followingId: host._id,
    });

    const req = {
      params: { id: room._id.toString() },
      userId: viewer._id.toString(),
    };
    const res = createMockRes();

    await getLiveStreamById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isHost).toBe(false);
    expect(res.body.isFollowing).toBe(true);
  });

  it("TC4 – follow_only, viewer follow host được phép xem (200)", async () => {
    const host = await User.create({
      email: "host4@example.com",
      passwordHash: "hash",
      username: "host4",
      displayName: "Host 4",
    });
    const viewer = await User.create({
      email: "viewer3@example.com",
      passwordHash: "hash",
      username: "viewer3",
      displayName: "Viewer 3",
    });
    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Follower only",
      status: "live",
      privacyType: "follow_only",
      streamKey: "key-d",
    });

    await UserFollow.create({
      followerId: viewer._id,
      followingId: host._id,
    });

    const req = {
      params: { id: room._id.toString() },
      userId: viewer._id.toString(),
    };
    const res = createMockRes();

    await getLiveStreamById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isFollowing).toBe(true);
  });

  it("TC5 – follow_only, viewer không follow bị 403", async () => {
    const host = await User.create({
      email: "host5@example.com",
      passwordHash: "hash",
      username: "host5",
      displayName: "Host 5",
    });
    const viewer = await User.create({
      email: "viewer4@example.com",
      passwordHash: "hash",
      username: "viewer4",
      displayName: "Viewer 4",
    });
    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Follower only no follow",
      status: "live",
      privacyType: "follow_only",
      streamKey: "key-e",
    });

    const req = {
      params: { id: room._id.toString() },
      userId: viewer._id.toString(),
    };
    const res = createMockRes();

    await getLiveStreamById(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ message: "Stream này chỉ dành cho người theo dõi." });
  });

  it("TC6 – room đã ended hoặc không tồn tại trả 404", async () => {
    const host = await User.create({
      email: "host6@example.com",
      passwordHash: "hash",
      username: "host6",
      displayName: "Host 6",
    });
    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Ended room",
      status: "ended",
      privacyType: "public",
      streamKey: "key-f",
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await getLiveStreamById(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      message: "Không tìm thấy phòng live hoặc phòng đã kết thúc.",
    });
  });
});


