import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiFetch, apiUpload, supabase } from '../lib/api';
import { PageWrap, TopNav, Card, SectionTitle, Field, Input, Select, Btn, StatusBadge, InfoBox, fmtTime, C } from '../components/ui';
import LeaderboardView from '../components/LeaderboardView';
import TaskSetup from '../components/TaskSetup';
import PilotsAdmin from '../components/PilotsAdmin';
import PenaltiesAdmin from '../components/PenaltiesAdmin';
import ScoringPanel from '../components/ScoringPanel';

const TABS_CD     = ['leaderboard','scoring','task','pilots','penalties','settings'];
const TABS_PILOT  = ['leaderboard','upload'];

export default function ContestPage() {
  const { contestId } = useParams();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [contest, setContest] = useState(null);
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('leaderboard');
  const isCD = profile?.role === 'cd' && contest?.cd_id === profile?.id;

  useEffect(() => {
    load();
  }, [contestId]);

  // Live leaderboard via Supabase realtime
  useEffect(() => {
    if (!contestId) return;
    const channel = supabase.channel(`results:${contestId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results', filter: `contest_id=eq.${contestId}` },
        () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [contestId]);

  async function load() {
    try {
      const [c, t] = await Promise.all([
        apiFetch(`/contests/${contestId}`),
        apiFetch(`/tasks/contest/${contestId}`),
      ]);
      setContest(c);
      setTasks(t);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const tabs = isCD ? TABS_CD : TABS_PILOT;

  if (loading) return <PageWrap><TopNav contestName="Loading…" onSignOut={signOut} /></PageWrap>;
  if (!contest) return <PageWrap><TopNav contestName="Not found" onSignOut={signOut} role={profile?.role} /><div style={{padding:32,color:'#7aaecf'}}>Contest not found.</div></PageWrap>;

  return (
    <PageWrap>
      <TopNav contestName={contest.name} onSignOut={signOut} role={isCD ? 'CD' : 'Pilot'} />
      <div style={{ padding:'24px 32px', maxWidth:1500, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* Tab bar */}
        <div style={{ display:'flex', borderBottom:`2px solid ${C.cloudEdge}`, marginBottom:24, gap:2, flexWrap:'wrap' }}>
          {tabs.map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{ padding:'11px 22px', background:tab===t?C.cloud:'transparent', color:tab===t?C.navy:C.navyLight, border:'none', borderBottom:tab===t?`2px solid ${C.skyTop}`:'2px solid transparent', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:tab===t?700:500, letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:-2, borderRadius:'6px 6px 0 0' }}>
              {t === 'leaderboard' ? '🏆 Leaderboard'
               : t === 'scoring'   ? '📋 Scoring'
               : t === 'task'      ? '🗺 Task Setup'
               : t === 'pilots'    ? '✈ Pilots'
               : t === 'penalties' ? '⚠ Penalties'
               : t === 'upload'    ? '⬆ Upload IGC'
               : '⚙ Settings'}
            </button>
          ))}
        </div>

        {tab === 'leaderboard' && <LeaderboardView contestId={contestId} tasks={tasks} />}
        {tab === 'scoring'     && isCD && <ScoringPanel contest={contest} tasks={tasks} onUpdate={load} />}
        {tab === 'task'        && isCD && <TaskSetup contest={contest} tasks={tasks} onUpdate={load} />}
        {tab === 'pilots'      && isCD && <PilotsAdmin contest={contest} onUpdate={load} />}
        {tab === 'penalties'   && isCD && <PenaltiesAdmin contest={contest} onUpdate={load} />}
        {tab === 'settings'    && isCD && <ContestSettings contest={contest} onUpdate={load} />}
        {tab === 'upload'      && !isCD && <PilotUpload contest={contest} tasks={tasks} profile={profile} onUpdate={load} />}
      </div>
    </PageWrap>
  );
}

// ─── Contest settings (CD) ────────────────────────────────────────────────────
function ContestSettings({ contest, onUpdate }) {
  const [form, setForm] = useState({ name: contest.name, location: contest.location||'', start_date: contest.start_date||'', end_date: contest.end_date||'', frequency: contest.frequency||'123.5', status: contest.status||'setup' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/contests/${contest.id}`, { method:'PUT', body: form });
      setMsg('Saved!');
      onUpdate();
    } catch(e) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth:520 }}>
      <SectionTitle>Contest Settings</SectionTitle>
      <Card>
        <Field label="Contest Name"><Input value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} /></Field>
        <Field label="Location / Airport"><Input value={form.location} onChange={v=>setForm(f=>({...f,location:v}))} /></Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Start Date"><Input type="date" value={form.start_date} onChange={v=>setForm(f=>({...f,start_date:v}))} /></Field>
          <Field label="End Date"><Input type="date" value={form.end_date} onChange={v=>setForm(f=>({...f,end_date:v}))} /></Field>
        </div>
        <Field label="Contest Frequency"><Input value={form.frequency} onChange={v=>setForm(f=>({...f,frequency:v}))} /></Field>
        <Field label="Status">
          <Select value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={[{value:'setup',label:'Setup'},{value:'open',label:'Active / Open'},{value:'closed',label:'Closed'}]} />
        </Field>
        {msg && <InfoBox>{msg}</InfoBox>}
        <Btn onClick={save} disabled={saving} style={{ marginTop:12 }}>{saving?'Saving…':'Save Settings'}</Btn>
      </Card>
    </div>
  );
}

// ─── Pilot IGC upload ─────────────────────────────────────────────────────────
function PilotUpload({ contest, tasks, profile, onUpdate }) {
  const [selTask, setSelTask] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const openTasks = tasks.filter(t => t.status !== 'finalized');

  async function upload() {
    if (!selTask || !file) return setError('Select a day and choose your IGC file');
    setUploading(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('igc', file);
      const res = await apiUpload(`/scoring/upload/${selTask}`, fd);
      setResult(res.summary);
      onUpdate();
    } catch(e) { setError(e.message); }
    finally { setUploading(false); }
  }

  return (
    <div style={{ maxWidth:520 }}>
      <SectionTitle>Upload Your IGC File</SectionTitle>
      <Card>
        <div style={{ marginBottom:16, padding:'12px 16px', background:C.skyPale, borderRadius:8, border:`1px solid ${C.cloudEdge}` }}>
          <div style={{ fontWeight:700, color:C.navy }}>{profile?.full_name}</div>
          <div style={{ fontSize:12, color:C.navyLight }}>{profile?.glider_manufacturer} {profile?.glider_model} · HC {profile?.adjusted_handicap?.toFixed(4) || profile?.base_handicap?.toFixed(4) || '—'} · #{profile?.competition_number}</div>
        </div>

        {openTasks.length === 0 && <InfoBox type="warn">No open task days to upload to. The CD may not have set up a task yet, or all days are finalized.</InfoBox>}

        {openTasks.length > 0 && (
          <>
            <Field label="Select Task Day">
              <Select value={selTask} onChange={setSelTask} options={[{value:'',label:'Choose a day…'}, ...openTasks.map(t=>({value:t.id, label:`${t.date} — Gate: ${t.gate_open}`}))]} />
            </Field>

            <Field label="IGC File">
              <label style={{ display:'block', border:`2px dashed ${C.cloudEdge}`, borderRadius:8, padding:'20px', textAlign:'center', cursor:'pointer', background:file?C.greenBg:C.skyPale, transition:'all 0.15s' }}>
                <input type="file" accept=".igc" style={{display:'none'}} onChange={e=>setFile(e.target.files[0])} />
                {file
                  ? <span style={{ color:C.green, fontWeight:600 }}>✓ {file.name}</span>
                  : <span style={{ color:C.navyFaint, fontSize:13 }}>Click to select your .igc file</span>}
              </label>
            </Field>

            {error && <InfoBox type="warn">{error}</InfoBox>}

            {result && (
              <div style={{ background:result.status==='FINISHED'?C.greenBg:C.orangeBg, border:`1px solid ${result.status==='FINISHED'?'#86efac':'#fdba74'}`, borderRadius:8, padding:'14px 16px', marginBottom:12 }}>
                <div style={{ fontWeight:700, color:result.status==='FINISHED'?C.green:C.orange, marginBottom:4 }}>
                  {result.status === 'FINISHED' ? '✓ Scored successfully' : `⚠ ${result.status}`}
                </div>
                {result.elapsed && <div style={{ fontSize:13, color:C.navy }}>Time: <strong>{fmtTime(result.elapsed)}</strong></div>}
                {result.penaltySecs > 0 && <div style={{ fontSize:12, color:C.orange }}>Penalties: +{fmtTime(result.penaltySecs)}</div>}
                <div style={{ fontSize:11, color:C.navyFaint, marginTop:4 }}>{result.detail}</div>
              </div>
            )}

            <Btn onClick={upload} disabled={uploading||!selTask||!file} style={{ width:'100%' }}>
              {uploading ? 'Processing IGC…' : 'Upload & Score'}
            </Btn>
          </>
        )}
      </Card>
    </div>
  );
}
