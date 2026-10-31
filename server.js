require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
app.use(express.json());

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Twitter Client Setup
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

// AI Generator with Full Error Diagnostics
async function generateTweet(prompt) {
    // Try Nemotron First if key exists
    if (process.env.NEMOTRON_API_KEY) {
        try {
            const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.NEMOTRON_API_KEY.trim()}`
                },
                body: JSON.stringify({
                    model: 'nvidia/llama-3.3-nemotron-super-49b-v1',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.6,
                    max_tokens: 250
                })
            });
            const data = await response.json();
            if (response.ok && data.choices?.[0]?.message?.content) {
                return { text: data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim(), engine: 'Nemotron' };
            }
        } catch (err) {
            console.log("Nemotron error:", err.message);
        }
    }

    // Try Gemini if Nemotron isn't configured or failed
    if (process.env.GEMINI_API_KEY) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY.trim()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            const data = await response.json();
            if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                return { text: data.candidates[0].content.parts[0].text.trim(), engine: 'Gemini' };
            }
            throw new Error(data.error?.message || JSON.stringify(data));
        } catch (err) {
            throw new Error(`Gemini Error: ${err.message}`);
        }
    }

    throw new Error("No valid AI API keys found in Render Environment!");
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

        bot.sendMessage(chatId, "⚡ Generating tweet...");
        
        try {
            const prompt = `Act as an institutional forex trader. Format this analysis into a short Twitter post (under 270 chars) with emojis and a 5-point SL. End with: 'Link in bio for my free EA & VIP setup.'\n\nAnalysis: ${rawAnalysis}\n\nReturn ONLY the tweet text.`;
            
            const { text: tweetText, engine } = await generateTweet(prompt);

            await bot.sendMessage(chatId, `📝 Drafted via ${engine}:\n\n${tweetText}\n\nPosting to Twitter...`);

            if (twitterClient) {
                await twitterClient.v2.tweet(tweetText);
                await bot.sendMessage(chatId, "✅ Successfully posted to Twitter!");
            } else {
                await bot.sendMessage(chatId, "⚠️ Twitter API keys missing or invalid.");
            }
        } catch (error) {
            console.error(error);
            bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        return; 
    }

    if (text === '1' || text === '2') {
        bot.sendMessage(chatId, "Perfect. Grab a time on my calendar so I can walk you through the exact Vantage Institutional setup:\n\n👉 https://calendly.com/srijitfx/vantage-information");
    } else if (text === '3') {
        bot.sendMessage(chatId, "Welcome to the desk. Step 1: Open your Vantage account here: https://vigco.co/la-com-inv/kZd4XyQp\nStep 2: Fund it.\nStep 3: Message me here once funded.");
    }
});

app.get('/', (req, res) => res.send('Institutional Desk Engine is Live.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
