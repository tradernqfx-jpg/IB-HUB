require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMsg = `Welcome to The Institutional Desk. 🏛️\n\nMost retail traders get hunted by the market. I share the exact top-down setups I use for Gold (XAUUSD) & Silver with strict 5-point Stop Losses, so you can trade alongside the flow.\n\nI am currently giving away my custom EA and Indicator to serious traders. To get you the right access, tell me where you're at right now:\n\n1️⃣ I have trading capital and want to optimize my broker execution & spreads.\n2️⃣ I'm trading live but struggling with consistency and risk management.\n3️⃣ I'm starting fresh and need the free tools + a solid setup to begin.\n\nReply with 1, 2, or 3.`;
    
    bot.sendMessage(chatId, welcomeMsg);
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Do not reply to the /start command here, only handle the numbers
    if (text === '/start') return; 

    if (text === '1' || text === '2') {
        bot.sendMessage(chatId, "Perfect. Let's bypass the retail noise. Grab a time on my calendar so I can walk you through the exact Vantage Institutional setup and get your tools connected:\n\n👉 https://calendly.com/srijitfx/vantage-information");
    } else if (text === '3') {
        bot.sendMessage(chatId, "Welcome to the desk. To get the free EA, Indicator, and VIP setups, you need a clean foundation.\n\nStep 1: Open your Vantage account here [Insert Your Vantage Link].\nStep 2: Fund it to activate.\nStep 3: Message me here once funded and I'll send the files directly.");
    } else {
        bot.sendMessage(chatId, "Please reply with just the number 1, 2, or 3.");
    }
});

app.get('/', (req, res) => res.send('Institutional Desk Engine is Live.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
