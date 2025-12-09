import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { reportLivestream } from "../src/controllers/user/liveroomController.js";
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

describe("reportLivestream controller", () => {
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

  it("TC1 – User report livestream thành công (201)", async () => {
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

    const req = {
      params: { roomId: room._id.toString() },
      body: { reason: "spam" },
      userId: reporter._id.toString(),
    };
    const res = createMockRes();

    await reportLivestream(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      message: "Báo cáo đã được gửi thành công.",
    });
    expect(res.body.data).toBeDefined();
    expect(res.body.data.reason).toBe("spam");
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.targetContentType).toBe("room");
    expect(res.body.data.targetContentId.toString()).toBe(room._id.toString());
    expect(res.body.data.reporterId.toString()).toBe(reporter._id.toString());

    // Verify DB
    const reportInDb = await ContentReport.findOne({
      reporterId: reporter._id,
      targetContentId: room._id,
    });
    expect(reportInDb).not.toBeNull();
    expect(reportInDb.reason).toBe("spam");
  });

  it("TC2 – roomId không hợp lệ trả về 400", async () => {
    const reporter = await User.create({
      email: "reporter2@example.com",
      passwordHash: "hash",
      username: "reporter2",
      displayName: "Reporter 2",
    });

    const req = {
      params: { roomId: "invalid-room-id" },
      body: { reason: "spam" },
      userId: reporter._id.toString(),
    };
    const res = createMockRes();

    await reportLivestream(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "ID phòng không hợp lệ.",
    });
  });

  it("TC3 – Room không tồn tại trả về 404", async () => {
    const reporter = await User.create({
      email: "reporter3@example.com",
      passwordHash: "hash",
      username: "reporter3",
      displayName: "Reporter 3",
    });

    const nonExistentRoomId = new mongoose.Types.ObjectId().toString();

    const req = {
      params: { roomId: nonExistentRoomId },
      body: { reason: "spam" },
      userId: reporter._id.toString(),
    };
    const res = createMockRes();

    await reportLivestream(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      message: "Không tìm thấy phòng livestream.",
    });
  });

  it("TC4 – User báo cáo phòng của chính mình trả về 400", async () => {
    const host = await User.create({
      email: "host4@example.com",
      passwordHash: "hash",
      username: "host4",
      displayName: "Host 4",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "My Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-4",
    });

    const req = {
      params: { roomId: room._id.toString() },
      body: { reason: "spam" },
      userId: host._id.toString(), // host trying to report own room
    };
    const res = createMockRes();

    await reportLivestream(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Bạn không thể báo cáo phòng livestream của chính mình.",
    });

    // Verify no report created
    const reportInDb = await ContentReport.findOne({
      reporterId: host._id,
      targetContentId: room._id,
    });
    expect(reportInDb).toBeNull();
  });

  it("TC5 – reason không hợp lệ trả về 400", async () => {
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
      title: "Test Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-5",
    });

    const req = {
      params: { roomId: room._id.toString() },
      body: { reason: "invalid_reason" },
      userId: reporter._id.toString(),
    };
    const res = createMockRes();

    await reportLivestream(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Lý do không hợp lệ. Phải là: spam, inappropriate, copyright, harassment, other",
    });
  });

  it("TC6 – reason missing trả về 400", async () => {
    const host = await User.create({
      email: "host6@example.com",
      passwordHash: "hash",
      username: "host6",
      displayName: "Host 6",
    });

    const reporter = await User.create({
      email: "reporter6@example.com",
      passwordHash: "hash",
      username: "reporter6",
      displayName: "Reporter 6",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-6",
    });

    const req = {
      params: { roomId: room._id.toString() },
      body: {}, // reason missing
      userId: reporter._id.toString(),
    };
    const res = createMockRes();

    await reportLivestream(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Lý do không hợp lệ. Phải là: spam, inappropriate, copyright, harassment, other",
    });
  });

  it("TC7 – User đã báo cáo phòng này rồi (pending) trả về 400", async () => {
    const host = await User.create({
      email: "host7@example.com",
      passwordHash: "hash",
      username: "host7",
      displayName: "Host 7",
    });

    const reporter = await User.create({
      email: "reporter7@example.com",
      passwordHash: "hash",
      username: "reporter7",
      displayName: "Reporter 7",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-7",
    });

    // Create existing pending report
    await ContentReport.create({
      reporterId: reporter._id,
      targetContentType: "room",
      targetContentId: room._id,
      reason: "spam",
      status: "pending",
    });

    const req = {
      params: { roomId: room._id.toString() },
      body: { reason: "inappropriate" },
      userId: reporter._id.toString(),
    };
    const res = createMockRes();

    await reportLivestream(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: "Bạn đã báo cáo phòng livestream này rồi.",
    });

    // Verify only one report exists
    const reports = await ContentReport.find({
      reporterId: reporter._id,
      targetContentId: room._id,
    });
    expect(reports).toHaveLength(1);
  });

  it("TC8 – User report với description (201)", async () => {
    const host = await User.create({
      email: "host8@example.com",
      passwordHash: "hash",
      username: "host8",
      displayName: "Host 8",
    });

    const reporter = await User.create({
      email: "reporter8@example.com",
      passwordHash: "hash",
      username: "reporter8",
      displayName: "Reporter 8",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-8",
    });

    const req = {
      params: { roomId: room._id.toString() },
      body: {
        reason: "harassment",
        description: "This stream contains harassment content",
      },
      userId: reporter._id.toString(),
    };
    const res = createMockRes();

    await reportLivestream(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      message: "Báo cáo đã được gửi thành công.",
    });
    expect(res.body.data.reason).toBe("harassment");
    expect(res.body.data.description).toBe("This stream contains harassment content");

    // Verify DB
    const reportInDb = await ContentReport.findOne({
      reporterId: reporter._id,
      targetContentId: room._id,
    });
    expect(reportInDb.description).toBe("This stream contains harassment content");
  });

  it("TC9 – User report với tất cả valid reasons (201)", async () => {
    const host = await User.create({
      email: "host9@example.com",
      passwordHash: "hash",
      username: "host9",
      displayName: "Host 9",
    });

    const reporter = await User.create({
      email: "reporter9@example.com",
      passwordHash: "hash",
      username: "reporter9",
      displayName: "Reporter 9",
    });

    const validReasons = ["spam", "inappropriate", "copyright", "harassment", "other"];

    for (const reason of validReasons) {
      const room = await LiveRoom.create({
        hostId: host._id,
        title: `Test Room ${reason}`,
        status: "live",
        privacyType: "public",
        streamKey: `key-9-${reason}`,
      });

      const req = {
        params: { roomId: room._id.toString() },
        body: { reason },
        userId: reporter._id.toString(),
      };
      const res = createMockRes();

      await reportLivestream(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.data.reason).toBe(reason);
    }
  });
});

