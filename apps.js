function setWeek() {
    var day = new Date(document.getElementById("startDate").value);
    var one = 1;
    var dateCSV = new Date(day.setDate(day.getDate() + one))
      .toLocaleDateString('en-GB')
      .split('/')
      .reverse()
      .join('');
    console.log(dateCSV)

  // pull CSV files for given week 
  leftCSV = ''.concat(dateCSV + '-top-left.csv');
  rightCSV = ''.concat(dateCSV + '-top-right.csv'); 
  console.log(leftCSV)
  console.log(rightCSV)

  // create arrays out of CSV data 
  var RightcsvData = Array.from(d3.csv(rightCSV).then(function(data) {
    console.log(data);
  }));
  var LeftcsvData = Array.from(d3.csv(leftCSV).then(function(data) {
    console.log(data);
  }));
  
  // clean data from right array
  const cleanedRightData = RightcsvData 
      .filter(r => r.term.length > 2)
      .sort((x, y) => d3.descending(x.count, y.count))
      .slice(0, config.maxTerms)

  const rightTotal = cleanedRightData.map(r => r.count).reduce((a, b) => a + b, 0)

  const rightData = [
    cleanedRightData, rightTotal,
    cleanedRightData.map(r => ({ ...r, tfnorm: r.count/total }))
  ]

  // clean data from left array
  const cleanedLeftData = LeftcsvData
      .filter(r => r.term.length > 2)
      .sort((x, y) => d3.descending(x.count, y.count))
      .slice(0, config.maxTerms)

  const leftTotal = cleanedLeftData.map(r => r.count).reduce((a, b) => a + b, 0)

  const leftData = [
    cleanedLeftData, leftTotal,
    cleanedLeftData.map(r => ({ ...r, tfnorm: r.count/total }))
  ]
 
  // concatenate right and left data 
  const added = leftData.concat(rightData)
  var extent = d3.extent(added, d => d.tfnorm)

  // function to create word cloud 
  function test() {
      const totalWidth = 1200;

      // first split the data into left/both/right
      const totalCount = leftData.map(r => r.count).reduce((a, b) => a + b, 0) 
                        + rightData.map(r => r.count).reduce((a, b) => a + b, 0);
      
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
  }}