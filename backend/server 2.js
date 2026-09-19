
import "dotenv/config";
import express from "express";
import cors from "cors";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const GUILD_ID = String(process.env.DISCORD_GUILD_ID || "").trim();
const BOT_TOKEN = String(process.env.DISCORD_BOT_TOKEN || "").trim();

const OWNERSHIP_ROLE_NAMES = String(
  process.env.OWNERSHIP_ROLE_NAMES || "Ownership Team,Chairwoman,Vice-Chairman,President,Vice President"
).split(",").map(v => v.trim().toLowerCase()).filter(Boolean);

const LEADERSHIP_ROLE_NAMES = String(
  process.env.LEADERSHIP_ROLE_NAMES || "Leadership Team,Leadership Council,Senior Vice President,Presidential Advisor,Board Of Directors,Chief PR,Chief HR,Chief Operations"
).split(",").map(v => v.trim().toLowerCase()).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || origin === FRONTEND_URL || origin?.endsWith(".up.railway.app")) return cb(null, true);
    cb(null, false);
  }
}));
app.use(express.json());

let client = null;

function summary(member) {
  return {
    id: member.id,
    username: member.user.username,
    displayName: member.displayName || member.user.globalName || member.user.username,
    avatar: member.displayAvatarURL({ extension: "png", size: 256 }),
    boostedAt: member.premiumSince?.toISOString() || null
  };
}

async function getMembers() {
  if (!client?.isReady() || !GUILD_ID) return [];
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();
  return [...members.values()].filter(member => !member.user.bot);
}

function hasNamedRole(member, names) {
  return member.roles.cache.some(role => names.includes(role.name.toLowerCase()));
}

app.get("/api/community/team", async (_req, res) => {
  try {
    const members = await getMembers();

    const ownership = members
      .filter(member => hasNamedRole(member, OWNERSHIP_ROLE_NAMES))
      .map(summary)
      .sort((a,b) => a.displayName.localeCompare(b.displayName));

    const ownershipIds = new Set(ownership.map(member => member.id));

    const leadership = members
      .filter(member => !ownershipIds.has(member.id) && hasNamedRole(member, LEADERSHIP_ROLE_NAMES))
      .map(summary)
      .sort((a,b) => a.displayName.localeCompare(b.displayName));

    res.json({ success:true, ownership, leadership });
  } catch (error) {
    res.status(500).json({ success:false, message:error.message || "Unable to load team." });
  }
});

app.get("/api/community/boosters", async (_req, res) => {
  try {
    const members = await getMembers();
    const boosters = members
      .filter(member => Boolean(member.premiumSince))
      .sort((a,b) => new Date(a.premiumSince) - new Date(b.premiumSince))
      .map(summary);

    res.json({ success:true, boosters });
  } catch (error) {
    res.status(500).json({ success:false, message:error.message || "Unable to load boosters." });
  }
});

app.listen(PORT, () => console.log(`[Velici] API listening on ${PORT}`));

if (BOT_TOKEN) {
  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
  });

  client.once("clientReady", () => {
    console.log(`[Velici] Discord connected as ${client.user.tag}`);
  });

  client.login(BOT_TOKEN).catch(error => {
    console.error(`[Velici] Discord login failed: ${error.message}`);
  });
}
