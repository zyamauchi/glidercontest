import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Card, SectionTitle, Btn, Input, Field, InfoBox, fmtTime, C } from './ui';

export default function PilotsAdmin({ contest, onUpdate }) {
  const [pilots, setPilots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState({});
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState({});

  useEffect(() => { load(); }, [contest.id]);

  async function load() {
    const data = await apiFetch(`/contests/${contest.id}/pilots`);
    setPilots(data);
    setLoading(false);
  }

  async function approve(pilotId) {
    setSaving(s=>({...s,[pilotId]:true}));
    await apiFetch(`/contests/${contest.id}/pilots/${pilotId}`, { method:'PUT', body:{ status:'approved' } });
    await load(); onUpdate();
    setSaving(s=>({...s,[pilotId]:false}));
  }

  async function saveOverride(pilotId) {
    const val = overrides[pilotId];
    setSaving(s=>({...s,[pilotId]:true}));
    try {
      await apiFetch(`/contests/${contest.id}/pilots/${pilotId}`, {
        method:'PUT',
        body:{ handicap_override: val ? parseFloat(val) : null }
      });
      setMsg(m=>({...m,[pilotId]:'Saved!'}));
      await load(); onUpdate();
    } catch(e) { setMsg(m=>({...m,[pilotId]:e.message})); }
    finally { setSaving(s=>({...s,[pilotId]:false})); }
  }

  async function clearOverride(pilotId) {
    setOverrides(o=>({...o,[pilotId]:''}));
    await apiFetch(`/contests/${contest.id}/pilots/${pilotId}`, { method:'PUT', body:{ handicap_override: null } });
    await load(); onUpdate();
  }

  if (loading) return <div style={{ color:C.navyFaint }}>Loading pilots…</div>;

  const pending  = pilots.filter(p => p.status === 'pending');
  const approved = pilots.filter(p => p.status === 'approved');

  return (
    <div>
      {pending.length > 0 && (
        <>
          <SectionTitle>Pending Approval ({pending.length})</SectionTitle>
          {pending.map(reg => (
            <Card key={reg.pilot_id} style={{ padding:'12px 16px', marginBottom:10, border:`1.5px solid #fde68a` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <PilotInfo reg={reg} />
                <Btn small variant="success" onClick={()=>approve(reg.pilot_id)} disabled={saving[reg.pilot_id]}>
                  {saving[reg.pilot_id]?'…':'Approve'}
                </Btn>
              </div>
            </Card>
          ))}
        </>
      )}

      <SectionTitle>Approved Pilots ({approved.length})</SectionTitle>
      {approved.length === 0 && <div style={{ color:C.navyFaint, fontSize:13 }}>No approved pilots yet.</div>}
      {approved.map(reg => {
        const p = reg.profiles;
        const hasOverride = reg.handicap_override != null;
        return (
          <Card key={reg.pilot_id} style={{ padding:'14px 16px', marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
              <div style={{ flex:1 }}>
                <PilotInfo reg={reg} />
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, flexWrap:'wrap' }}>
                  <div style={{ fontSize:12, color:C.navyFaint }}>
                    Effective HC: <strong style={{ color:hasOverride?C.orange:C.navy }}>{reg.effective_handicap?.toFixed(4)}</strong>
                    {hasOverride && <span style={{ marginLeft:6, background:C.orangeBg, color:C.orange, padding:'1px 7px', borderRadius:10, fontSize:10, fontWeight:700 }}>OVERRIDE</span>}
                    {!hasOverride && p?.wl_formula && p.wl_formula !== 'none' && <span style={{ marginLeft:6, color:C.navyFaint, fontSize:11 }}>(WL adj: {p.wl_formula})</span>}
                  </div>
                </div>
              </div>

              {/* Override control */}
              <div style={{ display:'flex', flexDirection:'column', gap:6, minWidth:220 }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.navyMid, textTransform:'uppercase', letterSpacing:'0.08em' }}>CD Override</div>
                <div style={{ display:'flex', gap:6 }}>
                  <Input
                    type="number" step="0.001"
                    value={overrides[reg.pilot_id] ?? (hasOverride ? String(reg.handicap_override) : '')}
                    onChange={v=>setOverrides(o=>({...o,[reg.pilot_id]:v}))}
                    placeholder={`${p?.adjusted_handicap?.toFixed(4)||p?.base_handicap?.toFixed(4)||'auto'}`}
                    style={{ width:100 }}
                  />
                  <Btn small onClick={()=>saveOverride(reg.pilot_id)} disabled={saving[reg.pilot_id]}>Set</Btn>
                  {hasOverride && <Btn small variant="ghost" onClick={()=>clearOverride(reg.pilot_id)}>Clear</Btn>}
                </div>
                {msg[reg.pilot_id] && <div style={{ fontSize:11, color:C.green }}>{msg[reg.pilot_id]}</div>}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function PilotInfo({ reg }) {
  const p = reg.profiles;
  return (
    <div>
      <div style={{ fontWeight:700, color:C.navy, fontSize:14 }}>
        {p?.full_name} <span style={{ color:C.skyTop, fontSize:12 }}>#{p?.competition_number}</span>
      </div>
      <div style={{ fontSize:12, color:C.navyLight, marginTop:2 }}>
        {p?.glider_manufacturer} {p?.glider_model} · N {p?.n_number || '—'} · {p?.takeoff_weight_lbs || '—'} lbs
      </div>
      <div style={{ fontSize:11, color:C.navyFaint, marginTop:1 }}>
        Base HC: {p?.base_handicap?.toFixed(4)||'—'} · Adj HC: {p?.adjusted_handicap?.toFixed(4)||'—'} · Formula: {p?.wl_formula||'none'}
      </div>
    </div>
  );
}
