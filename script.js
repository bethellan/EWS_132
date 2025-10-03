// v12.3: triple-checked scoring & colouring, cache-bust, expanded reference, AVPU=F, strict gate, cell-band toggle, clear resets everything

let ROW_COUNTER=0;
const byId=id=>document.getElementById(id);
const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

function parseN(td){
  const t=td.innerText.trim();
  if(t==='') return null;
  const n=Number(t);
  return Number.isNaN(n)?null:n;
}

// --- Scoring (CCDHB) ---
// Respiratory Rate (triple-checked against card)
// <5 MET; 5–8 +3; 9–11 +1; 12–20 0; 21–24 +2; 25–35 +3; >35 MET
function scoreResp(v){
  if(v===null) return {pts:null,met:false,zone:'none',reason:''};
  if(v<5) return {pts:null,met:true,zone:'blue',reason:`RR=${v} (MET)`};
  if(v<=8) return {pts:3,met:false,zone:'red',reason:`RR=${v} (+3)`};
  if(v<=11) return {pts:1,met:false,zone:'yellow',reason:`RR=${v} (+1)`};
  if(v<=20) return {pts:0,met:false,zone:'none',reason:''};
  if(v<=24) return {pts:2,met:false,zone:'orange',reason:`RR=${v} (+2)`};
  if(v<=35) return {pts:3,met:false,zone:'red',reason:`RR=${v} (+3)`};
  return {pts:null,met:true,zone:'blue',reason:`RR=${v} (MET)`};
}

// SpO2
function scoreSpO2(v){
  if(v===null) return {pts:null,met:false,zone:'none',reason:''};
  if(v<=91) return {pts:3,met:false,zone:'red',reason:`SpO₂=${v} (+3)`};
  if(v<=93) return {pts:2,met:false,zone:'orange',reason:`SpO₂=${v} (+2)`};
  if(v<=95) return {pts:1,met:false,zone:'yellow',reason:`SpO₂=${v} (+1)`};
  return {pts:0,met:false,zone:'none',reason:''};
}

// Supplemental O2
function scoreSupO2(v){
  if(v==='') return {pts:null,met:false,zone:'none',reason:''};
  if(v==='yes') return {pts:2,met:false,zone:'orange',reason:'Sup O₂=Yes (+2)'};
  return {pts:0,met:false,zone:'none',reason:''};
}

// Heart Rate (≤39 MET; 40–49 +3; 50–89 0; 90–110 +1; 111–129 +2; 130–139 +3; ≥140 MET)
function scoreHR(v){
  if(v===null) return {pts:null,met:false,zone:'none',reason:''};
  if(v<=39) return {pts:null,met:true,zone:'blue',reason:`HR=${v} (MET)`};
  if(v<=49) return {pts:3,met:false,zone:'red',reason:`HR=${v} (+3)`};
  if(v<=89) return {pts:0,met:false,zone:'none',reason:''};
  if(v<=110) return {pts:1,met:false,zone:'yellow',reason:`HR=${v} (+1)`};
  if(v<=129) return {pts:2,met:false,zone:'orange',reason:`HR=${v} (+2)`};
  if(v<=139) return {pts:3,met:false,zone:'red',reason:`HR=${v} (+3)`};
  return {pts:null,met:true,zone:'blue',reason:`HR=${v} (MET)`};
}

// Systolic BP (≤69 MET; 70–89 +3; 90–99 +2; 100–109 +1; 110–219 0; ≥220 +3)
function scoreSBP(v){
  if(v===null) return {pts:null,met:false,zone:'none',reason:''};
  if(v<=69) return {pts:null,met:true,zone:'blue',reason:`SBP=${v} (MET)`};
  if(v<=89) return {pts:3,met:false,zone:'red',reason:`SBP=${v} (+3)`};
  if(v<=99) return {pts:2,met:false,zone:'orange',reason:`SBP=${v} (+2)`};
  if(v<=109) return {pts:1,met:false,zone:'yellow',reason:`SBP=${v} (+1)`};
  if(v<=219) return {pts:0,met:false,zone:'none',reason:''};
  return {pts:3,met:false,zone:'red',reason:`SBP=${v} (+3)`};
}

// Temperature (≤34.9 +2; 35–35.9 +1; 36–37.9 0; 38–38.9 +1; ≥39 +2)
function scoreTemp(v){
  if(v===null) return {pts:null,met:false,zone:'none',reason:''};
  if(v<=34.9) return {pts:2,met:false,zone:'orange',reason:`Temp=${v} (+2)`};
  if(v<=35.9) return {pts:1,met:false,zone:'yellow',reason:`Temp=${v} (+1)`};
  if(v<=37.9) return {pts:0,met:false,zone:'none',reason:''};
  if(v<=38.9) return {pts:1,met:false,zone:'yellow',reason:`Temp=${v} (+1)`};
  return {pts:2,met:false,zone:'orange',reason:`Temp=${v} (+2)`};
}

// AVPU (with Fitting)
function scoreAVPU(v){
  if(v==='') return {pts:null,met:false,zone:'none',reason:''};
  if(v==='U' || v==='F') return {pts:null,met:true,zone:'blue',reason:`AVPU=${v} (MET)`};
  if(v==='V' || v==='P') return {pts:3,met:false,zone:'red',reason:`AVPU=${v} (+3)`};
  return {pts:0,met:false,zone:'none',reason:''};
}

const rank={none:0,yellow:1,orange:2,red:3,blue:4};
const maxZone=(a,b)=> rank[b]>rank[a]?b:a;

function bandFrom(parts,total){
  if(parts.some(p=>p.met)) return 'blue';
  let z='none'; parts.forEach(p=>{ z=maxZone(z,p.zone); });
  if(total>=10) return 'blue';
  if(z!=='none') return z;
  if(total>=8) return 'red';
  if(total>=6) return 'orange';
  if(total>=1) return 'yellow';
  return 'none';
}

function setRowBand(dr, det, band){
  // Only bed (first cell) and detail row get the band colour
  dr.classList.remove('row-yellow','row-orange','row-red','row-blue');
  det.firstElementChild.classList.remove('detail-yellow','detail-orange','detail-red','detail-blue');
  if(band==='yellow'){ dr.classList.add('row-yellow'); det.firstElementChild.classList.add('detail-yellow'); }
  else if(band==='orange'){ dr.classList.add('row-orange'); det.firstElementChild.classList.add('detail-orange'); }
  else if(band==='red'){ dr.classList.add('row-red'); det.firstElementChild.classList.add('detail-red'); }
  else if(band==='blue'){ dr.classList.add('row-blue'); det.firstElementChild.classList.add('detail-blue'); }
}

function clearCellHighlights(dr){
  qsa('.cell-yellow,.cell-orange,.cell-red,.cell-blue', dr).forEach(td=> td.classList.remove('cell-yellow','cell-orange','cell-red','cell-blue'));
}

function applyCellHighlights(dr, parts, overallBand){
  clearCellHighlights(dr);
  const followOverall = byId('cellBandToggle').checked;
  const cells=[dr.cells[1],dr.cells[2],dr.cells[3],dr.cells[4],dr.cells[5],dr.cells[6],dr.cells[7]]; // RR..AVPU
  parts.forEach((p,i)=>{
    let z = followOverall ? overallBand : p.zone;
    if(z==='yellow') cells[i].classList.add('cell-yellow');
    else if(z==='orange') cells[i].classList.add('cell-orange');
    else if(z==='red') cells[i].classList.add('cell-red');
    else if(z==='blue') cells[i].classList.add('cell-blue');
  });
}

function computePair(dr, det, strict){
  const rr=scoreResp(parseN(dr.cells[1]));
  const spo2=scoreSpO2(parseN(dr.cells[2]));
  const o2=scoreSupO2(dr.cells[3].querySelector('select').value);
  const hr=scoreHR(parseN(dr.cells[4]));
  const sbp=scoreSBP(parseN(dr.cells[5]));
  const temp=scoreTemp(parseN(dr.cells[6]));
  const avpu=scoreAVPU(dr.cells[7].querySelector('select').value);
  const parts=[rr,spo2,o2,hr,sbp,temp,avpu];

  const anyEmpty = parts.some(p=>p.pts===null && !p.met);
  const anyMet = parts.some(p=>p.met);
  const noneFilled = parts.every(p=>p.pts===null && !p.met);

  if(strict && anyEmpty && !anyMet){
    setRowBand(dr, det, 'none'); clearCellHighlights(dr); det.firstElementChild.textContent=''; return;
  }
  if(noneFilled){
    setRowBand(dr, det, 'none'); clearCellHighlights(dr); det.firstElementChild.textContent=''; return;
  }

  let total=0; parts.forEach(p=>{ if(p.pts!==null) total+=p.pts; });
  const band = bandFrom(parts,total);
  setRowBand(dr, det, band);
  applyCellHighlights(dr, parts, band);

  // Detail line: keep EWS:0; blank if MET
  const ews = anyMet ? '' : `EWS: ${total}`;
  const triggers = parts.filter(p=>p.met || (p.pts!==null && p.pts>0))
    .map(p=>{
      const colour = p.zone==='blue'?'Blue':p.zone==='red'?'Red':p.zone==='orange'?'Orange':p.zone==='yellow'?'Yellow':'';
      return colour ? `${p.reason.replace(' (+',' (').replace(' (MET)','')} ${colour}` : p.reason;
    });
  const trigText = triggers.length ? `Triggered by: ${triggers.join(' | ')}` : '';
  det.firstElementChild.textContent=[ews,trigText].filter(Boolean).join(' • ');
}

// --- Rows ---
function getLastNumericBed(){
  const rows=qsa('tr[data-type="data"]', byId('ewsBody'));
  for(let i=rows.length-1;i>=0;i--){
    const n=parseInt(rows[i].cells[0].innerText.trim(),10);
    if(!isNaN(n)) return n;
  }
  return 0;
}

function addRow(){
  const body=byId('ewsBody');
  const nextBed=(getLastNumericBed()||0)+1;
  const dr=document.createElement('tr');
  dr.setAttribute('data-type','data');
  dr.innerHTML=`
    <td contenteditable="true">${nextBed}</td>
    <td contenteditable="true" aria-label="Respiratory Rate"></td>
    <td contenteditable="true" aria-label="SpO2"></td>
    <td><select aria-label="Supplemental Oxygen"><option value="">--</option><option value="no">No</option><option value="yes">Yes</option></select></td>
    <td contenteditable="true" aria-label="Heart Rate"></td>
    <td contenteditable="true" aria-label="Systolic Blood Pressure"></td>
    <td contenteditable="true" aria-label="Temperature (°C)"></td>
    <td><select aria-label="AVPU"><option value="">--</option><option value="A">A</option><option value="V">V</option><option value="P">P</option><option value="U">U</option><option value="F">F</option></select></td>
    <td class="remove-col"><button class="removeBtn" aria-label="Remove row">❌</button></td>`;
  const det=document.createElement('tr');
  det.setAttribute('data-type','detail');
  det.innerHTML=`<td class="detail-cell" colspan="9" style="text-align:center;"></td>`;
  body.appendChild(dr); body.appendChild(det);
  dr.querySelector('.removeBtn').addEventListener('click', ()=>{ dr.remove(); det.remove(); updateAll(); });
  updateAll();
}

function clearTable(){
  const body=byId('ewsBody');
  qsa('tr[data-type="data"]', body).forEach(dr=>{
    for(let i=1;i<=6;i++){
      if(dr.cells[i] && dr.cells[i].hasAttribute('contenteditable')) dr.cells[i].innerText='';
    }
    dr.cells[3].querySelector('select').value='';
    dr.cells[7].querySelector('select').value='';
    dr.classList.remove('row-yellow','row-orange','row-red','row-blue');
    clearCellHighlights(dr);
  });
  qsa('tr[data-type="detail"] .detail-cell', body).forEach(td=>{
    td.textContent='';
    td.classList.remove('detail-yellow','detail-orange','detail-red','detail-blue');
  });
}

// --- Print & Reference ---
function formatStamp(d){ const p=n=>String(n).padStart(2,'0'); const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${p(d.getDate())} ${m[d.getMonth()]} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; }
function setPrintFooter(){ byId('printFooter').textContent=`CCDHB Early Warning Score table – Printed: ${formatStamp(new Date())}`; }

function openRef(){ byId('refModal').style.display='block'; byId('refModal').setAttribute('aria-hidden','false'); }
function closeRef(){ byId('refModal').style.display='none'; byId('refModal').setAttribute('aria-hidden','true'); }

// --- Update loop ---
function updateAll(){
  const body=byId('ewsBody');
  qsa('tr[data-type="data"]', body).forEach(dr=>{
    const det=dr.nextElementSibling;
    if(det && det.matches('tr[data-type="detail"]')) computePair(dr, det, byId('strictToggle').checked);
  });
}

window.addEventListener('DOMContentLoaded', ()=>{
  byId('addRowBtn').addEventListener('click', addRow);
  byId('clearBtn').addEventListener('click', clearTable);
  byId('printBtn').addEventListener('click', ()=>{ setPrintFooter(); window.print(); });
  window.addEventListener('beforeprint', setPrintFooter);
  byId('refBtn').addEventListener('click', openRef);
  byId('refClose').addEventListener('click', closeRef);
  byId('refModal').addEventListener('click', e=>{ if(e.target.id==='refModal') closeRef(); });
  byId('strictToggle').addEventListener('change', updateAll);
  byId('cellBandToggle').addEventListener('change', updateAll);
  ['input','change','keyup','blur'].forEach(evt=> byId('ewsTable').addEventListener(evt, updateAll, true));

  // Start with one row
  addRow();
  updateAll();
});
