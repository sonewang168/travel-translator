const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { translateText } = require('../services/translator');
const { transcribeAudio, mapWhisperLanguage } = require('../services/whisper');
const { textToSpeech } = require('../services/tts');

const router = express.Router();
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET;
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
    : (process.env.BASE_URL || 'http://localhost:3000');

// 使用者設定儲存 (生產環境建議用 Redis)
const userSettings = new Map();

// 翻譯歷史儲存 (每個用戶最多保留 20 筆)
const userHistory = new Map();
const MAX_HISTORY = 20;

// 語言名稱對照
const langNames = {
    '中文': 'zh-TW', '繁中': 'zh-TW', '繁體': 'zh-TW', '台灣': 'zh-TW',
    '簡中': 'zh-CN', '簡體': 'zh-CN', '中國': 'zh-CN',
    '英文': 'en', '英語': 'en', '英': 'en',
    '日文': 'ja', '日語': 'ja', '日本': 'ja', '日': 'ja',
    '韓文': 'ko', '韓語': 'ko', '韓國': 'ko', '韓': 'ko',
    '西班牙文': 'es', '西語': 'es', '西': 'es',
    '法文': 'fr', '法語': 'fr', '法': 'fr',
    '德文': 'de', '德語': 'de', '德': 'de',
    '義大利文': 'it', '義語': 'it',
    '葡萄牙文': 'pt', '葡語': 'pt',
    '俄文': 'ru', '俄語': 'ru',
    '泰文': 'th', '泰語': 'th', '泰': 'th',
    '越南文': 'vi', '越語': 'vi', '越': 'vi',
    '印尼文': 'id',
    '阿拉伯文': 'ar', '阿語': 'ar',
    '土耳其文': 'tr'
};

// 驗證 LINE Signature
function validateSignature(body, signature) {
    if (!LINE_SECRET) return true; // 開發模式跳過驗證
    const hash = crypto
        .createHmac('sha256', LINE_SECRET)
        .update(body)
        .digest('base64');
    return hash === signature;
}

// 回覆訊息
async function replyMessage(replyToken, messages) {
    if (!LINE_TOKEN) {
        console.log('LINE 回覆 (模擬):', messages);
        return;
    }
    
    try {
        const response = await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LINE_TOKEN}`
            },
            body: JSON.stringify({ replyToken, messages })
        });
        
        if (!response.ok) {
            console.error('LINE 回覆失敗:', await response.text());
        }
    } catch (error) {
        console.error('LINE API 錯誤:', error);
    }
}

// Webhook 處理
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['x-line-signature'];
    const bodyStr = req.body.toString();
    
    if (!validateSignature(bodyStr, signature)) {
        console.error('LINE Signature 驗證失敗');
        return res.status(403).send('Invalid signature');
    }

    try {
        const body = JSON.parse(bodyStr);
        console.log('收到 LINE Webhook:', JSON.stringify(body, null, 2));
        
        for (const event of body.events || []) {
            if (event.type === 'message') {
                await handleMessage(event);
            } else if (event.type === 'follow') {
                await handleFollow(event);
            }
        }
    } catch (error) {
        console.error('Webhook 處理錯誤:', error);
    }
    
    res.status(200).send('OK');
});

// 新好友加入
async function handleFollow(event) {
    const replyToken = event.replyToken;
    
    await replyMessage(replyToken, [{
        type: 'text',
        text: `🌏 歡迎使用【旅遊~即時翻譯】！

直接輸入文字就能翻譯喔！
預設：中文 ➜ 英文

📖 指令說明：
/語言 - 查看 20 種支援語言
/設定 中文 日文 - 更改翻譯方向
/交換 - 交換翻譯語言
/說明 - 顯示使用說明

🎤 也可以傳送語音訊息翻譯！

祝您旅途愉快！✈️`
    }]);
}

// 處理訊息
async function handleMessage(event) {
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    
    // 取得使用者設定，預設中文→英文
    let settings = userSettings.get(userId) || { from: 'zh-TW', to: 'en' };
    
    if (event.message.type === 'text') {
        const text = event.message.text.trim();
        
        // 處理圖文選單指令（不帶 /）
        const menuResponse = await handleMenuCommand(replyToken, userId, text, settings);
        if (menuResponse) return;
        
        // 檢查是否為指令（帶 /）
        if (text.startsWith('/') || text.startsWith('／')) {
            await handleCommand(replyToken, userId, text.replace('／', '/'));
            return;
        }
        
        // 處理語言切換快捷指令
        const langSwitch = handleLangSwitch(userId, text);
        if (langSwitch) {
            await replyMessage(replyToken, [{
                type: 'text',
                text: `✅ 已切換語言\n\n${langSwitch.fromName} ↔️ ${langSwitch.toName}\n\n現在可以開始翻譯了！`
            }]);
            return;
        }
        
        // 處理重播指令
        const replayMatch = text.match(/^重播\s*(\d+)$/);
        if (replayMatch) {
            const index = parseInt(replayMatch[1]) - 1;
            const history = getHistory(userId);
            if (index >= 0 && index < history.length) {
                const item = history[index];
                try {
                    const tts = await textToSpeech(item.translated, item.to);
                    const audioUrl = `${BASE_URL}/audio/${tts.filename}`;
                    await replyMessage(replyToken, [
                        {
                            type: 'text',
                            text: `🔄 重播第 ${index + 1} 筆\n\n${item.original}\n→ ${item.translated}`
                        },
                        {
                            type: 'audio',
                            originalContentUrl: audioUrl,
                            duration: tts.duration
                        }
                    ]);
                } catch (e) {
                    console.error('重播 TTS 失敗:', e);
                    await replyMessage(replyToken, [{
                        type: 'text',
                        text: `🔄 重播第 ${index + 1} 筆\n\n${item.original}\n→ ${item.translated}\n\n❌ 語音生成失敗`
                    }]);
                }
            } else {
                await replyMessage(replyToken, [{
                    type: 'text',
                    text: `❌ 找不到第 ${index + 1} 筆記錄\n\n輸入「翻譯歷史」查看記錄`
                }]);
            }
            return;
        }
        
        // 處理詳細指令
        const detailMatch = text.match(/^詳細\s*(\d+)$/);
        if (detailMatch) {
            const index = parseInt(detailMatch[1]) - 1;
            const history = getHistory(userId);
            if (index >= 0 && index < history.length) {
                const item = history[index];
                const icon = item.type === 'voice' ? '🎤' : '⌨️';
                const fromName = getLangDisplayName(item.from);
                const toName = getLangDisplayName(item.to);
                const timeStr = item.time.toLocaleString('zh-TW', { 
                    month: 'numeric', 
                    day: 'numeric',
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                await replyMessage(replyToken, [{
                    type: 'text',
                    text: `📜 第 ${index + 1} 筆詳細\n\n${icon} ${fromName} → ${toName}\n🕐 ${timeStr}\n\n【原文】\n${item.original}\n\n【翻譯】\n${item.translated}\n\n💡 輸入「重播 ${index + 1}」可播放語音`
                }]);
            } else {
                await replyMessage(replyToken, [{
                    type: 'text',
                    text: `❌ 找不到第 ${index + 1} 筆記錄\n\n輸入「翻譯歷史」查看記錄`
                }]);
            }
            return;
        }
        
        try {
            // 偵測語言並自動切換方向
            const isSourceLang = detectLanguage(text, settings.from);
            const actualFrom = isSourceLang ? settings.from : settings.to;
            const actualTo = isSourceLang ? settings.to : settings.from;
            
            // 翻譯文字
            const result = await translateText(text, actualFrom, actualTo);
            
            // 儲存翻譯歷史
            addHistory(userId, {
                original: text,
                translated: result.translated,
                from: actualFrom,
                to: actualTo,
                type: 'text',
                time: new Date()
            });
            
            await replyMessage(replyToken, [
                { 
                    type: 'text', 
                    text: `${result.translated}`
                }
            ]);
            
        } catch (error) {
            console.error('翻譯錯誤:', error);
            await replyMessage(replyToken, [{
                type: 'text',
                text: '❌ 翻譯失敗，請稍後再試'
            }]);
        }
    }
    
    if (event.message.type === 'audio') {
        // 處理語音訊息 - 使用 Whisper 語音辨識
        await handleAudioMessage(event, replyToken, settings);
    }
}

/**
 * 下載 LINE 音檔
 */
async function downloadLineAudio(messageId) {
    if (!LINE_TOKEN) {
        throw new Error('LINE_TOKEN 未設定');
    }
    
    const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${LINE_TOKEN}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`下載音檔失敗: ${response.status}`);
    }
    
    const buffer = await response.buffer();
    console.log(`音檔下載完成: ${buffer.length} bytes`);
    return buffer;
}

/**
 * 處理語音訊息
 */
async function handleAudioMessage(event, replyToken, settings) {
    const messageId = event.message.id;
    
    // 檢查是否有 OpenAI API Key
    if (!OPENAI_API_KEY) {
        await replyMessage(replyToken, [{
            type: 'text',
            text: '🎤 語音翻譯功能未啟用\n\n請先用文字輸入！'
        }]);
        return;
    }
    
    try {
        // 1. 下載音檔
        console.log('開始下載音檔...');
        const audioBuffer = await downloadLineAudio(messageId);
        
        // 2. 使用 Whisper 語音轉文字
        console.log('開始語音辨識...');
        const transcription = await transcribeAudio(audioBuffer, 'audio.m4a');
        
        if (!transcription.text || transcription.text.trim() === '') {
            await replyMessage(replyToken, [{
                type: 'text',
                text: '🎤 無法辨識語音內容\n\n請再試一次，說話時請靠近麥克風'
            }]);
            return;
        }
        
        console.log(`語音辨識: "${transcription.text}" (語言: ${transcription.language})`);
        
        // 3. 翻譯
        const detectedLang = mapWhisperLanguage(transcription.language);
        const isFromA = detectedLang === settings.from || 
                        (detectedLang === 'zh-TW' && settings.from.startsWith('zh'));
        const actualFrom = isFromA ? settings.from : settings.to;
        const actualTo = isFromA ? settings.to : settings.from;
        
        const result = await translateText(transcription.text, actualFrom, actualTo);
        
        // 儲存翻譯歷史
        addHistory(event.source.userId, {
            original: transcription.text,
            translated: result.translated,
            from: actualFrom,
            to: actualTo,
            type: 'voice',
            time: new Date()
        });
        
        // 4. 生成翻譯結果的語音
        let messages = [{
            type: 'text',
            text: `🎤 ${transcription.text}\n\n🌏 ${result.translated}`
        }];
        
        try {
            console.log('生成 TTS 語音...');
            const tts = await textToSpeech(result.translated, actualTo);
            const audioUrl = `${BASE_URL}/audio/${tts.filename}`;
            
            console.log(`TTS 音檔 URL: ${audioUrl}`);
            
            // 加入語音訊息
            messages.push({
                type: 'audio',
                originalContentUrl: audioUrl,
                duration: tts.duration
            });
        } catch (ttsError) {
            console.error('TTS 生成失敗，只回覆文字:', ttsError.message);
            // TTS 失敗時只回覆文字
        }
        
        // 5. 回覆
        await replyMessage(replyToken, messages);
        
    } catch (error) {
        console.error('語音處理錯誤:', error.message);
        await replyMessage(replyToken, [{
            type: 'text',
            text: '❌ 語音辨識失敗\n\n請再試一次或改用文字輸入'
        }]);
    }
}

/**
 * 主動推送訊息（不需 replyToken）
 */
async function pushMessage(userId, messages) {
    if (!LINE_TOKEN) {
        console.log('LINE Push (模擬):', messages);
        return;
    }
    
    try {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LINE_TOKEN}`
            },
            body: JSON.stringify({ 
                to: userId, 
                messages 
            })
        });
        
        if (!response.ok) {
            console.error('Push message 失敗:', await response.text());
        }
    } catch (error) {
        console.error('Push message 錯誤:', error);
    }
}

// 處理圖文選單指令
async function handleMenuCommand(replyToken, userId, text, settings) {
    const fromName = getLangDisplayName(settings.from);
    const toName = getLangDisplayName(settings.to);
    
    switch (text) {
        case '語音翻譯':
            const hasWhisper = !!OPENAI_API_KEY;
            await replyMessage(replyToken, [{
                type: 'text',
                text: hasWhisper 
                    ? `🎤 語音翻譯模式

✅ 語音翻譯已啟用！

直接按住麥克風錄音傳送，我會：
1. 辨識你說的話
2. 自動翻譯成目標語言

目前設定：${fromName} ↔️ ${toName}

💡 支援中、英、日、韓、泰、越等多國語言`
                    : `🎤 語音翻譯功能

請使用網頁版進行語音翻譯：
👉 https://travel-translator.railway.app

或直接在這裡輸入文字，我會幫你翻譯！

目前設定：${fromName} ↔️ ${toName}`
            }]);
            return true;
            
        case '文字翻譯':
            await replyMessage(replyToken, [{
                type: 'text',
                text: `⌨️ 文字翻譯模式

目前設定：${fromName} ↔️ ${toName}

直接輸入任何文字，我會自動偵測並翻譯！

💡 例如輸入「你好」或「Hello」試試`
            }]);
            return true;
            
        case '切換語言':
            await replyMessage(replyToken, [{
                type: 'text',
                text: `🌏 切換語言

目前：${fromName} ↔️ ${toName}

快速切換（直接輸入）：
• 中英 → 中文↔英文
• 中日 → 中文↔日文
• 中韓 → 中文↔韓文
• 中泰 → 中文↔泰文
• 中越 → 中文↔越南文
• 中法 → 中文↔法文
• 英日 → 英文↔日文

或用指令：/設定 中文 日文`
            }]);
            return true;
            
        case '常用句':
            await replyMessage(replyToken, [{
                type: 'text',
                text: `💬 旅遊常用句

【打招呼】
你好 / Hello / こんにちは / 안녕하세요

【問路】
請問...在哪裡？
這裡離...有多遠？
我迷路了

【用餐】
請給我菜單
這個多少錢？
很好吃！/ 結帳

【購物】
可以便宜一點嗎？
可以刷卡嗎？
我要這個

【緊急】
請幫助我
我需要醫生
請叫警察

💡 直接輸入任何句子即可翻譯！`
            }]);
            return true;
            
        case '翻譯歷史':
            const history = getHistory(userId);
            if (history.length === 0) {
                await replyMessage(replyToken, [{
                    type: 'text',
                    text: `📜 翻譯歷史

還沒有翻譯記錄

開始翻譯後，記錄會顯示在這裡！
輸入「重播 1」可重播第 1 筆翻譯的語音`
                }]);
            } else {
                let historyText = '📜 翻譯歷史（最近 10 筆）\n\n';
                const recent = history.slice(0, 10);
                recent.forEach((item, i) => {
                    const icon = item.type === 'voice' ? '🎤' : '⌨️';
                    const fromName = getLangDisplayName(item.from);
                    const toName = getLangDisplayName(item.to);
                    historyText += `${i + 1}. ${icon} ${fromName}→${toName}\n`;
                    historyText += `   ${item.original.substring(0, 20)}${item.original.length > 20 ? '...' : ''}\n`;
                    historyText += `   → ${item.translated.substring(0, 20)}${item.translated.length > 20 ? '...' : ''}\n\n`;
                });
                historyText += '💡 輸入「重播 1」可重播第 1 筆的語音\n';
                historyText += '💡 輸入「詳細 1」可查看完整內容';
                
                await replyMessage(replyToken, [{
                    type: 'text',
                    text: historyText
                }]);
            }
            return true;
            
        case '使用說明':
            await replyMessage(replyToken, [{
                type: 'text',
                text: `❓ 使用說明

🔹 直接輸入文字即可翻譯
🔹 傳送語音訊息可語音翻譯
🔹 自動偵測輸入語言
🔹 支援 20 種語言

📱 支援語言：
繁中、簡中、英、日、韓、泰、越、印尼、法、德、西、葡、俄、義、阿拉伯、土耳其...

🌐 網頁版：
https://travel-translator.railway.app

💡 小技巧：
• 輸入「中日」可快速切換語言
• 長按訊息可複製翻譯結果
• /交換 可交換翻譯方向`
            }]);
            return true;
    }
    
    return false;
}

// 處理語言快速切換
function handleLangSwitch(userId, text) {
    const langPairs = {
        '中英': ['zh-TW', 'en', '中文', '英文'],
        '中日': ['zh-TW', 'ja', '中文', '日文'],
        '中韓': ['zh-TW', 'ko', '中文', '韓文'],
        '中泰': ['zh-TW', 'th', '中文', '泰文'],
        '中越': ['zh-TW', 'vi', '中文', '越南文'],
        '中法': ['zh-TW', 'fr', '中文', '法文'],
        '中德': ['zh-TW', 'de', '中文', '德文'],
        '中西': ['zh-TW', 'es', '中文', '西班牙文'],
        '英日': ['en', 'ja', '英文', '日文'],
        '英韓': ['en', 'ko', '英文', '韓文'],
        '日韓': ['ja', 'ko', '日文', '韓文']
    };
    
    if (langPairs[text]) {
        const [from, to, fromName, toName] = langPairs[text];
        userSettings.set(userId, { from, to });
        return { fromName, toName };
    }
    
    return null;
}

// 取得語言顯示名稱
function getLangDisplayName(code) {
    const names = {
        'zh-TW': '繁體中文',
        'zh-CN': '簡體中文',
        'en': '英文',
        'ja': '日文',
        'ko': '韓文',
        'th': '泰文',
        'vi': '越南文',
        'fr': '法文',
        'de': '德文',
        'es': '西班牙文',
        'it': '義大利文',
        'pt': '葡萄牙文',
        'ru': '俄文',
        'id': '印尼文',
        'ar': '阿拉伯文',
        'tr': '土耳其文'
    };
    return names[code] || code;
}

// 新增翻譯歷史
function addHistory(userId, record) {
    if (!userHistory.has(userId)) {
        userHistory.set(userId, []);
    }
    const history = userHistory.get(userId);
    history.unshift(record); // 新的在前面
    if (history.length > MAX_HISTORY) {
        history.pop(); // 移除最舊的
    }
    console.log(`已儲存翻譯歷史: ${userId}, 共 ${history.length} 筆`);
}

// 取得翻譯歷史
function getHistory(userId) {
    return userHistory.get(userId) || [];
}

// 簡單的語言偵測
function detectLanguage(text, expectedLang) {
    // 檢查中文
    const hasChinese = /[\u4e00-\u9fff]/.test(text);
    // 檢查日文假名
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
    // 檢查韓文
    const hasKorean = /[\uac00-\ud7af]/.test(text);
    // 檢查泰文
    const hasThai = /[\u0e00-\u0e7f]/.test(text);
    
    if (expectedLang.startsWith('zh') && hasChinese && !hasJapanese) return true;
    if (expectedLang === 'ja' && (hasJapanese || hasChinese)) return true;
    if (expectedLang === 'ko' && hasKorean) return true;
    if (expectedLang === 'th' && hasThai) return true;
    if (expectedLang === 'en' && /^[a-zA-Z\s\d.,!?'"()-]+$/.test(text)) return true;
    
    return hasChinese; // 預設假設是中文
}

// 處理指令
async function handleCommand(replyToken, userId, text) {
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    
    switch (command) {
        case '/語言':
        case '/lang':
            await replyMessage(replyToken, [{
                type: 'text',
                text: `🌏 支援的 20 種語言：

亞洲語系：
🇹🇼 繁中 | 🇨🇳 簡中 | 🇯🇵 日文
🇰🇷 韓文 | 🇹🇭 泰文 | 🇻🇳 越南文
🇮🇩 印尼文 | 🇮🇳 印地文

歐洲語系：
🇺🇸 英文 | 🇪🇸 西班牙文 | 🇫🇷 法文
🇩🇪 德文 | 🇮🇹 義大利文 | 🇵🇹 葡萄牙文
🇷🇺 俄文 | 🇳🇱 荷蘭文 | 🇵🇱 波蘭文

其他：
🇸🇦 阿拉伯文 | 🇮🇱 希伯來文 | 🇹🇷 土耳其文`
            }]);
            break;
            
        case '/設定':
        case '/set':
            if (parts.length >= 3) {
                const fromLang = langNames[parts[1]] || parts[1];
                const toLang = langNames[parts[2]] || parts[2];
                
                userSettings.set(userId, { from: fromLang, to: toLang });
                
                await replyMessage(replyToken, [{
                    type: 'text',
                    text: `✅ 翻譯方向已設定！\n${parts[1]} ➜ ${parts[2]}`
                }]);
            } else {
                await replyMessage(replyToken, [{
                    type: 'text',
                    text: `📝 設定格式：/設定 來源語言 目標語言\n\n範例：\n/設定 中文 日文\n/設定 中文 韓文\n/設定 英文 中文`
                }]);
            }
            break;
            
        case '/交換':
        case '/swap':
            const settings = userSettings.get(userId) || { from: 'zh-TW', to: 'en' };
            userSettings.set(userId, { from: settings.to, to: settings.from });
            await replyMessage(replyToken, [{
                type: 'text',
                text: `🔄 翻譯方向已交換！`
            }]);
            break;
            
        case '/說明':
        case '/help':
        default:
            await replyMessage(replyToken, [{
                type: 'text',
                text: `📖【旅遊~即時翻譯】使用說明

💬 文字翻譯：
直接輸入文字即可自動翻譯！
系統會自動偵測語言方向

🎤 語音翻譯：
傳送語音訊息 (開發中)

⚙️ 指令列表：
/語言 - 查看 20 種支援語言
/設定 中文 日文 - 設定翻譯方向
/交換 - 交換翻譯方向
/說明 - 顯示此說明

💡 小技巧：
雙向自動偵測，說中文翻成目標語言，
說目標語言翻回中文！`
            }]);
    }
}

module.exports = router;
