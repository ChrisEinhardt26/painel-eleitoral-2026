import http from 'node:http';
import fs from 'node:fs/promises';
const PORT=process.env.PORT||3000;
const ROOT='https://resultados.tse.jus.br/oficial';
const UFS='AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
const regions={Norte:'AC AM AP PA RO RR TO',Nordeste:'AL BA CE MA PB PE PI RN SE','Centro-Oeste':'DF GO MS MT',Sudeste:'ES MG RJ SP',Sul:'PR RS SC'};
const regionOf=uf=>Object.entries(regions).find(([,v])=>v.split(' ').includes(uf))?.[0];
const cache=new Map();
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});if(!r.ok)throw Error(`TSE HTTP ${r.status}`);return r.json()}
async function config(){const key='config',hit=cache.get(key);if(hit&&Date.now()-hit.time<3600000)return hit.data;const data=await get(`${ROOT}/comum/config/ele-c.json`);cache.set(key,{time:Date.now(),data});return data}
function electionPath(cfg,turn){const id=turn===1?'6257':'6258';const pl=cfg.pl?.find(p=>p.e?.some(e=>String(e.cd)===id));if(!pl)throw Error(`Eleição ${id} ainda não consta da configuração oficial`);return {id,cycle:pl.c};}
function asNum(x){const n=Number(x);return Number.isFinite(n)?n:0}
function parseEA20(data,uf){
  // EA20: abr[0].cand (candidaturas), com votos vap e identificador n.
  const scope=Array.isArray(data.abr)?data.abr.find(x=>String(x.cd||'').toLowerCase()===uf.toLowerCase())||data.abr[0]:data;
  const cand=scope?.cand;
  if(!Array.isArray(cand))throw Error(`EA20 sem lista de candidaturas (${uf}); conferir estrutura`);
  const candidates=cand.filter(c=>[13,22].includes(asNum(c.n))).map(c=>({number:asNum(c.n),name:asNum(c.n)===13?'Lula':'Flávio Bolsonaro',votes:asNum(c.vap)}));
  if(candidates.length!==2)throw Error(`EA20 não contém os dois candidatos esperados (${uf})`);
  const votes=asNum(scope.vv??data.vv);
  if(!votes && candidates.some(c=>c.votes))throw Error(`Total de votos válidos ausente (${uf})`);
  return {uf,region:regionOf(uf)||null,votes,candidates,sections:asNum(scope.st??data.st),sectionsTotal:asNum(scope.s??data.s),updated:data.dg||null};
}
async function snapshot(turn){const key=`turn-${turn}`,hit=cache.get(key);if(hit&&Date.now()-hit.time<(turn===1?3600000:30000))return hit.data;
  const {id,cycle}=electionPath(await config(),turn);
  const load=async uf=>{const code=uf.toLowerCase();const url=`${ROOT}/${cycle}/${id}/dados/${code}/${code}-c0001-e${id.padStart(6,'0')}-u.json`;return parseEA20(await get(url),uf)};
  const results=await Promise.allSettled([...UFS,'ZZ'].map(load));const all=[...UFS,'ZZ'];const states=results.flatMap((r,i)=>r.status==='fulfilled'?[r.value]:[]);
  const errors=results.flatMap((r,i)=>r.status==='rejected'?[`${all[i]}: ${r.reason.message}`]:[]);
  if(!states.length)throw Error(`Nenhum resultado EA20 validado. ${errors.slice(0,3).join(' | ')}`);
  const data={turn,source:'TSE EA20',retrievedAt:new Date().toISOString(),states,errors,complete:errors.length===0};cache.set(key,{time:Date.now(),data});return data;
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
http.createServer(async(req,res)=>{const send=(status,obj)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj))};try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/health')return send(200,{ok:true,server:'online',time:new Date().toISOString()});if(url.pathname==='/api/config-check'){const c=await config();return send(200,{ok:true,configured:[1,2].map(turn=>{try{return {turn,...electionPath(c,turn)}}catch(e){return {turn,error:e.message}}})})}if(url.pathname==='/api/results'){const turn=url.searchParams.get('turn')==='1'?1:2;return send(200,await snapshot(turn))}const file=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!['index.html','app.js','style.css'].includes(file))return send(404,{error:'Not found'});const data=await fs.readFile(new URL(file,import.meta.url));res.writeHead(200,{'content-type':mime[file.slice(file.lastIndexOf('.'))]});res.end(data)}catch(e){send(503,{error:e.message})}}).listen(PORT,()=>console.log(`Painel em ${PORT}`));
