const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Only ensure session folder exists (Baileys will create creds.json)
const SESSION_FOLDER = path.join(__dirname, 'session');
const SESSION_FILE = path.join(SESSION_FOLDER, 'creds.json');

if (!fs.existsSync(SESSION_FOLDER)) {
  fs.mkdirSync(SESSION_FOLDER);
  console.log("✅ Created 'session' folder");
}

// ✅ WhatsApp Auth Setup
const { state, saveState } = useSingleFileAuthState(SESSION_FILE);

async function startSocket() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveState);
  return sock;
}

// ✅ HTML static files
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// ✅ File upload middleware
const upload = multer({ dest: 'uploads/' });

let sockInstance = null;
startSocket().then(sock => sockInstance = sock);

// ✅ Upload form handler
app.post('/upload', upload.single('messageFile'), async (req, res) => {
  const receiver = req.body.receiver?.trim();
  const delaySec = parseInt(req.body.delay) || 5;
  const filePath = req.file?.path;

  if (!receiver || !filePath) {
    return res.status(400).send('❌ Missing receiver or file.');
  }

  const messages = fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter(line => line.trim());

  async function sendLoop() {
    while (true) {
      for (const msg of messages) {
        try {
          await sockInstance.sendMessage(`${receiver}@s.whatsapp.net`, { text: msg });
          console.log(`✅ Sent: ${msg}`);
        } catch (err) {
          console.error(`❌ Failed to send: ${msg}`, err);
        }
        await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
      }
    }
  }

  sendLoop();
  res.send('✅ Messages sending started in loop. You can close this tab.');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
