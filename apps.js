
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
    .text("Unique to Media Mostly Shared by Democrats");

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
    .text("In Media Shared by Both");

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
    .text("Unique to Media Mostly Shared by Republicans");

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

  // select text elements
  const terms = allSVGs.selectAll('text');

  terms
    .on('mouseover', function() {
      d3.select(this)
        .style('cursor', 'pointer')
        .style('font-weight', 'normal')
        .style('font-size', d => (d.fontSize * 1.2) + 'px');
    })
    .on('mouseout', function() {
      d3.select(this)
        .style('cursor', 'default')
        .style('font-weight', 'bold');
    })
    .on('click', function(event, d) {
      const expandableSection = document.getElementById('expandableSection');

      // check if the clicked word is the same as the currently expanded 
      const isSameWord = expandableSection.dataset.word === d.term;

      // collapse the section with transition if same word 
      if (isSameWord) {
        expandableSection.style.maxHeight = '0px';
        expandableSection.innerHTML = '';
        expandableSection.dataset.word = '';
        expandableSection.classList.remove('expanded'); // Remove the 'expanded' class
      } else {
        expandableSection.style.maxHeight = '500px';
        expandableSection.dataset.word = d.term;
        expandableSection.classList.add('expanded'); // Add the 'expanded' class

        // clear existing viz 
        clearVisualization(); 

        generateAttentionVisualization(d.term, selectedDate ); // Replace 'd.term' with the appropriate argument for the function
      }
    });
  }

// remove, reset existing viz 
function clearVisualization() {
  var visualizationContainer = document.getElementById('expandableSection');
  visualizationContainer.innerHTML = '';
}
  

function generateAttentionVisualization(selectedTerm, selectedDate) {

  // function to read txt files using d3.js
  function readTXTFile(filename) {
    return d3.text(filename);
  }

  // function to read csv files using d3.js
  function readCSVFile(filename) {
    return d3.csv(filename);
  }

  // load and concatenate the domain names from txt files
  async function loadDomainNames() {
    var leftLeaningDomains = [];
    var rightLeaningDomains = [];

    console.log('Loading domain TXT files...');

    try {
      // read the domain names from the quintile.txt files using d3.js
      const files = await Promise.all([
        readTXTFile('/data/2018-quintiles/quintile-far-left.txt'),
        readTXTFile('/data/2018-quintiles/quintile-center-left.txt'),
        readTXTFile('/data/2018-quintiles/quintile-center-right.txt'),
        readTXTFile('/data/2018-quintiles/quintile-far-right.txt')
      ]);

      leftLeaningDomains = files.slice(0, 2).flatMap(function (data) {
        return data.trim().split('\n');
      }).sort();

      rightLeaningDomains = files.slice(2).flatMap(function (data) {
        return data.trim().split('\n');
      }).sort();
      
      console.log('Domain txt files loaded successfully.');
      await queryWaybackAPI(selectedTerm, leftLeaningDomains, rightLeaningDomains, selectedDate);

    } catch (error) {
      console.error('Error loading domain txt files:', error);
    }
    
  }

  const WM_API_OVERVIEW_URL = `https://wayback-api.archive.org/colsearch/v1/mediacloud/search/overview`;

  function wmAttentionQuery(term, domains, startDateStr, endDateStr) {
    // encode domains 
    //?q=${encodeURIComponent(word)}&publication_date:[${firstStartDate}%20TO%20${firstEndDate}]&domain=
    //var leftDomainQuery = WM_API_OVERVIEW_URL + leftLeaningDomains.map(domain => encodeURIComponent(domain)).join('%20OR%20');
  // console.log(WM_API_OVERVIEW_URL);
  // console.log('Left domain query:', leftDomainQuery);

    // send POST request to URL 
    const dateClause = `publication_date:[${startDateStr} TO ${endDateStr}]`;
    const domainClause = `domain:(${domains.join(' OR ')})`;
    const params = {q: `"${term}" AND ${dateClause} AND ${domainClause}`};
    return fetch(WM_API_OVERVIEW_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(params)
    }).then(results => results.json());
    // parse, extract total count 
    //var data = await response.json();
    //return data.total || 0;
  }
  
  // query the Wayback API to get word counts
  async function queryWaybackAPI(selectedTerm, leftLeaningDomains, rightLeaningDomains, selectedDate) {

    console.log('Left domains:', leftLeaningDomains);
    console.log('Right domains:', rightLeaningDomains);

    const year = selectedDate.substr(0, 4);
    const month = selectedDate.substr(4, 2);
    const day = selectedDate.substr(6, 2);

    const startDate = new Date(`${year}-${month}-${day}`);
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const startDateStr = startDate.toISOString().substr(0, 10);
    const endDateStr = endDate.toISOString().substr(0, 10);

    console.log('START DATE STR', startDateStr )
    console.log('END DATE STR', endDateStr)

    const rightWordsFile = `./data/${selectedDate}-top-right.csv`;
    const leftWordsFile = `./data/${selectedDate}-top-left.csv`;

    console.log('Left words file:', rightWordsFile);
    console.log('Right words file:', leftWordsFile);

    try {
      // read the words from the CSV files using d3.js
      const data = await readCSVData(rightWordsFile, leftWordsFile);

      console.log('Left words:', selectedTerm);
      console.log('Right words:', selectedTerm);

      // Convert selectedTerm to an array
      const selectedTermArray = [selectedTerm];
      console.log('selectedTermArray:', selectedTermArray);

      // left domain queries
      const leftTermFetches = selectedTermArray.map(term => wmAttentionQuery(term, leftLeaningDomains, startDateStr, endDateStr));
      const rightTermFetches = selectedTermArray.map(term => wmAttentionQuery(term, rightLeaningDomains, startDateStr, endDateStr));

      // aggregate left and right counts for each word
      const leftCounts = await Promise.all(leftTermFetches);
      const rightCounts = await Promise.all(rightTermFetches);

      console.log('left count', leftCounts);
      console.log('right count', rightCounts); 

      var weekWordCounts = {};

      selectedTermArray.forEach(function (word, index) {
        weekWordCounts[word] = weekWordCounts[word] || [];
        weekWordCounts[word].push({
          date: startDateStr,
          leftCount: leftCounts[index],
          rightCount: rightCounts[index],
          ratio: leftCounts[index].total / rightCounts[index].total
        });
      });

      console.log('Word counts queried successfully.');

      // write the JSON data to separate files for each word
      var promises = Object.entries(weekWordCounts).map(function ([word, counts], index) {
        writeJSONFile(counts, word, index, startDateStr);
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Error querying word counts:', error);
    }
  }

  // helper function to read CSV data
  async function readCSVData(leftWordsFile, rightWordsFile) {
    try {
      const leftCsvData = await d3.csv(leftWordsFile, d3.autoType);
      const rightCsvData = await d3.csv(rightWordsFile, d3.autoType);

      const leftWords = leftCsvData.map(row => row.term);
      const rightWords = rightCsvData.map(row => row.term);

      return { leftWords, rightWords };
    } catch (error) {
      console.error('Error reading CSV data:', error);
      throw error;
    }
  }

  // function writes json file to computer 
  function writeJSONFile(jsonData, word, index, startDateStr) {
    console.log('Writing JSON file...');
    console.log(jsonData);

    var localStorageKey = `jsonDownloaded_${word}_${startDateStr}`;

    // checking if the file has already been downloaded
    if (localStorage.getItem(localStorageKey)) {
      console.log(`JSON file ${index} has already been downloaded.`);
      return;
    }

    // filter jsonData to keep only what is necessary
    var filteredData = jsonData.map(function (item) {
      return {
        date: item.date,
        leftDaily: item.leftCount.dailycounts,
        leftCount: item.leftCount.total,
        leftTopDomains: item.leftCount.topdomains,
        rightDaily: item.rightCount.dailycounts,
        rightCount: item.rightCount.total,
        rightTopDomains: item.rightCount.topdomains,
        ratioWeek: item.ratio,
      };
    });

    var jsonContent = JSON.stringify(filteredData);
    console.log("json filtered content", filteredData);

    var blob = new Blob([jsonContent], { type: 'application/json' });

    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedDate}-${word}.json`;
    link.click();

    // check local storage if file has been downloaded 
    // localStorage.setItem(localStorageKey, true);

    console.log(`JSON file ${index} created and downloaded successfully.`);
  }

  // call function to load and process the domain txt files
  loadDomainNames();

  // d3 viz 

  // set dimensions and margins of the graph
  var margin = { top: 50, right: 160, bottom: 90, left: 160 },
    width = 800 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  var svg_attention = d3
    .select("#expandableSection")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var filePath = `data/attention/${selectedDate}-${selectedTerm}.json`
  console.log('FILE PATH', filePath);

  d3.json(filePath).then(function (data) {
    // parse JSON and calculate the ratios
    data.forEach(function (d) {
      var dates = Object.keys(d.rightDaily);

      d.data = dates.map(function (date) {
        var ratio = d.leftDaily[date] / d.rightDaily[date];
        var adjustedDate = new Date(date);
        adjustedDate.setDate(adjustedDate.getDate() + 1); // Add one day to the date
        return { date: adjustedDate, ratio: ratio };
      });
      console.log('d.data', d.data); 
    });

    var allDates = Array.from(new Set(data.flatMap(d => d.data.map(datum => datum.date))));

    // set the ranges, domains for x and y scales
    var x = d3.scaleLinear().range([0, width]).domain([-4, 4]);
    var y = d3.scaleTime().range([height, 0]).domain([d3.min(allDates), d3.max(allDates)]);
    
    // add y axis
    svg_attention.append("g")
    .call(d3.axisLeft(y)
    .ticks(8)
    .tickFormat(d3.timeFormat("%m-%d-%Y")))
    .selectAll("text")
    .style("font-size", "16px");

    // add y axis label
    svg_attention.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0- margin.left )
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "16px")
      .text("Date");
    
      // add x axis
      svg_attention.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(" + width / 2 + " ," + (height + margin.top + 20) + ")")

      
    // add x-axis tick marks
    svg_attention.append("g")
      .attr("class", "x-axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-65)");
      svg_attention.select(".x-axis").selectAll(".tick").remove();

    // add x axis label
    svg_attention.append("text")
      .attr("transform", "translate(" + width / 2 + " ," + (height + margin.top + 20) + ")")
      .style("text-anchor", "middle")
      .text("Ratio (left count/right count)");
    
    // add label for thirds 
    var xLabelsNames = [
      { label: "Left Leaning", x: width / 6 },
      { label: "Middle", x: width / 2 },
      { label: "Right Leaning", x: (5 * width) / 6 }
    ];
    
    var xLabels = svg_attention.append("g")
      .attr("class", "x-labels")
      .selectAll(".x-label")
      .data(xLabelsNames)
      .enter()
      .append("text")
      .attr("class", "x-label")
      .attr("x", function(d) { return d.x; })
      .attr("y", height + 20)
      .style("text-anchor", "middle")
      .text(function(d) { return d.label; });
    
    // create a vertical line at x=0
    svg_attention.append("line")
      .attr("class", "zero-line")
      .attr("x1", x(0))
      .attr("y1", 0)
      .attr("x2", x(0))
      .attr("y2", height)
      .style("stroke", "black")
      .style("stroke", "4");

  // define line function
  var line = d3
    .line()
    .x(function (d) {
      return x(d.ratio); // fix the x-coordinate to use d.ratio
    })
    .y(function (d) {
      return y(d.date);
    })
    .curve(d3.curveCatmullRom);


  // set color gradient
  svg_attention.append("linearGradient")
  .attr("id", "line-gradient")
  .attr("gradientUnits", "userSpaceOnUse")
  .attr("x1", x(-4))
  .attr("y1", 0)
  .attr("x2", x(4))
  .attr("y2", 0)
  .selectAll("stop")
  .data([
    { offset: "0%", color: "blue" },
    { offset: "50%", color: "purple" },
    { offset: "100%", color: "red" },
  ])
  .enter().append("stop")
    .attr("offset", function (d) {
      return d.offset;
    })
    .attr("stop-color", function (d) {
      return d.color;
    });

  // add line
  svg_attention.selectAll(".line")
    .data(data)
    .enter()
    .append("path")
    .attr("class", "line")
    .attr("d", function (d) {
      return line(d.data);
    })
    .style("stroke", "url(#line-gradient)")
    .style("stroke-width", "5px")
    .style("fill", "none");

  // add title
  svg_attention.append("text")
    .attr("x", width / 2)
    .attr("y", 0 - margin.top / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text("Attention Over Time For Term: " + selectedTerm);

// Create a horizontal line that traces the selected data point
var horizontalLine = svg_attention.append("line")
  .attr("class", "horizontal-line")
  .style("stroke", "black")
  .style("stroke-dasharray", "4")
  .style("opacity", 0)
  .attr("x1", x(-4)) // Update the x1 attribute to extend the line to the y-axis
  .attr("y1", 0)
  .attr("x2", x(4)) // Update the x2 attribute to extend the line to the y-axis
  .attr("y2", height);

  // find the closest y index of the mouse
  var bisect = d3.bisector(function (d) {
    return d.date;
  }).left;

  // create circle that travels along line 
  var focus = svg_attention.append("g")
    .append("circle")
    .style("fill", "none")
    .attr("stroke", "black")
    .attr("r", 8.5)
    .style("opacity", 0);

  // text box that travels with line 
  var focusBox = svg_attention.append("g")
    .append("rect")
    .attr("width", 175)
    .attr("height", 50)
    .attr("fill", "white")
    .attr("stroke", "black")
    .attr("stroke-width", 1)
    .attr("rx", 5)
    .attr("ry", 5)
    .style("opacity", 0);

  // text in text box 
  var focusText = svg_attention
    .append("g")
    .append("text")
    .style("opacity", 0)
    .attr("text-anchor", "left")
    .attr("alignment-baseline", "left")
    .attr("dx", 10)
    .attr("dy", 0);


  // transparent rectangle that covers the entire chart area
  svg_attention.append("rect")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "none")
    .style("pointer-events", "all")
    .on("mouseover", mouseover)
    .on("mousemove", mousemove)
    .on("mouseout", mouseout);

  // When mouse enters the chart area, show the annotations
  function mouseover() {
    focus.style("opacity", 1);
    focusText.style("opacity", 1);
    focusBox.style("opacity", 1);
  }

  // When mouse moves within the chart area, update the annotations based on mouse position
  function mousemove(event) {
    // Recover mouse coordinates
    var mouseY = d3.pointer(event)[1];
    var y0 = y.invert(mouseY);

    // Find the corresponding data points for the y-coordinate
    var selectedData = data.map(function (d) {
      var index = bisect(d.data, y0, 1);
      var dataPoint = d.data[index];
      return {
        date: dataPoint.date,
        ratio: dataPoint.ratio,
      };
    });

    // Find the data point closest to the mouse position
    var closestData = selectedData.reduce(function (prev, curr) {
      return Math.abs(y(curr.ratio) - mouseY) < Math.abs(y(prev.ratio) - mouseY) ? curr : prev;
    });

    // Update the position of the focus circle
    focus.attr("cx", x(closestData.ratio)).attr("cy", y(closestData.date));
    
    // Update the position of the focus box
    var fbWidth = focusBox.node().getBBox().width;
    var fbHeight = focusBox.node().getBBox().height;
    var fbX = x(closestData.ratio) + 10;
    var fbY = y(closestData.date) - 40;
    focusBox.attr("x", fbX).attr("y", fbY);


    // Update the position and content of the focus text
    focusText.attr("x", fbX + 10).attr("y", fbY + 25);


    focusText.select("tspan.date").attr("x", fbX + 10).attr("y", fbY + 25).text("Date: " + d3.timeFormat("%m-%d-%Y")(closestData.date));
    focusText.select("tspan.ratio").attr("x", fbX + 10).attr("y", fbY + 45).text("Ratio: " + closestData.ratio.toFixed(4));
    

    focusText.append("tspan")
      .attr("class", "date")
      .attr("x", fbX + 10)
      .attr("y", fbY + 20);

    focusText.append("tspan")
      .attr("class", "ratio")
      .attr("x", fbX + 10)
      .attr("y", fbY + 40);

    // Update the position of the horizontal line
    horizontalLine.attr("x1", x(-4))
      .attr("y1", y(closestData.date))
      .attr("x2", x(4))
      .attr("y2", y(closestData.date))
      .style("opacity", 1);

  }

  // When mouse leaves the chart area, hide the annotations
  function mouseout() {
    focus.style("opacity", 0);
    focusText.style("opacity", 0);
    focusBox.style("opacity", 0);
    horizontalLine.style("opacity", 0); // Hide the horizontal line
  }

  // Attach the event handlers to the transparent rectangle
  svg_attention.select("rect")
    .on("mouseover", mouseover)
    .on("mousemove", mousemove)
    .on("mouseout", mouseout);
  })
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
    canvasContext2d.font = `bold ${fs}px 'Source Sans Pro'`; //  IE compat, instead of simply this.getComputedTextLength()
    const metrics = canvasContext2d.measureText(d.term);
    const textLength = metrics.width+4; 
    let lastX = x;
    if (x + textLength + 10 > width) { // TODO: replace 10 with state property for padding
      lastX = 0;
    }
    x = lastX + textLength + (0.5 * fs);
    return lastX;
  });
  let y = -0.5 * sizeRange.max;
  let lastAdded = 0;
  wordNodes.attr('y', (d, index, data) => { 
    const xPosition = d3.select(data[index]).attr('x');
    if (xPosition === '0') { 
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

