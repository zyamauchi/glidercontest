import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Card, SectionTitle, StatusBadge, fmtTime, C } from './ui';

export default function LeaderboardView({ contestId, tasks }) {
  const [data, setData] = useState(null);
  const [view, setView] = useState('cumulative');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/leaderboard/${contestId}`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, [contestId, tasks]);

  if (loading) return <div style={{ color:C.navyFaint, padding:20 }}>Loading leaderboard…</div>;
  if (!data) return null;

  const { standings, tasks: scoredTasks } = data;

  const TH = ({children}) => (
    <div style={{ padding:'9px 12px', fontSize:10, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.navyMid, borderBottom:`2px solid ${C.cloudEdge}`, background:C.skyPale }}>
      {children}
    </div>
  );

  return (
    <div>
      {/* View selector */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        <ViewBtn active={view==='cumulative'} onClick={()=>setView('cumulative')}>Overall</ViewBtn>
        {scoredTasks.map((t, i) => (
          <ViewBtn key={t.id} active={view===t.id} onClick={()=>setView(t.id)}>
            Day {i+1} — {t.date}
          </ViewBtn>
        ))}
      </div>

      {scoredTasks.length === 0 && (
        <Card><div style={{ color:C.navyFaint, textAlign:'center', padding:'24px 0' }}>No scored days yet. Results will appear here after the CD finalizes each day.</div></Card>
      )}

      {view === 'cumulative' && scoredTasks.length > 0 && (
        <Card style={{ padding:0, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:`52px 1fr 80px 120px ${scoredTasks.map(()=>'110px').join(' ')}`, gap:0 }}>
            <TH>#</TH><TH>Pilot</TH><TH>HC</TH><TH>Total Time</TH>
            {scoredTasks.map((t,i)=><TH key={t.id}>Day {i+1}</TH>)}
          </div>
          {standings.map((s, i) => (
            <div key={s.pilotId} style={{ display:'grid', gridTemplateColumns:`52px 1fr 80px 120px ${scoredTasks.map(()=>'110px').join(' ')}`, gap:0, background:i===0?C.sunLight:i%2===0?C.cloud:C.skyPale }}>
              <Cell><span style={{ fontWeight:800, fontSize:i===0?20:14, color:i===0?C.sun:C.navyFaint }}>{i+1}</span></Cell>
              <Cell bold>
                <span style={{ color:C.navy }}>{s.name}</span>
                <span style={{ color:C.skyTop, fontSize:11, marginLeft:8 }}>#{s.compNumber}</span>
                <span style={{ color:C.navyFaint, fontSize:11, marginLeft:8 }}>{s.glider}</span>
              </Cell>
              <Cell sm>{s.handicap?.toFixed(4)||'—'}</Cell>
              <Cell gold={i===0} bold={i===0}>{s.totalTime!=null?fmtTime(s.totalTime):'—'}</Cell>
              {scoredTasks.map(t => {
                const dr = s.dayResults.find(d=>d.taskId===t.id);
                return (
                  <div key={t.id} style={{ padding:'11px 12px', fontSize:12, color:dr?.status==='FINISHED'?C.navy:C.orange, borderBottom:`1px solid ${C.skyLight}` }}>
                    {dr?.finalTime!=null ? fmtTime(dr.finalTime) : dr ? <StatusBadge status={dr.status}/> : '—'}
                  </div>
                );
              })}
            </div>
          ))}
          {standings.length === 0 && <div style={{ padding:24, color:C.navyFaint }}>No pilot results yet.</div>}
        </Card>
      )}

      {view !== 'cumulative' && (() => {
        const task = scoredTasks.find(t=>t.id===view);
        if (!task) return null;
        return (
          <Card style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', background:C.skyPale, borderBottom:`1px solid ${C.cloudEdge}`, fontSize:12, color:C.navyLight }}>
              Winner: <strong style={{ color:C.navy }}>{fmtTime(task.winner_time)}</strong> · Max: <strong style={{ color:C.navy }}>{fmtTime(task.max_time)}</strong> · Factor: {task.max_time_factor}×
              {task.below_threshold && <span style={{ marginLeft:12, color:'#92400e', background:C.sunLight, padding:'2px 8px', borderRadius:12 }}>⚠ Below 33% threshold</span>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'52px 1fr 80px 110px 130px 110px', gap:0 }}>
              {['#','Pilot','HC','Elapsed','Penalties','Final'].map(h=><TH key={h}>{h}</TH>)}
            </div>
            {standings
              .map(s => ({ s, dr: s.dayResults.find(d=>d.taskId===view) }))
              .filter(x => x.dr?.finalTime != null)
              .sort((a,b)=>(a.dr.finalTime??Infinity)-(b.dr.finalTime??Infinity))
              .map(({ s, dr }, i) => (
                <div key={s.pilotId} style={{ display:'grid', gridTemplateColumns:'52px 1fr 80px 110px 130px 110px', gap:0, background:i===0?C.sunLight:i%2===0?C.cloud:C.skyPale }}>
                  <Cell><span style={{ fontWeight:800, fontSize:i===0?20:14, color:i===0?C.sun:C.navyFaint }}>{i+1}</span></Cell>
                  <Cell bold><span style={{ color:C.navy }}>{s.name}</span><span style={{ color:C.skyTop, fontSize:11, marginLeft:8 }}>#{s.compNumber}</span></Cell>
                  <Cell sm>{s.handicap?.toFixed(4)||'—'}</Cell>
                  <Cell>{fmtTime(dr.elapsed)}</Cell>
                  <Cell warn={dr.penalty>0}>{dr.penalty>0?`+${fmtTime(dr.penalty)}`:'—'}</Cell>
                  <Cell gold={i===0} bold>{fmtTime(dr.finalTime)}</Cell>
                </div>
              ))}
          </Card>
        );
      })()}
    </div>
  );
}

function ViewBtn({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding:'6px 14px', background:active?C.skyTop:'transparent', color:active?'white':C.navyMid, border:`1.5px solid ${active?C.skyTop:C.cloudEdge}`, borderRadius:6, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600 }}>
      {children}
    </button>
  );
}

function Cell({ children, bold, gold, warn, sm }) {
  return (
    <div style={{ padding:'11px 12px', fontSize:sm?11:13, color:gold?C.sun:warn?C.orange:bold?C.navy:C.navyLight, fontWeight:bold||gold?700:400, borderBottom:`1px solid ${C.skyLight}` }}>
      {children}
    </div>
  );
}
