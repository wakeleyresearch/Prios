let setCounter = 1;
function loadDefaults() {
  const container=document.getElementById("priorityInputs");
  container.innerHTML="";
  addSetInputs();
}

function addSetInputs() {
  const div=document.createElement("div");
  div.classList.add("inputs");
  div.dataset.setId = setCounter++;
  div.innerHTML=`
    <h4>Set ${setCounter-1}</h4>
    <div><input type="text" value="Exercise"> <input type="number" min="0" value="3"></div>
    <div><input type="text" value="Sleep"> <input type="number" min="0" value="4"></div>
    <div><input type="text" value="Work"> <input type="number" min="0" value="3"></div>
  `;
  document.getElementById("priorityInputs").appendChild(div);
}

document.getElementById("addPriority").addEventListener("click",()=>{
  const firstSet=document.querySelector(".inputs");
  const row=document.createElement("div");
  row.innerHTML='<input type="text" value="New"> <input type="number" min="0" value="1">';
  firstSet.appendChild(row);
});
document.getElementById("resetDefaults").addEventListener("click",loadDefaults);
document.getElementById("addSet").addEventListener("click", addSetInputs);

document.getElementById("generate").addEventListener("click",()=>{
  const overlay=document.getElementById("overlayPriorities").checked;
  document.getElementById("priorityCharts").innerHTML="";
  const sets=[...document.querySelectorAll(".inputs")].map((set,i)=>{
    const rows=set.querySelectorAll("div");
    const vals={}; let sum=0;
    rows.forEach(r=>{
      const t=r.querySelector("input[type=text]"); 
      const n=r.querySelector("input[type=number]");
      if(t && n){vals[t.value]=+n.value; sum+=+n.value;}
    });
    const total=+document.getElementById("totalBudget").value||sum||1;
    const normalized={}; for(let k in vals){normalized[k]=vals[k]/sum*total;}
    return {name:"Set "+(i+1), values:normalized};
  });

  if(overlay){
    const card=d3.select("#priorityCharts").append("div").attr("class","card");
    card.append("div").attr("class","title").text("Overlay Priorities");
    const series=sets.map((s,i)=>({values:s.values, color:d3.schemeTableau10[i%10], label:s.name, axes:Object.keys(s.values)}));
    RadarChart(card.node(), {axes:Object.keys(sets[0].values), series, maxValue:10});
  } else {
    sets.forEach(s=>{
      const card=d3.select("#priorityCharts").append("div").attr("class","card");
      card.append("div").attr("class","title").text(s.name);
      RadarChart(card.node(), {axes:Object.keys(s.values), series:[{values:s.values}], maxValue:10});
    });
  }
});
