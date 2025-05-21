(function ($){
    var latest_time = null;
    $(document).ready(function(){
        setInterval(refresh_chart, 60000);

        var kp_chart;
        var chart_height;

        var linkTarget = "";
        var lightBoxSizeElement = "";

        $(window).on('resize', function() {
            if($("#planetary_k_index").width() < 720){
                chart_height = 360;
            }else{
                chart_height = 500;
            }
            kp_chart.setSize($("#planetary_k_index").width(), chart_height);

            if($("#planetary_k_index").width() < 600){
                kp_chart.update({
                    plotOptions: {
                        series: {
                            minPointLength: 3,
                            //pointWidth: 15,
                            pointWidth: undefined,
                            groupPadding: 0.05,
                            pointPadding: 0,
                        },
                        column: {
                            pointPlacement: 'between',
                        }
                    }
                });
            }
        });

        if($("#planetary_k_index").width() < 720){
            chart_height = 360;
        }else{
            chart_height = 500;
        }

        function syncExtremes(e){
            var thisChart = this.chart;
            if (e.trigger !== 'syncExtremes') { // Prevent feedback loop
                Highcharts.each(Highcharts.charts, function (chart) {
                    if (chart !== thisChart) {
                        if (chart.xAxis[0].setExtremes) {
                            var max = null;
                            var min = null;
                            var maxTimeObject = new Date();
                            max = maxTimeObject.valueOf() -
                                maxTimeObject.getMinutes() * 60000 -
                                maxTimeObject.getSeconds() * 1000 -
                                maxTimeObject.getMilliseconds() +
                                3600000;
                            max = max - maxTimeObject.getUTCHours() * 3600000 + 82800000;
                            min = max - 4320 * 60000;

                            this.chart.xAxis[0].setExtremes(min, max, undefined, false, {trigger: 'syncExtremes'});

                                              //set the subtitle with the min time value
                            this.chart.setTitle(null, {
                                                        text: '<b>Begin:</b> '+ new Date(min).toUTCString(),
                                useHTML: true,
                            });
                        }

                    }
                });
            }
        }

    //kp chart
        $.getJSON("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json", function(data){
            var items = [];
            $.each( data, function( key, val ) {
                if(val[0] != "time_tag"){
                    time_tag = val[0].replace(" ","T") +"Z";
                    items.push([Date.parse(time_tag), parseFloat(val[1])]);

                }
            });

            kp_latest_time_tag = Date.parse(data[data.length -1][0].replace(" ","T")+"Z");

            if(!latest_time){
                latest_time = kp_latest_time_tag;

            }
            if(kp_latest_time_tag > latest_time){

                latest_time = kp_latest_time_tag;

            }
            $("#planetary_k_index_updated_time").text(new Date(latest_time).toISOString());

            kp_object = {name: "Estimated Planetary K index (3 hour data)", data: items, type: "column", unit: null,  valueDecimals: 2}

            var chartDiv = document.getElementById("planetary_k_index");

            kp_chart = Highcharts.chart(chartDiv, {
                chart: {
                    backgroundColor: '#000000',
                    height: chart_height,
                    events:
                    {
                        click: function ()
                        {
                            toggleFullScreen(this);
                        }
                    }
                },
                title: {
                    text: kp_object.name,
                    align: 'center',
                    floating: false,
                    x:0,
                    style:{
                        "fontSize": "16px"
                    }
                },
                legend: {
                    enabled: false,
                },
                plotOptions: {
                    series: {
                        minPointLength: 3,
                        pointWidth: undefined,
                        //pointWidth: 38
                        groupPadding: 0.05,
                        pointPadding: 0,
                    },
                    column: {
                        pointPlacement: 'between',
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
                        color: "black"
                    }
                },

                xAxis: {
                    dateTimeLabelFormats:{
                        hour: '%H:%M',
                        day: '%b %e',
                    },
                    reversed: false,
                    lineWidth: 1,
                    events: {
                        setExtremes: syncExtremes
                    },
                    type: 'datetime',
                    title:{
                        text: "Universal Time"
                    },
                    //tickInterval is set in milliseconds ((24 * 3600 * 1000) / 8)
                    tickInterval: 10800000,
                    //minortick interval is set at day boundary
                    minorTickInterval: 24*3600*1000,
		            minorGridLineWidth: 2,
                    gridLineWidth: 0,
                },
                yAxis: [{ //primary axis
                    title: {
                        text: "Kp index",
                    },
                    style: {
                        fontSize: '18px',
                    },
                    opposite: false,
                    lineWidth: 2,
                    min:0,
                    max:9,
                    tickInterval: 1,
                    useHTML: false
                    },{ //secondary axis
                    title: {
                        text: '',
                    },
                    opposite: true,
                    min:0,
                    max:9,
                    tickInterval: 1,
                    useHTML: true
                }],

                exporting: {
                    enabled: true
                },
                tooltip: {
                    useHTML: true,
                    formatter: function ()
                    {
                        var dt = new Date(this.x);
                        var date = new Date(this.x).toISOString().replace("T", " ");
                        var date_plus3h = new Date(dt.setHours(dt.getHours() + 3)).toISOString().replace("T", " ");
                        var s = '<b>' + date + ' to ' + date_plus3h + '</b>';
                        s += '<br/><b><span style="color:' + this.point.color + '">&#9679;</span> ' + this.series.name + '</b>: ' + this.y;
                        return s;
                    },
                },
                series: [{
                    data: kp_object.data,
                    name: kp_object.name,
                    type: kp_object.type,
                    zones: [{
                        // <=4.33 green
                        value: 4.34,
                        color: '#92D050'
                    },{
                        // <=5.33 yellow
                        value: 5.34,
                        color: '#F6EB14'
                    },{
                        // <=6.33 light orange
                        value: 6.34,
                        color: '#FFC800'
                    },{
                        // <=7.33 international orange
                        value: 7.34,
                        color: '#FF9600'
                    },{
                        // <= 8.67 red (note: this is an exception to the other range sizes)
                        value: 8.68,
                        color: '#FF0000'
                    },{
                        // <= 9.0 dark red
                        value: 9.01,
                        color: '#C80000'
                    }],
                }],
                responsive:{
                    rules:[{
                        condition:{
                            maxWidth: 720
                        }
                    }],
                    chart:{
                        animation:false
                    },

                }
            }, function(kp_chart){
                var max = null;
                var min = null;
                var chart_height;

                var maxTimeObject = new Date();
                max = maxTimeObject.valueOf() -
                    maxTimeObject.getMinutes() * 60000 -
                    maxTimeObject.getSeconds() * 1000 -
                    maxTimeObject.getMilliseconds() +
                    3600000;
                max = max - maxTimeObject.getUTCHours() * 3600000 + 82800000;
                min = max - 4320 * 60000;

                kp_chart.xAxis[0].setExtremes(min, max, undefined, false, {trigger: 'syncExtremes'});

                //set the subtitle with the min time value
                kp_chart.setTitle(null,{
                                      text: '<b>Begin:</b> '+ new Date(min).toUTCString(),
                                useHTML: true,
                                  });

                if($("#planetary_k_index").width() < 720){
                    chart_height = 360;
                }else{
                    chart_height = 500;
                }
                kp_chart.setSize($("#planetary_k_index").width(), chart_height);
                var chart_width = $("#planetary_k_index").width();

                if($("#planetary_k_index").width() < 600){
                    kp_chart.update({
                        plotOptions: {
                            series: {
                                minPointLength: 3,
                                //pointWidth: 15,
                                pointWidth: undefined,
                                groupPadding: 0.05,
                                pointPadding: 0,
                            },
                            column: {
                                pointPlacement: 'between',
                            }
                        }
                    });
                }

            });
        });

        function toggleFullScreen(){
            is_full_screen = toggleImgLightBox($('#planetary_k_index_container'));

            if(is_full_screen){
                kp_chart.reflow();
                kp_chart.setSize($("#planetary_k_index").width(), 500);
            }else{
                kp_chart.reflow();
                kp_chart.setSize($("#planetary_k_index").width(), 360);
            }
        }

        //This function will toggle an image or animation in or out of lightbox mode
        //lightBoxImg argument is an image object in the DOM
        function toggleImgLightBox(lightBoxImg){
            is_full_screen = false;
            //in a div of class lightbox, just remove the parent div
            if (jQuery('#lightBox').length) {
                is_full_screen = false;
                lightBoxImg.unwrap();
            }
            //Not an animation, not in a div of lightbox, wrap the img in a lightBox div
            else{
                is_full_screen = true;
                lightBoxImg.wrap("<div id='lightBox'></div>");
            }
            lightBoxSizeElement = lightBoxImg;
            toggleLightBoxCommon(lightBoxImg);

            //return false to cancel the click event downstream
            return is_full_screen;
        }

        function toggleLightBoxCommon(lightBoxElement){
            if (jQuery('#lightBox').length){
                //remove scroll bars for the page
                jQuery("body").css("overflow","hidden");
                checkTooTall();
                jQuery(lightBoxElement).attr('title', 'Click to exit full screen');
            }
            //The image was just taken out of lighbox, add scroll bars back
            else{
                //add back the scroll bars for the page
                jQuery("body").css("overflow","auto");
                jQuery(lightBoxSizeElement).removeClass("tooTall");
                jQuery(lightBoxElement).attr('title', 'Click to view full screen');
            }

            //If the image was just put in a lightbox, and is embedded in a link, get rid
            //of the link and assume the link is to the product page.
            //Will add the product page link text to the lightbox in a later version
            if (jQuery('#lightBox').parent('a').length) {
                linkTarget = jQuery('#lightBox').parent('a').attr('href');
                jQuery('#lightBox').unwrap();
            }

            //If there is no <a> tag wrapping the image, but a linkTarget is set, the image
            //has just been removed from a lightbox, put the wrapping link back
            else if (linkTarget) {
                lightBoxElement.wrap("<a href=\"" + linkTarget + "\"></a>");
                linkTarget="";
            }

        }

        function checkTooTall() {
            if (!jQuery('#lightBox').length){
                return;
            }

            if(jQuery(window).height() < lightBoxSizeElement.height() ){
                jQuery(lightBoxSizeElement).addClass("tooTall");
            }else{
                jQuery(lightBoxSizeElement).removeClass("tooTall");
            }
        }
       
    });

    var refresh_chart = function(){
        refresh_kp_data();
    };

    var refresh_kp_data = function(){
        var kp_chart = $("#planetary_k_index").highcharts();

        $.getJSON("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json", function(data){
            var items = [];
            $.each( data, function( key, val ) {
                if(val[0] != "time_tag"){
                    time_tag = val[0].replace(" ","T") +"Z";
                    items.push([Date.parse(time_tag), parseFloat(val[1])]);
                }
            });
            kp_chart.series[0].update({
                data: items
            });
            //update latest update time
            kp_latest_time_tag = Date.parse(data[data.length -1][0].replace(" ","T")+"Z");
            if(!latest_time){
                latest_time = kp_latest_time_tag;
            };
            if(kp_latest_time_tag > latest_time){
                latest_time = kp_latest_time_tag;
            };
            $("#planetary_k_index_updated_time").text(new Date(latest_time).toISOString());
        });
    };

})(jQuery);