const { Telegraf } = require("telegraf");
const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MERCHANT_ID = process.env.FREEKASSA_MERCHANT_ID;
const SECRET_WORD1 = process.env.FREEKASSA_SECRET_WORD1;
const SECRET_WORD2 = process.env.FREEKASSA_SECRET_WORD2;
const API_KEY = process.env.FREEKASSA_API_KEY;

// Endpoint for FreeKassa notifications
app.post("/webhook", (req, res) => {
  const { AMOUNT, MERCHANT_ORDER_ID, SIGN } = req.body;

  // Create the sign to compare
  const signString = `${MERCHANT_ID}:${AMOUNT}:${SECRET_WORD2}:${MERCHANT_ORDER_ID}`;
  const hash = crypto.createHash("md5").update(signString).digest("hex");

  if (hash === SIGN) {
    // Handle successful payment
    // Notify user via Telegram bot
    bot.telegram.sendMessage(
      MERCHANT_ORDER_ID,
      `Ваш платіж на суму ${AMOUNT} був успішно прийнятий.`
    );
    res.send("YES");
  } else {
    res.send("NO");
  }
});

// Function to check payment status using API_KEY
async function checkPaymentStatus(orderId) {
  const signString = `${MERCHANT_ID}${orderId}${API_KEY}`;
  const sign = crypto.createHash("md5").update(signString).digest("hex");

  const response = await axios.post("https://api.freekassa.com/v1/", {
    merchant_id: MERCHANT_ID,
    order_id: orderId,
    sign: sign,
    action: "check_order_status",
  });

  return response.data;
}

// Command for user to initiate payment
bot.command("pay", (ctx) => {
  const userId = ctx.message.from.id;
  const amount = 100; // Сума платежу

  // Create payment link
  const signString = `${MERCHANT_ID}:${amount}:${SECRET_WORD1}:${userId}`;
  const sign = crypto.createHash("md5").update(signString).digest("hex");

  const paymentUrl = `https://www.free-kassa.ru/merchant/cash.php?m=${MERCHANT_ID}&oa=${amount}&o=${userId}&s=${sign}`;

  ctx.reply(
    `Для здійснення платежу перейдіть за наступним посиланням: ${paymentUrl}`
  );
});

// Command to check payment status
bot.command("check", async (ctx) => {
  const userId = ctx.message.from.id;

  try {
    const status = await checkPaymentStatus(userId);
    ctx.reply(`Статус вашого платежу: ${status}`);
  } catch (error) {
    ctx.reply("Не вдалося перевірити статус платежу. Спробуйте пізніше.");
  }
});

bot.launch();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
