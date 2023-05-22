

// function to read txt files using d3.js
function readTXTFile(filename) {
  return d3.text(filename);
}

// function to read csv files using d3.js
function readCSVFile(filename) {
  return d3.csv(filename);
}

// load and concatenate the domain names from txt files
function loadDomainNames() {
  var leftLeaningDomains = [];
  var rightLeaningDomains = [];

  console.log('Loading domain TXT files...');

  // read the domain names from the quintile.txt files using d3.js
  Promise.all([
    readTXTFile('/data/2018-quintiles/quintile-far-left.txt'),
    readTXTFile('/data/2018-quintiles/quintile-center-left.txt'),
    readTXTFile('/data/2018-quintiles/quintile-center-right.txt'),
    readTXTFile('/data/2018-quintiles/quintile-far-right.txt')
  ])
    .then(function (files) {
      leftLeaningDomains = files.slice(0, 2).flatMap(function (data) {
        return data.trim().split('\n');
      }).sort();

      rightLeaningDomains = files.slice(2).flatMap(function (data) {
        return data.trim().split('\n');
      }).sort();

      console.log('Domain txt files loaded successfully.');

      queryWaybackAPI(leftLeaningDomains, rightLeaningDomains);
    })
    .catch(function (error) {
      console.error('Error loading domain txt files:', error);
    });
}

// query the Wayback API to get word counts
function queryWaybackAPI(leftLeaningDomains, rightLeaningDomains) {
  console.log('Left domains:', leftLeaningDomains);
  console.log('Right domains:', rightLeaningDomains);

  var startDate = new Date(2022, 6, 31); // start date for the week
  var endDate = new Date(2022, 7, 6); // end date for the week

  var firstStartDate = startDate.toISOString().slice(0, 10);
  var firstEndDate = endDate.toISOString().slice(0, 10);

  var leftWordsFile = `/data/${firstStartDate.replace(/-/g, "")}-top-left.csv`;
  var rightWordsFile = `/data/${firstStartDate.replace(/-/g, "")}-top-right.csv`;

  console.log('Left words file:', leftWordsFile);
  console.log('Right words file:', rightWordsFile);

  // read the words from the CSV files using d3.js
  return readCSVData(leftWordsFile, rightWordsFile)
    .then(function (data) {
      var leftWords = data.leftWords;
      var rightWords = data.rightWords;

      console.log('Left words:', leftWords);
      console.log('Right words:', rightWords);

      // left domain queries
      var leftPromises = leftWords.map(function (word) {
        var apiUrl = `https://wayback-api.archive.org/colsearch/v1/mediacloud/search/overview?q=${word}&timestamp:[${firstStartDate} TO ${firstEndDate}]&domain:`;
        var leftDomainQuery = apiUrl + leftLeaningDomains.join(' OR ');
        console.log(apiUrl);
        console.log('Left domain query:', leftDomainQuery);

        return fetch(leftDomainQuery)
          .then(function (response) {
            return response.json();
          })
          .then(function (data) {
            return data.total || 0;
          });
      });

      // right domain queries
      var rightPromises = rightWords.map(function (word) {
        var apiUrl = `https://wayback-api.archive.org/colsearch/v1/mediacloud/search/overview?q=${word}&timestamp:[${firstStartDate} TO ${firstEndDate}]&domain:`;
        var rightDomainQuery = apiUrl + rightLeaningDomains.join(' OR ');

        console.log('Right domain query:', rightDomainQuery);

        return fetch(rightDomainQuery)
          .then(function (response) {
            return response.json();
          })
          .then(function (data) {
            return data.total || 0;
          });
      });

      // aggregate left and right counts for each word
      return Promise.all([Promise.all(leftPromises), Promise.all(rightPromises)])
        .then(function ([leftCounts, rightCounts]) {
          var weekWordCounts = {};

          leftWords.forEach(function (word, index) {
            weekWordCounts[word] = weekWordCounts[word] || [];
            weekWordCounts[word].push({
              date: firstStartDate,
              leftCount: leftCounts[index],
              rightCount: rightCounts[index],
              ratio: leftCounts[index] / rightCounts[index]
            });
          });

          rightWords.forEach(function (word, index) {
            weekWordCounts[word] = weekWordCounts[word] || [];
            weekWordCounts[word].push({
              date: firstStartDate,
              leftCount: leftCounts[index],
              rightCount: rightCounts[index],
              ratio: leftCounts[index] / rightCounts[index]
            });
          });

          return weekWordCounts;
        })
        .catch(function (error) {
          console.error('Error querying word counts:', error);
        });
    })
    .then(function (weekWordCounts) {
      console.log('Word counts queried successfully.');

      // write the JSON data to separate files for each word
      var promises = Object.entries(weekWordCounts).map(function ([word, counts], index) {
        writeJSONFile(counts, word, index);
      });

      return Promise.all(promises);
    })
    .catch(function (error) {
      console.error('Error querying word counts:', error);
    });
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

// write the JSON data to a file
function writeJSONFile(jsonData, word, index) {
  console.log('Writing JSON file...');

  var jsonContent = JSON.stringify(jsonData);

  // create a Blob with the JSON content
  var blob = new Blob([jsonContent], { type: 'application/json' });

  // create a download link for the JSON file
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${word}_${index}.json`;
  link.click();

  console.log(`JSON file ${index} created and downloaded successfully.`);
}

console.log('Starting the process...');

// call function to load and process the domain txt files
loadDomainNames();






// set dimensions and margins of the graph
var margin = {top: 30, right: 110, bottom: 80, left: 60},
  width = 800 - margin.left - margin.right,
  height = 400 - margin.top - margin.bottom;

// Append the svg object to the body of the page
var svg = d3.select("#chart")
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform",
          "translate(" + margin.left + "," + margin.top + ")");

// set ranges
var x = d3.scaleTime().range([0, width]);
var y = d3.scaleLinear().range([height, 0]);

// Load JSON data
d3.json("path/to/json/file.json").then(function(data) {
  //  date and ratio values
  data.forEach(function(d) {
    d.date = new Date(d.date);
    d.ratio = parseFloat(d.ratio);
  });

  // domain X adis 
  x.domain(d3.extent(data, function(d) { return d.date; }));

  // add X axis
  svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x)
      .ticks(d3.timeMonth.every(1))
      .tickFormat(d3.timeFormat("%m-%d-%Y")))
    .selectAll("text")
      .style("text-anchor", "end")
      .attr("transform","rotate(-45)")
      .attr("dx", "-0.8em")
      .attr("dy", "0.15em");

  // add X axis label
  svg.append("text")
    .attr("transform",
          "translate(" + (width/2) + " ," +
                         (height + margin.top + 20) + ")")
    .style("text-anchor", "middle")
    .text("Time");

  // add Y axis
  var y = d3.scaleLinear()
    .domain([-3, 3])
    .range([height, 0]);
  svg.append("g")
    .call(d3.axisLeft(y));

  // add Y axis label
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x",0 - (height / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .text("Ratio");

  // add the zero line
  svg.append("path")
    .attr("d", "M 0 " + y(0) + " L " + width + " " + y(0))
    .attr("stroke", "black")
    .attr("stroke-width", "1px")
    .attr("stroke-dasharray", "4");

  // define  line function
  var line = d3.line()
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y(d.ratio); })
    .curve(d3.curveCatmullRom);

  // define domains
  x.domain(d3.extent(data, function(d) { return d.date; }));
  y.domain([-3, 3]);

  // set gradient
  svg.append("linearGradient")
    .attr("id", "line-gradient")
    .attr("gradientUnits", "userSpaceOnUse")
    .attr("x1", 0)
    .attr("y1", y(3))
    .attr("x2", 0)
    .attr("y2", y(-3))
    .selectAll("stop")
      .data([
        {offset: "0%", color: "red"},
        {offset:"50%", color:"purple"},
        {offset: "100%", color: "blue"}
      ])
    .enter().append("stop")
      .attr("offset", function(d) { return d.offset; })
      .attr("stop-color", function(d) { return d.color; });

  // add line 
  svg.append("path")
    .datum(data)
    .attr("class", "line")
    .attr("d", line)
    .style("stroke", "url(#line-gradient)")
    .style("stroke-width", "5px")
    .style("fill", "none");

  // add title
  svg.append("text")
    .attr("x", (width / 2))
    .attr("y", 0 - (margin.top / 2))
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text("Attention Over Time");

  // allows finding the closest X index of the mouse
  var bisect = d3.bisector(function(d) { return d.date; }).left;

  // create the circle that travels along the curve of the chart
  var focus = svg
    .append('g')
    .append('circle')
      .style("fill", "none")
      .attr("stroke", "black")
      .attr('r', 8.5)
      .style("opacity", 0);

  // create text box that travels along curve of the chart
  var focusBox = svg
    .append('g')
    .append('rect')
      .attr('width', 100)
      .attr('height', 50)
      .attr('fill', 'white')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('rx', 5)
      .attr('ry', 5)
      .style("opacity", 0);

  var focusText = svg
    .append('g')
    .append('text')
      .style("opacity", 0)
      .attr("text-anchor", "left")
      .attr("alignment-baseline", "middle")
      .attr('dx', 10)
      .attr('dy', 25);

  // create a transparent rectangle that covers the entire chart area
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('mouseover', mouseover)
    .on('mousemove', mousemove)
    .on('mouseout', mouseout);

  // when mouse moves, show the annotations at the right positions
  function mouseover() {
    focus.style("opacity", 1);
    focusText.style("opacity", 1);
  }

  function mousemove(event) {
    // recover coordinates 
    var x0 = x.invert(d3.pointer(event)[0]);
    var i = bisect(data, x0, 1);
    var selectedData = data[i];
    focus
      .attr("cx", x(selectedData.date))
      .attr("cy", y(selectedData.ratio));
    focusText
      .html("Ratio: " + selectedData.ratio)
      .attr("x", x(selectedData.date) + 15)
      .attr("y", y(selectedData.ratio));
  }

  function mouseout() {
    focus.style("opacity", 0);
    focusText.style("opacity", 0);
  }
});
