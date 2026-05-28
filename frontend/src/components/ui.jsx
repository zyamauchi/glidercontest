// ─── Design tokens ────────────────────────────────────────────────────────────
export const C = {
  skyTop:'#1a6fba', skyMid:'#4da3e0', skyLight:'#c2e4f7', skyPale:'#eaf6fd',
  cloud:'#ffffff', cloudEdge:'#cce7f5',
  navy:'#0d3461', navyMid:'#1a5a96', navyLight:'#3d7ab5', navyFaint:'#7aaecf',
  sun:'#d97706', sunLight:'#fef3c7',
  green:'#047857', greenBg:'#d1fae5',
  orange:'#c2410c', orangeBg:'#ffedd5',
  red:'#b91c1c', redBg:'#fee2e2',
  purple:'#6d28d9', purpleBg:'#ede9fe',
  gray:'#64748b', grayBg:'#f1f5f9',
};

export function Card({ children, style = {} }) {
  return <div style={{ background:C.cloud, border:`1.5px solid ${C.cloudEdge}`, borderRadius:12, padding:20, marginBottom:18, boxShadow:'0 3px 16px rgba(26,111,186,0.08)', ...style }}>{children}</div>;
}

export function SectionTitle({ children }) {
  return <div style={{ fontSize:10, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase', color:C.navyMid, marginBottom:14, paddingBottom:8, borderBottom:`1.5px solid ${C.cloudEdge}` }}>{children}</div>;
}

export function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.navyMid, marginBottom:5 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:11, color:C.navyFaint, marginTop:4, lineHeight:1.4 }}>{hint}</div>}
    </div>
  );
}

export function Input({ value, onChange, type='text', placeholder, style={}, step, disabled, name }) {
  return <input name={name} type={type} value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder} step={step} disabled={disabled} style={{ background:disabled?C.grayBg:C.cloud, border:`1.5px solid ${C.cloudEdge}`, borderRadius:6, color:C.navy, padding:'8px 11px', fontSize:13, fontFamily:'inherit', width:'100%', boxSizing:'border-box', outline:'none', ...style }} />;
}

export function Select({ value, onChange, options, style={} }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} style={{ background:C.cloud, border:`1.5px solid ${C.cloudEdge}`, borderRadius:6, color:C.navy, padding:'8px 11px', fontSize:13, fontFamily:'inherit', width:'100%', boxSizing:'border-box', ...style }}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Btn({ children, onClick, variant='primary', small, disabled, style={}, type='button' }) {
  const v = {
    primary:{ bg:C.skyTop, color:'#fff' },
    success:{ bg:C.green, color:'#fff' },
    danger:{ bg:C.red, color:'#fff' },
    ghost:{ bg:'transparent', color:C.navyMid, border:`1.5px solid ${C.cloudEdge}` },
    sun:{ bg:C.sun, color:'#fff' },
  };
  const s = v[variant]||v.primary;
  return <button type={type} onClick={onClick} disabled={disabled} style={{ background:disabled?C.grayBg:s.bg, color:disabled?C.gray:s.color, border:s.border||'none', borderRadius:6, padding:small?'5px 13px':'9px 18px', fontSize:small?11:13, fontFamily:'inherit', fontWeight:600, letterSpacing:'0.04em', cursor:disabled?'not-allowed':'pointer', boxShadow:disabled?'none':'0 1px 4px rgba(13,52,97,0.12)', ...style }}>{children}</button>;
}

export function StatusBadge({ status }) {
  const map = {
    FINISHED:{bg:C.greenBg,color:C.green,label:'Finished'},
    DNF:{bg:C.orangeBg,color:C.orange,label:'DNF'},
    MISSED_TP:{bg:C.redBg,color:C.red,label:'Missed TP'},
    NO_START:{bg:C.sunLight,color:'#92400e',label:'No Start'},
    AIRSPACE_BUST:{bg:C.purpleBg,color:C.purple,label:'Airspace'},
    CEILING_BUST:{bg:'#e0f2fe',color:'#0369a1',label:'Ceiling'},
    MAX_TIME:{bg:C.orangeBg,color:C.orange,label:'Max Time'},
    PENDING:{bg:C.grayBg,color:C.gray,label:'Pending'},
    NO_FIX:{bg:C.grayBg,color:C.gray,label:'No Fix'},
  };
  const s = map[status]||map.PENDING;
  return <span style={{ background:s.bg, color:s.color, padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700, letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{s.label}</span>;
}

export function InfoBox({ children, type='info' }) {
  const c = type==='warn'
    ? {bg:C.sunLight,border:'#fde68a',text:'#92400e'}
    : {bg:'#e0f2fe',border:'#bae6fd',text:'#0369a1'};
  return <div style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:8, padding:'10px 14px', fontSize:12, color:c.text, lineHeight:1.6, marginTop:8 }}>{children}</div>;
}

export function Spinner() {
  return <div style={{ width:20, height:20, border:`2px solid ${C.cloudEdge}`, borderTop:`2px solid ${C.skyTop}`, borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} />;
}

export function fmtTime(secs) {
  if (secs == null) return '—';
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = Math.floor(secs%60);
  return h > 0 ? `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
               : `${m}m ${String(s).padStart(2,'0')}s`;
}

export function PageWrap({ children }) {
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(165deg,#1e6fba 0%,#4da3e0 15%,#93cff0 35%,#d4eefa 55%,#eaf6fd 100%)', color:C.navy, fontFamily:"'Outfit','Segoe UI',sans-serif", position:'relative' }}>
      <style>{`
        *{box-sizing:border-box;}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:${C.skyLight};}
        ::-webkit-scrollbar-thumb{background:${C.skyMid};border-radius:3px;}
        input:focus,select:focus{outline:2px solid ${C.skyTop};outline-offset:1px;}
        select option{background:white;color:${C.navy};}
        .leaflet-container{font-family:'Outfit',sans-serif!important;}
        .leaflet-popup-content-wrapper{border-radius:10px!important;}
      `}</style>
      <CloudsBg />
      {children}
    </div>
  );
}

export function CloudsBg() {
  return (
    <svg style={{ position:'fixed',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0,opacity:0.18 }} viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice">
      <ellipse cx="1260" cy="110" rx="190" ry="72" fill="white"/>
      <ellipse cx="1150" cy="122" rx="130" ry="58" fill="white"/>
      <ellipse cx="1355" cy="125" rx="105" ry="52" fill="white"/>
      <ellipse cx="1205" cy="82" rx="108" ry="64" fill="white"/>
      <ellipse cx="115" cy="195" rx="138" ry="52" fill="white"/>
      <ellipse cx="50" cy="207" rx="85" ry="42" fill="white"/>
      <ellipse cx="205" cy="207" rx="85" ry="42" fill="white"/>
      <ellipse cx="125" cy="166" rx="90" ry="55" fill="white"/>
      <ellipse cx="700" cy="58" rx="95" ry="38" fill="white"/>
      <ellipse cx="420" cy="825" rx="165" ry="40" fill="white"/>
      <ellipse cx="1010" cy="858" rx="145" ry="36" fill="white"/>
    </svg>
  );
}

export function TopNav({ contestName, onSignOut, role }) {
  return (
    <div style={{ background:'linear-gradient(135deg,#0d2e58 0%,#1a5a96 55%,#2576c4 100%)', padding:'0 32px', display:'flex', alignItems:'center', justifyContent:'space-between', height:64, position:'relative', zIndex:10, boxShadow:'0 2px 20px rgba(13,46,88,0.3)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <svg width="42" height="24" viewBox="0 0 42 24" fill="none" style={{opacity:0.92,flexShrink:0}}>
          <path d="M2 16 Q12 4 22 12 Q31 18 40 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          <path d="M18 12 L14 22 L22 14" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M22 12 L22 6 L27 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
        <div>
          <div style={{ fontFamily:"'Teko',sans-serif", fontWeight:600, fontSize:26, letterSpacing:'0.08em', color:'white', lineHeight:1 }}>{contestName || 'GLIDERCONTEST'}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', letterSpacing:'0.15em', textTransform:'uppercase' }}>Variable Distance · Grand Prix</div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {role && <span style={{ background:'rgba(255,255,255,0.12)', padding:'4px 12px', borderRadius:20, fontSize:11, color:'rgba(255,255,255,0.8)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>{role}</span>}
        {onSignOut && <button onClick={onSignOut} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'white', borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Sign out</button>}
      </div>
    </div>
  );
}
