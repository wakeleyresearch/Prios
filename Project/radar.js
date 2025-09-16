/* ---------- RadarChart reusable function ---------- */
function RadarChart(el, options) {
  const { axes = [], series = [], levels = 5, maxValue = 1 } = options;
  const width = 260, height = 260, margin = 40;
  const radius = Math.min(width, height) / 2 - margin;
  const angleSlice = (Math.PI * 2) / axes.length;
  const r = d3.scaleLinear().domain([0, maxValue]).range([0, radius]);

  const svg = d3.select(el).append("svg")
    .attr("width", width).attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${width/2},${height/2})`);

  // Grid rings
  for (let lvl=1; lvl<=levels; lvl++) {
    g.append("circle")
      .attr("r", r(maxValue*lvl/levels))
      .attr("fill","none")
      .attr("stroke","#ddd");
  }

  // Axes
  const axis = g.selectAll(".axis").data(axes).enter().append("g");
  axis.append("line")
    .attr("x1",0).attr("y1",0)
    .attr("x2",(d,i)=>r(maxValue)*Math.cos(angleSlice*i - Math.PI/2))
    .attr("y2",(d,i)=>r(maxValue)*Math.sin(angleSlice*i - Math.PI/2))
    .attr("stroke","#999");

  axis.append("text")
    .attr("x",(d,i)=>(radius+14)*Math.cos(angleSlice*i - Math.PI/2))
    .attr("y",(d,i)=>(radius+14)*Math.sin(angleSlice*i - Math.PI/2))
    .attr("text-anchor","middle")
    .attr("dominant-baseline","middle")
    .style("font-size","11px")
    .text(d=>d);

  // Line generator
  const line = d3.lineRadial()
    .curve(d3.curveLinearClosed)
    .radius(d=>r(d.value))
    .angle((d,i)=>i*angleSlice);

  // Data polygons
  series.forEach((s,idx)=>{
    const color = s.color || d3.schemeTableau10[idx % 10];
    const data = axes.map(a=>({axis:a, value:s.values[a]||0}));
    s.path = g.append("path").datum(data)
      .attr("d", line)
      .attr("fill", color).attr("fill-opacity",0.2)
      .attr("stroke", color).attr("stroke-width",2);
  });
}

/* ---------- Data ---------- */
const triad = ["Exploration","Exploitation","Security"];
const profiles = [
  { code:"A", name:"Study Abroad + Startup Club", values:{Exploration:0.90,Exploitation:0.50,Security:0.45}},
  { code:"B", name:"GPA Grind + Research Assistant", values:{Exploration:0.40,Exploitation:0.90,Security:0.60}},
  { code:"C", name:"Co-op Job + Night Classes", values:{Exploration:0.50,Exploitation:0.75,Security:0.85}},
  { code:"D", name:"Portfolio Projects + TA", values:{Exploration:0.65,Exploitation:0.80,Security:0.70}},
  { code:"E", name:"Heavy Exploration Gap Term", values:{Exploration:0.95,Exploitation:0.35,Security:0.40}},
  { code:"F", name:"Campus Job + Safe Coursework", values:{Exploration:0.25,Exploitation:0.55,Security:0.95}},
  { code:"G", name:"Hackathons + Publications", values:{Exploration:0.75,Exploitation:0.90,Security:0.55}}
];
const dominated = [
  { code:"Dom1", name:"Minimal Payoff", values:{Exploration:0.20,Exploitation:0.20,Security:0.20}},
  { code:"Dom2", name:"Weak Explorer", values:{Exploration:0.60,Exploitation:0.40,Security:0.40}},
  { code:"Dom3", name:"Fragile Security", values:{Exploration:0.30,Exploitation:0.50,Security:0.70}}
];
const thresholdFiltered = profiles.filter(p=> triad.every(k=>p.values[k]>=0.3));
const sleepAxes=["Focus","Retention","Emotion"];
const sleepSeries=[
  { code:"6h", name:"6h (baseline)", values:{Focus:6,Retention:7,Emotion:6}},
  { code:"7h", name:"7h (+1h)", values:{Focus:8,Retention:8.5,Emotion:8}},
  { code:"8h", name:"8h (+2h)", values:{Focus:8.5,Retention:9,Emotion:8.3}}
];

/* ---------- Expanded 5D profiles ---------- */
const fiveAxes = ["Exploration","Exploitation","Security","Learning","Wellbeing"];
const profiles5d = [
  { code:"A", name:"Study Abroad + Startup Club", values:{Exploration:0.90,Exploitation:0.50,Security:0.40,Learning:0.70,Wellbeing:0.50}},
  { code:"B", name:"GPA Grind + Research Assistant", values:{Exploration:0.30,Exploitation:0.90,Security:0.60,Learning:0.80,Wellbeing:0.40}},
  { code:"C", name:"Co-op Job + Night Classes", values:{Exploration:0.50,Exploitation:0.80,Security:0.80,Learning:0.70,Wellbeing:0.30}},
  { code:"D", name:"Portfolio Projects + TA", values:{Exploration:0.60,Exploitation:0.80,Security:0.70,Learning:0.90,Wellbeing:0.50}},
  { code:"E", name:"Heavy Exploration Gap Term", values:{Exploration:0.95,Exploitation:0.35,Security:0.40,Learning:0.50,Wellbeing:0.40}},
  { code:"F", name:"Campus Job + Safe Coursework", values:{Exploration:0.25,Exploitation:0.55,Security:0.95,Learning:0.40,Wellbeing:0.70}},
  { code:"G", name:"Hackathons + Publications", values:{Exploration:0.75,Exploitation:0.90,Security:0.55,Learning:0.85,Wellbeing:0.40}},
  { code:"H", name:"Balanced Lifestyle", values:{Exploration:0.60,Exploitation:0.60,Security:0.60,Learning:0.60,Wellbeing:0.60}},
  { code:"I", name:"High Achiever, Low Sleep", values:{Exploration:0.40,Exploitation:0.85,Security:0.70,Learning:0.90,Wellbeing:0.20}},
  { code:"J", name:"Explorer + Wellness Retreats", values:{Exploration:0.85,Exploitation:0.40,Security:0.50,Learning:0.60,Wellbeing:0.90}},
  { code:"K", name:"Career Climber", values:{Exploration:0.30,Exploitation:0.95,Security:0.70,Learning:0.80,Wellbeing:0.30}},
  { code:"L", name:"Safety First", values:{Exploration:0.20,Exploitation:0.60,Security:0.95,Learning:0.50,Wellbeing:0.80}},
  { code:"M", name:"Researcher", values:{Exploration:0.50,Exploitation:0.70,Security:0.65,Learning:0.95,Wellbeing:0.40}},
  { code:"N", name:"Creative Hustler", values:{Exploration:0.85,Exploitation:0.70,Security:0.40,Learning:0.80,Wellbeing:0.30}},
  { code:"O", name:"Athlete-Scholar", values:{Exploration:0.50,Exploitation:0.70,Security:0.60,Learning:0.60,Wellbeing:0.95}},
  { code:"P", name:"Minimalist", values:{Exploration:0.30,Exploitation:0.30,Security:0.80,Learning:0.40,Wellbeing:0.90}},
  { code:"Q", name:"Startup Founder", values:{Exploration:0.95,Exploitation:0.85,Security:0.30,Learning:0.80,Wellbeing:0.20}},
  { code:"R", name:"Global Networker", values:{Exploration:0.90,Exploitation:0.60,Security:0.50,Learning:0.70,Wellbeing:0.50}},
  { code:"S", name:"Night Owl Coder", values:{Exploration:0.70,Exploitation:0.85,Security:0.50,Learning:0.90,Wellbeing:0.30}},
  { code:"T", name:"Holistic Learner", values:{Exploration:0.60,Exploitation:0.60,Security:0.60,Learning:0.85,Wellbeing:0.85}}
];

/* ---------- Render Radars ---------- */
function renderRadars() {
  d3.select("#grid").selectAll("*").remove();
  const mode=document.querySelector("#dataset").value;
  const overlay=document.querySelector("#overlay").checked;

  let list=[], axes=triad, maxVal=1;
  if(mode==="profiles") list=profiles;
  if(mode==="dominated") list=dominated;
  if(mode==="threshold") list=thresholdFiltered;
  if(mode==="sleep") {axes=sleepAxes; maxVal=10; list=sleepSeries;}
  if(mode==="wall") {
    list=Array.from({length:36},(_,i)=>({code:"P"+(i+1),name:"Generated Profile",
      values:{Exploration:Math.random(),Exploitation:Math.random(),Security:Math.random()}}));
  }
  if(mode==="profiles5d") {axes=fiveAxes; maxVal=1; list=profiles5d;}

  if (overlay) {
    const card=d3.select("#grid").append("div").attr("class","card");
    card.append("div").attr("class","title").text("Overlay Mode");

    const series=list.map((p,i)=>({
      values:p.values,
      color:d3.schemeTableau10[i%10],
      code:p.code,
      name:p.name,
      axes
    }));

    RadarChart(card.node(), {axes,series,maxValue:maxVal});

    const legend=card.append("div").attr("class","legend");
    const tip = d3.select("#legendTip");

    series.forEach((s,i)=>{
      const item=legend.append("span").attr("class","legend-item");
      item.append("span").attr("class","legend-swatch").style("background",s.color);
      item.append("span").text(s.code ?? s.name ?? `Series ${i+1}`);

      // Click to toggle
      item.on("click",()=>{
        const visible = s.path.style("display")!=="none";
        s.path.style("display", visible ? "none" : null);
        item.style("opacity", visible ? 0.4 : 1);
      });

      // Tooltip on hover
      item.on("mouseenter",(e)=>{
        const rows = (s.axes || axes).map(ax=>{
          const v = s.values[ax];
          return `${ax}: <b>${(v!=null ? v.toFixed(2) : "-")}</b>`;
        }).join("<br>");
        tip.html(`<b>${s.code ? s.code+" — " : ""}${s.name || ""}</b><br>${rows}`)
           .style("opacity",1)
           .style("left",(e.clientX+12)+"px")
           .style("top",(e.clientY+12)+"px");
      }).on("mousemove",(e)=>{
        tip.style("left",(e.clientX+12)+"px").style("top",(e.clientY+12)+"px");
      }).on("mouseleave",()=> tip.style("opacity",0));
    });

  } else {
    list.forEach((p,i)=>{
      const card=d3.select("#grid").append("div").attr("class","card");
      card.append("div").attr("class","title")
        .text((p.code ? p.code+" — " : "") + (p.name || ""));
      RadarChart(card.node(), {axes,series:[{values:p.values}],maxValue:maxVal});
    });
  }
}

/* ---------- Pareto helpers ---------- */
function dominates(a,b,axes){
  let better=true,strict=false;
  for(let ax of axes){
    if(a[ax]<b[ax]) better=false;
    if(a[ax]>b[ax]) strict=true;
  }
  return better&&strict;
}
function paretoFront(list,axes){
  return list.filter(p=>!list.some(q=>dominates(q.values,p.values,axes)));
}

/* ---------- Buttons ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  // Populate dataset select
  const sel=document.getElementById("dataset");
  ["profiles","dominated","threshold","sleep","wall","profiles5d"].forEach(opt=>{
    const o=document.createElement("option"); 
    o.value=opt; 
    o.textContent=opt==="profiles5d" ? "Student Profiles (5D)" : opt;
    sel.appendChild(o);
  });
  sel.value="profiles";

  // Extra quick toggle buttons
  const controls=document.querySelector(".controls");
  const btn3d=document.createElement("button");
  btn3d.textContent="Profiles (3D)";
  btn3d.onclick=()=>{sel.value="profiles";renderRadars();};
  const btn5d=document.createElement("button");
  btn5d.textContent="Profiles (5D)";
  btn5d.onclick=()=>{sel.value="profiles5d";renderRadars();};
  controls.appendChild(btn3d);
  controls.appendChild(btn5d);

  document.querySelector("#dataset").addEventListener("change",renderRadars);
  document.querySelector("#overlay").addEventListener("change",renderRadars);

  document.querySelector("#paretoWalk").addEventListener("click",()=>{
    const mode=document.querySelector("#dataset").value;
    if(mode!=="profiles" && mode!=="profiles5d") {
      alert("Pareto walkthrough is only available for Student Profiles (3D or 5D).");
      return;
    }
    const list=(mode==="profiles"?profiles:profiles5d);
    const axes=(mode==="profiles"?triad:fiveAxes);
    const front=paretoFront(list,axes).map(p=>p.code);
    const cards=d3.selectAll(".card"); let i=0;
    function step(){
      if(i>=cards.size())return;
      const card=cards.nodes()[i];
      const title=card.querySelector(".title").textContent;
      const code=title.split("—")[0].trim();
      if(!front.includes(code)) card.style.opacity=0.2;
      i++; setTimeout(step,800);
    }
    step();
  });

document.querySelector("#highlightPareto").addEventListener("click",()=>{
  const mode=document.querySelector("#dataset").value;
  if(mode!=="profiles" && mode!=="profiles5d") {
    alert("Highlight Pareto is only available for Student Profiles (3D or 5D).");
    return;
  }
  const list=(mode==="profiles"?profiles:profiles5d);
  const axes=(mode==="profiles"?triad:fiveAxes);
  const front=paretoFront(list,axes);

  // Reset all cards
  d3.selectAll(".card").style("opacity",1).style("outline",null);

  // Fade dominated
  d3.selectAll(".card").nodes().forEach(card=>{
    const title=card.querySelector(".title").textContent;
    const code=title.split("—")[0].trim();
    if(!front.map(f=>f.code).includes(code)) {
      card.style.opacity=0.2;
    } else {
      card.style.outline="2px solid #0077ff";
    }
  });

  // --- Draw Pareto frontier polygon (only in overlay mode) ---
  if(document.querySelector("#overlay").checked){
    // Remove existing overlay if any
    d3.select("#grid svg g").selectAll(".pareto-frontier").remove();

    const maxVal=(mode==="profiles"?1:1); // normalized
    const radius=100; // scale roughly matches RadarChart inner logic
    const angleSlice=(Math.PI*2)/axes.length;
    const r=d3.scaleLinear().domain([0,maxVal]).range([0,radius]);

    // Build points for the frontier polygon
    const points=front.map(f=>{
      return axes.map((ax,i)=>[
        r(f.values[ax])*Math.cos(angleSlice*i - Math.PI/2),
        r(f.values[ax])*Math.sin(angleSlice*i - Math.PI/2)
      ]);
    }).flat();

    // Convex hull of frontier points
    const hull=d3.polygonHull(points);

    if(hull){
      d3.select("#grid svg g").append("path")
        .attr("class","pareto-frontier")
        .attr("d","M"+hull.join("L")+"Z")
        .attr("fill","#0077ff")
        .attr("fill-opacity",0.08)
        .attr("stroke","#0077ff")
        .attr("stroke-dasharray","4,3")
        .attr("stroke-width",2);
    }
  }
});


  renderRadars();
});
