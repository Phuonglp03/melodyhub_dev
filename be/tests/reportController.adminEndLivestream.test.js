import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { adminEndLivestream } from "../src/controllers/admin/reportController.js";
import LiveRoom from "../src/models/LiveRoom.js";
import User from "../src/models/User.js";
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

describe("adminEndLivestream controller", () => {
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

  it("TC1 – Admin end livestream thành công (200)", async () => {
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
      userId: "admin-id",
    };
    const res = createMockRes();

    await adminEndLivestream(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ended");
    expect(res.body.data.endedAt).toBeDefined();

    // Verify DB
    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.status).toBe("ended");

    // Verify socket event
    const mockIo = getSocketIo();
    expect(mockIo.to).toHaveBeenCalledWith(room._id.toString());
  });

  it("TC2 – Room không tồn tại trả về 404", async () => {
    const nonExistentRoomId = new mongoose.Types.ObjectId().toString();

    const req = {
      params: { roomId: nonExistentRoomId },
      userId: "admin-id",
    };
    const res = createMockRes();

    await adminEndLivestream(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("TC3 – Room đã ended trả về 400", async () => {
    const host = await User.create({
      email: "host3@example.com",
      passwordHash: "hash",
      username: "host3",
      displayName: "Host 3",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Ended Room",
      status: "ended",
      privacyType: "public",
      streamKey: "key-3",
      endedAt: new Date(),
    });

    const req = {
      params: { roomId: room._id.toString() },
      userId: "admin-id",
    };
    const res = createMockRes();

    await adminEndLivestream(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("already ended");
  });
});

