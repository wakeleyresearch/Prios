/* ---------- All Values List (Brené Brown set) ---------- */
const allValues = [
  "Accountability","Achievement","Activism","Adaptability","Adventure","Altruism","Ambition",
  "Authenticity","Balance","Beauty","Being the best","Being a good sport","Belonging","Career",
  "Caring","Co-creation","Collaboration","Commitment","Community","Compassion","Competence",
  "Confidence","Connection","Contentment","Contribution","Cooperation","Courage","Creativity",
  "Curiosity","Dignity","Diversity","Efficiency","Environment","Equality","Ethics","Excellence",
  "Fairness","Faith","Family","Financial stability","Forgiveness","Freedom","Friendship","Fun",
  "Future generations","Generosity","Giving back","Grace","Gratitude","Growth","Harmony","Health",
  "Heritage","Home","Honesty","Hope","Humility","Humor","Inclusion","Independence","Initiative",
  "Integrity","Intuition","Job security","Joy","Justice","Kindness","Knowledge","Leadership",
  "Learning","Legacy","Leisure","Love","Loyalty","Making a difference","Nature","Openness",
  "Optimism","Order","Parenting","Patience","Patriotism","Peace","Perseverance","Personal fulfillment",
  "Power","Pride","Recognition","Reliability","Resourcefulness","Respect","Responsibility",
  "Risk-taking","Security","Self-discipline","Self-expression","Self-respect","Serenity","Service",
  "Simplicity","Spirituality","Stewardship","Success","Teamwork","Thrift","Time","Tradition","Travel",
  "Trust","Truth","Understanding","Uniqueness","Usefulness","Vision","Vulnerability","Wealth",
  "Wellbeing","Wholeheartedness","Wisdom"
];

/* ---------- Helpers ---------- */
function randomValues(count=3){
  return d3.shuffle(allValues.slice()).slice(0,count);
}

/* ---------- Render Values Tool ---------- */
function renderValuesTool(){
  const container=document.querySelector("#valuesTool");
  container.innerHTML="";

  // Controls
  const controls=document.createElement("div");
  controls.className="controls";
  container.appendChild(controls);

  const randomBtn=document.createElement("button");
  randomBtn.textContent="Randomize Values";
  randomBtn.onclick=()=>initValues(randomValues(3));
  controls.appendChild(randomBtn);

  const resetBtn=document.createElement("button");
  resetBtn.textContent="Reset to Default 3";
  resetBtn.onclick=()=>initValues(randomValues(3));
  controls.appendChild(resetBtn);

  const addBtn=document.createElement("button");
  addBtn.textContent="Add Another Value";
  addBtn.onclick=()=>addValueRow("Custom",1);
  controls.appendChild(addBtn);

  const genBtn=document.createElement("button");
  genBtn.textContent="Generate Radar";
  genBtn.onclick=generateRadar;
  controls.appendChild(genBtn);

  // Rows holder
  const rows=document.createElement("div");
  rows.id="valueRows";
  container.appendChild(rows);

  // Radar holder
  const radar=document.createElement("div");
  radar.id="valuesRadar";
  container.appendChild(radar);

  // Initialize
  initValues(randomValues(3));
}

/* ---------- Init / Add Rows ---------- */
function initValues(vals){
  const rows=document.querySelector("#valueRows");
  rows.innerHTML="";
  vals.forEach(v=>addValueRow(v,3));
}

function addValueRow(label,weight){
  const row=document.createElement("div");
  row.className="axis-row";
  row.innerHTML=`
    <input type="text" value="${label}" class="value-label">
    <input type="number" min="0" max="10" step="1" value="${weight}" class="value-weight">
  `;
  document.querySelector("#valueRows").appendChild(row);
}

/* ---------- Radar Generation ---------- */
function generateRadar(){
  const rows=[...document.querySelectorAll(".axis-row")];
  let total=rows.reduce((sum,row)=>sum+parseFloat(row.querySelector(".value-weight").value||0),0);
  if(total===0){ alert("Please allocate some weight!"); return; }

  const axes=rows.map(r=>r.querySelector(".value-label").value);
  const values={};
  rows.forEach(r=>{
    let label=r.querySelector(".value-label").value;
    let w=parseFloat(r.querySelector(".value-weight").value||0);
    values[label]=w; // raw magnitude
  });

  // Clear radar
  d3.select("#valuesRadar").selectAll("*").remove();

  // Radar scaling: bigger totals = bigger shapes
  RadarChart("#valuesRadar",{
    axes,
    series:[{values}],
    maxValue: total   // scale to their total allocation
  });

  // Tooltip: raw + %
  const tip = d3.select("#legendTip");
  d3.selectAll("#valuesRadar .axis").on("mouseenter",(e,d)=>{
    const raw = values[d];
    const pct = ((raw/total)*100).toFixed(1);
    tip.html(`<b>${d}</b><br>Raw: ${raw}<br>${pct}%`)
       .style("opacity",1)
       .style("left",(e.clientX+12)+"px")
       .style("top",(e.clientY+12)+"px");
  }).on("mousemove",(e)=>{
    tip.style("left",(e.clientX+12)+"px").style("top",(e.clientY+12)+"px");
  }).on("mouseleave",()=>tip.style("opacity",0));
}


/* ---------- Auto init on DOM load ---------- */
document.addEventListener("DOMContentLoaded",()=>{
  if(document.querySelector("#valuesTool")){
    renderValuesTool();
  }
});
