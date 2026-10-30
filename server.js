require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { TwitterApi } = require('twitter-api-v2');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

// 1. Initialize APIs
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let twitterClient;
if (process.env.TWITTER_Client_ID) {
    // Mapping your custom Render environment variables to the OAuth 1.0a client
    twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_Client_ID,
        appSecret: process.env.TWITTER_Client_Secret,
        accessToken: process.env.TWITTER_Access_Token,
        accessSecret: process.env.TWITTER_Refresh_Token,
    });
}

// 2. The Lead Funnel (Public)
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMsg = `Welcome to The Institutional Desk. 🏛️\n\nMost retail traders get hunted by the market. I share the exact top-down setups I use for Gold (XAUUSD) & Silver with strict 5-point Stop Losses, so you can trade alongside the flow.\n\nI am currently giving away my custom EA and Indicator to serious traders. To get you the right access, tell me where you're at right now:\n\n1️⃣ I have trading capital and want to optimize my broker execution & spreads.\n2️⃣ I'm trading live but struggling with consistency and risk management.\n3️⃣ I'm starting fresh and need the free tools + a solid setup to begin.\n\nReply with 1, 2, or 3.`;
    bot.sendMessage(chatId, welcomeMsg);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text === '/start') return;

    // 3. The Content Engine (Your Private Command)
    if (text.startsWith('/post')) {
        const rawAnalysis = text.replace('/post', '').trim();
        if (!rawAnalysis) {
            return bot.sendMessage(chatId, "⚠️ Include your analysis. Example: /post Gold bouncing off 2600...");
        }

        bot.sendMessage(chatId, "⚙️ Gemini is writing your Twitter post...");
        
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `Act as a BDM and institutional forex trader. Take this raw analysis and format it into a highly engaging Twitter post. Include relevant emojis, structural reasoning, and strict risk management (e.g., 5-point SL). End exactly with: 'Link in bio for my free EA & VIP setup.'\n\nRaw Analysis: ${rawAnalysis}\n\nReturn ONLY the exact tweet text.`;
            
            const result = await model.generateContent(prompt);
            const tweetText = result.response.text().trim();

            bot.sendMessage(chatId, `📝 Drafted Tweet:\n\n${tweetText}\n\nPosting to Twitter...`);

            if (twitterClient) {
                await twitterClient.v2.tweet(tweetText);
                bot.sendMessage(chatId, "✅ Successfully posted to Twitter!");
            } else {
                bot.sendMessage(chatId, "⚠️ Twitter API keys not configured.");
            }
        } catch (error) {
            console.error(error);
            bot.sendMessage(chatId, "❌ Error generating or posting content.");
        }
        return; 
    }

    // 4. Funnel Responses
    if (text === '1' || text === '2') {
        bot.sendMessage(chatId, "Perfect. Let's bypass the retail noise. Grab a time on my calendar so I can walk you through the exact Vantage Institutional setup and get your tools connected:\n\n👉 https://calendly.com/srijitfx/vantage-information");
    } else if (text === '3') {
        bot.sendMessage(chatId, "Welcome to the desk. To get the free EA, Indicator, and VIP setups, you need a clean foundation.\n\nStep 1: Open your Vantage account here: https://vigco.co/la-com-inv/kZd4XyQp\nStep 2: Fund it to activate.\nStep 3: Message me here once funded and I'll send the files directly.");
    }
});

app.get('/', (req, res) => res.send('Institutional Desk Engine is Live.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
