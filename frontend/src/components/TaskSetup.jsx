import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { Card, SectionTitle, Field, Input, Select, Btn, C } from './ui';

const DEFAULT_SETTINGS = { startWindowMins:5, permissiveWindow:true, startType:'line', startRadius:1, finishType:'cylinder', finishRadius:1, startCeilingFt:'', minFinishAltFt:1280, maxAltitudeFt:17500, maxTimeFactor:1.5 };

export default function TaskSetup({ contest, tasks, onUpdate }) {
  const [library, setLibrary] = useState([]);
  const [taskPoints, setTaskPoints] = useState([]);
  const [form, setForm] = useState({ date:'', gate_open:'12:00', ...DEFAULT_SETTINGS });
  const [editTask, setEditTask] = useState(null);
  const [tpSearch, setTpSearch] = useState('');
  const [mapMode, setMapMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeRef = useRef(null);
  const libraryRef = useRef([]);
  const taskPointsRef = useRef([]);

  useEffect(() => { libraryRef.current = library; }, [library]);
  useEffect(() => { taskPointsRef.current = taskPoints; }, [taskPoints]);

  // Init map once
  useEffect(() => {
    function tryInit() {
      if (!window.L || !mapRef.current || mapInstanceRef.current) return;
      const L = window.L;
      const map = L.map(mapRef.current).setView([36.9, -120.1], 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18 }).addTo(map);
      mapInstanceRef.current = map;
    }
    if (window.L) { setTimeout(tryInit, 100); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => setTimeout(tryInit, 100);
    document.head.appendChild(s);
  }, []);

  // Redraw markers whenever library or taskPoints change
  useEffect(() => {
    if (mapInstanceRef.current && library.length) {
      drawMarkers(library, taskPoints);
    }
  }, [library, taskPoints]);

  function makeIcon(color, label) {
    const L = window.L;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="26" viewBox="0 0 20 26"><path d="M10 0C4.5 0 0 4.5 0 10C0 17.5 10 26 10 26S20 17.5 20 10C20 4.5 15.5 0 10 0Z" fill="${color}" stroke="white" stroke-width="1.5"/><text x="10" y="14" text-anchor="middle" font-size="${label.length>1?'7':'10'}" font-weight="bold" fill="white" font-family="Arial,sans-serif">${label}</text></svg>`;
    return L.divIcon({ className:'', html:svg, iconSize:[20,26], iconAnchor:[10,26], popupAnchor:[0,-26] });
  }

  function drawMarkers(lib, pts) {
    const L = window.L, map = mapInstanceRef.current;
    if (!L || !map) return;

    // Remove old markers and route
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    if (routeRef.current) { map.removeLayer(routeRef.current); routeRef.current = null; }

    lib.forEach(tp => {
      const idx = pts.findIndex(p => p.code === tp.code);
      const inTask = idx !== -1;
      const isStart = idx === 0;
      const isFinish = inTask && idx === pts.length - 1;
      const color = isStart ? '#16a34a' : isFinish ? '#dc2626' : inTask ? '#1a6fba' : '#94a3b8';
      const label = isStart ? 'S' : isFinish ? 'F' : inTask ? String(idx) : '•';
      const icon = makeIcon(color, label);

      const marker = L.marker([tp.lat, tp.lon], { icon, title: tp.code });
      marker.on('click', () => {
        const cur = taskPointsRef.current;
        const alreadyIn = cur.findIndex(p => p.code === tp.code) !== -1;
        if (alreadyIn) {
          setTaskPoints(prev => prev.filter(p => p.code !== tp.code));
        } else {
          setTaskPoints(prev => [...prev, { ...tp, radiusType:'handicapped', radius:1 }]);
        }
      });
      marker.bindTooltip(`${tp.code}: ${tp.name}`, { permanent:false, direction:'top' });
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    // Draw route line
    if (pts.length >= 2) {
      routeRef.current = L.polyline(pts.map(p => [p.lat, p.lon]), {
        color:'#d97706', weight:3, dashArray:'8 6'
      }).addTo(map);
    }
  }

  function loadCUP(e) {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      const tps = parseCUP(ev.target.result);
      setLibrary(tps);
      // Fit map to turnpoints after a short delay
      setTimeout(() => {
        const map = mapInstanceRef.current;
        if (map && tps.length && window.L) {
          map.invalidateSize();
          map.fitBounds(window.L.latLngBounds(tps.map(t => [t.lat, t.lon])), { padding:[30,30] });
        }
      }, 200);
    };
    r.readAsText(file);
  }

  function parseCUP(text) {
    const tps = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || line.toLowerCase().startsWith('name')) continue;
      const p = line.split(','); if (p.length < 6) continue;
      const name = p[0].replace(/"/g,'').trim();
      const code = p[1].replace(/"/g,'').trim();
      const latRaw = p[3].replace(/"/g,'').trim();
      const lonRaw = p[4].replace(/"/g,'').trim();
      if (!latRaw || !lonRaw) continue;
      const latD = parseFloat(latRaw.slice(0,2)), latM = parseFloat(latRaw.slice(2,latRaw.length-1)), latH = latRaw.slice(-1);
      const lonD = parseFloat(lonRaw.slice(0,3)), lonM = parseFloat(lonRaw.slice(3,lonRaw.length-1)), lonH = lonRaw.slice(-1);
      if (isNaN(latD) || isNaN(lonD)) continue;
      let lat = latD + latM/60, lon = lonD + lonM/60;
      if (latH === 'S') lat = -lat;
      if (lonH === 'W') lon = -lon;
      tps.push({ name, code, lat, lon, elev: parseFloat((p[5]||'0').replace(/[^0-9.]/g,''))||0 });
    }
    return tps;
  }

  function removeTP(i) { setTaskPoints(p => p.filter((_,idx) => idx !== i)); }
  function moveTP(i, dir) {
    setTaskPoints(pts => {
      const p = [...pts], j = i + dir;
      if (j < 0 || j >= p.length) return pts;
      [p[i], p[j]] = [p[j], p[i]];
      return p;
    });
  }
  function updTP(i, k, v) { setTaskPoints(pts => pts.map((tp,idx) => idx===i ? {...tp,[k]:v} : tp)); }

  async function saveTask() {
    if (!form.date || taskPoints.length < 2) return setMsg('Date and at least 2 task points required');
    setSaving(true); setMsg('');
    try {
      const settings = { startWindowMins:form.startWindowMins, permissiveWindow:form.permissiveWindow, startType:form.startType, startRadius:form.startRadius, finishType:form.finishType, finishRadius:form.finishRadius, startCeilingFt:form.startCeilingFt, minFinishAltFt:form.minFinishAltFt, maxAltitudeFt:form.maxAltitudeFt, maxTimeFactor:form.maxTimeFactor };
      if (editTask) {
        await apiFetch(`/tasks/${editTask}`, { method:'PUT', body:{ date:form.date, gate_open:form.gate_open, task_points:taskPoints, settings }});
      } else {
        await apiFetch(`/tasks/contest/${contest.id}`, { method:'POST', body:{ date:form.date, gate_open:form.gate_open, task_points:taskPoints, ...form }});
      }
      setTaskPoints([]); setForm({ date:'', gate_open:'12:00', ...DEFAULT_SETTINGS });
      setEditTask(null); setMsg('Task saved!'); onUpdate();
    } catch(e) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  function startEdit(task) {
    setEditTask(task.id);
    setTaskPoints(task.task_points || []);
    setForm({ date:task.date, gate_open:task.gate_open, ...(task.settings||{}) });
  }

  const filtered = library.filter(tp =>
    tp.name.toLowerCase().includes(tpSearch.toLowerCase()) ||
    tp.code.toLowerCase().includes(tpSearch.toLowerCase())
  );

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <Btn small onClick={()=>fileRef.current.click()} variant={library.length?'ghost':'primary'}>
          {library.length ? `✓ ${library.length} turnpoints loaded` : 'Import .cup File'}
        </Btn>
        <input ref={fileRef} type="file" accept=".cup" style={{display:'none'}} onChange={loadCUP} />
        {library.length > 0 && (
          <div style={{ display:'flex', gap:4, background:C.skyPale, borderRadius:8, padding:3, border:`1px solid ${C.cloudEdge}` }}>
            <ModeBtn active={mapMode} onClick={()=>setMapMode(true)}>Map</ModeBtn>
            <ModeBtn active={!mapMode} onClick={()=>setMapMode(false)}>List</ModeBtn>
          </div>
        )}
        {library.length > 0 && !mapMode && (
          <Input value={tpSearch} onChange={setTpSearch} placeholder="Search..." style={{width:180}} />
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: mapMode && library.length ? '1fr 380px' : '1fr', gap:20 }}>

        {mapMode && library.length ? (
          <div>
            <div style={{ fontSize:12, color:C.navyFaint, marginBottom:6 }}>
              Click a pin to add it to the task. Click again to remove.
            </div>
            <div ref={mapRef} style={{ width:'100%', height:560, borderRadius:10, border:`1.5px solid ${C.cloudEdge}`, overflow:'hidden' }} />
          </div>
        ) : library.length ? (
          <Card style={{ padding:12 }}>
            <div style={{ maxHeight:500, overflowY:'auto' }}>
              {filtered.slice(0,150).map((tp,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 4px', borderBottom:`1px solid ${C.skyLight}` }}>
                  <div>
                    <span style={{ fontSize:12, color:C.navy, fontWeight:600 }}>{tp.code}</span>
                    <span style={{ fontSize:11, color:C.navyFaint, marginLeft:6 }}>{tp.name}</span>
                  </div>
                  <Btn small variant="ghost" onClick={()=>setTaskPoints(p=>[...p,{...tp,radiusType:'handicapped',radius:1}])}>+</Btn>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <div>
          <SectionTitle>{editTask ? 'Editing Task' : 'New Task Day'}</SectionTitle>
          <Card style={{ marginBottom:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <Field label="Date"><Input type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} /></Field>
              <Field label="Gate Opens"><Input type="time" value={form.gate_open} onChange={v=>setForm(f=>({...f,gate_open:v}))} /></Field>
              <Field label="Window (mins)"><Input type="number" value={form.startWindowMins} onChange={v=>setForm(f=>({...f,startWindowMins:v}))} /></Field>
              <Field label="Max Time Factor"><Input type="number" step="0.05" value={form.maxTimeFactor} onChange={v=>setForm(f=>({...f,maxTimeFactor:v}))} /></Field>
              <Field label="Min Finish Alt (ft)"><Input type="number" value={form.minFinishAltFt} onChange={v=>setForm(f=>({...f,minFinishAltFt:v}))} /></Field>
              <Field label="Max Altitude (ft)"><Input type="number" value={form.maxAltitudeFt} onChange={v=>setForm(f=>({...f,maxAltitudeFt:v}))} /></Field>
            </div>
          </Card>

          <Card>
            <SectionTitle>Task Route — {taskPoints.length} points</SectionTitle>
            {taskPoints.length === 0 && (
              <div style={{ color:C.navyFaint, fontSize:12, paddingBottom:8 }}>
                {library.length ? 'Click pins on the map to build your route' : 'Import a .cup file first'}
              </div>
            )}
            {taskPoints.map((tp, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, background:C.skyPale, padding:'6px 10px', borderRadius:8 }}>
                <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:i===0?'#16a34a':i===taskPoints.length-1?'#dc2626':C.skyTop, color:'white', fontSize:10, fontWeight:800 }}>
                  {i===0?'S':i===taskPoints.length-1?'F':i}
                </div>
                <div style={{ flex:1, fontSize:12, color:C.navy, fontWeight:600 }}>
                  {tp.code} <span style={{ color:C.navyFaint, fontWeight:400 }}>{tp.name}</span>
                </div>
                {i !== 0 && i !== taskPoints.length-1 && (
                  <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                    <Select value={tp.radiusType} onChange={v=>updTP(i,'radiusType',v)}
                      options={[{value:'fixed',label:'Fixed'},{value:'handicapped',label:'HC'}]}
                      style={{ width:75, padding:'3px 6px', fontSize:11 }} />
                    <Input type="number" step="0.1" value={tp.radius} onChange={v=>updTP(i,'radius',v)}
                      style={{ width:50, padding:'3px 6px', fontSize:11 }} />
                    <span style={{ fontSize:10, color:C.navyFaint }}>nm</span>
                  </div>
                )}
                <Btn small variant="ghost" onClick={()=>moveTP(i,-1)} disabled={i===0} style={{ padding:'3px 7px' }}>↑</Btn>
                <Btn small variant="ghost" onClick={()=>moveTP(i,1)} disabled={i===taskPoints.length-1} style={{ padding:'3px 7px' }}>↓</Btn>
                <Btn small variant="danger" onClick={()=>removeTP(i)} style={{ padding:'3px 7px' }}>✕</Btn>
              </div>
            ))}

            {msg && (
              <div style={{ marginTop:8, padding:'8px 12px', background:msg.includes('saved')?'#d1fae5':'#fef3c7', borderRadius:6, fontSize:12, color:msg.includes('saved')?C.green:C.orange }}>
                {msg}
              </div>
            )}

            <div style={{ marginTop:12, display:'flex', gap:10 }}>
              <Btn onClick={saveTask} disabled={saving || !form.date || taskPoints.length < 2}>
                {saving ? 'Saving...' : editTask ? 'Update Task' : 'Save Task Day'}
              </Btn>
              {editTask && (
                <Btn variant="ghost" onClick={()=>{ setEditTask(null); setTaskPoints([]); setForm({date:'',gate_open:'12:00',...DEFAULT_SETTINGS}); }}>
                  Cancel
                </Btn>
              )}
            </div>
          </Card>

          {tasks.length > 0 && (
            <Card style={{ padding:'12px 16px', marginTop:12 }}>
              <SectionTitle>Saved Task Days</SectionTitle>
              {tasks.map((t, i) => (
                <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${C.skyLight}` }}>
                  <div>
                    <div style={{ fontWeight:700, color:C.navy, fontSize:13 }}>Day {i+1} — {t.date}</div>
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
  return (
    <button onClick={onClick} style={{ padding:'5px 14px', borderRadius:6, border:'none', background:active?C.skyTop:'transparent', color:active?'white':C.navyLight, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
      {children}
    </button>
  );
}
