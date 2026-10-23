import http from 'node:http';
import fs from 'node:fs/promises';

const PORT = process.env.PORT || 3000;
const ROOT = 'https://resultados.tse.jus.br/oficial';
const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
const regions = { Norte:'AC AM AP PA RO RR TO', Nordeste:'AL BA CE MA PB PE PI RN SE', 'Centro-Oeste':'DF GO MS MT', Sudeste:'ES MG RJ SP', Sul:'PR RS SC' };
const regionOf = uf => Object.entries(regions).find(([,v]) => v.split(' ').includes(uf))?.[0] || null;
const cache = new Map();

async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { accept:'application/json' } });
  if (!r.ok) throw Error(`TSE HTTP ${r.status}`);
  return r.json();
}
async function config() {
  const hit = cache.get('config');
  if (hit && Date.now() - hit.time < 3600000) return hit.data;
  const data = await get(`${ROOT}/comum/config/ele-c.json`);
  cache.set('config', { time:Date.now(), data });
  return data;
}
function electionPath(cfg, turn) {
  const id = turn === 1 ? '6257' : '6258';
  const pl = cfg.pl?.find(p => p.e?.some(e => String(e.cd) === id));
  if (!pl) throw Error(`Eleição ${id} ainda não consta da configuração oficial`);
  return { id, cycle:pl.c };
}
function asNum(x) {
  if (x === undefined || x === null || x === '') return NaN;
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}
function parseEA20(data, uf) {
  if (String(data.cdabr || '').toUpperCase() !== uf || !Array.isArray(data.carg))
    throw Error(`Arquivo EA20 inesperado para ${uf}`);
  const president = data.carg.find(c => String(c.cd) === '1');
  if (!president || !Array.isArray(president.agr))
    throw Error(`Cargo de presidente ausente (${uf})`);
  const allCandidates = president.agr.flatMap(a =>
    Array.isArray(a.par) ? a.par.flatMap(p => Array.isArray(p.cand) ? p.cand : []) : []
  );
  const candidates = [13,22].map(number => {
    const c = allCandidates.find(x => asNum(x.n) === number);
    if (!c || !Number.isFinite(asNum(c.vap))) throw Error(`Candidato ${number} ausente ou sem votos (${uf})`);
    return { number, name:c.nmu || (number === 13 ? 'Lula' : 'Flávio Bolsonaro'), votes:asNum(c.vap) };
  });
  const votes = asNum(data.v?.vv);
  const sections = asNum(data.s?.st);
  const sectionsTotal = asNum(data.s?.ts);
  if (![votes, sections, sectionsTotal].every(Number.isFinite) || sections > sectionsTotal || sections < 0 || votes < 0)
    throw Error(`Totais ausentes ou inválidos (${uf})`);
  const sumAll = allCandidates.reduce((sum,c) => sum + (Number.isFinite(asNum(c.vap)) ? asNum(c.vap) : 0), 0);
  if (sumAll !== votes) throw Error(`Soma dos votos dos candidatos difere dos votos válidos (${uf})`);
  return { uf, region:regionOf(uf), votes, candidates, sections, sectionsTotal, updated:`${data.dg || ''} ${data.hg || ''}`.trim() };
}
async function loadEA20(turn, uf) {
  const { id, cycle } = electionPath(await config(), turn);
  const code = uf.toLowerCase();
  const url = `${ROOT}/${cycle}/${id}/dados/${code}/${code}-c0001-e${id.padStart(6,'0')}-u.json`;
  return get(url);
}
async function snapshot(turn) {
  const key = `turn-${turn}`, hit = cache.get(key);
  if (hit && Date.now() - hit.time < (turn === 1 ? 3600000 : 30000)) return hit.data;
  const all = [...UFS, 'ZZ'];
  const results = await Promise.allSettled(all.map(async uf => parseEA20(await loadEA20(turn, uf), uf)));
  const states = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
  const errors = results.flatMap((r,i) => r.status === 'rejected' ? [`${all[i]}: ${r.reason.message}`] : []);
  if (!states.length) throw Error(`Nenhum resultado EA20 validado. ${errors.slice(0,3).join(' | ')}`);
  const data = { turn, source:'TSE EA20', retrievedAt:new Date().toISOString(), states, errors, complete:errors.length === 0 };
  cache.set(key, { time:Date.now(), data });
  return data;
}
async function diagnoseEA20() {
  const data = await loadEA20(1, 'AC');
  return { source:'TSE', election:data.ele, uf:data.cdabr?.toUpperCase(),
    topLevelKeys:Object.keys(data),
    presidentKeys:data.carg?.find(c => String(c.cd) === '1') ? Object.keys(data.carg.find(c => String(c.cd) === '1')) : [],
    result:parseEA20(data, 'AC') };
}
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };
http.createServer(async (req,res) => {
  const send = (status,obj) => { res.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' }); res.end(JSON.stringify(obj)); };
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/health') return send(200, { ok:true, server:'online', time:new Date().toISOString() });
    if (url.pathname === '/api/config-check') {
      const c = await config();
      return send(200, { ok:true, configured:[1,2].map(turn => { try { return { turn, ...electionPath(c,turn) }; } catch(e) { return { turn, error:e.message }; } }) });
    }
    if (url.pathname === '/api/diagnostico') return send(200, await diagnoseEA20());
    if (url.pathname === '/api/results') return send(200, await snapshot(url.searchParams.get('turn') === '1' ? 1 : 2));
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html','app.js','style.css'].includes(file)) return send(404, { error:'Not found' });
    const data = await fs.readFile(new URL(file, import.meta.url));
    res.writeHead(200, { 'content-type':mime[file.slice(file.lastIndexOf('.'))] });
    res.end(data);
  } catch(e) { send(503, { error:e.message }); }
}).listen(PORT, () => console.log(`Painel em ${PORT}`));
