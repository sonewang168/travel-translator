const express = require('express');
const { translateText } = require('../services/translator');

const router = express.Router();

// POST /api/translate
router.post('/', async (req, res) => {
    try {
        const { text, from, to } = req.body;
        
        if (!text || !from || !to) {
            return res.status(400).json({ 
                error: '缺少必要參數',
                required: ['text', 'from', 'to']
            });
        }
        
        const result = await translateText(text, from, to);
        
        res.json({
            success: true,
            original: text,
            translated: result.translated,
            from,
            to,
            engine: result.engine
        });
        
    } catch (error) {
        console.error('翻譯 API 錯誤:', error);
        res.status(500).json({ 
            error: '翻譯失敗',
            message: error.message 
        });
    }
});

// GET /api/translate/languages - 取得支援語言列表
router.get('/languages', (req, res) => {
    res.json({
        languages: [
            { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
            { code: 'zh-CN', name: '簡體中文', flag: '🇨🇳' },
            { code: 'en', name: '英文', flag: '🇺🇸' },
            { code: 'ja', name: '日文', flag: '🇯🇵' },
            { code: 'ko', name: '韓文', flag: '🇰🇷' },
            { code: 'es', name: '西班牙文', flag: '🇪🇸' },
            { code: 'fr', name: '法文', flag: '🇫🇷' },
            { code: 'de', name: '德文', flag: '🇩🇪' },
            { code: 'it', name: '義大利文', flag: '🇮🇹' },
            { code: 'pt', name: '葡萄牙文', flag: '🇵🇹' },
            { code: 'ru', name: '俄文', flag: '🇷🇺' },
            { code: 'nl', name: '荷蘭文', flag: '🇳🇱' },
            { code: 'th', name: '泰文', flag: '🇹🇭' },
            { code: 'vi', name: '越南文', flag: '🇻🇳' },
            { code: 'id', name: '印尼文', flag: '🇮🇩' },
            { code: 'hi', name: '印地文', flag: '🇮🇳' },
            { code: 'ar', name: '阿拉伯文', flag: '🇸🇦' },
            { code: 'he', name: '希伯來文', flag: '🇮🇱' },
            { code: 'tr', name: '土耳其文', flag: '🇹🇷' },
            { code: 'pl', name: '波蘭文', flag: '🇵🇱' }
        ]
    });
});

module.exports = router;
