require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
app.use(express.json());

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Twitter Client Setup (matches your exact Render environment variable names)
const apiKey = process.env.Twitter_Consumer_Key || process.env.TWITTER_Client_ID;
const apiSecret = process.env.Twitter_Consumer_Key_Secret || process.env.TWITTER_Client_Secret;
const accessToken = process.env.TWITTER_Access_Token || process.env.X_Access_Token;
const accessSecret = process.env.TWITTER_Access_Token_Secret || process.env.TWITTER_Refresh_Token;

let twitterClient = null;
if (apiKey && apiSecret && accessToken && accessSecret) {
    twitterClient = new TwitterApi({
        appKey: apiKey.trim(),
        appSecret: apiSecret.trim(),
        accessToken: accessToken.trim(),
        accessSecret: accessSecret.trim(),
    });
}

function fetchWithTimeout(url, options, timeoutMs = 20000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs) ) ]); }  async function generateTweet(prompt) { let errors = [];  // 1. Primary Engine: NVIDIA NIM (Auto-discovers active models so nothing is ever End-of-Life) if (process.env.NEMOTRON_API_KEY) { try { const modelsRes = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/models', { headers: { 'Authorization': `Bearer ${process.env.NEMOTRON_API_KEY.trim()}` }
            }, 8000);
            const modelsData = await modelsRes.json();
            
            // Pick active Nemotron or Llama instruct models dynamically from NVIDIA's live list
            const allNvidiaModels = (modelsData.data || []).map(m => m.id);
            const preferredNvidia = allNvidiaModels.filter(id => 
                (id.includes('nemotron') || id.includes('llama') || id.includes('mistral')) && 
                !id.includes('embed') && !id.includes('reward') && !id.includes('guard')
            ).slice(0, 4);

            for (const model of preferredNvidia) {
                try {
                    const response = await fetchWithTimeout(
                        'https://integrate.api.nvidia.com/v1/chat/completions',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${process.env.NEMOTRON_API_KEY.trim()}` }, body: JSON.stringify({ model: model, messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: 1024 }) }, 15000 );  const data = await response.json(); if (response.ok && data.choices?.[0]?.message?.content) { const cleanText = data.choices[0].message.content .replace(/<think>[\s\S]*?<\/think>/g, '') .trim(); if (cleanText) { return { text: cleanText, engine: `NVIDIA (${model})` };
                        }
                    }
                    errors.push(`NVIDIA ${model}:${data.detail || data.error?.message || 'Empty'}`);
                } catch (err) {
                    errors.push(`NVIDIA ${model}:${err.message}`);
                }
            }
        } catch (err) {
            errors.push(`NVIDIA Model List: ${err.message}`);
        }
    }

    // 2. Backup Engine: Gemini (20s window + Auto-discovers active Flash models on your key)
    if (process.env.GEMINI_API_KEY) {
        let geminiModels = ['gemini-3.8-flash'];
        try {
            const listRes = await fetchWithTimeout(
                `
