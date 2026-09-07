import React,{useEffect,useMemo,useState} from "react";
import {Activity,Archive,ArrowRight,Bell,BookOpen,BriefcaseBusiness,CheckCircle2,ChevronRight,Coffee,ExternalLink,FilePenLine,Gauge,LifeBuoy,Link2,LogOut,Megaphone,Menu,MessageCircleMore,Plus,Search,ShieldCheck,Sparkles,Ticket,Trash2,UserRoundSearch,Users,Waves,X} from "lucide-react";

const IS_LOCAL =
  ["localhost", "127.0.0.1"].includes(
    window.location.hostname
  );

const API =
  (
    IS_LOCAL
      ? "http://localhost:3001"
      : (
          import.meta.env.VITE_API_URL ||
          ""
        )
  ).replace(/\/$/, "");
const TOKEN_KEY="bay.cafe.session",USER_KEY="bay.cafe.user";

async function api(path, options = {}, token = "") {
  let response;

  try {
    response = await fetch(
      `${API}${path}`,
      {
        ...options,
        headers: {
          "Content-Type":
            "application/json",
          ...(token
            ? {
                Authorization:
                  `Bearer ${token}`
              }
            : {}),
          ...(options.headers || {})
        }
      }
    );
  } catch {
    throw new Error(
      `Cannot reach the Bay Café backend at ${API}. Make sure the backend is running on port 3001.`
    );
  }

  const data =
    await response
      .json()
      .catch(
        () =>
          ({})
      );

  if (!response.ok) {
    const error =
      new Error(
        data.message ||
        `Request failed (${response.status})`
      );

    error.status =
      response.status;

    throw error;
  }

  return data;
}
const formatNumber=v=>new Intl.NumberFormat("en-US").format(Number(v||0));
const formatDate=v=>v?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(v)):"—";

function DiscordEmoji({animated,name,id}){return <img className="discord-inline-emoji" src={`https://cdn.discordapp.com/emojis/${id}.${animated?"gif":"webp"}?size=48&quality=lossless`} alt={`:${name}:`} title={`:${name}:`}/>;}
function renderDiscordInline(value,keyPrefix="d"){const text=String(value||"");const patterns=[{type:"emoji",regex:/<(a?):([A-Za-z0-9_]+):(\d+)>/},{type:"timestamp",regex:/<t:(\d+)(?::([tTdDfFR]))?>/},{type:"mention",regex:/<[@#][!&]?(\d+)>/},{type:"link",regex:/\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/},{type:"url",regex:/https?:\/\/[^\s<]+/},{type:"bold",regex:/\*\*(.+?)\*\*/},{type:"underline",regex:/__(.+?)__/},{type:"strike",regex:/~~(.+?)~~/},{type:"spoiler",regex:/\|\|(.+?)\|\|/},{type:"code",regex:/`([^`\n]+)`/},{type:"italic",regex:/\*([^*\n]+)\*/}];let best=null;for(const p of patterns){const m=p.regex.exec(text);if(m&&(!best||m.index<best.match.index))best={...p,match:m};}if(!best)return [text];const before=text.slice(0,best.match.index),after=text.slice(best.match.index+best.match[0].length),nodes=[],key=`${keyPrefix}-${best.match.index}-${best.type}`;if(before)nodes.push(...renderDiscordInline(before,`${key}-b`));if(best.type==="emoji")nodes.push(<DiscordEmoji key={key} animated={best.match[1]==="a"} name={best.match[2]} id={best.match[3]}/>);else if(best.type==="timestamp")nodes.push(<span className="discord-pill" key={key}>{new Date(Number(best.match[1])*1000).toLocaleString()}</span>);else if(best.type==="mention")nodes.push(<span className="discord-pill" key={key}>{best.match[0].startsWith("<#")?"#channel":"@mention"}</span>);else if(best.type==="link")nodes.push(<a className="inline-link" href={best.match[2]} target="_blank" rel="noreferrer" key={key}>{renderDiscordInline(best.match[1],`${key}-l`)}</a>);else if(best.type==="url")nodes.push(<a className="inline-link" href={best.match[0]} target="_blank" rel="noreferrer" key={key}>{best.match[0]}</a>);else if(best.type==="bold")nodes.push(<strong key={key}>{renderDiscordInline(best.match[1],`${key}-s`)}</strong>);else if(best.type==="underline")nodes.push(<u key={key}>{renderDiscordInline(best.match[1],`${key}-u`)}</u>);else if(best.type==="strike")nodes.push(<s key={key}>{renderDiscordInline(best.match[1],`${key}-x`)}</s>);else if(best.type==="spoiler")nodes.push(<span className="spoiler" key={key}>{renderDiscordInline(best.match[1],`${key}-p`)}</span>);else if(best.type==="code")nodes.push(<code key={key}>{best.match[1]}</code>);else nodes.push(<em key={key}>{renderDiscordInline(best.match[1],`${key}-i`)}</em>);if(after)nodes.push(...renderDiscordInline(after,`${key}-a`));return nodes;}
function DiscordText({value}){return <div className="discord-text">{String(value||"").replace(/\r\n/g,"\n").split("\n").map((line,i)=>{if(!line.trim())return <span className="discord-blank" key={i}/>;const h=/^(#{1,3})\s+(.*)$/.exec(line),q=/^>\s?(.*)$/.exec(line),b=/^[-*•]\s+(.*)$/.exec(line);if(h)return <span className={`discord-heading h${h[1].length}`} key={i}>{renderDiscordInline(h[2],`h-${i}`)}</span>;if(q)return <span className="discord-quote" key={i}>{renderDiscordInline(q[1],`q-${i}`)}</span>;if(b)return <span className="discord-bullet" key={i}><i>•</i><span>{renderDiscordInline(b[1],`b-${i}`)}</span></span>;return <span className="discord-line" key={i}>{renderDiscordInline(line,`l-${i}`)}</span>;})}</div>;}

function useSession(){
  const[token,setToken]=useState(
    ()=>localStorage.getItem(TOKEN_KEY)||""
  );

  const[user,setUser]=useState(()=>{
    try{
      return JSON.parse(
        localStorage.getItem(USER_KEY)||"null"
      );
    }catch{
      return null;
    }
  });

  const[checking,setChecking]=useState(Boolean(token));

  useEffect(()=>{
    if(!token){
      setChecking(false);
      return;
    }

    let cancelled=false;

    api("/api/auth/me",{},token)
      .then(result=>{
        if(cancelled)return;

        setUser(result.user);
        localStorage.setItem(
          USER_KEY,
          JSON.stringify(result.user)
        );
      })
      .catch(()=>{
        /*
         * Keep the saved browser login during temporary backend/API
         * failures. Only the Sign out button clears the local session.
         */
      })
      .finally(()=>{
        if(!cancelled){
          setChecking(false);
        }
      });

    return()=>{
      cancelled=true;
    };
  },[token]);

  const login=(nextToken,nextUser)=>{
    localStorage.setItem(
      TOKEN_KEY,
      nextToken
    );

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(nextUser)
    );

    setToken(nextToken);
    setUser(nextUser);
  };

  const logout=async()=>{
    try{
      if(token){
        await api(
          "/api/auth/logout",
          {method:"POST"},
          token
        );
      }
    }catch{}

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setToken("");
    setUser(null);
  };

  return{
    token,
    user,
    checking,
    login,
    logout
  };
}
function Login({onLogin,checking}){
  const[mode,setMode]=useState("staff");
  const[username,setUsername]=useState("");
  const[challenge,setChallenge]=useState(null);
  const[loading,setLoading]=useState(false);
  const[message,setMessage]=useState("");

  const community=mode==="community";

  const switchMode=next=>{
    setMode(next);
    setUsername("");
    setChallenge(null);
    setMessage("");
  };

  const start=async event=>{
    event?.preventDefault();

    if(!username.trim()){
      return setMessage("Enter your Roblox username.");
    }

    setLoading(true);
    setMessage("");

    try{
      setChallenge(
        await api(
          "/api/auth/start",
          {
            method:"POST",
            body:JSON.stringify({username,mode})
          }
        )
      );
    }catch(error){
      setMessage(error.message);
    }finally{
      setLoading(false);
    }
  };

  const verify=async()=>{
    setLoading(true);
    setMessage("");

    try{
      const result=await api(
        "/api/auth/verify",
        {
          method:"POST",
          body:JSON.stringify({challengeId:challenge.challengeId})
        }
      );

      onLogin(result.token,result.user);
    }catch(error){
      setMessage(error.message);
    }finally{
      setLoading(false);
    }
  };

  return <main className={`login-shell ${community?"community-login":""}`}>
    <div className="water-glow glow-one"/>
    <div className="water-glow glow-two"/>

    <section className="login-card">
      <div className="brand-row">
        <div className="bay-mark"><Waves size={22}/></div>
        <div>
          <strong>BAY CAFÉ</strong>
          <span>{community?"COMMUNITY":"STAFF WORKSPACE"}</span>
        </div>
      </div>

      <div className="login-copy">
        <span className="eyebrow">
          {community
            ? <><Users size={13}/>COMMUNITY ACCESS</>
            : <><ShieldCheck size={13}/>PRIVATE STAFF ACCESS</>
          }
        </span>

        <h1>
          {community?"Welcome to":"Welcome to"}
          <em>{community?"the community.":"the Bay."}</em>
        </h1>

        <p>
          {community
            ? "For Entry Team, Visitors, Guests, and anyone exploring Bay Café. View Careers, announcements, community information, and more."
            : "Directing Team and above can access staff tools, community activity, profiles, support, and rank-aware resources."
          }
        </p>
      </div>

      {!challenge
        ? <form className="login-form" onSubmit={start}>
            <label>
              <span>ROBLOX USERNAME</span>
              <input
                value={username}
                onChange={event=>setUsername(event.target.value)}
                placeholder="Enter your username"
              />
            </label>

            <button className="primary-btn" disabled={loading||checking}>
              {loading?"Checking...":community?"Enter Community":"Staff Login"}
              <ArrowRight size={15}/>
            </button>
          </form>
        : <div className="verify-panel">
            <div className="verify-user">
              <img src={challenge.user.avatar} alt=""/>
              <div>
                <strong>{challenge.user.displayName}</strong>
                <span>@{challenge.user.username}</span>
              </div>
            </div>

            <p>Put this code anywhere in your Roblox <strong>About</strong> section:</p>
            <div className="verification-code">{challenge.code}</div>

            <div className="button-row">
              <a className="secondary-btn" href={challenge.profileUrl} target="_blank" rel="noreferrer">
                Open Roblox<ExternalLink size={14}/>
              </a>
              <button className="primary-btn" onClick={verify} disabled={loading}>
                {loading?"Verifying...":"Verify"}<CheckCircle2 size={15}/>
              </button>
            </div>
          </div>
      }

      {message&&<div className="login-message">{message}</div>}

      <button
        type="button"
        className="access-switch"
        onClick={()=>switchMode(community?"staff":"community")}
      >
        {community
          ? "Directing Team or above? Staff Login"
          : "Not a Staff Member? Enter the Community"
        }
        <ChevronRight size={14}/>
      </button>

      <div className="login-footer">
        <Coffee size={14}/>Sip. Relax. Enjoy The Bay.
      </div>
    </section>
  </main>;
}
const Badge=({children,tone="aqua"})=><span className={`badge ${tone}`}>{children}</span>;
function SectionHead({kicker,title,text,right}){return <div className="section-head"><div><span className="eyebrow">{kicker}</span><h2>{title}</h2>{text&&<p>{text}</p>}</div>{right}</div>;}
function Empty({icon:Icon,title,text}){return <div className="empty-state"><div className="empty-icon"><Icon size={20}/></div><strong>{title}</strong><p>{text}</p></div>;}

function CommunityDashboard({token,user,onLogout}){
  const[page,setPage]=useState("home");
  const[announcements,setAnnouncements]=useState([]);
  const[careers,setCareers]=useState([]);
  const[toast,setToast]=useState("");

  const loadAnnouncements=async()=>{
    const result=await api("/api/announcements",{},token);
    setAnnouncements(result.announcements||[]);
  };

  const loadCareers=async()=>{
    const result=await api("/api/careers",{},token);
    setCareers(result.careers||[]);
  };

  useEffect(()=>{
    loadAnnouncements().catch(()=>{});
    loadCareers().catch(()=>{});

    const interval=setInterval(()=>{
      loadAnnouncements().catch(()=>{});
      loadCareers().catch(()=>{});
    },15000);

    return()=>clearInterval(interval);
  },[token]);

  useEffect(()=>{
    if(!toast)return;
    const timer=setTimeout(()=>setToast(""),2600);
    return()=>clearTimeout(timer);
  },[toast]);

  const nav=[
    {id:"home",label:"Community",icon:Waves},
    {id:"announcements",label:"Announcements",icon:Megaphone},
    {id:"careers",label:"Careers",icon:BriefcaseBusiness},
    {id:"about",label:"About Bay Café",icon:Coffee}
  ];

  return <main className="community-shell">
    <header className="community-header">
      <div className="community-brand">
        <div className="bay-mark small"><Waves size={18}/></div>
        <div>
          <strong>BAY CAFÉ</strong>
          <span>COMMUNITY</span>
        </div>
      </div>

      <nav className="community-nav">
        {nav.map(item=>{
          const Icon=item.icon;
          return <button
            key={item.id}
            className={page===item.id?"active":""}
            onClick={()=>setPage(item.id)}
          >
            <Icon size={15}/>
            {item.label}
          </button>;
        })}
      </nav>

      <div className="community-account">
        <img src={user.avatar} alt=""/>
        <div>
          <strong>{user.displayName}</strong>
          <span>{user.roleName}</span>
        </div>
        <button onClick={onLogout} title="Sign out">
          <LogOut size={15}/>
        </button>
      </div>
    </header>

    <div className="community-page">
      {page==="home"&&
        <div className="page-stack">
          <section className="community-hero">
            <Badge tone="green">WELCOME TO BAY CAFÉ</Badge>
            <h1>Community starts at <em>the Bay.</em></h1>
            <p>
              Explore official announcements, discover open Careers, and stay connected with the Bay Café community.
            </p>
            <div className="button-row">
              <button className="primary-btn" onClick={()=>setPage("careers")}>
                View Careers<ChevronRight size={15}/>
              </button>
              <button className="secondary-btn" onClick={()=>setPage("announcements")}>
                Announcements<Megaphone size={14}/>
              </button>
            </div>
          </section>

          <section>
            <SectionHead
              kicker="LATEST"
              title="Community announcements."
              text="Recent updates from Bay Café."
            />
            <div className="announcement-preview-grid">
              {announcements.slice(0,3).length
                ? announcements.slice(0,3).map(item=>
                    <AnnouncementCard key={item.id} item={item} compact/>
                  )
                : <Empty
                    icon={Megaphone}
                    title="No announcements yet"
                    text="Official Bay Café announcements will appear here."
                  />
              }
            </div>
          </section>

          <section>
            <SectionHead
              kicker="OPPORTUNITIES"
              title="Open Careers."
              text="Applications currently open at Bay Café."
            />
            <div className="careers-grid">
              {careers.slice(0,4).length
                ? careers.slice(0,4).map(item=>
                    <article className="career-card" key={item.id}>
                      <div className="career-card-head">
                        <div>
                          <Badge tone="green">OPEN</Badge>
                          <h3>{item.title}</h3>
                        </div>
                        <BriefcaseBusiness size={18}/>
                      </div>
                      {item.description&&<p>{item.description}</p>}
                      <div className="button-row career-actions">
                        <button className="primary-btn" onClick={()=>setPage("careers")}>
                          Apply<ChevronRight size={15}/>
                        </button>
                      </div>
                    </article>
                  )
                : <Empty
                    icon={BriefcaseBusiness}
                    title="No open Careers"
                    text="New opportunities will appear here when Leadership publishes them."
                  />
              }
            </div>
          </section>
        </div>
      }

      {page==="announcements"&&<AnnouncementsPage items={announcements}/>}
      {page==="careers"&&<CareersPage token={token} items={careers} setToast={setToast}/>}

      {page==="about"&&
        <div className="page-stack">
          <SectionHead
            kicker="ABOUT US"
            title="Welcome to Bay Café."
            text="A Roblox café community centered around service, leadership, development, and a place people enjoy returning to."
          />

          <div className="community-info-grid">
            <article>
              <Coffee size={19}/>
              <h3>Community First</h3>
              <p>Meet people, participate, grow, and enjoy the Bay Café community.</p>
            </article>
            <article>
              <BriefcaseBusiness size={19}/>
              <h3>Grow With Us</h3>
              <p>Explore Careers when applications for new opportunities are open.</p>
            </article>
            <article>
              <Megaphone size={19}/>
              <h3>Stay Updated</h3>
              <p>Official Discord announcements are displayed directly on the website.</p>
            </article>
          </div>
        </div>
      }
    </div>

    {toast&&<div className="toast"><Sparkles size={14}/>{toast}</div>}
  </main>;
}

function Dashboard({token,user,onLogout}){
  const[page,setPage]=useState("overview");
  const[mobileOpen,setMobileOpen]=useState(false);
  const[stats,setStats]=useState(null);
  const[discordMessages,setDiscordMessages]=useState([]);
  const[discordChannels,setDiscordChannels]=useState([]);
  const[tickets,setTickets]=useState([]);
  const[announcements,setAnnouncements]=useState([]);
  const[applications,setApplications]=useState([]);
  const[careers,setCareers]=useState([]);
  const[submissions,setSubmissions]=useState([]);
  const[toast,setToast]=useState("");

  const caps=user.capabilities||{};
  const canManageApplications=
    Number(user.level||0)>=4||
    ["leadership","ownership"].includes(String(user.tier||"").toLowerCase());

  const hasLeadershipAccess=
    Number(user.level||0)>=4||
    ["leadership","ownership"].includes(
      String(user.tier||"").toLowerCase()
    );

  const nav=[
    {id:"overview",label:"Overview",icon:Waves,show:true},
    {id:"announcements",label:"Announcements",icon:Megaphone,show:true},
    {id:"discord",label:"Community Activity",icon:MessageCircleMore,show:caps.discord},
    {id:"activityAdmin",label:"Activity Management",icon:Gauge,show:hasLeadershipAccess},
    {id:"careers",label:"Careers",icon:BriefcaseBusiness,show:true},
    {id:"applications",label:"Applications",icon:FilePenLine,show:hasLeadershipAccess},
    {id:"information",label:"Information",icon:BookOpen,show:true},
    {id:"profiles",label:"Profiles",icon:UserRoundSearch,show:caps.profiles},
    {id:"tickets",label:"Support",icon:LifeBuoy,show:caps.tickets}
  ].filter(item=>item.show);

  async function loadStats(){
    setStats(await api("/api/stats",{},token));
  }

  async function loadDiscord(){
    const[m,c]=await Promise.all([
      api("/api/discord/messages?limit=500",{},token),
      api("/api/discord/channels",{},token)
    ]);
    setDiscordMessages(m.messages||[]);
    setDiscordChannels(c.channels||[]);
  }

  async function loadTickets(){
    const result=await api("/api/tickets",{},token);
    setTickets(result.tickets||[]);
  }

  async function loadAnnouncements(){
    const result=await api("/api/announcements",{},token);
    setAnnouncements(result.announcements||[]);
  }

  async function loadApplications(){
    if(!canManageApplications){
      setApplications([]);
      return;
    }

    const result=await api("/api/applications",{},token);
    setApplications(result.applications||[]);
  }

  async function loadCareers(){
    const result=await api("/api/careers",{},token);
    setCareers(result.careers||[]);
  }

  async function loadSubmissions(){
    if(!canManageApplications){
      setSubmissions([]);
      return;
    }
    const result=await api("/api/application-submissions",{},token);
    setSubmissions(result.submissions||[]);
  }

  useEffect(()=>{
    loadStats().catch(()=>{});
    loadDiscord().catch(()=>{});
    loadTickets().catch(()=>{});
    loadAnnouncements().catch(()=>{});
    loadCareers().catch(()=>{});
    loadApplications().catch(()=>{});
    loadSubmissions().catch(()=>{});

    const interval=setInterval(()=>{
      loadStats().catch(()=>{});
      loadDiscord().catch(()=>{});
      loadTickets().catch(()=>{});
      loadAnnouncements().catch(()=>{});
      loadCareers().catch(()=>{});
      loadApplications().catch(()=>{});
      loadSubmissions().catch(()=>{});
    },15000);

    return()=>clearInterval(interval);
  },[token]);

  useEffect(()=>{
    const stream=new EventSource(`${API}/api/live?token=${encodeURIComponent(token)}`);

    const du=event=>{
      try{
        const item=JSON.parse(event.data);
        setDiscordMessages(current=>[item,...current.filter(x=>x.id!==item.id)]);
      }catch{}
    };

    const dd=event=>{
      try{
        const item=JSON.parse(event.data);
        setDiscordMessages(current=>current.filter(x=>x.id!==item.id));
      }catch{}
    };

    const tu=event=>{
      try{
        const item=JSON.parse(event.data);
        setTickets(current=>[item,...current.filter(x=>x.id!==item.id)]);
      }catch{
        loadTickets().catch(()=>{});
      }
    };

    const au=()=>{
      loadCareers().catch(()=>{});
      loadApplications().catch(()=>{});
    };

    stream.addEventListener("discord:message",du);
    stream.addEventListener("discord:delete",dd);
    stream.addEventListener("ticket:update",tu);
    stream.addEventListener("application:update",au);
    stream.addEventListener("application:submission",()=>loadSubmissions().catch(()=>{}));

    return()=>stream.close();
  },[token]);

  useEffect(()=>{
    if(!toast)return;
    const timer=setTimeout(()=>setToast(""),2600);
    return()=>clearTimeout(timer);
  },[toast]);

  const open=id=>{
    setPage(id);
    setMobileOpen(false);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const pageTitle=
    page==="announcements"?"Announcements":
    page==="discord"?"Community Activity":
    page==="careers"?"Careers":
    page==="applications"?"Applications":
    page==="activityAdmin"?"Activity Management":
    page==="information"?"Information Hub":
    page==="profiles"?"Profile Lookup":
    page==="tickets"?"Support Center":
    "Staff Overview";

  return <main className="app-shell">
    <aside className={`sidebar ${mobileOpen?"open":""}`}>
      <div className="sidebar-brand">
        <div className="bay-mark small"><Waves size={18}/></div>
        <div><strong>BAY CAFÉ</strong><span>STAFF HUB</span></div>
        <button className="mobile-close" onClick={()=>setMobileOpen(false)}><X size={17}/></button>
      </div>

      <div className="user-mini">
        <img src={user.avatar} alt=""/>
        <div>
          <strong>{user.displayName}</strong>
          <span>{user.roleName}</span>
          {hasLeadershipAccess&&<small className="admin-access-indicator">ACTIVITY ADMIN ENABLED</small>}
        </div>
      </div>

      <nav>
        {nav.map(item=>{
          const Icon=item.icon;
          return <button
            key={item.id}
            className={page===item.id?"active":""}
            onClick={()=>open(item.id)}
          >
            <Icon size={16}/>
            {item.label}
          </button>;
        })}
      </nav>

      <div className="sidebar-links">
        <a href="https://discord.gg/ztPy6UKxY" target="_blank" rel="noreferrer">
          Public Discord<ExternalLink size={13}/>
        </a>
        <a href="https://www.roblox.com/communities/695410048/Bay-Cafe#!/about" target="_blank" rel="noreferrer">
          Roblox Group<ExternalLink size={13}/>
        </a>
      </div>

      <button className="logout-btn" onClick={onLogout}>
        <LogOut size={15}/>Sign out
      </button>
    </aside>

    {mobileOpen&&<button className="sidebar-backdrop" onClick={()=>setMobileOpen(false)}/>}

    <section className="main-panel">
      <header className="topbar">
        <button className="mobile-menu" onClick={()=>setMobileOpen(true)}>
          <Menu size={18}/>
        </button>

        <div className="topbar-copy">
          <span>BAY CAFÉ</span>
          <strong>{pageTitle}</strong>
        </div>

        <div className="topbar-status">
          <span className="status-dot"/>LIVE
        </div>
      </header>

      <div className="page-wrap">
        {page==="overview"&&
          <Overview
            user={user}
            stats={stats}
            discordMessages={discordMessages}
            announcements={announcements}
            navigate={open}
          />
        }

        {page==="announcements"&&
          <AnnouncementsPage items={announcements}/>
        }

        {page==="discord"&&
          <DiscordTracker messages={discordMessages} channels={discordChannels}/>
        }

        {page==="careers"&&
          <CareersPage token={token} items={careers} setToast={setToast}/>
        }

        {page==="applications"&&hasLeadershipAccess&&
          <ApplicationsPage
            token={token}
            user={user}
            items={applications}
            canManage={canManageApplications}
            submissions={submissions}
            reload={async()=>{
              await Promise.all([
                loadApplications(),
                loadCareers()
              ]);
            }}
            setToast={setToast}
          />
        }

        {page==="activityAdmin"&&hasLeadershipAccess&&<ActivityAdminPage token={token} setToast={setToast}/>} 
        {page==="information"&&<InformationHub user={user}/>} 
        {page==="profiles"&&<Profiles token={token}/>}
        {page==="tickets"&&
          <TicketsPage
            token={token}
            user={user}
            items={tickets}
            reload={loadTickets}
            setToast={setToast}
          />
        }
      </div>

      {toast&&<div className="toast"><Sparkles size={14}/>{toast}</div>}
    </section>
  </main>;
}
function Overview({user,stats,discordMessages,announcements,navigate}){
  const latest=discordMessages.slice(0,4);
  const latestAnnouncements=(announcements||[]).slice(0,3);

  return <div className="page-stack">
    <section className="hero-grid">
      <article className="hero-card">
        <div className="hero-waterline"/>
        <Badge>STAFF WORKSPACE</Badge>
        <h1>Welcome back,<em>{user.displayName}.</em></h1>
        <p>
          You are signed in as <strong>{user.roleName}</strong>. Your Bay Café workspace
          automatically changes with your rank and responsibilities.
        </p>
        <div className="button-row">
          <button className="primary-btn" onClick={()=>navigate("announcements")}>
            Announcements<ChevronRight size={15}/>
          </button>
          <button className="secondary-btn" onClick={()=>navigate("information")}>
            Open Information<BookOpen size={14}/>
          </button>
        </div>
      </article>

      <article className="rank-card">
        <div className="rank-orbit"/>
        <img src={user.avatar} alt=""/>
        <span className="eyebrow">YOUR ACCESS</span>
        <h3>{user.tier?.toUpperCase()}</h3>
        <p>{user.roleName}</p>
        <div className="capability-tags">
          {Object.entries(user.capabilities||{})
            .filter(([,value])=>value)
            .slice(0,6)
            .map(([name])=><span key={name}>{name.replace(/([A-Z])/g," $1")}</span>)
          }
        </div>
      </article>
    </section>

    <section>
      <SectionHead
        kicker="LIVE BAY DATA"
        title="At a glance."
        text="Live Roblox and Discord integration status."
      />
      <div className="metrics-grid">
        <article>
          <Users size={18}/>
          <span>COMMUNITY</span>
          <strong>{formatNumber(stats?.group?.memberCount)}</strong>
          <p>Roblox members</p>
        </article>
        <article>
          <MessageCircleMore size={18}/>
          <span>YOUR MESSAGES</span>
          <strong>{formatNumber(discordMessages.length)}</strong>
          <p>This week</p>
        </article>
        <article>
          <Activity size={18}/>
          <span>DISCORD</span>
          <strong>{stats?.discord?.connected?"LIVE":"OFFLINE"}</strong>
          <p>Tracker connection</p>
        </article>
      </div>
    </section>

    <section>
      <SectionHead
        kicker="OFFICIAL UPDATES"
        title="Latest announcements."
        text="Recent posts from the official Bay Café announcement channel."
        right={
          <button className="text-button" onClick={()=>navigate("announcements")}>
            View all<ArrowRight size={13}/>
          </button>
        }
      />

      <div className="announcement-preview-grid">
        {latestAnnouncements.length
          ? latestAnnouncements.map(item=><AnnouncementCard key={item.id} item={item} compact/>)
          : <Empty
              icon={Megaphone}
              title="No announcements loaded"
              text="Official Bay Café announcements will appear here once the Discord bot can read the announcement channel."
            />
        }
      </div>
    </section>

    <section>
      <SectionHead
        kicker="LIVE DISCORD"
        title="Your recent activity."
        text="Your newest tracked Discord messages from this week."
        right={
          <button className="text-button" onClick={()=>navigate("discord")}>
            Open activity<ArrowRight size={13}/>
          </button>
        }
      />

      <div className="discord-preview-grid">
        {latest.length
          ? latest.map(message=><DiscordCard item={message} compact key={message.id}/>)
          : <Empty
              icon={MessageCircleMore}
              title="No tracked messages"
              text="Once Discord tracking recognizes your account, your messages will appear here."
            />
        }
      </div>
    </section>
  </div>;
}
function DiscordCard({item,compact=false}){const images=(item.attachments||[]).filter(f=>String(f.contentType||"").startsWith("image/")||/\.(png|jpe?g|gif|webp)$/i.test(f.name||f.url||""));return <article className={`discord-card ${compact?"compact":""}`}><div className="discord-card-head"><img src={item.authorAvatar} alt=""/><div><strong>{item.authorName}</strong><span>#{item.channelName} • {formatDate(item.createdAt)}</span></div><Bell size={14}/></div><DiscordText value={item.content||"Attachment message"}/>{images.length>0&&<div className="discord-images">{images.map(f=><a key={f.id||f.url} href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={f.name||"attachment"}/></a>)}</div>}<a className="message-link" href={item.url} target="_blank" rel="noreferrer">Open in Discord<ExternalLink size={12}/></a></article>;}
function DiscordTracker({messages,channels}){
  const[channel,setChannel]=useState("all");
  const[query,setQuery]=useState("");

  const weekStart=useMemo(()=>{
    const now=new Date();
    const day=now.getDay();
    const diff=day===0?-6:1-day;
    const start=new Date(now);
    start.setDate(now.getDate()+diff);
    start.setHours(0,0,0,0);
    return start;
  },[]);

  const filtered=useMemo(
    ()=>messages.filter(
      m=>
        (channel==="all"||m.channelId===channel)&&
        (
          !query.trim()||
          [m.content,m.channelName]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())
        )
    ),
    [messages,channel,query]
  );

  return <div className="page-stack">
    <SectionHead
      kicker="YOUR WEEKLY ACTIVITY"
      title="Community activity."
      text="Only your own tracked Discord messages from the current week are shown here."
    />

    <div className="activity-summary-grid">
      <article className="activity-summary-card">
        <MessageCircleMore size={19}/>
        <span>YOUR MESSAGE COUNT</span>
        <strong>{messages.length}</strong>
        <p>Since Monday</p>
      </article>

      <article className="activity-summary-card">
        <Activity size={19}/>
        <span>WEEK STARTED</span>
        <strong className="activity-date">
          {weekStart.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
        </strong>
        <p>Current tracking week</p>
      </article>

      <article className="activity-summary-card">
        <MessageCircleMore size={19}/>
        <span>CHANNELS USED</span>
        <strong>{new Set(messages.map(item=>item.channelId)).size}</strong>
        <p>This week</p>
      </article>
    </div>

    <SectionHead
      kicker="YOUR MESSAGE HISTORY"
      title="Messages this week."
      text="Search or filter the messages counted toward your weekly activity."
      right={<Badge tone="green">{filtered.length} MESSAGES</Badge>}
    />

    <div className="tracker-toolbar">
      <div className="search-field">
        <Search size={15}/>
        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Search your messages..."
        />
      </div>

      <select
        value={channel}
        onChange={e=>setChannel(e.target.value)}
      >
        <option value="all">All channels</option>
        {channels.map(c=>
          <option key={c.id} value={c.id}>#{c.name}</option>
        )}
      </select>
    </div>

    <div className="tracker-grid">
      {filtered.length
        ? filtered.map(m=><DiscordCard key={m.id} item={m}/>)
        : <Empty
            icon={MessageCircleMore}
            title="No messages counted yet"
            text="Your tracked Discord messages from this week will appear here."
          />
      }
    </div>
  </div>;
}

const InfoBlock=({title,children})=><article className="info-block"><h3>{title}</h3><div className="info-body">{children}</div></article>;

function AnnouncementCard({item,compact=false}){
  const images=(item.attachments||[]).filter(file=>
    String(file.contentType||"").startsWith("image/")||
    /\.(png|jpe?g|gif|webp)$/i.test(file.name||file.url||"")
  );

  return <article className={`announcement-card ${compact?"compact":""}`}>
    <div className="announcement-head">
      <div className="announcement-avatar">
        {item.authorAvatar
          ? <img src={item.authorAvatar} alt=""/>
          : <Megaphone size={17}/>
        }
      </div>
      <div>
        <strong>{item.authorName||"Bay Café"}</strong>
        <span>#{item.channelName||"announcements"} • {formatDate(item.createdAt)}</span>
      </div>
      <Megaphone size={15}/>
    </div>

    {item.content&&<DiscordText value={item.content}/>}

    {(item.embeds||[]).map((embed,index)=>
      <div className="announcement-embed" key={`${item.id}-embed-${index}`}>
        {embed.title&&<h4>{embed.title}</h4>}
        {embed.description&&<DiscordText value={embed.description}/>}
        {(embed.fields||[]).map((field,fieldIndex)=>
          <div className="announcement-field" key={fieldIndex}>
            <strong>{field.name}</strong>
            <DiscordText value={field.value}/>
          </div>
        )}
      </div>
    )}

    {images.length>0&&
      <div className="discord-images">
        {images.map(file=>
          <a key={file.id||file.url} href={file.url} target="_blank" rel="noreferrer">
            <img src={file.url} alt={file.name||"announcement attachment"}/>
          </a>
        )}
      </div>
    }

    {item.url&&
      <a className="message-link" href={item.url} target="_blank" rel="noreferrer">
        Open in Discord<ExternalLink size={12}/>
      </a>
    }
  </article>;
}

function AnnouncementsPage({items}){
  return <div className="page-stack">
    <SectionHead
      kicker="OFFICIAL BAY CAFÉ"
      title="Announcements."
      text="Live posts from the Bay Café announcement channel."
      right={<Badge tone="green">#{items.length} LOADED</Badge>}
    />

    <div className="announcements-list">
      {items.length
        ? items.map(item=><AnnouncementCard key={item.id} item={item}/>)
        : <Empty
            icon={Megaphone}
            title="No announcements available"
            text="Make sure the Bay Café Discord bot can view channel 1446415574682046495 and read message history."
          />
      }
    </div>
  </div>;
}


function CareersPage({token,items,setToast}){
  const[applying,setApplying]=useState(null);
  const[answers,setAnswers]=useState([]);
  const[message,setMessage]=useState("");
  const[submitting,setSubmitting]=useState(false);

  const begin=item=>{
    setApplying(item);
    setAnswers((item.questions||[]).map(()=>""));
    setMessage("");
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const submit=async event=>{
    event.preventDefault();
    if(!applying)return;

    setSubmitting(true);
    setMessage("");

    try{
      await api(
        `/api/careers/${applying.id}/apply`,
        {method:"POST",body:JSON.stringify({answers})},
        token
      );
      setToast("Application submitted.");
      setApplying(null);
      setAnswers([]);
    }catch(error){
      setMessage(error.message);
    }finally{
      setSubmitting(false);
    }
  };

  return <div className="page-stack">
    <SectionHead
      kicker="BAY CAFÉ OPPORTUNITIES"
      title="Careers."
      text="Explore currently open Bay Café applications published by Leadership and Ownership."
      right={<Badge tone="green">{items.length} OPEN</Badge>}
    />

    {applying&&
      <form className="career-apply-panel" onSubmit={submit}>
        <div className="career-apply-head">
          <div>
            <span className="eyebrow">APPLICATION FORM</span>
            <h2>{applying.title}</h2>
          </div>
          <button type="button" className="secondary-btn" onClick={()=>setApplying(null)}>
            Cancel
          </button>
        </div>

        {(applying.questions||[]).map((question,index)=>
          <label key={index}>
            {index+1}. {question}
            <textarea
              rows={4}
              value={answers[index]||""}
              onChange={event=>{
                const next=[...answers];
                next[index]=event.target.value;
                setAnswers(next);
              }}
              required
            />
          </label>
        )}

        <div className="button-row">
          <button className="primary-btn" disabled={submitting}>
            {submitting?"Submitting...":"Submit Application"}
          </button>
          {message&&<span className="form-message">{message}</span>}
        </div>
      </form>
    }

    <div className="careers-grid">
      {items.length
        ? items.map(item=>
          <article className="career-card" key={item.id}>
            <div className="career-card-head">
              <div>
                <Badge tone="green">OPEN</Badge>
                <h3>{item.title}</h3>
              </div>
              <BriefcaseBusiness size={18}/>
            </div>
            {item.description&&<p>{item.description}</p>}
            <div className="career-meta">
              <span>Published by @{item.updatedBy||item.createdBy||"Leadership"}</span>
              <span>{formatDate(item.updatedAt||item.createdAt)}</span>
            </div>
            <div className="button-row career-actions">
              <button className="primary-btn" onClick={()=>begin(item)}>
                Apply Now<ChevronRight size={15}/>
              </button>
            </div>
          </article>
        )
        : <Empty
            icon={BriefcaseBusiness}
            title="No open careers right now"
            text="When Leadership or Ownership opens an application, it will automatically appear here."
          />
      }
    </div>
  </div>;
}
function ApplicationsPage({token,user,items,canManage,submissions,reload,setToast}){
  const[editing,setEditing]=useState(null);
  const[title,setTitle]=useState("");
  const[description,setDescription]=useState("");
  const[status,setStatus]=useState("open");
  const[questions,setQuestions]=useState("");
  const[saving,setSaving]=useState(false);
  const[message,setMessage]=useState("");
  const draftKey=`bay.cafe.applicationDraft.${user?.id||user?.username||"staff"}`;

  useEffect(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(draftKey)||"null");
      if(!saved)return;
      setEditing(saved.editing||null);
      setTitle(saved.title||"");
      setDescription(saved.description||"");
      setStatus(saved.status||"open");
      setQuestions(saved.questions||"");
    }catch{}
  },[draftKey]);

  useEffect(()=>{
    try{
      const hasDraft=
        Boolean(editing)||
        Boolean(title.trim())||
        Boolean(description.trim())||
        Boolean(questions.trim())||
        status!=="open";

      if(!hasDraft){
        localStorage.removeItem(draftKey);
        return;
      }

      localStorage.setItem(
        draftKey,
        JSON.stringify({
          editing,
          title,
          description,
          status,
          questions,
          savedAt:Date.now()
        })
      );
    }catch{}
  },[draftKey,editing,title,description,status,questions]);

  const reset=(clearSavedDraft=true)=>{
    setEditing(null);
    setTitle("");
    setDescription("");
    setStatus("open");
    setQuestions("");
    setMessage("");
    if(clearSavedDraft){
      try{localStorage.removeItem(draftKey)}catch{}
    }
  };

  const beginEdit=item=>{
    setEditing(item.id);
    setTitle(item.title||"");
    setDescription(item.description||"");
    setStatus(item.status||"open");
    setQuestions((item.questions||[]).join("\n"));
    setMessage("");
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const save=async event=>{
    event.preventDefault();
    if(!canManage)return;

    setSaving(true);
    setMessage("");

    try{
      const payload={
        title,
        description,
        status,
        questions:questions
          .split("\n")
          .map(value=>value.trim())
          .filter(Boolean)
      };

      if(editing){
        await api(
          `/api/applications/${editing}`,
          {method:"PUT",body:JSON.stringify(payload)},
          token
        );
        setToast("Application updated.");
      }else{
        await api(
          "/api/applications",
          {method:"POST",body:JSON.stringify(payload)},
          token
        );
        setToast("Application created.");
      }

      reset();
      await reload();
    }catch(error){
      setMessage(error.message);
    }finally{
      setSaving(false);
    }
  };

  const remove=async item=>{
    if(!canManage)return;
    if(!window.confirm(`Delete "${item.title}"?`))return;

    try{
      await api(
        `/api/applications/${item.id}`,
        {method:"DELETE"},
        token
      );
      setToast("Application deleted.");
      if(editing===item.id)reset();
      await reload();
    }catch(error){
      setMessage(error.message);
    }
  };

  return <div className="page-stack">
    <SectionHead
      kicker={canManage?"LEADERSHIP APPLICATION CONTROL":"APPLICATION CENTER"}
      title="Applications."
      text="Create, open, close, edit, and remove Bay Café applications. Open applications automatically appear in Careers."
      right={<Badge tone="green">LEADERSHIP / OWNERSHIP</Badge>}
    />

    {canManage&&
      <form className="application-editor" onSubmit={save}>
        <div className="application-editor-head">
          <div>
            <span className="eyebrow">{editing?"EDIT APPLICATION":"NEW APPLICATION"}</span>
            <h2>{editing?"Update application":"Create an application"}</h2>
            <small className="draft-saved-note">Draft auto-saves on this device.</small>
          </div>
          {editing&&
            <button type="button" className="secondary-btn" onClick={reset}>
              Cancel
            </button>
          }
        </div>

        <label>
          Application title
          <input
            value={title}
            onChange={event=>setTitle(event.target.value)}
            placeholder="Management Application"
            maxLength={100}
            required
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            onChange={event=>setDescription(event.target.value)}
            placeholder="Explain who should apply and what this application is for."
            rows={5}
          />
        </label>

        <div className="application-form-grid">
          <label>
            Status
            <select value={status} onChange={event=>setStatus(event.target.value)}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>

          <label>
            Questions
            <textarea
              value={questions}
              onChange={event=>setQuestions(event.target.value)}
              placeholder={"Why do you want this role?\nWhat experience do you have?\nWhat is your timezone?"}
              rows={8}
            />
            <small>One question per line.</small>
          </label>
        </div>

        <div className="button-row">
          <button className="primary-btn" disabled={saving}>
            {saving
              ? "Saving..."
              : editing
                ? "Save Changes"
                : "Create Application"
            }
          </button>

          {message&&<span className="form-message">{message}</span>}
        </div>
      </form>
    }

    <div className="applications-grid">
      {items.length
        ? items.map(item=>
          <article className="application-card" key={item.id}>
            <div className="application-card-head">
              <div>
                <Badge tone={item.status==="open"?"green":"sand"}>
                  {String(item.status||"closed").toUpperCase()}
                </Badge>
                <h3>{item.title}</h3>
              </div>
              {canManage&&
                <div className="application-actions">
                  <button onClick={()=>beginEdit(item)} title="Edit application">
                    <FilePenLine size={15}/>
                  </button>
                  <button onClick={()=>remove(item)} title="Delete application">
                    <Trash2 size={15}/>
                  </button>
                </div>
              }
            </div>

            {item.description&&<p>{item.description}</p>}

            <div className="application-questions">
              <span>QUESTIONS</span>
              {(item.questions||[]).length
                ? <ol>
                    {item.questions.map((question,index)=>
                      <li key={index}>{question}</li>
                    )}
                  </ol>
                : <p>No questions added yet.</p>
              }
            </div>

            <div className="application-meta">
              <span>Updated {formatDate(item.updatedAt||item.createdAt)}</span>
              {item.updatedBy&&<span>by @{item.updatedBy}</span>}
            </div>
          </article>
        )
        : <Empty
            icon={FilePenLine}
            title="No applications yet"
            text={
              canManage
                ? "Create the first Bay Café application above."
                : "Leadership has not published any applications yet."
            }
          />
      }
    </div>

    <SectionHead
      kicker="SUBMISSIONS"
      title="Application submissions."
      text="Only Leadership and Ownership can view submitted applications."
      right={<Badge tone="green">{(submissions||[]).length} RECEIVED</Badge>}
    />

    <div className="submissions-grid">
      {(submissions||[]).length
        ? submissions.map(submission=>
          <article className="submission-card" key={submission.id}>
            <div className="submission-head">
              <img src={submission.applicant?.avatar} alt=""/>
              <div>
                <strong>{submission.applicant?.displayName||submission.applicant?.username}</strong>
                <span>@{submission.applicant?.username} • {submission.applicationTitle}</span>
              </div>
              <Badge tone="sand">{String(submission.status||"pending").toUpperCase()}</Badge>
            </div>

            <div className="submission-answers">
              {(submission.answers||[]).map((entry,index)=>
                <div key={index}>
                  <strong>{entry.question}</strong>
                  <p>{entry.answer}</p>
                </div>
              )}
            </div>

            <div className="application-meta">
              <span>Submitted {formatDate(submission.submittedAt)}</span>
            </div>
          </article>
        )
        : <Empty
            icon={FilePenLine}
            title="No submissions yet"
            text="Submitted Career applications will appear here."
          />
      }
    </div>
  </div>;
}

function ActivityAdminPage({token,setToast}){const[data,setData]=useState(null),[requirement,setRequirement]=useState(0),[loading,setLoading]=useState(false);const load=async()=>{const r=await api("/api/activity/admin",{},token);setData(r);setRequirement(Number(r.settings?.weeklyRequirement)||0)};useEffect(()=>{load().catch(e=>setToast(e.message))},[token]);const save=async()=>{setLoading(true);try{await api("/api/activity/settings",{method:"PUT",body:JSON.stringify({weeklyRequirement:Number(requirement)||0})},token);setToast("Weekly requirement updated.");await load()}catch(e){setToast(e.message)}finally{setLoading(false)}};const rebuild=async()=>{setLoading(true);try{const r=await api("/api/activity/rebuild",{method:"POST"},token);setToast(`Activity rebuilt: ${r.messageCount||0} messages tracked.`);await load()}catch(e){setToast(e.message)}finally{setLoading(false)}};const reset=async()=>{if(!window.confirm("Reset this week's activity? A snapshot will be archived first."))return;setLoading(true);try{await api("/api/activity/reset",{method:"POST"},token);setToast("Current week reset.");await load()}catch(e){setToast(e.message)}finally{setLoading(false)}};if(!data)return <div className="notice">Loading activity management...</div>;return <div className="page-stack"><SectionHead kicker="LEADERSHIP / OWNERSHIP" title="Activity Management." text="Manage weekly activity tracking, requirements, rebuilds, resets, and archived snapshots." right={<Badge tone="green">PRIVATE</Badge>}/><div className="activity-admin-stats"><article><span>THIS WEEK</span><strong>{data.thisWeekTracked}</strong><small>tracked messages</small></article><article><span>TOTAL STORED</span><strong>{data.totalTracked}</strong><small>persistent records</small></article><article><span>REQUIREMENT</span><strong>{Number(data.settings?.weeklyRequirement)||0}</strong><small>messages this week</small></article></div><div className="activity-admin-grid"><article className="activity-admin-card"><h3>Weekly requirement</h3><p>Set the message requirement for the current week.</p><div className="requirement-row"><input type="number" min="0" max="10000" value={requirement} onChange={e=>setRequirement(e.target.value)}/><button className="primary-btn" onClick={save} disabled={loading}>Save</button></div></article><article className="activity-admin-card"><h3>Rebuild activity</h3><p>Re-scan up to 1,000 recent messages per tracked channel.</p><button className="primary-btn" onClick={rebuild} disabled={loading}>Rebuild Activity</button></article><article className="activity-admin-card danger"><h3>Reset current week</h3><p>Archive a snapshot, then clear this week's stored activity.</p><button className="secondary-btn" onClick={reset} disabled={loading}>Reset Week</button></article></div><SectionHead kicker="ARCHIVE" title="Recent snapshots." text="Manual reset snapshots are preserved here."/><div className="activity-archive-list">{(data.recentArchives||[]).length?data.recentArchives.map(item=><article key={item.id}><div><strong>{item.messageCount} messages</strong><span>{item.reason} • @{item.archivedBy}</span></div><span>{formatDate(item.archivedAt)}</span></article>):<Empty icon={Archive} title="No snapshots yet" text="Snapshots appear after a manual reset."/>}</div></div>;}

function InformationHub({user}){const mg=user.capabilities?.managementInfo,gov=user.capabilities?.governanceInfo;return <div className="page-stack"><SectionHead kicker="ROLE-AWARE RESOURCE CENTER" title="Information Hub." text="Bay Café guidance and server resources automatically unlock based on your rank."/><section className="info-hero"><div><Badge>SIP. RELAX. ENJOY THE BAY.</Badge><h2>Your staff guide,<em>all in one shoreline.</em></h2><p>Read your team expectations, find internal servers, and review leadership standards without digging through old Discord messages.</p></div><a className="primary-btn inline" href="https://discord.gg/ztPy6UKxY" target="_blank" rel="noreferrer">Public Discord<ExternalLink size={14}/></a></section>{gov&&<section className="info-section"><SectionHead kicker="GOVERNANCE TEAM" title="Corporate information." text="Enhanced permissions come with enhanced responsibility."/><div className="welcome-note"><BriefcaseBusiness size={20}/><div><strong>Hey Governance Team!</strong><p>Congratulations on making it here. You still need to follow the team standards while using the enhanced permissions that come with your role. Before beginning your trial, review the information below and contact Leadership if anything is unclear.</p></div></div><div className="info-grid two"><InfoBlock title="Core Requirements"><ul><li><strong>13+ Years Old</strong> — meet the minimum age requirement set by Roblox and Discord.</li><li><strong>Professional Conduct</strong> — act respectfully, maturely, and professionally.</li><li><strong>Zero-Tolerance Policy</strong> — exploiting, hacking, raiding, leaking confidential information, or toxic behavior may result in removal.</li><li><strong>Account Security</strong> — 2FA must remain enabled on Roblox and Discord.</li></ul></InfoBlock><InfoBlock title="Leadership & Integrity"><ul><li>Lead by example and demonstrate the standard expected from staff.</li><li>Enforce rules fairly without favoritism or bias.</li><li>Take responsibility for your decisions and actions.</li><li>Ignoring violations, abusing permissions, exploiting, or bending rules for personal benefit may result in disciplinary action.</li></ul></InfoBlock><InfoBlock title="Staff Supervision & Conflict Management"><ul><li>Support staff growth with guidance and answers.</li><li>Handle corrections calmly, respectfully, and privately when possible.</li><li>Remain neutral during disputes and gather information before deciding.</li><li>Avoid public criticism, arguing, favoritism, or escalating conflicts.</li></ul></InfoBlock><InfoBlock title="Activity & Performance"><ul><li>Remain consistently active within Bay Café.</li><li>Attend required trainings, meetings, shifts, and events when requested.</li><li>Complete assigned responsibilities accurately and efficiently.</li><li>Maintain teamwork and strong customer service.</li></ul></InfoBlock><InfoBlock title="Communication Expectations"><ul><li>Use clear, respectful, professional language.</li><li>Maintain maturity with customers, staff, and Leadership.</li><li>Respond to Leadership requests within a reasonable timeframe.</li><li>Avoid arguing, spamming, trolling, and unnecessary drama.</li></ul></InfoBlock><article className="server-links-card"><span className="eyebrow">CORPORATE SERVERS</span><a href="https://discord.gg/SrMHvhmhMR" target="_blank" rel="noreferrer"><div className="link-icon"><Link2 size={17}/></div><div><strong>Corporate / Mentorship Hub</strong><span>Guidance, logging, leadership support, and corporate development.</span></div><ExternalLink size={15}/></a><a href="https://discord.gg/yvySDe3fVv" target="_blank" rel="noreferrer"><div className="link-icon"><Link2 size={17}/></div><div><strong>Public Relations Corporates</strong><span>PR Corporate coordination and resources.</span></div><ExternalLink size={15}/></a></article></div></section>}{mg&&<section className="info-section"><SectionHead kicker="MANAGEMENT TEAM" title="Management information." text="Leadership begins with consistency, professionalism, and strong judgment."/><div className="welcome-note management"><Sparkles size={20}/><div><strong>Welcome to Management!</strong><p>Your hard work, dedication, and professionalism earned this position. Management members are expected to set an example through maturity, professionalism, and strong leadership at all times.</p></div></div><div className="info-grid two"><InfoBlock title="Activity Requirements"><p>Junior Directors, Senior Directors, and Head Directors must choose one weekly activity option:</p><ul><li>1 hour of in-game activity + 10 minutes of server activity (coming soon)</li><li>OR 2 hours of in-game activity + 5 minutes of server activity</li></ul><p>Bay Café is still under development, so some systems may not track activity automatically yet. Requirement changes will be announced as systems are updated.</p></InfoBlock><InfoBlock title="Support & Questions"><p>Use the support system for exploiter reports, general support inquiries, Management questions, and resignation requests.</p><p>Resignations should be handled privately and should not be publicly announced.</p></InfoBlock><InfoBlock title="Permissions & Responsibilities"><p>Management members have access to special in-game administrative commands used to assist staff and keep the environment professional.</p><p>Admin permissions are a privilege. Abuse, misuse, favoritism, or inappropriate use may result in disciplinary action, demotion, or removal.</p></InfoBlock><InfoBlock title="Final Notes"><p>Management members are role models for the community. Remain active, professional, respectful, and committed to helping Bay Café grow.</p></InfoBlock><article className="server-links-card single"><span className="eyebrow">MANAGEMENT SERVER</span><a href="https://discord.gg/SrMHvhmhMR" target="_blank" rel="noreferrer"><div className="link-icon"><Link2 size={17}/></div><div><strong>Bay Café Management Hub</strong><span>Management communication, guidance, and internal resources.</span></div><ExternalLink size={15}/></a></article></div></section>}{!mg&&<section className="locked-info"><ShieldCheck size={22}/><div><strong>Staff information is ready.</strong><p>Management and Governance resources automatically appear here if your Bay Café rank reaches those teams.</p></div></section>}</div>;}

function Profiles({token}){
  const[query,setQuery]=useState("");
  const[profile,setProfile]=useState(null);
  const[message,setMessage]=useState("");
  const[suggestions,setSuggestions]=useState([]);
  const[suggesting,setSuggesting]=useState(false);

  useEffect(()=>{
    const value=query.trim();

    if(!value){
      setSuggestions([]);
      setSuggesting(false);
      setMessage("");
      return;
    }

    let cancelled=false;

    const timeout=setTimeout(async()=>{
      setSuggesting(true);
      setMessage("");

      try{
        const result=await api(
          `/api/profiles/search?q=${encodeURIComponent(value)}`,
          {},
          token
        );

        if(cancelled)return;

        setSuggestions(result.results||[]);
      }catch(error){
        if(cancelled)return;
        setSuggestions([]);
        setMessage(error.message);
      }finally{
        if(!cancelled){
          setSuggesting(false);
        }
      }
    },120);

    return()=>{
      cancelled=true;
      clearTimeout(timeout);
    };
  },[query,token]);

  const openProfile=async username=>{
    setQuery(username);
    setSuggestions([]);
    setMessage("Loading profile...");
    setProfile(null);

    try{
      const result=await api(
        `/api/profiles/${encodeURIComponent(username)}`,
        {},
        token
      );

      setProfile(result.profile);
      setMessage("");
    }catch(error){
      setMessage(error.message);
    }
  };

  return <div className="page-stack">
    <SectionHead
      kicker="ROBLOX DIRECTORY"
      title="Profile lookup."
      text="Start typing any letter. Matching Bay Café members update live as you continue typing."
    />

    <div className="profile-search-wrap live-profile-search">
      <div className="profile-search">
        <Search size={17}/>
        <input
          value={query}
          onChange={event=>{
            setQuery(event.target.value);
            setProfile(null);
          }}
          placeholder="Start typing a Roblox name..."
          autoComplete="off"
          autoFocus
        />
        {query&&
          <button
            type="button"
            className="profile-clear"
            onClick={()=>{
              setQuery("");
              setSuggestions([]);
              setProfile(null);
              setMessage("");
            }}
            aria-label="Clear profile search"
          >
            <X size={14}/>
          </button>
        }
      </div>

      {query.trim()&&
        <div className="profile-suggestions live">
          {suggesting
            ? <div className="suggestion-loading">Searching Bay Café...</div>
            : suggestions.length
              ? suggestions.map(item=>
                <button
                  type="button"
                  key={item.id}
                  onClick={()=>openProfile(item.username)}
                >
                  <img src={item.avatar} alt=""/>
                  <div>
                    <strong>{item.displayName}</strong>
                    <span>@{item.username} • {item.roleName}</span>
                  </div>
                  <ChevronRight size={14}/>
                </button>
              )
              : <div className="suggestion-empty">No matching Bay Café members.</div>
          }
        </div>
      }
    </div>

    {profile&&
      <article className="profile-card">
        <img src={profile.avatar} alt=""/>
        <div className="profile-main">
          <Badge tone={profile.inGroup?"green":"sand"}>
            {profile.inGroup?"BAY CAFÉ MEMBER":"NOT IN GROUP"}
          </Badge>
          <h2>{profile.displayName}</h2>
          <span>@{profile.username}</span>
          <div className="profile-rank">
            <strong>{profile.roleName}</strong>
            <span>Rank {profile.roleRank}</span>
          </div>
          <p>{profile.description||"No Roblox About description."}</p>
          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="secondary-btn inline"
          >
            Open Roblox Profile<ExternalLink size={14}/>
          </a>
        </div>
      </article>
    }

    {message&&<div className="notice">{message}</div>}
  </div>;
}
function TicketsPage({token,user,items,reload,setToast}){const[form,setForm]=useState({type:"General Support",subject:"",details:""}),[selectedId,setSelectedId]=useState(""),[reply,setReply]=useState(""),[loading,setLoading]=useState(false);const selected=items.find(x=>x.id===selectedId)||items[0]||null;useEffect(()=>{if(!selectedId&&items[0])setSelectedId(items[0].id)},[items,selectedId]);const submit=async e=>{e.preventDefault();setLoading(true);try{const r=await api("/api/tickets",{method:"POST",body:JSON.stringify(form)},token);setForm({type:"General Support",subject:"",details:""});await reload();setSelectedId(r.ticket.id);setToast("Support ticket opened")}catch(err){setToast(err.message)}finally{setLoading(false)}};const sendReply=async e=>{e.preventDefault();if(!selected||!reply.trim())return;try{const r=await api(`/api/tickets/${selected.id}/messages`,{method:"POST",body:JSON.stringify({content:reply})},token);setReply("");await reload();setSelectedId(r.ticket.id)}catch(err){setToast(err.message)}};const closeTicket=async()=>{if(!selected)return;try{await api(`/api/tickets/${selected.id}/close`,{method:"POST"},token);await reload();setToast("Ticket closed")}catch(err){setToast(err.message)}};return <div className="page-stack"><SectionHead kicker="SUPPORT CENTER" title="Website support." text="Create a ticket here and continue the conversation from the website. Discord staff can reply through the linked thread when configured."/><div className="ticket-layout"><aside className="ticket-side"><form className="ticket-form" onSubmit={submit}><h3>New Ticket</h3><label><span>TYPE</span><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>General Support</option><option>Management Question</option><option>Exploiter Report</option><option>Resignation</option><option>Other</option></select></label><label><span>SUBJECT</span><input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Short summary"/></label><label><span>MESSAGE</span><textarea rows="5" value={form.details} onChange={e=>setForm({...form,details:e.target.value})} placeholder="Explain what you need help with..."/></label><button className="primary-btn" disabled={loading}>{loading?"Opening...":"Open Ticket"}<Ticket size={14}/></button></form><div className="ticket-list"><div className="ticket-list-head"><strong>{user.capabilities?.ticketAdmin?"All Tickets":"Your Tickets"}</strong><span>{items.length}</span></div>{items.map(item=><button key={item.id} className={selected?.id===item.id?"active":""} onClick={()=>setSelectedId(item.id)}><div><strong>{item.subject}</strong><span>{item.type}</span></div><Badge tone={item.status==="open"?"green":"sand"}>{item.status}</Badge></button>)}</div></aside><section className="ticket-thread">{selected?<><div className="ticket-thread-head"><div><span className="eyebrow">{selected.type}</span><h3>{selected.subject}</h3><small>{selected.id}</small></div><div className="thread-actions"><Badge tone={selected.status==="open"?"green":"sand"}>{selected.status}</Badge>{selected.status==="open"&&<button className="secondary-btn compact" onClick={closeTicket}>Close</button>}</div></div><div className="ticket-messages">{(selected.messages||[]).map(m=><article key={m.id} className={String(m.authorId)===String(user.id)?"mine":"staff"}><div><strong>{m.authorDisplayName||m.authorUsername}</strong><span>{m.authorType==="staff"?"STAFF":"USER"}</span><small>{formatDate(m.createdAt)}</small></div><p>{m.content}</p></article>)}</div>{selected.status==="open"?<form className="ticket-reply" onSubmit={sendReply}><textarea rows="3" value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write a reply..."/><button className="primary-btn">Send Reply<MessageCircleMore size={14}/></button></form>:<div className="closed-note">This ticket is closed.</div>}</>:<Empty icon={LifeBuoy} title="Select a ticket" text="Your support conversation will appear here."/>}</section></div></div>;}

export default function App(){const session=useSession();if(!session.user)return <Login onLogin={session.login} checking={session.checking}/>;if(session.user.accessMode==="community")return <CommunityDashboard token={session.token} user={session.user} onLogout={session.logout}/>;return <Dashboard token={session.token} user={session.user} onLogout={session.logout}/>;}
