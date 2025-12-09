import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { unbanUser } from "../src/controllers/user/liveroomController.js";
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

describe("unbanUser controller", () => {
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

  it("TC1 – Host unban user thành công (user đã bị ban) (200)", async () => {
    const host = await User.create({
      email: "host@example.com",
      passwordHash: "hash",
      username: "host1",
      displayName: "Host 1",
    });

    const unbannedUser = await User.create({
      email: "unbanned@example.com",
      passwordHash: "hash",
      username: "unbanned1",
      displayName: "Unbanned User",
      chatBannedByHosts: [host._id],
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-1",
      bannedUsers: [unbannedUser._id],
    });

    const req = {
      params: { roomId: room._id.toString(), userId: unbannedUser._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await unbanUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Đã unban user khỏi chat.",
    });

    // Verify DB updated
    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.bannedUsers).not.toContainEqual(unbannedUser._id);

    const updatedUnbannedUser = await User.findById(unbannedUser._id);
    expect(updatedUnbannedUser.chatBannedByHosts || []).not.toContainEqual(host._id);

    // Verify socket events emitted
    const mockIo = getSocketIo();
    expect(mockIo.to).toHaveBeenCalledWith(room._id.toString());
    expect(mockIo.to().emit).toHaveBeenCalledWith("user-unbanned", {
      userId: unbannedUser._id.toString(),
    });
    expect(mockIo.to).toHaveBeenCalledWith(unbannedUser._id.toString());
    expect(mockIo.to().emit).toHaveBeenCalledWith("chat-unbanned", expect.objectContaining({
      hostId: host._id.toString(),
    }));
  });

  
  it("TC2 – Room không tồn tại hoặc user không phải host trả về 404", async () => {
    const host = await User.create({
      email: "host3@example.com",
      passwordHash: "hash",
      username: "host3",
      displayName: "Host 3",
    });
    const viewer = await User.create({
      email: "viewer@example.com",
      passwordHash: "hash",
      username: "viewer1",
      displayName: "Viewer 1",
    });
    const unbannedUser = await User.create({
      email: "unbanned3@example.com",
      passwordHash: "hash",
      username: "unbanned3",
      displayName: "Unbanned User 3",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 3",
      status: "live",
      privacyType: "public",
      streamKey: "key-3",
      bannedUsers: [unbannedUser._id],
    });

    const req = {
      params: { roomId: room._id.toString(), userId: unbannedUser._id.toString() },
      userId: viewer._id.toString(), // viewer is not host
    };
    const res = createMockRes();

    await unbanUser(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      message: "Không tìm thấy phòng hoặc bạn không phải host.",
    });

    // Verify DB not updated
    const unchangedRoom = await LiveRoom.findById(room._id);
    expect(unchangedRoom.bannedUsers).toContainEqual(unbannedUser._id);

    const unchangedUnbannedUser = await User.findById(unbannedUser._id);
    // chatBannedByHosts might still contain host._id if it was set before
  });

  it("TC3 – User không tồn tại (200, vẫn unban trong room nhưng không unban chat)", async () => {
    const host = await User.create({
      email: "host4@example.com",
      passwordHash: "hash",
      username: "host4",
      displayName: "Host 4",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 4",
      status: "live",
      privacyType: "public",
      streamKey: "key-4",
    });

    const nonExistentUserId = new mongoose.Types.ObjectId();
    room.bannedUsers.push(nonExistentUserId);
    await room.save();

    const req = {
      params: { roomId: room._id.toString(), userId: nonExistentUserId.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await unbanUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Đã unban user khỏi chat.",
    });

    // Verify room updated (user unbanned in room)
    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.bannedUsers).not.toContainEqual(nonExistentUserId);

    // Verify socket events still emitted
    const mockIo = getSocketIo();
    expect(mockIo.to).toHaveBeenCalledWith(room._id.toString());
    expect(mockIo.to().emit).toHaveBeenCalledWith("user-unbanned", {
      userId: nonExistentUserId.toString(),
    });
  });
  
});

