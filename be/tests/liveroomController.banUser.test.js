import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { banUser } from "../src/controllers/user/liveroomController.js";
import LiveRoom from "../src/models/LiveRoom.js";
import User from "../src/models/User.js";
import RoomChat from "../src/models/RoomChat.js";
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

describe("banUser controller", () => {
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

  it("TC1 – Host ban user thành công (user chưa bị ban) (200)", async () => {
    const host = await User.create({
      email: "host@example.com",
      passwordHash: "hash",
      username: "host1",
      displayName: "Host 1",
    });

    const bannedUser = await User.create({
      email: "banned@example.com",
      passwordHash: "hash",
      username: "banned1",
      displayName: "Banned User",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room",
      status: "live",
      privacyType: "public",
      streamKey: "key-1",
    });

    const req = {
      params: { roomId: room._id.toString(), userId: bannedUser._id.toString() },
      body: {},
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await banUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Đã ban user khỏi chat.",
    });

    // Verify DB updated
    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.bannedUsers).toContainEqual(bannedUser._id);

    const updatedBannedUser = await User.findById(bannedUser._id);
    expect(updatedBannedUser.chatBannedByHosts).toContainEqual(host._id);

    // Verify socket events emitted
    const mockIo = getSocketIo();
    expect(mockIo.to).toHaveBeenCalledWith(room._id.toString());
    expect(mockIo.to().emit).toHaveBeenCalledWith("user-banned", {
      userId: bannedUser._id.toString(),
    });
    expect(mockIo.to).toHaveBeenCalledWith(bannedUser._id.toString());
    expect(mockIo.to().emit).toHaveBeenCalledWith("chat-banned", expect.objectContaining({
      hostId: host._id.toString(),
    }));
  });

  it("TC2 – Host ban user thành công với messageId (200, message bị xóa)", async () => {
    const host = await User.create({
      email: "host2@example.com",
      passwordHash: "hash",
      username: "host2",
      displayName: "Host 2",
    });

    const bannedUser = await User.create({
      email: "banned2@example.com",
      passwordHash: "hash",
      username: "banned2",
      displayName: "Banned User 2",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 2",
      status: "live",
      privacyType: "public",
      streamKey: "key-2",
    });

    const chatMessage = await RoomChat.create({
      roomId: room._id,
      userId: bannedUser._id,
      message: "Bad message",
      messageType: "text",
    });

    const req = {
      params: { roomId: room._id.toString(), userId: bannedUser._id.toString() },
      body: { messageId: chatMessage._id.toString() },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await banUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Đã ban user khỏi chat.",
    });

    // Verify message deleted
    const updatedChat = await RoomChat.findById(chatMessage._id);
    expect(updatedChat.deleted).toBe(true);

    // Verify socket events emitted
    const mockIo = getSocketIo();
    expect(mockIo.to).toHaveBeenCalledWith(room._id.toString());
    expect(mockIo.to().emit).toHaveBeenCalledWith("message-removed", {
      messageId: chatMessage._id.toString(),
    });
  });

  it("TC3 – Host ban user đã bị ban trước đó (200, idempotent)", async () => {
    const host = await User.create({
      email: "host3@example.com",
      passwordHash: "hash",
      username: "host3",
      displayName: "Host 3",
    });

    const bannedUser = await User.create({
      email: "banned3@example.com",
      passwordHash: "hash",
      username: "banned3",
      displayName: "Banned User 3",
      chatBannedByHosts: [host._id],
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 3",
      status: "live",
      privacyType: "public",
      streamKey: "key-3",
      bannedUsers: [bannedUser._id],
    });

    const req = {
      params: { roomId: room._id.toString(), userId: bannedUser._id.toString() },
      body: {},
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await banUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Đã ban user khỏi chat.",
    });

    // Verify DB - should still have user banned (idempotent)
    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.bannedUsers).toContainEqual(bannedUser._id);

    const updatedBannedUser = await User.findById(bannedUser._id);
    expect(updatedBannedUser.chatBannedByHosts).toContainEqual(host._id);
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
    const bannedUser = await User.create({
      email: "banned4@example.com",
      passwordHash: "hash",
      username: "banned4",
      displayName: "Banned User 4",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 4",
      status: "live",
      privacyType: "public",
      streamKey: "key-4",
    });

    const req = {
      params: { roomId: room._id.toString(), userId: bannedUser._id.toString() },
      body: {},
      userId: viewer._id.toString(), // viewer is not host
    };
    const res = createMockRes();

    await banUser(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      message: "Không tìm thấy phòng hoặc bạn không phải host.",
    });

    // Verify DB not updated
    const unchangedRoom = await LiveRoom.findById(room._id);
    expect(unchangedRoom.bannedUsers).not.toContainEqual(bannedUser._id);

    const unchangedBannedUser = await User.findById(bannedUser._id);
    expect(unchangedBannedUser.chatBannedByHosts || []).not.toContainEqual(host._id);
  });

  it("TC5 – User không tồn tại (200, vẫn ban trong room nhưng không ban chat)", async () => {
    const host = await User.create({
      email: "host5@example.com",
      passwordHash: "hash",
      username: "host5",
      displayName: "Host 5",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 5",
      status: "live",
      privacyType: "public",
      streamKey: "key-5",
    });

    const nonExistentUserId = new mongoose.Types.ObjectId().toString();

    const req = {
      params: { roomId: room._id.toString(), userId: nonExistentUserId },
      body: {},
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await banUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Đã ban user khỏi chat.",
    });

    // Verify room updated (user banned in room) - compare as strings
    const updatedRoom = await LiveRoom.findById(room._id);
    const bannedUserIds = updatedRoom.bannedUsers.map(id => id.toString());
    expect(bannedUserIds).toContain(nonExistentUserId);

    // Verify socket events still emitted
    const mockIo = getSocketIo();
    expect(mockIo.to).toHaveBeenCalledWith(room._id.toString());
    expect(mockIo.to().emit).toHaveBeenCalledWith("user-banned", {
      userId: nonExistentUserId,
    });
  });

  it("TC6 – messageId không tồn tại (200, vẫn ban user nhưng không xóa message)", async () => {
    const host = await User.create({
      email: "host6@example.com",
      passwordHash: "hash",
      username: "host6",
      displayName: "Host 6",
    });

    const bannedUser = await User.create({
      email: "banned6@example.com",
      passwordHash: "hash",
      username: "banned6",
      displayName: "Banned User 6",
    });

    const room = await LiveRoom.create({
      hostId: host._id,
      title: "Test Room 6",
      status: "live",
      privacyType: "public",
      streamKey: "key-6",
    });

    const nonExistentMessageId = new mongoose.Types.ObjectId().toString();

    const req = {
      params: { roomId: room._id.toString(), userId: bannedUser._id.toString() },
      body: { messageId: nonExistentMessageId },
      userId: host._id.toString(),
    };
    const res = createMockRes();

    await banUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Đã ban user khỏi chat.",
    });

    // Verify user still banned
    const updatedRoom = await LiveRoom.findById(room._id);
    expect(updatedRoom.bannedUsers).toContainEqual(bannedUser._id);

    // Verify message-removed NOT emitted (message doesn't exist)
    const mockIo = getSocketIo();
    expect(mockIo.to().emit).not.toHaveBeenCalledWith("message-removed", {
      messageId: nonExistentMessageId,
    });
  });
});

