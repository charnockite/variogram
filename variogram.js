
let DEV_MODE = false;

if (DEV_MODE){
  module.exports = [getDistance,getAzimuth,getVariance,
  getDistancesForPoint,filterDistances, getDistanceMapForDataset,
  getVariogramForPoints, chunkDataAndGetResults, reduceResults,
  preparePlotData,
  variogramByMapReduce, getSampleVarianceForDataset];
}

function getSampleVarianceForDataset(samples){
  //dataset [{"x":0,"y":0,"value":0}...] -> number
  //get n
  n = samples.length;
  //get mean
  function reducer(acc, value){
    console.log(value)
    console.log(value["value"])
     return acc + (value["value"]/n);
  };
  let mean = samples.reduce(reducer, 0);
  //subtract mean from all samples and square
  let squaredDiff = samples.map(x=> Math.pow((x["value"]-mean),2))
  //sum and divide by number of samples - 1
  let sum = squaredDiff.reduce((acc,value)=> acc+value,0)
  let variance = sum/(n-1)
  return variance;
};

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

function getAzimuth(point1, point2){
  //for two points, calculate azimuth of line between them
  let m = Math.atan((point2["y"] - point1["y"]) / (point2["x"] - point1["x"]));
  let angleFromX = m * 180 / Math.PI;
  if (angleFromX < 90){
    angleDegrees = 90 - angleFromX;
  } else {
    angleDegrees = 450 - angleFromX;
  }
  return angleDegrees;
}

function getDistancesForPoint(point, dataset){
    //point, whole dataset -> [ [distance,variance, azimuth],...]
    function getDistanceAndVariance(x,point){
      let distance = getDistance(x,point);
      let variance = getVariance(x,point);
      let azimuth = getAzimuth(x,point);
      //console.log(`Point1: ${x["x"]},${x["y"]}, Point2: ${point["x"]},${point["y"]}: ${[distance, variance, azimuth]}`)
      return [distance,variance,azimuth];
    }
    let distances = dataset.map(x=>getDistanceAndVariance(x,point));
    return distances;
}

function filterDistances(data, azimuth, tolerance){
  function angleBetweenAzimuths(azimuth1, azimuth2){
    let difference = Math.abs(azimuth2 - azimuth1);
    let minorAngle;
    if (difference > 180){
      minorAngle = 360 - difference;
      } else {
        minorAngle = difference;
      }
      if (minorAngle > 90){
        return 180 - minorAngle;
      } else {
        return minorAngle;
      }
    }

    return data.filter(element => (angleBetweenAzimuths(element[2],azimuth) <= tolerance))
  }

function getDistanceMapForDataset(chunkData, data, chunkMinimumInDataset){
  //get all distances and variances
  //map on chunkData
  let pointResults = chunkData.map(function (currentValue, index){
    //get only pairs for the chunk data and forward in main dataset
    //add chunkMinimum to index to get actual index of chunk entry in main dataset
    //deal with only pairs from that index forward to prevent duplicates
    return getDistancesForPoint(currentValue, data.slice(chunkMinimumInDataset + index))
  });
  //flatten list
  let flatList = [].concat.apply([],pointResults);
  return flatList;
}

function getVariogramForPoints(inputPoints, lag, lagDistance, azimuth, tolerance){
  //list of points -> [{"lagNumber":int,"lagDistance":num, "semivariance":num,"count":int}...]
  function reduceForLag(accumulator, value){
      return accumulator + value[1];
    }
  output = []
  //filter by distance
  let distanceFiltered = inputPoints.filter(element => ((element[0] > ((lag-1) * lagDistance)) && (element[0] <= (lag * lagDistance))));
  //filter by azimuth and tolerance
  //let azimuthFiltered = filterDistances(distanceFiltered, azimuth, tolerance);
  let azimuthFiltered = distanceFiltered
  //weight semivariance by count
  let valueCount = azimuthFiltered.length;
  //reduce
  let reduced = azimuthFiltered.reduce(reduceForLag, 0);
  //parse results into variogram point
  let results = {"lagNumber":lag,"lagDistance":lagDistance * lag,"semivariance":reduced/valueCount, "count":valueCount};
  return results
}

function chunkDataAndGetResults(dataset, lagDistance, numberOfLags, azimuth, tolerance, chunkSize){
  //processes dataset in chunks of max chunkSize (number of elements)
  let resultsSet = []
  //for each chunk in dataset:
  let numberOfChunks = Math.ceil(dataset.length / chunkSize);
  for (i = 0; i < numberOfChunks; i++){
    let chunkLimit;
    //check if at end of array
    if ((i+1) * chunkSize > dataset.length){
      //partial chunk, set limit to end of array
      chunkLimit = dataset.length;
    } else {
      //full chunk
      chunkLimit = (i + 1) * chunkSize;
    }
    let chunkData = dataset.slice(i * chunkSize, chunkLimit);
    let distanceMap = getDistanceMapForDataset(chunkData, dataset, i * chunkSize);
    //get data for each lag
    for (let j = 1; j <= numberOfLags; j++){
      let results = getVariogramForPoints(distanceMap, j, lagDistance, azimuth, tolerance);
      resultsSet.push(results);
    }
  }
  return resultsSet
}

function reduceResults(acc, resultsForLag){
    //add weighted results average for lag to accumulator for lag
    let key = String(resultsForLag["lagNumber"])
    if (!acc[key]){
      acc[key] = {"count":0,"semivariance":0}
    }
    if (resultsForLag["count"] == 0){
      //no results to accumulate
      return acc
    } else {
      if (acc[key]["semivariance"] == 0){
        //no data yet, use results
        acc[key]["semivariance"] = resultsForLag["semivariance"]
      } else {
        //get semivariances weighted by count and sum
        acc[key]["semivariance"] = (
          acc[key]["semivariance"] * acc[key]["count"] +
          resultsForLag["semivariance"] * resultsForLag["count"])
          /(resultsForLag["count"] + acc[key]["count"]
        );
      }
      acc[key]["count"] = acc[key]["count"] + resultsForLag["count"];
      return acc
    }
}
function preparePlotData(variogram){
  //prepare for plotting
  let plotOutput = {"lagNumber":[],"lagDistance":[],"semivariance":[],"countPerLag":[]};
  for (const [key,value] of Object.entries(variogram)){
    plotOutput["lagNumber"].push(key);
    plotOutput["lagDistance"].push(value["lagDistance"]);
    plotOutput["semivariance"].push(value["semivariance"]);
    plotOutput["countPerLag"].push(value["count"])
  }
  return plotOutput;
}

function variogramByMapReduce(dataset, lagDistance, numberOfLags, azimuth, tolerance, chunkSize){
  let resultsSet = chunkDataAndGetResults(dataset, lagDistance, numberOfLags, azimuth, tolerance, chunkSize);
  //reduce results list by weighted average for all lags

  let accumulator = {}
  for (i=1;i <= numberOfLags;i++){
    accumulator[String(i)] = {"lagDistance":i*lagDistance,"count":0,"semivariance":0}
  }
  let output = resultsSet.reduce(reduceResults, accumulator);
  return output;
}
//testing
//console.log(calculateVariogram(testDataBig, 50, 5, 0, 5))
//let point1 = {"x":50,"y":-50,"value":"50"}
//let point2 = {"x":-60,"y":80,"value":"10"}
//console.log(getAzimuth(point1,point2))

function calculateVariogram(data, lagDistance, numberOfLags, azimuth, tolerance){
  //data: json object with keys for x, y, and value
  //lagDistance: length of each bin
  //numberOfLags: max number of lags to use
  //returns list of json objects:
  //[{lagNumber, lagDistance, semivariance}...]
  //for each data point:
  //map distance and variance to all other data points
  let chunkSize = 500;
  //validate input
  dummyData = {"x":[],"y":[],"value":[]}
  if (data.size == 0 || lagDistance < 0 || numberOfLags < 0 || azimuth > 360 || azimuth < 0 || tolerance > 360){
      return dummyData;
  }
  let output = variogramByMapReduce(data, lagDistance, numberOfLags, azimuth, tolerance,chunkSize)
  let plotOutput = preparePlotData(output)
  return plotOutput;
}

function loadData(string){
  let dataObject = []
  const regex = /\r/;
  let filteredArray = string.replace(regex, '')
  let stringArray = string.split(/\n/);
  let dataArray = stringArray.map(x=>x.split(","))
  //check for empty values
  let filtered = dataArray.filter(element => (typeof element[0] !== 'undefined' && typeof element[1] !== 'undefined' && typeof element[2] !== 'undefined'))
  filtered.forEach(element => dataObject.push({"x":element[0],"y":element[1],"value":element[2]}))
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
    azimuth: 0,
    tolerance: 360,
    results: {"numberOfLags":0,"lagDistance":0,"semivariance":0,"countPerLag":0},
    sillVariance : 0,
    modelRange: 0,
    modelSill: 0,
    modelNugget: 0,
    modelVariogram: {"lagDistance":0,"modelSemivariances":0},
    hasModel: false
  },
  methods: {
    updateLag: function (){
      let results = calculateVariogram(this.pointData,this.lagDistance, this.numberOfLags, this.azimuth, this.tolerance)
      this.results = results
      this.sillVariance = getSampleVarianceForDataset(this.pointData)
      this.modelSill = this.sillVariance
      results["sillVariance"] = this.sillVariance
      renderPlot(results)
      renderHistogram(results)
  },
    updatePoints: function (newPoints){
      this.pointData = newPoints;
      this.mapData = makeMapFromPoints(newPoints);
      renderMap(this.mapData)
      this.updateLag;
  },
    calculateModelVariogram: function(){
      //plots model variogram
      function variogramModel(lagDistance, nugget, range, sill){
        //return semivariance for lagDistance
        let semivariance = sill;
        if (lagDistance <= range){
          //havent reached range yet
          //calculate semivariance
          let structureVariance = sill - nugget;
          let secondTerm = structureVariance*((1.5 * (lagDistance/range)) - (0.5 * (Math.pow((lagDistance/range),3))))
          semivariance = nugget + secondTerm;
        } else {
          //past range, semivar = nugget + sill
          semivariance = sill;
        }
        return semivariance
      }
    let lagDistances = this.results["lagDistance"];
    let modelSemivariances = lagDistances.map(lagDistance => variogramModel(Number(lagDistance), Number(this.modelNugget), Number(this.modelRange),Number(this.modelSill)));
    //add nugget
    lagDistances = [0].concat(lagDistances)
    modelSemivariances = [Number(this.modelNugget)].concat(modelSemivariances)
    this.modelVariogram= {"lagDistance":lagDistances,"modelSemivariances":modelSemivariances};
    this.hasModel = true
  },
    updateModel: function(){
      this.calculateModelVariogram();
      renderPlotAndModel(this.results, this.modelVariogram);
    }
  }
})


function renderPlot(data){
  let plotData = [{
    x: data["lagDistance"],
    y: data["semivariance"],
    mode:'markers',
    type:'scatter'
  }];

  //get furthest lag
  let xmax = data["lagDistance"][data["lagDistance"].length - 1]
  let ymax = data["semivariance"][data["semivariance"].length -1]
  let layout = {
    margin:{t:25,l:25,r:25,b:25},
    xaxis: {range : [-1,xmax*1.1]},
    yaxis: {range: [-0.05, ymax*1.1]},
    shapes: [
      {
        type: 'line',
        xref: 'paper',
        x0: 0,
        y0: data["sillVariance"],
        x1: 1,
        y1: data["sillVariance"],
        line:{
          color: 'green',
          width: 1,
          dash:'dash'
        }
      }
    ]
  }
  let config = {responsive: true}
  divPlot = document.getElementById('plotDiv');
  Plotly.newPlot(divPlot, plotData, layout, config)
}

function renderPlotAndModel(data, modelVariogram){

  let empData = [{
    x: data["lagDistance"],
    y: data["semivariance"],
    name:'Experimental variogram',
    mode:'markers',
    type:'scatter'}
  ]
    //add series for the model
  var modelTrace = {
    x: modelVariogram["lagDistance"],
    y: modelVariogram["modelSemivariances"],
    name:'Model variogram',
    type: 'scatter'}

  let plotData = empData.concat([modelTrace])
  console.log(plotData)
  //get furthest lag
  let xmax = data["lagDistance"][data["lagDistance"].length - 1]
  let layout = {
    margin:{t:25,l:25,r:25,b:25},
    xaxis: {range : [-1,xmax]},
    legend:{
      yanchor:"bottom",
      y:0.01,
      xanchor:"right",
      x:0.99
    },
    shapes: [
      {
        name: 'Sample variance',
        type: 'line',
        xref: 'paper',
        x0: 0,
        y0: data["sillVariance"],
        x1: 1,
        y1: data["sillVariance"],
        line:{
          color: 'green',
          width: 1,
          dash:'dash'
        }
      }
    ]
  }
  let config = {responsive: true}
  divPlot = document.getElementById('plotDiv');
  Plotly.newPlot(divPlot, plotData, layout, config)
}

function renderHistogram(data){
  let histogramData = {
    x: data["lagDistance"],
    y: data["countPerLag"],
    type:'bar'
  }
  let layout = {margin:{t:30,l:30,r:30,b:30}}
  let config = {responsive: true}
  divPlot = document.getElementById('histoDiv');
  Plotly.newPlot(divPlot,[histogramData], layout, config)
}

function renderMap(data){
  let plotData = {
    x: data["x"],
    y: data["y"],
    mode: 'markers',
    marker: {
      size:4,
      color:data["value"]
    }
  }
  let layout = {margin:{t:30,l:30,r:30,b:30}}
  let config = {responsive: true}
  divPlot = document.getElementById('mapDiv');
  Plotly.newPlot(divPlot,[plotData],layout,config)
}
