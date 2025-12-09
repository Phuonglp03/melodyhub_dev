import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { goLive } from "../src/controllers/user/liveroomController.js";
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

describe("goLive controller", () => {
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

  it("TC1 – Host go live thành công (preview -> live, có title) (200)", async () => {
    const host = await User.create({
      email: "host@example.com",
      passwordHash: "hash",
      username: "host1",
      displayName: "Host 1",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "My Live Stream",
      status: "preview",
      privacyType: "public",
      streamKey: "key-1",
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await goLive(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Phát trực tiếp thành công!",
    });
    expect(res.body.room).toBeDefined();
    expect(res.body.room.status).toBe("live");
    expect(res.body.room.startedAt).toBeDefined();

    // Verify DB updated
    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.status).toBe("live");
    expect(updatedRoom.startedAt).toBeDefined();

    // Verify socket events emitted
    const mockIo = getSocketIo();
    expect(mockIo.emit).toHaveBeenCalledWith("stream-started", expect.any(Object));
    expect(mockIo.to).toHaveBeenCalledWith(room._id.toString());
    expect(mockIo.to().emit).toHaveBeenCalledWith("stream-status-live", {
      startedAt: expect.any(Date),
    });
  });

  it("TC2 – Room không tồn tại hoặc user không phải host trả về 404", async () => {
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
      title: "Test Room",
      status: "preview",
      privacyType: "public",
      streamKey: "key-2",
    });

    const req = {
      params: { id: room._id.toString() },
      userId: viewer._id.toString(), // viewer is not host
    };
    const res = createMockRes();

    await goLive(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      message: "Không tìm thấy phòng live hoặc bạn không có quyền.",
    });

    // Verify DB not updated
    const unchangedRoom = await LiveRoom.findById(room._id);
    expect(unchangedRoom.status).toBe("preview");
    expect(unchangedRoom.startedAt).toBeUndefined();
  });

  it("TC3 – Room status = 'waiting' trả về 400", async () => {
    const host = await User.create({
      email: "host3@example.com",
      passwordHash: "hash",
      username: "host3",
      displayName: "Host 3",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Waiting Room",
      status: "waiting",
      privacyType: "public",
      streamKey: "key-3",
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await goLive(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Stream chưa sẵn sàng (chưa ở trạng thái preview).",
    });

    // Verify DB not updated
    const unchangedRoom = await LiveRoom.findById(room._id);
    expect(unchangedRoom.status).toBe("waiting");
  });

  it("TC4 – Room status = 'live' trả về 400", async () => {
    const host = await User.create({
      email: "host4@example.com",
      passwordHash: "hash",
      username: "host4",
      displayName: "Host 4",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Already Live Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-4",
      startedAt: new Date(),
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await goLive(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Stream chưa sẵn sàng (chưa ở trạng thái preview).",
    });
  });

  it("TC5 – Room status = 'ended' trả về 400", async () => {
    const host = await User.create({
      email: "host5@example.com",
      passwordHash: "hash",
      username: "host5",
      displayName: "Host 5",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Ended Room",
      status: "ended",
      privacyType: "public",
      streamKey: "key-5",
      endedAt: new Date(),
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await goLive(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Stream chưa sẵn sàng (chưa ở trạng thái preview).",
    });
  });

  it("TC6 – Room title rỗng (null) trả về 400", async () => {
    const host = await User.create({
      email: "host6@example.com",
      passwordHash: "hash",
      username: "host6",
      displayName: "Host 6",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: null,
      status: "preview",
      privacyType: "public",
      streamKey: "key-6",
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await goLive(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Tiêu đề là bắt buộc để phát trực tiếp.",
    });

    // Verify DB not updated
    const unchangedRoom = await LiveRoom.findById(room._id);
    expect(unchangedRoom.status).toBe("preview");
  });

  it("TC7 – Room title chỉ có whitespace trả về 400", async () => {
    const host = await User.create({
      email: "host7@example.com",
      passwordHash: "hash",
      username: "host7",
      displayName: "Host 7",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "   ",
      status: "preview",
      privacyType: "public",
      streamKey: "key-7",
    });

    const req = {
      params: { id: room._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await goLive(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Tiêu đề là bắt buộc để phát trực tiếp.",
    });

    // Verify DB not updated
    const unchangedRoom = await LiveRoom.findById(room._id);
    expect(unchangedRoom.status).toBe("preview");
  });
});

