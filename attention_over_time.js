
// function read txt files using d3
function readTXTFile(filename) {
  return d3.text(filename);
}

// function read CSV files using d3.js
function readCSVFile(filename) {
  return d3.csv(filename);
}

// function laods, concatenates the domain names from txt files
function loadDomainNames() {
  var leftLeaningDomains = [];
  var rightLeaningDomains = [];

  console.log('Loading domain TXT files...');

  // read the domain names from quintile.txt files using d3
  Promise.all([
    readTXTFile('/data/2018-quintiles/quintile-far-left.txt'),
    readTXTFile('/data/2018-quintiles/quintile-center-left.txt'),
    readTXTFile('/data/2018-quintiles/quintile-center-right.txt'),
    readTXTFile('/data/2018-quintiles/quintile-far-right.txt')
  ])
    .then(function(files) {
      leftLeaningDomains = files.slice(0, 2).flatMap(function(data) {
        return data.trim().split('\n');
      }).sort();

      rightLeaningDomains = files.slice(2).flatMap(function(data) {
        return data.trim().split('\n');
      }).sort();

      console.log('Domain TXT files loaded successfully.');
      
      queryWaybackAPI(leftLeaningDomains, rightLeaningDomains);
    })
    .catch(function(error) {
      console.error('Error loading domain TXT files:', error);
    });
}

// function queries Wayback API to get word counts
function queryWaybackAPI(leftLeaningDomains, rightLeaningDomains) {
  console.log('left domains', leftLeaningDomains);
  console.log('right domains', rightLeaningDomains);

  var startDate = new Date(2022, 6, 31); // Start date for the weeks
  var endDate = new Date(); // Current date

  var weeks = [];
  var currentDate = new Date(startDate.getTime());

  // get an array of weeks from the start date 
  while (currentDate < endDate) {
    var week = {
      startDate: new Date(currentDate),
      endDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 6)
    };
    weeks.push(week);

    currentDate.setDate(currentDate.getDate() + 7);
  }

  var wordCounts = {};

  // go by each week
  Promise.all(
    weeks.map(function(week) {
      var startDate = week.startDate.toISOString().slice(0, 10).replace(/-/g, "");;
      var endDate = week.endDate.toISOString().slice(0, 10).replace(/-/g, "");;

      var leftWordsFile = `/data/${startDate}-top-left.csv`;
      var rightWordsFile = `/data/${startDate}-top-right.csv`;

      // read words from the csv using d3
      return Promise.all([readCSVFile(leftWordsFile), readCSVFile(rightWordsFile)])
        .then(function(files) {
          var leftWords = files[0].map(function(row) {
            return row.word;
          });

          var rightWords = files[1].map(function(row) {
            return row.word;
          });

          // left leaning domains
          return Promise.all(
            leftWords.map(function(word) {
              var apiUrl = `https://wayback-api.archive.org/colsearch/v1/mediacloud/search/overview?q=${word}&publication_date:[${startDate} TO ${endDate}]&domain:`;

              var leftDomainQuery = apiUrl + leftLeaningDomains.join(' OR ');
              var leftFetchPromise = fetch(leftDomainQuery)
                .then(function(response) {
                  return response.json();
                })
                .then(function(data) {
                  return data.total || 0;
                });

              return leftFetchPromise;
            })
          )
            .then(function(leftCounts) {
              //same as above, right leaning domains
              return Promise.all(
                rightWords.map(function(word) {
                  var apiUrl = `https://wayback-api.archive.org/colsearch/v1/mediacloud/search/overview?q=${word}&publication_date:[${startDate} TO ${endDate}]&domain:`;

                  var rightDomainQuery = apiUrl + rightLeaningDomains.join(' OR ');
                  var rightFetchPromise = fetch(rightDomainQuery)
                    .then(function(response) {
                      return response.json();
                    })
                    .then(function(data) {
                      return data.total || 0;
                    });

                  return rightFetchPromise;
                })
              )
                .then(function(rightCounts) {
                  // aggregate left and right counts for each word
                  leftWords.forEach(function(word, index) {
                    if (!wordCounts[word]) {
                      wordCounts[word] = { word: word, leftCount: 0, rightCount: 0 };
                    }
                    wordCounts[word].leftCount += leftCounts[index];
                  });

                  rightWords.forEach(function(word, index) {
                    if (!wordCounts[word]) {
                      wordCounts[word] = { word: word, leftCount: 0, rightCount: 0 };
                    }
                    wordCounts[word].rightCount += rightCounts[index];
                  });
                });
            });
        });
    })
  )
    .then(function() {
      console.log('Word counts queried successfully.');

      // Proceed to step 3
      writeJSONFile(Object.values(wordCounts));
    })
    .catch(function(error) {
      console.error('Error querying word counts:', error);
    });
}

// function writes the JSON data to a file
function writeJSONFile(jsonData) {
  console.log('Writing JSON file...');

  var jsonContent = JSON.stringify(jsonData);

  // write JSON content
  // For example, in a browser environment, you can use Blob and createObjectURL:
  var blob = new Blob([jsonContent], { type: 'application/json' });
  var url = URL.createObjectURL(blob);

  // download for the JSON file (for now) 
  var link = document.createElement('a');
  link.href = url;
  link.download = 'word_counts.json';
  link.click();

  // clean URL
  URL.revokeObjectURL(url);

  console.log('JSON file created and downloaded successfully.');
}

console.log('Starting the process...');

loadDomainNames();










// set the dimensions and margins of the graph
var margin = {top: 30, right: 110, bottom: 80, left: 60},
  width = 800 - margin.left - margin.right,
  height = 400 - margin.top - margin.bottom;

// append the svg object to the body of the page
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

// Set the domain of the X axis
x.domain(d3.extent(data, function(d) { return new Date(d.date); }));

// X axis
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

//  X axis label
svg.append("text")             
  .attr("transform",
        "translate(" + (width/2) + " ," + 
                       (height + margin.top + 20) + ")")
  .style("text-anchor", "middle")
  .text("Time");

//  Y axis
var y = d3.scaleLinear()
  .domain([-3, 3])
  .range([ height, 0 ]);
svg.append("g")
  .call(d3.axisLeft(y));

// Y axis label
svg.append("text")
  .attr("transform", "rotate(-90)")
  .attr("y", 0 - margin.left)
  .attr("x",0 - (height / 2))
  .attr("dy", "1em")
  .style("text-anchor", "middle")
  .text("Y Axis Label");


// add the zero line
svg.append("path")
  .attr("d", "M 0 " + y(0) + " L " + width + " " + y(0))
  .attr("stroke", "black")
  .attr("stroke-width", "1px")
  .attr("stroke-dasharray", "4");

// define the line function
var line = d3.line()
  .x(function(d) { return x(new Date(d.date)); })
  .y(function(d) { return y(d.ratio); })
  .curve(d3.curveCatmullRom);

// define domains
x.domain(d3.extent(data, function(d) { return new Date(d.date); }));
y.domain([-3, 3]);

// gradient from red to blue 
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

// title
svg.append("text")
.attr("x", (width / 2))
.attr("y", 0 - (margin.top / 2))
.attr("text-anchor", "middle")
.style("font-size", "16px")
.text("Attention Over Time");

// find the closest X index of the mouse:
var bisect = d3.bisector(function(d) { return new Date(d.date); }).left;

// create circle that travels along the curve of chart
var focus = svg
  .append('g')
  .append('circle')
    .style("fill", "none")
    .attr("stroke", "black")
    .attr('r', 8.5)
    .style("opacity", 0)

// create text box that travels along the curve of chart
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

// create transparent rectangle to cover chart area
svg.append('rect')
  .attr('width', width)
  .attr('height', height)
  .style('fill', 'none')
  .style('pointer-events', 'all')
  .on('mouseover', mouseover)
  .on('mousemove', mousemove)
  .on('mouseout', mouseout);


// mouseover functions 
function mouseover() {
  focus.style("opacity", 1)
  focusText.style("opacity",1)
}
function mousemove(event) {
  // recover coordinate we need
  var x0 = x.invert(d3.pointer(event)[0]);
  var i = bisect(data, x0, 1);
  var selectedData = data[i];
  focus
    .attr("cx", x(new Date(selectedData.date)))
    .attr("cy", y(selectedData.ratio))
  focusText
    .html("Ratio: " + selectedData.ratio)
    .attr("x", x(new Date(selectedData.date))+15)
    .attr("y", y(selectedData.ratio))
}

function mouseout() {
  focus.style("opacity", 0)
  focusText.style("opacity", 0)
}

