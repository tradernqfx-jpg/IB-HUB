require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
app.use(express.json());

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

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

async function generateTweet(prompt) {
    let errors = [];

    // 1. Primary: Gemini 3.8 Flash (15s built-in timeout)
    if (process.env.GEMINI_API_KEY) {
        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${process.env.GEMINI_API_KEY.trim()}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                    signal: AbortSignal.timeout(15000)
                }
            );
            const data = await res.json();
            if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                return { text: data.candidates[0].content.parts[0].text.trim(), engine: 'Gemini 3.8 Flash' };
            }
            errors.push(`Gemini: ${data.error?.message || 'Busy'}`);
        } catch (e) {
            errors.push(`Gemini: ${e.message}`);
        }
    }

    // 2. Backup: Auto-discover active NVIDIA model & generate
    if (process.env.NEMOTRON_API_KEY) {
        try {
            const mRes = await fetch('https://integrate.api.nvidia.com/v1/models', {
                headers: { 'Authorization': `Bearer ${process.env.NEMOTRON_API_KEY.trim()}` },
                signal: AbortSignal.timeout(8000)
            });
            const mData = await mRes.json();
            const model = (mData.data || [])
                .map(m => m.id)
                .find(id => (id.includes('nemotron') || id.includes('llama')) && !id.includes('embed') && !id.includes('guard'));

            if (model) {
                const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.NEMOTRON_API_KEY.trim()}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 800
                    }),
                    signal: AbortSignal.timeout(15000)
                });
                const data = await res.json();
                if (res.ok && data.choices?.[0]?.message?.content) {
                    const clean = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                    if (clean) return { text: clean, engine: `NVIDIA (${model})` };
                }
                errors.push(`NVIDIA (${model}): ${data.detail || 'Empty'}`);
            }
        } catch (e) {
            errors.push(`NVIDIA: ${e.message}`);
        }
    }

    throw new Error(errors.join(' | '));
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Welcome to The Institutional Desk. 🏛️\n\nReply with 1, 2, or 3 to get started.");
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text === '/start') return;

    if (text.startsWith('/post')) {
        const rawAnalysis = text.replace('/post', '').trim();
        if (!rawAnalysis) return bot.sendMessage(chatId, "⚠️ Include your analysis.");

        await bot.sendMessage(chatId, "⚡ Generating tweet...");
        try {
            const prompt = `Act as an institutional forex trader. Format this analysis into a short Twitter post (strictly under 270 characters) with emojis and a 5-point SL. End with: 'Link in bio for my free EA & VIP setup.'\n\nAnalysis: ${rawAnalysis}\n\nReturn ONLY the exact tweet text, no quotes.`;
            const { text: tweetText, engine } = await generateTweet(prompt);

            await bot.sendMessage(chatId, `📝 Drafted via ${engine}:\n\n${tweetText}\n\nPosting to Twitter...`);
            if (twitterClient) {
                await twitterClient.v2.tweet(tweetText);
                await bot.sendMessage(chatId, "✅ Successfully posted to Twitter!");
            } else {
                await bot.sendMessage(chatId, "⚠️ Twitter API keys missing in Render.");
            }
        } catch (error) {
            await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        return;
    }

    if (text === '1' || text === '2') {
        bot.sendMessage(chatId, "Grab a time on my calendar:\n👉 https://calendly.com/srijitfx/vantage-information");
    } else if (text === '3') {
        bot.sendMessage(chatId, "Step 1: Open your Vantage account: https://vigco.co/la-com-inv/kZd4XyQp\nStep 2: Fund it & message me here.");
    }
});

app.get('/', (req, res) => res.send('Institutional Desk Engine is Live.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
