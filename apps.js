// async function setWeek that grabs our data 
async function setWeek() {
  const day = new Date(document.getElementById("inputDate").value);
  var one = 1;
  var dateCSV = new Date(day.setDate(day.getDate() + one))
    .toLocaleDateString('en-GB')
    .split('/')
    .reverse()
    .join('');
// create arrays out of CSV data 

// to pull CSV for given week, use leftCSV and rightCSV instead 
// leftCSV = ''.concat(dateCSV + '-top-left.csv');
// rightCSV = ''.concat(dateCSV + '-top-right.csv'); 

// using example CSV files for now 
  var RightcsvData = await d3.csv('rightExample.csv')  
  var LeftcsvData = await d3.csv('leftExample.csv')

  console.log("right CSV array" , RightcsvData);
  console.log("left CSV array", LeftcsvData);

  // clean data from right array --> this is returning an object 
  var rightData = {
    const: cleanedRightData = RightcsvData 
        .filter(r => r.term.length > 2)
        .sort((x, y) => d3.descending(x.count, y.count))
        .slice(0, config.maxTerms),
    const: total = cleanedRightData.map(r => r.count).reduce((a, b) => a + b, 0),
    return: rightMap = cleanedRightData.map(r => ({ ...r, tfnorm: r.count/total }))
    }; 
    console.log("right map", rightMap)
    console.log("right data", rightData)

    // clean data from left array --> this is returning an object 
    var leftData = {
    const: cleanedLeftData = LeftcsvData
        .filter(r => r.term.length > 2)
        .sort((x, y) => d3.descending(x.count, y.count))
        .slice(0, config.maxTerms),
    const: total = cleanedLeftData.map(r => r.count).reduce((a, b) => a + b, 0),
    return:  leftMap = cleanedLeftData.map(r => ({ ...r, tfnorm: r.count/total })),
    }; 
    console.log("left map", leftMap)
    console.log("left data", leftData)

    // concat right and left data, find extent 
    const extent = d3.extent(rightMap.concat(leftMap),  d => d.tfnorm); 
    console.log("extent", extent)

    const sizeRange = { min: config.minFontSize, max: config.maxFontSize };
    console.log("sizeRange", sizeRange)

    // 'Uncaught ReferenceError: fontSizeComputer is not defined at <anonymous>:1:1' 
const fontSizeComputer = (term, extent, sizeRange) => {
    const size = sizeRange.min + (((sizeRange.max - sizeRange.min)
        * (Math.log(term.tfnorm) - Math.log(extent[0]))) / (Math.log(extent[1]) - Math.log(extent[0])));
    console.log(size)
    return size;
};

listCloudLayout = (wordNodes, width, extent, sizeRange) => {
  // change line below DOM.context2d, only in observable 
  const canvasContext2d = DOM.context2d(300, 300);
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


orderedWordCloud = (theWidth, data, termColor, exent, id) => { 

  // setup the wrapper svg
  const innerWidth = theWidth - (2 * config.padding);
  const svg = d3.create(id) 
    .attr('height', config.height)
    .attr('width', theWidth);
    // .attr('id', id || 'ordered-word-cloud')
   //  .attr('class', 'word-cloud');

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
  return svg.node();
};
};



/* 
code to fit left/middle/right into html 

{
  const totalWidth = 1200;
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
*/ 
