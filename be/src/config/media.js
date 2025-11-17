import NodeMediaServer from 'node-media-server';
import LiveRoom from '../models/LiveRoom.js';
import { getSocketIo } from './socket.js'; // Import từ file socket.js
import net from 'net';

export const nodeMediaServer = () => {
  // Cấu hình chi tiết cho Node Media Server
  const config = {
    logType: 3,
    rtmp: {
      port: 1935,
      chunk_size: 60000,
      gop_cache: true,
      ping: 30,
      ping_timeout: 60
    },
    http: {
      port: 8000, 
      mediaroot: './media', 
      allow_origin: '*'
    },
    trans: {
      ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
      tasks: [
        {
          app: 'live',
          hls: true,
          hlsFlags: '[hls_time=6:hls_list_size=0:hls_flags=append_list]',
          hlsKeep: true,
          flv: true,
          flvFlags: '[flv_fragment_duration=10]'
        }
      ]
    },
    auth: {
      api: false, 
    }
  };

  const nms = new NodeMediaServer(config);
  

  const checkServerConnection = (host, port) => {
    return new Promise((resolve) => {
      const client = new net.Socket();
      client.setTimeout(1000);
      client.on('connect', () => {
        client.destroy();
        resolve(true);
      });
      client.on('error', () => {
        client.destroy();
        resolve(false);
      });
      client.on('timeout', () => {
        client.destroy();
        resolve(false);
      });
      client.connect(port, host);
    });
  };

  // === prePublish ===
  nms.on('prePublish', async (id, streamPath, args) => {
    console.log(`[NMS] prePublish: ${streamPath}`);

    const parts = streamPath.split('/');
    const streamKey = parts[parts.length - 1];
    
    if (!streamKey) {
      console.log(`[NMS] Từ chối: Không có stream key.`);
      let session = nms.getSession(id);
      if (session) session.reject();
      return;
    }
    
    try {
      const room = await LiveRoom.findOne({ streamKey: streamKey, status: 'waiting' });
      
      if (!room) {
        console.log(`[NMS] Từ chối: Stream key không hợp lệ hoặc phòng không 'waiting': ${streamKey}`);
        let session = nms.getSession(id);
        if (session) session.reject();
        return;
      }

      console.log(`[NMS] Chấp nhận stream key: ${streamKey}`);
    } catch (err) {
      console.error(`[NMS] Lỗi khi xác thực stream key: ${err.message}`);
      let session = nms.getSession(id);
      if (session) session.reject();
    }
  });

  // === postPublish ===
  nms.on('postPublish', async (id, streamPath, args) => {
    console.log(`[NMS] postPublish: ${streamPath}`);
    
    const parts = streamPath.split('/');
    const streamKey = parts[parts.length - 1];
    const io = getSocketIo(); 
    
    try {
      const room = await LiveRoom.findOneAndUpdate(
        { streamKey: streamKey },
        { status: 'preview', startedAt: new Date() },
        { new: true }
      ).populate('hostId', 'displayName avatarUrl');
      
      if (room) {
        const hostSocketRoomId = room.hostId.toString();
        io.to(hostSocketRoomId).emit('stream-preview-ready', room);
        console.log(`[NMS] Đã gửi 'stream-preview-ready' đến host: ${hostSocketRoomId}`);
      }
      
    } catch (err) {
      console.error(`[NMS] Lỗi khi cập nhật trạng thái 'live': ${err.message}`);
    }
  });

  // === donePublish ===
  nms.on('donePublish', async (id, streamPath, args) => {
    console.log(`[NMS] donePublish: ${streamPath}`);

    const parts = streamPath.split('/');
    const streamKey = parts[parts.length - 1];
    const io = getSocketIo();
    
    try {
      const room = await LiveRoom.findOneAndUpdate(
        { streamKey: streamKey, status: { $in: ['preview', 'live'] } },
        { status: 'ended', endedAt: new Date() },
        { new: true }
      );
      
      if (room) {
        io.emit('stream-ended', { roomId: room._id, title: room.title });
        io.to(room._id.toString()).emit('stream-status-ended'); 
        console.log(`[NMS] Stream kết thúc (${room.status}), thông báo cho phòng: ${room._id}`);
      }
    } catch (err) {
      console.error(`[NMS] Lỗi khi cập nhật trạng thái 'ended': ${err.message}`);
    }
  });

  nms.on('postPlay', (id, StreamPath, args) => {
    console.log(`[NMS] Client bắt đầu xem stream: ${StreamPath}`);
  });

  nms.run();
  console.log(`Node Media Server đang chạy (RTMP: port ${config.rtmp.port}, HTTP: port ${config.http.port})`);
  
  
  setTimeout(async () => {
    console.log('[NMS] Kiểm tra server đã khởi động xong');
    
    // Kiểm tra kết nối RTMP
    const rtmpConnected = await checkServerConnection('127.0.0.1', config.rtmp.port);
    console.log(`[NMS] RTMP Server (port ${config.rtmp.port}): ${rtmpConnected ? 'ONLINE' : 'OFFLINE'}`);
    console.log(`[NMS] RTMP URL: rtmp://localhost:${config.rtmp.port}/live`);
    
    // Kiểm tra kết nối HTTP
    const httpConnected = await checkServerConnection('127.0.0.1', config.http.port);
    console.log(`[NMS] HTTP Server (port ${config.http.port}): ${httpConnected ? 'ONLINE' : 'OFFLINE'}`);
    console.log(`[NMS] HLS URL: http://localhost:${config.http.port}/live/{stream-key}/index.m3u8`);
    
    if (!rtmpConnected || !httpConnected) {
      console.log('[NMS] CẢNH BÁO: Một hoặc nhiều server không khởi động được. Kiểm tra xem cổng có bị chiếm dụng không.');
    }
  }, 2000);
  
  return nms;
};