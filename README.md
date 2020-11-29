# variogram
Single page web app for visualizing experimental variograms
## Usage
Use the browse button to select a csv file (it isn't actually uploaded, everything is running locally in your browser).
Input file must be of the form:
|x|y|value|
|-|-|-----|
|data|data|data|
|...|...|...|

where value is the element you are interested in visualizing.
## Plots
### Map
Shows x,y and colored points by element. Currently using a scatter plot so you'll have to drag to make it a square if you want to estimate azimuths visually.
### Experimental variogram
The variogram based on the current lag count, lag distance, principal azimuth and tolerance value.
### Histogram
Shows count of values by lag distance.
## Inputs
### Azimuth
The principal azimuth direction to search (degrees from north, assuming y value is northing).
### Tolerance
The tolerance around the principal azimuth for which to capture samples. Currently a simple angle, so tolerance 0 means pairs must lie on a line with exactly the chosen azimuth, 45 means they can be +/- 45 degrees away from the azimuth.
![tolerance](https://github.com/charnockite/variogram/blob/main/tolerance.png)  
Blue points not in variogram, red points in variogram.
### Number of lags
Number of lags to calculate variogram for.
### Lag distance
In the units used in the x and y values.
