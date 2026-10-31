require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
app.use(express.json());

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Flexible Twitter client initialization supporting any variation of your keys
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

// Bulletproof AI Engine with NVIDIA Primary & Gemini Backup
async function generateTweet(prompt) {
    // 1. Try NVIDIA Nemotron First
    if (process.env.NEMOTRON_API_KEY) {
        const nemotronModels = [
            'nvidia/llama-3.3-nemotron-super-49b-v1',
            'meta/llama-3.3-70b-instruct'
        ];

        for (const model of nemotronModels) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 6000);

                const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.NEMOTRON_API_KEY.trim()}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.6,
                        max_tokens: 250
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeout);

                const data = await response.json();
                if (response.ok && data.choices && data.choices[0]?.message?.content) {
                    const cleanText = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                    return { text: cleanText, engine: `Nemotron (${model.split('/')[1]})` };
                }
            } catch (err) {
                console.log(`Nemotron skipped: ${err.message}`);
            }
        }
    }

    // 2. Instant Fallback to Gemini if Nemotron fails
    if (process.env.GEMINI_API_KEY) {
        const geminiModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
        for (const model of geminiModels) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 6000);

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY.trim()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeout);

                const data = await response.json();
                if (response.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                    return { text: data.candidates[0].content.parts[0].text.trim(), engine: `Gemini Backup (${model})` };
                }
            } catch (err) {
                console.log(`Gemini skipped: ${err.message}`);
            }
        }
    }

    throw new Error("All AI engines (Nemotron & Gemini) failed or timed out.");
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMsg = `Welcome to The Institutional Desk. 🏛️\n\nMost retail traders get hunted by the market. I share the exact top-down setups I use for Gold (XAUUSD) & Silver with strict 5-point Stop Losses, so you can trade alongside the flow.\n\nI am currently giving away my custom EA and Indicator to serious traders. To get you the right access, tell me where you're at right now:\n\n1️⃣ I have trading capital and want to optimize my broker execution & spreads.\n2️⃣ I'm trading live but struggling with consistency and risk management.\n3️⃣ I'm starting fresh and need the free tools + a solid setup to begin.\n\nReply with 1, 2, or 3.`;
    bot.sendMessage(chatId, welcomeMsg);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text === '/start') return;

    if (text.startsWith('/post')) {
        const rawAnalysis = text.replace('/post', '').trim();
        if (!rawAnalysis) {
            return bot.sendMessage(chatId, "⚠️ Include your analysis. Example: /post Gold bouncing off 2600...");
        }

        bot.sendMessage(chatId, "⚡ Generating institutional tweet...");
        
        try {
            const prompt = `Act as a BDM and institutional forex trader. Take this raw analysis and format it into a highly engaging Twitter post (strictly under 270 characters). Include relevant emojis, structural reasoning, and strict risk management (e.g., 5-point SL). End exactly with: 'Link in bio for my free EA & VIP setup.'\n\nRaw Analysis: ${rawAnalysis}\n\nReturn ONLY the exact tweet text, no quotes or intro.`;
            
            const { text: tweetText, engine } = await generateTweet(prompt);

            await bot.sendMessage(chatId, `📝 Drafted via ${engine}:\n\n${tweetText}\n\nPosting to Twitter...`);

            if (twitterClient) {
                await twitterClient.v2.tweet(tweetText);
                await bot.sendMessage(chatId, "✅ Successfully posted to Twitter!");
            } else {
                await bot.sendMessage(chatId, "⚠️ Twitter API keys not configured or recognized.");
            }
        } catch (error) {
            console.error(error);
            bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        return; 
    }

    if (text === '1' || text === '2') {
        bot.sendMessage(chatId, "Perfect. Let's bypass the retail noise. Grab a time on my calendar so I can walk you through the exact Vantage Institutional setup and get your tools connected:\n\n👉 https://calendly.com/srijitfx/vantage-information");
    } else if (text === '3') {
        bot.sendMessage(chatId, "Welcome to the desk. To get the free EA, Indicator, and VIP setups, you need a clean foundation.\n\nStep 1: Open your Vantage account here: https://vigco.co/la-com-inv/kZd4XyQp\nStep 2: Fund it to activate.\nStep 3: Message me here once funded and I'll send the files directly.");
    }
});

app.get('/', (req, res) => res.send('Institutional Desk Engine is Live.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
