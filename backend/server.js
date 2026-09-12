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
const ROBLOX_OPEN_CLOUD_API_KEY = String(process.env.ROBLOX_OPEN_CLOUD_API_KEY || "").trim();
const GAME_ACTIVITY_SECRET = String(process.env.GAME_ACTIVITY_SECRET || "").trim();
const IS_RAILWAY=Boolean(process.env.RAILWAY_ENVIRONMENT||process.env.RAILWAY_PROJECT_ID||process.env.RAILWAY_SERVICE_ID);
const DATA_DIRECTORY=path.resolve(
  process.env.DATA_DIRECTORY ||
  (IS_RAILWAY?"/data/bay-cafe":"./data")
);
const DISCORD_BOT_TOKEN = String(process.env.DISCORD_BOT_TOKEN || "").trim();
const DISCORD_GUILD_ID = String(process.env.DISCORD_GUILD_ID || "1446083660351799381").trim();
const DISCORD_TICKET_CHANNEL_ID = String(process.env.DISCORD_TICKET_CHANNEL_ID || "").trim();
const DISCORD_SUPPORT_ROLE_ID = String(process.env.DISCORD_SUPPORT_ROLE_ID || "").trim();
const DISCORD_GOVERNANCE_ROLE_ID = "1494982590095036458";
const DISCORD_MANAGEMENT_ROLE_ID = "1494982712321245235";
const DISCORD_ANNOUNCEMENT_CHANNEL_ID = String(process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID || "1446415574682046495").trim();
const TRACK_CHANNEL_IDS = new Set(String(process.env.DISCORD_TRACK_CHANNEL_IDS || "").split(",").map(v=>v.trim()).filter(Boolean));
const EXCLUDED_CHANNEL_IDS = new Set(String(process.env.DISCORD_EXCLUDED_CHANNEL_IDS || "").split(",").map(v=>v.trim()).filter(Boolean));
const ALLOWED_ORIGINS = String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:5173").split(",").map(v=>v.trim().replace(/\/$/,"")).filter(Boolean);

app.use(cors({origin(origin,cb){if(!origin)return cb(null,true);const clean=origin.replace(/\/$/,"");if(ALLOWED_ORIGINS.includes(clean))return cb(null,true);return cb(new Error("Origin not allowed by Bay Café CORS policy."));},credentials:true}));
app.use(express.json({limit:"1mb"}));
fs.mkdirSync(DATA_DIRECTORY,{recursive:true});

const FILES={discordMessages:path.join(DATA_DIRECTORY,"discord-messages.json"),tickets:path.join(DATA_DIRECTORY,"tickets.json"),applications:path.join(DATA_DIRECTORY,"applications.json"),applicationSubmissions:path.join(DATA_DIRECTORY,"application-submissions.json"),activitySettings:path.join(DATA_DIRECTORY,"activity-settings.json"),activityArchive:path.join(DATA_DIRECTORY,"activity-archive.json"),birthdays:path.join(DATA_DIRECTORY,"birthdays.json"),staffDirectory:path.join(DATA_DIRECTORY,"staff-directory.json"),sessions:path.join(DATA_DIRECTORY,"sessions.json"),loas:path.join(DATA_DIRECTORY,"loas.json"),discordLinks:path.join(DATA_DIRECTORY,"discord-links.json"),discipline:path.join(DATA_DIRECTORY,"discipline.json"),audit:path.join(DATA_DIRECTORY,"audit-log.json"),schedules:path.join(DATA_DIRECTORY,"schedules.json"),notifications:path.join(DATA_DIRECTORY,"notifications.json"),departments:path.join(DATA_DIRECTORY,"departments.json"),gameActivity:path.join(DATA_DIRECTORY,"game-activity.json")};
function readJson(file,fallback){try{if(!fs.existsSync(file))return fallback;const raw=fs.readFileSync(file,"utf8");return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
function writeJson(file,value){const temp=`${file}.tmp`;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(temp,JSON.stringify(value,null,2));fs.renameSync(temp,file);}

const APPLICATION_BACKUP_DIRECTORY=path.join(DATA_DIRECTORY,"application-backups");
const APPLICATION_EMPTY_INTENT_FILE=path.join(DATA_DIRECTORY,"applications-empty.intent");
fs.mkdirSync(APPLICATION_BACKUP_DIRECTORY,{recursive:true});

const STARTER_APPLICATIONS=[
  {
    id:"starter-corporate",
    title:"Corporate Application",
    description:"Apply to join the Bay Café Corporate Team.",
    status:"open",
    questions:[
      "What is your Roblox username and Discord username?",
      "Why do you want to join Corporate?",
      "What leadership experience do you have?",
      "What is Corporate's main responsibility?",
      "How would you handle confidential information?",
      "How would you handle an unprofessional Management member?",
      "How would you stay fair when dealing with friends?",
      "What would you do if two departments were not working well together?",
      "What ideas would you bring to improve Bay Café?",
      "Why should we choose you for Corporate?"
    ],
    createdAt:"2026-09-08T00:00:00.000Z",
    updatedAt:"2026-09-08T00:00:00.000Z",
    createdBy:"Bay Café",
    updatedBy:"Bay Café"
  },
  {
    id:"starter-management",
    title:"Management Application",
    description:"Apply to join the Bay Café Management Team.",
    status:"open",
    questions:[
      "What is your Roblox username and Discord username?",
      "Why do you want to join Management?",
      "What leadership experience do you have?",
      "What is Management's most important responsibility?",
      "How would you handle an inactive or unprofessional staff member?",
      "How would you handle someone who believes they were disciplined unfairly?",
      "How would you stay neutral when a friend is involved?",
      "What would you do if you disagreed with another manager's decision?",
      "How would you help improve staff activity?",
      "Why are you ready for Management?"
    ],
    createdAt:"2026-09-08T00:00:00.000Z",
    updatedAt:"2026-09-08T00:00:00.000Z",
    createdBy:"Bay Café",
    updatedBy:"Bay Café"
  },
  {
    id:"starter-directing",
    title:"Directing Team Application",
    description:"Apply to join the Bay Café Directing Team.",
    status:"open",
    questions:[
      "What is your Roblox username and Discord username?",
      "Why do you want to join the Directing Team?",
      "What does professionalism mean to you?",
      "How would you handle a disrespectful staff member?",
      "How would you handle a disagreement between two staff members?",
      "What would you do if someone repeatedly ignored instructions?",
      "How active can you realistically be each week?",
      "How would you help a new staff member who is confused?",
      "What would you do if you saw someone abusing their permissions?",
      "Why should we choose you for the Directing Team?"
    ],
    createdAt:"2026-09-08T00:00:00.000Z",
    updatedAt:"2026-09-08T00:00:00.000Z",
    createdBy:"Bay Café",
    updatedBy:"Bay Café"
  }
];

function starterApplications(){
  return STARTER_APPLICATIONS.map(item=>({...item,questions:[...item.questions]}));
}

function validApplicationArray(value){
  return Array.isArray(value)&&value.every(item=>item&&typeof item==="object"&&item.id&&item.title);
}

function applicationBackupFiles(){
  try{
    return fs.readdirSync(APPLICATION_BACKUP_DIRECTORY)
      .filter(name=>name.endsWith(".json"))
      .map(name=>path.join(APPLICATION_BACKUP_DIRECTORY,name))
      .sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);
  }catch{
    return [];
  }
}

function backupApplications(items,reason="update"){
  if(!validApplicationArray(items))return;

  const safeReason=String(reason||"update").replace(/[^a-z0-9_-]/gi,"-").slice(0,40);
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  const file=path.join(APPLICATION_BACKUP_DIRECTORY,`${stamp}-${safeReason}.json`);

  writeJson(file,items);

  const backups=applicationBackupFiles();
  for(const oldFile of backups.slice(25)){
    try{fs.unlinkSync(oldFile)}catch{}
  }
}

function readApplications(){
  let primary=[];

  try{
    if(fs.existsSync(FILES.applications)){
      const raw=fs.readFileSync(FILES.applications,"utf8");
      primary=raw?JSON.parse(raw):[];

      if(validApplicationArray(primary)&&primary.length){
        return primary;
      }

      if(Array.isArray(primary)&&primary.length===0&&fs.existsSync(APPLICATION_EMPTY_INTENT_FILE)){
        return [];
      }
    }
  }catch(error){
    console.error(`[Bay Café] Primary applications file could not be read: ${error.message}`);
  }

  for(const backupFile of applicationBackupFiles()){
    try{
      const parsed=JSON.parse(fs.readFileSync(backupFile,"utf8"));

      if(validApplicationArray(parsed)&&parsed.length){
        console.warn(`[Bay Café] Restoring applications from backup ${path.basename(backupFile)}`);
        writeJson(FILES.applications,parsed);
        try{fs.unlinkSync(APPLICATION_EMPTY_INTENT_FILE)}catch{}
        return parsed;
      }
    }catch{}
  }

  if(!fs.existsSync(APPLICATION_EMPTY_INTENT_FILE)){
    const starters=starterApplications();
    writeJson(FILES.applications,starters);
    backupApplications(starters,"starter-seed");
    return starters;
  }

  return Array.isArray(primary)?primary:[];
}

function saveApplications(items,reason="update"){
  if(!Array.isArray(items)){
    throw new Error("Application storage expected an array.");
  }

  const current=readApplications();

  if(current.length){
    backupApplications(current,`before-${reason}`);
  }

  writeJson(FILES.applications,items);

  if(items.length){
    try{fs.unlinkSync(APPLICATION_EMPTY_INTENT_FILE)}catch{}
    backupApplications(items,`after-${reason}`);
  }else if(reason==="delete"){
    fs.writeFileSync(
      APPLICATION_EMPTY_INTENT_FILE,
      JSON.stringify({
        intentional:true,
        createdAt:new Date().toISOString()
      })
    );
  }

  return items;
}

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
    `https://users.roblox.com/v1/users/${id}?bayVerify=${Date.now()}`,
    {
      headers:{
        "Cache-Control":"no-cache, no-store",
        "Pragma":"no-cache"
      }
    },
    0
  );
}

function normalizeVerificationText(value){
  return String(value||"")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g,"")
    .replace(/[^A-Za-z0-9]/g,"")
    .toUpperCase();
}

async function descriptionContainsVerificationCode(userId,code){
  const expected=normalizeVerificationText(code);
  let lastDescription="";

  // Roblox profile descriptions can take a few seconds to propagate through
  // their API/CDN. Retry automatically instead of immediately rejecting.
  for(let attempt=0;attempt<6;attempt+=1){
    const latest=await robloxUserDetailsFresh(userId);
    lastDescription=String(latest?.description||"");

    if(normalizeVerificationText(lastDescription).includes(expected)){
      return true;
    }

    if(attempt<5){
      await sleep(2000);
    }
  }

  return false;
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
    "chairwoman",
    "chairman",
    "vice-chairman",
    "vice chairman",
    "vice-chairwoman",
    "vice chairwoman",
    "ownership team",
    "lead coordinator",
    "coordinator",
    "administration lead",
    "chief administrative officer",
    "developing officer"
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

  const directing=[
    "staff assistant",
    "general manager",
    "assistant manager",
    "supervisor"
  ];

  let tier="community";

  if(numericRank>=240||ownership.some(value=>name.includes(value))){
    tier="ownership";
  }else if(numericRank>=200||leadership.some(value=>name.includes(value))){
    tier="leadership";
  }else if(numericRank>=150||governance.some(value=>name.includes(value))){
    tier="governance";
  }else if(numericRank>=100||management.some(value=>name.includes(value))){
    tier="management";
  }else if(directing.some(value=>name.includes(value))){
    tier="directing";
  }

  const levels={
    community:0,
    directing:1,
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
      overview:level>=1,
      discord:level>=1,
      profiles:level>=1,
      tickets:level>=1,
      managementInfo:level>=2,
      governanceInfo:level>=3,
      ticketAdmin:level>=3,
      staffAnalytics:level>=3,
      leadershipTools:level>=4
    }
  };
}

function isStaffAccess(user){
  return Number(user?.level||0)>=1;
}

async function buildWebsiteUser(username,{allowGuest=false}={}){
  const basic=await robloxUserByUsername(username);

  if(!basic){
    throw new Error("Roblox user not found.");
  }

  const [details,membership,avatar]=await Promise.all([
    robloxUserDetails(basic.id),
    groupMembership(basic.id),
    avatarForUser(basic.id)
  ]);

  if(!membership&&!allowGuest){
    throw new Error("This Roblox account is not in the Bay Café group.");
  }

  const roleName=membership?.role?.name||"Guest";
  const roleRank=membership?.role?.rank||0;
  const hierarchy=hierarchyFor(roleName,roleRank);

  return {
    id:basic.id,
    username:basic.name,
    displayName:basic.displayName,
    description:details.description||"",
    avatar,
    profileUrl:`https://www.roblox.com/users/${basic.id}/profile`,
    inGroup:Boolean(membership),
    roleName,
    roleRank,
    tier:hierarchy.tier,
    level:hierarchy.level,
    capabilities:hierarchy.capabilities
  };
}

const SESSION_SECRET=String(process.env.SESSION_SIGNING_SECRET||process.env.DISCORD_BOT_TOKEN||"bay-cafe-local-development-only");
const SESSION_IDLE_MS=7*24*60*60*1000;
const SESSION_REFRESH_MS=5*60*1000;
const sign=value=>crypto.createHmac("sha256",SESSION_SECRET).update(value).digest("base64url");

function safeSignatureMatches(value,signature){
  try{
    const left=Buffer.from(String(signature||""));
    const right=Buffer.from(sign(value));
    return left.length===right.length&&crypto.timingSafeEqual(left,right);
  }catch{
    return false;
  }
}

function createSessionToken(user,lastActiveAt=Date.now()){
  const payload=Buffer.from(
    JSON.stringify({
      v:3,
      issuedAt:Date.now(),
      lastActiveAt:Number(lastActiveAt)||Date.now(),
      nonce:crypto.randomUUID(),
      user
    })
  ).toString("base64url");

  return `bay3.${payload}.${sign(payload)}`;
}

function readSessionToken(token){
  const p=String(token||"").split(".");
  const now=Date.now();

  if(p.length!==3){
    return null;
  }

  // V57+ stateless session: survives Railway/backend restarts.
  if(p[0]==="bay3"&&safeSignatureMatches(p[1],p[2])){
    try{
      const payload=JSON.parse(
        Buffer.from(p[1],"base64url").toString("utf8")
      );

      const lastActiveAt=Number(
        payload?.lastActiveAt||
        payload?.issuedAt||
        0
      );

      if(
        !payload?.user||
        !lastActiveAt||
        now-lastActiveAt>SESSION_IDLE_MS
      ){
        return null;
      }

      return {
        user:payload.user,
        lastActiveAt,
        legacy:false,
        needsRefresh:now-lastActiveAt>=SESSION_REFRESH_MS
      };
    }catch{
      return null;
    }
  }

  // Migrate the original signed V51/V52 token if it is still within 7 days.
  if(p[0]==="bay1"&&safeSignatureMatches(p[1],p[2])){
    try{
      const payload=JSON.parse(
        Buffer.from(p[1],"base64url").toString("utf8")
      );

      const issuedAt=Number(payload?.issuedAt||0);

      if(
        !payload?.user||
        !issuedAt||
        now-issuedAt>SESSION_IDLE_MS
      ){
        return null;
      }

      return {
        user:payload.user,
        lastActiveAt:issuedAt,
        legacy:true,
        needsRefresh:true
      };
    }catch{
      return null;
    }
  }

  // V53–V56 used server-stored bay2 sessions. Keep them working when
  // the persistent sessions file is available, then immediately migrate.
  if(p[0]==="bay2"&&safeSignatureMatches(p[1],p[2])){
    const sessions=readJson(FILES.sessions,{});
    const record=sessions?.[p[1]];
    const lastActiveAt=Number(
      record?.lastActiveAt||
      record?.createdAt||
      0
    );

    if(
      record?.user&&
      lastActiveAt&&
      now-lastActiveAt<=SESSION_IDLE_MS
    ){
      return {
        user:record.user,
        lastActiveAt,
        legacy:true,
        needsRefresh:true
      };
    }
  }

  return null;
}

function verifySessionToken(token){
  return readSessionToken(token)?.user||null;
}

function auth(req,res,next){
  const h=String(req.headers.authorization||"");
  const token=h.startsWith("Bearer ")?h.slice(7).trim():"";
  const session=readSessionToken(token);

  if(!session?.user){
    return res.status(401).json({
      success:false,
      message:"Your saved login expired. Please sign in again."
    });
  }

  req.user=session.user;
  req.sessionToken=token;
  req.session=session;
  next();
}
const authChallenges=new Map();
const mobileLoginChallenges=new Map();

function cleanupMobileLoginChallenges(){
  const now=Date.now();
  for(const [id,item] of mobileLoginChallenges){
    if(!item||Number(item.expiresAt||0)<=now){
      mobileLoginChallenges.delete(id);
    }
  }
}



app.post("/api/auth/mobile/start",async(req,res)=>{
  try{
    cleanupMobileLoginChallenges();

    const discordUsername=String(
      req.body.discordUsername||
      req.body.username||
      ""
    ).replace(/^@/,"").trim();

    if(!discordUsername){
      return res.status(400).json({success:false,message:"Enter your Discord username."});
    }

    if(!discordClient?.isReady()){
      return res.status(503).json({success:false,message:"The Bay Café Discord bot is offline right now."});
    }

    const guild=await trackedGuild();
    if(!guild){
      return res.status(503).json({success:false,message:"The Bay Café main server is unavailable right now."});
    }

    const query=discordUsername.toLowerCase();
    const fetched=await guild.members.fetch({query:discordUsername,limit:100}).catch(()=>null);
    const candidates=fetched?[...fetched.values()]:[...guild.members.cache.values()];

    const matches=candidates.filter(member=>{
      const username=String(member.user?.username||"").toLowerCase();
      const globalName=String(member.user?.globalName||"").toLowerCase();
      const displayName=String(member.displayName||"").toLowerCase();
      return username===query||globalName===query||displayName===query;
    });

    if(matches.length===0){
      return res.status(404).json({
        success:false,
        message:"I couldn't find that Discord username in the main Bay Café server."
      });
    }

    if(matches.length>1){
      return res.status(409).json({
        success:false,
        message:"More than one member matches that name. Enter your exact Discord username, not your server nickname."
      });
    }

    const discordMember=matches[0];
    const link=discordLinkForDiscordId(discordMember.id);

    if(!link){
      return res.status(409).json({
        success:false,
        code:"DISCORD_NOT_LINKED",
        message:"That Discord account is not linked to Roblox yet. Use Roblox backup once, then link Discord from Connections."
      });
    }

    const robloxUsername=String(link.robloxUsername||"").trim();
    if(!robloxUsername){
      return res.status(409).json({
        success:false,
        message:"Your Discord link is missing its Roblox username. Re-link it from Connections."
      });
    }

    const user=await buildWebsiteUser(robloxUsername,{allowGuest:false});

    if(!isStaffAccess(user)){
      return res.status(403).json({success:false,message:"Staff access begins at Directing Team."});
    }

    // If this Discord account already approved a login in the last 10 minutes,
    // let this browser finish signing in now. This is what makes the flow work
    // even when Discord's in-app browser was closed.
    const approved=[...mobileLoginChallenges.entries()]
      .filter(([,item])=>
        item&&
        item.approved===true&&
        String(item.discordId)===String(discordMember.id)&&
        String(item.userId)===String(user.id)&&
        Number(item.expiresAt||0)>Date.now()
      )
      .sort((a,b)=>Number(b[1].approvedAt||0)-Number(a[1].approvedAt||0))[0];

    if(approved){
      const [challengeId]=approved;
      user.accessMode="staff";
      const token=createSessionToken(user);
      mobileLoginChallenges.delete(challengeId);

      return res.json({
        success:true,
        authenticated:true,
        token,
        user,
        persistent:true,
        idleTimeoutDays:7
      });
    }

    // Reuse an existing pending request instead of creating duplicates.
    const pending=[...mobileLoginChallenges.entries()]
      .find(([,item])=>
        item&&
        item.approved!==true&&
        String(item.discordId)===String(discordMember.id)&&
        String(item.userId)===String(user.id)&&
        Number(item.expiresAt||0)>Date.now()
      );

    const challengeId=pending?.[0]||crypto.randomUUID();

    if(!pending){
      mobileLoginChallenges.set(challengeId,{
        userId:String(user.id),
        username:user.username,
        discordId:String(discordMember.id),
        approved:false,
        approvedAt:null,
        expiresAt:Date.now()+10*60*1000
      });
    }

    res.json({
      success:true,
      authenticated:false,
      challengeId,
      expiresInSeconds:600,
      discordUser:{
        id:String(discordMember.id),
        username:discordMember.user.username,
        displayName:discordMember.displayName||discordMember.user.globalName||discordMember.user.username,
        avatar:discordMember.displayAvatarURL?.({size:128})||""
      },
      user:{
        id:user.id,
        username:user.username,
        displayName:user.displayName,
        avatar:user.avatar,
        roleName:user.roleName
      }
    });
  }catch(error){
    res.status(400).json({
      success:false,
      message:error.message||"Unable to start Discord login."
    });
  }
});

app.post("/api/auth/mobile/status",async(req,res)=>{
  try{
    cleanupMobileLoginChallenges();

    const challengeId=String(req.body.challengeId||"");
    const challenge=mobileLoginChallenges.get(challengeId);

    if(!challenge||challenge.expiresAt<=Date.now()){
      mobileLoginChallenges.delete(challengeId);
      return res.status(400).json({
        success:false,
        expired:true,
        message:"That login request expired. Start again."
      });
    }

    if(!challenge.approved){
      return res.json({
        success:true,
        authenticated:false,
        approved:false,
        expiresAt:challenge.expiresAt
      });
    }

    const link=discordLinkForDiscordId(challenge.discordId);
    if(!link||String(link.robloxId)!==String(challenge.userId)){
      mobileLoginChallenges.delete(challengeId);
      return res.status(403).json({
        success:false,
        message:"Your Discord ↔ Roblox link changed. Start again."
      });
    }

    const user=await buildWebsiteUser(challenge.username,{allowGuest:false});
    if(String(user.id)!==String(challenge.userId)||!isStaffAccess(user)){
      mobileLoginChallenges.delete(challengeId);
      return res.status(403).json({
        success:false,
        message:"Your Bay Café staff access changed. Start again."
      });
    }

    user.accessMode="staff";
    const token=createSessionToken(user);
    mobileLoginChallenges.delete(challengeId);

    res.json({
      success:true,
      authenticated:true,
      approved:true,
      token,
      user,
      persistent:true,
      idleTimeoutDays:7
    });
  }catch(error){
    res.status(400).json({
      success:false,
      message:error.message||"Unable to check Discord login."
    });
  }
});

app.post("/api/auth/start",async(req,res)=>{
  try{
    const username=String(req.body.username||"").trim();
    const mode=String(req.body.mode||"staff").toLowerCase()==="community"?"community":"staff";

    if(!username){
      return res.status(400).json({success:false,message:"Enter a Roblox username."});
    }

    const user=await buildWebsiteUser(username,{allowGuest:mode==="community"});

    if(mode==="staff"&&!isStaffAccess(user)){
      return res.status(403).json({
        success:false,
        message:"Staff access begins at Directing Team. Use Community Access if you are Entry Team, a Visitor, or a Guest."
      });
    }

    const challengeId=crypto.randomUUID();
    const code=`BAYCAFE${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    authChallenges.set(challengeId,{
      user,
      code,
      mode,
      expiresAt:Date.now()+10*60*1000
    });

    res.json({
      success:true,
      challengeId,
      code,
      mode,
      profileUrl:user.profileUrl,
      user:{
        username:user.username,
        displayName:user.displayName,
        avatar:user.avatar,
        roleName:user.roleName
      }
    });
  }catch(error){
    res.status(400).json({success:false,message:error.message||"Unable to start sign in."});
  }
});

app.post("/api/auth/verify",async(req,res)=>{
  try{
    const c=authChallenges.get(String(req.body.challengeId||""));

    if(!c||c.expiresAt<=Date.now()){
      throw new Error("Verification code expired. Start again.");
    }

    const verified=await descriptionContainsVerificationCode(
      c.user.id,
      c.code
    );

    if(!verified){
      return res.status(409).json({
        success:false,
        message:"Roblox has not updated your About section in the API yet. Keep the code in your About, wait about 10–20 seconds, then press Verify again."
      });
    }

    const user=await buildWebsiteUser(c.user.username,{allowGuest:c.mode==="community"});

    if(c.mode==="staff"&&!isStaffAccess(user)){
      return res.status(403).json({success:false,message:"Staff access begins at Directing Team."});
    }

    user.accessMode=c.mode;

    const token=createSessionToken(user);

    authChallenges.delete(String(req.body.challengeId||""));

    res.json({success:true,token,user,persistent:true});
  }catch(error){
    res.status(400).json({success:false,message:error.message||"Unable to finish sign in."});
  }
});
app.get("/api/auth/me",auth,(req,res)=>{
  const refreshedToken=
    req.session?.needsRefresh||req.session?.legacy
      ? createSessionToken(req.user,Date.now())
      : null;

  res.json({
    success:true,
    user:req.user,
    persistent:true,
    token:refreshedToken,
    idleTimeoutDays:7
  });
});

app.post("/api/auth/touch",auth,(req,res)=>{
  const token=createSessionToken(
    req.user,
    Date.now()
  );

  res.json({
    success:true,
    active:true,
    token,
    idleTimeoutDays:7
  });
});

app.post("/api/auth/logout",auth,(_req,res)=>{
  // Stateless session: removing the browser token signs the device out.
  res.json({success:true});
});

app.get("/api/stats",auth,async(_req,res)=>{const [g,i]=await Promise.allSettled([groupInfo(),groupIcon()]);const group=g.status==="fulfilled"?g.value:null;const icon=i.status==="fulfilled"?i.value:"";res.json({success:true,group:{id:GROUP_ID,name:group?.name||"Bay Café",description:group?.description||"",memberCount:group?.memberCount||0,owner:group?.owner||null,icon,url:"https://www.roblox.com/communities/695410048/Bay-Cafe#!/about"},discord:{connected:Boolean(discordClient?.isReady()),trackedMessages:readJson(FILES.discordMessages,[]).length,trackedChannels:TRACK_CHANNEL_IDS.size||null}});});

let BAY_DIRECTORY_CACHE = {
  expiresAt: 0,
  members: []
};

function chunksOf(items,size=100){
  const result=[];
  for(let i=0;i<items.length;i+=size){
    result.push(items.slice(i,i+size));
  }
  return result;
}

async function robloxUsersByIds(userIds){
  const ids=[...new Set(userIds.map(Number).filter(Boolean))];
  const users=[];

  for(const batch of chunksOf(ids,100)){
    const response=await jsonFetch(
      "https://users.roblox.com/v1/users",
      {
        method:"POST",
        body:JSON.stringify({
          userIds:batch,
          excludeBannedUsers:false
        })
      },
      60_000
    );

    users.push(...(Array.isArray(response?.data)?response.data:[]));
  }

  return users;
}

async function avatarHeadshotsForUsers(userIds){
  const ids=[...new Set(userIds.map(Number).filter(Boolean))];
  const map=new Map();

  for(const batch of chunksOf(ids,100)){
    const response=await jsonFetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${batch.join(",")}&size=150x150&format=Png&isCircular=true`,
      {},
      5*60_000
    );

    for(const item of response?.data||[]){
      if(item?.targetId){
        map.set(String(item.targetId),item.imageUrl||"");
      }
    }
  }

  return map;
}

async function bayCafeRoles(){
  try{
    const response=await jsonFetch(
      `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`,
      {},
      5*60_000
    );

    const roles=Array.isArray(response?.roles)?response.roles:[];
    return new Map(
      roles.map(role=>[
        String(role.id),
        {
          id:String(role.id),
          name:role.name||"Member",
          rank:Number(role.rank||0)
        }
      ])
    );
  }catch(error){
    console.warn(`[Bay Café] Role list unavailable: ${error.message}`);
    return new Map();
  }
}

function openCloudPathId(value){
  const match=String(value||"").match(/\/(\d+)(?:$|\/)/);
  return match?.[1]||"";
}

async function bayCafeDirectoryOpenCloud(){
  if(!ROBLOX_OPEN_CLOUD_API_KEY){
    throw new Error(
      "ROBLOX_OPEN_CLOUD_API_KEY is not configured."
    );
  }

  const memberships=[];
  let pageToken="";

  do{
    const params=new URLSearchParams({
      maxPageSize:"100"
    });

    if(pageToken){
      params.set("pageToken",pageToken);
    }

    const page=await jsonFetch(
      `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships?${params.toString()}`,
      {
        headers:{
          "x-api-key":ROBLOX_OPEN_CLOUD_API_KEY
        }
      },
      0
    );

    const pageMemberships=
      page?.groupMemberships||
      page?.memberships||
      page?.data||
      [];

    if(Array.isArray(pageMemberships)){
      memberships.push(...pageMemberships);
    }

    pageToken=
      page?.nextPageToken||
      page?.next_page_token||
      "";
  }while(pageToken);

  const normalized=memberships.map(item=>{
    const userPath=
      item?.user||
      item?.userPath||
      item?.user_path||
      item?.user?.path||
      "";

    const rolePath=
      item?.role||
      item?.rolePath||
      item?.role_path||
      item?.role?.path||
      "";

    const userId=
      item?.userId||
      item?.user_id||
      openCloudPathId(userPath);

    const roleId=
      item?.roleId||
      item?.role_id||
      openCloudPathId(rolePath);

    return {
      userId:String(userId||""),
      roleId:String(roleId||"")
    };
  }).filter(item=>item.userId);

  if(!normalized.length){
    return [];
  }

  const userIds=normalized.map(item=>item.userId);
  const [users,avatars,roles]=await Promise.all([
    robloxUsersByIds(userIds),
    avatarHeadshotsForUsers(userIds),
    bayCafeRoles()
  ]);

  const userMap=new Map(
    users.map(user=>[
      String(user.id),
      user
    ])
  );

  return normalized
    .map(member=>{
      const user=userMap.get(member.userId);
      if(!user)return null;

      const role=roles.get(member.roleId)||{
        name:"Member",
        rank:0
      };

      return {
        id:user.id,
        username:user.name,
        displayName:user.displayName||user.name,
        roleName:role.name,
        roleRank:role.rank,
        avatar:avatars.get(String(user.id))||""
      };
    })
    .filter(Boolean);
}

async function bayCafeDirectoryLegacy(){
  const members=[];
  let cursor="";

  do{
    const url=
      `https://groups.roblox.com/v1/groups/${GROUP_ID}/users?sortOrder=Asc&limit=100${cursor?`&cursor=${encodeURIComponent(cursor)}`:""}`;

    const page=await jsonFetch(
      url,
      {},
      60_000
    );

    for(const item of page.data||[]){
      if(!item?.user)continue;

      members.push({
        id:item.user.userId,
        username:item.user.username,
        displayName:item.user.displayName,
        roleName:item.role?.name||"Member",
        roleRank:item.role?.rank||0,
        avatar:""
      });
    }

    cursor=page.nextPageCursor||"";
  }while(cursor);

  if(members.length){
    const avatars=await avatarHeadshotsForUsers(
      members.map(item=>item.id)
    ).catch(()=>new Map());

    for(const member of members){
      member.avatar=avatars.get(String(member.id))||"";
    }
  }

  return members;
}

async function bayCafeDirectory({allowStale=true}={}) {
  if(
    BAY_DIRECTORY_CACHE.expiresAt>Date.now()&&
    BAY_DIRECTORY_CACHE.members.length
  ){
    return BAY_DIRECTORY_CACHE.members;
  }

  const persisted=readJson(
    FILES.staffDirectory,
    {members:[],savedAt:null}
  );
  const persistedMembers=
    Array.isArray(persisted?.members)
      ? persisted.members
      : [];

  let members=[];
  let openCloudError=null;
  let legacyError=null;

  if(ROBLOX_OPEN_CLOUD_API_KEY){
    try{
      members=await bayCafeDirectoryOpenCloud();
    }catch(error){
      openCloudError=error;
      console.warn(
        `[Bay Café] Open Cloud member directory failed: ${error.message}`
      );
    }
  }

  if(!members.length){
    try{
      members=await bayCafeDirectoryLegacy();
    }catch(error){
      legacyError=error;
      console.warn(
        `[Bay Café] Legacy Roblox member directory failed: ${error.message}`
      );
    }
  }

  if(members.length){
    BAY_DIRECTORY_CACHE={
      expiresAt:Date.now()+5*60_000,
      members
    };

    writeJson(FILES.staffDirectory,{
      savedAt:new Date().toISOString(),
      source:ROBLOX_OPEN_CLOUD_API_KEY
        ? "roblox-open-cloud"
        : "roblox-legacy",
      groupId:GROUP_ID,
      members
    });

    return members;
  }

  if(allowStale&&persistedMembers.length){
    console.warn(
      "[Bay Café] Live member directory unavailable; using saved directory cache."
    );

    BAY_DIRECTORY_CACHE={
      expiresAt:Date.now()+60_000,
      members:persistedMembers
    };

    return persistedMembers;
  }

  const reason=
    openCloudError?.message||
    legacyError?.message||
    (
      ROBLOX_OPEN_CLOUD_API_KEY
        ? "Roblox returned no group members."
        : "Roblox now requires authenticated access to enumerate Community members. Configure ROBLOX_OPEN_CLOUD_API_KEY."
    );

  throw new Error(reason);
}

app.get("/api/profiles/status",auth,async(_req,res)=>{
  const persisted=readJson(FILES.staffDirectory,{members:[],savedAt:null});

  res.json({
    success:true,
    groupId:GROUP_ID,
    openCloudConfigured:Boolean(ROBLOX_OPEN_CLOUD_API_KEY),
    cachedMembers:Array.isArray(persisted?.members)?persisted.members.length:0,
    cachedAt:persisted?.savedAt||null,
    source:persisted?.source||null
  });
});

app.get(
  "/api/profiles/search",
  auth,
  async (req,res) => {
    const query=String(req.query.q||"")
      .trim()
      .toLowerCase();

    if(!query){
      return res.json({
        success:true,
        results:[]
      });
    }

    try {
      let directory=[];

      try{
        directory=await bayCafeDirectory({allowStale:true});
      }catch(error){
        console.warn(`[Bay Café] Profile directory lookup failed: ${error.message}`);

        if(
          !ROBLOX_OPEN_CLOUD_API_KEY&&
          String(error.message||"").includes("authenticated access")
        ){
          return res.status(503).json({
            success:false,
            message:"Profile search needs the Roblox Open Cloud key configured on the backend."
          });
        }

        directory=[];
      }

      let results=directory
        .map(item=>{
          const username=String(item.username||"").toLowerCase();
          const displayName=String(item.displayName||"").toLowerCase();

          const usernameIndex=username.indexOf(query);
          const displayIndex=displayName.indexOf(query);

          return {
            ...item,
            _usernameIndex:usernameIndex,
            _displayIndex:displayIndex,
            _matches:usernameIndex!==-1||displayIndex!==-1
          };
        })
        .filter(item=>item._matches)
        .sort((a,b)=>{
          const aPrefix=a._usernameIndex===0||a._displayIndex===0;
          const bPrefix=b._usernameIndex===0||b._displayIndex===0;

          if(aPrefix!==bPrefix){
            return aPrefix?-1:1;
          }

          const aBest=Math.min(
            a._usernameIndex===-1?9999:a._usernameIndex,
            a._displayIndex===-1?9999:a._displayIndex
          );

          const bBest=Math.min(
            b._usernameIndex===-1?9999:b._usernameIndex,
            b._displayIndex===-1?9999:b._displayIndex
          );

          if(aBest!==bBest){
            return aBest-bBest;
          }

          return String(a.username).localeCompare(String(b.username));
        })
        .slice(0,20);

      /*
       * If the full group directory is temporarily unavailable and there is no
       * persistent cache yet, try Roblox's user search for queries with at
       * least two characters. Then keep only users who are actually in Bay Café.
       */
      if(!results.length&&query.length>=2){
        try{
          const [searchResponse,exactUser]=await Promise.all([
            jsonFetch(
              `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(query)}&limit=10`,
              {},
              20_000
            ).catch(()=>({data:[]})),
            robloxUserByUsername(query).catch(()=>null)
          ]);

          const candidates=[
            ...(exactUser?[{
              id:exactUser.id,
              name:exactUser.name,
              displayName:exactUser.displayName
            }]:[]),
            ...(Array.isArray(searchResponse?.data)?searchResponse.data:[])
          ];

          const uniqueCandidates=[
            ...new Map(
              candidates
                .filter(candidate=>candidate?.id)
                .map(candidate=>[String(candidate.id),candidate])
            ).values()
          ];

          const checked=await Promise.all(
            uniqueCandidates.map(async candidate=>{
              try{
                const membership=await groupMembership(candidate.id);
                if(!membership)return null;

                return {
                  id:candidate.id,
                  username:candidate.name,
                  displayName:candidate.displayName,
                  roleName:membership.role?.name||"Member",
                  roleRank:membership.role?.rank||0
                };
              }catch{
                return null;
              }
            })
          );

          results=checked
            .filter(Boolean)
            .sort((a,b)=>{
              const aUser=String(a.username||"").toLowerCase();
              const bUser=String(b.username||"").toLowerCase();
              const aDisplay=String(a.displayName||"").toLowerCase();
              const bDisplay=String(b.displayName||"").toLowerCase();

              const aExact=aUser===query||aDisplay===query;
              const bExact=bUser===query||bDisplay===query;
              if(aExact!==bExact)return aExact?-1:1;

              const aPrefix=aUser.startsWith(query)||aDisplay.startsWith(query);
              const bPrefix=bUser.startsWith(query)||bDisplay.startsWith(query);
              if(aPrefix!==bPrefix)return aPrefix?-1:1;

              return aUser.localeCompare(bUser);
            })
            .slice(0,20);
        }catch(error){
          console.warn(`[Bay Café] Roblox fallback profile search failed: ${error.message}`);
        }
      }

      const hydrated=await Promise.all(
        results.map(async item=>({
          id:item.id,
          username:item.username,
          displayName:item.displayName,
          roleName:item.roleName,
          roleRank:item.roleRank,
          avatar:await avatarForUser(item.id).catch(()=>"")
        }))
      );

      return res.json({
        success:true,
        results:hydrated,
        directoryAvailable:directory.length>0
      });
    } catch(error) {
      /*
       * Profile search should never take the entire page down because Roblox
       * rate-limited or temporarily failed. Return an empty successful result
       * instead of Request failed (400).
       */
      console.error(`[Bay Café] Profile search error: ${error.message}`);

      return res.json({
        success:true,
        results:[],
        directoryAvailable:false,
        warning:"Roblox profile data is temporarily unavailable. Try again shortly."
      });
    }
  }
);
app.get("/api/profiles/:username",auth,async(req,res)=>{
  const requested=String(req.params.username||"").trim();

  try{
    let user=null;

    try{
      user=await robloxUserByUsername(requested);
    }catch(error){
      console.warn(`[Bay Café] Roblox username lookup failed: ${error.message}`);
    }

    if(!user){
      try{
        const directory=await bayCafeDirectory({allowStale:true});
        const match=directory.find(item=>
          String(item.username||"").toLowerCase()===requested.toLowerCase()||
          String(item.displayName||"").toLowerCase()===requested.toLowerCase()
        );

        if(match){
          return res.json({
            success:true,
            profile:{
              id:match.id,
              username:match.username,
              displayName:match.displayName,
              description:"",
              avatar:await avatarForUser(match.id).catch(()=>""),
              profileUrl:`https://www.roblox.com/users/${match.id}/profile`,
              inGroup:true,
              roleName:match.roleName||"Member",
              roleRank:match.roleRank||0,
              cached:true
            }
          });
        }
      }catch{}
    }

    if(!user){
      return res.status(404).json({
        success:false,
        message:"Roblox user not found."
      });
    }

    const [details,membership,avatar]=await Promise.all([
      robloxUserDetails(user.id).catch(()=>({description:""})),
      groupMembership(user.id).catch(()=>null),
      avatarForUser(user.id).catch(()=>"")
    ]);

    return res.json({
      success:true,
      profile:{
        id:user.id,
        username:user.name,
        displayName:user.displayName,
        description:details?.description||"",
        avatar,
        profileUrl:`https://www.roblox.com/users/${user.id}/profile`,
        inGroup:Boolean(membership),
        roleName:membership?.role?.name||"Not in Bay Café",
        roleRank:membership?.role?.rank||0
      }
    });
  }catch(error){
    console.error(`[Bay Café] Profile lookup error: ${error.message}`);

    return res.status(503).json({
      success:false,
      message:"Roblox profile data is temporarily unavailable. Please try again shortly."
    });
  }
});
const liveClients=new Set();
function broadcast(type,payload){const msg=`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;for(const client of liveClients){try{client.write(msg);}catch{liveClients.delete(client);}}}
app.get("/api/live",(req,res)=>{const user=verifySessionToken(String(req.query.token||"").trim());if(!user)return res.status(401).json({success:false,message:"Sign in required."});res.setHeader("Content-Type","text/event-stream");res.setHeader("Cache-Control","no-cache, no-transform");res.setHeader("Connection","keep-alive");res.flushHeaders?.();res.write(`event: connected\ndata: ${JSON.stringify({at:new Date().toISOString()})}\n\n`);liveClients.add(res);const heartbeat=setInterval(()=>res.write(": heartbeat\n\n"),25000);req.on("close",()=>{clearInterval(heartbeat);liveClients.delete(res);});});

function shouldTrackMessage(message){
  if(!message?.guildId||!message?.id||message.author?.bot)return false;

  const channelId=String(message.channelId||"");
  const parentId=String(message.channel?.parentId||"");

  if(
    EXCLUDED_CHANNEL_IDS.has(channelId)||
    (parentId&&EXCLUDED_CHANNEL_IDS.has(parentId))
  ){
    return false;
  }

  if(TRACK_CHANNEL_IDS.size){
    return (
      TRACK_CHANNEL_IDS.has(channelId)||
      (parentId&&TRACK_CHANNEL_IDS.has(parentId))
    );
  }

  return true;
}
function discordRecord(message){
  const memberRoles=message.member?.roles?.cache
    ? [...message.member.roles.cache.values()]
        .filter(role=>role&&role.name!=="@everyone")
    : [];

  const roleNames=memberRoles.map(role=>role.name);
  const roleIds=memberRoles.map(role=>String(role.id));

  return {
    id:message.id,
    guildId:message.guildId,
    channelId:message.channelId,
    channelName:message.channel?.name||"unknown-channel",
    content:message.content||"",
    authorId:message.author.id,
    authorName:message.member?.displayName||message.author.globalName||message.author.username,
    authorUsername:message.author.username,
    authorAvatar:message.author.displayAvatarURL({size:128}),
    authorRoleNames:roleNames,
    authorRoleIds:roleIds,
    createdAt:message.createdAt.toISOString(),
    editedAt:message.editedAt?.toISOString()||null,
    url:message.url,
    attachments:[...message.attachments.values()].map(x=>({
      id:x.id,
      name:x.name,
      url:x.url,
      contentType:x.contentType||""
    }))
  };
}

async function resolveDiscordMemberForMessage(message){
  if(message.member?.roles?.cache?.size){
    return message.member;
  }

  const guild=message.guild||await trackedGuild();

  if(!guild||!message.author?.id){
    return message.member||null;
  }

  return guild.members.fetch(message.author.id).catch(()=>message.member||null);
}

async function discordRecordResolved(message){
  const member=await resolveDiscordMemberForMessage(message);

  const memberRoles=member?.roles?.cache
    ? [...member.roles.cache.values()]
        .filter(role=>role&&role.name!=="@everyone")
    : [];

  return {
    id:message.id,
    guildId:message.guildId,
    channelId:message.channelId,
    channelName:message.channel?.name||"unknown-channel",
    content:message.content||"",
    authorId:message.author.id,
    authorName:member?.displayName||message.author.globalName||message.author.username,
    authorUsername:message.author.username,
    authorAvatar:message.author.displayAvatarURL({size:128}),
    authorRoleNames:memberRoles.map(role=>role.name),
    authorRoleIds:memberRoles.map(role=>String(role.id)),
    createdAt:message.createdAt.toISOString(),
    editedAt:message.editedAt?.toISOString()||null,
    url:message.url,
    attachments:[...message.attachments.values()].map(x=>({
      id:x.id,
      name:x.name,
      url:x.url,
      contentType:x.contentType||""
    }))
  };
}

async function persistDiscordMessage(message){
  if(!shouldTrackMessage(message))return null;

  const items=readJson(FILES.discordMessages,[]);
  const record=await discordRecordResolved(message);

  const next=[record,...items.filter(x=>x.id!==record.id)]
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
    .slice(0,30000);

  writeJson(FILES.discordMessages,next);
  broadcast("discord:message",record);
  return record;
}
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

async function activityChannelsForGuild(guild){
  const channels=await guild.channels.fetch();
  const values=[...channels.values()].filter(Boolean);

  try{
    const activeThreads=await guild.channels.fetchActiveThreads();
    for(const thread of activeThreads?.threads?.values?.()||[]){
      if(!values.some(channel=>String(channel.id)===String(thread.id))){
        values.push(thread);
      }
    }
  }catch(error){
    console.warn(`[Bay Café] Could not fetch active Discord threads: ${error.message}`);
  }

  return values.filter(channel=>
    channel?.isTextBased?.()&&
    !EXCLUDED_CHANNEL_IDS.has(String(channel.id))&&
    !(
      channel?.parentId&&
      EXCLUDED_CHANNEL_IDS.has(String(channel.parentId))
    )&&
    (
      !TRACK_CHANNEL_IDS.size||
      TRACK_CHANNEL_IDS.has(String(channel.id))||
      (
        channel?.parentId&&
        TRACK_CHANNEL_IDS.has(String(channel.parentId))
      )
    )
  );
}


/* =========================================================
   STAFF OPERATIONS — LOA, LINKING, DISCIPLINE, SCHEDULES,
   NOTIFICATIONS, AUDIT, DEPARTMENTS, AND GAME ACTIVITY
========================================================= */
function canModerateStaff(user){return Number(user?.level||0)>=2;}
function canManageStaff(user){return Number(user?.level||0)>=4;}
function nowIso(){return new Date().toISOString();}
function cleanText(value,max=1000){return String(value||"").trim().slice(0,max);}
function userKey(value){return String(value||"").trim();}

function readLinkState(){
  const state=readJson(FILES.discordLinks,{links:[],pending:[]});
  return {
    links:Array.isArray(state?.links)?state.links:[],
    pending:Array.isArray(state?.pending)?state.pending:[]
  };
}
function saveLinkState(state){writeJson(FILES.discordLinks,state);}
function discordLinkForRobloxId(robloxId){
  return readLinkState().links.find(item=>String(item.robloxId)===String(robloxId))||null;
}
function discordLinkForDiscordId(discordId){
  return readLinkState().links.find(item=>String(item.discordId)===String(discordId))||null;
}
function auditEvent(action,actor,target={},meta={}){
  const items=readJson(FILES.audit,[]);
  const record={
    id:crypto.randomUUID(),action,
    actor:{id:actor?.id||null,username:actor?.username||"System",displayName:actor?.displayName||actor?.username||"System",roleName:actor?.roleName||""},
    target,meta,createdAt:nowIso()
  };
  items.unshift(record);
  writeJson(FILES.audit,items.slice(0,5000));
  broadcast("audit:new",record);
  return record;
}
function pushNotification(robloxId,type,title,message,meta={}){
  if(!robloxId)return null;
  const items=readJson(FILES.notifications,[]);
  const item={id:crypto.randomUUID(),robloxId:String(robloxId),type,title,message,meta,read:false,createdAt:nowIso()};
  items.unshift(item);
  writeJson(FILES.notifications,items.slice(0,10000));
  broadcast("notification:new",item);
  return item;
}
async function dmLinkedRobloxUser(robloxId,{title,message,color=0x38bdf8,fields=[]}={}){
  const link=discordLinkForRobloxId(robloxId);
  if(!link)return {sent:false,reason:"Discord account is not linked."};
  if(!discordClient?.isReady())return {sent:false,reason:"Discord bot is offline."};
  try{
    const user=await discordClient.users.fetch(String(link.discordId));
    await user.send({
      embeds:[new EmbedBuilder().setColor(color).setTitle(title||"Bay Café").setDescription(message||"").addFields(fields).setFooter({text:"Bay Café Staff Management"}).setTimestamp()]
    });
    return {sent:true,discordId:link.discordId};
  }catch(error){
    return {sent:false,reason:error.message||"Unable to DM this user."};
  }
}
function activeStrikesFor(robloxId){
  return readJson(FILES.discipline,[]).filter(item=>
    String(item.robloxId)===String(robloxId)&&
    item.type==="strike"&&
    item.active!==false
  ).length;
}
function activeLoaFor(robloxId,at=new Date()){
  const today=at.toISOString().slice(0,10);
  return readJson(FILES.loas,[]).find(item=>
    String(item.robloxId)===String(robloxId)&&
    item.status==="approved"&&
    String(item.startDate)<=today&&
    String(item.endDate)>=today
  )||null;
}
function defaultDepartments(){return [
  {id:"hr",name:"Human Resources",description:"Applications, staff conduct, activity, strikes, demotions, and staff support.",lead:"",heads:["",""],members:[],links:[]},
  {id:"pr",name:"Public Relations",description:"Alliances, announcements, events, representatives, and community relations.",lead:"",heads:["",""],members:[],links:[]},
  {id:"operations",name:"Operations",description:"Tickets, moderation, shifts, trainings, and day-to-day operations.",lead:"",heads:["",""],members:[],links:[]}
];}
function getDepartments(){const items=readJson(FILES.departments,null);return Array.isArray(items)&&items.length?items:defaultDepartments();}
function readGameActivity(){const state=readJson(FILES.gameActivity,{sessions:[],totals:{}});return {sessions:Array.isArray(state?.sessions)?state.sessions:[],totals:state?.totals&&typeof state.totals==="object"?state.totals:{}};}
function saveGameActivity(state){writeJson(FILES.gameActivity,state);}

app.get("/api/notifications",auth,(req,res)=>{
  const items=readJson(FILES.notifications,[]).filter(x=>String(x.robloxId)===String(req.user.id));
  res.json({success:true,notifications:items,unread:items.filter(x=>!x.read).length});
});
app.post("/api/notifications/read",auth,(req,res)=>{
  const ids=new Set((Array.isArray(req.body.ids)?req.body.ids:[]).map(String));
  const all=readJson(FILES.notifications,[]);
  for(const item of all){if(String(item.robloxId)===String(req.user.id)&&(ids.size===0||ids.has(String(item.id))))item.read=true;}
  writeJson(FILES.notifications,all);
  res.json({success:true});
});

app.get("/api/loa",auth,(req,res)=>{
  const all=readJson(FILES.loas,[]);
  const loas=canManageStaff(req.user)?all:all.filter(x=>String(x.robloxId)===String(req.user.id));
  res.json({success:true,loas});
});
app.post("/api/loa",auth,(req,res)=>{
  const startDate=cleanText(req.body.startDate,10),endDate=cleanText(req.body.endDate,10),reason=cleanText(req.body.reason,1000);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||endDate<startDate||reason.length<5)return res.status(400).json({success:false,message:"Enter valid LOA dates and a reason."});
  const all=readJson(FILES.loas,[]);
  const item={id:crypto.randomUUID(),robloxId:req.user.id,username:req.user.username,displayName:req.user.displayName,roleName:req.user.roleName,startDate,endDate,reason,status:"pending",createdAt:nowIso(),reviewedAt:null,reviewedBy:null,reviewNote:""};
  all.unshift(item);writeJson(FILES.loas,all);auditEvent("loa.submitted",req.user,{robloxId:req.user.id,username:req.user.username},{loaId:item.id,startDate,endDate});
  res.json({success:true,loa:item});
});
app.put("/api/loa/:id",auth,async(req,res)=>{
  if(!canManageStaff(req.user))return res.status(403).json({success:false,message:"Leadership access required."});
  const status=["approved","denied"].includes(String(req.body.status))?String(req.body.status):"";
  if(!status)return res.status(400).json({success:false,message:"Choose approved or denied."});
  const all=readJson(FILES.loas,[]),item=all.find(x=>x.id===req.params.id);if(!item)return res.status(404).json({success:false,message:"LOA not found."});
  item.status=status;item.reviewedAt=nowIso();item.reviewedBy=req.user.username;item.reviewNote=cleanText(req.body.reviewNote,500);writeJson(FILES.loas,all);
  const title=status==="approved"?"LOA Approved":"LOA Denied";
  const message=`Your Bay Café LOA for ${item.startDate} through ${item.endDate} was ${status}.${item.reviewNote?`\n\nNote: ${item.reviewNote}`:""}`;
  pushNotification(item.robloxId,"loa",title,message,{loaId:item.id});
  const dm=await dmLinkedRobloxUser(item.robloxId,{title,message,color:status==="approved"?0x22c55e:0xef4444});
  auditEvent(`loa.${status}`,req.user,{robloxId:item.robloxId,username:item.username},{loaId:item.id,dmSent:dm.sent});
  res.json({success:true,loa:item,dm});
});

app.get("/api/link",auth,(req,res)=>{
  const link=discordLinkForRobloxId(req.user.id);
  res.json({success:true,link:link?{discordId:link.discordId,discordUsername:link.discordUsername,linkedAt:link.linkedAt}:null});
});
app.post("/api/link/start",auth,(req,res)=>{
  const state=readLinkState();
  state.pending=state.pending.filter(x=>Date.now()<Number(x.expiresAt||0)&&String(x.robloxId)!==String(req.user.id));
  let code="";do{code=crypto.randomBytes(3).toString("hex").toUpperCase();}while(state.pending.some(x=>x.code===code));
  state.pending.push({code,robloxId:req.user.id,username:req.user.username,displayName:req.user.displayName,expiresAt:Date.now()+10*60*1000});
  saveLinkState(state);res.json({success:true,code,command:`,link ${code}`,expiresInMinutes:10});
});
app.post("/api/link/unlink",auth,(req,res)=>{
  const state=readLinkState();
  state.links=state.links.filter(x=>String(x.robloxId)!==String(req.user.id));
  state.pending=state.pending.filter(x=>String(x.robloxId)!==String(req.user.id));
  saveLinkState(state);auditEvent("discord.unlinked",req.user,{robloxId:req.user.id,username:req.user.username});res.json({success:true});
});

app.get("/api/discipline",auth,async(req,res)=>{
  const all=readJson(FILES.discipline,[]);
  const items=canModerateStaff(req.user)?all:all.filter(x=>String(x.robloxId)===String(req.user.id));
  const targets=canModerateStaff(req.user)?await disciplinaryEligibleDirectory():[];
  res.json({success:true,items,targets});
});
app.post("/api/discipline",auth,async(req,res)=>{
  if(!canModerateStaff(req.user))return res.status(403).json({success:false,message:"Management access required."});
  const type=String(req.body.type||"");
  if(!["verbal","warning","strike"].includes(type))return res.status(400).json({success:false,message:"Choose verbal warning, warning, or strike."});
  const robloxId=cleanText(req.body.robloxId,40),username=cleanText(req.body.username,60),displayName=cleanText(req.body.displayName,80),reason=cleanText(req.body.reason,1200),evidence=cleanText(req.body.evidence,1200);
  if(!robloxId||reason.length<3)return res.status(400).json({success:false,message:"Choose a staff member and enter a reason."});
  const eligible=await disciplinaryEligibleDirectory();
  const target=eligible.find(member=>String(member.id)===String(robloxId));
  if(!target)return res.status(400).json({success:false,message:"Warnings and strikes can only be issued to Directing, Management, or Corporate Team members."});
  const all=readJson(FILES.discipline,[]);
  const item={id:crypto.randomUUID(),type,robloxId,username,displayName,reason,evidence,active:true,createdAt:nowIso(),issuedBy:{id:req.user.id,username:req.user.username,displayName:req.user.displayName,roleName:req.user.roleName}};
  all.unshift(item);writeJson(FILES.discipline,all);
  const strikes=activeStrikesFor(robloxId),demotionEligible=strikes>=3;
  const labels={verbal:"Verbal Warning",warning:"Warning",strike:"Strike"};
  const title=`Bay Café ${labels[type]}`;
  const message=`You received a ${labels[type].toLowerCase()} from Bay Café.\n\nReason: ${reason}${evidence?`\n\nEvidence/notes: ${evidence}`:""}${type==="strike"?`\n\nActive strikes: ${strikes}/3`:""}${demotionEligible?"\n\nYou are now eligible for demotion under the 3-strike policy.":""}`;
  pushNotification(robloxId,"discipline",title,message,{recordId:item.id,type,strikes,demotionEligible});
  const dm=await dmLinkedRobloxUser(robloxId,{title,message,color:type==="strike"?0xef4444:type==="warning"?0xf59e0b:0x38bdf8});
  auditEvent(`discipline.${type}`,req.user,{robloxId,username},{recordId:item.id,reason,strikes,demotionEligible,dmSent:dm.sent});
  res.json({success:true,item,strikes,demotionEligible,dm});
});
app.post("/api/discipline/demote",auth,async(req,res)=>{
  if(!canManageStaff(req.user))return res.status(403).json({success:false,message:"Leadership access required to record a demotion."});
  const robloxId=cleanText(req.body.robloxId,40),username=cleanText(req.body.username,60),displayName=cleanText(req.body.displayName,80),reason=cleanText(req.body.reason,1200);
  const eligible=await disciplinaryEligibleDirectory();
  const target=eligible.find(member=>String(member.id)===String(robloxId));
  if(!target)return res.status(400).json({success:false,message:"Demotions from the strike system only apply to Directing, Management, or Corporate Team members."});
  const strikes=activeStrikesFor(robloxId);
  if(strikes<3)return res.status(400).json({success:false,message:`This member has ${strikes}/3 active strikes.`});
  const all=readJson(FILES.discipline,[]);
  const item={id:crypto.randomUUID(),type:"demotion",robloxId,username,displayName,reason:reason||"Three active strikes",evidence:"",active:true,createdAt:nowIso(),issuedBy:{id:req.user.id,username:req.user.username,displayName:req.user.displayName,roleName:req.user.roleName},strikeCountAtDemotion:strikes,robloxRankChanged:false};
  all.unshift(item);writeJson(FILES.discipline,all);
  const title="Bay Café Demotion";
  const message=`A demotion has been recorded after reaching ${strikes} active strikes.\n\nReason: ${item.reason}\n\nYour Roblox rank must be updated by authorized leadership.`;
  pushNotification(robloxId,"discipline",title,message,{recordId:item.id,type:"demotion"});
  const dm=await dmLinkedRobloxUser(robloxId,{title,message,color:0xdc2626});
  auditEvent("discipline.demotion",req.user,{robloxId,username},{recordId:item.id,strikes,dmSent:dm.sent});
  res.json({success:true,item,dm,robloxRankChanged:false});
});
app.post("/api/discipline/:id/void",auth,(req,res)=>{
  if(!canManageStaff(req.user))return res.status(403).json({success:false,message:"Leadership access required."});
  const all=readJson(FILES.discipline,[]),item=all.find(x=>x.id===req.params.id);if(!item)return res.status(404).json({success:false,message:"Record not found."});
  item.active=false;item.voidedAt=nowIso();item.voidedBy=req.user.username;item.voidReason=cleanText(req.body.reason,500);writeJson(FILES.discipline,all);auditEvent("discipline.voided",req.user,{robloxId:item.robloxId,username:item.username},{recordId:item.id});res.json({success:true,item});
});

app.get("/api/schedules",auth,(_req,res)=>res.json({success:true,items:readJson(FILES.schedules,[])}));
app.post("/api/schedules",auth,(req,res)=>{
  if(!canManageStaff(req.user))return res.status(403).json({success:false,message:"Leadership access required."});
  const title=cleanText(req.body.title,120),type=["Training","Shift","Meeting","Event"].includes(String(req.body.type))?String(req.body.type):"Training",startsAt=cleanText(req.body.startsAt,40),host=cleanText(req.body.host,100),notes=cleanText(req.body.notes,800);
  if(title.length<2||!startsAt)return res.status(400).json({success:false,message:"Add a title and start time."});
  const all=readJson(FILES.schedules,[]),item={id:crypto.randomUUID(),title,type,startsAt,host:host||req.user.displayName,notes,status:"scheduled",createdAt:nowIso(),createdBy:req.user.username};all.unshift(item);writeJson(FILES.schedules,all);auditEvent("schedule.created",req.user,{scheduleId:item.id,title:item.title},{type,startsAt});res.json({success:true,item});
});
app.delete("/api/schedules/:id",auth,(req,res)=>{
  if(!canManageStaff(req.user))return res.status(403).json({success:false,message:"Leadership access required."});
  const all=readJson(FILES.schedules,[]),item=all.find(x=>x.id===req.params.id);writeJson(FILES.schedules,all.filter(x=>x.id!==req.params.id));if(item)auditEvent("schedule.deleted",req.user,{scheduleId:item.id,title:item.title});res.json({success:true});
});

app.get("/api/departments",auth,(_req,res)=>{
  const departments=getDepartments().map(item=>{
    const heads=Array.isArray(item.heads)?item.heads.slice(0,2):[item.lead||"",""];
    while(heads.length<2)heads.push("");
    return {...item,heads};
  });
  res.json({success:true,departments});
});
app.put("/api/departments",auth,(req,res)=>{
  if(!canManageStaff(req.user))return res.status(403).json({success:false,message:"Leadership access required."});
  const departments=Array.isArray(req.body.departments)?req.body.departments.slice(0,10).map(item=>{
    const incomingHeads=Array.isArray(item.heads)?item.heads:[item.lead||"",""];
    const heads=incomingHeads.slice(0,2).map(value=>cleanText(value,100));
    while(heads.length<2)heads.push("");
    return {
      id:cleanText(item.id,30)||crypto.randomUUID(),
      name:cleanText(item.name,80),
      description:cleanText(item.description,800),
      lead:heads.filter(Boolean).join(" & "),
      heads,
      members:Array.isArray(item.members)?item.members.slice(0,100):[],
      links:Array.isArray(item.links)?item.links.slice(0,20):[]
    };
  }):[];
  writeJson(FILES.departments,departments);auditEvent("departments.updated",req.user,{count:departments.length});res.json({success:true,departments});
});

app.get("/api/audit",auth,(req,res)=>{
  if(!canManageStaff(req.user))return res.status(403).json({success:false,message:"Leadership access required."});
  res.json({success:true,items:readJson(FILES.audit,[]).slice(0,500)});
});

app.patch("/api/application-submissions/:id/review",auth,async(req,res)=>{
  if(!canManageStaff(req.user))return res.status(403).json({success:false,message:"Leadership access required."});
  const status=["accepted","denied","hold","pending"].includes(String(req.body.status))?String(req.body.status):"";
  if(!status)return res.status(400).json({success:false,message:"Choose accepted, denied, hold, or pending."});
  const all=readJson(FILES.applicationSubmissions,[]),item=all.find(x=>x.id===req.params.id);if(!item)return res.status(404).json({success:false,message:"Submission not found."});
  item.status=status;item.reviewNote=cleanText(req.body.reviewNote,1000);item.reviewedAt=nowIso();item.reviewedBy=req.user.username;writeJson(FILES.applicationSubmissions,all);
  const robloxId=item.userId||item.robloxId;
  const title=`Application ${status==="hold"?"On Hold":status.charAt(0).toUpperCase()+status.slice(1)}`;
  const message=`Your ${item.applicationTitle||item.title||"Bay Café"} application is now ${status}.${item.reviewNote?`\n\nReviewer note: ${item.reviewNote}`:""}`;
  if(robloxId){pushNotification(robloxId,"application",title,message,{submissionId:item.id,status});await dmLinkedRobloxUser(robloxId,{title,message,color:status==="accepted"?0x22c55e:status==="denied"?0xef4444:0xf59e0b});}
  auditEvent("application.reviewed",req.user,{submissionId:item.id,robloxId:robloxId||null,username:item.username||item.userUsername||""},{status});broadcast("application:submission",item);res.json({success:true,submission:item});
});

app.get("/api/staff-directory",auth,async(req,res)=>{
  let directory=[];try{directory=await bayCafeDirectory({allowStale:true});}catch{}
  const links=readLinkState().links,loas=readJson(FILES.loas,[]),discipline=readJson(FILES.discipline,[]),game=readGameActivity();
  const weekStart=startOfCurrentWeek();const messages=readJson(FILES.discordMessages,[]).filter(x=>new Date(x.createdAt)>=weekStart);
  const staff=directory.map(member=>{
    const link=links.find(x=>String(x.robloxId)===String(member.id));
    const messageCount=link?messages.filter(x=>String(x.authorId)===String(link.discordId)).length:messages.filter(x=>normalizeIdentity(x.authorUsername)===normalizeIdentity(member.username)).length;
    const strikes=discipline.filter(x=>String(x.robloxId)===String(member.id)&&x.type==="strike"&&x.active!==false).length;
    return {...member,linked:Boolean(link),discordUsername:link?.discordUsername||"",messageCount,loa:activeLoaFor(member.id),activeStrikes:strikes,gameMinutes:Number(game.totals?.[String(member.id)]?.minutes||0)};
  });
  res.json({success:true,staff});
});
app.get("/api/staff/:id/summary",auth,async(req,res)=>{
  const robloxId=String(req.params.id);let directory=[];try{directory=await bayCafeDirectory({allowStale:true});}catch{}
  const member=directory.find(x=>String(x.id)===robloxId);if(!member)return res.status(404).json({success:false,message:"Staff member not found."});
  const link=discordLinkForRobloxId(robloxId),weekStart=startOfCurrentWeek(),messages=readJson(FILES.discordMessages,[]).filter(x=>new Date(x.createdAt)>=weekStart&&(link?String(x.authorId)===String(link.discordId):normalizeIdentity(x.authorUsername)===normalizeIdentity(member.username)));
  const discipline=readJson(FILES.discipline,[]).filter(x=>String(x.robloxId)===robloxId);const loas=readJson(FILES.loas,[]).filter(x=>String(x.robloxId)===robloxId);const game=readGameActivity();
  res.json({success:true,member:{...member,link:link?{discordId:link.discordId,discordUsername:link.discordUsername,linkedAt:link.linkedAt}:null,messageCount:messages.length,discipline:canModerateStaff(req.user)?discipline:[],loas:canManageStaff(req.user)||String(req.user.id)===robloxId?loas:[],game:game.totals?.[robloxId]||{minutes:0,lastSeenAt:null}}});
});

app.get("/api/search",auth,async(req,res)=>{
  const q=cleanText(req.query.q,80).toLowerCase();if(q.length<2)return res.json({success:true,results:[]});
  const results=[];let directory=[];try{directory=await bayCafeDirectory({allowStale:true});}catch{}
  for(const m of directory){if(`${m.username} ${m.displayName} ${m.roleName}`.toLowerCase().includes(q))results.push({type:"staff",id:String(m.id),title:m.displayName,subtitle:`@${m.username} • ${m.roleName}`});}
  for(const a of readApplications()){if(`${a.title} ${a.description}`.toLowerCase().includes(q))results.push({type:"application",id:a.id,title:a.title,subtitle:a.status||"application"});}
  if(req.user.capabilities?.ticketAdmin){for(const t of readJson(FILES.tickets,[])){if(`${t.subject} ${t.username} ${t.type}`.toLowerCase().includes(q))results.push({type:"ticket",id:t.id,title:t.subject,subtitle:`${t.username} • ${t.status}`});}}
  for(const s of readJson(FILES.schedules,[])){if(`${s.title} ${s.type} ${s.host}`.toLowerCase().includes(q))results.push({type:"schedule",id:s.id,title:s.title,subtitle:`${s.type} • ${s.startsAt}`});}
  res.json({success:true,results:results.slice(0,40)});
});

app.get("/api/game/activity/me",auth,(req,res)=>{
  const state=readGameActivity();res.json({success:true,enabled:Boolean(GAME_ACTIVITY_SECRET),activity:state.totals?.[String(req.user.id)]||{minutes:0,lastSeenAt:null,sessions:0}});
});
app.get("/api/game/activity/admin",auth,(req,res)=>{
  if(!canManageStaff(req.user))return res.status(403).json({success:false,message:"Leadership access required."});
  const state=readGameActivity();res.json({success:true,enabled:Boolean(GAME_ACTIVITY_SECRET),totals:state.totals,recentSessions:state.sessions.slice(0,200)});
});
app.post("/api/game/activity",(req,res)=>{
  if(!GAME_ACTIVITY_SECRET)return res.status(503).json({success:false,message:"Game activity integration is not enabled yet."});
  if(String(req.headers["x-bay-game-secret"]||"")!==GAME_ACTIVITY_SECRET)return res.status(401).json({success:false,message:"Invalid game activity secret."});
  const robloxId=cleanText(req.body.robloxId,40),username=cleanText(req.body.username,60),event=["join","heartbeat","leave"].includes(String(req.body.event))?String(req.body.event):"heartbeat";
  if(!robloxId)return res.status(400).json({success:false,message:"robloxId is required."});
  const state=readGameActivity(),key=String(robloxId),now=Date.now();let open=state.sessions.find(x=>String(x.robloxId)===key&&!x.leftAt);
  if(event==="join"||!open){open={id:crypto.randomUUID(),robloxId:key,username,joinedAt:new Date(now).toISOString(),lastHeartbeatAt:new Date(now).toISOString(),leftAt:null,minutes:0};state.sessions.unshift(open);}
  const previous=Date.parse(open.lastHeartbeatAt||open.joinedAt)||now;const added=Math.max(0,Math.min(5,(now-previous)/60000));open.minutes=Number(open.minutes||0)+added;open.lastHeartbeatAt=new Date(now).toISOString();if(event==="leave")open.leftAt=new Date(now).toISOString();
  const total=state.totals[key]||{robloxId:key,username,minutes:0,sessions:0,lastSeenAt:null};total.username=username||total.username;total.minutes=Number(total.minutes||0)+added;if(event==="join"&&added===0)total.sessions=Number(total.sessions||0)+1;total.lastSeenAt=new Date(now).toISOString();state.totals[key]=total;state.sessions=state.sessions.slice(0,10000);saveGameActivity(state);res.json({success:true,activity:total});
});

let activitySyncRunning=false;
let activityLastSyncedAt=null;

async function fetchMessagesSince(channel,since,limit=5000){
  const collected=[];
  let before=null;
  let reachedBoundary=false;

  while(collected.length<limit&&!reachedBoundary){
    const batch=await channel.messages.fetch({
      limit:100,
      ...(before?{before}:{})
    }).catch(()=>null);

    if(!batch||!batch.size)break;

    const values=[...batch.values()];
    before=values[values.length-1]?.id||null;

    for(const message of values){
      if(message.createdAt<since){
        reachedBoundary=true;
        continue;
      }

      collected.push(message);

      if(collected.length>=limit){
        break;
      }
    }

    if(batch.size<100)break;
  }

  return collected;
}

async function syncDiscordCurrentWeek({reason="scheduled"}={}){
  if(activitySyncRunning)return {skipped:true,reason:"already-running"};

  activitySyncRunning=true;

  try{
    const guild=await trackedGuild();

    if(!guild){
      throw new Error("Discord guild is unavailable.");
    }

    const weekStart=startOfCurrentWeek();
    const eligible=await activityChannelsForGuild(guild);

    const stored=readJson(FILES.discordMessages,[]);
    const merged=new Map(stored.map(item=>[String(item.id),item]));

    let scanned=0;
    let addedOrUpdated=0;

    const latestByChannel=new Map();
    for(const item of stored){
      if(!item?.channelId||!item?.createdAt)continue;
      const stamp=new Date(item.createdAt);
      if(stamp<weekStart)continue;
      const previous=latestByChannel.get(String(item.channelId));
      if(!previous||stamp>previous)latestByChannel.set(String(item.channelId),stamp);
    }

    for(const channel of eligible){
      if(!channel?.messages?.fetch)continue;

      const latest=latestByChannel.get(String(channel.id));
      // Normal sync only looks slightly behind the newest stored message.
      // If this channel has no stored activity yet, bootstrap from the last
      // 6 hours instead of rescanning the entire week. "Rebuild" remains the
      // explicit full-week scan.
      const bootstrap=new Date(Date.now()-6*60*60*1000);
      const since=latest
        ? new Date(Math.max(weekStart.getTime(),latest.getTime()-10*60*1000))
        : new Date(Math.max(weekStart.getTime(),bootstrap.getTime()));

      const messages=await fetchMessagesSince(channel,since,750).catch(error=>{
        console.warn(`[Bay Café] Incremental activity sync skipped #${channel.name||channel.id}: ${error.message}`);
        return [];
      });

      scanned+=messages.length;

      for(const message of messages){
        if(!shouldTrackMessage(message))continue;

        const record=await discordRecordResolved(message);
        const previous=merged.get(String(record.id));

        if(
          !previous||
          previous.content!==record.content||
          previous.channelName!==record.channelName||
          JSON.stringify(previous.authorRoleNames||[])!==JSON.stringify(record.authorRoleNames||[])||
          JSON.stringify(previous.authorRoleIds||[])!==JSON.stringify(record.authorRoleIds||[])
        ){
          addedOrUpdated++;
        }

        merged.set(String(record.id),record);
      }
    }

    const sorted=[...merged.values()]
      .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
      .slice(0,30000);

    writeJson(FILES.discordMessages,sorted);

    activityLastSyncedAt=new Date().toISOString();

    broadcast("activity:sync",{
      reason,
      weekStart:weekStart.toISOString(),
      scanned,
      addedOrUpdated,
      totalStored:sorted.length,
      syncedAt:activityLastSyncedAt
    });

    console.log(
      `[Bay Café] Activity sync (${reason}) completed: ${scanned} current-week messages scanned, ${addedOrUpdated} added/updated.`
    );

    return {
      success:true,
      scanned,
      addedOrUpdated,
      totalStored:sorted.length,
      syncedAt:activityLastSyncedAt
    };
  }finally{
    activitySyncRunning=false;
  }
}

async function recoverCurrentWeekIfEmpty({reason="startup-recovery"}={}){
  const weekStart=startOfCurrentWeek();
  const stored=readJson(FILES.discordMessages,[]);
  const currentWeek=stored.filter(item=>new Date(item.createdAt)>=weekStart);

  if(currentWeek.length>0){
    return {recovered:false,messageCount:currentWeek.length,reason:"current-week-data-present"};
  }

  if(activitySyncRunning){
    return {recovered:false,messageCount:0,reason:"sync-already-running"};
  }

  console.warn(`[Bay Café] No current-week Discord activity found. Starting full-week recovery from Monday.`);
  activitySyncRunning=true;

  try{
    const messageCount=await rebuildDiscordHistory();
    activityLastSyncedAt=new Date().toISOString();
    broadcast("activity:recovered",{reason,messageCount,weekStart:weekStart.toISOString(),completedAt:activityLastSyncedAt});
    return {recovered:true,messageCount,reason};
  }finally{
    activitySyncRunning=false;
  }
}

async function backfillDiscord(){
  const recovery=await recoverCurrentWeekIfEmpty({reason:"startup"});
  if(recovery.recovered||recovery.reason==="sync-already-running")return recovery;
  return syncDiscordCurrentWeek({reason:"startup"});
}


const DEFAULT_ACTIVITY_SETTINGS={
  weeklyRequirement:0,
  rankRequirements:{
    "junior corporate":50,
    "senior corporate":75,
    "head corporate":100,
    "junior director":25,
    "senior director":35,
    "head director":50
  },
  updatedAt:null,
  updatedBy:null
};
function getActivitySettings(){
  const saved=readJson(FILES.activitySettings,{});
  return {
    ...DEFAULT_ACTIVITY_SETTINGS,
    ...saved,
    rankRequirements:{
      ...DEFAULT_ACTIVITY_SETTINGS.rankRequirements,
      ...(saved.rankRequirements||{})
    }
  };
}
function activityRequirementFor(user,settings=getActivitySettings()){
  const role=String(user?.roleName||"").trim().toLowerCase();
  const exact=Number(settings.rankRequirements?.[role]);
  return Number.isFinite(exact)?exact:(Number(settings.weeklyRequirement)||0);
}
function saveActivitySettings(next){const value={...DEFAULT_ACTIVITY_SETTINGS,...next};writeJson(FILES.activitySettings,value);return value;}
function isLeadershipOrOwnership(user){return Number(user?.level||0)>=4||["leadership","ownership"].includes(String(user?.tier||"").toLowerCase());}
function archiveCurrentActivity(reason,user){const weekStart=startOfCurrentWeek();const current=readJson(FILES.discordMessages,[]);const thisWeek=current.filter(item=>new Date(item.createdAt)>=weekStart);const archive=readJson(FILES.activityArchive,[]);archive.unshift({id:crypto.randomUUID(),reason:String(reason||"manual"),weekStart:weekStart.toISOString(),archivedAt:new Date().toISOString(),archivedBy:user?.username||"system",messageCount:thisWeek.length,messages:thisWeek});writeJson(FILES.activityArchive,archive.slice(0,20));}
async function fetchRecentMessages(channel,limit=1000){const collected=[];let before;while(collected.length<limit){const batch=await channel.messages.fetch({limit:Math.min(100,limit-collected.length),...(before?{before}:{})}).catch(()=>null);if(!batch||!batch.size)break;const values=[...batch.values()];collected.push(...values);before=values[values.length-1]?.id;if(batch.size<100)break;}return collected;}
async function rebuildDiscordHistory(){
  const guild=await trackedGuild();
  if(!guild)throw new Error("Discord guild is unavailable.");

  const weekStart=startOfCurrentWeek();
  const eligible=await activityChannelsForGuild(guild);

  const previous=readJson(FILES.discordMessages,[]);
  const beforeWeek=previous.filter(
    item=>new Date(item.createdAt)<weekStart
  );

  const merged=new Map();

  for(const ch of eligible){
    if(!ch?.messages?.fetch)continue;

    const messages=await fetchMessagesSince(
      ch,
      weekStart,
      10000
    );

    for(const message of messages){
      if(!shouldTrackMessage(message))continue;
      const record=discordRecord(message);
      merged.set(String(record.id),record);
    }
  }

  const currentWeek=[...merged.values()]
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  const sorted=[...currentWeek,...beforeWeek]
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
    .slice(0,30000);

  writeJson(FILES.discordMessages,sorted);

  broadcast("discord:rebuild",{
    messageCount:currentWeek.length,
    weekStart:weekStart.toISOString(),
    timeZone:"America/New_York"
  });

  return currentWeek.length;
}
function timeZoneOffsetMs(date,timeZone="America/New_York"){
  const formatter=new Intl.DateTimeFormat("en-US",{
    timeZone,
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    hour:"2-digit",
    minute:"2-digit",
    second:"2-digit",
    hourCycle:"h23"
  });

  const parts=Object.fromEntries(
    formatter.formatToParts(date)
      .filter(part=>part.type!=="literal")
      .map(part=>[part.type,part.value])
  );

  const asUTC=Date.UTC(
    Number(parts.year),
    Number(parts.month)-1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return asUTC-date.getTime();
}

function zonedMidnightUTC(year,month,day,timeZone="America/New_York"){
  let guess=new Date(Date.UTC(year,month-1,day,0,0,0));

  // Two passes handles DST boundaries correctly.
  for(let i=0;i<2;i+=1){
    const offset=timeZoneOffsetMs(guess,timeZone);
    guess=new Date(Date.UTC(year,month-1,day,0,0,0)-offset);
  }

  return guess;
}

function startOfCurrentWeek(){
  const timeZone="America/New_York";
  const now=new Date();

  const formatter=new Intl.DateTimeFormat("en-US",{
    timeZone,
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    weekday:"short"
  });

  const parts=Object.fromEntries(
    formatter.formatToParts(now)
      .filter(part=>part.type!=="literal")
      .map(part=>[part.type,part.value])
  );

  const weekdayIndex={
    Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6
  }[parts.weekday];

  const daysSinceMonday=weekdayIndex===0?6:weekdayIndex-1;

  // Work in calendar dates first, then convert Monday midnight in New York to UTC.
  const localDateAsUTC=new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month)-1,
    Number(parts.day)
  ));

  localDateAsUTC.setUTCDate(
    localDateAsUTC.getUTCDate()-daysSinceMonday
  );

  return zonedMidnightUTC(
    localDateAsUTC.getUTCFullYear(),
    localDateAsUTC.getUTCMonth()+1,
    localDateAsUTC.getUTCDate(),
    timeZone
  );
}

function normalizeIdentity(value){
  return String(value||"")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g,"");
}

function messageBelongsToUser(message,user){
  const link=discordLinkForRobloxId(user?.id);
  if(link?.discordId){
    return String(message?.authorId||"")===String(link.discordId);
  }

  const userNames=new Set([
    normalizeIdentity(user?.username),
    normalizeIdentity(user?.displayName)
  ]);

  return [
    normalizeIdentity(message?.authorUsername),
    normalizeIdentity(message?.authorName)
  ].some(value=>value&&userNames.has(value));
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

  const settings=getActivitySettings();
  const weeklyRequirement=activityRequirementFor(req.user,settings);

  res.json({
    success:true,
    weekStart:weekStart.toISOString(),
    messageCount:messages.length,
    weeklyRequirement,
    meetsRequirement:messages.length>=weeklyRequirement,
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



function activityTeamFromDiscordRoles(roleNames=[],roleIds=[]){
  const ids=new Set(
    (Array.isArray(roleIds)?roleIds:[])
      .map(value=>String(value||"").trim())
      .filter(Boolean)
  );

  if(ids.has(DISCORD_GOVERNANCE_ROLE_ID)){
    return "Corporate";
  }

  if(ids.has(DISCORD_MANAGEMENT_ROLE_ID)){
    return "Management";
  }

  const roles=(Array.isArray(roleNames)?roleNames:[])
    .map(value=>String(value||"").trim().toLowerCase());

  const has=values=>roles.some(role=>values.some(value=>role.includes(value)));

  if(has([
    "junior corporate",
    "senior corporate",
    "head corporate",
    "corporate intern",
    "governance"
  ])){
    return "Corporate";
  }

  if(has([
    "junior director",
    "senior director",
    "head director",
    "management"
  ])){
    return "Management";
  }

  if(has([
    "staff assistant",
    "general manager",
    "assistant manager",
    "supervisor",
    "directing team"
  ])){
    return "Directing";
  }

  return null;
}

function activityRequirementFromRoleNames(roleNames=[],settings=getActivitySettings()){
  const roles=(Array.isArray(roleNames)?roleNames:[])
    .map(value=>String(value||"").trim().toLowerCase());

  const exactOrder=[
    "head corporate",
    "senior corporate",
    "junior corporate",
    "head director",
    "senior director",
    "junior director"
  ];

  for(const role of exactOrder){
    if(roles.some(value=>value.includes(role))){
      return Number(settings.rankRequirements?.[role])||0;
    }
  }

  return 0;
}

function activityTeamForRole(roleName=""){
  const name=String(roleName).trim().toLowerCase();

  if(
    ["junior corporate","senior corporate","head corporate","corporate intern"]
      .some(value=>name.includes(value))
  ){
    return "Corporate";
  }

  if(
    ["junior director","senior director","head director","management"]
      .some(value=>name.includes(value))
  ){
    return "Management";
  }

  if(
    ["staff assistant","general manager","assistant manager","supervisor"]
      .some(value=>name.includes(value))
  ){
    return "Directing";
  }

  return null;
}

function disciplinaryTeamForRole(roleName=""){
  const team=activityTeamForRole(roleName);
  return ["Corporate","Management","Directing"].includes(team)?team:null;
}

async function disciplinaryEligibleDirectory(){
  let directory=[];
  try{
    directory=await bayCafeDirectory({allowStale:true});
  }catch{}
  const links=readLinkState().links||[];
  return directory
    .filter(member=>Boolean(disciplinaryTeamForRole(member.roleName)))
    .map(member=>({
      ...member,
      team:disciplinaryTeamForRole(member.roleName),
      activeStrikes:activeStrikesFor(member.id),
      linked:links.some(link=>String(link.robloxId)===String(member.id))
    }));
}




let activityRosterCache={at:0,members:[]};

async function currentTrackedDiscordRoster(){
  const now=Date.now();
  if(now-activityRosterCache.at<60_000&&activityRosterCache.members.length){
    return activityRosterCache.members;
  }

  const guild=await trackedGuild().catch(()=>null);
  if(!guild)return activityRosterCache.members||[];

  // Fetch the guild member roster once, then filter to the three teams.
  // This is what keeps zero-message team members visible in Activity Management.
  const fetched=await guild.members.fetch().catch(()=>null);
  const source=fetched?[...fetched.values()]:[...guild.members.cache.values()];

  const members=source
    .filter(member=>member&&!member.user?.bot)
    .map(member=>{
      const roles=[...member.roles.cache.values()]
        .filter(role=>role&&role.name!=="@everyone");
      const roleNames=roles.map(role=>role.name);
      const roleIds=roles.map(role=>String(role.id));
      const team=activityTeamFromDiscordRoles(roleNames,roleIds);
      if(!team)return null;

      return {
        discordId:String(member.id),
        username:member.user?.username||"",
        displayName:member.displayName||member.user?.globalName||member.user?.username||"",
        avatar:member.displayAvatarURL?.({size:128})||member.user?.displayAvatarURL?.({size:128})||"",
        roleNames,
        roleIds,
        team
      };
    })
    .filter(Boolean);

  activityRosterCache={at:now,members};
  return members;
}

async function enrichActivityMessagesWithMemberRoles(messages){
  const guild=await trackedGuild().catch(()=>null);
  if(!guild)return messages;

  const authorIds=[
    ...new Set(
      messages
        .map(message=>String(message.authorId||""))
        .filter(Boolean)
    )
  ];

  const memberMap=new Map();

  for(const authorId of authorIds){
    const member=await guild.members.fetch(authorId).catch(()=>null);
    if(member)memberMap.set(authorId,member);
  }

  let changed=false;

  const enriched=messages.map(message=>{
    const member=memberMap.get(String(message.authorId||""));
    if(!member)return message;

    const roles=[...member.roles.cache.values()]
      .filter(role=>role&&role.name!=="@everyone");

    const roleNames=roles.map(role=>role.name);
    const roleIds=roles.map(role=>String(role.id));

    if(
      JSON.stringify(message.authorRoleNames||[])!==JSON.stringify(roleNames)||
      JSON.stringify(message.authorRoleIds||[])!==JSON.stringify(roleIds)||
      message.authorName!==member.displayName
    ){
      changed=true;
      return {
        ...message,
        authorName:member.displayName||message.authorName,
        authorRoleNames:roleNames,
        authorRoleIds:roleIds
      };
    }

    return message;
  });

  if(changed){
    const all=readJson(FILES.discordMessages,[]);
    const replacements=new Map(enriched.map(item=>[String(item.id),item]));

    writeJson(
      FILES.discordMessages,
      all.map(item=>replacements.get(String(item.id))||item)
    );
  }

  return enriched;
}

app.get("/api/activity/admin",auth,async(req,res)=>{
  if(!isLeadershipOrOwnership(req.user)){
    return res.status(403).json({
      success:false,
      message:"Leadership or Ownership access required."
    });
  }

  const weekStart=startOfCurrentWeek();
  const all=readJson(FILES.discordMessages,[]);
  let thisWeek=all
    .filter(item=>new Date(item.createdAt)>=weekStart)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  thisWeek=await enrichActivityMessagesWithMemberRoles(thisWeek);

  const settings=getActivitySettings();
  const archive=readJson(FILES.activityArchive,[]);

  let directory=[];
  let directoryWarning="";

  try{
    directory=await bayCafeDirectory({allowStale:true});
  }catch(error){
    directoryWarning=
      "Roblox staff directory is temporarily unavailable. Discord activity is still being tracked.";
    console.error(`[Bay Café] Activity Management directory error: ${error.message}`);
  }

  /*
   * Message ownership is now based ONLY on Discord authorId.
   *
   * The previous implementation tried to connect Discord messages to Roblox
   * members using username/display-name text. That could assign somebody's
   * messages to the wrong person when names were similar or changed.
   *
   * We now group every tracked message by the immutable Discord user ID first.
   * Roblox data is only used as optional profile/rank decoration when the
   * Discord username exactly matches a Roblox username.
   */
  const directoryByUsername=new Map();
  const linkState=readLinkState();
  const directoryByRobloxId=new Map(
    directory.map(member=>[String(member.id),member])
  );
  const robloxByDiscordId=new Map(
    (linkState.links||[])
      .filter(link=>link?.discordId&&link?.robloxId)
      .map(link=>[String(link.discordId),directoryByRobloxId.get(String(link.robloxId))||null])
  );

  for(const member of directory){
    const username=String(member.username||"").trim().toLowerCase();
    if(username&&!directoryByUsername.has(username)){
      directoryByUsername.set(username,member);
    }
  }

  const discordAuthors=new Map();

  for(const message of thisWeek){
    const authorId=String(message.authorId||"").trim();
    if(!authorId)continue;

    const current=discordAuthors.get(authorId)||{
      authorId,
      authorUsername:message.authorUsername||"",
      authorName:message.authorName||message.authorUsername||"",
      authorAvatar:message.authorAvatar||"",
      roleNames:[],
      roleIds:[],
      messages:[]
    };

    current.authorUsername=message.authorUsername||current.authorUsername;
    current.authorName=message.authorName||current.authorName;
    current.authorAvatar=message.authorAvatar||current.authorAvatar;

    if(Array.isArray(message.authorRoleNames)&&message.authorRoleNames.length){
      current.roleNames=message.authorRoleNames;
    }

    if(Array.isArray(message.authorRoleIds)&&message.authorRoleIds.length){
      current.roleIds=message.authorRoleIds;
    }

    current.messages.push(message);
    discordAuthors.set(authorId,current);
  }

  // Add the complete live Discord roster for Corporate, Management, and
  // Directing before building the response. This ensures members with ZERO
  // messages still appear and avoids relying only on Roblox-name matching.
  const liveRoster=await currentTrackedDiscordRoster();

  for(const rosterMember of liveRoster){
    const authorId=String(rosterMember.discordId);
    const current=discordAuthors.get(authorId)||{
      authorId,
      authorUsername:rosterMember.username,
      authorName:rosterMember.displayName,
      authorAvatar:rosterMember.avatar,
      roleNames:rosterMember.roleNames,
      roleIds:rosterMember.roleIds,
      messages:[]
    };

    current.authorUsername=rosterMember.username||current.authorUsername;
    current.authorName=rosterMember.displayName||current.authorName;
    current.authorAvatar=rosterMember.avatar||current.authorAvatar;
    current.roleNames=rosterMember.roleNames;
    current.roleIds=rosterMember.roleIds;
    discordAuthors.set(authorId,current);
  }

  const members=[];
  const matchedRobloxIds=new Set();

  for(const author of discordAuthors.values()){
    const exactRobloxMatch=
      robloxByDiscordId.get(String(author.authorId))||
      directoryByUsername.get(
        String(author.authorUsername||"").trim().toLowerCase()
      )||
      null;

    const teamFromDiscord=activityTeamFromDiscordRoles(author.roleNames,author.roleIds);
    const teamFromRoblox=exactRobloxMatch
      ? activityTeamForRole(exactRobloxMatch.roleName)
      : null;

    const team=teamFromDiscord||teamFromRoblox;
    if(!team)continue;

    if(exactRobloxMatch){
      matchedRobloxIds.add(String(exactRobloxMatch.id));
    }

    const roleName=
      exactRobloxMatch?.roleName||
      author.roleNames.find(role=>
        activityTeamFromDiscordRoles([role],[])===team
      )||
      `${team} Team`;

    const requirement=exactRobloxMatch
      ? activityRequirementFor({roleName:exactRobloxMatch.roleName},settings)
      : activityRequirementFromRoleNames(author.roleNames,settings);

    const authorMessages=[...author.messages]
      .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

    members.push({
      id:author.authorId,
      discordId:author.authorId,
      robloxId:exactRobloxMatch?.id||null,
      username:author.authorUsername,
      displayName:author.authorName,
      robloxUsername:exactRobloxMatch?.username||"",
      roleName,
      roleRank:exactRobloxMatch?.roleRank||0,
      team,
      messageCount:authorMessages.length,
      requirement,
      meetsRequirement:authorMessages.length>=requirement,
      avatar:author.authorAvatar,
      discordRoleNames:author.roleNames,
      discordRoleIds:author.roleIds,
      matchedBy:exactRobloxMatch?"exact-username":"discord-id",
      messages:authorMessages.slice(0,500).map(message=>({
        id:message.id,
        channelId:message.channelId,
        channelName:message.channelName,
        content:message.content,
        createdAt:message.createdAt,
        url:message.url
      }))
    });
  }

  /*
   * Preserve zero-message Roblox members so Leadership can still see the whole
   * Corporate / Management / Directing roster. We do NOT attach messages to
   * these entries by display-name guessing.
   */
  for(const member of directory){
    const team=activityTeamForRole(member.roleName);
    if(!team)continue;
    if(matchedRobloxIds.has(String(member.id)))continue;

    const requirement=activityRequirementFor(
      {roleName:member.roleName},
      settings
    );

    members.push({
      id:`roblox-${member.id}`,
      discordId:"",
      robloxId:member.id,
      username:member.username,
      displayName:member.displayName,
      robloxUsername:member.username,
      roleName:member.roleName,
      roleRank:member.roleRank,
      team,
      messageCount:0,
      requirement,
      meetsRequirement:requirement===0,
      avatar:"",
      discordRoleNames:[],
      discordRoleIds:[],
      matchedBy:"roblox-directory",
      messages:[]
    });
  }

  for(const member of members){
    const robloxId=member.robloxId||null;
    member.loa=robloxId?activeLoaFor(robloxId):null;
  }

  members.sort((a,b)=>{
    const teamOrder={Corporate:0,Management:1,Directing:2};
    const teamDiff=(teamOrder[a.team]??9)-(teamOrder[b.team]??9);
    if(teamDiff)return teamDiff;

    if((b.messageCount||0)!==(a.messageCount||0)){
      return (b.messageCount||0)-(a.messageCount||0);
    }

    if((b.roleRank||0)!==(a.roleRank||0)){
      return (b.roleRank||0)-(a.roleRank||0);
    }

    return String(a.username||"").localeCompare(String(b.username||""));
  });

  // Always return the page data even if Roblox's public group API is having a
  // temporary problem. This prevents the whole Activity Management screen from
  // failing with Request failed (400).
  res.json({
    success:true,
    weekStart:weekStart.toISOString(),
    totalTracked:all.length,
    thisWeekTracked:thisWeek.length,
    settings,
    sync:{
      lastSyncedAt:activityLastSyncedAt,
      running:activitySyncRunning,
      intervalSeconds:60,
      weekTimeZone:"America/New_York",
      identityMode:"discord-author-id",
      governanceRoleId:DISCORD_GOVERNANCE_ROLE_ID,
      managementRoleId:DISCORD_MANAGEMENT_ROLE_ID,
      trackedChannelMode:TRACK_CHANNEL_IDS.size?"configured-channels-and-threads":"all-visible-text-channels"
    },
    directory:{
      available:directory.length>0,
      warning:directoryWarning,
      cached:readJson(FILES.staffDirectory,{members:[]}).members?.length>0
    },
    storage:{
      directory:DATA_DIRECTORY,
      messageFileExists:fs.existsSync(FILES.discordMessages),
      persistentPath:DATA_DIRECTORY.startsWith("/data")
    },
    members,
    teamTotals:{
      Corporate:members.filter(item=>item.team==="Corporate").length,
      Management:members.filter(item=>item.team==="Management").length,
      Directing:members.filter(item=>item.team==="Directing").length
    },
    recentArchives:archive.slice(0,5).map(item=>({
      id:item.id,
      reason:item.reason,
      archivedAt:item.archivedAt,
      archivedBy:item.archivedBy,
      messageCount:item.messageCount
    }))
  });
});
app.put("/api/activity/settings",auth,(req,res)=>{
  if(!isLeadershipOrOwnership(req.user)){
    return res.status(403).json({success:false,message:"Leadership or Ownership access required."});
  }
  const current=getActivitySettings();
  const incoming=req.body.rankRequirements&&typeof req.body.rankRequirements==="object"?req.body.rankRequirements:{};
  const roles=["junior corporate","senior corporate","head corporate","junior director","senior director","head director"];
  const rankRequirements={...current.rankRequirements};
  for(const role of roles){
    if(incoming[role]!==undefined){
      rankRequirements[role]=Math.max(0,Math.min(10000,Number(incoming[role])||0));
    }
  }
  const settings=saveActivitySettings({
    weeklyRequirement:Math.max(0,Math.min(10000,Number(req.body.weeklyRequirement)||0)),
    rankRequirements,
    updatedAt:new Date().toISOString(),
    updatedBy:req.user.username
  });
  broadcast("activity:settings",settings);
  res.json({success:true,settings});
});
app.post("/api/activity/sync",auth,async(req,res)=>{
  if(!isLeadershipOrOwnership(req.user)){
    return res.status(403).json({
      success:false,
      message:"Leadership or Ownership access required."
    });
  }

  try{
    const result=await syncDiscordCurrentWeek({reason:"manual"});
    res.json({success:true,...result});
  }catch(error){
    res.status(400).json({
      success:false,
      message:error.message||"Unable to sync current-week Discord activity."
    });
  }
});

app.post("/api/activity/rebuild",auth,async(req,res)=>{
  if(!isLeadershipOrOwnership(req.user)){
    return res.status(403).json({
      success:false,
      message:"Leadership or Ownership access required."
    });
  }

  if(activitySyncRunning){
    return res.status(409).json({
      success:false,
      message:"Activity is already syncing. Wait a moment and try again."
    });
  }

  activitySyncRunning=true;

  try{
    const before=readJson(FILES.discordMessages,[]);
    const weekStart=startOfCurrentWeek();
    const beforeWeek=before.filter(item=>new Date(item.createdAt)<weekStart);
    const oldThisWeek=before.length-beforeWeek.length;

    // Clear current-week records first so this is a real rebuild, not just a merge.
    writeJson(FILES.discordMessages,beforeWeek);

    const messageCount=await rebuildDiscordHistory();

    activityLastSyncedAt=new Date().toISOString();

    const after=readJson(FILES.discordMessages,[]);
    const afterThisWeek=after.filter(item=>new Date(item.createdAt)>=weekStart).length;

    broadcast("activity:rebuild",{
      weekStart:weekStart.toISOString(),
      oldThisWeek,
      afterThisWeek,
      rebuiltMessages:messageCount,
      completedAt:activityLastSyncedAt
    });

    return res.json({
      success:true,
      messageCount,
      oldThisWeek,
      afterThisWeek,
      weekStart:weekStart.toISOString(),
      completedAt:activityLastSyncedAt
    });
  }catch(error){
    console.error(`[Bay Café] Activity rebuild failed: ${error.stack||error.message}`);

    return res.status(500).json({
      success:false,
      message:error.message||"Unable to rebuild activity."
    });
  }finally{
    activitySyncRunning=false;
  }
});
app.post("/api/activity/recover",auth,async(req,res)=>{
  if(!isLeadershipOrOwnership(req.user)){
    return res.status(403).json({success:false,message:"Leadership or Ownership access required."});
  }
  if(activitySyncRunning){
    return res.status(409).json({success:false,message:"Activity is already syncing. Wait for it to finish."});
  }

  activitySyncRunning=true;
  try{
    const weekStart=startOfCurrentWeek();
    const existing=readJson(FILES.discordMessages,[]);
    const beforeWeek=existing.filter(item=>new Date(item.createdAt)<weekStart);
    const guild=await trackedGuild();
    if(!guild)throw new Error("Discord guild is unavailable.");

    const eligible=await activityChannelsForGuild(guild);
    const merged=new Map();

    for(const channel of eligible){
      if(!channel?.messages?.fetch)continue;
      const messages=await fetchMessagesSince(channel,weekStart,10000).catch(error=>{
        console.warn(`[Bay Café] Recovery skipped #${channel.name||channel.id}: ${error.message}`);
        return [];
      });

      for(const message of messages){
        if(!shouldTrackMessage(message))continue;
        const record=await discordRecordResolved(message);
        merged.set(String(record.id),record);
      }
    }

    const currentWeek=[...merged.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    const sorted=[...currentWeek,...beforeWeek]
      .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
      .slice(0,30000);

    writeJson(FILES.discordMessages,sorted);
    activityLastSyncedAt=new Date().toISOString();

    broadcast("activity:recovered",{
      reason:"manual",
      messageCount:currentWeek.length,
      weekStart:weekStart.toISOString(),
      completedAt:activityLastSyncedAt
    });

    res.json({
      success:true,
      messageCount:currentWeek.length,
      weekStart:weekStart.toISOString(),
      completedAt:activityLastSyncedAt
    });
  }catch(error){
    console.error(`[Bay Café] Activity recovery failed: ${error.stack||error.message}`);
    res.status(500).json({success:false,message:error.message||"Unable to recover activity."});
  }finally{
    activitySyncRunning=false;
  }
});

app.post("/api/activity/reset",auth,(req,res)=>{if(!isLeadershipOrOwnership(req.user))return res.status(403).json({success:false,message:"Leadership or Ownership access required."});archiveCurrentActivity("manual reset",req.user);const weekStart=startOfCurrentWeek();const all=readJson(FILES.discordMessages,[]);writeJson(FILES.discordMessages,all.filter(item=>new Date(item.createdAt)<weekStart));broadcast("activity:reset",{weekStart:weekStart.toISOString()});res.json({success:true});});


function normalizeBirthdayDate(value){
  const text=String(value||"").trim();
  if(!/^\d{2}-\d{2}$/.test(text))return null;
  const [month,day]=text.split("-").map(Number);
  const probe=new Date(Date.UTC(2024,month-1,day));
  if(probe.getUTCMonth()!==month-1||probe.getUTCDate()!==day)return null;
  return text;
}
function birthdaySortKey(dateText){
  const [month,day]=String(dateText||"01-01").split("-").map(Number);
  const now=new Date();
  const year=now.getUTCFullYear();
  const today=Date.UTC(year,now.getUTCMonth(),now.getUTCDate());
  let target=Date.UTC(year,month-1,day);
  if(target<today)target=Date.UTC(year+1,month-1,day);
  return target;
}
function publicBirthday(item){
  return {id:item.id,name:item.name,username:item.username||"",date:item.date,note:item.note||"",createdAt:item.createdAt,createdBy:item.createdBy};
}
app.get("/api/birthdays",(_req,res)=>{
  const birthdays=readJson(FILES.birthdays,[])
    .filter(item=>normalizeBirthdayDate(item.date))
    .sort((a,b)=>birthdaySortKey(a.date)-birthdaySortKey(b.date));
  const now=new Date();
  const today=`${String(now.getUTCMonth()+1).padStart(2,"0")}-${String(now.getUTCDate()).padStart(2,"0")}`;
  res.json({
    success:true,
    today,
    todayBirthdays:birthdays.filter(item=>item.date===today).map(publicBirthday),
    birthdays:birthdays.map(publicBirthday)
  });
});

app.post("/api/birthdays/self",(req,res)=>{
  const name=String(req.body.name||"").trim().slice(0,80);
  const username=String(req.body.username||"").replace(/^@/,"").trim().slice(0,80);
  const date=normalizeBirthdayDate(req.body.date);
  const note=String(req.body.note||"").trim().slice(0,160);

  if(!name)return res.status(400).json({success:false,message:"Enter your display name."});
  if(!username)return res.status(400).json({success:false,message:"Enter your Roblox username."});
  if(!date)return res.status(400).json({success:false,message:"Enter a valid birthday."});

  const items=readJson(FILES.birthdays,[]);
  const matchIndex=items.findIndex(item=>
    String(item.username||"").trim().toLowerCase()===username.toLowerCase()
  );

  const now=new Date().toISOString();

  const birthday={
    id:matchIndex>=0?items[matchIndex].id:crypto.randomUUID(),
    name,
    username,
    date,
    note,
    createdAt:matchIndex>=0?(items[matchIndex].createdAt||now):now,
    createdBy:matchIndex>=0?(items[matchIndex].createdBy||"Community self-entry"):"Community self-entry",
    updatedAt:now,
    selfSubmitted:true
  };

  if(matchIndex>=0)items[matchIndex]=birthday;
  else items.push(birthday);

  writeJson(FILES.birthdays,items);
  broadcast("birthday:update",publicBirthday(birthday));

  res.status(matchIndex>=0?200:201).json({
    success:true,
    birthday:publicBirthday(birthday),
    updated:matchIndex>=0
  });
});

app.post("/api/birthdays",auth,(req,res)=>{
  if(!isLeadershipOrOwnership(req.user))return res.status(403).json({success:false,message:"Leadership or Ownership access required."});
  const name=String(req.body.name||"").trim().slice(0,80);
  const username=String(req.body.username||"").trim().slice(0,80);
  const date=normalizeBirthdayDate(req.body.date);
  const note=String(req.body.note||"").trim().slice(0,300);
  if(!name)return res.status(400).json({success:false,message:"Enter a birthday name."});
  if(!date)return res.status(400).json({success:false,message:"Enter a valid birthday date."});
  const items=readJson(FILES.birthdays,[]);
  const birthday={id:crypto.randomUUID(),name,username,date,note,createdAt:new Date().toISOString(),createdBy:req.user.username};
  items.push(birthday);
  writeJson(FILES.birthdays,items);
  broadcast("birthday:update",publicBirthday(birthday));
  res.status(201).json({success:true,birthday:publicBirthday(birthday)});
});
app.delete("/api/birthdays/:id",auth,(req,res)=>{
  if(!isLeadershipOrOwnership(req.user))return res.status(403).json({success:false,message:"Leadership or Ownership access required."});
  const items=readJson(FILES.birthdays,[]);
  if(!items.some(item=>String(item.id)===String(req.params.id)))return res.status(404).json({success:false,message:"Birthday not found."});
  writeJson(FILES.birthdays,items.filter(item=>String(item.id)!==String(req.params.id)));
  broadcast("birthday:delete",{id:req.params.id});
  res.json({success:true});
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

app.get("/api/applications",auth,(req,res)=>{
  if(!canManageApplications(req.user)){
    return res.status(403).json({
      success:false,
      message:"Leadership or Ownership access is required to manage applications."
    });
  }

  const items=readApplications()
    .sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));

  res.json({
    success:true,
    applications:items.map(publicApplication),
    storage:{
      intentionalEmpty:fs.existsSync(APPLICATION_EMPTY_INTENT_FILE),
      hasPrimary:fs.existsSync(FILES.applications),
      backupCount:applicationBackupFiles().length
    }
  });
});

app.post("/api/applications/restore",auth,(req,res)=>{
  if(!canManageApplications(req.user)){
    return res.status(403).json({
      success:false,
      message:"Leadership or Ownership access is required to restore applications."
    });
  }

  const raw=Array.isArray(req.body.applications)?req.body.applications:[];

  const restored=raw
    .filter(item=>item&&typeof item==="object")
    .map(item=>({
      id:String(item.id||crypto.randomUUID()),
      title:String(item.title||"").trim().slice(0,100),
      description:String(item.description||"").trim().slice(0,3000),
      status:String(item.status||"open").toLowerCase()==="closed"?"closed":"open",
      questions:cleanQuestions(item.questions),
      createdAt:item.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      createdBy:item.createdBy||req.user.username,
      updatedBy:req.user.username
    }))
    .filter(item=>item.title)
    .slice(0,100);

  if(!restored.length){
    return res.status(400).json({
      success:false,
      message:"No valid applications were provided for restore."
    });
  }

  saveApplications(restored,"browser-restore");
  try{fs.unlinkSync(APPLICATION_EMPTY_INTENT_FILE)}catch{}

  broadcast("application:update",{
    action:"restored",
    count:restored.length
  });

  res.json({
    success:true,
    applications:restored.map(publicApplication)
  });
});

app.get("/api/careers",(_req,res)=>{
  const items=readApplications()
    .filter(item=>String(item.status||"closed").toLowerCase()==="open")
    .sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));

  res.json({
    success:true,
    careers:items.map(publicApplication)
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

  if(!title){
    return res.status(400).json({
      success:false,
      message:"Enter an application title."
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

  const items=readApplications();
  items.unshift(application);
  saveApplications(items,"update");

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

  const items=readApplications();
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

  if(!title){
    return res.status(400).json({
      success:false,
      message:"Enter an application title."
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
  saveApplications(items,"edit");

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

  const items=readApplications();
  const application=items.find(item=>String(item.id)===String(req.params.id));

  if(!application){
    return res.status(404).json({
      success:false,
      message:"Application not found."
    });
  }

  saveApplications(
    items.filter(item=>String(item.id)!==String(req.params.id)),
    "delete"
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

app.get("/api/announcements",async(_req,res)=>{
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


function publicSubmission(item){
  return {
    id:item.id,
    applicationId:item.applicationId,
    applicationTitle:item.applicationTitle,
    applicant:item.applicant,
    answers:Array.isArray(item.answers)?item.answers:[],
    status:item.status||"pending",
    submittedAt:item.submittedAt
  };
}

app.post("/api/careers/:id/apply",auth,(req,res)=>{
  const applications=readApplications();
  const application=applications.find(item=>String(item.id)===String(req.params.id));

  if(!application){
    return res.status(404).json({success:false,message:"Application not found."});
  }

  if(String(application.status||"closed").toLowerCase()!=="open"){
    return res.status(400).json({success:false,message:"This application is currently closed."});
  }

  const questions=Array.isArray(application.questions)?application.questions:[];
  const rawAnswers=Array.isArray(req.body.answers)?req.body.answers:[];
  const answers=questions.map((question,index)=>({
    question,
    answer:String(rawAnswers[index]||"").trim().slice(0,3000)
  }));

  if(questions.length&&answers.some(item=>!item.answer)){
    return res.status(400).json({success:false,message:"Please answer every application question."});
  }

  const submissions=readJson(FILES.applicationSubmissions,[]);
  const duplicate=submissions.some(item=>
    String(item.applicationId)===String(application.id)&&
    String(item.applicant?.id)===String(req.user.id)
  );

  if(duplicate){
    return res.status(409).json({success:false,message:"You already submitted this application."});
  }

  const submission={
    id:crypto.randomUUID(),
    applicationId:application.id,
    applicationTitle:application.title,
    applicant:{
      id:req.user.id,
      username:req.user.username,
      displayName:req.user.displayName,
      avatar:req.user.avatar,
      roleName:req.user.roleName
    },
    answers,
    status:"pending",
    submittedAt:new Date().toISOString()
  };

  submissions.unshift(submission);
  writeJson(FILES.applicationSubmissions,submissions);
  broadcast("application:submission",publicSubmission(submission));

  res.status(201).json({success:true,submission:publicSubmission(submission)});
});

app.get("/api/application-submissions",auth,(req,res)=>{
  if(!canManageApplications(req.user)){
    return res.status(403).json({
      success:false,
      message:"Leadership or Ownership access is required to view submissions."
    });
  }

  const submissions=readJson(FILES.applicationSubmissions,[])
    .sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt));

  res.json({success:true,submissions:submissions.map(publicSubmission)});
});

function publicTicket(ticket){return {...ticket,messages:Array.isArray(ticket.messages)?ticket.messages:[]};}

const communitySupportRate=new Map();

function communitySupportTokenHash(ticketId,token){
  return sign(`community-support:${ticketId}:${token}`);
}

function communitySupportTicketByAccess(ticketId,token){
  const items=readJson(FILES.tickets,[]);
  const ticket=items.find(item=>String(item.id)===String(ticketId));

  if(!ticket||ticket.source!=="community"||!ticket.publicAccessHash){
    return {items,ticket:null};
  }

  if(!safeSignatureMatches(
    `community-support:${ticket.id}:${String(token||"")}`,
    ticket.publicAccessHash
  )){
    return {items,ticket:null};
  }

  return {items,ticket};
}

function communitySupportRateKey(req){
  return String(
    req.headers["cf-connecting-ip"]||
    req.headers["x-forwarded-for"]||
    req.socket?.remoteAddress||
    "unknown"
  ).split(",")[0].trim();
}

app.post("/api/community/support",async(req,res)=>{
  try{
    const rateKey=communitySupportRateKey(req);
    const last=Number(communitySupportRate.get(rateKey)||0);

    if(Date.now()-last<60_000){
      return res.status(429).json({
        success:false,
        message:"Please wait a minute before opening another support request."
      });
    }

    const name=String(req.body.name||"").trim().slice(0,80);
    const robloxUsername=String(req.body.robloxUsername||"").replace(/^@/,"").trim().slice(0,80);
    const discordUsername=String(req.body.discordUsername||"").replace(/^@/,"").trim().slice(0,80);
    const type=String(req.body.type||"General Support").trim().slice(0,50);
    const subject=String(req.body.subject||"").trim().slice(0,100);
    const details=String(req.body.details||"").trim().slice(0,1800);

    if(name.length<2)return res.status(400).json({success:false,message:"Enter your name."});
    if(!discordUsername)return res.status(400).json({success:false,message:"Enter your Discord username so Support can contact you."});
    if(subject.length<3||details.length<5)return res.status(400).json({success:false,message:"Add a subject and details."});

    const now=new Date().toISOString();
    const ticketId=crypto.randomUUID();
    const publicAccessToken=crypto.randomBytes(24).toString("base64url");
    const ticket={
      id:ticketId,
      publicAccessHash:communitySupportTokenHash(ticketId,publicAccessToken),
      userId:`community:${crypto.randomUUID()}`,
      username:robloxUsername||discordUsername,
      displayName:name,
      roleName:"Community",
      discordUsername,
      type,
      subject,
      status:"open",
      createdAt:now,
      updatedAt:now,
      discordThreadId:"",
      source:"community",
      messages:[{
        id:crypto.randomUUID(),
        authorType:"user",
        authorId:"community",
        authorDisplayName:name,
        authorUsername:robloxUsername||discordUsername,
        content:details,
        createdAt:now
      }]
    };

    const channel=await ticketChannel();

    if(channel?.isTextBased()){
      const fields=[
        {name:"Submitted by",value:name,inline:true},
        {name:"Discord",value:`@${discordUsername}`,inline:true},
        {name:"Type",value:type,inline:true}
      ];

      if(robloxUsername){
        fields.push({name:"Roblox",value:`@${robloxUsername}`,inline:true});
      }

      const sent=await channel.send({
        content:DISCORD_SUPPORT_ROLE_ID?`<@&${DISCORD_SUPPORT_ROLE_ID}>`:undefined,
        embeds:[
          new EmbedBuilder()
            .setColor(0x38bdf8)
            .setTitle(`Community Support • ${subject}`)
            .setDescription(details)
            .addFields(fields)
            .setFooter({text:`Ticket ${ticket.id}`})
            .setTimestamp()
        ]
      });

      if(sent?.startThread){
        const thread=await sent.startThread({
          name:`community-${discordUsername}-${subject}`
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g,"-")
            .slice(0,90),
          autoArchiveDuration:1440,
          reason:`Bay Café community support ${ticket.id}`
        }).catch(()=>null);

        if(thread){
          ticket.discordThreadId=thread.id;
          await thread.send(
            `Contact this community member on Discord: **@${discordUsername}**${robloxUsername?`\nRoblox: **@${robloxUsername}**`:""}`
          ).catch(()=>null);
        }
      }
    }

    const items=readJson(FILES.tickets,[]);
    items.unshift(ticket);
    writeJson(FILES.tickets,items);
    broadcast("ticket:update",publicTicket(ticket));
    communitySupportRate.set(rateKey,Date.now());

    res.status(201).json({
      success:true,
      ticketId:ticket.id,
      accessToken:publicAccessToken,
      ticket:{
        id:ticket.id,
        type:ticket.type,
        subject:ticket.subject,
        status:ticket.status,
        createdAt:ticket.createdAt,
        updatedAt:ticket.updatedAt,
        messages:ticket.messages
      },
      message:"Your support request was sent to Bay Café Support."
    });
  }catch(error){
    res.status(400).json({
      success:false,
      message:error.message||"Unable to send your support request."
    });
  }
});


app.get("/api/community/support/:ticketId",(req,res)=>{
  const token=String(req.query.key||"");
  const {ticket}=communitySupportTicketByAccess(req.params.ticketId,token);

  if(!ticket){
    return res.status(404).json({
      success:false,
      message:"Support ticket not found on this device."
    });
  }

  res.json({
    success:true,
    ticket:{
      id:ticket.id,
      type:ticket.type,
      subject:ticket.subject,
      status:ticket.status,
      createdAt:ticket.createdAt,
      updatedAt:ticket.updatedAt,
      closedAt:ticket.closedAt||null,
      messages:Array.isArray(ticket.messages)?ticket.messages:[]
    }
  });
});

app.post("/api/community/support/:ticketId/messages",async(req,res)=>{
  const token=String(req.body.key||"");
  const content=String(req.body.content||"").trim().slice(0,1800);
  const {items,ticket}=communitySupportTicketByAccess(req.params.ticketId,token);

  if(!ticket){
    return res.status(404).json({
      success:false,
      message:"Support ticket not found on this device."
    });
  }

  if(ticket.status==="closed"){
    return res.status(400).json({
      success:false,
      message:"This support ticket is closed."
    });
  }

  if(!content){
    return res.status(400).json({
      success:false,
      message:"Write a message first."
    });
  }

  const message={
    id:crypto.randomUUID(),
    authorType:"user",
    authorId:"community",
    authorDisplayName:ticket.displayName||"Community Member",
    authorUsername:ticket.discordUsername||ticket.username||"community",
    content,
    createdAt:new Date().toISOString()
  };

  ticket.messages??=[];
  ticket.messages.push(message);
  ticket.updatedAt=new Date().toISOString();

  if(ticket.discordThreadId&&discordClient?.isReady()){
    const thread=await discordClient.channels.fetch(ticket.discordThreadId).catch(()=>null);

    if(thread?.isTextBased()){
      await thread.send({
        embeds:[
          new EmbedBuilder()
            .setColor(0x38bdf8)
            .setAuthor({name:`${message.authorDisplayName} • Community Website`})
            .setDescription(content)
            .setTimestamp()
        ]
      }).catch(()=>null);
    }
  }

  writeJson(FILES.tickets,items);
  broadcast("ticket:update",publicTicket(ticket));

  res.json({
    success:true,
    ticket:{
      id:ticket.id,
      type:ticket.type,
      subject:ticket.subject,
      status:ticket.status,
      createdAt:ticket.createdAt,
      updatedAt:ticket.updatedAt,
      messages:ticket.messages
    }
  });
});

app.post("/api/community/support/:ticketId/close",async(req,res)=>{
  const token=String(req.body.key||"");
  const {items,ticket}=communitySupportTicketByAccess(req.params.ticketId,token);

  if(!ticket){
    return res.status(404).json({
      success:false,
      message:"Support ticket not found on this device."
    });
  }

  if(ticket.status!=="closed"){
    ticket.status="closed";
    ticket.closedAt=new Date().toISOString();
    ticket.updatedAt=ticket.closedAt;

    if(ticket.discordThreadId&&discordClient?.isReady()){
      const thread=await discordClient.channels.fetch(ticket.discordThreadId).catch(()=>null);

      if(thread?.isThread?.()){
        await thread.send("Community user closed this ticket from the website.").catch(()=>null);
        await thread.setLocked(true,"Community ticket closed").catch(()=>null);
        await thread.setArchived(true,"Community ticket closed").catch(()=>null);
      }
    }

    writeJson(FILES.tickets,items);
    broadcast("ticket:update",publicTicket(ticket));
  }

  res.json({
    success:true,
    ticket:{
      id:ticket.id,
      status:ticket.status,
      closedAt:ticket.closedAt||null
    }
  });
});

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
    );
    await backfillDiscord().catch(e=>console.error(`[Bay Café] Discord backfill failed: ${e.message}`));

    setInterval(()=>{
      syncDiscordCurrentWeek({reason:"scheduled"})
        .catch(e=>console.error(`[Bay Café] Scheduled activity sync failed: ${e.message}`));
    },60_000);
  });discordClient.on("messageCreate",async message=>{if(!message.guildId)return;const guild=await trackedGuild();if(guild&&message.guildId!==guild.id)return;

    if(!message.author?.bot&&String(message.content||"").trim().toLowerCase()===",login"){
      cleanupMobileLoginChallenges();

      const pending=[...mobileLoginChallenges.entries()]
        .filter(([,item])=>
          item&&
          item.approved!==true&&
          String(item.discordId)===String(message.author.id)&&
          Number(item.expiresAt||0)>Date.now()
        )
        .sort((a,b)=>Number(b[1].expiresAt||0)-Number(a[1].expiresAt||0))[0];

      if(!pending){
        await message.reply({
          content:"You don't have a pending Bay Café website login. Open Staff Login on the website first, enter your Discord username, then come back and send `,login`.",
          allowedMentions:{repliedUser:false}
        }).catch(()=>{});
        return;
      }

      const [challengeId,challenge]=pending;
      challenge.approved=true;
      challenge.approvedAt=Date.now();
      mobileLoginChallenges.set(challengeId,challenge);

      await message.reply({
        content:"✅ Staff login approved. Go back to the Bay Café website. If the page closed, reopen it and enter the same Discord username again.",
        allowedMentions:{repliedUser:false}
      }).catch(()=>{});

      return;
    }

    if(!message.author?.bot&&String(message.content||"").trim().toLowerCase().startsWith(",link ")){
      const code=String(message.content||"").trim().split(/\s+/)[1]?.toUpperCase()||"";
      const state=readLinkState();
      state.pending=state.pending.filter(x=>Date.now()<Number(x.expiresAt||0));
      const pending=state.pending.find(x=>x.code===code);
      if(!pending){await message.reply({content:"That Bay Café link code is invalid or expired.",allowedMentions:{repliedUser:false}}).catch(()=>{});saveLinkState(state);return;}
      state.links=state.links.filter(x=>String(x.robloxId)!==String(pending.robloxId)&&String(x.discordId)!==String(message.author.id));
      state.links.push({robloxId:pending.robloxId,robloxUsername:pending.username,robloxDisplayName:pending.displayName,discordId:message.author.id,discordUsername:message.author.username,discordDisplayName:message.member?.displayName||message.author.globalName||message.author.username,linkedAt:nowIso()});
      state.pending=state.pending.filter(x=>x.code!==code);saveLinkState(state);
      await message.reply({content:`✅ Linked Discord **${message.author.username}** to Roblox **${pending.username}** for Bay Café activity tracking.`,allowedMentions:{repliedUser:false}}).catch(()=>{});
      await message.author.send(`Your Discord account is now linked to **${pending.username}** on the Bay Café Staff Hub.`).catch(()=>{});
      auditEvent("discord.linked",{id:pending.robloxId,username:pending.username,displayName:pending.displayName},{discordId:message.author.id,discordUsername:message.author.username});
      return;
    }
    const tickets=readJson(FILES.tickets,[]),ticket=tickets.find(x=>x.status==="open"&&String(x.discordThreadId||"")===String(message.channelId));if(ticket&&message.channel?.isThread?.()&&!message.author?.bot){const content=String(message.content||"").trim(),attachmentText=message.attachments?.size?[...message.attachments.values()].map(x=>x.url).join("\n"):"",merged=[content,attachmentText].filter(Boolean).join("\n").slice(0,1800);if(merged){ticket.messages??=[];ticket.messages.push({id:`discord-${message.id}`,authorType:"staff",authorId:message.author.id,authorDisplayName:message.member?.displayName||message.author.globalName||message.author.username,authorUsername:message.author.username,content:merged,createdAt:message.createdAt.toISOString(),source:"discord"});ticket.updatedAt=new Date().toISOString();writeJson(FILES.tickets,tickets);broadcast("ticket:update",publicTicket(ticket));}return;}await persistDiscordMessage(message).catch(e=>console.error(`[Bay Café] Discord message tracking failed: ${e.message}`));});discordClient.on("messageUpdate",async(_old,newMessage)=>{const full=newMessage.partial?await newMessage.fetch().catch(()=>null):newMessage;if(full)await persistDiscordMessage(full).catch(()=>null);});discordClient.on("messageDelete",async message=>removeDiscordMessage(message.id));await discordClient.login(DISCORD_BOT_TOKEN);}

app.get("/api/health",(_req,res)=>res.json({
  success:true,
  service:"Bay Café Staff Workspace",
  groupId:GROUP_ID,
  discord:Boolean(discordClient?.isReady()),
  trackedMessages:readJson(FILES.discordMessages,[]).length,
  storage:{
    directory:DATA_DIRECTORY,
    railway:IS_RAILWAY,
    expectedPersistentMount:IS_RAILWAY?DATA_DIRECTORY.startsWith("/data"):null,
    applications:readApplications().length,
    applicationBackups:applicationBackupFiles().length
  }
}));
console.log(`[Bay Café] Data directory: ${DATA_DIRECTORY}`);
if(IS_RAILWAY&&!DATA_DIRECTORY.startsWith("/data")){
  console.warn("[Bay Café] WARNING: Railway storage is not under /data. Persistent data may reset after deploys.");
}
console.log(`[Bay Café] Applications loaded: ${readApplications().length}; backups: ${applicationBackupFiles().length}`);

app.listen(PORT,()=>console.log(`[Bay Café] API listening on port ${PORT}`));
startDiscord().catch(error=>console.error(`[Bay Café] Discord startup failed: ${error.message}`));
