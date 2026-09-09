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
const IS_RAILWAY=Boolean(process.env.RAILWAY_ENVIRONMENT||process.env.RAILWAY_PROJECT_ID||process.env.RAILWAY_SERVICE_ID);
const DATA_DIRECTORY=path.resolve(
  process.env.DATA_DIRECTORY ||
  (IS_RAILWAY?"/data/bay-cafe":"./data")
);
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

const FILES={discordMessages:path.join(DATA_DIRECTORY,"discord-messages.json"),tickets:path.join(DATA_DIRECTORY,"tickets.json"),applications:path.join(DATA_DIRECTORY,"applications.json"),applicationSubmissions:path.join(DATA_DIRECTORY,"application-submissions.json"),activitySettings:path.join(DATA_DIRECTORY,"activity-settings.json"),activityArchive:path.join(DATA_DIRECTORY,"activity-archive.json"),birthdays:path.join(DATA_DIRECTORY,"birthdays.json"),staffDirectory:path.join(DATA_DIRECTORY,"staff-directory.json")};
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
const sign=value=>crypto.createHmac("sha256",SESSION_SECRET).update(value).digest("base64url");
function createSessionToken(user){const payload=Buffer.from(JSON.stringify({v:1,issuedAt:Date.now(),nonce:crypto.randomUUID(),user})).toString("base64url");return `bay1.${payload}.${sign(payload)}`;}
function verifySessionToken(token){const p=String(token||"").split(".");if(p.length!==3||p[0]!=="bay1")return null;const left=Buffer.from(p[2]),right=Buffer.from(sign(p[1]));if(left.length!==right.length||!crypto.timingSafeEqual(left,right))return null;try{return JSON.parse(Buffer.from(p[1],"base64url").toString("utf8")).user||null;}catch{return null;}}
function auth(req,res,next){const h=String(req.headers.authorization||"");const token=h.startsWith("Bearer ")?h.slice(7).trim():"";const user=verifySessionToken(token);if(!user)return res.status(401).json({success:false,message:"Sign in required."});req.user=user;req.sessionToken=token;next();}

const authChallenges=new Map();

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
      expiresAt:Date.now()+20*60*1000
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
app.get("/api/auth/me",auth,(req,res)=>res.json({success:true,user:req.user,persistent:true}));
app.post("/api/auth/logout",auth,(_req,res)=>res.json({success:true}));

app.get("/api/stats",auth,async(_req,res)=>{const [g,i]=await Promise.allSettled([groupInfo(),groupIcon()]);const group=g.status==="fulfilled"?g.value:null;const icon=i.status==="fulfilled"?i.value:"";res.json({success:true,group:{id:GROUP_ID,name:group?.name||"Bay Café",description:group?.description||"",memberCount:group?.memberCount||0,owner:group?.owner||null,icon,url:"https://www.roblox.com/communities/695410048/Bay-Cafe#!/about"},discord:{connected:Boolean(discordClient?.isReady()),trackedMessages:readJson(FILES.discordMessages,[]).length,trackedChannels:TRACK_CHANNEL_IDS.size||null}});});

let BAY_DIRECTORY_CACHE = {
  expiresAt: 0,
  members: []
};

async function bayCafeDirectory({allowStale=true}={}) {
  if (
    BAY_DIRECTORY_CACHE.expiresAt > Date.now() &&
    BAY_DIRECTORY_CACHE.members.length
  ) {
    return BAY_DIRECTORY_CACHE.members;
  }

  const persisted=readJson(FILES.staffDirectory,{members:[],savedAt:null});
  const persistedMembers=Array.isArray(persisted?.members)?persisted.members:[];

  try{
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

    if(members.length){
      BAY_DIRECTORY_CACHE = {
        expiresAt:
          Date.now() + 5 * 60_000,
        members
      };

      writeJson(FILES.staffDirectory,{
        savedAt:new Date().toISOString(),
        members
      });

      return members;
    }

    if(allowStale&&persistedMembers.length){
      console.warn("[Bay Café] Roblox directory returned no members; using persistent staff-directory cache.");
      BAY_DIRECTORY_CACHE={
        expiresAt:Date.now()+60_000,
        members:persistedMembers
      };
      return persistedMembers;
    }

    return [];
  }catch(error){
    if(allowStale&&persistedMembers.length){
      console.warn(`[Bay Café] Roblox directory refresh failed (${error.message}); using persistent staff-directory cache.`);
      BAY_DIRECTORY_CACHE={
        expiresAt:Date.now()+60_000,
        members:persistedMembers
      };
      return persistedMembers;
    }

    throw error;
  }
}

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
      if(!results.length&&directory.length===0&&query.length>=2){
        try{
          const searchResponse=await jsonFetch(
            `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(query)}&limit=10`,
            {},
            20_000
          );

          const candidates=Array.isArray(searchResponse?.data)
            ? searchResponse.data
            : [];

          const checked=await Promise.all(
            candidates.map(async candidate=>{
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

          results=checked.filter(Boolean).slice(0,20);
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

function shouldTrackMessage(message){if(!message?.guildId||!message?.id||message.author?.bot)return false;if(EXCLUDED_CHANNEL_IDS.has(String(message.channelId)))return false;if(TRACK_CHANNEL_IDS.size)return TRACK_CHANNEL_IDS.has(String(message.channelId));return true;}
function discordRecord(message){
  const roleNames=message.member?.roles?.cache
    ? [...message.member.roles.cache.values()]
        .filter(role=>role&&role.name!=="@everyone")
        .map(role=>role.name)
    : [];

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
async function persistDiscordMessage(message){if(!shouldTrackMessage(message))return null;const items=readJson(FILES.discordMessages,[]),record=discordRecord(message);const next=[record,...items.filter(x=>x.id!==record.id)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,20000);writeJson(FILES.discordMessages,next);broadcast("discord:message",record);return record;}
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
    const channels=await guild.channels.fetch();

    const eligible=[...channels.values()].filter(
      channel=>
        channel?.isTextBased?.()&&
        !channel.isThread?.()&&
        !EXCLUDED_CHANNEL_IDS.has(String(channel.id))&&
        (!TRACK_CHANNEL_IDS.size||TRACK_CHANNEL_IDS.has(String(channel.id)))
    );

    const stored=readJson(FILES.discordMessages,[]);
    const merged=new Map(stored.map(item=>[String(item.id),item]));

    let scanned=0;
    let addedOrUpdated=0;

    for(const channel of eligible){
      if(!channel?.messages?.fetch)continue;

      const messages=await fetchMessagesSince(channel,weekStart,5000).catch(error=>{
        console.warn(`[Bay Café] Weekly activity sync skipped #${channel.name||channel.id}: ${error.message}`);
        return [];
      });

      scanned+=messages.length;

      for(const message of messages){
        if(!shouldTrackMessage(message))continue;

        const record=discordRecord(message);
        const previous=merged.get(String(record.id));

        if(
          !previous||
          previous.content!==record.content||
          previous.channelName!==record.channelName||
          JSON.stringify(previous.authorRoleNames||[])!==JSON.stringify(record.authorRoleNames||[])
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

async function backfillDiscord(){
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
async function rebuildDiscordHistory(){const guild=await trackedGuild();if(!guild)throw new Error("Discord guild is unavailable.");const channels=await guild.channels.fetch();const eligible=[...channels.values()].filter(ch=>ch?.isTextBased?.()&&!ch.isThread?.()&&!EXCLUDED_CHANNEL_IDS.has(String(ch.id))&&(!TRACK_CHANNEL_IDS.size||TRACK_CHANNEL_IDS.has(String(ch.id))));const merged=new Map();for(const ch of eligible){if(!ch?.messages?.fetch)continue;const messages=await fetchRecentMessages(ch,1000);for(const message of messages){if(shouldTrackMessage(message)){const record=discordRecord(message);merged.set(record.id,record);}}}const sorted=[...merged.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,20000);writeJson(FILES.discordMessages,sorted);broadcast("discord:rebuild",{messageCount:sorted.length});return sorted.length;}
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



function activityTeamFromDiscordRoles(roleNames=[]){
  const roles=(Array.isArray(roleNames)?roleNames:[])
    .map(value=>String(value||"").trim().toLowerCase());

  const has=values=>roles.some(role=>values.some(value=>role.includes(value)));

  if(has([
    "junior corporate",
    "senior corporate",
    "head corporate",
    "corporate intern"
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

app.get("/api/activity/admin",auth,async(req,res)=>{
  if(!isLeadershipOrOwnership(req.user)){
    return res.status(403).json({
      success:false,
      message:"Leadership or Ownership access required."
    });
  }

  const weekStart=startOfCurrentWeek();
  const all=readJson(FILES.discordMessages,[]);
  const thisWeek=all
    .filter(item=>new Date(item.createdAt)>=weekStart)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

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

  const membersByKey=new Map();

  // First: Roblox directory members. This preserves zero-message members and
  // rank-based requirements when Roblox and Discord names happen to match.
  for(const member of directory){
    const team=activityTeamForRole(member.roleName);
    if(!team)continue;

    const names=new Set([
      normalizeIdentity(member.username),
      normalizeIdentity(member.displayName)
    ]);

    const messages=thisWeek.filter(message=>
      [
        normalizeIdentity(message.authorUsername),
        normalizeIdentity(message.authorName)
      ].some(value=>value&&names.has(value))
    );

    const requirement=activityRequirementFor(
      {roleName:member.roleName},
      settings
    );

    const matchedAuthorId=messages[0]?.authorId||"";
    const key=matchedAuthorId
      ? `discord:${matchedAuthorId}`
      : `roblox:${member.id}`;

    membersByKey.set(key,{
      id:matchedAuthorId||`roblox-${member.id}`,
      robloxId:member.id,
      discordId:matchedAuthorId,
      username:messages[0]?.authorUsername||member.username,
      displayName:messages[0]?.authorName||member.displayName,
      robloxUsername:member.username,
      roleName:member.roleName,
      roleRank:member.roleRank,
      team,
      messageCount:messages.length,
      requirement,
      meetsRequirement:messages.length>=requirement,
      avatar:messages[0]?.authorAvatar||"",
      matchedBy:messages.length?"name":"roblox-directory",
      messages:messages.slice(0,500).map(message=>({
        id:message.id,
        channelId:message.channelId,
        channelName:message.channelName,
        content:message.content,
        createdAt:message.createdAt,
        url:message.url
      }))
    });
  }

  // Second: every Discord author who actually sent a tracked message this week.
  // This fixes the old bug where someone disappeared from Activity Management
  // when their Discord username/display name did not match their Roblox name.
  const discordAuthors=new Map();

  for(const message of thisWeek){
    if(!message.authorId)continue;

    const current=discordAuthors.get(String(message.authorId))||{
      authorId:String(message.authorId),
      authorUsername:message.authorUsername||"",
      authorName:message.authorName||message.authorUsername||"",
      authorAvatar:message.authorAvatar||"",
      roleNames:Array.isArray(message.authorRoleNames)?message.authorRoleNames:[],
      messages:[]
    };

    current.authorUsername=message.authorUsername||current.authorUsername;
    current.authorName=message.authorName||current.authorName;
    current.authorAvatar=message.authorAvatar||current.authorAvatar;

    if(Array.isArray(message.authorRoleNames)&&message.authorRoleNames.length){
      current.roleNames=message.authorRoleNames;
    }

    current.messages.push(message);
    discordAuthors.set(String(message.authorId),current);
  }

  for(const author of discordAuthors.values()){
    const team=activityTeamFromDiscordRoles(author.roleNames);

    // Only add unmatched authors when their Discord roles identify them as one
    // of the tracked teams. Existing Roblox/name matches are enriched below.
    const key=`discord:${author.authorId}`;
    const existing=membersByKey.get(key);

    if(existing){
      existing.messages=author.messages.slice(0,500).map(message=>({
        id:message.id,
        channelId:message.channelId,
        channelName:message.channelName,
        content:message.content,
        createdAt:message.createdAt,
        url:message.url
      }));
      existing.messageCount=author.messages.length;
      existing.avatar=author.authorAvatar||existing.avatar;
      existing.username=author.authorUsername||existing.username;
      existing.displayName=author.authorName||existing.displayName;
      existing.discordRoleNames=author.roleNames;
      existing.matchedBy="discord-id";
      existing.meetsRequirement=existing.messageCount>=existing.requirement;
      continue;
    }

    if(!team)continue;

    const requirement=activityRequirementFromRoleNames(author.roleNames,settings);

    membersByKey.set(key,{
      id:author.authorId,
      robloxId:null,
      discordId:author.authorId,
      username:author.authorUsername,
      displayName:author.authorName,
      robloxUsername:"",
      roleName:
        author.roleNames.find(role=>
          activityTeamForRole(role)===team
        )||
        author.roleNames.find(role=>
          activityTeamFromDiscordRoles([role])===team
        )||
        `${team} Team`,
      roleRank:0,
      team,
      messageCount:author.messages.length,
      requirement,
      meetsRequirement:requirement>0
        ? author.messages.length>=requirement
        : true,
      avatar:author.authorAvatar,
      discordRoleNames:author.roleNames,
      matchedBy:"discord-role",
      messages:author.messages.slice(0,500).map(message=>({
        id:message.id,
        channelId:message.channelId,
        channelName:message.channelName,
        content:message.content,
        createdAt:message.createdAt,
        url:message.url
      }))
    });
  }

  const members=[...membersByKey.values()]
    .sort((a,b)=>{
      const teamOrder={Corporate:0,Management:1,Directing:2};
      const teamDiff=(teamOrder[a.team]??9)-(teamOrder[b.team]??9);
      if(teamDiff)return teamDiff;
      if((b.roleRank||0)!==(a.roleRank||0))return (b.roleRank||0)-(a.roleRank||0);
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
      intervalSeconds:60
    },
    directory:{
      available:directory.length>0,
      warning:directoryWarning,
      cached:readJson(FILES.staffDirectory,{members:[]}).members?.length>0
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

app.post("/api/activity/rebuild",auth,async(req,res)=>{if(!isLeadershipOrOwnership(req.user))return res.status(403).json({success:false,message:"Leadership or Ownership access required."});try{const messageCount=await rebuildDiscordHistory();res.json({success:true,messageCount});}catch(error){res.status(400).json({success:false,message:error.message||"Unable to rebuild activity."});}});
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
  });discordClient.on("messageCreate",async message=>{if(!message.guildId)return;const guild=await trackedGuild();if(guild&&message.guildId!==guild.id)return;const tickets=readJson(FILES.tickets,[]),ticket=tickets.find(x=>x.status==="open"&&String(x.discordThreadId||"")===String(message.channelId));if(ticket&&message.channel?.isThread?.()&&!message.author?.bot){const content=String(message.content||"").trim(),attachmentText=message.attachments?.size?[...message.attachments.values()].map(x=>x.url).join("\n"):"",merged=[content,attachmentText].filter(Boolean).join("\n").slice(0,1800);if(merged){ticket.messages??=[];ticket.messages.push({id:`discord-${message.id}`,authorType:"staff",authorId:message.author.id,authorDisplayName:message.member?.displayName||message.author.globalName||message.author.username,authorUsername:message.author.username,content:merged,createdAt:message.createdAt.toISOString(),source:"discord"});ticket.updatedAt=new Date().toISOString();writeJson(FILES.tickets,tickets);broadcast("ticket:update",publicTicket(ticket));}return;}await persistDiscordMessage(message).catch(e=>console.error(`[Bay Café] Discord message tracking failed: ${e.message}`));});discordClient.on("messageUpdate",async(_old,newMessage)=>{const full=newMessage.partial?await newMessage.fetch().catch(()=>null):newMessage;if(full)await persistDiscordMessage(full).catch(()=>null);});discordClient.on("messageDelete",async message=>removeDiscordMessage(message.id));await discordClient.login(DISCORD_BOT_TOKEN);}

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
