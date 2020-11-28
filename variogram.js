function getDistance(point1, point2){
  //for two points, return euclidean distance
  let xDistance = point2["x"] - point1["x"];
  let yDistance = point2["y"] - point1["y"];
  let distance = Math.sqrt(Math.pow(xDistance,2) + Math.pow(yDistance,2));
  return distance;
}

function getVariance(point1, point2){
  //for two points, return semivariance
  let difference = point2["value"] - point1["value"]
  let variance = Math.pow(difference,2);
  let semivariance = variance / 2;
  return semivariance;
}

function calculateVariogram(data, lagDistance, numberOfLags){
  //data: json object with keys for x, y, and value
  //lagDistance: length of each bin
  //numberOfLags: max number of lags to use
  //returns list of json objects:
  //[{lagNumber, lagDistance, semivariance}...]
  distanceMap = []
  //for each data point:
  //map distance and variance to all other data points
  function getDistancesForPoint(point){
      function getDistanceAndVariance(x,point){
        let distance = getDistance(x,point);
        let variance = getVariance(x,point);
        return [distance,variance];
      }
      let distances = data.map(x=>getDistanceAndVariance(x,point));
      return distances;
    }
  function reduceForLag(accumulator, value){
      return accumulator + value[1];
    }
  //get all distances and variances
  let pointResults = data.map(x => getDistancesForPoint(x));
  //flatten list
  let flatList = [].concat.apply([],pointResults);
  //for each lag:
  output = []
  for (let i = 1; i <= numberOfLags; i++){
    //filter pointResults to within lag
    let filtered = flatList.filter(element => element[0] > (i-1) * lagDistance && element[0] <= i * lagDistance);
    let valueCount = filtered.length;
    //reduce distance map and add to results
    let reduced = filtered.reduce(reduceForLag, 0);
    let results = {"lagNumber":i,"lagDistance":i*lagDistance,"semivariance":reduced/valueCount};
    output.push(results);
  }
  //prepare for plotting
  let plotOutput = {"lagNumber":[],"lagDistance":[],"semivariance":[]};
  output.forEach(function(item, index, array){
    plotOutput["lagNumber"].push(item["lagNumber"]);
    plotOutput["lagDistance"].push(item["lagDistance"]);
    plotOutput["semivariance"].push(item["semivariance"]);
  })
  return plotOutput;
}

//console.log(calculateVariogram(testData, 50, 5))
function loadData(string){
  let dataObject = []
  let stringArray = string.split(/\r\n/);
  let dataArray = stringArray.map(x=>x.split(","))
  dataArray.forEach(element => dataObject.push({"x":element[0],"y":element[1],"value":element[2]}))
  variogramDisplay.updatePoints(dataObject.slice(1))
}

function makeMapFromPoints(points){
  //return {"x":[...],"y":[...],"value":[...]}
  function assignValues(element){
    xList.push(element["x"]);
    yList.push(element["y"]);
    valueList.push(element["value"]);
  }
  xList = []
  yList = []
  valueList = []
  points.forEach(assignValues);
  return {"x":xList,"y":yList,"value":valueList}
}

document.querySelector("#read-button").addEventListener('click', function(){
  let file = document.querySelector("#file-input").files[0];
  let reader = new FileReader();
  reader.addEventListener('load', function(e){
    let text = e.target.result;
    loadData(text);
  })
  reader.readAsText(file);
})


var variogramDisplay = new Vue({
  el: "#appDisplay",
  data: {
    pointData: [{"x":0,"y":0,"value":0}],
    mapData: {"x":[0],"y":[0],"value":[10]},
    lagDistance: 0,
    numberOfLags: 0,
    results: {"numberOfLags":0,"lagDistance":0,"semivariance":0}
  },
  methods: {
    updateLag: function (){
      let results = calculateVariogram(this.pointData,this.lagDistance, this.numberOfLags)
      this.results = results
      renderPlot(results)
  },
    updatePoints: function (newPoints){
      this.pointData = newPoints;
      this.mapData = makeMapFromPoints(newPoints);
      renderMap(this.mapData)
      this.updateLag;
    }
}
})

function renderPlot(data){
  let plotData = {
    x: data["lagDistance"],
    y: data["semivariance"]
  };
  divPlot = document.getElementById('plotDiv');
  Plotly.newPlot(divPlot,[plotData])
}

function renderMap(data){
  let plotData = {
    x: data["x"],
    y: data["y"],
    mode: 'markers',
    marker: {
      size:2,
      color:data["value"]
    }
  };
  divPlot = document.getElementById('mapDiv');
  Plotly.newPlot(divPlot,[plotData])
}
