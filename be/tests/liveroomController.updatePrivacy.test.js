import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { updatePrivacy } from "../src/controllers/user/liveroomController.js";
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

describe("updatePrivacy controller", () => {
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

  it("TC1 – Host update privacy thành công (waiting -> public) (200)", async () => {
    const host = await User.create({
      email: "host@example.com",
      passwordHash: "hash",
      username: "host1",
      displayName: "Host 1",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room",
      status: "waiting",
      privacyType: "follow_only",
      streamKey: "key-1",
    });

    const req = {
      params: { id: room._id.toString() },
      body: { privacyType: "public" },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await updatePrivacy(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Cập nhật quyền riêng tư thành công.",
      privacyType: "public",
    });

    // Verify DB updated
    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.privacyType).toBe("public");

    // Verify socket event emitted
    const mockIo = getSocketIo();
    expect(mockIo.to).toHaveBeenCalledWith(room._id.toString());
    expect(mockIo.to().emit).toHaveBeenCalledWith("stream-privacy-updated", {
      privacyType: "public",
    });
  });

  it("TC2 – Host update privacy thành công (preview -> follow_only) (200)", async () => {
    const host = await User.create({
      email: "host2@example.com",
      passwordHash: "hash",
      username: "host2",
      displayName: "Host 2",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Preview Room",
      status: "preview",
      privacyType: "public",
      streamKey: "key-2",
    });

    const req = {
      params: { id: room._id.toString() },
      body: { privacyType: "follow_only" },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await updatePrivacy(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Cập nhật quyền riêng tư thành công.",
      privacyType: "follow_only",
    });

    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.privacyType).toBe("follow_only");
  });

  it("TC3 – Host update privacy thành công (live -> public) (200)", async () => {
    const host = await User.create({
      email: "host3@example.com",
      passwordHash: "hash",
      username: "host3",
      displayName: "Host 3",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Live Room",
      status: "live",
      privacyType: "follow_only",
      streamKey: "key-3",
    });

    const req = {
      params: { id: room._id.toString() },
      body: { privacyType: "public" },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await updatePrivacy(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Cập nhật quyền riêng tư thành công.",
      privacyType: "public",
    });

    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.privacyType).toBe("public");
  });

  it("TC4 – privacyType không hợp lệ trả về 400", async () => {
    const host = await User.create({
      email: "host4@example.com",
      passwordHash: "hash",
      username: "host4",
      displayName: "Host 4",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room",
      status: "waiting",
      privacyType: "public",
      streamKey: "key-4",
    });

    const req = {
      params: { id: room._id.toString() },
      body: { privacyType: "invalid_type" },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await updatePrivacy(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Trạng thái riêng tư không hợp lệ.",
    });

    // Verify DB not updated
    const unchangedRoom = await LiveRoom.findById(room._id);
    expect(unchangedRoom.privacyType).toBe("public");
  });

  it("TC5 – privacyType missing/empty trả về 400", async () => {
    const host = await User.create({
      email: "host5@example.com",
      passwordHash: "hash",
      username: "host5",
      displayName: "Host 5",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room",
      status: "waiting",
      privacyType: "public",
      streamKey: "key-5",
    });

    const req = {
      params: { id: room._id.toString() },
      body: {}, // privacyType missing
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await updatePrivacy(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Trạng thái riêng tư không hợp lệ.",
    });
  });

  it("TC6 – User không phải host trả về 404", async () => {
    const host = await User.create({
      email: "host6@example.com",
      passwordHash: "hash",
      username: "host6",
      displayName: "Host 6",
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
      status: "waiting",
      privacyType: "public",
      streamKey: "key-6",
    });

    const req = {
      params: { id: room._id.toString() },
      body: { privacyType: "follow_only" },
      userId: viewer._id.toString(), // viewer is not host
    };
    const res = createMockRes();

    await updatePrivacy(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      message: "Không tìm thấy phòng hoặc bạn không có quyền.",
    });

    // Verify DB not updated
    const unchangedRoom = await LiveRoom.findById(room._id);
    expect(unchangedRoom.privacyType).toBe("public");
  });

  it("TC7 – Room status = 'ended' trả về 400", async () => {
    const host = await User.create({
      email: "host7@example.com",
      passwordHash: "hash",
      username: "host7",
      displayName: "Host 7",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Ended Room",
      status: "ended",
      privacyType: "public",
      streamKey: "key-7",
    });

    const req = {
      params: { id: room._id.toString() },
      body: { privacyType: "follow_only" },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await updatePrivacy(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Chỉ có thể đổi trạng thái khi đang chuẩn bị hoặc đang live.",
    });

    // Verify DB not updated
    const unchangedRoom = await LiveRoom.findById(room._id);
    expect(unchangedRoom.privacyType).toBe("public");
  });
});

