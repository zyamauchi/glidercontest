import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card, SectionTitle, Field, Input, Btn, InfoBox, C } from './ui';

export default function PenaltiesAdmin({ contest, onUpdate }) {
  const [p, setP] = useState({ ...contest.penalties });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/contests/${contest.id}`, { method:'PUT', body:{ penalties: p } });
      setMsg('Penalties saved!');
      onUpdate();
    } catch(e) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth:600 }}>
      <SectionTitle>Adjustable Penalty Rules</SectionTitle>
      <Card>
        <Field label="Early Start Multiplier" hint="Seconds of penalty per second started early (default: 20)">
          <Input type="number" value={p.earlyStartMultiplier} onChange={v=>setP(x=>({...x,earlyStartMultiplier:parseFloat(v)}))} />
        </Field>
        <Field label="Invalid Start Penalty (seconds)" hint="CD discretion — no competitive advantage (default: 600 = 10 min)">
          <Input type="number" value={p.invalidStartPenaltySecs} onChange={v=>setP(x=>({...x,invalidStartPenaltySecs:parseFloat(v)}))} />
        </Field>
        <Field label="Below Min Finish Altitude (sec / foot)" hint="Default: 10 sec per foot below minimum">
          <Input type="number" value={p.belowMinAltPerFoot} onChange={v=>setP(x=>({...x,belowMinAltPerFoot:parseFloat(v)}))} />
        </Field>
        <Field label="Ceiling Bust Penalty (seconds)" hint="Exceeds start ceiling in 60s prior to start">
          <Input type="number" value={p.ceilingBustPenaltySecs} onChange={v=>setP(x=>({...x,ceilingBustPenaltySecs:parseFloat(v)}))} />
        </Field>
        <Field label="Default Max Time Factor" hint="Winner time × factor = max scored time (typical: 1.2–1.5)">
          <Input type="number" step="0.05" value={p.maxTimeFactor} onChange={v=>setP(x=>({...x,maxTimeFactor:parseFloat(v)}))} />
        </Field>
        <InfoBox>
          <strong>Automatic max time (non-adjustable):</strong> Missed turnpoint · Motor use after start · Airspace bust · Exceeds max altitude · DNF / land out
          <br/><br/><strong>Day cancelled</strong> if fewer than 33% of registered pilots complete the task.
        </InfoBox>
        {msg && <InfoBox style={{marginTop:8}}>{msg}</InfoBox>}
        <Btn onClick={save} disabled={saving} style={{ marginTop:12 }}>{saving?'Saving…':'Save Penalties'}</Btn>
      </Card>
    </div>
  );
}
