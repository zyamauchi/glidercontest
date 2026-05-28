import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';
import { PageWrap, TopNav, Card, SectionTitle, Field, Input, Btn, InfoBox } from '../components/ui';

export default function NewContest() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', location:'', start_date:'', end_date:'', frequency:'123.5' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    if (!form.name || !form.start_date) return setError('Contest name and start date are required');
    setSaving(true);
    try {
      const contest = await apiFetch('/contests', { method:'POST', body: form });
      navigate(`/contests/${contest.id}`);
    } catch(e) { setError(e.message); setSaving(false); }
  }

  return (
    <PageWrap>
      <TopNav contestName="New Contest" onSignOut={signOut} role="CD" />
      <div style={{ padding:'28px 32px', maxWidth:520, margin:'0 auto', position:'relative', zIndex:1 }}>
        <SectionTitle>Create New Contest</SectionTitle>
        <Card>
          <Field label="Contest Name"><Input value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="e.g. Avenal Spring 2026" /></Field>
          <Field label="Location / Airport"><Input value={form.location} onChange={v=>setForm(f=>({...f,location:v}))} placeholder="e.g. Avenal Airport" /></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Start Date"><Input type="date" value={form.start_date} onChange={v=>setForm(f=>({...f,start_date:v}))} /></Field>
            <Field label="End Date"><Input type="date" value={form.end_date} onChange={v=>setForm(f=>({...f,end_date:v}))} /></Field>
          </div>
          <Field label="Contest Frequency"><Input value={form.frequency} onChange={v=>setForm(f=>({...f,frequency:v}))} /></Field>
          {error && <InfoBox type="warn">{error}</InfoBox>}
          <div style={{ display:'flex', gap:10, marginTop:12 }}>
            <Btn onClick={create} disabled={saving}>{saving?'Creating…':'Create Contest'}</Btn>
            <Btn variant="ghost" onClick={()=>navigate('/dashboard')}>Cancel</Btn>
          </div>
        </Card>
      </div>
    </PageWrap>
  );
}
