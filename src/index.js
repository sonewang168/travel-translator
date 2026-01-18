require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const lineRouter = require('./routes/linebot');
const translateRouter = require('./routes/translate');

const app = express();
const PORT = process.env.PORT || 3000;

// 中介軟體
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// 健康檢查 (Railway 用)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: '旅遊~即時翻譯',
        timestamp: new Date().toISOString() 
    });
});

// API 路由
app.use('/api/translate', express.json(), translateRouter);
app.use('/webhook/line', lineRouter);

// PWA 路由 (所有其他請求導向 index.html)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 錯誤處理
app.use((err, req, res, next) => {
    console.error('伺服器錯誤:', err);
    res.status(500).json({ error: '伺服器內部錯誤' });
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║    🌏 旅遊~即時翻譯 伺服器已啟動          ║
║    📍 Port: ${PORT}                          ║
║    🔗 http://localhost:${PORT}               ║
╚══════════════════════════════════════════╝
    `);
});
