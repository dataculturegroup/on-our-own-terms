
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
    await queryWaybackAPI(leftLeaningDomains, rightLeaningDomains);

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
async function queryWaybackAPI(leftLeaningDomains, rightLeaningDomains) {
  console.log('Left domains:', leftLeaningDomains);
  console.log('Right domains:', rightLeaningDomains);

  var today = new Date(); // current date
  // 2 mondays ago 
  var monday_one = new Date();
  monday_one.setDate(today.getDate() - ((today.getDay() + 6) % 7 + 7) % 7 - 15); // 2 Mondays ago
  // 1 monday ago 
  var monday_two = new Date(monday_one);
  monday_two.setDate(monday_two.getDate() + 7); // corresponding Saturday

  var startDateStr = monday_one.toISOString().slice(0, 10);
  var endDateStr = monday_two.toISOString().slice(0, 10);

  console.log(startDateStr)
  console.log(endDateStr)

  // getting previous week's data 
  var leftWordsFile = `/data/${endDateStr.replace(/-/g, "")}-top-left.csv`;
  var rightWordsFile = `/data/${endDateStr.replace(/-/g, "")}-top-right.csv`;

  console.log('Left words file:', leftWordsFile);
  console.log('Right words file:', rightWordsFile);

  try {
    // read the words from the CSV files using d3.js
    const data = await readCSVData(leftWordsFile, rightWordsFile);

    // only pull first words now 
    const leftWords = data.leftWords.slice(0, 1);
    const rightWords = data.rightWords.slice(0, 1);

    console.log('Left words:', leftWords);
    console.log('Right words:', rightWords);
    
    // left domain queries
    const leftTermFetches = leftWords.map(term => wmAttentionQuery(term, leftLeaningDomains, startDateStr, endDateStr));
    const rightTermFetches = leftWords.map(term => wmAttentionQuery(term, rightLeaningDomains, startDateStr, endDateStr));

    // aggregate left and right counts for each word
    const leftCounts = await Promise.all(leftTermFetches);
    const rightCounts = await Promise.all(rightTermFetches);

    console.log('left count', leftCounts);
    console.log('right count', rightCounts); 

    var weekWordCounts = {};

    leftWords.forEach(function (word, index) {
      weekWordCounts[word] = weekWordCounts[word] || [];
      weekWordCounts[word].push({
        date: startDateStr,
        leftCount: leftCounts[index],
        rightCount: rightCounts[index],
        ratio: leftCounts[index].total / rightCounts[index].total
      });
    });

    rightWords.forEach(function (word, index) {
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
  link.download = `${word}_${startDateStr}.json`;
  link.click();

  // check local storage if file has been downloaded 
 // localStorage.setItem(localStorageKey, true);

  console.log(`JSON file ${index} created and downloaded successfully.`);
}

// call function to load and process the domain txt files
loadDomainNames();



// d3 viz 

// set dimensions and margins of the graph
var margin = { top: 30, right: 140, bottom: 80, left: 120 },
  width = 800 - margin.left - margin.right,
  height = 400 - margin.top - margin.bottom;

// append the svg object to the body of the page
var svg = d3
  .select("#chart")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// load JSON data
// trying with desanti 
d3.json("data/attention/desanti_2023-05-15.json").then(function (data) {
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
  var x = d3.scaleLinear().range([0, width]).domain([-2, 2]);
  var y = d3.scaleTime().range([height, 0]).domain([d3.min(allDates), d3.max(allDates)]);
  
  // add y axis
  svg.append("g")
  .call(d3.axisLeft(y)
  .ticks(8)
  .tickFormat(d3.timeFormat("%m-%d-%Y")))
  .selectAll("text")
  .style("font-size", "16px");

  // add y axis label
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0- margin.left )
    .attr("x", 0 - height / 2)
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "16px")
    .text("Date");
  
    // add x axis
  svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(" + width / 2 + " ," + (height + margin.top + 20) + ")")

    
  // add x-axis tick marks
  svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-65)");
  svg.select(".x-axis").selectAll(".tick").remove();

  // add x axis label
  svg.append("text")
    .attr("transform", "translate(" + width / 2 + " ," + (height + margin.top + 20) + ")")
    .style("text-anchor", "middle")
    .text("Ratio (left count/right count)");
  
  // add label for thirds 
  var xLabelsNames = [
    { label: "Left Leaning", x: width / 6 },
    { label: "Middle", x: width / 2 },
    { label: "Right Leaning", x: (5 * width) / 6 }
  ];
  
  var xLabels = svg.append("g")
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
  svg.append("line")
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
svg.append("linearGradient")
  .attr("id", "line-gradient")
  .attr("gradientUnits", "userSpaceOnUse")
  .attr("x1", 0)
  .attr("y1", y(3))
  .attr("x2", 0)
  .attr("y2", y(-3))
  .selectAll("stop")
  .data([
    { offset: "0%", color: "blue" },
    { offset: "50%", color: "purple" },
    { offset: "100%", color: "red" },
  ])
  .enter()
  .append("stop")
  .attr("offset", function (d) {
    return d.offset;
  })
  .attr("stop-color", function (d) {
    return d.color;
  });

// add line
svg.selectAll(".line")
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
svg.append("text")
  .attr("x", width / 2)
  .attr("y", 0 - margin.top / 2)
  .attr("text-anchor", "middle")
  .style("font-size", "16px")
  .text("Attention Over Time");

// Create a horizontal line that traces the selected data point
var horizontalLine = svg.append("line")
  .attr("class", "horizontal-line")
  .style("stroke", "black")
  .style("stroke-dasharray", "4")
  .style("opacity", 0);


// find the closest y index of the mouse
var bisect = d3.bisector(function (d) {
  return d.date;
}).left;

// create circle that travels along line 
var focus = svg.append("g")
  .append("circle")
  .style("fill", "none")
  .attr("stroke", "black")
  .attr("r", 8.5)
  .style("opacity", 0);

// text box that travels with line 
var focusBox = svg.append("g")
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
var focusText = svg
  .append("g")
  .append("text")
  .style("opacity", 0)
  .attr("text-anchor", "left")
  .attr("alignment-baseline", "left")
  .attr("dx", 10)
  .attr("dy", 0);


// transparent rectangle that covers the entire chart area
svg.append("rect")
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
  horizontalLine.attr("x1", x(-2))
    .attr("y1", y(closestData.date))
    .attr("x2", x(2))
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
svg.select("rect")
  .on("mouseover", mouseover)
  .on("mousemove", mousemove)
  .on("mouseout", mouseout);
})
