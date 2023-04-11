
const config = ({
  width: 1200,
  height: 250,
  maxTerms: 100,
  maxFontSize: 30,
  minFontSize: 12,
  padding: 0,
  selectedTerm: null
})

// populate dropdown menu with weeks  
function populateDates() {
  var select = document.getElementById("inputDate");
  // start 6/31/22
  var start = new Date(2022, 6, 31); 
  var pastSunday = new Date(start);
  // first sun after 6/31
  pastSunday.setDate(pastSunday.getDate() + (7 - pastSunday.getDay())); 
  var options = [];

  while (pastSunday < new Date()) {
    var optionDate = new Date(pastSunday);
    var optionText = optionDate.toDateString() + " - " + 
                    new Date(pastSunday.setDate(pastSunday.getDate() + 6)).toDateString(); 
    options.push({
      date: optionDate.toISOString().slice(0, 10),
      text: optionText
    });
    // get next sun 
    pastSunday.setDate(pastSunday.getDate() + 1); 
  }
  options.sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });
  for (var i = 1; i < options.length; i++) {
    var option = document.createElement("option");
    option.value = options[i].date;
    option.text = options[i].text;
    select.appendChild(option);
  }
  // select the last option (which is the most recent week)
  select.selectedIndex = 1;

  // show the result text for the selected week
  showResultText();

  // generate the visualization for the selected week
  handleDateSelected();
}

// showing result text for week 
function showResultText() {
  const dropdown = document.getElementById("inputDate");
  const selectedOption = dropdown.options[dropdown.selectedIndex];
  const weekRange = selectedOption.text;
  const weekStart = weekRange.split("-")[0].trim();
  const weekEnd = weekRange.split("-")[1].trim();
  const resultWeek = `The results for ${weekStart} to ${weekEnd} are:`;
  document.getElementById("resultWeek").textContent = resultWeek;
}

// get the start date for handleDateSelected()
function getSelectedWeekStartDate() {
  const selectedDate = document.getElementById("inputDate").value;
  const startDate = new Date(selectedDate);
  return startDate
}

function handleDateSelected() {
  const day = getSelectedWeekStartDate();
  const selectedDate = new Date(day.setDate(day.getDate() + 1))
    .toLocaleDateString('en-GB')
    .split('/')
    .reverse()
    .join('');
  const vizWrapper = document.getElementById('viz-wrapper');
  // remove any existing visualizations
  while (vizWrapper.firstChild) {
    vizWrapper.removeChild(vizWrapper.firstChild);
  }
  fetchData(selectedDate).then(data => {
    const node = renderForWeek(selectedDate, data);
    document.getElementById('viz-wrapper').append(node);  
  });
}

function cleanData(rawData) {
  const cleanData = rawData.filter(r => r.term.length > 2) // skip small words
                           .sort((x, y) => d3.descending(x.count, y.count))  // sort by freq
                           .slice(0, config.maxTerms);  // limit total terms
  // we also want to normalize by the total number term usage
  total = cleanData.map(r => r.count).reduce((a, b) => a + b, 0);
  return cleanData.map(r => ({ ...r, tfnorm: r.count/total }));
}

function fontSizeComputer(term, extent, sizeRange){
  const size = sizeRange.min + (((sizeRange.max - sizeRange.min)
      * (Math.log(term.tfnorm) - Math.log(extent[0]))) / (Math.log(extent[1]) - Math.log(extent[0])));
  return size;
};

async function fetchData(selectedDate) {
  // fetchData (samples for now)
  const rightCsvData = await d3.csv(`https://raw.githubusercontent.com/us-politics-weekly-terms/main/data/${selectedDate}-top-right.csv`, d3.autoType);
  const leftCsvData = await d3.csv(`https://raw.githubusercontent.com/us-politics-weekly-terms/${selectedDate}-top-left.csv`, d3.autoType);

  // clean the data and normalize
  const rightData = cleanData(rightCsvData, config.maxTerms);
  const leftData = cleanData(leftCsvData, config.maxTerms);
  return { rightData, leftData };
}

function renderForWeek(selectedDate, data) {
  const rightData = data.rightData;
  const leftData = data.leftData;

  // concat right and left data, normalize
  const extent = d3.extent(rightData.concat(leftData),  d => d.tfnorm); 
  const sizeRange = { min: config.minFontSize, max: config.maxFontSize };

  const totalWidth = config.width;
  // first split the data into left/both/right
  const totalCount = leftData.map(r => r.count).reduce((a, b) => a + b, 0) + rightData.map(r => r.count).reduce((a, b) => a + b, 0);
  // figure out venn diagram overlap
  let leftTerms = leftData.map(d => d.term);
  let rightTerms = rightData.map(d => d.term);
  const bothTerms = leftTerms.filter(t => rightTerms.includes(t));
  leftTerms = leftTerms.filter(t => !bothTerms.includes(t));
  rightTerms = rightTerms.filter(t => !bothTerms.includes(t));
  // re-normalize split data
  const left = leftData.filter(d => leftTerms.includes(d.term)).map(d => ({...d, tfnorm:d.count/totalCount}));
  const right = rightData.filter(d => rightTerms.includes(d.term)).map(d => ({...d, tfnorm:d.count/totalCount}));
  const both = bothTerms.map(t => {
    const leftItem = leftData.find(i => i.term == t);
    const rightItem = rightData.find(i => i.term == t);
    return {'term': t, 'count': leftItem.count + rightItem.count, tfnorm: (leftItem.count + rightItem.count)/totalCount};
  })
  .sort((a,b) => a.count < b.count);
  // layout in 3 columns
  const svg = d3.create('svg')
    .attr('width', totalWidth)
    .attr('height', config.height);
  // titles
  const leftLabel = svg.append('g') // left
    .attr("transform", "translate(0,20)")
  leftLabel.append('line')
      .style("stroke", "#333333")
      .style("stroke-width", 1)
      .attr("x1", 0)
      .attr("y1", 10)
      .attr("x2", totalWidth/3 - 20)
      .attr("y2", 10);
  leftLabel.append("text")
      .attr("fill", '#333333')
      .attr("font-weight", 900)
      .attr("font-size", "16px")
      .text("Top Terms Unique to Left-Leaning Media");
  const bothLabel = svg.append('g') // both
    .attr("transform", "translate("+totalWidth/3+",20)")
  bothLabel.append('line')
      .style("stroke", "#333333")
      .style("stroke-width", 1)
      .attr("x1", 0)
      .attr("y1", 10)
      .attr("x2", totalWidth/3 - 20)
      .attr("y2", 10);
  bothLabel.append("text")
      .attr("fill", '#333333')
      .attr("font-weight", 900)
      .attr("font-size", "16px")
      .text("Top Terms in Both Left and Right Leaning Media");
  const rightLabel = svg.append('g') // left
    .attr("transform", "translate("+2*(totalWidth/3)+",20)")
  rightLabel.append('line')
      .style("stroke", "#333333")
      .style("stroke-width", 1)
      .attr("x1", 0)
      .attr("y1", 10)
      .attr("x2", totalWidth/3 - 20)
      .attr("y2", 10);
  rightLabel.append("text")
      .attr("fill", '#333333')
      .attr("font-weight", 900)
      .attr("font-size", "16px")
      .text("Top Terms Unique to Right-Leaning Media");
  // word cloud
  svg.append('g') // left
    .attr("transform", "translate(0,35)")
    .node().appendChild(orderedWordCloud(totalWidth/3, left, '#333399', extent, 'left-top'));
  svg.append("g") // both
    .attr("transform", "translate(" + totalWidth/3 + ",35)")
    .node().appendChild(orderedWordCloud(totalWidth/3, both, '#800080', extent, 'both-top'));
  svg.append('g') // right
    .attr("transform", "translate(" + 2*(totalWidth/3) + ",35)")
    .node().appendChild(orderedWordCloud(totalWidth/3, right, '#993333', extent, 'right-top'));
  return svg.node();
}

function getContext2d() {
  return document.getElementById('font-helper-canvas').getContext('2d')
}

function listCloudLayout(wordNodes, width, extent, sizeRange) {
  // change line below DOM.context2d, only in observable 
  const canvasContext2d = getContext2d();
  let x = 0;
  if (typeof (wordNodes) === 'undefined') {
    return x;
  }
  wordNodes.attr('x', (d) => {
    const fs = fontSizeComputer(d, extent, sizeRange);
    canvasContext2d.font = `bold ${fs}px Lato`; // crazy hack for IE compat, instead of simply this.getComputedTextLength()
    const metrics = canvasContext2d.measureText(d.term);
    const textLength = metrics.width+4; // give it a little horizontal spacing between words
    let lastX = x;
    if (x + textLength + 10 > width) { // TODO: replace 10 with state property for padding
      lastX = 0;
    }
    x = lastX + textLength + (0.5 * fs);
    return lastX;
  });
  let y = -0.5 * sizeRange.max;
  let lastAdded = 0;
  wordNodes.attr('y', (d, index, data) => { // need closure here for d3.select to work right on the element
    const xPosition = d3.select(data[index]).attr('x');
    if (xPosition === '0') { // WTF does this come out as a string???!?!?!?!
      const height = 1.2 * fontSizeComputer(d, extent, sizeRange);
      y += height;
      y = Math.max(y, height);
      lastAdded = height;
    }
    return y;
  });
  return y + lastAdded;
};

function orderedWordCloud(theWidth, data, termColor, exent, id){ 
  // setup the wrapper svg
  const innerWidth = theWidth - (2 * config.padding);
  const svg = d3.create("svg")
    .attr('height', config.height)
    .attr('width', theWidth)
    .attr('id', id || 'ordered-word-cloud')
    .attr('class', 'word-cloud');

  // start hieght calculations
  let y = config.height;
  let wordNodes;
  const wordListHeight = config.height - (2 * config.padding);
  const wordWrapper = svg.append('g')
    .attr('transform', `translate(${2 * config.padding},0)`);
  const sizeRange = { min: config.minFontSize, max: config.maxFontSize };
  const fullExtent = exent || d3.extent(data, d => d.tfnorm)

  // start layout loop
  while ((y >= wordListHeight) && (sizeRange.max > sizeRange.min)) {
    wordNodes = wordWrapper.selectAll('text')  // one text per term
      .data(data, d => d.term)
      .enter()
        .append('text') // for incoming data
        .attr('class', '')
        .attr('fill', termColor)
        .attr('font-family', 'Lato, Helvetica, sans')
        .classed('word', true)
        .classed('hide', d => d.display === false)
        .classed('show', d => d.display !== false)
        .classed('selected', d => d.term === config.selectedTerm)
        .attr('font-size', d => fontSizeComputer(d, fullExtent, sizeRange))
        .text(d => d.term)
        .attr('font-weight', 'bold')
        .on('mouseover', (d) => {
          const { event } = d3;
          d3.select(event.target).attr('fill', config.linkColor)
            .attr('cursor', 'pointer');
        })
        .on('mouseout', () => {
          const { event } = d3;
          d3.select(event.target).attr('fill', config.textColor)
            .attr('cursor', 'arrow');
        });

    // Layout
    y = 0;
    const leftHeight = listCloudLayout(wordNodes, innerWidth, fullExtent, sizeRange);
    y = Math.max(y, leftHeight);
    sizeRange.max -= 1;
  }
  
  // we need to return a DOM element for observable to render
  return svg.node(); 
}
