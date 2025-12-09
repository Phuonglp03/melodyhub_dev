// tests/liveroomController.endLiveStream.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { endLiveStream } from "../src/controllers/user/liveroomController.js";
import LiveRoom from "../src/models/LiveRoom.js";
import User from "../src/models/User.js";
import { getSocketIo } from "../src/config/socket.js";

// Mock socket.io chính xác hơn: tách global emit và room emit
vi.mock("../src/config/socket.js", () => {
  const mockRoomEmit = vi.fn();
  const mockGlobalEmit = vi.fn();

  const io = {
    to: vi.fn(() => ({
      emit: mockRoomEmit,
    })),
    emit: mockGlobalEmit,
  };

  return {
    getSocketIo: vi.fn(() => io),
    // Export để test có thể lấy ra check
    __mockRoomEmit: mockRoomEmit,
    __mockGlobalEmit: mockGlobalEmit,
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

describe("endLiveStream controller", () => {
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

  it("TC1 – Host end stream thành công (live -> ended) (200)", async () => {
    const host = await User.create({
      email: "host@example.com",
      passwordHash: "hash",
      username: "host1",
      displayName: "Host 1",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Live Stream",
      status: "live",
      privacyType: "public",
      streamKey: "key-1",
      startedAt: new Date(),
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await endLiveStream(req, res);

    const io = getSocketIo();

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Đã kết thúc livestream.");
    expect(res.body.room.status).toBe("ended");
    expect(res.body.room.endedAt).toBeDefined();

    // DB thật sự đã update
    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.status).toBe("ended");
    expect(updatedRoom.endedAt).toBeDefined();

    // === Socket checks (chính xác 100%) ===
    // Global emit stream-ended
    expect(io.emit).toHaveBeenCalledWith(
      "stream-ended",
      expect.objectContaining({
        title: room.title,
      })
    );
    const streamEndedPayload = io.emit.mock.calls.find(c => c[0] === "stream-ended")[1];
    expect(streamEndedPayload.roomId.toString()).toBe(room._id.toString());

    // Room emit stream-status-ended
    expect(io.to).toHaveBeenCalledWith(room._id.toString());
    expect(io.to().emit).toHaveBeenCalledWith("stream-status-ended");
  });

  it("TC2 – Host end stream thành công (preview -> ended) (200)", async () => {
    const host = await User.create({
      email: "host2@example.com",
      passwordHash: "hash",
      username: "host2",
      displayName: "Host 2",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Preview Stream",
      status: "preview",
      privacyType: "public",
      streamKey: "key-2",
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await endLiveStream(req, res);

    const io = getSocketIo();

    expect(res.statusCode).toBe(200);
    expect(res.body.room.status).toBe("ended");

    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.status).toBe("ended");
    expect(updatedRoom.endedAt).toBeDefined();

    // Không emit stream-ended khi không phải từ live
    expect(io.emit).not.toHaveBeenCalledWith("stream-ended", expect.anything());

    // Nhưng vẫn emit trong room
    expect(io.to).toHaveBeenCalledWith(room._id.toString());
    expect(io.to().emit).toHaveBeenCalledWith("stream-status-ended");
  });

  it("TC3 – Host end stream thành công (waiting -> ended) (200)", async () => {
    const host = await User.create({
      email: "host3@example.com",
      passwordHash: "hash",
      username: "host3",
      displayName: "Host 3",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Waiting Stream",
      status: "waiting",
      privacyType: "public",
      streamKey: "key-3",
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await endLiveStream(req, res);

    const io = getSocketIo();

    expect(res.statusCode).toBe(200);
    expect(res.body.room.status).toBe("ended");

    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.status).toBe("ended");

    expect(io.emit).not.toHaveBeenCalledWith("stream-ended", expect.anything());
    expect(io.to).toHaveBeenCalledWith(room._id.toString());
    expect(io.to().emit).toHaveBeenCalledWith("stream-status-ended");
  });

  it("TC4 – Room không tồn tại hoặc user không phải host trả về 404", async () => {
    const host = await User.create({
      email: "host4@example.com",
      passwordHash: "hash",
      username: "host4",
      displayName: "Host 4",
    });
    const viewer = await User.create({
      email: "viewer@example.com",
      passwordHash: "hash",
      username: "viewer1",
      displayName: "Viewer 1",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-4",
      startedAt: new Date(),
    });

    const req = {
      params: { id: room._id.toString() },
      userId: viewer._id.toString(), // không phải host
    };
    const res = createMockRes();

    await endLiveStream(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Không tìm thấy phòng live hoặc bạn không có quyền.");

    const unchangedRoom = await LiveRoom.findById(room._id);
    expect(unchangedRoom.status).toBe("live");
    expect(unchangedRoom.endedAt).toBeUndefined();
  });

  it("TC5 – Room status = 'ended' trả về 400", async () => {
    const host = await User.create({
      email: "host5@example.com",
      passwordHash: "hash",
      username: "host5",
      displayName: "Host 5",
    });

    const endedAt = new Date();
    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Already Ended Room",
      status: "ended",
      privacyType: "public",
      streamKey: "key-5",
      endedAt,
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await endLiveStream(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Stream đã kết thúc.");

    const unchangedRoom = await LiveRoom.findById(room._id);
    expect(unchangedRoom.status).toBe("ended");
    expect(unchangedRoom.endedAt.getTime()).toBe(endedAt.getTime());
  });
});