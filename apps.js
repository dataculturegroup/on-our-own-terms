
const config = ({ 
  width: 1200,
  height: 300,
  maxTerms: 100,
  maxFontSize: 30,
  minFontSize: 12,
  padding: 0,
  selectedTerm: null
})

// populate dropdown menu with weeks
function populateDates() {
  var select = document.getElementById("inputDate");
  var currentWeek = new Date(2022, 7, 1);
  var options = [];

  // getting current date
  var currentDate = new Date();

  while (currentWeek < currentDate) {
    // calc the date when the data for the current week will be generated
    var weekEnd = new Date(currentWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
    // data generation 5 days after, ie friday 
    var dataGenerationDate = new Date(weekEnd.getTime() + 5 * 24 * 60 * 60 * 1000);

    // check if date of data generation has passed
    if (dataGenerationDate <= currentDate) {
      var optionDate = new Date(currentWeek);
      options.push({
        date: optionDate.toISOString().slice(0, 10),
        text: "Week of " + optionDate.toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' })
      });
    }

    // next Sunday
    currentWeek.setDate(currentWeek.getDate() + 7);
  }

  options.sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  for (var i = 0; i < options.length; i++) {
    var option = document.createElement("option");
    option.value = options[i].date;
    option.text = options[i].text;
    select.appendChild(option);
  }

  // select the most recent option (which is the last week before the current date)
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
  const resultWeek = `Top terms in headlines during the ${selectedOption.text}:`;
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

  // select DIVs 
  const leftTermsOnlyDiv = document.getElementById('left-only-terms');
  const rightTermsOnlyDiv = document.getElementById('right-only-terms');
  const sharedTermsDiv = document.getElementById('shared-terms');
  
  // clear DIV contents 
  if (leftTermsOnlyDiv && rightTermsOnlyDiv && sharedTermsDiv) {
    leftTermsOnlyDiv.innerHTML = '';
    rightTermsOnlyDiv.innerHTML = '';
    sharedTermsDiv.innerHTML = '';
  }
  // fetch data, render visualization
  fetchData(selectedDate)
    .then((data) => {
      renderForWeek(selectedDate, data);
    })
    .catch((error) => {
      console.error('Error fetching data:', error);
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
  const rightCsvData = await d3.csv(`./data/${selectedDate}-top-right.csv`, d3.autoType);
  const leftCsvData = await d3.csv(`./data/${selectedDate}-top-left.csv`, d3.autoType);
  
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

  // create three SVG elements
  const rightSVG = d3.select("#right-only-terms").append("svg")
    .attr("width", totalWidth/3)
    .attr("height", config.height);

const leftSVG = d3.select("#left-only-terms").append("svg")
    .attr("width", totalWidth/3)
    .attr("height", config.height);

const sharedSVG = d3.select("#shared-terms").append("svg")
    .attr("width", totalWidth/3)
    .attr("height", config.height);

  // labels for 3 viz 
  const leftLabel = leftSVG.append('g') // left
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

  const bothLabel = sharedSVG.append('g') // both
  .attr("transform", "translate(0,20)")
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

  const rightLabel = rightSVG.append('g') // right
    .attr("transform", "translate(0,20)")
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
  leftSVG.append('g') // left
    .attr("transform", "translate(0,35)")
    .node().appendChild(orderedWordCloud(totalWidth/3, left, '#333399', extent, 'left-top'));
  sharedSVG.append("g") // both
    .attr("transform", "translate(0,35)")
    .node().appendChild(orderedWordCloud(totalWidth/3, both, '#800080', extent, 'both-top'));
  rightSVG.append('g') // right
    .attr("transform", "translate(0,35)")
    .node().appendChild(orderedWordCloud(totalWidth/3, right, '#993333', extent, 'right-top'));

  // combine all three SVG elements into a single selection
  const allSVGs = d3.selectAll([leftSVG.node(), sharedSVG.node(), rightSVG.node()]);

  // select all text elements from the combined selection
  const terms = allSVGs.selectAll('text');
  terms.on('click', function(event, d) {
  // get start and end dates for the selected week
  const formattedDate = `${selectedDate.slice(4, 6)}-${selectedDate.slice(6)}-${selectedDate.slice(0, 4)}`;
  const endDateObj = new Date(new Date(formattedDate).getTime() + 7 * 24 * 60 * 60 * 1000);
  const endDateStr = endDateObj.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

  // Parse the formatted date back into a JavaScript Date object
  const parsedDate = new Date(
    formattedDate.slice(6), // Year
    parseInt(formattedDate.slice(0, 2)) - 1, // Month (subtract 1 as month is zero-based)
    formattedDate.slice(3, 5) // Day
  );

  // Get one week from the parsed date
  const oneWeekLater = new Date(parsedDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Format the one week later date as "MM-DD-YYYY"
  const formattedOneWeekLater = `${
    (oneWeekLater.getMonth() + 1).toString().padStart(2, '0')
  }-${oneWeekLater.getDate().toString().padStart(2, '0')
  }-${oneWeekLater.getFullYear()}`;

  // Output the formatted one week later date
  console.log(formattedDate)
  console.log("One Week Later:", formattedOneWeekLater); 

  const url = `https://search.mediacloud.org/search?q=${encodeURIComponent(d.term)}&nq=&start=${encodeURIComponent(formattedDate)}&end=${encodeURIComponent(formattedOneWeekLater)}&p=onlinenews-mediacloud&ss=&cs=34412234%253EUnited%2520States%2520-%2520National&any=any`
  console.log(url)
  
  // open new tab with search for clicked term
  window.open(url)
  })
  .on('mouseover', function() {
    d3.select(this).style('cursor', 'pointer')
      .style('font-weight', 'normal')
      .style('font-size', d => (d.fontSize * 1.2) + 'px');
  })
  .on('mouseout', function() {
    d3.select(this).style('cursor', 'default')
    .style('font-weight', 'bold');
  }); 
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
    canvasContext2d.font = `bold ${fs}px 'Source Sans Pro'`; // crazy hack for IE compat, instead of simply this.getComputedTextLength()
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
  
  // start height calculations
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
