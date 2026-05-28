import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { Card, SectionTitle, Field, Input, Select, Btn, InfoBox, C } from './ui';

const DEFAULT_SETTINGS = { startWindowMins:5, permissiveWindow:true, startType:'line', startRadius:1, finishType:'cylinder', finishRadius:1, startCeilingFt:'', minFinishAltFt:1280, maxAltitudeFt:17500, maxTimeFactor:1.5 };

export default function TaskSetup({ contest, tasks, onUpdate }) {
  const [library, setLibrary] = useState(contest.turnpointLibrary || []);
  const [form, setForm] = useState({ date:'', gate_open:'12:00', task_points:[], ...DEFAULT_SETTINGS });
  const [editTask, setEditTask] = useState(null);
  const [tpSearch, setTpSearch] = useState('');
  const [mapMode, setMapMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef();
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const routeRef = useRef(null);

  // Load Leaflet
  useEffect(() => {
    if (window.L) { initMap(); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => initMap();
    document.head.appendChild(s);
  }, []);

  useEffect(() => { if (window.L && !leafletRef.current && mapRef.current) initMap(); });
  useEffect(() => { if (window.L && leafletRef.current) renderMarkers(); }, [library, form.task_points]);

  function initMap() {
    if (leafletRef.current || !mapRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl:true, attributionControl:false }).setView([36.9,-120.1], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18 }).addTo(map);
    L.control.attribution({ prefix:'© <a href="https://openstreetmap.org">OSM</a>' }).addTo(map);
    leafletRef.current = map;
    setTimeout(() => { map.invalidateSize(); renderMarkers(); }, 100);
  }

  function makeIcon(role, seq) {
    const L = window.L;
    const col = role==='start'?'#16a34a':role==='finish'?'#dc2626':role==='tp'?'#1a6fba':'#94a3b8';
    const label = role==='start'?'S':role==='finish'?'F':role==='tp'?String(seq):'';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.3 21.7 0 14 0Z" fill="${col}" stroke="white" stroke-width="2"/><text x="14" y="19" text-anchor="middle" font-size="${label.length>1?'10':'13'}" font-weight="bold" fill="white" font-family="Arial,sans-serif">${label}</text></svg>`;
    return L.divIcon({ className:'', html:svg, iconSize:[28,36], iconAnchor:[14,36], popupAnchor:[0,-36] });
  }

  function renderMarkers() {
    const L = window.L, map = leafletRef.current;
    if (!L || !map) return;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    if (routeRef.current) { map.removeLayer(routeRef.current); routeRef.current = null; }
    if (!library.length) return;

    let tpSeq = 1;
    const roleMap = {};
    form.task_points.forEach((tp, i) => {
      const k = tp.code+'|'+tp.name;
      if (i===0) roleMap[k] = 'start';
      else if (i===form.task_points.length-1) roleMap[k] = 'finish';
      else roleMap[k] = 'tp_'+(tpSeq++);
    });

    library.forEach(tp => {
      const k = tp.code+'|'+tp.name;
      const roleRaw = roleMap[k] || null;
      const role = roleRaw ? roleRaw.split('_')[0] : null;
      const seq  = roleRaw?.includes('_') ? roleRaw.split('_')[1] : null;
      const icon = makeIcon(role, seq);
      const inTask = role !== null;
      const marker = L.marker([tp.lat, tp.lon], { icon, title:tp.code });
      marker.bindPopup(`
        <div style="font-family:Arial,sans-serif;min-width:150px">
          <div style="font-weight:700;font-size:14px;color:#0d3461">${tp.code}</div>
          <div style="font-size:12px;color:#3d7ab5;margin-bottom:8px">${tp.name}</div>
          ${inTask
            ? `<button onclick="window.__gcRemoveTP('${tp.code}','${tp.name.replace(/'/g,"\\'")}');this.closest('.leaflet-popup').querySelector('.leaflet-popup-close-button')?.click();" style="background:#b91c1c;color:white;border:none;border-radius:4px;padding:5px 12px;font-size:12px;cursor:pointer;width:100%">Remove from Task</button>`
            : `<button onclick="window.__gcAddTP(${JSON.stringify(tp)});this.closest('.leaflet-popup').querySelector('.leaflet-popup-close-button')?.click();" style="background:#1a6fba;color:white;border:none;border-radius:4px;padding:5px 12px;font-size:12px;cursor:pointer;width:100%">Add to Task</button>`
          }
        </div>`);
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    if (form.task_points.length >= 2) {
      routeRef.current = L.polyline(form.task_points.map(tp=>[tp.lat,tp.lon]), { color:'#d97706', weight:3, dashArray:'8 6', opacity:0.85 }).addTo(map);
    }
    if (library.length) {
      map.fitBounds(L.latLngBounds(library.map(tp=>[tp.lat,tp.lon])), { padding:[30,30] });
    }
  }

  const addTPRef = useRef(tp => setForm(f => ({ ...f, task_points: [...f.task_points, { ...tp, radiusType:'handicapped', radius:1 }] })));
  const removeTPRef = useRef((code, name) => setForm(f => ({ ...f, task_points: f.task_points.filter((t,i) => !(t.code===code&&t.name===name&&i===f.task_points.findIndex(x=>x.code===code&&x.name===name))) })));

  useEffect(() => {
    addTPRef.current = tp => setForm(f => ({ ...f, task_points: [...f.task_points, { ...tp, radiusType:'handicapped', radius:1 }] }));
    removeTPRef.current = (code, name) => setForm(f => {
      const idx = f.task_points.findIndex(t=>t.code===code&&t.name===name);
      if (idx===-1) return f;
      return { ...f, task_points: f.task_points.filter((_,i)=>i!==idx) };
    });
  });

  useEffect(() => {
    window.__gcAddTP    = tp => addTPRef.current(tp);
    window.__gcRemoveTP = (c,n) => removeTPRef.current(c,n);
    return () => { delete window.__gcAddTP; delete window.__gcRemoveTP; };
  }, []);

  function loadCUP(e) {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      const tps = parseCUP(ev.target.result);
      setLibrary(tps);
    };
    r.readAsText(file);
  }

  function parseCUP(text) {
    const tps = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()||line.toLowerCase().startsWith('name')) continue;
      const p = line.split(','); if (p.length<6) continue;
      const name=p[0].replace(/"/g,'').trim(), code=p[1].replace(/"/g,'').trim();
      const latRaw=p[3].replace(/"/g,'').trim(), lonRaw=p[4].replace(/"/g,'').trim();
      if (!latRaw||!lonRaw) continue;
      const latD=parseFloat(latRaw.slice(0,2)), latM=parseFloat(latRaw.slice(2,latRaw.length-1)), latH=latRaw.slice(-1);
      const lonD=parseFloat(lonRaw.slice(0,3)), lonM=parseFloat(lonRaw.slice(3,lonRaw.length-1)), lonH=lonRaw.slice(-1);
      if (isNaN(latD)||isNaN(lonD)) continue;
      let lat=latD+latM/60, lon=lonD+lonM/60;
      if (latH==='S') lat=-lat; if (lonH==='W') lon=-lon;
      tps.push({ name, code, lat, lon, elev: parseFloat((p[5]||'0').replace(/[^0-9.]/g,''))||0 });
    }
    return tps;
  }

  function removeTP(i) { setForm(f=>({...f,task_points:f.task_points.filter((_,idx)=>idx!==i)})); }
  function moveTP(i,dir) {
    setForm(f=>{
      const pts=[...f.task_points],j=i+dir;
      if(j<0||j>=pts.length)return f;
      [pts[i],pts[j]]=[pts[j],pts[i]];return{...f,task_points:pts};
    });
  }
  function updTP(i,k,v) { setForm(f=>({...f,task_points:f.task_points.map((tp,idx)=>idx===i?{...tp,[k]:v}:tp)})); }

  async function saveTask() {
    if (!form.date||form.task_points.length<2) return setMsg('Date and at least 2 task points required');
    setSaving(true); setMsg('');
    try {
      if (editTask) {
        await apiFetch(`/tasks/${editTask}`, { method:'PUT', body:{ date:form.date, gate_open:form.gate_open, task_points:form.task_points, settings:{ startWindowMins:form.startWindowMins, permissiveWindow:form.permissiveWindow, startType:form.startType, startRadius:form.startRadius, finishType:form.finishType, finishRadius:form.finishRadius, startCeilingFt:form.startCeilingFt, minFinishAltFt:form.minFinishAltFt, maxAltitudeFt:form.maxAltitudeFt, maxTimeFactor:form.maxTimeFactor } }});
      } else {
        await apiFetch(`/tasks/contest/${contest.id}`, { method:'POST', body:{ ...form }});
      }
      setForm({ date:'', gate_open:'12:00', task_points:[], ...DEFAULT_SETTINGS });
      setEditTask(null); setMsg('Task saved!'); onUpdate();
    } catch(e) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  function startEdit(task) {
    setEditTask(task.id);
    setForm({ date:task.date, gate_open:task.gate_open, task_points:task.task_points||[], ...task.settings });
  }

  const filtered = library.filter(tp => tp.name.toLowerCase().includes(tpSearch.toLowerCase()) || tp.code.toLowerCase().includes(tpSearch.toLowerCase()));
  const labelTP = (i,tot) => i===0?'START':i===tot-1?'FINISH':`TP ${i}`;

  return (
    <div>
      {/* Import + toggle */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <Btn small onClick={()=>fileRef.current.click()} variant={library.length?'ghost':'primary'}>
          {library.length?`✓ ${library.length} turnpoints`:'Import .cup File'}
        </Btn>
        <input ref={fileRef} type="file" accept=".cup" style={{display:'none'}} onChange={loadCUP} />
        {library.length > 0 && (
          <div style={{ display:'flex', gap:4, background:C.skyPale, borderRadius:8, padding:3, border:`1px solid ${C.cloudEdge}` }}>
            <ModeBtn active={mapMode} onClick={()=>setMapMode(true)}>🗺 Map</ModeBtn>
            <ModeBtn active={!mapMode} onClick={()=>setMapMode(false)}>☰ List</ModeBtn>
          </div>
        )}
        {library.length > 0 && !mapMode && <Input value={tpSearch} onChange={setTpSearch} placeholder="Search…" style={{width:180}} />}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: mapMode&&library.length ? '1fr 400px' : '280px 1fr', gap:20 }}>
        {/* Map or list */}
        {mapMode && library.length ? (
          <div style={{ height:620 }}>
            <div ref={mapRef} style={{ width:'100%', height:'100%', borderRadius:10, border:`1.5px solid ${C.cloudEdge}`, overflow:'hidden' }} />
          </div>
        ) : (
          <div>
            <SectionTitle>Turnpoints ({library.length})</SectionTitle>
            <Card style={{ padding:12 }}>
              <div style={{ maxHeight:500, overflowY:'auto' }}>
                {filtered.slice(0,100).map((tp,i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 4px', borderBottom:`1px solid ${C.skyLight}` }}>
                    <div>
                      <div style={{ fontSize:12, color:C.navy, fontWeight:600 }}>{tp.code}</div>
                      <div style={{ fontSize:10, color:C.navyFaint }}>{tp.name}</div>
                    </div>
                    <Btn small variant="ghost" onClick={()=>addTPRef.current(tp)}>+</Btn>
                  </div>
                ))}
                {!library.length && <div style={{ color:C.navyFaint, fontSize:12 }}>Import a .cup file</div>}
              </div>
            </Card>
          </div>
        )}

        {/* Task form */}
        <div>
          <SectionTitle>{editTask?'Editing Task':'New Task Day'}</SectionTitle>
          <Card style={{ marginBottom:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <Field label="Date"><Input type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} /></Field>
              <Field label="Gate Opens"><Input type="time" value={form.gate_open} onChange={v=>setForm(f=>({...f,gate_open:v}))} /></Field>
              <Field label="Window (mins)"><Input type="number" value={form.startWindowMins} onChange={v=>setForm(f=>({...f,startWindowMins:v}))} /></Field>
              <Field label="Permissive Window">
                <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:8 }}>
                  <input type="checkbox" checked={!!form.permissiveWindow} onChange={e=>setForm(f=>({...f,permissiveWindow:e.target.checked}))} style={{ accentColor:C.skyTop, width:15, height:15 }} />
                  <span style={{ fontSize:12, color:C.navyLight }}>Enabled</span>
                </div>
              </Field>
              <Field label="Start Type"><Select value={form.startType} onChange={v=>setForm(f=>({...f,startType:v}))} options={[{value:'line',label:'Line'},{value:'cylinder',label:'Cylinder'}]} /></Field>
              <Field label="Start Radius (nm)"><Input type="number" step="0.1" value={form.startRadius} onChange={v=>setForm(f=>({...f,startRadius:v}))} disabled={form.startType==='line'} /></Field>
              <Field label="Finish Type"><Select value={form.finishType} onChange={v=>setForm(f=>({...f,finishType:v}))} options={[{value:'cylinder',label:'Cylinder'},{value:'line',label:'Line'}]} /></Field>
              <Field label="Finish Radius (nm)"><Input type="number" step="0.1" value={form.finishRadius} onChange={v=>setForm(f=>({...f,finishRadius:v}))} /></Field>
              <Field label="Start Ceiling (ft)"><Input type="number" value={form.startCeilingFt} onChange={v=>setForm(f=>({...f,startCeilingFt:v}))} placeholder="optional" /></Field>
              <Field label="Min Finish Alt (ft)"><Input type="number" value={form.minFinishAltFt} onChange={v=>setForm(f=>({...f,minFinishAltFt:v}))} /></Field>
              <Field label="Max Altitude (ft)"><Input type="number" value={form.maxAltitudeFt} onChange={v=>setForm(f=>({...f,maxAltitudeFt:v}))} /></Field>
              <Field label="Max Time Factor"><Input type="number" step="0.05" value={form.maxTimeFactor} onChange={v=>setForm(f=>({...f,maxTimeFactor:v}))} /></Field>
            </div>
          </Card>

          <Card style={{ marginBottom:12 }}>
            <SectionTitle>Task Route — {form.task_points.length} points</SectionTitle>
            {!form.task_points.length && <div style={{ color:C.navyFaint, fontSize:12, paddingBottom:8 }}>{library.length?'Click markers on the map to add points':'Import .cup file first'}</div>}
            {form.task_points.map((tp,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, background:C.skyPale, padding:'6px 10px', borderRadius:8, border:`1px solid ${C.cloudEdge}` }}>
                <div style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:i===0?'#16a34a':i===form.task_points.length-1?'#dc2626':C.skyTop, color:'white', fontSize:10, fontWeight:800 }}>{i===0?'S':i===form.task_points.length-1?'F':i}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:C.navy, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tp.code} <span style={{ color:C.navyFaint, fontWeight:400 }}>{tp.name}</span></div>
                </div>
                {i!==0&&i!==form.task_points.length-1&&(
                  <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
                    <Select value={tp.radiusType} onChange={v=>updTP(i,'radiusType',v)} options={[{value:'fixed',label:'Fixed'},{value:'handicapped',label:'HC'}]} style={{ width:80, padding:'3px 6px', fontSize:11 }} />
                    <Input type="number" step="0.1" value={tp.radius} onChange={v=>updTP(i,'radius',v)} style={{ width:50, padding:'3px 6px', fontSize:11 }} />
                    <span style={{ fontSize:10, color:C.navyFaint }}>nm</span>
                  </div>
                )}
                <Btn small variant="ghost" onClick={()=>moveTP(i,-1)} disabled={i===0} style={{ padding:'3px 7px' }}>↑</Btn>
                <Btn small variant="ghost" onClick={()=>moveTP(i,1)} disabled={i===form.task_points.length-1} style={{ padding:'3px 7px' }}>↓</Btn>
                <Btn small variant="danger" onClick={()=>removeTP(i)} style={{ padding:'3px 7px' }}>✕</Btn>
              </div>
            ))}
            {msg && <InfoBox style={{marginTop:8}} type={msg.includes('!') ? 'info' : 'warn'}>{msg}</InfoBox>}
            <div style={{ marginTop:12, display:'flex', gap:10 }}>
              <Btn onClick={saveTask} disabled={saving||!form.date||form.task_points.length<2}>{saving?'Saving…':editTask?'Update Task':'Save Task Day'}</Btn>
              {editTask && <Btn variant="ghost" onClick={()=>{setEditTask(null);setForm({date:'',gate_open:'12:00',task_points:[],...DEFAULT_SETTINGS});}}>Cancel</Btn>}
            </div>
          </Card>

          {/* Saved tasks list */}
          {tasks.length > 0 && (
            <Card style={{ padding:'12px 16px' }}>
              <SectionTitle>Saved Task Days</SectionTitle>
              {tasks.map((t,i)=>(
                <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${C.skyLight}` }}>
                  <div>
                    <div style={{ fontWeight:700, color:C.navy, fontSize:13 }}>Day {i+1} — {t.date} <span style={{ fontSize:11, color:C.navyFaint }}>Gate: {t.gate_open}</span></div>
                    <div style={{ fontSize:11, color:C.navyFaint }}>{(t.task_points||[]).length} points · {t.status}</div>
                  </div>
                  <Btn small variant="ghost" onClick={()=>startEdit(t)}>Edit</Btn>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ children, active, onClick }) {
  return <button onClick={onClick} style={{ padding:'5px 14px', borderRadius:6, border:'none', background:active?C.skyTop:'transparent', color:active?'white':C.navyLight, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{children}</button>;
}
