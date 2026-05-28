import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Card, SectionTitle, Btn, StatusBadge, InfoBox, fmtTime, C } from './ui';

export default function ScoringPanel({ contest, tasks, onUpdate }) {
  const [selTask, setSelTask] = useState(tasks[0]?.id || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { if (selTask) loadResults(); }, [selTask]);

  async function loadResults() {
    setLoading(true);
    try {
      const data = await apiFetch(`/scoring/results/${selTask}`);
      setResults(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function finalize() {
    const task = tasks.find(t=>t.id===selTask);
    const factor = task?.settings?.maxTimeFactor || contest.penalties?.maxTimeFactor || 1.5;
    if (!confirm(`Finalize day with max time factor ${factor}×? This will set final times for all pilots.`)) return;
    setFinalizing(true);
    try {
      const res = await apiFetch(`/scoring/finalize/${selTask}`, { method:'POST', body:{ maxTimeFactor: factor } });
      setMsg(`Day finalized. Winner: ${fmtTime(res.winnerTime)} · Max: ${fmtTime(res.maxTime)} · ${res.finishedCount}/${res.totalPilots} finished${res.belowThreshold?' ⚠ Below 33% threshold':''}`);
      await loadResults(); onUpdate();
    } catch(e) { setMsg(e.message); }
    finally { setFinalizing(false); }
  }

  async function removeResult(pilotId) {
    if (!confirm('Remove this result? The pilot can re-upload.')) return;
    await apiFetch(`/scoring/results/${selTask}/${pilotId}`, { method:'DELETE' });
    await loadResults();
  }

  async function dlTSK(pilotId) {
    const token = (await import('../lib/api').then(m=>m.supabase)).auth.getSession().then(s=>s.data.session?.access_token);
    const url = `${import.meta.env.VITE_API_URL||''}/api/tasks/${selTask}/tsk/${pilotId}`;
    const res = await fetch(url, { headers:{ Authorization:`Bearer ${await token}` }});
    const blob = await res.blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    const cd = res.headers.get('content-disposition')||'';
    a.download = cd.match(/filename="(.+)"/)?.[1] || 'task.tsk';
    a.click();
  }

  const task = tasks.find(t=>t.id===selTask);
  const finalized = task?.status === 'finalized';

  return (
    <div>
      {/* Day selector */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {tasks.map((t,i) => (
          <button key={t.id} onClick={()=>setSelTask(t.id)} style={{ padding:'7px 16px', background:selTask===t.id?C.skyTop:'transparent', color:selTask===t.id?'white':C.navyMid, border:`1.5px solid ${selTask===t.id?C.skyTop:C.cloudEdge}`, borderRadius:6, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600 }}>
            Day {i+1} — {t.date} {t.status==='finalized'?'✓':''}
          </button>
        ))}
      </div>

      {!selTask && <div style={{ color:C.navyFaint }}>No tasks set up yet.</div>}

      {selTask && (
        <>
          {finalized && <InfoBox>This day is finalized. Results are locked.</InfoBox>}

          {/* TSK downloads */}
          {task && (
            <Card style={{ padding:'12px 16px', marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.navyMid, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Task Files (.tsk)</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {results.map(r => (
                  <Btn key={r.pilot_id} small variant="ghost" onClick={()=>dlTSK(r.pilot_id)}>
                    ↓ {r.profiles?.competition_number || r.profiles?.full_name}
                  </Btn>
                ))}
                {results.length === 0 && <span style={{ color:C.navyFaint, fontSize:12 }}>No pilots have uploaded yet</span>}
              </div>
            </Card>
          )}

          {loading && <div style={{ color:C.navyFaint }}>Loading results…</div>}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12, marginBottom:16 }}>
            {results.map(r => (
              <Card key={r.pilot_id} style={{ padding:'13px 15px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div>
                    <div style={{ fontWeight:700, color:C.navy }}>{r.profiles?.full_name} <span style={{ color:C.skyTop, fontSize:11 }}>#{r.profiles?.competition_number}</span></div>
                    <div style={{ fontSize:11, color:C.navyLight }}>{r.profiles?.glider_manufacturer} {r.profiles?.glider_model}</div>
                  </div>
                  <StatusBadge status={r.final_status||r.status} />
                </div>
                <div style={{ fontSize:12, color:C.navyLight, lineHeight:1.7 }}>
                  <div>File: {r.igc_filename}</div>
                  <div>Elapsed: <strong>{fmtTime(r.elapsed_secs)}</strong></div>
                  {r.penalty_secs>0 && <div style={{ color:C.orange }}>Penalties: +{fmtTime(r.penalty_secs)}</div>}
                  {r.final_time && <div style={{ color:C.green, fontWeight:700 }}>Final: {fmtTime(r.final_time)}</div>}
                  {r.detail && r.detail !== 'OK' && <div style={{ color:C.navyFaint, fontSize:11 }}>{r.detail}</div>}
                </div>
                {!finalized && (
                  <Btn small variant="danger" onClick={()=>removeResult(r.pilot_id)} style={{ marginTop:8 }}>Remove</Btn>
                )}
              </Card>
            ))}
          </div>

          {msg && <InfoBox>{msg}</InfoBox>}

          {!finalized && results.length > 0 && (
            <Btn variant="success" onClick={finalize} disabled={finalizing}>
              {finalizing ? 'Finalizing…' : 'Finalize Day & Lock Results'}
            </Btn>
          )}
        </>
      )}
    </div>
  );
}
