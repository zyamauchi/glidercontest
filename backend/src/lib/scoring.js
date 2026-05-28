// ─── Haversine distance in nautical miles ─────────────────────────────────────
export function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Parse IGC time string HHMMSS → seconds since midnight ───────────────────
export function igcTimeToSecs(t) {
  if (!t || t.length < 6) return null;
  const h = parseInt(t.slice(0, 2));
  const m = parseInt(t.slice(2, 4));
  const s = parseInt(t.slice(4, 6));
  return isNaN(h) || isNaN(m) || isNaN(s) ? null : h * 3600 + m * 60 + s;
}

// ─── Parse full IGC file text → fixes array ───────────────────────────────────
export function parseIGC(text) {
  const lines = text.split(/\r?\n/);
  const fixes = [];
  let gliderType = '', gliderReg = '', competitionId = '';

  for (const line of lines) {
    if (line.startsWith('HFGTYGLIDERTYPE:')) gliderType = line.slice(16).trim();
    if (line.startsWith('HFGIDGLIDERID:'))   gliderReg  = line.slice(14).trim();
    if (line.startsWith('HFCIDCOMPETITIONID:')) competitionId = line.slice(19).trim();

    if (line.startsWith('B') && line.length >= 35) {
      const ts = igcTimeToSecs(line.slice(1, 7));
      const latD = parseInt(line.slice(7, 9));
      const latM = parseFloat(line.slice(9, 14)) / 1000;
      const latH = line[14];
      const lonD = parseInt(line.slice(15, 18));
      const lonM = parseFloat(line.slice(18, 23)) / 1000;
      const lonH = line[23];
      const valid = line[24] === 'A';
      const pressAlt = parseInt(line.slice(25, 30));
      const gpsAlt   = parseInt(line.slice(30, 35));

      if (ts == null || isNaN(latD) || isNaN(lonD)) continue;
      let lat = latD + latM / 60;
      let lon = lonD + lonM / 60;
      if (latH === 'S') lat = -lat;
      if (lonH === 'W') lon = -lon;
      fixes.push({ t: ts, lat, lon, pressAlt, gpsAlt, valid });
    }
  }
  return { fixes, gliderType, gliderReg, competitionId };
}

// ─── Score a single IGC file against a task ──────────────────────────────────
// Returns { status, elapsed, penaltySecs, startSecs, finishSecs, earlyPenalty, detail }
export function scoreIGC(igcData, pilot, task, penalties) {
  const { fixes } = igcData;
  if (!fixes.length) return { status: 'NO_FIX', penaltySecs: 0, detail: 'No GPS fixes found' };

  const ref   = task.referenceHandicap;
  const ratio = ref > 0 ? pilot.handicap / ref : 1;
  const tps   = task.taskPoints;

  const gateOpen  = igcTimeToSecs(task.gateOpen.replace(/:/g, '').padEnd(6, '0').slice(0, 6));
  const gateClose = gateOpen + (task.startWindowMins || 0) * 60;

  let pen = 0, startSecs = null, finishSecs = null, earlyPenalty = 0;
  const sRad = task.startType === 'line' ? 0.05 : parseFloat(task.startRadius) || 1;

  // ── Find start crossing ──
  for (let i = 1; i < fixes.length; i++) {
    const f = fixes[i];
    if (haversineNm(f.lat, f.lon, tps[0].lat, tps[0].lon) <= sRad) {
      if (f.t < gateOpen) {
        earlyPenalty = (gateOpen - f.t) * (penalties.earlyStartMultiplier || 20);
        startSecs = gateOpen;
        pen += earlyPenalty;
      } else if (task.permissiveWindow && f.t <= gateClose) {
        startSecs = f.t;
      } else if (task.permissiveWindow && f.t > gateClose) {
        startSecs = gateClose;
      } else {
        startSecs = f.t;
      }
      break;
    }
  }
  if (startSecs == null) return { status: 'NO_START', penaltySecs: pen, detail: 'No valid start crossing found' };

  // ── Start ceiling check (60s before start) ──
  if (task.startCeilingFt) {
    const ceil = parseFloat(task.startCeilingFt);
    const cs = Math.max(0, fixes.findIndex(f => f.t >= startSecs - 60));
    const ce = fixes.findIndex(f => f.t >= startSecs);
    for (let i = cs; i <= ce && i < fixes.length; i++) {
      if (fixes[i].pressAlt > ceil) {
        pen += penalties.ceilingBustPenaltySecs || 0;
        break;
      }
    }
  }

  // ── Airspace / altitude check ──
  for (const f of fixes) {
    if (f.pressAlt > (parseFloat(task.maxAltitudeFt) || 17500)) {
      return { status: 'AIRSPACE_BUST', penaltySecs: pen, elapsed: null, detail: `Exceeded ${task.maxAltitudeFt || 17500}ft MSL` };
    }
  }

  // ── Turnpoint confirmation ──
  let tpIdx = 1;
  for (let i = 0; i < fixes.length && tpIdx < tps.length - 1; i++) {
    const f = fixes[i];
    if (f.t < startSecs) continue;
    const tp = tps[tpIdx];
    const rNm = tp.radiusType === 'fixed'
      ? parseFloat(tp.radius) || 1
      : (parseFloat(tp.radius) || 1) * ratio;
    if (haversineNm(f.lat, f.lon, tp.lat, tp.lon) <= rNm) tpIdx++;
  }
  if (tpIdx < tps.length - 1) {
    return { status: 'MISSED_TP', penaltySecs: pen, elapsed: null, detail: `Missed turnpoint ${tpIdx}: ${tps[tpIdx].name}` };
  }

  // ── Finish ──
  const finTp  = tps[tps.length - 1];
  const finRad = parseFloat(task.finishRadius) || 1;
  const minAlt = parseFloat(task.minFinishAltFt) || 1280;

  for (let i = 0; i < fixes.length; i++) {
    const f = fixes[i];
    if (f.t <= startSecs) continue;
    if (haversineNm(f.lat, f.lon, finTp.lat, finTp.lon) <= finRad) {
      finishSecs = f.t;
      if (f.pressAlt < minAlt) {
        const ftBelow = minAlt - f.pressAlt;
        pen += ftBelow * (penalties.belowMinAltPerFoot || 10);
      }
      break;
    }
  }
  if (finishSecs == null) {
    return { status: 'DNF', penaltySecs: pen, elapsed: null, detail: 'Did not reach finish cylinder' };
  }

  const elapsed = finishSecs - startSecs + pen;
  return { status: 'FINISHED', elapsed, penaltySecs: pen, startSecs, finishSecs, earlyPenalty, detail: 'OK' };
}

// ─── Wing loading adjusted handicap ──────────────────────────────────────────
export function applyWingLoading(baseHC, W, Wref, formula) {
  if (!W || !Wref || formula === 'none') return baseHC;
  if (formula === 'RC') return baseHC * (1 - 0.0002 * (W - Wref));
  if (formula === 'HC') {
    const r = W / Wref;
    return baseHC * (1.3 - 0.4 * r + 0.1 * r * r);
  }
  return baseHC;
}

// ─── Format seconds as h m s string ──────────────────────────────────────────
export function fmtTime(secs) {
  if (secs == null) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
    : `${m}m ${String(s).padStart(2, '0')}s`;
}
