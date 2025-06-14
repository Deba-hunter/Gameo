const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure session directory exists
const SESSION_FOLDER = path.join(__dirname, 'session');
const SESSION_FILE = path.join(SESSION_FOLDER, 'creds.json');

if (!fs.existsSync(SESSION_FOLDER)) {
  fs.mkdirSync(SESSION_FOLDER);
  console.log("✅ Created 'session' folder");
}

// WhatsApp Auth Setup
const { state, saveState } = useSingleFileAuthState(SESSION_FILE);

const sock = makeWASocket({
  auth: state,
  printQRInTerminal: true,
});

sock.ev.on('creds.update', saveState);

// Static HTML page serve
app.use(express.static('public'));

// File upload setup
const upload = multer({ dest: 'uploads/' });

// Form POST route
app.post('/upload', upload.single('messageFile'), async (req, res) => {
  const receiver = req.body.receiver;
  const delaySec = parseInt(req.body.delay) || 5;
  const filePath = req.file.path;

  if (!receiver || !filePath) {
    return res.status(400).send('Missing receiver or file!');
  }

  const messages = fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim());

  async function sendLoop() {
    while (true) {
      for (const msg of messages) {
        try {
          await sock.sendMessage(`${receiver}@s.whatsapp.net`, { text: msg });
          console.log(`✅ Sent: ${msg}`);
        } catch (err) {
          console.error(`❌ Failed to send: ${msg}`, err);
        }
        await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
      }
    }
  }

  sendLoop();
  res.send('✅ Message sending started. You can close this tab.');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
        
