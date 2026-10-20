const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const DATA_DIR = isServerless ? '/tmp' : path.join(__dirname, 'data');
const MENU_FILE = path.join(__dirname, 'data', 'menu.json');
const SESSION_FILE = path.join(DATA_DIR, 'session.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem warning
}

// Initial session state
const DEFAULT_SESSION = {
  title: "Đơn Trà Sữa Mừng Ngày Phụ Nữ Việt Nam 20-10 🌸",
  hostName: "Trưởng Nhóm / Chủ Xị",
  isLocked: false,
  sponsorMode: "sponsor_women", // 'sponsor_all' (Cánh mày râu bao hết), 'sponsor_women' (Bao riêng chị em 20/10), 'split' (Tự túc / Chia đều)
  customMessage: "Chúc toàn thể phái đẹp 20-10 luôn rực rỡ, ngọt ngào như ly trà sữa TUN TEA! 💐",
  createdAt: new Date().toISOString(),
  orders: []
};

// Load or initialize session
function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = fs.readFileSync(SESSION_FILE, 'utf8');
      return JSON.parse(data);
    }
    const bundledSession = path.join(__dirname, 'data', 'session.json');
    if (fs.existsSync(bundledSession)) {
      const data = fs.readFileSync(bundledSession, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading session:", err.message);
  }
  return { ...DEFAULT_SESSION };
}

function saveSession(session) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), 'utf8');
  } catch (err) {
    // In Vercel serverless, writes outside /tmp fail; keep in memory
    console.warn("File write skipped (serverless environment):", err.message);
  }
}

let sessionState = loadSession();

// SSE clients for real-time live synchronization
let sseClients = [];

function broadcastUpdate(type = 'UPDATE', payload = {}) {
  const data = JSON.stringify({ type, session: sessionState, payload, timestamp: Date.now() });
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch (e) {
      // client disconnected
    }
  });
}

// Get local LAN IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// API Routes
app.get('/api/menu', (req, res) => {
  try {
    const menuData = JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
    res.json(menuData);
  } catch (err) {
    res.status(500).json({ error: "Cannot load menu data" });
  }
});

app.get('/api/session', (req, res) => {
  res.json(sessionState);
});

app.get('/api/network-info', (req, res) => {
  const ip = getLocalIp();
  res.json({
    ip,
    port: PORT,
    url: `http://${ip}:${PORT}`,
    localUrl: `http://localhost:${PORT}`
  });
});

// Generate QR Code dynamically
app.get('/api/qr', async (req, res) => {
  try {
    const text = req.query.text || `http://${getLocalIp()}:${PORT}`;
    const qrDataUrl = await QRCode.toDataURL(text, {
      margin: 1,
      width: 320,
      color: {
        dark: '#2c1810',
        light: '#ffffff'
      }
    });
    // Return base64 or render directly as PNG
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': imgBuffer.length
    });
    res.end(imgBuffer);
  } catch (err) {
    res.status(500).send("Error generating QR");
  }
});

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const clientId = Date.now() + Math.random().toString(36).substring(2, 7);
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial state immediately
  res.write(`data: ${JSON.stringify({ type: 'INIT', session: sessionState })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// Add single or multiple orders
app.post('/api/orders', (req, res) => {
  if (sessionState.isLocked) {
    return res.status(403).json({ error: "Danh sách order đã bị khóa bởi người chốt đơn!" });
  }

  const newOrders = Array.isArray(req.body) ? req.body : [req.body];
  
  newOrders.forEach(item => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const basePrice = Number(item.basePrice) || 0;
    const toppingTotal = Number(item.toppingTotal) || 0;
    const unitPrice = basePrice + toppingTotal;
    const totalPrice = Number(item.totalPrice) || (unitPrice * qty);

    const orderItem = {
      id: item.id || ('order_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      customerName: (item.customerName || 'Ẩn danh').trim(),
      isWoman: Boolean(item.isWoman),
      drinkId: item.drinkId,
      drinkName: item.drinkName,
      category: item.category,
      size: item.size || 'L',
      quantity: qty,
      basePrice,
      sugar: item.sugar || '100% Đường',
      ice: item.ice || '100% Đá',
      toppings: Array.isArray(item.toppings) ? item.toppings : [],
      toppingTotal,
      unitPrice,
      totalPrice,
      note: (item.note || '').trim(),
      wish: (item.wish || '').trim(),
      timestamp: item.timestamp || new Date().toISOString()
    };
    sessionState.orders.push(orderItem);
  });

  saveSession(sessionState);
  broadcastUpdate('ORDER_ADDED', { count: newOrders.length });
  res.json({ success: true, count: newOrders.length, session: sessionState });
});

// Batch sync orders (useful for Vercel cold restarts or offline sync)
app.post('/api/session/sync', (req, res) => {
  const { orders } = req.body;
  if (Array.isArray(orders) && orders.length > 0) {
    orders.forEach(clientOrder => {
      const exists = sessionState.orders.some(o => o.id === clientOrder.id);
      if (!exists && clientOrder.drinkName) {
        sessionState.orders.push({
          ...clientOrder,
          quantity: Math.max(1, Number(clientOrder.quantity) || 1)
        });
      }
    });
    saveSession(sessionState);
    broadcastUpdate('SYNC_COMPLETED');
  }
  res.json({ success: true, session: sessionState });
});

// Update order
app.put('/api/orders/:id', (req, res) => {
  if (sessionState.isLocked) {
    return res.status(403).json({ error: "Danh sách order đã bị khóa!" });
  }

  const { id } = req.params;
  const index = sessionState.orders.findIndex(o => o.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy món cần sửa" });
  }

  sessionState.orders[index] = {
    ...sessionState.orders[index],
    ...req.body,
    id // keep original ID
  };

  saveSession(sessionState);
  broadcastUpdate('ORDER_UPDATED', { id });
  res.json({ success: true, order: sessionState.orders[index] });
});

// Delete order
app.delete('/api/orders/:id', (req, res) => {
  if (sessionState.isLocked) {
    return res.status(403).json({ error: "Danh sách order đã bị khóa!" });
  }

  const { id } = req.params;
  const initialLen = sessionState.orders.length;
  sessionState.orders = sessionState.orders.filter(o => o.id !== id);

  if (sessionState.orders.length === initialLen) {
    return res.status(404).json({ error: "Không tìm thấy món cần xóa" });
  }

  saveSession(sessionState);
  broadcastUpdate('ORDER_DELETED', { id });
  res.json({ success: true });
});

// Update session settings
app.post('/api/session/settings', (req, res) => {
  const { title, hostName, sponsorMode, customMessage } = req.body;
  if (title !== undefined) sessionState.title = title;
  if (hostName !== undefined) sessionState.hostName = hostName;
  if (sponsorMode !== undefined) sessionState.sponsorMode = sponsorMode;
  if (customMessage !== undefined) sessionState.customMessage = customMessage;

  saveSession(sessionState);
  broadcastUpdate('SETTINGS_UPDATED');
  res.json({ success: true, session: sessionState });
});

// Lock/Unlock session
app.post('/api/session/lock', (req, res) => {
  sessionState.isLocked = !sessionState.isLocked;
  saveSession(sessionState);
  broadcastUpdate('LOCK_TOGGLED', { isLocked: sessionState.isLocked });
  res.json({ success: true, isLocked: sessionState.isLocked });
});

// Reset session (archive previous)
app.post('/api/session/reset', (req, res) => {
  if (sessionState.orders.length > 0) {
    const archiveFile = path.join(DATA_DIR, `archive_${Date.now()}.json`);
    fs.writeFileSync(archiveFile, JSON.stringify(sessionState, null, 2), 'utf8');
  }

  sessionState = {
    ...DEFAULT_SESSION,
    title: req.body.title || DEFAULT_SESSION.title,
    createdAt: new Date().toISOString(),
    orders: []
  };

  saveSession(sessionState);
  broadcastUpdate('SESSION_RESET');
  res.json({ success: true, session: sessionState });
});

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIp();
    console.log(`\n======================================================`);
    console.log(`🌸 TUN TEA 20-10 ORDER APP IS RUNNING! 🌸`);
    console.log(`- Trực tiếp trên máy: http://localhost:${PORT}`);
    console.log(`- Gửi cho mọi người (WiFi/LAN): http://${localIp}:${PORT}`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
