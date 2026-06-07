const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// تخزين رموز الإشعارات للأجهزة المسجلة
const deviceTokens = new Map();

app.get('/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

io.on('connection', (socket) => {
  console.log('✅ Device connected:', socket.handshake.address);
  
  socket.on('register-device', (data) => {
    console.log('📱 Device registered:', data.name, data.ip);
    if (data.expoPushToken) {
      deviceTokens.set(data.ip, data.expoPushToken);
      console.log(`   🔔 Push token saved for ${data.ip}`);
    }
    socket.broadcast.emit('device-online', data);
  });
  
  socket.on('request-notification', async (data) => {
    const { targetIp, callerName, callerIp } = data;
    const pushToken = deviceTokens.get(targetIp);
    
    if (pushToken) {
      console.log(`📤 Sending notification to ${targetIp} from ${callerName}`);
      
      try {
        const fetch = await import('node-fetch');
        const response = await fetch.default('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: pushToken,
            title: '📞 Incoming Call',
            body: `${callerName} is calling you...`,
            data: { callerName, callerIp, type: 'call' },
            sound: 'default',
            priority: 'high'
          })
        });
        const result = await response.json();
        if (result.data?.status === 'ok') console.log('✅ Notification sent successfully');
        else console.log('⚠️ Notification response:', result);
      } catch (error) {
        console.error('❌ Failed to send notification:', error.message);
      }
    } else {
      console.log(`❌ No push token for ${targetIp}`);
      socket.emit('device-unavailable', { targetIp });
    }
  });
  
  socket.on('private-message', (data) => {
    console.log('💬 Message from:', data.from);
    socket.broadcast.emit('private-message', data);
  });
  
  socket.on('call-offer', (data) => {
    console.log('📞 Call offer from:', data.fromName);
    socket.broadcast.emit('call-offer', data);
  });
  
  socket.on('call-answer', (data) => {
    console.log('📞 Call answer');
    socket.broadcast.emit('call-answer', data);
  });
  
  socket.on('ice-candidate', (data) => {
    console.log('❄️ ICE candidate');
    socket.broadcast.emit('ice-candidate', data);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Device disconnected');
  });
});

// المنفذ المستخدم للنشر على SnapDeploy (يجب أن يكون 8080 أو يستخدم متغير البيئة)
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LAN Server running on port ${PORT}`);
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`   📡 Server IP: ${net.address}`);
        break;
      }
    }
  }
});
