import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Client, GatewayIntentBits, Partials, EmbedBuilder } from "discord.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const GROUP_ID = String(process.env.ROBLOX_GROUP_ID || "695410048").trim();
const DATA_DIRECTORY = path.resolve(process.env.DATA_DIRECTORY || "./data");
const DISCORD_BOT_TOKEN = String(process.env.DISCORD_BOT_TOKEN || "").trim();
const DISCORD_GUILD_ID = String(process.env.DISCORD_GUILD_ID || "1446083660351799381").trim();
const DISCORD_TICKET_CHANNEL_ID = String(process.env.DISCORD_TICKET_CHANNEL_ID || "").trim();
const DISCORD_SUPPORT_ROLE_ID = String(process.env.DISCORD_SUPPORT_ROLE_ID || "").trim();
const DISCORD_ANNOUNCEMENT_CHANNEL_ID = String(process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID || "1446415574682046495").trim();
const TRACK_CHANNEL_IDS = new Set(String(process.env.DISCORD_TRACK_CHANNEL_IDS || "").split(",").map(v=>v.trim()).filter(Boolean));
const EXCLUDED_CHANNEL_IDS = new Set(String(process.env.DISCORD_EXCLUDED_CHANNEL_IDS || "").split(",").map(v=>v.trim()).filter(Boolean));
const ALLOWED_ORIGINS = String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:5173").split(",").map(v=>v.trim().replace(/\/$/,"")).filter(Boolean);

app.use(cors({origin(origin,cb){if(!origin)return cb(null,true);const clean=origin.replace(/\/$/,"");if(ALLOWED_ORIGINS.includes(clean))return cb(null,true);return cb(new Error("Origin not allowed by Bay Café CORS policy."));},credentials:true}));
app.use(express.json({limit:"1mb"}));
fs.mkdirSync(DATA_DIRECTORY,{recursive:true});

const FILES={discordMessages:path.join(DATA_DIRECTORY,"discord-messages.json"),tickets:path.join(DATA_DIRECTORY,"tickets.json"),applications:path.join(DATA_DIRECTORY,"applications.json")};
function readJson(file,fallback){try{if(!fs.existsSync(file))return fallback;const raw=fs.readFileSync(file,"utf8");return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
function writeJson(file,value){const temp=`${file}.tmp`;fs.writeFileSync(temp,JSON.stringify(value,null,2));fs.renameSync(temp,file);}
const ROBLOX_CACHE = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function jsonFetch(url, options = {}, cacheMs = 0) {
  const method = String(options.method || "GET").toUpperCase();
  const cacheKey = `${method}:${url}:${options.body || ""}`;

  if (cacheMs > 0 && ROBLOX_CACHE.has(cacheKey)) {
    const cached = ROBLOX_CACHE.get(cacheKey);

    if (cached.expiresAt > Date.now()) {
      return cached.value;
    }

    ROBLOX_CACHE.delete(cacheKey);
  }

  let lastStatus = 0;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": "BayCafeStaffWebsite/1.0",
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    lastStatus = response.status;

    if (response.ok) {
      const value = await response.json();

      if (cacheMs > 0) {
        ROBLOX_CACHE.set(cacheKey, {
          value,
          expiresAt: Date.now() + cacheMs
        });
      }

      return value;
    }

    if (response.status !== 429) {
      throw new Error(`Request failed (${response.status}).`);
    }

    const retryAfter = Number(
      response.headers.get("retry-after")
    );

    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1200 * (attempt + 1);

    console.warn(
      `[Bay Café] Roblox rate limit hit. Retrying in ${waitMs}ms...`
    );

    await sleep(waitMs);
  }

  throw new Error(
    lastStatus === 429
      ? "Roblox is rate limiting requests right now. Wait a few seconds and try again."
      : `Request failed (${lastStatus}).`
  );
}
async function robloxUserByUsername(username){
  const result=await jsonFetch(
    "https://users.roblox.com/v1/usernames/users",
    {
      method:"POST",
      body:JSON.stringify({
        usernames:[username],
        excludeBannedUsers:false
      })
    },
    60000
  );

  return result.data?.[0]||null;
}
async function robloxUserDetails(id){
  return jsonFetch(
    `https://users.roblox.com/v1/users/${id}`,
    {},
    60000
  );
}

async function robloxUserDetailsFresh(id){
  return jsonFetch(
    `https://users.roblox.com/v1/users/${id}`,
    {},
    0
  );
}
async function avatarForUser(id){
  const r=await jsonFetch(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=true`,
    {},
    300000
  );

  return r.data?.[0]?.imageUrl||"";
}
async function groupInfo(){return jsonFetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}`);}
async function groupIcon(){const r=await jsonFetch(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${GROUP_ID}&size=420x420&format=Png&isCircular=false`);return r.data?.[0]?.imageUrl||"";}
async function groupMembership(userId){const r=await jsonFetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);const entry=(r.data||[]).find(x=>String(x.group?.id)===GROUP_ID);return entry?{group:entry.group,role:entry.role}:null;}

function hierarchyFor(roleName="",rank=0){
  const name=String(roleName).toLowerCase().trim();
  const numericRank=Number(rank)||0;

  const ownership=[
    "ownership",
    "owner",
    "founder",
    "chairman",
    "chairwoman",
    "vice chairman",
    "vice chairwoman",
    "president",
    "vice president",
    "chief administrative officer",
    "cao"
  ];

  const leadership=[
    "chief",
    "leadership",
    "executive"
  ];

  const governance=[
    "governance",
    "corporate",
    "head corporate",
    "senior corporate",
    "junior corporate",
    "corporate intern"
  ];

  const management=[
    "head director",
    "senior director",
    "junior director",
    "director",
    "management"
  ];

  let tier="staff";

  /*
   * Rank takes priority at the top of the hierarchy. This prevents an
   * Ownership member with a title such as President / Vice President
   * from being incorrectly classified as Leadership.
   */
  if(
    numericRank>=240 ||
    ownership.some(value=>name.includes(value))
  ){
    tier="ownership";
  }else if(
    numericRank>=200 ||
    leadership.some(value=>name.includes(value))
  ){
    tier="leadership";
  }else if(
    numericRank>=150 ||
    governance.some(value=>name.includes(value))
  ){
    tier="governance";
  }else if(
    numericRank>=100 ||
    management.some(value=>name.includes(value))
  ){
    tier="management";
  }

  const levels={
    staff:1,
    management:2,
    governance:3,
    leadership:4,
    ownership:5
  };

  const level=levels[tier];

  return {
    tier,
    level,
    capabilities:{
      overview:true,
      discord:true,
      profiles:true,
      tickets:true,
      managementInfo:level>=2,
      governanceInfo:level>=3,
      ticketAdmin:level>=3,
      staffAnalytics:level>=3,
      leadershipTools:level>=4
    }
  };
}

async function buildWebsiteUser(username){
  const basic=await robloxUserByUsername(username); if(!basic)throw new Error("Roblox user not found.");
  const [details,membership,avatar]=await Promise.all([robloxUserDetails(basic.id),groupMembership(basic.id),avatarForUser(basic.id)]);
  if(!membership)throw new Error("This Roblox account is not in the Bay Café group.");
  const hierarchy=hierarchyFor(membership.role?.name||"",membership.role?.rank||0);
  return {id:basic.id,username:basic.name,displayName:basic.displayName,description:details.description||"",avatar,profileUrl:`https://www.roblox.com/users/${basic.id}/profile`,roleName:membership.role?.name||"Member",roleRank:membership.role?.rank||0,tier:hierarchy.tier,level:hierarchy.level,capabilities:hierarchy.capabilities};
}

const SESSION_SECRET=String(process.env.SESSION_SIGNING_SECRET||process.env.DISCORD_BOT_TOKEN||"bay-cafe-local-development-only");
const sign=value=>crypto.createHmac("sha256",SESSION_SECRET).update(value).digest("base64url");
function createSessionToken(user){const payload=Buffer.from(JSON.stringify({v:1,issuedAt:Date.now(),nonce:crypto.randomUUID(),user})).toString("base64url");return `bay1.${payload}.${sign(payload)}`;}
function verifySessionToken(token){const p=String(token||"").split(".");if(p.length!==3||p[0]!=="bay1")return null;const left=Buffer.from(p[2]),right=Buffer.from(sign(p[1]));if(left.length!==right.length||!crypto.timingSafeEqual(left,right))return null;try{return JSON.parse(Buffer.from(p[1],"base64url").toString("utf8")).user||null;}catch{return null;}}
function auth(req,res,next){const h=String(req.headers.authorization||"");const token=h.startsWith("Bearer ")?h.slice(7).trim():"";const user=verifySessionToken(token);if(!user)return res.status(401).json({success:false,message:"Sign in required."});req.user=user;req.sessionToken=token;next();}

const authChallenges=new Map();
app.post("/api/auth/start",async(req,res)=>{try{const username=String(req.body.username||"").trim();if(!username)return res.status(400).json({success:false,message:"Enter a Roblox username."});const user=await buildWebsiteUser(username);const challengeId=crypto.randomUUID();const code=`BAY-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;authChallenges.set(challengeId,{user,code,expiresAt:Date.now()+10*60*1000});res.json({success:true,challengeId,code,profileUrl:user.profileUrl,user:{username:user.username,displayName:user.displayName,avatar:user.avatar,roleName:user.roleName}});}catch(error){res.status(400).json({success:false,message:error.message||"Unable to start sign in."});}});
app.post("/api/auth/verify",async(req,res)=>{try{const c=authChallenges.get(String(req.body.challengeId||""));if(!c||c.expiresAt<=Date.now())throw new Error("Verification code expired. Start again.");const latest=await robloxUserDetailsFresh(c.user.id);if(!String(latest.description||"").includes(c.code))throw new Error("Code not found in your Roblox About section yet.");const user=await buildWebsiteUser(c.user.username);const token=createSessionToken(user);authChallenges.delete(String(req.body.challengeId||""));res.json({success:true,token,user,persistent:true});}catch(error){res.status(400).json({success:false,message:error.message||"Unable to finish sign in."});}});
app.get("/api/auth/me",auth,(req,res)=>res.json({success:true,user:req.user,persistent:true}));
app.post("/api/auth/logout",auth,(_req,res)=>res.json({success:true}));

app.get("/api/stats",auth,async(_req,res)=>{const [g,i]=await Promise.allSettled([groupInfo(),groupIcon()]);const group=g.status==="fulfilled"?g.value:null;const icon=i.status==="fulfilled"?i.value:"";res.json({success:true,group:{id:GROUP_ID,name:group?.name||"Bay Café",description:group?.description||"",memberCount:group?.memberCount||0,owner:group?.owner||null,icon,url:"https://www.roblox.com/communities/695410048/Bay-Cafe#!/about"},discord:{connected:Boolean(discordClient?.isReady()),trackedMessages:readJson(FILES.discordMessages,[]).length,trackedChannels:TRACK_CHANNEL_IDS.size||null}});});

let BAY_DIRECTORY_CACHE = {
  expiresAt: 0,
  members: []
};

async function bayCafeDirectory() {
  if (
    BAY_DIRECTORY_CACHE.expiresAt > Date.now() &&
    BAY_DIRECTORY_CACHE.members.length
  ) {
    return BAY_DIRECTORY_CACHE.members;
  }

  const members = [];
  let cursor = "";

  do {
    const url =
      `https://groups.roblox.com/v1/groups/${GROUP_ID}/users?sortOrder=Asc&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;

    const page =
      await jsonFetch(
        url,
        {},
        60_000
      );

    for (const item of page.data || []) {
      if (!item?.user) continue;

      members.push({
        id: item.user.userId,
        username: item.user.username,
        displayName: item.user.displayName,
        roleName: item.role?.name || "Member",
        roleRank: item.role?.rank || 0
      });
    }

    cursor =
      page.nextPageCursor || "";
  } while (cursor);

  BAY_DIRECTORY_CACHE = {
    expiresAt:
      Date.now() + 5 * 60_000,
    members
  };

  return members;
}

app.get(
  "/api/profiles/search",
  auth,
  async (
    req,
    res
  ) => {
    try {
      const query =
        String(
          req.query.q ||
          ""
        )
          .trim()
          .toLowerCase();

      if (!query) {
        return res.json({
          success: true,
          results: []
        });
      }

      const directory =
        await bayCafeDirectory();

      const ranked =
        directory
          .filter(
            item =>
              item.username
                .toLowerCase()
                .includes(query) ||
              item.displayName
                .toLowerCase()
                .includes(query)
          )
          .sort(
            (
              a,
              b
            ) => {
              const aUser =
                a.username
                  .toLowerCase();

              const bUser =
                b.username
                  .toLowerCase();

              const aDisplay =
                a.displayName
                  .toLowerCase();

              const bDisplay =
                b.displayName
                  .toLowerCase();

              const aStarts =
                aUser.startsWith(query) ||
                aDisplay.startsWith(query);

              const bStarts =
                bUser.startsWith(query) ||
                bDisplay.startsWith(query);

              if (
                aStarts !== bStarts
              ) {
                return aStarts
                  ? -1
                  : 1;
              }

              return (
                b.roleRank -
                a.roleRank
              );
            }
          )
          .slice(
            0,
            10
          );

      const results =
        await Promise.all(
          ranked.map(
            async item => ({
              ...item,
              avatar:
                await avatarForUser(
                  item.id
                ).catch(
                  () =>
                    ""
                )
            })
          )
        );

      res.json({
        success: true,
        results
      });
    } catch (
      error
    ) {
      res
        .status(
          400
        )
        .json({
          success:
            false,
          message:
            error.message ||
            "Profile search failed."
        });
    }
  }
);

app.get("/api/profiles/:username",auth,async(req,res)=>{try{const user=await robloxUserByUsername(req.params.username);if(!user)return res.status(404).json({success:false,message:"Roblox user not found."});const [details,membership,avatar]=await Promise.all([robloxUserDetails(user.id),groupMembership(user.id),avatarForUser(user.id)]);res.json({success:true,profile:{id:user.id,username:user.name,displayName:user.displayName,description:details.description||"",avatar,profileUrl:`https://www.roblox.com/users/${user.id}/profile`,inGroup:Boolean(membership),roleName:membership?.role?.name||"Not in Bay Café",roleRank:membership?.role?.rank||0}});}catch(error){res.status(400).json({success:false,message:error.message||"Profile lookup failed."});}});

const liveClients=new Set();
function broadcast(type,payload){const msg=`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;for(const client of liveClients){try{client.write(msg);}catch{liveClients.delete(client);}}}
app.get("/api/live",(req,res)=>{const user=verifySessionToken(String(req.query.token||"").trim());if(!user)return res.status(401).json({success:false,message:"Sign in required."});res.setHeader("Content-Type","text/event-stream");res.setHeader("Cache-Control","no-cache, no-transform");res.setHeader("Connection","keep-alive");res.flushHeaders?.();res.write(`event: connected\ndata: ${JSON.stringify({at:new Date().toISOString()})}\n\n`);liveClients.add(res);const heartbeat=setInterval(()=>res.write(": heartbeat\n\n"),25000);req.on("close",()=>{clearInterval(heartbeat);liveClients.delete(res);});});

function shouldTrackMessage(message){if(!message?.guildId||!message?.id||message.author?.bot)return false;if(EXCLUDED_CHANNEL_IDS.has(String(message.channelId)))return false;if(TRACK_CHANNEL_IDS.size)return TRACK_CHANNEL_IDS.has(String(message.channelId));return true;}
function discordRecord(message){return {id:message.id,guildId:message.guildId,channelId:message.channelId,channelName:message.channel?.name||"unknown-channel",content:message.content||"",authorId:message.author.id,authorName:message.member?.displayName||message.author.globalName||message.author.username,authorUsername:message.author.username,authorAvatar:message.author.displayAvatarURL({size:128}),createdAt:message.createdAt.toISOString(),editedAt:message.editedAt?.toISOString()||null,url:message.url,attachments:[...message.attachments.values()].map(x=>({id:x.id,name:x.name,url:x.url,contentType:x.contentType||""}))};}
async function persistDiscordMessage(message){if(!shouldTrackMessage(message))return null;const items=readJson(FILES.discordMessages,[]),record=discordRecord(message);const next=[record,...items.filter(x=>x.id!==record.id)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5000);writeJson(FILES.discordMessages,next);broadcast("discord:message",record);return record;}
async function removeDiscordMessage(id){const items=readJson(FILES.discordMessages,[]),next=items.filter(x=>x.id!==id);if(next.length===items.length)return;writeJson(FILES.discordMessages,next);broadcast("discord:delete",{id});}
async function trackedGuild(){
  if(!discordClient?.isReady())return null;

  if(DISCORD_GUILD_ID){
    const guild=await discordClient.guilds.fetch(DISCORD_GUILD_ID).catch(error=>{
      console.error(
        `[Bay Café] Could not fetch configured guild ${DISCORD_GUILD_ID}: ${error.code||error.name||"ERROR"} - ${error.message}`
      );
      return null;
    });

    if(guild)return guild;
  }

  const cached=[...discordClient.guilds.cache.values()];

  if(cached.length){
    console.warn(
      `[Bay Café] Bot can currently see: ${cached.map(g=>`${g.name} (${g.id})`).join(", ")}`
    );

    if(!DISCORD_GUILD_ID&&cached.length===1){
      return cached[0];
    }
  }else{
    console.warn(
      "[Bay Café] Bot is currently in zero Discord servers."
    );
  }

  return null;
}
async function backfillDiscord(){const guild=await trackedGuild();if(!guild){console.warn("[Bay Café] No Discord guild available for tracking.");return;}const channels=await guild.channels.fetch();const eligible=[...channels.values()].filter(ch=>ch?.isTextBased?.()&&!ch.isThread?.()&&!EXCLUDED_CHANNEL_IDS.has(String(ch.id))&&(!TRACK_CHANNEL_IDS.size||TRACK_CHANNEL_IDS.has(String(ch.id))));for(const ch of eligible){if(!ch?.messages?.fetch)continue;const messages=await ch.messages.fetch({limit:50}).catch(()=>null);if(!messages)continue;for(const message of [...messages.values()].reverse())await persistDiscordMessage(message);}}

function startOfCurrentWeek(){
  const now=new Date();
  const day=now.getDay();
  const diff=day===0?-6:1-day;
  const start=new Date(now);
  start.setDate(now.getDate()+diff);
  start.setHours(0,0,0,0);
  return start;
}

function normalizeIdentity(value){
  return String(value||"")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g,"");
}

function messageBelongsToUser(message,user){
  const userNames=new Set([
    normalizeIdentity(user?.username),
    normalizeIdentity(user?.displayName)
  ]);

  return [
    normalizeIdentity(message?.authorUsername),
    normalizeIdentity(message?.authorName)
  ].some(
    value=>value&&userNames.has(value)
  );
}

app.get("/api/activity/me",auth,(req,res)=>{
  const weekStart=startOfCurrentWeek();

  const messages=readJson(FILES.discordMessages,[])
    .filter(
      item=>
        new Date(item.createdAt)>=weekStart&&
        messageBelongsToUser(item,req.user)
    )
    .sort(
      (a,b)=>new Date(b.createdAt)-new Date(a.createdAt)
    );

  res.json({
    success:true,
    weekStart:weekStart.toISOString(),
    messageCount:messages.length,
    messages
  });
});

app.get("/api/discord/messages",auth,(req,res)=>{
  const limit=Math.min(Math.max(Number(req.query.limit||300),1),1000);
  const channelId=String(req.query.channelId||"").trim();
  const weekStart=startOfCurrentWeek();

  let items=readJson(FILES.discordMessages,[])
    .filter(
      item=>
        new Date(item.createdAt)>=weekStart&&
        messageBelongsToUser(item,req.user)
    );

  if(channelId){
    items=items.filter(
      item=>String(item.channelId)===channelId
    );
  }

  res.json({
    success:true,
    weekStart:weekStart.toISOString(),
    messageCount:items.length,
    messages:items.slice(0,limit)
  });
});
app.get("/api/discord/channels",auth,(req,res)=>{
  const weekStart=startOfCurrentWeek();

  const items=readJson(FILES.discordMessages,[])
    .filter(
      item=>
        new Date(item.createdAt)>=weekStart&&
        messageBelongsToUser(item,req.user)
    );

  const map=new Map();

  for(const item of items){
    if(!map.has(item.channelId)){
      map.set(
        item.channelId,
        {id:item.channelId,name:item.channelName}
      );
    }
  }

  res.json({
    success:true,
    channels:[...map.values()].sort(
      (a,b)=>a.name.localeCompare(b.name)
    )
  });
});


function canManageApplications(user){
  return Number(user?.level||0)>=4 ||
    ["leadership","ownership"].includes(
      String(user?.tier||"").toLowerCase()
    );
}

function cleanQuestions(value){
  const raw=Array.isArray(value)?value:String(value||"").split("\n");
  return raw
    .map(item=>String(item||"").trim())
    .filter(Boolean)
    .slice(0,30)
    .map(item=>item.slice(0,250));
}

function publicApplication(item){
  return {
    id:item.id,
    title:item.title,
    description:item.description,
    status:item.status,
    questions:Array.isArray(item.questions)?item.questions:[],
    createdAt:item.createdAt,
    updatedAt:item.updatedAt,
    createdBy:item.createdBy,
    updatedBy:item.updatedBy
  };
}

app.get("/api/applications",auth,(_req,res)=>{
  const items=readJson(FILES.applications,[])
    .sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));

  res.json({
    success:true,
    applications:items.map(publicApplication)
  });
});

app.post("/api/applications",auth,(req,res)=>{
  if(!canManageApplications(req.user)){
    return res.status(403).json({
      success:false,
      message:"Leadership or Ownership access is required to manage applications."
    });
  }

  const title=String(req.body.title||"").trim().slice(0,100);
  const description=String(req.body.description||"").trim().slice(0,3000);
  const status=String(req.body.status||"open").toLowerCase()==="closed"?"closed":"open";
  const questions=cleanQuestions(req.body.questions);

  if(title.length<3){
    return res.status(400).json({
      success:false,
      message:"Application title must be at least 3 characters."
    });
  }

  const now=new Date().toISOString();
  const application={
    id:crypto.randomUUID(),
    title,
    description,
    status,
    questions,
    createdAt:now,
    updatedAt:now,
    createdBy:req.user.username,
    updatedBy:req.user.username
  };

  const items=readJson(FILES.applications,[]);
  items.unshift(application);
  writeJson(FILES.applications,items);

  broadcast("application:update",{
    action:"created",
    application:publicApplication(application)
  });

  res.status(201).json({
    success:true,
    application:publicApplication(application)
  });
});

app.put("/api/applications/:id",auth,(req,res)=>{
  if(!canManageApplications(req.user)){
    return res.status(403).json({
      success:false,
      message:"Leadership or Ownership access is required to manage applications."
    });
  }

  const items=readJson(FILES.applications,[]);
  const index=items.findIndex(item=>String(item.id)===String(req.params.id));

  if(index<0){
    return res.status(404).json({
      success:false,
      message:"Application not found."
    });
  }

  const current=items[index];
  const title=String(req.body.title??current.title).trim().slice(0,100);
  const description=String(req.body.description??current.description).trim().slice(0,3000);
  const status=String(req.body.status??current.status).toLowerCase()==="closed"?"closed":"open";
  const questions=req.body.questions===undefined
    ? current.questions
    : cleanQuestions(req.body.questions);

  if(title.length<3){
    return res.status(400).json({
      success:false,
      message:"Application title must be at least 3 characters."
    });
  }

  const application={
    ...current,
    title,
    description,
    status,
    questions,
    updatedAt:new Date().toISOString(),
    updatedBy:req.user.username
  };

  items[index]=application;
  writeJson(FILES.applications,items);

  broadcast("application:update",{
    action:"updated",
    application:publicApplication(application)
  });

  res.json({
    success:true,
    application:publicApplication(application)
  });
});

app.delete("/api/applications/:id",auth,(req,res)=>{
  if(!canManageApplications(req.user)){
    return res.status(403).json({
      success:false,
      message:"Leadership or Ownership access is required to manage applications."
    });
  }

  const items=readJson(FILES.applications,[]);
  const application=items.find(item=>String(item.id)===String(req.params.id));

  if(!application){
    return res.status(404).json({
      success:false,
      message:"Application not found."
    });
  }

  writeJson(
    FILES.applications,
    items.filter(item=>String(item.id)!==String(req.params.id))
  );

  broadcast("application:update",{
    action:"deleted",
    application:{id:application.id}
  });

  res.json({success:true});
});

function announcementRecord(message){
  const embeds=[...message.embeds.values()].map(embed=>({
    title:embed.title||"",
    description:embed.description||"",
    url:embed.url||"",
    fields:(embed.fields||[]).map(field=>({
      name:field.name||"",
      value:field.value||""
    }))
  }));

  return {
    id:message.id,
    channelId:message.channelId,
    channelName:message.channel?.name||"announcements",
    content:message.content||"",
    authorId:message.author?.id||"",
    authorName:
      message.member?.displayName||
      message.author?.globalName||
      message.author?.username||
      "Bay Café",
    authorUsername:message.author?.username||"",
    authorAvatar:message.author?.displayAvatarURL?.({size:128})||"",
    createdAt:message.createdAt?.toISOString?.()||new Date().toISOString(),
    url:message.url||"",
    attachments:[...message.attachments.values()].map(item=>({
      id:item.id,
      name:item.name,
      url:item.url,
      contentType:item.contentType||""
    })),
    embeds
  };
}

app.get("/api/announcements",auth,async(_req,res)=>{
  try{
    if(!discordClient?.isReady()){
      return res.json({
        success:true,
        channelId:DISCORD_ANNOUNCEMENT_CHANNEL_ID,
        announcements:[]
      });
    }

    const channel=await discordClient.channels
      .fetch(DISCORD_ANNOUNCEMENT_CHANNEL_ID)
      .catch(()=>null);

    if(!channel?.isTextBased?.()||!channel?.messages?.fetch){
      return res.status(404).json({
        success:false,
        message:"Bay Café announcement channel could not be accessed by the bot."
      });
    }

    const messages=await channel.messages.fetch({limit:50});

    const announcements=[...messages.values()]
      .sort((a,b)=>b.createdTimestamp-a.createdTimestamp)
      .map(announcementRecord);

    res.json({
      success:true,
      channelId:DISCORD_ANNOUNCEMENT_CHANNEL_ID,
      channelName:channel.name||"announcements",
      announcements
    });
  }catch(error){
    res.status(400).json({
      success:false,
      message:error.message||"Unable to load announcements."
    });
  }
});

function publicTicket(ticket){return {...ticket,messages:Array.isArray(ticket.messages)?ticket.messages:[]};}
app.get("/api/tickets",auth,(req,res)=>{const items=readJson(FILES.tickets,[]);const visible=req.user.capabilities?.ticketAdmin?items:items.filter(t=>String(t.userId)===String(req.user.id));res.json({success:true,tickets:visible.map(publicTicket)});});
async function ticketChannel(){if(!discordClient?.isReady()||!DISCORD_TICKET_CHANNEL_ID)return null;return discordClient.channels.fetch(DISCORD_TICKET_CHANNEL_ID).catch(()=>null);}
app.post("/api/tickets",auth,async(req,res)=>{const subject=String(req.body.subject||"").trim().slice(0,100),details=String(req.body.details||"").trim().slice(0,1800),type=String(req.body.type||"General Support").trim().slice(0,50);if(subject.length<3||details.length<5)return res.status(400).json({success:false,message:"Add a subject and details."});const now=new Date().toISOString();const ticket={id:crypto.randomUUID(),userId:req.user.id,username:req.user.username,displayName:req.user.displayName,roleName:req.user.roleName,type,subject,status:"open",createdAt:now,updatedAt:now,discordThreadId:"",messages:[{id:crypto.randomUUID(),authorType:"user",authorId:req.user.id,authorDisplayName:req.user.displayName,authorUsername:req.user.username,content:details,createdAt:now}]};const channel=await ticketChannel();if(channel?.isTextBased()){const sent=await channel.send({content:DISCORD_SUPPORT_ROLE_ID?`<@&${DISCORD_SUPPORT_ROLE_ID}>`:undefined,embeds:[new EmbedBuilder().setColor(0x38bdf8).setTitle(`New Bay Café Website Ticket • ${subject}`).setDescription(details).addFields({name:"Opened by",value:`${req.user.displayName} (@${req.user.username})`,inline:true},{name:"Rank",value:req.user.roleName||"Member",inline:true},{name:"Type",value:type,inline:true}).setFooter({text:`Ticket ${ticket.id}`}).setTimestamp()]});if(sent?.startThread){const thread=await sent.startThread({name:`ticket-${req.user.username}-${subject}`.toLowerCase().replace(/[^a-z0-9-]+/g,"-").slice(0,90),autoArchiveDuration:1440,reason:`Bay Café website ticket ${ticket.id}`}).catch(()=>null);if(thread){ticket.discordThreadId=thread.id;await thread.send("Reply in this thread to communicate with the website ticket.").catch(()=>null);}}}const items=readJson(FILES.tickets,[]);items.unshift(ticket);writeJson(FILES.tickets,items);broadcast("ticket:update",publicTicket(ticket));res.json({success:true,ticket:publicTicket(ticket)});});
app.post("/api/tickets/:ticketId/messages",auth,async(req,res)=>{const content=String(req.body.content||"").trim().slice(0,1800);if(!content)return res.status(400).json({success:false,message:"Write a message first."});const items=readJson(FILES.tickets,[]),ticket=items.find(x=>x.id===req.params.ticketId);if(!ticket)return res.status(404).json({success:false,message:"Ticket not found."});const allowed=req.user.capabilities?.ticketAdmin||String(ticket.userId)===String(req.user.id);if(!allowed)return res.status(403).json({success:false,message:"You do not have access to this ticket."});if(ticket.status==="closed")return res.status(400).json({success:false,message:"This ticket is closed."});const message={id:crypto.randomUUID(),authorType:req.user.capabilities?.ticketAdmin?"staff":"user",authorId:req.user.id,authorDisplayName:req.user.displayName,authorUsername:req.user.username,content,createdAt:new Date().toISOString()};ticket.messages??=[];ticket.messages.push(message);ticket.updatedAt=new Date().toISOString();if(ticket.discordThreadId&&discordClient?.isReady()){const thread=await discordClient.channels.fetch(ticket.discordThreadId).catch(()=>null);if(thread?.isTextBased())await thread.send({embeds:[new EmbedBuilder().setColor(message.authorType==="staff"?0x22c55e:0x38bdf8).setAuthor({name:`${message.authorDisplayName} • Website`}).setDescription(content).setTimestamp()]}).catch(()=>null);}writeJson(FILES.tickets,items);broadcast("ticket:update",publicTicket(ticket));res.json({success:true,ticket:publicTicket(ticket)});});
app.post("/api/tickets/:ticketId/close",auth,async(req,res)=>{const items=readJson(FILES.tickets,[]),ticket=items.find(x=>x.id===req.params.ticketId);if(!ticket)return res.status(404).json({success:false,message:"Ticket not found."});const allowed=req.user.capabilities?.ticketAdmin||String(ticket.userId)===String(req.user.id);if(!allowed)return res.status(403).json({success:false,message:"You do not have access to this ticket."});ticket.status="closed";ticket.closedAt=new Date().toISOString();ticket.updatedAt=ticket.closedAt;if(ticket.discordThreadId&&discordClient?.isReady()){const thread=await discordClient.channels.fetch(ticket.discordThreadId).catch(()=>null);if(thread?.isThread?.()){await thread.send({embeds:[new EmbedBuilder().setColor(0x64748b).setTitle("Ticket Closed").setDescription(`Closed by **${req.user.displayName}** on the Bay Café website.`).setTimestamp()]}).catch(()=>null);await thread.setLocked(true,`Bay Café ticket ${ticket.id} closed`).catch(()=>null);await thread.setArchived(true,`Bay Café ticket ${ticket.id} closed`).catch(()=>null);}}writeJson(FILES.tickets,items);broadcast("ticket:update",publicTicket(ticket));res.json({success:true,ticket:publicTicket(ticket)});});

let discordClient=null;
async function startDiscord(){if(!DISCORD_BOT_TOKEN){console.warn("[Bay Café] DISCORD_BOT_TOKEN is not configured.");return;}discordClient=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent],partials:[Partials.Channel,Partials.Message]});discordClient.once("clientReady",async()=>{console.log(`[Bay Café] Discord connected as ${discordClient.user.tag}`);

    const visibleGuilds=[...discordClient.guilds.cache.values()];

    console.log(
      `[Bay Café] Visible Discord servers: ${
        visibleGuilds.length
          ? visibleGuilds.map(g=>`${g.name} (${g.id})`).join(", ")
          : "NONE"
      }`
    );await backfillDiscord().catch(e=>console.error(`[Bay Café] Discord backfill failed: ${e.message}`));});discordClient.on("messageCreate",async message=>{if(!message.guildId)return;const guild=await trackedGuild();if(guild&&message.guildId!==guild.id)return;const tickets=readJson(FILES.tickets,[]),ticket=tickets.find(x=>x.status==="open"&&String(x.discordThreadId||"")===String(message.channelId));if(ticket&&message.channel?.isThread?.()&&!message.author?.bot){const content=String(message.content||"").trim(),attachmentText=message.attachments?.size?[...message.attachments.values()].map(x=>x.url).join("\n"):"",merged=[content,attachmentText].filter(Boolean).join("\n").slice(0,1800);if(merged){ticket.messages??=[];ticket.messages.push({id:`discord-${message.id}`,authorType:"staff",authorId:message.author.id,authorDisplayName:message.member?.displayName||message.author.globalName||message.author.username,authorUsername:message.author.username,content:merged,createdAt:message.createdAt.toISOString(),source:"discord"});ticket.updatedAt=new Date().toISOString();writeJson(FILES.tickets,tickets);broadcast("ticket:update",publicTicket(ticket));}return;}await persistDiscordMessage(message).catch(e=>console.error(`[Bay Café] Discord message tracking failed: ${e.message}`));});discordClient.on("messageUpdate",async(_old,newMessage)=>{const full=newMessage.partial?await newMessage.fetch().catch(()=>null):newMessage;if(full)await persistDiscordMessage(full).catch(()=>null);});discordClient.on("messageDelete",async message=>removeDiscordMessage(message.id));await discordClient.login(DISCORD_BOT_TOKEN);}

app.get("/api/health",(_req,res)=>res.json({success:true,service:"Bay Café Staff Workspace",groupId:GROUP_ID,discord:Boolean(discordClient?.isReady()),trackedMessages:readJson(FILES.discordMessages,[]).length}));
app.listen(PORT,()=>console.log(`[Bay Café] API listening on port ${PORT}`));
startDiscord().catch(error=>console.error(`[Bay Café] Discord startup failed: ${error.message}`));
