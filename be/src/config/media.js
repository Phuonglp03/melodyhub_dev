import NodeMediaServer from 'node-media-server';
import LiveRoom from '../models/LiveRoom.js';
import { getSocketIo } from './socket.js'; // Import từ file socket.js
import net from 'net';
import fs from 'fs';
import path from 'path';

export const nodeMediaServer = () => {
  // Cấu hình chi tiết cho Node Media Server (Production-optimized)
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
      allow_origin: '*',
      cors: {
        allowOrigin: '*',
        allowMethods: ['GET', 'HEAD', 'OPTIONS'],
        allowHeaders: ['Range', 'Content-Type', 'Accept']
      },
      setHeaders: (res, path, stat) => {
        // Nếu là file playlist (.m3u8), cấm tuyệt đối việc cache
        if (path.endsWith('.m3u8')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          res.setHeader('Expires', '0');
          res.setHeader('Pragma', 'no-cache');
        }
      }
      
    },
    trans: {
      ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
      tasks: [
        {
          app: 'live',
          hls: true,
          hlsFlags: '[hls_time=2:hls_list_size=10:hls_flags=delete_segments+append_list]',
          hlsKeep: true, 
          vc: "libx264", 
          vcParam: [
            "-preset", "veryfast",       // Xử lý nhanh để không trễ
            "-tune", "zerolatency",      // Tối ưu cho live
            "-b:v", "2500k",             // GIỚI HẠN Bitrate video ở mức 2.5Mbps (An toàn cho GCS)
            "-maxrate", "3000k",         // Không bao giờ vượt quá 3Mbps
            "-bufsize", "6000k",
            "-g", "60",                  // Keyframe mỗi 2 giây (nếu fps=30) - Bắt buộc cho HLS mượt
            "-sc_threshold", "0",        // Không tự ý chèn keyframe linh tinh
            "-profile:v", "main",        // Profile chuẩn cho mọi thiết bị
            "-pix_fmt", "yuv420p"        // Màu chuẩn, tránh lỗi đen màn hình trên VLC
          ],
          
          // 2. Ép chuyển mã lại âm thanh
          ac: "aac",
          acParam: ["-ab", "128k", "-ac", "2", "-ar", "44100"],
          dash: false
        }
      ]
    },
    auth: {
      api: false, 
    }
  };

  const nms = new NodeMediaServer(config);
  const pendingEndTimeouts = new Map();

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

  nms.on('prePublish', async (id, streamPath, args) => {
    console.log(`[NMS] prePublish: ${streamPath}`);
  
    const parts = streamPath.split('/');
    const streamKey = parts[parts.length - 1];
    
    if (!streamKey) {
    let session = nms.getSession(id);
      if (session) session.reject();
      return;
    }
  
    try {
      // CHỈ REJECT NẾU ROOM KHÔNG TỒN TẠI HOẶC ĐÃ THẬT SỰ ENDED
      const room = await LiveRoom.findOne({ 
        streamKey: streamKey 
      });
  
      if (!room || room.status === 'ended') {
        console.log(`[NMS] Reject: Stream key không hợp lệ hoặc đã ended: ${streamKey}`);
        let session = nms.getSession(id);
        if (session) session.reject();
        return;
      }
  
      // CHO PHÉP reconnect nếu room đang preview/live/waiting
      console.log(`[NMS] Chấp nhận publish (có thể là reconnect): ${streamKey} - status: ${room.status}`);
      // Nếu có timeout pending end → hủy ngay (vì đã reconnect thành công)
      if (pendingEndTimeouts.has(streamKey)) {
        clearTimeout(pendingEndTimeouts.get(streamKey));
        pendingEndTimeouts.delete(streamKey);
        console.log(`[NMS] Đã hủy pending end (reconnect thành công): ${streamKey}`);
      }
  
    } catch (err) {
      console.error(`[NMS] Lỗi prePublish: ${err.message}`);
      let session = nms.getSession(id);
      if (session) session.reject();
    }
  });
  
  // === postPublish === (giữ nguyên nhưng thêm log rõ hơn)
  nms.on('postPublish', async (id, streamPath, args) => {
    console.log(`[NMS] postPublish (stream ready/reconnect): ${streamPath}`);
    
    const parts = streamPath.split('/');
    const streamKey = parts[parts.length - 1];
    const io = getSocketIo(); 
    
    try {
      const room = await LiveRoom.findOneAndUpdate(
        { streamKey: streamKey },
        { 
          status: 'preview', 
          startedAt: new Date(),
          // Nếu muốn phân biệt live thật sự thì thêm field separate: broadcastStatus: 'live'
        },
        { new: true }
      ).populate('hostId', 'displayName avatarUrl');
      
      if (room) {
        const hostSocketRoomId = room.hostId.toString();
        // Emit ngay cả khi reconnect → host thấy preview lại ready → auto reload player
        io.to(hostSocketRoomId).emit('stream-preview-ready', room);
        console.log(`[NMS] stream-preview-ready emitted (có thể là reconnect): ${streamKey}`);
      }
      
    } catch (err) {
      console.error(`[NMS] Lỗi postPublish: ${err.message}`);
    }
  });
  
  // === donePublish === (SỬA HOÀN TOÀN - KHÔNG END NGAY)
  nms.on('donePublish', async (id, streamPath, args) => {
    console.log(`[NMS] donePublish: ${streamPath}`);
  
    const parts = streamPath.split('/');
    const streamKey = parts[parts.length - 1];
    const io = getSocketIo();
    
    // CHO PHÉP RECONNECT TRONG 45 GIÂY (tùy chỉnh thoải mái)
    const RECONNECT_WINDOW = 45 * 1000; // 45 giây
  
    const timeout = setTimeout(async () => {
      try {
        const room = await LiveRoom.findOneAndUpdate(
          { streamKey: streamKey },
          { status: 'ended', endedAt: new Date() },
          { new: true }
        );
  
        if (room) {
          io.emit('stream-ended', { roomId: room._id, title: room.title });
          io.to(room._id.toString()).emit('stream-status-ended'); 
          console.log(`[NMS] Stream thật sự ended sau ${RECONNECT_WINDOW/1000}s không reconnect: ${streamKey}`);
  
          // Cleanup segments (giữ nguyên logic cũ của bạn)
          const streamDir = path.join(config.http.mediaroot, 'live', streamKey);
          if (fs.existsSync(streamDir)) {
            fs.rmSync(streamDir, { recursive: true, force: true });
            console.log(`[NMS] Đã xóa segments: ${streamDir}`);
          }
        }
      } catch (err) {
        console.error(`[NMS] Lỗi khi end stream: ${err.message}`);
      } finally {
        pendingEndTimeouts.delete(streamKey);
      }
    }, RECONNECT_WINDOW);
  
    pendingEndTimeouts.set(streamKey, timeout);
    console.log(`[NMS] Publisher disconnect → chờ ${RECONNECT_WINDOW/1000}s để end thật sự: ${streamKey}`);
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