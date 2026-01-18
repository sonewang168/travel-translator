const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();

// 暫存目錄
const AUDIO_DIR = path.join(__dirname, '../../public/audio');

// 確保目錄存在
if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * 使用 OpenAI TTS 將文字轉語音
 * @param {string} text - 要轉換的文字
 * @param {string} lang - 語言代碼
 * @returns {Promise<{filename: string, duration: number}>}
 */
async function textToSpeech(text, lang = 'zh-TW') {
    if (!OPENAI_API_KEY) {
        throw new Error('未設定 OPENAI_API_KEY');
    }
    
    // 限制文字長度（OpenAI TTS 有限制）
    const maxLength = 4096;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;
    
    console.log(`TTS 生成: "${truncatedText.substring(0, 50)}..." (${lang})`);
    
    // 選擇適合的聲音
    // alloy - 中性, echo - 男性, fable - 英式, onyx - 深沉男性, nova - 女性, shimmer - 溫柔女性
    const voice = 'nova'; // 女性聲音，適合多語言
    
    try {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: truncatedText,
                voice: voice,
                response_format: 'mp3',
                speed: 1.0
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            console.error('OpenAI TTS 錯誤:', error);
            throw new Error(`TTS 失敗: ${response.status}`);
        }
        
        // 取得音檔 buffer
        const audioBuffer = await response.buffer();
        
        // 產生唯一檔名
        const filename = `tts_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
        const filepath = path.join(AUDIO_DIR, filename);
        
        // 儲存檔案
        fs.writeFileSync(filepath, audioBuffer);
        
        // 估算音檔長度（粗略估計：每秒約 16KB for mp3 at 128kbps）
        // 更準確的方式是解析 mp3 header，但這裡用簡單估算
        const estimatedDuration = Math.ceil((audioBuffer.length / 16000) * 1000); // 毫秒
        
        console.log(`TTS 完成: ${filename}, 大小: ${audioBuffer.length} bytes, 預估: ${estimatedDuration}ms`);
        
        // 設定自動刪除（5分鐘後）
        setTimeout(() => {
            try {
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                    console.log(`已刪除暫存音檔: ${filename}`);
                }
            } catch (e) {
                console.error('刪除音檔失敗:', e);
            }
        }, 5 * 60 * 1000);
        
        return {
            filename,
            filepath,
            duration: Math.max(estimatedDuration, 1000), // 至少 1 秒
            size: audioBuffer.length
        };
        
    } catch (error) {
        console.error('TTS 生成失敗:', error.message);
        throw error;
    }
}

/**
 * 清理舊的音檔（超過10分鐘的）
 */
function cleanupOldAudio() {
    try {
        const files = fs.readdirSync(AUDIO_DIR);
        const now = Date.now();
        
        files.forEach(file => {
            if (file.startsWith('tts_')) {
                const filepath = path.join(AUDIO_DIR, file);
                const stat = fs.statSync(filepath);
                const age = now - stat.mtimeMs;
                
                // 超過10分鐘就刪除
                if (age > 10 * 60 * 1000) {
                    fs.unlinkSync(filepath);
                    console.log(`清理舊音檔: ${file}`);
                }
            }
        });
    } catch (e) {
        console.error('清理音檔失敗:', e);
    }
}

// 每5分鐘清理一次
setInterval(cleanupOldAudio, 5 * 60 * 1000);

module.exports = {
    textToSpeech,
    cleanupOldAudio,
    AUDIO_DIR
};
