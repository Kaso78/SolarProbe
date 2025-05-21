"use strict";
(function ($)
{

  var goesCharts = [];
  const configUrl = '/config.json';
  var USE_PUBLIC_DATA_SERVICE = false;
  var isDrupal = false;
  var DATA_SERVICE_URL = "";  
  var light_or_dark_default = "dark";
  var DEFAULT_DURATION = 1440;
  const RESPONSIVE_WIDTH = 800;

  var GOES_SERVICE_URL = "";
  const refreshIntervals = {
    360: 1,
    1440: 1,
    4320: 5,
    10080: 5
  }
  const durationStrings = {
    360: "6-hour",
    1440: "1-day",
    4320: "3-day",
    10080: "7-day"
  }

  const colors = {
    'background':
    {
      'light': "white",
      'dark': "black"
    },
    'contrast':
    {
      'light': "black",
      'dark': "white"
    },
    'title':
    {
      'light': "#333333",
      'dark': "#ffffff"
    },
    'minor':
    {
      'light': "#666666",
      'dark': "#ffffff"
    },
    'deactivated':
    {
      'light': "#cccccc",
      'dark': "#5b5b5b"
    },
  }

  $(document).ready(function ()
  {
    getConfigAndFindCharts();
  });

  function getConfigAndFindCharts()
  {
    var data_service_url = $('#dataservice_url')[0];
    if (data_service_url)
    {
      USE_PUBLIC_DATA_SERVICE = true;
      isDrupal = true;
      //get the data service URL from the div (in the noaa scales block)
      DATA_SERVICE_URL = $(data_service_url).text();
      light_or_dark_default = "light";
      DEFAULT_DURATION = 4320;
      findCharts();
    }
    else
    {
      // //use local data service, with config from the node.js container
      // $.getJSON(configUrl, function (data)
      // {
      //   GOES_SERVICE_URL = data.GOES_SERVICE_ADDRESS;
      //   //setPrimarySecondaryFromQueryString();
      //   findCharts();
      // });
      // salta il config.json e imposta direttamente il servizio
      GOES_SERVICE_URL = "https://services.swpc.noaa.gov";
      findCharts();
    }
  }

  function findCharts()
  {

    // Loop through all divs of class swpc-highcharts on the page and create plots
    $("div.swpc-highcharts").each(function (index)
    {

      //create a unique id for each outer animate div object
      var highchartsDivId = "swpc-hicharts-" + index; // e.g. animate0
      //give the animation div (the outermost div) a unique id, e.g. animate0
      $(this).attr('id', highchartsDivId);
      //build this chart
      goesCharts[index] = new GOESChart(highchartsDivId, index);

    });
  }

  function GOESChart(highchartsDivId, index)
  {
    var GOESChartObject = this;
    this.id = highchartsDivId;
    this.index = index;
    this.experimental = false;
    this.duration = DEFAULT_DURATION; //chart data duration in minutes
    this.customRange = false;
    this.dataGroupingMax = false;
    this.stickyTimeAxis = true;
    this.firstTime;
    this.lastTime;
    this.begin_date_object;
    this.reloadTimer;
    this.endDateTime = false;
    this.customZoom = false;
    this.fullscreen = false;
    this.enableYZoom = false;    
    this.warningLatencyMinutes = 5;
    this.criticalLatencyMinutes = 10;
    this.light_or_dark = light_or_dark_default;
    this.satelliteNumbers = [];
    this.plotBandIds = [];
    this.plotLineIds = [];
    this.plotMNLineIds = [];

    var paramData = getUrlParameter('data');
    if(paramData) {
      this.chartConfig = JSON.parse(paramData);
    }else{
      // get configuration for this chart from the data-chart-config attribute of this div
      this.chartConfig = $('#' + highchartsDivId).data("chart-config");
    }
    
    if ('color-mode' in this.chartConfig)
    {
      this.light_or_dark = this.chartConfig['color-mode'];
    }
    if ('duration' in this.chartConfig)
    {
      this.duration = this.chartConfig['duration'];
      if(!(this.duration in refreshIntervals)){
        this.customRange = true;
      }
    }
    if ('sticky-time-range' in this.chartConfig)
    {
      this.stickyTimeAxis = this.chartConfig['sticky-time-range'];
    }
    if ('experimental' in this.chartConfig)
    {
      this.experimental = this.chartConfig['experimental'];
    }
    if ('end-date-time' in this.chartConfig){
      this.endDateTime = this.chartConfig['end-date-time'];
      this.stickyTimeAxis = false;
    }
    if ('enable-y-zoom' in this.chartConfig)
    {
      this.enableYZoom = this.chartConfig['enable-y-zoom'];
    }
    if ('enable-data-grouping-max' in this.chartConfig)
    {
      this.dataGroupingMax = true;
    } 
    this.instrumentType = this.chartConfig['instrument-type'];
    this.chartObjectDefinition = getChartDefaults(this.instrumentType, GOESChartObject, this.light_or_dark);

    // get chart default highcharts configuration, and override/configure for this specific chart
    this.setupChart();
    this.chartObjectDefinition.chart.renderTo = highchartsDivId;
    this.chart = new Highcharts.StockChart(this.chartObjectDefinition);

    //Get data and plot it
    this.loadData();
  }

  GOESChart.prototype.setupChart = function ()
  {
    if (this.instrumentType == "xrays")
    {
      this.warningLatencyMinutes = 5;
      this.criticalLatencyMinutes = 10;
    }
    else if (this.instrumentType == "electrons")
    {
      this.warningLatencyMinutes = 15;
      this.criticalLatencyMinutes = 30;
    }
    else if (this.instrumentType == "integral-protons")
    {
      this.warningLatencyMinutes = 15;
      this.criticalLatencyMinutes = 30;
    }
    else if (this.instrumentType == "magnetometers")
    {
      this.warningLatencyMinutes = 5;
      this.criticalLatencyMinutes = 10;
    }

    var GOESChartObject = this;
    var numSatellites = this.chartConfig['satellites'].length;
    var numFields = this.chartConfig['fields'].length;

    //Set up the data series and json download options
    for (let satellite = 0; satellite < numSatellites; satellite++)
    {
      for (let field = 0; field < this.chartConfig['fields'].length; field++)
      {
        this.chartObjectDefinition.series.push(
        {
          name: this.chartConfig['fields'][field]['name'],
          id: satellite + '' + field,
          color: this.chartConfig['series-colors'][satellite * numFields + field][this.light_or_dark],
          gapSize: 1
        });
      }
      this.chartObjectDefinition.exporting.menuItemDefinitions['get' + this.chartConfig.satellites[satellite] + 'json'] = {
        onclick: function ()
        {
          download(getUrlForData(GOESChartObject.chartConfig.satellites[satellite], GOESChartObject.duration, GOESChartObject.instrumentType, GOESChartObject.experimental, GOESChartObject.endDateTime));
        },
        text: 'Download ' + this.chartConfig.satellites[satellite] + ' JSON'
      }
      this.chartObjectDefinition.exporting.buttons.contextButton.menuItems.push('get' + this.chartConfig.satellites[satellite] + 'json');
    }

    //Magnetometers need additional series for Arcjet flags
    if (this.instrumentType == 'magnetometers')
    {
      for (let satellite = 0; satellite < numSatellites; satellite++)
      {
        this.chartObjectDefinition.series.push(
        {
          name: 'Arcjet',
          type: 'line',
          id: 'arcjet' + satellite,
          color: "yellow",
          dashStyle: "ShortDash",
          gapSize: 1,
          linkedTo: satellite + '' + 0,
          dataGrouping:
          {
            enabled: false
          }
        });
        this.chartObjectDefinition.series.push(
        {
          type: 'flags',
          name: 'Arcjet Flags',
          onSeries: 'arcjet' + satellite,
          fillColor: "yellow",
          style:
          {
            color: "black"
          },
          shape: 'squarepin',
          linkedTo: satellite + '' + 0
        });
      }
    }

  }


  //Load data onto the plot, or refresh plot with current data
  GOESChart.prototype.loadData = function ()
  {
    var chartObject = this;
    var dataLoads = 0;
    var totalSeries = this.chartConfig['fields'].length;
    var totalSatellites = this.chartConfig['satellites'].length;
    if(!this.endDateTime && !this.customRange){
      chartObject.reloadTimer = setTimeout(function ()
      {
        chartObject.loadData();
      }, refreshIntervals[chartObject.duration] * 60000);
    }
    this.chartConfig['satellites'].forEach(function (satellite, satelliteIndex)
    {
      $.getJSON(getUrlForData(satellite, chartObject.duration, chartObject.instrumentType, chartObject.experimental, chartObject.endDateTime))
        .done(function (data)
        {
          let plotSeries = new GOESDataSeries(data, chartObject.instrumentType, chartObject.chartConfig['fields']);
          chartObject.chartConfig['fields'].forEach(function (field, seriesIndex)
          {
            let seriesNumber = satelliteIndex * totalSeries + seriesIndex;
            chartObject.chart.series[seriesNumber].setData(plotSeries.parsedData[seriesIndex], false);
            let latestValue = Number.parseFloat(chartObject.chart.series[seriesNumber].yData[chartObject.chart.series[seriesNumber].yData.length-1]).toPrecision(3);

            if (chartObject.instrumentType == "magnetometers")
            {
              chartObject.chart.series[seriesNumber].name = plotSeries.satelliteName + ' ' + field.name;
              chartObject.chart.series[totalSatellites + (satelliteIndex * 2)].setData(plotSeries.parsedData[1], false);
              chartObject.chart.series[totalSatellites + (satelliteIndex * 2)].name = plotSeries.satelliteName + ' Arcjet';
              chartObject.chart.series[totalSatellites + (satelliteIndex * 2) + 1].setData(plotSeries.parsedData[2], false);
              chartObject.chart.series[seriesNumber].latestValue = latestValue;
            }
            else
            {
              chartObject.chart.series[seriesNumber].update(
              {
                name: plotSeries.satelliteName + ' ' + field.name
              }, false);
              chartObject.chart.series[seriesNumber].latestValue = latestValue;
            }
          });
          if (satelliteIndex == 0)
          {
            setUpdatedSubtitle(chartObject.chart, plotSeries.latestTime[0], chartObject.light_or_dark, (chartObject.endDateTime || chartObject.customRange), chartObject.warningLatencyMinutes, chartObject.criticalLatencyMinutes);
            chartObject.firstTime = plotSeries.beginTime[0];
          }
          chartObject.satelliteNumbers[satelliteIndex] = plotSeries.satelliteNumber;
        })
        .always(function ()
        {
          dataLoads++;
          if (dataLoads == totalSatellites)
          {
            chartObject.renderChartUpdates();
            chartObject.plotMidnightLines();
            if (chartObject.instrumentType == "magnetometers" || chartObject.instrumentType == "electrons")
            {
              chartObject.plotSatelliteMidnightNoonLabels();
            }
          }
        });
    });
  }

  //Most chart updates are made with redraw=false, use setExtremes() to draw chart fitting current data series
  GOESChart.prototype.renderChartUpdates = function ()
  {
    
    if (this.customZoom)
    {
      this.chart.redraw();
    }
    else if (this.stickyTimeAxis)
    {
      var max = null;
      var min = null;
      var maxTimeObject = new Date();
      max = maxTimeObject.valueOf() -
        maxTimeObject.getMinutes() * 60000 -
        maxTimeObject.getSeconds() * 1000 -
        maxTimeObject.getMilliseconds() +
        3600000;
      if (this.duration > 360 && this.duration <= 1440)
      {
        max = max + (2 - (maxTimeObject.getUTCHours()) % 3) * 3600000;
      }
      if (this.duration > 1440)
      {
        max = max - maxTimeObject.getUTCHours() * 3600000 + 82800000;
      }
      min = max - this.duration * 60000;
      //this.begin_date_object = setBeginDateText(this.chart, min, this.begin_date_object, this.light_or_dark);
      this.chart.xAxis[0].setExtremes(min, max);
    }
    else
    {
      //this.begin_date_object = setBeginDateText(this.chart, this.firstTime, this.begin_date_object, this.light_or_dark);
      this.chart.xAxis[0].setExtremes();
    }
  }

  //Add lines to the chart for each midnight UTC
  GOESChart.prototype.plotMidnightLines = function ()
  {
    var plotLines = [];
    var plotLineIds = [];
    var chartObject = this;
    var extremes = chartObject.chart.xAxis[0].getExtremes();
    var minTime = extremes.dataMin;
    var maxTime = extremes.dataMax;
    var minTimeObject = new Date(minTime);
    var maxTimeObject = new Date(maxTime);
    var maxDay = maxTimeObject.valueOf() - maxTimeObject.getUTCHours() * 3600000 - maxTimeObject.getMinutes() * 60000 - maxTimeObject.getSeconds() * 1000 - maxTimeObject.getMilliseconds();
    var minDay = minTimeObject.valueOf() - minTimeObject.getUTCHours() * 3600000 - minTimeObject.getMinutes() * 60000;

    //find all midnights that are on the chart
    for (let d = minDay; d <= maxDay; d = d + 86400000)
    {
      if (d >= minTime && d <= maxTime)
      {
        plotLineIds.push(d);
        plotLines.push(
        {
          value: d,
          width: 1,
          color: "gray",
          id: d,
          zIndex: 1
        });
      }
    }

    //only remove and add plotlines if they've changed since the last redraw
    if (JSON.stringify(plotLineIds) != JSON.stringify(chartObject.plotLineIds))
    {
      for (var i = 0; i < chartObject.plotLineIds.length; i++)
      {
        chartObject.chart.xAxis[0].removePlotLine(chartObject.plotLineIds[i]);
      }
      for (var i = 0; i < plotLineIds.length; i++)
      {
        chartObject.chart.xAxis[0].addPlotLine(plotLines[i]);
      }
      chartObject.plotLineIds = plotLineIds;
    }
  }

  //Add satellite midnight and noon to the chart
  GOESChart.prototype.plotSatelliteMidnightNoonLabels = function ()
  {
    var longitudesURL = GOES_SERVICE_URL + "/sat_longitude";
    var chartObject = this;
    var plotBands = [];
    var plotBandIds = [];
    var plotMNLines = [];
    var plotMNLineIds = [];

    if (USE_PUBLIC_DATA_SERVICE)
    {
      longitudesURL = DATA_SERVICE_URL +
        "/json/goes/" +
        "satellite-longitudes.json";
    }
    //Get satellite longitudes from the data service
    $.getJSON(longitudesURL)
      .done(function (data)
      {
        var extremes = chartObject.chart.xAxis[0].getExtremes();
        var minTime = extremes.dataMin;
        var maxTime = extremes.dataMax;
        var minTimeObject = new Date(minTime);
        var maxTimeObject = new Date(maxTime);
        var maxDay = maxTimeObject.valueOf() - maxTimeObject.getUTCHours() * 3600000 - maxTimeObject.getMinutes() * 60000;
        var minDay = minTimeObject.valueOf() - minTimeObject.getUTCHours() * 3600000 - minTimeObject.getMinutes() * 60000;

        //find the longitude for each satellite on the chart
        for (let i = 0; i < chartObject.satelliteNumbers.length; i++)
        {
          $.each(data, function (l, longitudeRecord)
          {
            if (longitudeRecord.satellite == chartObject.satelliteNumbers[i])
            {
              let longitude = longitudeRecord.longitude;
              if (chartObject.instrumentType == "magnetometers")
              {
                chartObject.chart.series[i].name = chartObject.chart.series[i].name + ' (' + longitude + '°W)';
              }
              let midnightTimeHours = longitude / 15;
              //find all satellite Midnight and Noons within the chart domain                       
              for (let d = minDay; d <= maxDay; d = d + 86400000)
              {
                let todayMidnight = d + midnightTimeHours * 3600000;
                let todayNoon = todayMidnight + 43200000;

                if (todayMidnight >= minTime && todayMidnight <= maxTime)
                {
                  let bandId = chartObject.satelliteNumbers[i] + '' + todayMidnight;
                  plotBands.push(
                  {
                    from: todayMidnight,
                    to: todayMidnight,
                    color: colors['background'][chartObject.light_or_dark],
                    label:
                    {
                      text: 'M',
                      verticalAlign: 'top',
                      align: 'center',
                      style:
                      {
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: chartObject.chart.series[i].color
                      }
                    },
                    id: bandId
                  });
                  plotBandIds.push(bandId);
                }
                if (todayNoon >= minTime && todayNoon <= maxTime)
                {
                  let bandId = chartObject.satelliteNumbers[i] + '' + todayNoon;
                  plotBands.push(
                  {
                    from: todayNoon,
                    to: todayNoon,
                    color: colors['background'][chartObject.light_or_dark],
                    label:
                    {
                      text: 'N',
                      verticalAlign: 'top',
                      align: 'center',
                      style:
                      {
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: chartObject.chart.series[i].color
                      }
                    },
                    id: bandId
                  });
                  plotBandIds.push(bandId);                  
                }
                //Add Plot Lines for satellite midnight
                if(i == 0){
                  plotMNLineIds.push(maxDay);
                  plotMNLines.push(
                    {
                      value: todayMidnight,
                      width: 1,
                      color: "gray",
                      dashStyle: "dot",
                      id: maxDay,
                      zIndex: 1
                  });
                }
              }
            }
          });
        }
        //only remove and add MN plotlines if they've changed since the last redraw
        if (JSON.stringify(plotMNLineIds) != JSON.stringify(chartObject.plotMNLineIds))
        {
          for (var i = 0; i < chartObject.plotMNLineIds.length; i++)
          {
            chartObject.chart.xAxis[0].removePlotLine(chartObject.plotMNLineIds[i]);
          }
          for (var i = 0; i < plotMNLineIds.length; i++)
          {
            chartObject.chart.xAxis[0].addPlotLine(plotMNLines[i]);
          }
          chartObject.plotMNLineIds = plotMNLineIds;
        }
        //Only remove and add/re-add plot bands if they've changed since the last update
        if (JSON.stringify(plotBandIds) != JSON.stringify(chartObject.plotBandIds))
        {
          for (var i = 0; i < chartObject.plotBandIds.length; i++)
          {
            chartObject.chart.xAxis[0].removePlotBand(chartObject.plotBandIds[i]);
          }
          for (var i = 0; i < plotBandIds.length; i++)
          {
            chartObject.chart.xAxis[0].addPlotBand(plotBands[i]);
          }
          chartObject.plotBandIds = plotBandIds;
        }

      });

  }

  //If a duration button is clicked, change the duration and reload data
  GOESChart.prototype.changeDuration = function (newDuration)
  {
    this.duration = newDuration;
    clearTimeout(this.reloadTimer);
    this.loadData();
  }

  //Given a satellite, duration, and instrument type, return the URL for the data
  //either on the GOES service or the public data service
  function getUrlForData(satellite, duration, instrumentType, experimental, endDateTime)
  {

    if (USE_PUBLIC_DATA_SERVICE)
    {
      var experimental_path = "";
      if (instrumentType == 'protons' || instrumentType == 'electrons')
      {
        instrumentType = "integral-" + instrumentType;
      }
      if (instrumentType == 'protons')
      {
        instrumentType = intsrumentType + "-plot";
      }
      if(experimental)
      {
         experimental_path = '/experimental';
      }
      return DATA_SERVICE_URL + experimental_path +
        "/json/goes/" +
        satellite + "/" +
        instrumentType +
        "-" + durationStrings[duration] +
        ".json";

    }
    else
    {
      var endDateString = "";
      if (instrumentType == 'protons' || instrumentType == 'electrons')
      {
        instrumentType = "integral_" + instrumentType;
      }
      if(endDateTime){
        endDateString = "&end=" + endDateTime; 
      }
      
      return GOES_SERVICE_URL + "/" +
        instrumentType +
        "?satellite=" + satellite +
        "&minutes=" + duration + endDateString;
    }
  }

  //get URL Parameters
  function getUrlParameter(sParam)
  {
    var sPageURL = window.location.search.substring(1),
      sURLVariables = sPageURL.split('&'),
      sParameterName,
      i;

    for (i = 0; i < sURLVariables.length; i++)
    {
      sParameterName = sURLVariables[i].split('=');

      if (sParameterName[0] === sParam)
      {
        return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
      }
    }
  }

  //set updated timestamp on the plot, color coding if the data are getting late
  function setUpdatedSubtitle(chart, latestTimeMS, light_or_dark, disableAutoUpdate, warningLatencyMinutes, criticalLatencyMinutes)
  {

    var latestTime = new Date(latestTimeMS);
    var currentTime = new Date();
    var latencyInMinutes = (currentTime.getTime() - latestTime.getTime()) / 60000;
    if(disableAutoUpdate){
         chart.setTitle(null, {text: " (Auto-update disabled)", style : { textDecoration: 'none', color: 'gray', fontWeight: 'bold'}});
         return;        
     }
    var customSubtitle = " Updated \n" +
      latestTime.getUTCFullYear() + "-" +
      String(latestTime.getUTCMonth() + 1).padStart(2, '0') + "-" +
      String(latestTime.getUTCDate()).padStart(2, '0') + " " +
      String(latestTime.getUTCHours()).padStart(2, '0') + ":" +
      String(latestTime.getUTCMinutes()).padStart(2, '0') + " UTC ";
    if (latestTimeMS == 0)
    {
      customSubtitle = "███ NO DATA ███";
    }

    if (latencyInMinutes >= criticalLatencyMinutes)
    {
      chart.setTitle(null,
      {
        text: '███' + customSubtitle + '███',
        style:
        {
          textDecoration: 'underline overline',
          textShadow: '1px 1px black',
          color: 'red',
          fontWeight: 'bold'
        }
      });
    }
    else if (latencyInMinutes >= warningLatencyMinutes)
    {
      chart.setTitle(null,
      {
        text: '▒▒▒' + customSubtitle + '▒▒▒',
        style:
        {
          textDecoration: 'underline overline',
          textShadow: '1px 1px black',
          color: 'yellow',
          fontWeight: 'bold'
        }
      });
    }
    else
    {
      chart.setTitle(null,
      {
        text: customSubtitle,
        style:
        {
          textDecoration: 'none',
          textShadow: 'none',
          color: colors['contrast'][light_or_dark],
          fontWeight: 'bold'
        }
      });
    }
  }

  //set begin date timestamp on the plot
  // function setBeginDateText(chart, beginTimeMS, begin_date_object, light_or_dark)
  // {
  //   var beginTime = new Date(beginTimeMS);
  //   var beginDateSubtitle = "Begin: " +
  //     beginTime.getUTCFullYear() + "-" +
  //     String(beginTime.getUTCMonth() + 1).padStart(2, '0') + "-" +
  //     String(beginTime.getUTCDate()).padStart(2, '0') + " " +
  //     String(beginTime.getUTCHours()).padStart(2, '0') + ":" +
  //     String(beginTime.getUTCMinutes()).padStart(2, '0') + " UTC";

  //   if (!beginTimeMS)
  //   {
  //     beginDateSubtitle = "NO DATA";
  //   }

  //   if (begin_date_object != undefined)
  //   {
  //     begin_date_object.destroy();
  //   }
  //   // only show begin date timestamp if we're also plotting the title
  //   if (!('textStr' in chart.title))
  //   {
  //     return undefined;
  //   }
  //   return chart.renderer.text(beginDateSubtitle, 10, 20)
  //     .css(
  //     {
  //       color: colors['contrast'][light_or_dark],
  //       fontSize: '14px',
  //       fontWeight: 'bold'
  //     })
  //     .add();
  // }


  //Declaration for GOESDataSeries object, parses the json into the series to plot on the chart
  function GOESDataSeries(data, type, fields)
  {
    var GOESDataObject = this;
    GOESDataObject.instrumentType = type; // this.data = data;
    GOESDataObject.latestTime = [];
    GOESDataObject.beginTime = [];
    GOESDataObject.parsedData = [];
    var filterFieldName = false;
    var filterFieldStrings = [];

    // if there are multiple series in this json, build array that maps
    // the name and values of the filters to use to split the data
    $.each(fields, function (i, field)
    {
      GOESDataObject.parsedData[i] = [];
      GOESDataObject.latestTime[i] = 0;
      GOESDataObject.beginTime[i] = 0;
      if ('filter-field-name' in field)
      {
        filterFieldName = field['filter-field-name'];
        filterFieldStrings.push(field['filter-field-value']);
      }
      if (type == "magnetometers")
      {
        GOESDataObject.parsedData[1] = [];
        GOESDataObject.parsedData[2] = [];
      }
    });

    // If there's no data..
    if (data.length == 0)
    {
      GOESDataObject.satelliteName = "No Data";
      GOESDataObject.satelliteNumber = null;
      return;
    }

    GOESDataObject.satelliteName = "GOES-" + data[0].satellite;
    GOESDataObject.satelliteNumber = data[0].satellite;
    var seriesNumber = 0;
    $.each(data, function (i, value)
    {
      var time = Date.parse(value.time_tag);
      var seriesData = parseFloat(value[fields[0]['data-field']]);

      //don't push values that won't be plotted, as they'll still be averaged into data grouping (causing plot artifacts)
      if (type == 'xrays' && seriesData <= 0)
      {
        return;
      }
      //floor electrons below 4 pfu to 4 pfu
      if (type == 'electrons' && seriesData <= 4)
      {
        seriesData = 4;
      }
      if (filterFieldName)
      {
        seriesNumber = filterFieldStrings.indexOf(value[filterFieldName]);
      }
      if (seriesNumber >= 0)
      {

        //store first time in each series as begin time
        if (GOESDataObject.parsedData[seriesNumber].length == 0)
        {
          GOESDataObject.beginTime[seriesNumber] = time;
        }

        GOESDataObject.parsedData[seriesNumber].push([time, seriesData]);
        GOESDataObject.latestTime[seriesNumber] = time;
        //process arcjet flags
        if (type == 'magnetometers' && value["arcjet_flag"] == true)
        {

          if (data[i - 1] && data[i - 1].arcjet_flag == false)
          {
            GOESDataObject.parsedData[2].push(
            {
              x: time,
              title: "Arcjet Start"
            })
          }
          else if (data[i + 1] && data[i + 1].arcjet_flag == false)
          {
            GOESDataObject.parsedData[2].push(
            {
              x: time,
              title: "Arcjet End"
            })
          }
          else
          {
            GOESDataObject.parsedData[seriesNumber].pop();
          }
          GOESDataObject.parsedData[1].push([time, seriesData]);
        }
      }
    });
  }

  //Download the json used for the chart
  function download(url)
  {
    var element = document.createElement('a');
    element.download = url.split('/').pop();
    element.href = url;
    element.target = "_blank";
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  //Get default Highcharts Object Configuration
  function getChartDefaults(type, GOESChartObject, light_or_dark)
  {

    //set up yAxis defaults for each chart type, as some are logarithmic or have
    // unique labels
    var yAxis = [];
    var title = [];

    title['xrays'] = 'GOES X-Ray Flux (1-minute data)';
    title['electrons'] = 'GOES Electron Flux (5-minute data)';
    title['protons'] = 'GOES Proton Flux (5-minute data)';
    title['magnetometers'] = 'GOES Magnetometers (1-minute data)';

    yAxis['magnetometers'] = [
    {
      type: 'linear',
      opposite: false,
      tickLength: 5,
      tickPosition: "inside",
      tickWidth: "1",
      tickColor: colors['contrast'][light_or_dark],
      minorTickInterval: .1,
      minorTickLength: 4,
      minorTickPosition: "inside",
      minorTickWidth: "1",
      minorGridLineWidth: 0,
      showLastLabel: true,
      labels:
      {
        enabled: true,
        style:
        {
          fontSize: "18px",
          color: colors['minor'][light_or_dark]
        }
      },
      title:
      {
        enabled: true,
        text: 'NanoTesla (nT)',
        style:
        {
          fontSize: "18px",
          color: colors['minor'][light_or_dark]
        }
      },

    }];

    yAxis['protons'] = [
    {
      type: 'logarithmic',
      opposite: false,
      plotLines: [
      {
        id: "swpc_warning_threshold",
        value: 10,
        width: 2,
        color: 'red',
        dashStyle: 'shortdash',
        label:
        {
          text: "SWPC 10 MeV Warning Threshold",
          style:
          {
            "fontSize": "14px",
            "color": "red"
          },
        }
      }],
      tickInterval: 1,
      tickLength: 5,
      tickPosition: "inside",
      tickWidth: "1",
      tickColor: colors['contrast'][light_or_dark],
      minorTickInterval: .1,
      minorTickLength: 4,
      minorTickPosition: "inside",
      minorTickWidth: "1",
      minorGridLineWidth: 0,
      showLastLabel: true,
      max: 10000,
      min: 0.01,
      title:
      {
        enabled: true,
        text: 'Particles · cm⁻² · s⁻¹ · sr⁻¹',
        style:
        {
          fontSize: "18px",
          color: colors['minor'][light_or_dark]
        }
      },
      labels:
      {
        enabled: true,
        style:
        {
          "fontSize": "18px"
        },
        useHTML: true,
        formatter: function ()
        {
          return logLabels(this.value);
        },
        align: 'left',
        style:
        {
          fontSize: "18px",
          color: colors['minor'][light_or_dark]
        },
        reserveSpace: true
      }
    }];

    yAxis['electrons'] = [
    {
      type: 'logarithmic',
      opposite: false,
      plotLines: [
      {
        value: 1000,
        width: 3,
        color: 'red',
        dashStyle: 'shortdash',
        label:
        {
          text: "SWPC Alert Threshold",
          style:
          {
            "fontSize": "14px",
            color: 'red'
          },

        }
      }],
      tickInterval: 1,
      tickLength: 5,
      tickPosition: "inside",
      tickWidth: "1",
      tickColor: colors['contrast'][light_or_dark],
      minorTickInterval: .1,
      minorTickLength: 4,
      minorTickPosition: "inside",
      minorTickWidth: "1",
      minorGridLineWidth: 0,
      showLastLabel: true,
      max: 10000000,
      min: null,
      title:
      {
        enabled: true,
        text: 'Particles · cm⁻² · s⁻¹ · sr⁻¹',
        style:
        {
          fontSize: "18px",
          color: colors['minor'][light_or_dark]
        }
      },
      labels:
      {
        enabled: true,
        useHTML: true,
        formatter: function ()
        {
          return logLabels(this.value);
        },
        align: 'left',
        style:
        {
          fontSize: "18px",
          color: colors['minor'][light_or_dark]
        },
        reserveSpace: true
      },

    }];

    if (!isDrupal && type == "electrons" ){      
      yAxis['electrons'][0]['plotLines'].push({
        value: 50000,
        width: 3,
        color: 'red',
        dashStyle: 'shortdash',
        label:
        {
          text: "SWPC Alert Threshold (Very High)",
          style:
          {
            "fontSize": "14px",
            color: 'red'
          },
        }
      });
    }

    yAxis['xrays'] = [
    {
      type: 'logarithmic',
      opposite: false,
      plotLines: [
      {
        value: 0.00005,
        width: 2,
        color: 'red',
        dashStyle: 'shortdash',
        label:
        {
          text: "SWPC Warning Threshold",
          style:
          {
            color: colors['contrast'][light_or_dark]
          }
        }
      }],
      tickInterval: 1,
      tickLength: 5,
      tickPosition: "inside",
      tickWidth: "1",
      tickColor: colors['contrast'][light_or_dark],
      minorTickInterval: .1,
      minorTickLength: 4,
      minorTickPosition: "inside",
      minorTickWidth: "1",
      minorGridLineWidth: 0,
      showLastLabel: true,
      max: 0.01,
      min: 0.000000001,
      title:
      {
        enabled: true,
        text: 'Watts · m⁻²',
        style:
        {
          fontSize: "18px",
          color: colors['minor'][light_or_dark]
        }
      },
      labels:
      {
        enabled: true,
        useHTML: true,
        formatter: function ()
        {
          return logLabels(this.value);
        },
        align: 'left',
        style:
        {
          fontSize: "18px",
          color: colors['minor'][light_or_dark]
        },
        reserveSpace: true
      },

      plotBands: [
      {
        from: .00000001,
        to: .0000001,
        color: colors['background'][light_or_dark],
        label:
        {
          align: "right",
          x: 15,
          text: "A",
          style:
          {
            fontWeight: 'bold',
            fontFamily: 'monospace',
            fontSize: '14px',
            color: colors['contrast'][light_or_dark]
          }
        },
      },
      {
        from: .0000001,
        to: .000001,
        color: colors['background'][light_or_dark],
        label:
        {
          align: "right",
          x: 15,
          text: "B",
          style:
          {
            fontWeight: 'bold',
            fontFamily: 'monospace',
            fontSize: '14px',
            color: colors['contrast'][light_or_dark]
          }
        },
      },
      {
        from: .000001,
        to: .00001,
        color: colors['background'][light_or_dark],
        label:
        {
          align: "right",
          x: 15,
          text: "C",
          style:
          {
            fontWeight: 'bold',
            fontFamily: 'monospace',
            fontSize: '14px',
            color: colors['contrast'][light_or_dark]
          }
        },
      },
      {
        from: .00001,
        to: .0001,
        color: colors['background'][light_or_dark],
        label:
        {
          align: "right",
          x: 15,
          text: "M",
          style:
          {
            fontWeight: 'bold',
            fontFamily: 'monospace',
            fontSize: '14px',
            color: colors['contrast'][light_or_dark]
          }
        },
      },
      {
        from: .0001,
        to: .001,
        color: colors['background'][light_or_dark],
        label:
        {
          align: "right",
          x: 15,
          text: "X",
          style:
          {
            fontWeight: 'bold',
            fontFamily: 'monospace',
            fontSize: '14px',
            color: colors['contrast'][light_or_dark]
          }
        },
      }]
    },
    {
      opposite: true,
      offset: 15,
      title:
      {
        text: 'Xray Flare Class',
        style:
        {
          fontSize: "18px",
          color: colors['contrast'][light_or_dark],
          padding: '5px'
        }
      }
    }];


    var chartJSON = {
      chart:
      {
        renderTo: 'container',
        zoomType: 'x',
        resetZoomButton:
        {
          position: {
            x: 0,
            y: -33
          }
        },
        marginRight: 50,
        panKey: 'ctrl',
        type: 'line',
        animation: false,
        plotBorderColor: '#d3dded',
        plotBorderWidth: 1,
        backgroundColor: colors['background'][light_or_dark],
        events:
        {
          click: function ()
          {
            toggleFullScreen(GOESChartObject);
          }
        }
      },

      series: [],

      navigator:
      {
        enabled: false
      },

      scrollbar:
      {
        enabled: false
      },

      plotOptions:
      {
        series:
        {
          connectNulls: false,
          animation: false,
          label:
          {
            connectorAllowed: false
          },
          dataGrouping:
          {
            enabled: false
          },
          states:
          {
            hover:
            {
              enabled: false
            },
            inactive:
            {
              opacity: 1
            }
          }
        }
      },

      title:
      {
        text: title[type],
        style:
        {
          fontSize: "22px",
          color: colors['contrast'][light_or_dark]
        }
      },

      subtitle:
      {
        text: "Loading Data...",
        align: "left",
        verticalAlign: "bottom",
        floating: true,
        y: 27,
        style:
        {
          fontSize: "14px",
          color: colors['minor'][light_or_dark]
        }
      },

      credits:
      {
        enabled: true,
        text: 'Space Weather Prediction Center',
        href: 'http://www.swpc.noaa.gov',
        style:
        {
          fontSize: '15px',
          color: colors['contrast'][light_or_dark]
        }
      },

      rangeSelector:
      {
        allButtonsEnabled: true,
        buttons: [
        {
          type: 'hour',
          count: 6,
          text: '6 Hour',
          events:
          {
            click: function ()
            {
              GOESChartObject.changeDuration(360);
            }
          }
        },
        {
          type: 'day',
          count: 1,
          text: '1 Day',
          events:
          {
            click: function ()
            {
              GOESChartObject.changeDuration(1440);
            }
          }
        },
        {
          type: 'day',
          count: 3,
          text: '3 Day',
          events:
          {
            click: function ()
            {
              GOESChartObject.changeDuration(4320)
            }
          }
        },
        {
          type: 'day',
          count: 7,
          text: '7 Day',
          events:
          {
            click: function ()
            {
              GOESChartObject.changeDuration(10080);
            }
          }
        }],
        buttonSpacing: 1,
        inputEnabled: false,
        buttonTheme:
        {
          height: 20,
          width: 50,
          style:
          {
            color: 'black'
          },

        }
      },

      exporting:
      {
        sourceWidth: 1200,
        sourceHeight: 675,
        scale: 1,
        libURL: '/sites/all/libraries/highcharts',
        menuItemDefinitions:
        {
          'toggleFullScreen':
          {
            onclick: function ()
            {
              toggleFullScreen(GOESChartObject);
            },
            text: "Toggle Full Screen"
          }
        },
        buttons:
        {
          contextButton:
          {
            menuItems: ['toggleFullScreen', 'printChart', 'downloadPNG', 'downloadPDF', 'downloadSVG']
          }
        }
      },

      xAxis: [
      {
        type: 'datetime',
        ordinal: false, //Allows gaps in data to be present without changing x-axis
        tickPosition: "inside",
        maxPadding: 0,
        minPadding: 0,
        minorTickInterval: "auto",
        minorTickLength: 4,
        minorTickPosition: "inside",
        minorTickWidth: "1",
        minorGridLineWidth: 0,
        dateTimeLabelFormats:{
          hour: '%H:%M',
          day: '%H:%M<br>%b %e',
        },
        labels:
        {
          align: 'center',
          overflow: 'allow',
          style:
          {
            fontSize: "18px",
            color: colors['minor'][light_or_dark]            
          }
          
        },
        title:
        {
          text: 'Universal Time',
          style:
          {
            fontSize: "18px",
            color: colors['minor'][light_or_dark]
          }
        },
        events:
        {
          afterSetExtremes: function (event)
          {
            if (event.trigger != 'zoom')
            {
              GOESChartObject.customZoom = false;
            }
            else
            {
              GOESChartObject.customZoom = true;
            }
          }
        }
      },
      {
        top: '0%',
        height: '0%',
        offset: 0,
        linkedTo: 0,
        tickPosition: 'outside',
        minorTickInterval: "auto",
        minorTickLength: 4,
        minorTickPosition: "outside",
        minorTickWidth: 1,
        minorGridLineWidth: 0,
        labels:
        {
          enabled: false
        }

      }],
      //use yAxis defined above for this series type
      yAxis: yAxis[type],
      tooltip:
      {
        shared: true,
        crosshairs: true,
        split: false,
        formatter: function ()
        {
          var date = new Date(this.x).toISOString().replace("T", " ");
          var s = '<b>' + date + '</b>';
          $.each(this.points, function ()
          {
            var yVal = this.y.toPrecision(3);
            //Checks to see if value is less thatn 10^-2 and then changes to exponential notation
            if(yVal != 0 && yVal.toString().match("0.00")){
              yVal = parseFloat(yVal).toExponential();
            }
            s += '<br/><b><span style="color:' + this.point.color + '">●</span> ' + this.series.name + '</b>: ' + yVal;
          });
          return s;
        },
        animation: false,
        useHTML: true,
      },

      legend:
      {
        enabled: true,
        labelFormatter: function ()
        {
          if(this.latestValue && !isDrupal){
            return this.name + ": " + this.latestValue;
          }
          else{
            return this.name;
          }
        },
        itemStyle:
        {
          fontSize: "14px",
          color: colors['title'][light_or_dark]
        },
        itemHiddenStyle:
        {
          color: colors['deactivated'][light_or_dark]
        },
        itemHoverStyle:
        {
          color: colors['deactivated'][light_or_dark]
        }
      }
      
    };

    if (isDrupal)
    {
      chartJSON.chart.height = '50%';
      chartJSON.responsive = {
        rules: [
        {
          condition:
          {
            maxWidth: 800
          },
          chartOptions:
          {
            chart:
            {
              height: '100%',
              marginRight: undefined
            },
            legend:
            {
              enabled: false
            },
            title:
            {
              text: undefined
            },
            rangeSelector:
            {
              buttonTheme:
              {
                height: 20,
                width: 30,
                style:
                {
                  color: 'black',
                  fontSize: '10px'
                }
              }
            },
            subtitle:
            {              
              style:
              {
                fontSize: "10px"             
              },
              y: 23
            },                        
            yAxis: [
            {
              labels:
              {
                enabled: false
              },
              title:
              {
                enabled: false
              }
            },
            {
              title:
              {
                enabled: false
              }
            }],
            xAxis: [
            {
              labels:
              {
                y: 0,
                overflow: 'justify',
                style:
                {
                  fontSize: "12px"
                }                
              },
              dateTimeLabelFormats:{
                hour: '%H:%M',
                day: '%b %e',
              },
              title:
              {
                text: null
              }
            }],
            credits:
            {
              enabled: false
            }
          }
        }]
      }
      chartJSON.plotOptions.series.dataGrouping = {enabled: true, approximation: "high"};
    }
    if (GOESChartObject.customRange){
      chartJSON.rangeSelector.enabled = false;
    }
    if(GOESChartObject.enableYZoom){
      chartJSON.chart.zoomType = 'xy';
    }
    if (GOESChartObject.dataGroupingMax){
      chartJSON.plotOptions.series.dataGrouping = {enabled: true, approximation: "high"};
    }
    
    return chartJSON;

  }

  //format labels on logarithmic axes
  function logLabels(value)
  {
    var powerOfTen;
    powerOfTen = value.toExponential();
    if (powerOfTen.substring(0, 2) === '1e')
    {
      powerOfTen = powerOfTen.slice(-2);
      powerOfTen = powerOfTen.replace('+', '');
      powerOfTen = "10<sup>" + powerOfTen + "</sup>";
    }
    return powerOfTen;
  }

  function toggleFullScreen(GOESChartObject){
    toggleImgLightBox($('#' + GOESChartObject.id));
    //todo: this does a great fullscreen on drupal, but goes back 
    // to the wrong height when unfullscreened, and isn't responsive.        
    // if(GOESChartObject.fullscreen){
    //   GOESChartObject.chart.setSize(null, null, false);
    //   GOESChartObject.fullscreen = false;
    // }else{
    //   GOESChartObject.chart.setSize(window.innerWidth, window.innerHeight, false);
      
    //   GOESChartObject.fullscreen = true;
    // }
    GOESChartObject.chart.reflow();
    //Workaround for https://github.com/highcharts/highcharts/issues/13220
    GOESChartObject.chart.pointer.chartPosition = null;
  }

  //wrap everythign in jquery to define $
})(jQuery);
