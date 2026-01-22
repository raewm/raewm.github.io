// app.js

// Store casts as { id, name, header, rows, columns, downcastIndices }
const casts = [];

// Utility: download text as file
function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Parse a YSI EXO CSV file
function parseYSICSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);

    reader.onload = () => {
      const text = reader.result;

      // Split into lines (handle CRLF)
      const lines = text.split(/\r\n|\n/);

      // Find data header: requires "Date" and "Time" and "DEP m"
      let headerLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const cols = line.split(",");
        const hasDate = cols.some(c => c.trim() === "Date");
        const hasTime = cols.some(c => c.trim() === "Time");
        const hasDepth = cols.some(c => c.trim().startsWith("DEP"));
        if (hasDate && hasTime && hasDepth) {
          headerLineIndex = i;
          break;
        }
      }

      if (headerLineIndex === -1) {
        reject(new Error("Could not find YSI data header in file: " + file.name));
        return;
      }

      const header = lines[headerLineIndex].split(",");
      const dataLines = lines.slice(headerLineIndex + 1)
        .filter(line => line.trim().length > 0);

      // Parse data rows into arrays, keeping as strings for most columns
      const rows = dataLines.map(line => line.split(","));

      // Build column-wise arrays for easy plotting
      const columns = {};
      header.forEach((colName, idx) => {
        columns[colName] = rows.map(row => row[idx] ?? "");
      });

      resolve({ header, rows, columns });
    };

    reader.readAsText(file); // YSI file exported by PC/software should be compatible
  });
}

// Detect downcast: choose longest contiguous segment where depth increases
function detectDowncastIndices(depthArray, minDepthRange = 0.5) {
  // Convert to numbers
  const depth = depthArray.map(v => {
    const x = parseFloat(v);
    return Number.isFinite(x) ? x : NaN;
  });

  const n = depth.length;
  if (n < 3) return null;

  const segments = [];
  let start = null;

  for (let i = 0; i < n - 1; i++) {
    const d0 = depth[i];
    const d1 = depth[i + 1];
    if (!Number.isFinite(d0) || !Number.isFinite(d1)) {
      // break segment
      if (start !== null) {
        segments.push({ start, end: i });
        start = null;
      }
      continue;
    }
    const diff = d1 - d0;

    const isIncreasing = diff > 0.01; // threshold in meters
    if (isIncreasing) {
      if (start === null) start = i;
    } else {
      if (start !== null) {
        segments.push({ start, end: i });
        start = null;
      }
    }
  }
  if (start !== null) {
    segments.push({ start, end: n - 1 });
  }

  if (segments.length === 0) return null;

  // Choose segment with largest depth range
  let best = null;
  let bestRange = 0;
  for (const seg of segments) {
    const segDepths = depth.slice(seg.start, seg.end + 1)
      .filter(Number.isFinite);
    if (segDepths.length === 0) continue;
    const minD = Math.min(...segDepths);
    const maxD = Math.max(...segDepths);
    const range = maxD - minD;
    if (range > bestRange) {
      bestRange = range;
      best = { ...seg, minDepth: minD, maxDepth: maxD };
    }
  }

  if (!best || bestRange < minDepthRange) {
    return null;
  }

  return best; // { start, end, minDepth, maxDepth }
}

// Update dropdowns after casts change
function refreshCastSelectors() {
  const castSelect = document.getElementById("cast-select");
  const castASelect = document.getElementById("cast-a-select");
  const castBSelect = document.getElementById("cast-b-select");

  [castSelect, castASelect, castBSelect].forEach(sel => {
    sel.innerHTML = "";
    casts.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
  });
}

function refreshParametersForCast() {
  const castSelect = document.getElementById("cast-select");
  const paramSelect = document.getElementById("param-select");
  const comparisonParamSelect = document.getElementById("comparison-param-select");

  paramSelect.innerHTML = "";
  comparisonParamSelect.innerHTML = "";

  const castId = castSelect.value;
  const cast = casts.find(c => c.id === castId);
  if (!cast) return;

  // exclude Date, Time, depth columns (DEP m and VPos ft)
  cast.header.forEach(col => {
    const trimmed = col.trim();
    if (!trimmed || trimmed === "Date" || trimmed === "Time") return;
    if (trimmed.startsWith("DEP")) return;
    if (trimmed.startsWith("VPos")) return;

    const opt1 = document.createElement("option");
    opt1.value = col;
    opt1.textContent = col;
    paramSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = col;
    opt2.textContent = col;
    comparisonParamSelect.appendChild(opt2);
  });
}

function onFilesSelected(evt) {
  const fileListDiv = document.getElementById("file-list");
  fileListDiv.textContent = "Loading files…";

  const files = Array.from(evt.target.files);
  if (files.length === 0) {
    fileListDiv.textContent = "No files selected.";
    return;
  }

  const promises = files.map(file => parseYSICSV(file)
    .then(result => {
      // Determine downcast using DEP m column
      // YSI sample uses "DEP m" as depth column
      const depthColName = result.header.find(c => c.trim().startsWith("DEP"));
      let downcast = null;
      if (depthColName) {
        downcast = detectDowncastIndices(result.columns[depthColName]);
      }

      const cast = {
        id: `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        header: result.header,
        rows: result.rows,
        columns: result.columns,
        depthColName,
        downcast
      };
      casts.push(cast);
    })
  );

  Promise.allSettled(promises).then(results => {
    const loaded = [];
    const failed = [];

    results.forEach((res, idx) => {
      if (res.status === "fulfilled") {
        loaded.push(files[idx].name);
      } else {
        console.error("Failed to load file", files[idx].name, res.reason);
        failed.push(files[idx].name);
      }
    });

    let msg = "";
    if (loaded.length) {
      msg += "Loaded: " + loaded.join(", ");
    }
    if (failed.length) {
      if (msg) msg += " | ";
      msg += "Failed: " + failed.join(", ");
    }
    fileListDiv.textContent = msg || "No files loaded.";

    if (casts.length) {
      refreshCastSelectors();
      refreshParametersForCast();
    }
  });
}

// Build Plotly traces for a single cast, multiple parameters
function plotSingleCast() {
  const castId = document.getElementById("cast-select").value;
  const cast = casts.find(c => c.id === castId);
  if (!cast) return;

  const depthColName = cast.depthColName;
  if (!depthColName) {
    alert("No depth column found (DEP m) in this cast.");
    return;
  }

  if (!cast.downcast) {
    alert("No downcast detected (insufficient increasing depth segment).");
    return;
  }

  const paramSelect = document.getElementById("param-select");
  const selectedParams = Array.from(paramSelect.selectedOptions).map(o => o.value);
  if (selectedParams.length === 0) {
    alert("Please select at least one parameter to plot.");
    return;
  }

  const invertDepth = document.getElementById("invert-depth").checked;
  const start = cast.downcast.start;
  const end = cast.downcast.end;

  const depthRaw = cast.columns[depthColName].slice(start, end + 1);
  const depth = depthRaw.map(v => parseFloat(v));

  const traces = [];
  selectedParams.forEach((paramName, idx) => {
    const valuesRaw = cast.columns[paramName].slice(start, end + 1);
    const values = valuesRaw.map(v => parseFloat(v));

    // We'll put depth on y-axis (inverted), parameters on x-axis via multiple x-axes.
    const axisName = idx === 0 ? "x" : `x${idx + 1}`;
    const trace = {
      x: values,
      y: depth,
      mode: "lines",
      name: paramName,
      xaxis: axisName
    };
    traces.push(trace);
  });

  // Layout with multiple x-axes
  const layout = {
    title: `Downcast: ${cast.name}`,
    yaxis: {
      title: cast.depthColName,
      autorange: invertDepth ? "reversed" : true
    },
    xaxis: {
      title: selectedParams[0],
      side: "bottom"
    },
    margin: { l: 80, r: 80, t: 40, b: 60 },
    legend: { orientation: "h" }
  };

  // Additional x-axes on top
  for (let i = 1; i < selectedParams.length; i++) {
    const axisName = `xaxis${i + 1}`;
    layout[axisName] = {
      title: selectedParams[i],
      overlaying: "x",
      side: "top"
    };
  }

  Plotly.newPlot("single-plot", traces, layout, { responsive: true });
}

// Export downcast as CSV
function exportDowncastCSV() {
  const castId = document.getElementById("cast-select").value;
  const cast = casts.find(c => c.id === castId);
  if (!cast) return;

  if (!cast.downcast) {
    alert("No downcast detected for this cast.");
    return;
  }

  const { start, end } = cast.downcast;
  const header = cast.header;
  const lines = [];

  // Header line
  lines.push(header.join(","));

  for (let i = start; i <= end; i++) {
    const row = header.map((_, colIdx) => cast.rows[i][colIdx] ?? "");
    lines.push(row.join(","));
  }

  const csvText = lines.join("\n");
  const filename = cast.name.replace(/\.csv$/i, "") + "_downcast.csv";
  downloadText(filename, csvText);
}

// Plot comparison of one parameter from two casts vs depth
function plotComparison() {
  const castAId = document.getElementById("cast-a-select").value;
  const castBId = document.getElementById("cast-b-select").value;
  const paramName = document.getElementById("comparison-param-select").value;
  const title = document.getElementById("comparison-title").value || "Parameter vs Depth";
  const legendALabel = document.getElementById("legend-a").value || "Cast A";
  const legendBLabel = document.getElementById("legend-b").value || "Cast B";
  const invertDepth = document.getElementById("invert-depth-compare").checked;

  const castA = casts.find(c => c.id === castAId);
  const castB = casts.find(c => c.id === castBId);
  if (!castA || !castB) {
    alert("Please select two casts.");
    return;
  }

  const depthColA = castA.depthColName;
  const depthColB = castB.depthColName;
  if (!depthColA || !depthColB) {
    alert("Both casts must have a depth column (DEP m).");
    return;
  }

  if (!castA.downcast || !castB.downcast) {
    alert("Both casts must have a detected downcast.");
    return;
  }

  if (!paramName) {
    alert("Please select a parameter.");
    return;
  }

  // Build downcast arrays
  function extractDowncast(cast) {
    const { start, end } = cast.downcast;
    const depthRaw = cast.columns[cast.depthColName].slice(start, end + 1);
    const depth = depthRaw.map(v => parseFloat(v));
    const valuesRaw = cast.columns[paramName].slice(start, end + 1);
    const values = valuesRaw.map(v => parseFloat(v));
    return { depth, values };
  }

  const a = extractDowncast(castA);
  const b = extractDowncast(castB);

  const traceA = {
    x: a.values,
    y: a.depth,
    mode: "lines",
    name: legendALabel
  };

  const traceB = {
    x: b.values,
    y: b.depth,
    mode: "lines",
    name: legendBLabel
  };

  const layout = {
    title: title,
    xaxis: { title: paramName },
    yaxis: {
      title: castA.depthColName,
      autorange: invertDepth ? "reversed" : true
    },
    margin: { l: 80, r: 40, t: 40, b: 60 },
    legend: { orientation: "h" }
  };

  Plotly.newPlot("comparison-plot", [traceA, traceB], layout, { responsive: true });
}

// Wire up event listeners
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("file-input")
    .addEventListener("change", onFilesSelected);

  document.getElementById("cast-select")
    .addEventListener("change", refreshParametersForCast);

  document.getElementById("plot-single-btn")
    .addEventListener("click", plotSingleCast);

  document.getElementById("export-downcast-btn")
    .addEventListener("click", exportDowncastCSV);

  document.getElementById("plot-compare-btn")
    .addEventListener("click", plotComparison);
});
