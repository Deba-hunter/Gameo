const express = require("express");
const fs = require("fs");
const { Boom } = require("@hapi/boom");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useSingleFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const formidable = require("formidable");

const app = express();
const PORT = process.env.PORT || 3000;

const SESSION_FILE = "./session/auth_info.json";
const { state, saveState } = useSingleFileAuthState(SESSION_FILE);
let sock;
let connected = false;

app.use(express.static("public"));

app.post("/upload", (req, res) => {
  const form = new formidable.IncomingForm({ uploadDir: "./uploads", keepExtensions: true });
  form.parse(req, (err, fields, files) => {
    if (err) return res.status(500).send("File upload error");

    const receiver = fields.receiver;
    const delay = parseInt(fields.delay || "5") * 1000;
    const messagePath = files.messageFile?.filepath;

    if (!receiver || !messagePath) return res.status(400).send("Missing data");

    const messages = fs.readFileSync(messagePath, "utf8").split("\n").filter(Boolean);

    async function sendLoop() {
      while (true) {
        for (const msg of messages) {
          await sock.sendMessage(receiver + "@s.whatsapp.net", { text: msg });
          await new Promise(res => setTimeout(res, delay));
        }
      }
    }

    if (connected) sendLoop();
    res.send("Started sending messages");
  });
});

async function connectQR() {
  sock = makeWASocket({ auth: state, printQRInTerminal: true });

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") connected = true;
    if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
      connectQR();
    }
  });

  sock.ev.on("creds.update", saveState);
}

connectQR();
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
