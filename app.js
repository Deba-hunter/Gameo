const express = require('express');
const multer = require('multer');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './session' }),
  puppeteer: { headless: true }
});

client.on('qr', qr => {
  const qrcode = require('qrcode-terminal');
  qrcode.generate(qr, { small: true });
  console.log("📱 Scan the QR Code above using WhatsApp.");
});

client.on('ready', () => {
  console.log("✅ WhatsApp is ready!");
});

client.initialize();

app.post('/send', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'messageFile', maxCount: 1 }
]), async (req, res) => {
  const number = req.body.number.replace(/[^0-9]/g, '') + "@c.us";
  const delay = parseInt(req.body.delay || "5") * 1000;
  const repeat = req.body.repeat === "on";
  const text = req.body.message || '';

  try {
    // 1. Single typed message
    if (text.trim()) {
      await client.sendMessage(number, text.trim());
    }

    // 2. Media file
    if (req.files['file']) {
      const mediaPath = req.files['file'][0].path;
      const media = MessageMedia.fromFilePath(mediaPath);
      await client.sendMessage(number, media);
      fs.unlinkSync(mediaPath);
    }

    // 3. Text file with repeat mode
    if (req.files['messageFile']) {
      const filePath = req.files['messageFile'][0].path;
      const messages = fs.readFileSync(filePath, 'utf-8')
                         .split(/\r?\n/)
                         .filter(line => line.trim() !== '');

      fs.unlinkSync(filePath);

      if (repeat) {
        console.log("♻️ Repeat mode ON. Looping messages forever...");
        (async function sendLoop() {
          while (true) {
            for (const line of messages) {
              await client.sendMessage(number, line.trim());
              await new Promise(res => setTimeout(res, delay));
            }
          }
        })();
      } else {
        for (const line of messages) {
          await client.sendMessage(number, line.trim());
          await new Promise(res => setTimeout(res, delay));
        }
      }
    }

    res.send(`<h3 style="text-align:center">✅ Message(s) Sent or Loop Started!<br><a href="/">Back</a></h3>`);
  } catch (err) {
    console.error(err);
    res.send(`<h3 style="text-align:center">❌ Failed to Send<br><a href="/">Back</a></h3>`);
  }
});

app.listen(port, () => {
  console.log(`🚀 Server started: http://localhost:${port}`);
});
