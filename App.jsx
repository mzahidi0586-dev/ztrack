import { useState, useEffect } from "react";
import LOGO_SRC from "./logo.png";
import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const MONTH_FULL = ["April","May","June","July","August","September","October","November","December","January","February","March"];
const ADMIN_PASSWORD = "admin123";

const TAX_YEARS = ["2021/22","2022/23","2023/24","2024/25","2025/26","2026/27"];

const ALL_FIELDS = [
  { key:"rent",           label:"Rental Income",                 type:"income"  },
  { key:"otherIncome",    label:"Other Income / Parking",        type:"income"  },
  { key:"serviceCharges", label:"Service Charges",               type:"expense", group:"rri"     },
  { key:"councilTax",     label:"Rates (incl. when empty)",      type:"expense", group:"rri"     },
  { key:"water",          label:"Water Rates",                   type:"expense", group:"rri"     },
  { key:"gas",            label:"Gas",                           type:"expense", group:"rri"     },
  { key:"electricity",    label:"Electricity",                   type:"expense", group:"rri"     },
  { key:"insurance",      label:"Landlord & Building Insurance", type:"expense", group:"rri"     },
  { key:"contentsIns",    label:"Contents & Deposit Protection", type:"expense", group:"rri"     },
  { key:"broadband",      label:"TV / Tel / Broadband",          type:"expense", group:"rri"     },
  { key:"tvLicence",      label:"TV Licence / Adverts",          type:"expense", group:"rri"     },
  { key:"groundRent",     label:"Ground Rent",                   type:"expense", group:"rri"     },
  { key:"repairs",        label:"Repairs",                       type:"expense", group:"repairs" },
  { key:"gasCert",        label:"Gas Certificate",               type:"expense", group:"repairs" },
  { key:"electricCert",   label:"Electricity Certificate",       type:"expense", group:"repairs" },
  { key:"replacement",    label:"Replacement Furniture",         type:"expense", group:"repairs" },
  { key:"cleaning",       label:"End of Tenancy Cleaning",       type:"expense", group:"repairs" },
  { key:"agentCommission",label:"Agents Commission",             type:"expense", group:"legal"   },
  { key:"accountancy",    label:"Accountancy Fee",               type:"expense", group:"legal"   },
  { key:"otherExpenses",  label:"Other Expenses",                type:"expense", group:"legal"   },
  { key:"legalExpenses",  label:"Legal Expenses",                type:"expense", group:"legal"   },
  { key:"mortgage",       label:"Mortgage Interest",             type:"expense", group:"finance" },
  { key:"otherFinance",   label:"Other Finance Charges",         type:"expense", group:"finance" },
];

const INCOME_FIELDS  = ALL_FIELDS.filter(f => f.type === "income");
const EXPENSE_FIELDS = ALL_FIELDS.filter(f => f.type === "expense");
const QUARTERS = [
  { label: "Q1", months: ["Apr","May","Jun"], range: "Apr – Jun" },
  { label: "Q2", months: ["Jul","Aug","Sep"], range: "Jul – Sep" },
  { label: "Q3", months: ["Oct","Nov","Dec"], range: "Oct – Dec" },
  { label: "Q4", months: ["Jan","Feb","Mar"], range: "Jan – Mar" },
];
const RRI_KEYS    = ["serviceCharges","councilTax","water","gas","electricity","insurance","contentsIns","broadband","tvLicence","groundRent"];
const REPAIR_KEYS = ["repairs","gasCert","electricCert","replacement","cleaning"];
const LEGAL_KEYS  = ["agentCommission","accountancy","otherExpenses","legalExpenses"];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function makeEmptyData() {
  const d = {};
  MONTHS.forEach(m => { d[m] = {}; ALL_FIELDS.forEach(f => { d[m][f.key] = ""; }); });
  return d;
}
function fmt(val) {
  if (val===""||val===null||val===undefined) return "–";
  const n = parseFloat(val);
  if (isNaN(n)||n===0) return "–";
  return "£"+Math.abs(n).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function num(v) { const n=parseFloat(v); return isNaN(n)?0:n; }
function annualSum(data,key) { return MONTHS.reduce((s,m)=>s+num(data?.[m]?.[key]),0); }
function quarterSum(data,key,months) { return months.reduce((s,m)=>s+num(data?.[m]?.[key]),0); }
function quarterTotals(data,months) {
  const ti=months.reduce((s,m)=>s+INCOME_FIELDS.reduce((ss,f)=>ss+num(data?.[m]?.[f.key]),0),0);
  const te=months.reduce((s,m)=>s+EXPENSE_FIELDS.reduce((ss,f)=>ss+num(data?.[m]?.[f.key]),0),0);
  return {income:ti,expenses:te,net:ti-te};
}
function calcTotals(data) {
  const ti=MONTHS.reduce((s,m)=>s+INCOME_FIELDS.reduce((ss,f)=>ss+num(data?.[m]?.[f.key]),0),0);
  const te=MONTHS.reduce((s,m)=>s+EXPENSE_FIELDS.reduce((ss,f)=>ss+num(data?.[m]?.[f.key]),0),0);
  return {totalIncome:ti,totalExpenses:te,net:ti-te};
}
function storageKey(clientId, year, type) {
  return `zt-${clientId}-${year.replace("/","-")}-${type}`;
}

// ─── Mini Chart ────────────────────────────────────────────────────────────────
function MiniChart({data,color}) {
  const bars=MONTHS.map(m=>({
    month:m,
    income:INCOME_FIELDS.reduce((s,f)=>s+num(data?.[m]?.[f.key]),0),
    expenses:EXPENSE_FIELDS.reduce((s,f)=>s+num(data?.[m]?.[f.key]),0),
  }));
  const maxVal=Math.max(...bars.flatMap(b=>[b.income,b.expenses]),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:3,height:56,padding:"0 2px"}}>
      {bars.map(b=>(
        <div key={b.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <div style={{width:"100%",display:"flex",gap:1,alignItems:"flex-end",height:46}}>
            <div style={{flex:1,background:"#16a34a",borderRadius:"2px 2px 0 0",height:`${(b.income/maxVal)*46}px`,minHeight:b.income>0?2:0,transition:"height 0.4s",opacity:0.8}}/>
            <div style={{flex:1,background:"#dc2626",borderRadius:"2px 2px 0 0",height:`${(b.expenses/maxVal)*46}px`,minHeight:b.expenses>0?2:0,transition:"height 0.4s",opacity:0.7}}/>
          </div>
          <span style={{fontSize:8,color:"#94a3b8"}}>{b.month}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Delete Modal ──────────────────────────────────────────────────────────────
function DeleteModal({title,message,onConfirm,onCancel}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",borderRadius:20,padding:"32px 36px",width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.15)",textAlign:"center",fontFamily:"'DM Sans',sans-serif"}}>
        <div style={{width:56,height:56,background:"#fef2f2",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:24}}>🗑️</div>
        <h3 style={{margin:"0 0 10px",fontFamily:"'DM Serif Display',serif",color:"#0f172a",fontSize:20}}>{title}</h3>
        <p style={{margin:"0 0 28px",color:"#64748b",fontSize:14,lineHeight:1.6}} dangerouslySetInnerHTML={{__html:message}}/>
        <div style={{display:"flex",gap:12}}>
          <button onClick={onCancel} style={{flex:1,padding:"12px",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:10,color:"#475569",cursor:"pointer",fontSize:14,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>Cancel</button>
          <button onClick={onConfirm} style={{flex:1,padding:"12px",background:"#ef4444",border:"none",borderRadius:10,color:"white",cursor:"pointer",fontSize:14,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({clients, onLogin}) {
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");

  const handleLogin = () => {
    setError("");
    if (username.trim().toLowerCase()==="admin" && password===ADMIN_PASSWORD) {
      onLogin({id:"admin",name:"Admin",isAdmin:true});
      return;
    }
    const client = clients.find(c=>c.username.toLowerCase()===username.trim().toLowerCase() && c.password===password);
    if (client) { onLogin({...client,isAdmin:false}); return; }
    setError("Incorrect username or password.");
  };

  const inp={width:"100%",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",color:"#0f172a",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif",marginTop:6};

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{background:"#fff",borderRadius:24,padding:"40px 44px",width:400,boxShadow:"0 8px 40px rgba(0,0,0,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:32,justifyContent:"center"}}>
          <img src={LOGO_SRC} alt="ZTrack" style={{width:44,height:44,objectFit:"contain"}}/>
          <span style={{fontFamily:"'DM Serif Display',serif",fontSize:26,color:"#0f172a"}}>ZTrack</span>
        </div>
        <h2 style={{margin:"0 0 6px",fontFamily:"'DM Serif Display',serif",fontSize:20,color:"#0f172a",textAlign:"center"}}>Welcome back</h2>
        <p style={{margin:"0 0 28px",color:"#64748b",fontSize:13,textAlign:"center"}}>Sign in to your property portal</p>

        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,color:"#64748b",fontWeight:600,textTransform:"uppercase",letterSpacing:1.2}}>Username</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" style={inp} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,color:"#64748b",fontWeight:600,textTransform:"uppercase",letterSpacing:1.2}}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" style={inp} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
        </div>
        {error&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",color:"#dc2626",fontSize:13,marginBottom:16}}>{error}</div>}
        <button onClick={handleLogin}
          style={{width:"100%",padding:"13px",background:"#1e293b",border:"none",borderRadius:12,color:"white",cursor:"pointer",fontSize:15,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>
          Sign In
        </button>
        <p style={{margin:"20px 0 0",color:"#94a3b8",fontSize:11,textAlign:"center"}}>Admin: username "admin" · contact your administrator for access</p>
      </div>
    </div>
  );
}

// ─── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel({clients,onAddClient,onDeleteClient,onClose}) {
  const [name,setName]=useState("");
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [msg,setMsg]=useState("");

  const add = () => {
    if(!name.trim()||!username.trim()||!password.trim()){setMsg("All fields required.");return;}
    if(clients.find(c=>c.username.toLowerCase()===username.trim().toLowerCase())){setMsg("Username already taken.");return;}
    onAddClient({id:"c"+Date.now(),name:name.trim(),username:username.trim(),password,taxYears:["2024/25"]});
    setName("");setUsername("");setPassword("");setMsg("Client added ✓");
    setTimeout(()=>setMsg(""),2000);
  };

  const inp={width:"100%",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"9px 12px",color:"#0f172a",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",borderRadius:22,padding:32,width:560,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",fontFamily:"'DM Sans',sans-serif"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h3 style={{margin:0,fontFamily:"'DM Serif Display',serif",fontSize:22,color:"#0f172a"}}>Manage Clients</h3>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",color:"#475569",fontSize:13}}>Close</button>
        </div>

        {/* Add client form */}
        <div style={{background:"#f8fafc",borderRadius:14,padding:20,marginBottom:24,border:"1px solid #e2e8f0"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:1.2,marginBottom:14}}>Add New Client</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
            <div>
              <label style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Full Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="John Smith" style={{...inp,marginTop:4}}/>
            </div>
            <div>
              <label style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Username</label>
              <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="johnsmith" style={{...inp,marginTop:4}}/>
            </div>
            <div>
              <label style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Password</label>
              <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{...inp,marginTop:4}}/>
            </div>
          </div>
          <button onClick={add} style={{padding:"9px 20px",background:"#1e293b",border:"none",borderRadius:8,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>+ Add Client</button>
          {msg&&<span style={{marginLeft:12,fontSize:13,color:msg.includes("✓")?"#16a34a":"#dc2626"}}>{msg}</span>}
        </div>

        {/* Client list */}
        <div style={{fontSize:12,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:1.2,marginBottom:12}}>Existing Clients ({clients.length})</div>
        {clients.length===0?(
          <div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8",fontSize:13}}>No clients yet. Add one above.</div>
        ):(
          clients.map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",marginBottom:8}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:"#0f172a"}}>{c.name}</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>@{c.username} · {(c.taxYears||[]).join(", ")}</div>
              </div>
              <button onClick={()=>onDeleteClient(c.id)}
                style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:7,color:"#ef4444",cursor:"pointer",fontSize:12,padding:"5px 12px",fontFamily:"'DM Sans',sans-serif"}}
                onMouseEnter={e=>{e.currentTarget.style.background="#ef4444";e.currentTarget.style.color="white";}}
                onMouseLeave={e=>{e.currentTarget.style.background="#fef2f2";e.currentTarget.style.color="#ef4444";}}>
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Property Card ─────────────────────────────────────────────────────────────
function PropertyCard({property,data,onSelect,onDelete}) {
  const {totalIncome,totalExpenses,net}=calcTotals(data);
  return (
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:"20px 22px",position:"relative",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",transition:"all 0.2s",fontFamily:"'DM Sans',sans-serif"}}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 8px 30px ${property.color}22`;e.currentTarget.style.borderColor=`${property.color}60`;e.currentTarget.style.transform="translateY(-2px)";}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.transform="translateY(0)";}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:property.color,borderRadius:"16px 16px 0 0"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,marginTop:6}}>
        <div onClick={()=>onSelect(property.id)} style={{cursor:"pointer",flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:property.color,flexShrink:0}}/>
            <div style={{fontSize:15,fontWeight:600,color:"#0f172a",fontFamily:"'DM Serif Display',serif"}}>{property.name}</div>
          </div>
          <div style={{fontSize:11,color:"#94a3b8",paddingLeft:16}}>{property.address}</div>
        </div>
        <button onClick={()=>onDelete(property.id)}
          style={{marginLeft:10,flexShrink:0,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,color:"#94a3b8",cursor:"pointer",fontSize:11,padding:"5px 10px",fontFamily:"'DM Sans',sans-serif",fontWeight:500,display:"flex",alignItems:"center",gap:4,transition:"all 0.2s"}}
          onMouseEnter={e=>{e.currentTarget.style.background="#fef2f2";e.currentTarget.style.borderColor="#fca5a5";e.currentTarget.style.color="#ef4444";}}
          onMouseLeave={e=>{e.currentTarget.style.background="#f8fafc";e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.color="#94a3b8";}}>
          🗑 Delete
        </button>
      </div>
      <div onClick={()=>onSelect(property.id)} style={{cursor:"pointer"}}>
        <MiniChart data={data} color={property.color}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:14}}>
        {[{label:"INCOME",value:totalIncome,bg:"#f0fdf4",color:"#16a34a"},{label:"EXPENSES",value:totalExpenses,bg:"#fef2f2",color:"#dc2626"},{label:"NET",value:net,bg:net>=0?"#f0fdf4":"#fef2f2",color:net>=0?"#16a34a":"#dc2626"}].map(s=>(
          <div key={s.label} onClick={()=>onSelect(property.id)} style={{background:s.bg,borderRadius:10,padding:"8px 10px",cursor:"pointer"}}>
            <div style={{fontSize:9,color:s.color,marginBottom:3,fontWeight:700,letterSpacing:1}}>{s.label}</div>
            <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{fmt(s.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Add Property Modal ────────────────────────────────────────────────────────
function AddPropertyModal({onAdd,onClose}) {
  const [name,setName]=useState("");
  const [address,setAddress]=useState("");
  const COLORS=["#4f46e5","#db2777","#d97706","#059669","#2563eb","#7c3aed","#ef4444","#0891b2","#65a30d"];
  const [color,setColor]=useState(COLORS[0]);
  const inp={width:"100%",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"11px 14px",color:"#0f172a",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",borderRadius:22,padding:32,width:440,boxShadow:"0 20px 60px rgba(0,0,0,0.15)",fontFamily:"'DM Sans',sans-serif"}}>
        <h3 style={{color:"#0f172a",margin:"0 0 24px",fontFamily:"'DM Serif Display',serif",fontSize:22}}>Add New Property</h3>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600}}>Property Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Flat 12 Victoria Road" style={inp}/>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600}}>Address</label>
          <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Full address" style={inp}/>
        </div>
        <div style={{marginBottom:28}}>
          <label style={{display:"block",fontSize:11,color:"#64748b",marginBottom:10,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600}}>Colour Tag</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {COLORS.map(c=>(<div key={c} onClick={()=>setColor(c)} style={{width:30,height:30,borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid #0f172a":"3px solid transparent",transition:"all 0.2s"}}/>))}
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:12,background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:10,color:"#64748b",cursor:"pointer",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
          <button onClick={()=>{if(name.trim()){onAdd({name:name.trim(),address:address.trim(),color});onClose();}}} style={{flex:2,padding:12,background:color,border:"none",borderRadius:10,color:"white",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>Add Property</button>
        </div>
      </div>
    </div>
  );
}

// ─── Property Detail ───────────────────────────────────────────────────────────
function PropertyDetail({property,data,onChange,onBack}) {
  const [activeMonth,setActiveMonth]=useState(MONTHS[0]);
  const [editingCell,setEditingCell]=useState(null);
  const totals=calcTotals(data);
  const handleChange=(m,k,v)=>onChange(prev=>({...prev,[m]:{...prev[m],[k]:v}}));
  const mT=m=>{const i=INCOME_FIELDS.reduce((s,f)=>s+num(data?.[m]?.[f.key]),0);const e=EXPENSE_FIELDS.reduce((s,f)=>s+num(data?.[m]?.[f.key]),0);return{income:i,expenses:e,net:i-e};};
  const mt=mT(activeMonth);
  const groups=[
    {label:"INCOME",                 fields:INCOME_FIELDS,                             accentColor:property.color,bg:"#f0fdf4"},
    {label:"RENT, RATES & INSURANCE",fields:ALL_FIELDS.filter(f=>f.group==="rri"),     accentColor:"#dc2626",bg:"#fef2f2"},
    {label:"REPAIRS & RENEWALS",     fields:ALL_FIELDS.filter(f=>f.group==="repairs"), accentColor:"#d97706",bg:"#fffbeb"},
    {label:"LEGAL & MANAGEMENT",     fields:ALL_FIELDS.filter(f=>f.group==="legal"),   accentColor:"#7c3aed",bg:"#faf5ff"},
    {label:"FINANCE CHARGES",        fields:ALL_FIELDS.filter(f=>f.group==="finance"), accentColor:"#0891b2",bg:"#f0f9ff"},
  ];
  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",color:"#0f172a",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"18px 28px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
          <button onClick={onBack} style={{background:"#f1f5f9",border:"1px solid #e2e8f0",color:"#475569",cursor:"pointer",borderRadius:8,padding:"8px 14px",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>← Back</button>
          <div style={{width:10,height:10,borderRadius:"50%",background:property.color}}/>
          <h2 style={{margin:0,fontFamily:"'DM Serif Display',serif",fontSize:20,color:"#0f172a"}}>{property.name}</h2>
          <span style={{color:"#94a3b8",fontSize:13}}>{property.address}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {[{label:"Annual Income",value:fmt(totals.totalIncome),bg:"#f0fdf4",color:"#16a34a",border:"#bbf7d0"},{label:"Annual Expenses",value:fmt(totals.totalExpenses),bg:"#fef2f2",color:"#dc2626",border:"#fecaca"},{label:"Net Profit",value:fmt(totals.net),bg:totals.net>=0?"#f0fdf4":"#fef2f2",color:totals.net>=0?"#16a34a":"#dc2626",border:totals.net>=0?"#bbf7d0":"#fecaca"},{label:"Net Yield",value:totals.totalIncome>0?(totals.net/totals.totalIncome*100).toFixed(1)+"%":"–",bg:"#faf5ff",color:"#7c3aed",border:"#ddd6fe"}].map(s=>(
            <div key={s.label} style={{background:s.bg,borderRadius:12,padding:"14px 18px",border:`1px solid ${s.border}`}}>
              <div style={{fontSize:10,color:"#64748b",marginBottom:4,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600}}>{s.label}</div>
              <div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",height:"calc(100vh - 210px)"}}>
        <div style={{width:150,background:"#fff",borderRight:"1px solid #e2e8f0",padding:"12px 0",overflowY:"auto",flexShrink:0}}>
          {MONTHS.map((m,i)=>{const t=mT(m);const isA=m===activeMonth;return(
            <div key={m} onClick={()=>setActiveMonth(m)} style={{padding:"10px 16px",cursor:"pointer",background:isA?`${property.color}12`:"transparent",borderLeft:`3px solid ${isA?property.color:"transparent"}`,transition:"all 0.15s"}}>
              <div style={{fontSize:13,fontWeight:isA?600:400,color:isA?"#0f172a":"#64748b"}}>{MONTH_FULL[i]}</div>
              <div style={{fontSize:11,color:t.net>=0?"#16a34a":"#dc2626",marginTop:1}}>{t.income>0||t.expenses>0?fmt(t.net):"—"}</div>
            </div>
          );})}
        </div>
        <div style={{flex:1,overflow:"auto",padding:"22px 26px",background:"#f8fafc"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <h3 style={{margin:0,fontFamily:"'DM Serif Display',serif",color:"#0f172a",fontSize:18}}>{MONTH_FULL[MONTHS.indexOf(activeMonth)]}</h3>
            <div style={{display:"flex",gap:18,fontSize:13}}>
              <span style={{color:"#16a34a"}}>Income: <strong>{fmt(mt.income)}</strong></span>
              <span style={{color:"#dc2626"}}>Expenses: <strong>{fmt(mt.expenses)}</strong></span>
              <span style={{color:mt.net>=0?"#16a34a":"#dc2626"}}>Net: <strong>{fmt(mt.net)}</strong></span>
            </div>
          </div>
          {groups.map(grp=>(
            <div key={grp.label} style={{marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:3,height:16,background:grp.accentColor,borderRadius:2}}/>
                <span style={{fontSize:10,color:grp.accentColor,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>{grp.label}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
                {grp.fields.map(f=>{
                  const val=data?.[activeMonth]?.[f.key]??"";
                  const cellId=`${activeMonth}-${f.key}`;
                  const isE=editingCell===cellId;
                  return(
                    <div key={f.key} onClick={()=>setEditingCell(cellId)} style={{background:"#fff",borderRadius:10,padding:"10px 14px",border:`1px solid ${isE?grp.accentColor+"80":"#e2e8f0"}`,cursor:"pointer",transition:"border 0.2s",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
                      <div style={{fontSize:10,color:"#94a3b8",marginBottom:4,fontWeight:500}}>{f.label}</div>
                      {isE?(
                        <input autoFocus value={val} onChange={e=>handleChange(activeMonth,f.key,e.target.value)} onBlur={()=>setEditingCell(null)} onKeyDown={e=>e.key==="Enter"&&setEditingCell(null)} placeholder="0.00"
                          style={{background:"transparent",border:"none",outline:"none",color:"#0f172a",fontSize:15,fontWeight:700,width:"100%",fontFamily:"'DM Sans',sans-serif"}}/>
                      ):(
                        <div style={{fontSize:15,fontWeight:700,color:val?(f.type==="income"?"#16a34a":"#0f172a"):"#e2e8f0"}}>{val?fmt(val):"£ —"}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{width:190,background:"#fff",borderLeft:"1px solid #e2e8f0",padding:"16px 14px",overflowY:"auto",flexShrink:0}}>
          <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1.2,fontWeight:700,marginBottom:14}}>Annual Totals</div>
          {ALL_FIELDS.map(f=>{const a=annualSum(data,f.key);if(a===0)return null;return(
            <div key={f.key} style={{marginBottom:10,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>
              <div style={{fontSize:10,color:"#94a3b8"}}>{f.label}</div>
              <div style={{fontSize:13,fontWeight:700,color:f.type==="income"?"#16a34a":"#0f172a"}}>{fmt(a)}</div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

// ─── Quarterly Report ─────────────────────────────────────────────────────────
function QuarterlyReport({properties,allData,taxYear}) {
  if(properties.length===0) return(
    <div style={{padding:"80px 0",textAlign:"center",color:"#94a3b8",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{fontSize:48,marginBottom:14}}>📊</div>
      <div style={{fontSize:17,fontFamily:"'DM Serif Display',serif",color:"#475569"}}>No properties for {taxYear}</div>
    </div>
  );
  return(
    <div style={{padding:"28px 32px",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{marginBottom:22}}>
        <h2 style={{margin:0,fontFamily:"'DM Serif Display',serif",color:"#0f172a",fontSize:26}}>Quarterly Report</h2>
        <p style={{margin:"5px 0 0",color:"#64748b",fontSize:13}}>Income & expenses by quarter · {taxYear}</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:24}}>
        {QUARTERS.map(q=>{
          const rows=properties.map(p=>{
            const t=quarterTotals(allData[p.id]||{},q.months);
            return{...p,...t};
          });
          const totalIncome=rows.reduce((s,r)=>s+r.income,0);
          const totalExpenses=rows.reduce((s,r)=>s+r.expenses,0);
          const totalNet=rows.reduce((s,r)=>s+r.net,0);
          return(
            <div key={q.label} style={{borderRadius:14,border:"1px solid #e2e8f0",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.06)"}}>
              <div style={{background:"#f8fafc",padding:"14px 20px",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",gap:14}}>
                <div style={{background:"#1e293b",color:"white",fontWeight:700,fontSize:13,padding:"4px 12px",borderRadius:7}}>{q.label}</div>
                <div style={{fontSize:14,fontWeight:600,color:"#0f172a"}}>{q.range}</div>
                <div style={{marginLeft:"auto",display:"flex",gap:10}}>
                  {[{l:"Income",v:totalIncome,c:"#16a34a",bg:"#f0fdf4"},{l:"Expenses",v:totalExpenses,c:"#dc2626",bg:"#fef2f2"},{l:"Net",v:totalNet,c:totalNet>=0?"#16a34a":"#dc2626",bg:totalNet>=0?"#f0fdf4":"#fef2f2"}].map((s,i)=>(
                    <div key={i} style={{background:s.bg,padding:"4px 12px",borderRadius:7,display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.8,fontWeight:600}}>{s.l}</span>
                      <span style={{fontSize:13,fontWeight:700,color:s.c}}>{s.v!==0?fmt(s.v):"–"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
                  <thead>
                    <tr style={{background:"#f8fafc"}}>
                      <th style={{padding:"10px 18px",textAlign:"left",color:"#475569",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,borderBottom:"1px solid #e2e8f0"}}>Property</th>
                      {q.months.map(m=><th key={m} style={{padding:"10px 12px",textAlign:"right",color:"#475569",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,borderBottom:"1px solid #e2e8f0"}}>{m}</th>)}
                      <th style={{padding:"10px 12px",textAlign:"right",color:"#16a34a",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,borderBottom:"1px solid #e2e8f0",borderLeft:"1px solid #e2e8f0"}}>Income</th>
                      <th style={{padding:"10px 12px",textAlign:"right",color:"#dc2626",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,borderBottom:"1px solid #e2e8f0"}}>Expenses</th>
                      <th style={{padding:"10px 12px",textAlign:"right",color:"#7c3aed",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,borderBottom:"1px solid #e2e8f0"}}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i)=>{
                      const monthNets=q.months.map(m=>({
                        m,
                        v:INCOME_FIELDS.reduce((s,f)=>s+num(allData[r.id]?.[m]?.[f.key]),0)-EXPENSE_FIELDS.reduce((s,f)=>s+num(allData[r.id]?.[m]?.[f.key]),0)
                      }));
                      return(
                        <tr key={r.id} style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fafbfc"}}>
                          <td style={{padding:"9px 18px",fontSize:13,color:r.color,fontWeight:600}}>{r.name}</td>
                          {monthNets.map(({m,v})=>(
                            <td key={m} style={{padding:"9px 12px",textAlign:"right",fontSize:12,color:v>0?"#16a34a":v<0?"#dc2626":"#cbd5e1",fontWeight:v!==0?600:400}}>{v!==0?fmt(v):"–"}</td>
                          ))}
                          <td style={{padding:"9px 12px",textAlign:"right",fontSize:13,fontWeight:700,color:r.income>0?"#16a34a":"#cbd5e1",borderLeft:"1px solid #e2e8f0"}}>{r.income>0?fmt(r.income):"–"}</td>
                          <td style={{padding:"9px 12px",textAlign:"right",fontSize:13,fontWeight:700,color:r.expenses>0?"#dc2626":"#cbd5e1"}}>{r.expenses>0?fmt(r.expenses):"–"}</td>
                          <td style={{padding:"9px 12px",textAlign:"right",fontSize:13,fontWeight:700,color:r.net>0?"#16a34a":r.net<0?"#dc2626":"#cbd5e1"}}>{r.net!==0?fmt(r.net):"–"}</td>
                        </tr>
                      );
                    })}
                    {properties.length>1&&(
                      <tr style={{background:"#f8fafc",borderTop:"2px solid #e2e8f0"}}>
                        <td style={{padding:"10px 18px",fontSize:13,fontWeight:700,color:"#1e293b"}}>Total</td>
                        {q.months.map(m=>{
                          const mv=properties.reduce((s,p)=>{
                            const inc=INCOME_FIELDS.reduce((ss,f)=>ss+num(allData[p.id]?.[m]?.[f.key]),0);
                            const exp=EXPENSE_FIELDS.reduce((ss,f)=>ss+num(allData[p.id]?.[m]?.[f.key]),0);
                            return s+(inc-exp);
                          },0);
                          return <td key={m} style={{padding:"10px 12px",textAlign:"right",fontSize:12,fontWeight:700,color:mv>0?"#16a34a":mv<0?"#dc2626":"#cbd5e1"}}>{mv!==0?fmt(mv):"–"}</td>;
                        })}
                        <td style={{padding:"10px 12px",textAlign:"right",fontSize:13,fontWeight:700,color:totalIncome>0?"#16a34a":"#cbd5e1",borderLeft:"1px solid #e2e8f0"}}>{totalIncome>0?fmt(totalIncome):"–"}</td>
                        <td style={{padding:"10px 12px",textAlign:"right",fontSize:13,fontWeight:700,color:totalExpenses>0?"#dc2626":"#cbd5e1"}}>{totalExpenses>0?fmt(totalExpenses):"–"}</td>
                        <td style={{padding:"10px 12px",textAlign:"right",fontSize:13,fontWeight:700,color:totalNet>0?"#16a34a":totalNet<0?"#dc2626":"#cbd5e1"}}>{totalNet!==0?fmt(totalNet):"–"}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tax Summary ───────────────────────────────────────────────────────────────
function TaxReturnSummary({properties,allData}) {
  const propIds=properties.map(p=>p.id);
  const pA=(id,key)=>annualSum(allData[id]||{},key);
  const calc=id=>{
    const rentalIncome=pA(id,"rent"),otherIncome=pA(id,"otherIncome"),totalRevenue=rentalIncome+otherIncome;
    const rriTotal=RRI_KEYS.reduce((s,k)=>s+pA(id,k),0),repairsTotal=REPAIR_KEYS.reduce((s,k)=>s+pA(id,k),0),legalTotal=LEGAL_KEYS.reduce((s,k)=>s+pA(id,k),0);
    const mortgage=pA(id,"mortgage"),otherFinance=pA(id,"otherFinance"),financeTotal=mortgage+otherFinance;
    const totalExpenses=rriTotal+repairsTotal+legalTotal+financeTotal,netIncome=totalRevenue-totalExpenses,grossIncome=netIncome+mortgage;
    return {rentalIncome,otherIncome,totalRevenue,rriTotal,repairsTotal,legalTotal,financeTotal,mortgage,otherFinance,totalExpenses,netIncome,grossIncome};
  };
  const allCalc={};propIds.forEach(id=>{allCalc[id]=calc(id);});
  const grand=key=>propIds.reduce((s,id)=>s+(allCalc[id][key]||0),0);
  const grandF=field=>propIds.reduce((s,id)=>s+pA(id,field),0);
  const hlColor=(hl,val)=>hl==="income"?"#16a34a":hl==="expense"?"#dc2626":hl==="net"?(val>=0?"#16a34a":"#dc2626"):"#475569";
  const hlBg=(hl,val)=>hl==="income"?"#f0fdf4":hl==="expense"?"#fef2f2":hl==="net"?(val>=0?"#f0fdf4":"#fef2f2"):"transparent";

  const rows=[
    {type:"section",label:"Income"},{type:"noterow",label:"Months (Apr – Mar)"},
    {label:"Rental Income",indent:1,field:"rent"},{label:"Other Income – Parking",indent:1,field:"otherIncome"},
    {label:"Total Revenue",isTotal:true,calcKey:"totalRevenue",hl:"income",bold:true},{type:"spacer"},
    {type:"section",label:"Expenses"},{type:"subheader",label:"Rent, Rates & Insurance"},
    {label:"Service Charges",indent:1,field:"serviceCharges"},{label:"Rates (including when empty)",indent:1,field:"councilTax"},
    {label:"Water Rates",indent:1,field:"water"},{label:"Gas",indent:1,field:"gas"},{label:"Electricity",indent:1,field:"electricity"},
    {label:"Landlord & Building Insurance",indent:1,field:"insurance"},{label:"Content Insurance & Deposit Protection",indent:1,field:"contentsIns"},
    {label:"TV, Tel / Broadband",indent:1,field:"broadband"},{label:"TV Licence / Adverts",indent:1,field:"tvLicence"},{label:"Ground Rent",indent:1,field:"groundRent"},
    {label:"(Rent, Rates & Insurance)",isTotal:true,calcKey:"rriTotal",hl:"expense",italic:true},{type:"spacer"},
    {type:"subheader",label:"Repairs & Renewals"},
    {label:"Repairs",indent:1,field:"repairs"},{label:"Gas Certificate",indent:1,field:"gasCert"},{label:"Electricity Certificate",indent:1,field:"electricCert"},
    {label:"Replacement Furniture",indent:1,field:"replacement"},{label:"End of Tenancy Cleaning",indent:1,field:"cleaning"},
    {label:"Repairs & Renewals",isTotal:true,calcKey:"repairsTotal",hl:"expense",italic:true},{type:"spacer"},
    {type:"subheader",label:"Legal, Management"},
    {label:"Agents Commission",indent:1,field:"agentCommission"},{label:"Accountancy Fee",indent:1,field:"accountancy"},
    {label:"Other Expenses",indent:1,field:"otherExpenses"},{label:"Legal Expenses",indent:1,field:"legalExpenses"},
    {label:"Cost of Service Provided",isTotal:true,calcKey:"legalTotal",hl:"expense",italic:true},{type:"spacer"},
    {type:"subheader",label:"Finance Charges"},
    {label:"Mortgage Interest",indent:1,field:"mortgage"},{label:"Other Finance Charges",indent:1,field:"otherFinance"},
    {label:"Mortgage Interest",isTotal:true,calcKey:"financeTotal",hl:"expense",italic:true},
    {type:"divider"},{label:"Total Expenses",isTotal:true,calcKey:"totalExpenses",hl:"expense",bold:true},
    {label:"Net Property Income",isTotal:true,calcKey:"netIncome",hl:"net",bold:true},{type:"divider"},
    {label:"Add 100% of Mortgage Interest",indent:1,field:"mortgage",hl:"neutral"},
    {label:"Total Gross Income",isTotal:true,calcKey:"grossIncome",hl:"income",bold:true,doubleLine:true},
  ];

  return (
    <div style={{padding:"28px 32px",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{marginBottom:22}}>
        <h2 style={{margin:0,fontFamily:"'DM Serif Display',serif",color:"#0f172a",fontSize:26}}>Tax Return Summary</h2>
        <p style={{margin:"5px 0 0",color:"#64748b",fontSize:13}}>Property income statement · aligned to HMRC SA105</p>
      </div>
      <div style={{borderRadius:14,border:"1px solid #e2e8f0",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.06)"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
            <thead>
              <tr style={{background:"#f8fafc"}}>
                <th style={{padding:"13px 18px",textAlign:"left",color:"#475569",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,borderBottom:"2px solid #e2e8f0",minWidth:280,position:"sticky",left:0,background:"#f8fafc"}}>Item</th>
                {properties.map(p=><th key={p.id} style={{padding:"13px 14px",textAlign:"right",color:p.color,fontSize:12,fontWeight:700,borderBottom:"2px solid #e2e8f0",minWidth:130,whiteSpace:"nowrap"}}>{p.name}</th>)}
                <th style={{padding:"13px 14px",textAlign:"right",color:"#7c3aed",fontSize:12,fontWeight:700,borderBottom:"2px solid #e2e8f0",minWidth:130,borderLeft:"2px solid #e2e8f0"}}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row,ri)=>{
                if(row.type==="divider") return <tr key={ri}><td colSpan={properties.length+2} style={{padding:0,borderTop:"2px solid #e2e8f0",background:"#f8fafc"}}/></tr>;
                if(row.type==="spacer")  return <tr key={ri}><td colSpan={properties.length+2} style={{height:4,background:"#f8fafc"}}/></tr>;
                if(row.type==="section") return <tr key={ri} style={{background:"#f1f5f9"}}><td colSpan={properties.length+2} style={{padding:"12px 18px 4px",fontFamily:"'DM Serif Display',serif",fontSize:14,color:"#475569"}}>{row.label}</td></tr>;
                if(row.type==="subheader") return <tr key={ri} style={{background:"#f8fafc"}}><td colSpan={properties.length+2} style={{padding:"10px 18px 4px 22px",fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:1.4}}>{row.label}</td></tr>;
                if(row.type==="noterow") return <tr key={ri} style={{background:"#fff"}}><td style={{padding:"6px 18px",fontSize:11,color:"#94a3b8",fontStyle:"italic"}}>{row.label}</td>{properties.map(p=><td key={p.id}/>)}<td/></tr>;
                const getVal=id=>row.calcKey?(allCalc[id][row.calcKey]||0):pA(id,row.field);
                const grandVal=row.calcKey?grand(row.calcKey):grandF(row.field);
                const isTotal=row.isTotal,rowBg=isTotal?"#f8fafc":"#fff",bt=row.doubleLine?"3px double #cbd5e1":undefined;
                return(
                  <tr key={ri} style={{background:rowBg,borderTop:bt}}>
                    <td style={{padding:`${isTotal?10:7}px 18px ${isTotal?10:7}px ${18+(row.indent||0)*18}px`,fontSize:isTotal?13:12,color:isTotal?"#1e293b":"#475569",fontWeight:row.bold?700:(isTotal?600:400),borderBottom:"1px solid #f1f5f9",fontStyle:row.italic?"italic":"normal",position:"sticky",left:0,background:rowBg}}>{row.label}</td>
                    {properties.map(p=>{const v=getVal(p.id);return<td key={p.id} style={{padding:`${isTotal?10:7}px 14px`,textAlign:"right",fontSize:isTotal?13:12,fontWeight:row.bold?700:(isTotal?600:400),color:v===0?"#e2e8f0":hlColor(row.hl,v),borderBottom:"1px solid #f1f5f9",background:isTotal&&v!==0?hlBg(row.hl,v)+"40":"transparent",whiteSpace:"nowrap"}}>{v!==0?fmt(v):""}</td>;})}
                    <td style={{padding:`${isTotal?10:7}px 14px`,textAlign:"right",fontSize:isTotal?13:12,fontWeight:row.bold?700:(isTotal?600:400),color:grandVal===0?"#e2e8f0":hlColor(row.hl,grandVal),borderBottom:"1px solid #f1f5f9",borderLeft:"2px solid #e2e8f0",background:isTotal&&grandVal!==0?hlBg(row.hl,grandVal):"transparent",whiteSpace:"nowrap"}}>{grandVal!==0?fmt(grandVal):""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard (per client + year) ───────────────────────────────────────
function Dashboard({currentUser, onLogout, clients, onClientsChange}) {
  const [activeTab,setActiveTab]=useState("properties");
  const [selectedProperty,setSelected]=useState(null);
  const [showAddModal,setShowAdd]=useState(false);
  const [showAdminPanel,setShowAdminPanel]=useState(false);
  const [deleteTarget,setDeleteTarget]=useState(null);

  // Which client's data to show (admin can switch)
  const [viewingClientId,setViewingClientId]=useState(currentUser.isAdmin ? (clients[0]?.id||"admin") : currentUser.id);
  const viewingClient = currentUser.isAdmin ? (clients.find(c=>c.id===viewingClientId)||clients[0]) : currentUser;

  // Active tax year per client
  const defaultYear = "2024/25";
  const [activeTaxYear, setActiveTaxYear] = useState(defaultYear);

  // Available tax years for this client
  const clientTaxYears = viewingClient?.taxYears || [defaultYear];

  // Make sure activeTaxYear is valid for this client
  useEffect(()=>{
    if(clientTaxYears.length>0 && !clientTaxYears.includes(activeTaxYear)){
      setActiveTaxYear(clientTaxYears[clientTaxYears.length-1]);
    }
  },[viewingClientId]);

  // Storage keys scoped to client + year
  const propsKey = viewingClient ? storageKey(viewingClient.id, activeTaxYear, "props") : null;
  const dataKey  = viewingClient ? storageKey(viewingClient.id, activeTaxYear, "data")  : null;

  const [properties,setProperties]=useState([]);
  const [allData,setAllData]=useState({});
  const [loaded,setLoaded]=useState(false);

  // Load data when client or year changes
  useEffect(()=>{
    if(!propsKey) return;
    setLoaded(false);
    (async()=>{
      try{
        const sp = await getDoc(doc(db, "ztStore", propsKey));
        const sd = await getDoc(doc(db, "ztStore", dataKey));
        setProperties(sp.exists() ? sp.data().value : []);
        setAllData(sd.exists() ? sd.data().value : {});
      } catch(e){ setProperties([]); setAllData({}); }
      setLoaded(true);
    })();
  },[propsKey,dataKey]);

  // Save on change
  useEffect(()=>{ if(loaded&&propsKey) setDoc(doc(db,"ztStore",propsKey),{value:properties}); },[properties,loaded]);
  useEffect(()=>{ if(loaded&&dataKey)  setDoc(doc(db,"ztStore",dataKey),{value:allData}); },[allData,loaded]);

  const addProperty=prop=>{const id="p"+Date.now();setProperties(prev=>[...prev,{...prop,id}]);setAllData(prev=>({...prev,[id]:makeEmptyData()}));};
  const confirmDelete=()=>{const id=deleteTarget;setProperties(prev=>prev.filter(p=>p.id!==id));setAllData(prev=>{const d={...prev};delete d[id];return d;});setDeleteTarget(null);};
  const updateData=id=>updater=>setAllData(prev=>({...prev,[id]:typeof updater==="function"?updater(prev[id]):updater}));

  // Add tax year to a client
  const addTaxYearToClient = (clientId, year) => {
    const updated = clients.map(c=>c.id===clientId?{...c,taxYears:[...(c.taxYears||[]),year]}:c);
    onClientsChange(updated);
  };
  const removeTaxYear = (year) => {
    if(clientTaxYears.length<=1){alert("Cannot remove the only tax year.");return;}
    const updated = clients.map(c=>c.id===viewingClient.id?{...c,taxYears:(c.taxYears||[]).filter(y=>y!==year)}:c);
    onClientsChange(updated);
    if(activeTaxYear===year) setActiveTaxYear(clientTaxYears.filter(y=>y!==year)[0]);
  };

  const grandIncome  =properties.reduce((s,p)=>s+calcTotals(allData[p.id]||{}).totalIncome,0);
  const grandExpenses=properties.reduce((s,p)=>s+calcTotals(allData[p.id]||{}).totalExpenses,0);
  const grandNet     =grandIncome-grandExpenses;

  if(selectedProperty){
    const prop=properties.find(p=>p.id===selectedProperty);
    if(!prop){setSelected(null);return null;}
    return <PropertyDetail property={prop} data={allData[selectedProperty]||makeEmptyData()} onChange={updateData(selectedProperty)} onBack={()=>setSelected(null)}/>;
  }

  const availableYearsToAdd = TAX_YEARS.filter(y=>!clientTaxYears.includes(y));

  return(
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"'DM Sans',sans-serif"}}>

      {deleteTarget&&<DeleteModal title="Delete Property?" message={`Are you sure you want to delete <strong>"${properties.find(p=>p.id===deleteTarget)?.name||""}"</strong>? All data will be permanently removed.`} onConfirm={confirmDelete} onCancel={()=>setDeleteTarget(null)}/>}
      {showAdminPanel&&<AdminPanel clients={clients} onAddClient={c=>onClientsChange([...clients,c])} onDeleteClient={id=>onClientsChange(clients.filter(c=>c.id!==id))} onClose={()=>setShowAdminPanel(false)}/>}
      {showAddModal&&<AddPropertyModal onAdd={addProperty} onClose={()=>setShowAdd(false)}/>}

      {/* Nav */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 28px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:62}}>

          {/* Brand */}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src={LOGO_SRC} alt="ZTrack" style={{width:36,height:36,objectFit:"contain"}}/>
            <span style={{fontFamily:"'DM Serif Display',serif",fontSize:21,color:"#0f172a"}}>ZTrack</span>
          </div>

          {/* Client switcher (admin only) */}
          {currentUser.isAdmin&&clients.length>0&&(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:12,color:"#94a3b8",fontWeight:600}}>CLIENT:</span>
              <select value={viewingClientId} onChange={e=>{setViewingClientId(e.target.value);setSelected(null);}}
                style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 10px",fontSize:13,color:"#0f172a",fontFamily:"'DM Sans',sans-serif",cursor:"pointer",outline:"none"}}>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Tax year tabs */}
          {viewingClient&&(
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginRight:4}}>Tax Year:</span>
              <div style={{display:"flex",gap:4,background:"#f1f5f9",padding:3,borderRadius:10,border:"1px solid #e2e8f0"}}>
                {clientTaxYears.map(y=>(
                  <div key={y} style={{display:"flex",alignItems:"center",gap:0}}>
                    <button onClick={()=>setActiveTaxYear(y)}
                      style={{padding:"6px 14px",borderRadius:7,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s",
                        background:activeTaxYear===y?"#1e293b":"transparent",color:activeTaxYear===y?"white":"#64748b"}}>
                      {y}
                    </button>
                    {currentUser.isAdmin&&clientTaxYears.length>1&&(
                      <button onClick={()=>removeTaxYear(y)}
                        title="Remove year" style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:10,padding:"0 2px 0 0",lineHeight:1}}
                        onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color="#cbd5e1"}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              {currentUser.isAdmin&&availableYearsToAdd.length>0&&(
                <select defaultValue="" onChange={e=>{if(e.target.value){addTaxYearToClient(viewingClient.id,e.target.value);setActiveTaxYear(e.target.value);e.target.value="";}}}
                  style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#475569",fontFamily:"'DM Sans',sans-serif",cursor:"pointer",outline:"none"}}>
                  <option value="">+ Add year</option>
                  {availableYearsToAdd.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Right side */}
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{display:"flex",gap:2,background:"#f1f5f9",padding:3,borderRadius:10,border:"1px solid #e2e8f0"}}>
              {[["properties","Properties"],["quarterly","Quarterly"],["summary","Tax Summary"]].map(([tab,lbl])=>(
                <button key={tab} onClick={()=>setActiveTab(tab)}
                  style={{padding:"6px 16px",borderRadius:7,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,transition:"all 0.2s",fontFamily:"'DM Sans',sans-serif",
                    background:activeTab===tab?"#1e293b":"transparent",color:activeTab===tab?"white":"#64748b"}}>
                  {lbl}
                </button>
              ))}
            </div>
            {currentUser.isAdmin&&(
              <button onClick={()=>setShowAdminPanel(true)}
                style={{padding:"7px 14px",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:9,color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>
                ⚙️ Clients
              </button>
            )}
            <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:8,borderLeft:"1px solid #e2e8f0"}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,fontWeight:600,color:"#0f172a"}}>{currentUser.isAdmin?"Admin":currentUser.name}</div>
                <div style={{fontSize:10,color:"#94a3b8"}}>{currentUser.isAdmin?"Administrator":"Client"}</div>
              </div>
              <button onClick={onLogout}
                style={{padding:"7px 12px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,color:"#ef4444",cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"10px 28px",display:"flex",gap:16,alignItems:"center"}}>
        <span style={{fontSize:12,color:"#94a3b8",fontWeight:600}}>{viewingClient?.name||""} · {activeTaxYear}</span>
        <div style={{width:1,height:20,background:"#e2e8f0"}}/>
        {[{label:"Total Income",value:grandIncome,color:"#16a34a",bg:"#f0fdf4"},{label:"Total Expenses",value:grandExpenses,color:"#dc2626",bg:"#fef2f2"},{label:"Net Profit",value:grandNet,color:grandNet>=0?"#16a34a":"#dc2626",bg:grandNet>=0?"#f0fdf4":"#fef2f2"}].map((s,i)=>(
          <div key={i} style={{background:s.bg,padding:"5px 14px",borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.8,fontWeight:600}}>{s.label}</span>
            <span style={{fontSize:14,fontWeight:700,color:s.color}}>{fmt(s.value)}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      {!loaded?(
        <div style={{textAlign:"center",padding:"80px 0",color:"#94a3b8"}}>Loading...</div>
      ):activeTab==="properties"?(
        <div style={{padding:"28px 32px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:24}}>
            <div>
              <h1 style={{margin:0,fontFamily:"'DM Serif Display',serif",fontSize:28,color:"#0f172a"}}>Properties</h1>
              <p style={{margin:"4px 0 0",color:"#94a3b8",fontSize:13}}>{properties.length} propert{properties.length!==1?"ies":"y"} · {activeTaxYear}</p>
            </div>
            <button onClick={()=>setShowAdd(true)}
              style={{padding:"10px 20px",background:"#1e293b",border:"none",borderRadius:11,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>
              + Add Property
            </button>
          </div>
          {properties.length===0?(
            <div style={{textAlign:"center",padding:"80px 0",color:"#94a3b8"}}>
              <div style={{fontSize:48,marginBottom:14}}>🏠</div>
              <div style={{fontSize:17,fontFamily:"'DM Serif Display',serif",color:"#475569",marginBottom:5}}>No properties for {activeTaxYear}</div>
              <div style={{fontSize:13}}>Click "+ Add Property" to get started</div>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(330px,1fr))",gap:18}}>
              {properties.map(p=>(
                <PropertyCard key={p.id} property={p} data={allData[p.id]||makeEmptyData()} onSelect={setSelected} onDelete={setDeleteTarget}/>
              ))}
            </div>
          )}
        </div>
      ):activeTab==="quarterly"?(
        <QuarterlyReport properties={properties} allData={allData} taxYear={activeTaxYear}/>
      ):(
        <TaxReturnSummary properties={properties} allData={allData}/>
      )}
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  useEffect(()=>{
    const s=document.createElement("style");
    s.textContent="@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');";
    document.head.appendChild(s);
    return()=>document.head.removeChild(s);
  },[]);

  // Load clients list from Firestore
  useEffect(()=>{
    (async()=>{
      try{
        const snap = await getDoc(doc(db, "ztStore", "zt-clients-v1"));
        if(snap.exists()) setClients(snap.data().value || []);
      } catch(e){}
      setClientsLoaded(true);
    })();
  },[]);

  // Save clients to Firestore
  const updateClients = (newClients) => {
    setClients(newClients);
    setDoc(doc(db, "ztStore", "zt-clients-v1"), { value: newClients });
  };

  if(!clientsLoaded) return <div style={{minHeight:"100vh",background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",color:"#94a3b8"}}>Loading...</div>;

  if(!currentUser) return <LoginScreen clients={clients} onLogin={setCurrentUser}/>;

  return (
    <Dashboard
      currentUser={currentUser}
      onLogout={()=>setCurrentUser(null)}
      clients={clients}
      onClientsChange={updateClients}
    />
  );
}
