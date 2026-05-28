import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PageWrap, Card, Field, Input, Btn, InfoBox, C } from '../components/ui';

export default function AuthPage() {
  const [mode, setMode]       = useState('login'); // login | signup
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]       = useState('pilot');
  const [cdCode, setCdCode]   = useState('');
  const [error, setError]     = useState('');
  const [msg, setMsg]         = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp }    = useAuth();
  const navigate              = useNavigate();

  const CD_INVITE_CODE = import.meta.env.VITE_CD_INVITE_CODE || 'GC-CD-2025';

  async function handleSubmit() {
    setError(''); setMsg('');
    if (!email || !password) return setError('Email and password required');
    if (mode === 'signup' && role === 'cd' && cdCode !== CD_INVITE_CODE) {
      return setError('Invalid CD invite code');
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate('/dashboard');
      } else {
        await signUp(email, password, role);
        setMsg('Check your email to confirm your account, then sign in.');
        setMode('login');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageWrap>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:24, position:'relative', zIndex:1 }}>
        <div style={{ width:'100%', maxWidth:420 }}>
          {/* Logo */}
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <svg width="56" height="32" viewBox="0 0 42 24" fill="none" style={{ opacity:0.9 }}>
              <path d="M2 16 Q12 4 22 12 Q31 18 40 9" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <path d="M18 12 L14 22 L22 14" stroke={C.navy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M22 12 L22 6 L27 13" stroke={C.navy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <div style={{ fontFamily:"'Teko',sans-serif", fontWeight:700, fontSize:34, color:C.navy, letterSpacing:'0.06em', lineHeight:1, marginTop:8 }}>GLIDERCONTEST</div>
            <div style={{ fontSize:11, color:C.navyFaint, letterSpacing:'0.12em', textTransform:'uppercase', marginTop:4 }}>Variable Distance Handicap · Grand Prix</div>
          </div>

          <Card>
            {/* Mode tabs */}
            <div style={{ display:'flex', borderBottom:`1.5px solid ${C.cloudEdge}`, marginBottom:24, gap:2 }}>
              {['login','signup'].map(m => (
                <button key={m} onClick={()=>{setMode(m);setError('');setMsg('');}} style={{ flex:1, padding:'10px 0', background:mode===m?C.skyPale:'transparent', color:mode===m?C.navy:C.navyFaint, border:'none', borderBottom:mode===m?`2px solid ${C.skyTop}`:'2px solid transparent', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:mode===m?700:400, marginBottom:-1.5 }}>
                  {m === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            {error && <InfoBox type="warn">{error}</InfoBox>}
            {msg   && <InfoBox>{msg}</InfoBox>}

            <div style={{ marginTop:16 }}>
              <Field label="Email">
                <Input type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              </Field>
              <Field label="Password">
                <Input type="password" value={password} onChange={setPassword} placeholder="••••••••" />
              </Field>

              {mode === 'signup' && (
                <>
                  <Field label="Account Type">
                    <div style={{ display:'flex', gap:10 }}>
                      {['pilot','cd'].map(r => (
                        <button key={r} onClick={()=>setRole(r)} style={{ flex:1, padding:'9px 0', background:role===r?C.skyTop:'transparent', color:role===r?'white':C.navyMid, border:`1.5px solid ${role===r?C.skyTop:C.cloudEdge}`, borderRadius:6, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
                          {r === 'pilot' ? '✈ Pilot' : '📋 Contest Director'}
                        </button>
                      ))}
                    </div>
                  </Field>
                  {role === 'cd' && (
                    <Field label="CD Invite Code" hint="Provided by the contest organizer">
                      <Input value={cdCode} onChange={setCdCode} placeholder="GC-CD-XXXX" />
                    </Field>
                  )}
                </>
              )}

              <Btn onClick={handleSubmit} disabled={loading} style={{ width:'100%', marginTop:8, padding:'11px 0', fontSize:14 }}>
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </Btn>
            </div>

            {mode === 'login' && (
              <div style={{ marginTop:16, textAlign:'center', fontSize:12, color:C.navyFaint }}>
                New pilot? <button onClick={()=>setMode('signup')} style={{ background:'none', border:'none', color:C.skyTop, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600 }}>Create an account</button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageWrap>
  );
}
