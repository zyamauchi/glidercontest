import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';
import { PageWrap, TopNav, Card, SectionTitle, Btn, InfoBox, C } from '../components/ui';

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const isCD = profile?.role === 'cd';

  useEffect(() => {
    if (!profile) return;
    apiFetch('/contests').then(setContests).catch(console.error).finally(() => setLoading(false));
  }, [profile]);

  const profileComplete = profile?.full_name && (isCD || profile?.glider_model);

  return (
    <PageWrap>
      <TopNav contestName="GliderContest" onSignOut={signOut} role={profile?.role} />
      <div style={{ padding:'28px 32px', maxWidth:1000, margin:'0 auto', position:'relative', zIndex:1 }}>

        {!profileComplete && (
          <InfoBox type="warn" style={{ marginBottom:20 }}>
            Complete your profile before joining or creating contests. <Link to="/profile" style={{ color:C.orange, fontWeight:700 }}>Complete profile →</Link>
          </InfoBox>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <SectionTitle>{isCD ? 'Your Contests' : 'My Contests'}</SectionTitle>
          <div style={{ display:'flex', gap:10 }}>
            <Btn variant="ghost" small onClick={() => navigate('/profile')}>Edit Profile</Btn>
            {isCD && <Btn small onClick={() => navigate('/contests/new')}>+ New Contest</Btn>}
          </div>
        </div>

        {loading && <div style={{ color:C.navyFaint }}>Loading…</div>}

        {!loading && contests.length === 0 && (
          <Card>
            <div style={{ textAlign:'center', padding:'32px 0', color:C.navyFaint }}>
              {isCD ? 'No contests yet. Create your first contest.' : 'You are not registered in any contests. Ask your CD for the contest link.'}
            </div>
          </Card>
        )}

        {contests.map(c => (
          <Card key={c.id} style={{ cursor:'pointer', marginBottom:12 }} onClick={() => navigate(`/contests/${c.id}`)}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:18, color:C.navy, marginBottom:4 }}>{c.name}</div>
                <div style={{ fontSize:13, color:C.navyLight }}>{c.location} · {c.start_date}{c.end_date && c.end_date !== c.start_date ? ` – ${c.end_date}` : ''}</div>
                {c.profiles && <div style={{ fontSize:12, color:C.navyFaint, marginTop:2 }}>CD: {c.profiles.full_name}</div>}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <StatusPill status={c.status} />
                <Btn small variant="ghost">Open →</Btn>
              </div>
            </div>
          </Card>
        ))}

        {!isCD && (
          <div style={{ marginTop:16 }}>
            <Btn variant="ghost" onClick={() => navigate('/join')}>Join a Contest with Code</Btn>
          </div>
        )}
      </div>
    </PageWrap>
  );
}

function StatusPill({ status }) {
  const map = { setup:{bg:'#e0f2fe',color:'#0369a1',label:'Setup'}, open:{bg:C.greenBg,color:C.green,label:'Active'}, closed:{bg:C.grayBg,color:C.gray,label:'Closed'} };
  const s = map[status] || map.setup;
  return <span style={{ background:s.bg, color:s.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{s.label}</span>;
}

