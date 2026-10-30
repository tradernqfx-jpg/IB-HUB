require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMsg = `Hey! I’m Srijit.\n\nI share my raw, top-down setups on Gold and Silver every day, and I help serious traders optimize their risk management.\n\nBefore we talk, let me know your current experience level:\n1️⃣ I’m trading live, but need a better broker setup.\n2️⃣ I’m looking to improve my market structure & risk.\n3️⃣ I’m completely new and need guidance.\n\nReply with 1, 2, or 3.`;
    bot.sendMessage(chatId, welcomeMsg);
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === '1' || text === '2') {
        bot.sendMessage(chatId, "Awesome, let's get you set up properly. Grab a time on my calendar here to discuss your setup and the Vantage IB: https://calendly.com/srijitfx/vantage-information");
    } else if (text === '3') {
        bot.sendMessage(chatId, "Welcome to the markets! Start by registering here [Your Vantage Link]. Once funded, I'll send you the free EA and indicator to get started safely.");
    }
});

app.get('/', (req, res) => res.send('Institutional Desk Engine is Live.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
