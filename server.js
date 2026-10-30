require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
app.use(express.json());

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

let twitterClient;
if (process.env.TWITTER_Client_ID) {
    twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_Client_ID,
        appSecret: process.env.TWITTER_Client_Secret,
        accessToken: process.env.TWITTER_Access_Token,
        accessSecret: process.env.TWITTER_Refresh_Token,
    });
}

// Instant Multi-Model Failover Function
async function generateTweetWithFallback(prompt) {
    const models = [
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite'
    ];
    let lastError = '';

    for (const model of models) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            if (response.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text.trim();
            }
            lastError = `${model}: ${data.error?.message || JSON.stringify(data)}`;
        } catch (err) {
            lastError = `${model}: ${err.message}`;
        }
    }
    throw new Error(`All fallback models busy. Last error -> ${lastError}`);
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

        bot.sendMessage(chatId, "⚙️ Gemini is writing your Twitter post...");
        
        try {
            const prompt = `Act as a BDM and institutional forex trader. Take this raw analysis and format it into a highly engaging Twitter post (strictly under 270 characters). Include relevant emojis, structural reasoning, and strict risk management (e.g., 5-point SL). End exactly with: 'Link in bio for my free EA & VIP setup.'\n\nRaw Analysis: ${rawAnalysis}\n\nReturn ONLY the exact tweet text.`;
            
            const tweetText = await generateTweetWithFallback(prompt);

            await bot.sendMessage(chatId, `📝 Drafted Tweet:\n\n${tweetText}\n\nPosting to Twitter...`);

            if (twitterClient) {
                await twitterClient.v2.tweet(tweetText);
                await bot.sendMessage(chatId, "✅ Successfully posted to Twitter!");
            } else {
                await bot.sendMessage(chatId, "⚠️ Twitter API keys not configured.");
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
