import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { getRoomViewers } from "../src/controllers/user/liveroomController.js";
import LiveRoom from "../src/models/LiveRoom.js";
import User from "../src/models/User.js";
import RoomChat from "../src/models/RoomChat.js";
import { getSocketIo } from "../src/config/socket.js";

vi.mock("../src/config/socket.js", () => {
  const mockFetchSockets = vi.fn();
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

describe("getRoomViewers controller", () => {
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

  it("TC1 – Host get viewers thành công (có viewers) (200)", async () => {
    const host = await User.create({
      email: "host@example.com",
      passwordHash: "hash",
      username: "host1",
      displayName: "Host 1",
    });

    const viewer1 = await User.create({
      email: "viewer1@example.com",
      passwordHash: "hash",
      username: "viewer1",
      displayName: "Viewer 1",
    });

    const viewer2 = await User.create({
      email: "viewer2@example.com",
      passwordHash: "hash",
      username: "viewer2",
      displayName: "Viewer 2",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-1",
    });

    // Mock socket sockets
    const mockIo = getSocketIo();
    mockIo.in().fetchSockets.mockResolvedValue([
      {
        handshake: { query: { userId: viewer1._id.toString() } },
      },
      {
        handshake: { query: { userId: viewer2._id.toString() } },
      },
      {
        handshake: { query: { userId: host._id.toString() } }, // Host should be excluded
      },
    ]);

    const req = {
      params: { roomId: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await getRoomViewers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("viewers");
    expect(res.body).toHaveProperty("totalCount");
    expect(res.body.totalCount).toBe(2);
    expect(res.body.viewers).toHaveLength(2);

    // Verify viewer details
    const viewerIds = res.body.viewers.map((v) => v._id.toString());
    expect(viewerIds).toContain(viewer1._id.toString());
    expect(viewerIds).toContain(viewer2._id.toString());
    expect(viewerIds).not.toContain(host._id.toString()); // Host excluded

    // Verify viewer has required fields
    const viewer = res.body.viewers[0];
    expect(viewer).toHaveProperty("displayName");
    expect(viewer).toHaveProperty("username");
    expect(viewer).toHaveProperty("avatarUrl");
    expect(viewer).toHaveProperty("messageCount");
  });

  it("TC2 – Host get viewers thành công (không có viewers) (200)", async () => {
    const host = await User.create({
      email: "host2@example.com",
      passwordHash: "hash",
      username: "host2",
      displayName: "Host 2",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 2",
      status: "live",
      privacyType: "public",
      streamKey: "key-2",
    });

    // Mock socket sockets - empty or only host
    const mockIo = getSocketIo();
    mockIo.in().fetchSockets.mockResolvedValue([
      {
        handshake: { query: { userId: host._id.toString() } }, // Only host
      },
    ]);

    const req = {
      params: { roomId: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await getRoomViewers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("viewers");
    expect(res.body).toHaveProperty("totalCount");
    expect(res.body.totalCount).toBe(0);
    expect(res.body.viewers).toHaveLength(0);
  });

  it("TC3 – Room không tồn tại hoặc user không phải host trả về 404", async () => {
    const host = await User.create({
      email: "host3@example.com",
      passwordHash: "hash",
      username: "host3",
      displayName: "Host 3",
    });
    const viewer = await User.create({
      email: "viewer@example.com",
      passwordHash: "hash",
      username: "viewer",
      displayName: "Viewer",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 3",
      status: "live",
      privacyType: "public",
      streamKey: "key-3",
    });

    const req = {
      params: { roomId: room._id.toString() },
      userId: viewer._id.toString(), // viewer is not host
    };
    const res = createMockRes();

    await getRoomViewers(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      message: "Không tìm thấy phòng hoặc bạn không phải host.",
    });
  });

  it("TC4 – Viewers có message counts (200)", async () => {
    const host = await User.create({
      email: "host4@example.com",
      passwordHash: "hash",
      username: "host4",
      displayName: "Host 4",
    });

    const viewer1 = await User.create({
      email: "viewer1@example.com",
      passwordHash: "hash",
      username: "viewer1",
      displayName: "Viewer 1",
    });

    const viewer2 = await User.create({
      email: "viewer2@example.com",
      passwordHash: "hash",
      username: "viewer2",
      displayName: "Viewer 2",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 4",
      status: "live",
      privacyType: "public",
      streamKey: "key-4",
    });

    // Create messages for viewer1
    await RoomChat.create({
      roomId: room._id,
      userId: viewer1._id,
      message: "Message 1",
      messageType: "text",
    });
    await RoomChat.create({
      roomId: room._id,
      userId: viewer1._id,
      message: "Message 2",
      messageType: "text",
    });

    // Create message for viewer2
    await RoomChat.create({
      roomId: room._id,
      userId: viewer2._id,
      message: "Message 3",
      messageType: "text",
    });

    // Mock socket sockets
    const mockIo = getSocketIo();
    mockIo.in().fetchSockets.mockResolvedValue([
      {
        handshake: { query: { userId: viewer1._id.toString() } },
      },
      {
        handshake: { query: { userId: viewer2._id.toString() } },
      },
    ]);

    const req = {
      params: { roomId: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await getRoomViewers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.totalCount).toBe(2);

    // Verify message counts
    const viewer1Data = res.body.viewers.find(
      (v) => v._id.toString() === viewer1._id.toString()
    );
    const viewer2Data = res.body.viewers.find(
      (v) => v._id.toString() === viewer2._id.toString()
    );

    expect(viewer1Data.messageCount).toBe(2);
    expect(viewer2Data.messageCount).toBe(1);
  });

  it("TC5 – Socket có host trong room (200, host không được tính là viewer)", async () => {
    const host = await User.create({
      email: "host5@example.com",
      passwordHash: "hash",
      username: "host5",
      displayName: "Host 5",
    });

    const viewer = await User.create({
      email: "viewer@example.com",
      passwordHash: "hash",
      username: "viewer",
      displayName: "Viewer",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 5",
      status: "live",
      privacyType: "public",
      streamKey: "key-5",
    });

    // Mock socket sockets - include host
    const mockIo = getSocketIo();
    mockIo.in().fetchSockets.mockResolvedValue([
      {
        handshake: { query: { userId: host._id.toString() } }, // Host
      },
      {
        handshake: { query: { userId: viewer._id.toString() } }, // Viewer
      },
    ]);

    const req = {
      params: { roomId: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await getRoomViewers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.viewers).toHaveLength(1);
    expect(res.body.viewers[0]._id.toString()).toBe(viewer._id.toString());
    expect(res.body.viewers[0]._id.toString()).not.toBe(host._id.toString());
  });

  it("TC6 – Socket có user không có userId trong query (200, bỏ qua)", async () => {
    const host = await User.create({
      email: "host6@example.com",
      passwordHash: "hash",
      username: "host6",
      displayName: "Host 6",
    });

    const viewer = await User.create({
      email: "viewer@example.com",
      passwordHash: "hash",
      username: "viewer",
      displayName: "Viewer",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 6",
      status: "live",
      privacyType: "public",
      streamKey: "key-6",
    });

    // Mock socket sockets - one without userId
    const mockIo = getSocketIo();
    mockIo.in().fetchSockets.mockResolvedValue([
      {
        handshake: { query: { userId: viewer._id.toString() } },
      },
      {
        handshake: { query: {} }, // No userId
      },
      {
        handshake: { query: { userId: null } }, // userId is null
      },
    ]);

    const req = {
      params: { roomId: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await getRoomViewers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.viewers).toHaveLength(1);
    expect(res.body.viewers[0]._id.toString()).toBe(viewer._id.toString());
  });
});

