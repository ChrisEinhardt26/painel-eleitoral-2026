const $=id=>document.getElementById(id);
let tab='estados',current=null,baseline=null;
const fmt=n=>new Intl.NumberFormat('pt-BR').format(n||0);
const pct=n=>`${n.toFixed(2).replace('.',',')}%`;
const total=arr=>arr.reduce((a,s)=>a+s,0);

function aggregate(states,label){
  const a={
    label,
    sections:total(states.map(s=>s.sections)),
    sectionsTotal:total(states.map(s=>s.sectionsTotal)),
    votes:total(states.map(s=>s.votes)),
    blue:total(states.map(s=>s.candidates.find(c=>c.number===22)?.votes||0)),
    red:total(states.map(s=>s.candidates.find(c=>c.number===13)?.votes||0))
  };
  a.bluePct=a.votes?100*a.blue/a.votes:0;
  a.redPct=a.votes?100*a.red/a.votes:0;
  return a;
}

function groups(data){
  if(!data)return[];
  if(tab==='estados')return data.states.filter(s=>s.uf!=='ZZ').map(s=>aggregate([s],s.uf));
  if(tab==='regioes')return ['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'].map(r=>aggregate(data.states.filter(s=>s.region===r),r));
  return [aggregate(data.states,'Brasil (inclui exterior)')];
}

function comparison(a,b){
  if(a.sections===0 || a.votes===0)return 'Aguardando início da apuração do 2º turno.';
  if(!b?.votes)return 'Comparação com 1º turno indisponível';
  const denominator=b.blue+b.red;
  if(!denominator)return 'Referência indisponível';
  const normalized=100*b.blue/denominator;
  const diff=a.bluePct-normalized;
  return `Flávio: ${diff>=0?'+':''}${diff.toFixed(2).replace('.',',')} p.p. frente à participação entre os dois candidatos no 1º turno (Lula: ${diff<=0?'+':''}${(-diff).toFixed(2).replace('.',',')} p.p.)`;
}

function render(){
  const rows=groups(current),old=groups(baseline);
  $('heading').textContent={estados:'Apuração por estado',regioes:'Apuração por região',total:'Total Brasil'}[tab];
  $('metrics').innerHTML='';
  $('content').innerHTML='';
  if(!rows.length){
    $('content').innerHTML='<div class="empty">Nenhum dado oficial disponível nesta consulta. O painel não exibe números simulados.</div>';
    return;
  }
  const nat=aggregate(current.states,'Brasil');
  const cards=[
    ['Seções totalizadas',`${fmt(nat.sections)} / ${fmt(nat.sectionsTotal)}`],
    ['Flávio Bolsonaro',`${fmt(nat.blue)} · ${pct(nat.bluePct)}`],
    ['Lula',`${fmt(nat.red)} · ${pct(nat.redPct)}`]
  ];
  cards.forEach(([name,value],i)=>{
    const c=document.createElement('div');
    c.className='metric';
    c.innerHTML=`<span>${name}</span><strong class="${i===1?'blue':i===2?'red':''}">${value}</strong>`;
    $('metrics').append(c);
  });
  rows.forEach(r=>{
    const prior=old.find(x=>x.label===r.label);
    const el=document.createElement('div');
    el.className='entry';
    el.innerHTML=`<div class="entry-head"><b>${r.label}</b><small>${fmt(r.sections)} / ${fmt(r.sectionsTotal)} seções · ${r.sectionsTotal?pct(100*r.sections/r.sectionsTotal):'—'} apurado</small></div><div class="bars"><div class="b" style="width:${r.bluePct}%"></div><div class="r" style="width:${r.redPct}%"></div></div><div class="sub"><span class="blue">Flávio ${pct(r.bluePct)} · ${fmt(r.blue)}</span><span class="red">Lula ${pct(r.redPct)} · ${fmt(r.red)}</span></div><div class="delta">${comparison(r,prior)}</div>`;
    $('content').append(el);
  });
}

async function load(){
  try{
    const [r1,r2]=await Promise.allSettled([
      fetch('/api/results?turn=1',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error((await r.json()).error);return r.json()}),
      fetch('/api/results?turn=2',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error((await r.json()).error);return r.json()})
    ]);
    if(r1.status==='fulfilled')baseline=r1.value;
    if(r2.status==='fulfilled')current=r2.value;
    const error=r2.status==='rejected'?r2.reason.message:null;
    $('status').textContent=current?'Dados oficiais carregados':'Sem dados oficiais';
    $('updated').textContent=current?'Consulta: '+new Date(current.retrievedAt).toLocaleString('pt-BR'):'';
    $('notice').textContent=error?`Atualização não concluída: ${error}. ${current?'Exibindo última consulta bem-sucedida.':''}`:current?.errors.length?`Atenção: ${current.errors.length} UFs não responderam. Totais são parciais.`:'Dados oficiais recebidos. Próxima consulta em 30 segundos.';
    render();
  }catch(e){$('notice').textContent='Falha: '+e.message}
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  tab=b.dataset.tab;
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x===b));
  render();
});
load();
setInterval(load,30000);
