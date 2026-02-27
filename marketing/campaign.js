import fs from "fs";
import path from "path";
import csv from "csv-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// ===== ES Modules __dirname replacement =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Load .env from project root =====
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_KEY = process.env.WHAPI_API_KEY;

if (!API_KEY) {
  throw new Error("❌ WHAPI_API_KEY not found in .env");
}
console.log("✅ API KEY loaded");

// ===== Helper functions =====
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Campaign sending =====
async function sendCampaign() {
  const customers = [];

  const csvFilePath = path.join(__dirname, "customers.csv"); // CSV in marketing folder                  // Node-fetch local file URL

  // Load CSV
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on("data", (row) => {
      customers.push(row);
    })
    .on("end", async () => {
      console.log(`📤 Sending to ${customers.length} customers`);

      for (const customer of customers) {
        const phoneNumber = customer.phone;

        // Build WhatsApp message payload
        const payload = {
          to: phoneNumber,
          media: `https://raw.githubusercontent.com/haidarkhalifeh/laundry-assets/refs/heads/main/offer.jpg`,
          caption: `مرحباً ${customer.name || ''} 👋

        عرض خاص من مصبغة المختار🧺
`,
        };

        try {
          const res = await fetch("https://gate.whapi.cloud/messages/image", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            console.error(`❌ Failed to send to ${phoneNumber}:`, await res.text());
          } else {
            console.log("✅ Sent to:", phoneNumber);
          }

        } catch (err) {
          console.error("❌ Error sending to", phoneNumber, err);
        }

        // Anti-ban delay (4 sec)
        await delay(10000);
      }

      console.log("🎉 Campaign finished.");
    });
}

// ===== Run =====
sendCampaign();