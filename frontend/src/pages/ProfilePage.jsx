import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';
import { PageWrap, TopNav, Card, Field, Input, Select, Btn, InfoBox, SectionTitle, C } from '../components/ui';

export default function ProfilePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '', competition_number: '', n_number: '',
    glider_manufacturer: '', glider_model: '',
    takeoff_weight_lbs: '', wl_formula: 'none',
  });
  const [gliderSearch, setGliderSearch] = useState('');
  const [gliderResults, setGliderResults] = useState([]);
  const [selectedGlider, setSelectedGlider] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const searchTimeout = useRef();

  useEffect(() => {
    apiFetch('/auth/me').then(p => {
      setForm({
        full_name: p.full_name || '',
        competition_number: p.competition_number || '',
        n_number: p.n_number || '',
        glider_manufacturer: p.glider_manufacturer || '',
        glider_model: p.glider_model || '',
        takeoff_weight_lbs: p.takeoff_weight_lbs || '',
        wl_formula: p.wl_formula || 'none',
      });
      if (p.glider_manufacturer && p.glider_model) {
        setGliderSearch(`${p.glider_manufacturer} ${p.glider_model}`);
        setSelectedGlider({
          manufacturer: p.glider_manufacturer,
          model: p.glider_model,
          handicap: p.base_handicap,
          refWeight: p.ref_weight_lbs,
        });
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (gliderSearch.length < 2) { setGliderResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await apiFetch(`/pilots/gliders?q=${encodeURIComponent(gliderSearch)}`);
        setGliderResults(data);
      } catch {}
    }, 300);
  }, [gliderSearch]);

  function selectGlider(g) {
    setSelectedGlider(g);
    setForm(f => ({ ...f, glider_manufacturer: g.manufacturer, glider_model: g.model }));
    setGliderSearch(`${g.manufacturer} ${g.model}`);
    setGliderResults([]);
  }

  function computeAdjHC() {
    if (!selectedGlider?.handicap) return null;
    const hc = selectedGlider.handicap;
    const W = parseFloat(form.takeoff_weight_lbs);
    const Wref = selectedGlider.refWeight;
    if (!W || !Wref || form.wl_formula === 'none') return hc;
    if (form.wl_formula === 'RC') return hc * (1 - 0.0002 * (W - Wref));
    if (form.wl_formula === 'HC') { const r = W / Wref; return hc * (1.3 - 0.4 * r + 0.1 * r * r); }
    return hc;
  }

  async function save() {
    if (!form.full_name) return setError('Full name is required');
    setSaving(true); setError(''); setMsg('');
    try {
      await apiFetch('/auth/me', { method: 'PUT', body: form });
      setMsg('Profile saved!');
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const adjHC = computeAdjHC();

  return (
    <PageWrap>
      <TopNav contestName="GliderContest" onSignOut={signOut} role={profile?.role} />
      <div style={{ padding:'28px 32px', maxWidth:720, margin:'0 auto', position:'relative', zIndex:1 }}>
        <SectionTitle>Your Pilot Profile</SectionTitle>
        <Card>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <Field label="Full Name"><Input value={form.full_name} onChange={v=>setForm(f=>({...f,full_name:v}))} placeholder="Your full name" /></Field>
            <Field label="Competition Number"><Input value={form.competition_number} onChange={v=>setForm(f=>({...f,competition_number:v}))} placeholder="e.g. 5K" /></Field>
            <Field label="N-Number / Registration"><Input value={form.n_number} onChange={v=>setForm(f=>({...f,n_number:v}))} placeholder="e.g. N12345" /></Field>
          </div>
        </Card>

        <Card>
          <SectionTitle>Glider and Handicap</SectionTitle>
          <Field label="Search Glider (SSA Handicap List)">
            <div style={{ position:'relative' }}>
              <Input value={gliderSearch} onChange={setGliderSearch} placeholder="Type manufacturer or model..." />
              {gliderResults.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:`1.5px solid ${C.cloudEdge}`, borderRadius:8, boxShadow:'0 4px 20px rgba(13,52,97,0.15)', zIndex:100, maxHeight:260, overflowY:'auto' }}>
                  {gliderResults.map((g, i) => (
                    <div key={i} onClick={() => selectGlider(g)} style={{ padding:'9px 14px', cursor:'pointer', borderBottom:`1px solid ${C.skyLight}` }}>
                      <div style={{ fontWeight:600, color:C.navy, fontSize:13 }}>{g.manufacturer} {g.model}</div>
                      <div style={{ fontSize:11, color:C.navyFaint }}>HC: {g.handicap} · Ref weight: {g.refWeight} lbs</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {selectedGlider && (
            <div style={{ background:C.skyPale, border:`1px solid ${C.cloudEdge}`, borderRadius:8, padding:'10px 14px', fontSize:12, color:'#0369a1', marginBottom:12 }}>
              <strong>{selectedGlider.manufacturer} {selectedGlider.model}</strong> · Base HC: <strong>{selectedGlider.handicap}</strong> · Ref weight: {selectedGlider.refWeight} lbs
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:8 }}>
            <Field label="Takeoff Weight (lbs)" hint="Used for wing loading adjustment">
              <Input type="number" value={form.takeoff_weight_lbs} onChange={v=>setForm(f=>({...f,takeoff_weight_lbs:v}))} placeholder="e.g. 850" />
            </Field>
            <Field label="Wing Loading Adjustment">
              <Select value={form.wl_formula} onChange={v=>setForm(f=>({...f,wl_formula:v}))} options={[
                {value:'none', label:'No adjustment (use base HC)'},
                {value:'RC',   label:'RC Formula'},
                {value:'HC',   label:'HC Committee Formula'},
              ]} />
            </Field>
          </div>

          {adjHC != null && (
            <div style={{ background:C.skyPale, border:`1px solid ${C.cloudEdge}`, borderRadius:8, padding:'12px 16px', marginTop:4, display:'flex', gap:24 }}>
              <div><div style={{ fontSize:10, color:C.navyFaint, textTransform:'uppercase' }}>Base HC</div><div style={{ fontSize:20, fontWeight:800, color:C.navy }}>{selectedGlider?.handicap?.toFixed(4)}</div></div>
              {form.wl_formula !== 'none' && <>
                <div style={{ fontSize:24, color:C.navyFaint, alignSelf:'center' }}>→</div>
                <div><div style={{ fontSize:10, color:C.navyFaint, textTransform:'uppercase' }}>Adjusted HC</div><div style={{ fontSize:20, fontWeight:800, color:C.skyTop }}>{adjHC.toFixed(4)}</div></div>
              </>}
            </div>
          )}
        </Card>

        {error && <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#92400e', marginTop:8 }}>{error}</div>}
        {msg   && <div style={{ background:'#e0f2fe', border:'1px solid #bae6fd', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#0369a1', marginTop:8 }}>{msg}</div>}

        <div style={{ display:'flex', gap:12, marginTop:16 }}>
          <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</Btn>
          <Btn variant="ghost" onClick={() => navigate('/dashboard')}>Back to Dashboard</Btn>
        </div>
      </div>
    </PageWrap>
  );
}
