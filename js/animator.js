// animator.js:  Image loop animation routine
// Author:  NOAA/NWS Space Weather Prediction Center, August, 2014.

// Ensure backwards compatibility with older versions of ie, firefox, chrome, and safari, use:
// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

//Start of SWPC Animation routine
//wrap everything in jquery for the drupal namespace's benefit
(function ($) {

var dwell = 500; // Default dwell for pausing on last frame
var delay = 100; //set a default delay between images in the loop (tenth of second)
var reloadInterval = 60001;  //set default check for new images interval (just over 1 minute)
var animators = [];   //array of animation objects
var useCanvas = 'yes';  //use canvas for animations?

$(document).ready(function() {

  //get the data service URL from the div (in the noaa scales block)
  dataServiceUrl = $('#dataservice_url').text();

  // if it's an experimental page, add it to the path
  if ($('#experimental-page').length > 0) {
    dataServiceUrl += "/experimental";
  }

  // Loop through all divs of class animation on the page and create animate
  // objects for each of them.
  $("div.animation").each(function(index) {

    //create a unique id for each outer animate div object so we can find it later
    var animateDivId = "animate" + index; // e.g. animate0
    //give the animation div (the outermost div) a unique id, e.g. animate0
    $(this).attr('id', animateDivId);

    //add the loop controls div and buttons with a class of the animate id
    $(this).append('<div class="animationToolbar">'
                 + '<button name="startButton" class="animationButton loadButton startButton play" value="pause" type="button" title="play or pause the animation" style="display: none;"></button>'
                 + '<div class="animationToolbarSlider"></div>'
                 + '</div>');

    //add the progressbar html - jQuery progressbar is created in the animation constructor
    $(this).append('<div class="progressBar"></div>');
    $(this).children('div.progressBar').hide();

    //if an autoStart input element exists and has value yes, then autostart.
    if($(this).children('input.autoStart').val() && $(this).children('input.autoStart').val().toLowerCase() == "yes"){
      var autoStart = "yes";
    }
    else {
      var autoStart = "no";
      var loadHandler = function(){
        loadLoop(index);}
      $(this).children('div.animationToolbar').children('button.loadButton').click(loadHandler); // The load button has been clicked
    }

    $(this).children('div.animationToolbar').children('button.startButton').click(function(){
      // The play/pause button has been pressed
      playpause(index); // we want to cancel (on pause) or restart (on play) an existing autoupdate here
    });

    //if a frameDelay input element exists, use the frameDelay it specifies,
    //otherwise use the default defined above, likewise with dwell and useCanvas
    if($(this).children("input.frameDelay").val()){
      var frameDelay = $(this).children("input.frameDelay").val();
    }
    else {
      var frameDelay = delay;
    }

    if($(this).children("input.dwell").val()){
      var dwellTime = $(this).children("input.dwell").val();
    }
    else {
      var dwellTime = dwell;
    }

    if($(this).children("input.useCanvas").val()){
      // This must be a local variable as it applies only to the current animation
      var canvas = $(this).children("input.useCanvas").val();
    }else{
      var canvas = useCanvas;
    }
    
    var originalImage = $(this).children('img');    
    $(originalImage).attr('title', 'Click to view full screen');
    $(originalImage).click(function() {
      toggleAnimationLightBox(this);
    });          
    
    

    //Create a new animator object with its sourceURL (from its input element
    //in the DOM) and index (computed), add it to the array of animator objects.
    //This will create the jQuery controls and kick off the download and animate process (if autostart)
    animators[index] = new Animator(index, $(this).children("input.sourceUrls").val(), $(this).children("input.dataServiceURL").val(), autoStart, frameDelay, dwellTime, canvas, loadHandler);

  });

});

//Animator object constructor.  Takes the unique identifier for this animation
//and the sourceUrl, which is a json object with a list of frames.
function Animator(index, sourceUrl, dataServiceURL, autoStart, frameDelay, dwellTime, useCanvas, loadHandler) {
  // the index used to distinguish multiple animations on a page
  this.index = index;
  //sourceUrl, should be to a json object with a list of frames
  this.sourceUrl = sourceUrl;
  //data service url, each frame url should be relative to this
  if (typeof dataServiceURL !== 'undefined'){
    dataServiceUrl = dataServiceURL
  }
  this.dataServiceURL = dataServiceUrl;
  //id, should be unique, e.g. animate0
  this.id = 'animate' + index;
  //whether to autostart the loop or not
  this.autoStart = autoStart;
  //the delay between frames (controls loop speed)
  this.frameDelay = frameDelay;
  // Time to pause on final frame
  this.dwellTime = dwellTime;
  //Use canvas or img based animation?
  this.useCanvas = useCanvas;
  //initialize images array to empty
  this.images = [];
  //initialize flag for "is the animation currently playing"
  this.playing = 0;
  //initialize the reload loop timeout/interval id to null
  this.reloadInterval_id = null;
  this.reloadInterval = reloadInterval;
  //current frame should be -1 so that it can be iterated before being displayed
  this.currentFrame = -1;
  //initialize frame count to 0
  this.numFrames = 0;
  //keep track of the load event handler (so it can be unbound once the loop is loaded)
  this.loadHandler = loadHandler;
  //initialize the time that the last frame played to 0 (epoch)
  this.lastFramePlayed = 0;
  //initialize jsonData to empty
  this.jsonData = "{}";

  //make a copy of the this reference for use inside of the function
  var animatorObject = this;

  

  // Create the slider with event definitions
  $('#' + animatorObject.id).children('div.animationToolbar').children('div.animationToolbarSlider').slider({
    value:0, // Starting position
    min: 0,
    step: 1,
    disabled: true,
    slide: function( event, ui ) {
      // Change the image to match the frame selected by the slider - images are already loaded if this fires
      if (animatorObject.useCanvas == "no") {
        $('#' + animatorObject.id).children("img").attr("src", animatorObject.images[ui.value].src);
      }else{
        drawImageOnCanvas($('#' + animatorObject.id).children("canvas.animationCanvas")[0], animatorObject.images[ui.value]);
      }
      animatorObject.currentFrame = ui.value; // this assures that if we slide to a new frame pressing play will resume there
    }
  });

  // Create the jQuery progress bar
  $('#' + animatorObject.id).children('div.progressBar').progressbar({
    enabled: true,
    value: 0,
    max: 100
  });
  
  if (this.autoStart != "no") {
    //download image list from sourceURL and use the images
    this.loadLoop();
  }
}

//Animator object method loadLoop.  Performs actions on load, such as replacing
//the image with a canvas.  Calls populateImages to get all frames and play the
//animation.
Animator.prototype.loadLoop= function(){  
  if (this.useCanvas != "no") {
    //make a copy of the this reference for use inside of the jquery functions
    var animatorObject = this;
    var originalImage = $('#' + animatorObject.id).children('img');
    // Replace the "latest" image with a canvas      
    originalImage.replaceWith('<canvas class="animationCanvas"></canvas>');

    // Draw the latest image on the new canvas
    replaceImageWithCanvas($('#' + animatorObject.id).children('canvas.animationCanvas')[0], originalImage.attr('src'));
    $('#' + animatorObject.id).children('canvas.animationCanvas').attr('title', 'Click to view full screen');
    $('#' + animatorObject.id).children('canvas.animationCanvas').click(function() {
      toggleAnimationLightBox(this);
    });     
    
  }
  
  this.populateImages();
};

//Animator object method populateImages.  Download the json list of images
Animator.prototype.populateImages = function(){
  //make a copy of the this reference for use inside of the jquery functions
  var animatorObject = this;

  //Download the json object containing the image URLS.
	$.getJSON(this.sourceUrl, {})
  .done(function(data) {
    //When the json download is done:
    jsonString = JSON.stringify(data);
    //Check to make sure the jsonData has changed and is not empty. Skip loading if either of these
    if(jsonString == animatorObject.jsonData || !data ){
      return;
    }
    //console.log("reloading loop");
    //store the json object as a string for comparison next time
    animatorObject.jsonData = jsonString;
    //pause the animation during load
    animatorObject.pause();

    // Disable the slider during loads
    $('#' + animatorObject.id).children('div.animationToolbar').children('div.animationToolbarSlider').slider("option", "disabled", true);

    $('#' + animatorObject.id + ' button.animationButton').prop("disabled",true);

    //reset images array and number of frames, allows for reloading of animation
    animatorObject.numFrames = 0;
    animatorObject.currentFrame = -1;
    animatorObject.images = [];
    var items = [];

    //loop through each image in the json and add it to the items array
    $.each(data, function(key, val) {
      items.push(dataServiceUrl + val['url']);
    });

    //Go download the images
    animatorObject.loadImages(items);
	})
	.fail(function() {
    //If the animation can't be loaded for some reason, log the error
	//	console.log("Failed to load the animation data.");
	});
}

//Animator object method loadImages.  Download the images in the array passed as an argument
Animator.prototype.loadImages = function(items){
  
  //store the total frame count (length of passed array)
  this.numFrames = items.length;
  //initialize the count of loaded images to 0
  this.imageCounter = 0;

  //make a copy of the this reference for use inside of the jquery functions
  var animatorObject = this;
  //initialize the width of the progress bar to 0
  $('#' + this.id).children('div.progressBar').progressbar('option', 'value', 0);
  //show the progress bar
  $('#' + this.id).children('div.progressBar').show();

  //Loop through all of the frames in the items array
	for (i = 0; i < this.numFrames; i++) {
    //create a new image object in the images array
		this.images[i] = new Image();
    //set the src of the image object
    this.images[i].src = new URL(items[i], "https://services.swpc.noaa.gov").href;
		// this.images[i].src = items[i];
    console.log("ITEM", items[i]);
    console.log("IMAGE.SRC", this.images[i].src);

    //when the image is loaded
		this.images[i].onload=function() {
			//call isLoaded to check the progress of the load
      animatorObject.isLoaded();
		};

    //when the image load encounters an error
    this.images[i].onerror=function(){
      //log the error to the console
      //console.log("Error loading image: " + this.src);
      //set the src of the image to the blank "loading" background
      this.src= Drupal.settings.basePath + "sites/all/themes/swx/images/missing-frame.png";
      //check the status of the load
      animatorObject.isLoaded();
    };
	};

  // Set the max range value and set position to 0 for the slider now that we have all of the frames
  $('#' + this.id).children('div.animationToolbar').children('div.animationToolbarSlider').slider("value", 0);
  $('#' + this.id).children('div.animationToolbar').children('div.animationToolbarSlider').slider("option", "max", animatorObject.numFrames - 1);
}

//Animator object method isLoaded.  Checks to see if the loop is loaded.  Updates the
//progress bar, and if all images have been loaded/errored, start the animation
Animator.prototype.isLoaded = function(){

  //count the image
  this.imageCounter++;
  //update the progress bar with the percent of images loaded.
  $('#' + this.id).children('div.progressBar').progressbar('option', 'value', Math.round(this.imageCounter / this.numFrames * 100));

  //if all images have been loaded
  if(this.imageCounter == this.numFrames){
    if ($('#' + this.id).find(".startButton").hasClass('loadButton')) {
      $('#' + this.id).find(".startButton").removeClass('loadButton');
    }
    //begin playing the loop
    this.play();

    // Enable the slider (it is disabled initially and on image reload)
    $('#' + this.id).children('div.animationToolbar').children('div.animationToolbarSlider').slider("option", "disabled", false);

    $('#' + this.id + ' button.animationButton').prop("disabled",false);
  }
}

//Animator object method play.  Starts playing the loop if it is not yet playing
Animator.prototype.play = function(){
	//if the animation is not currently playing, and the button isn't pretending to be a loadbutton
  if(!this.playing && !($('#' + this.id).find(".startButton").hasClass('loadButton'))){
    //hide the download progress bar
    $('#' + this.id).children('div.progressBar').hide();
    //make a copy of the this reference for use inside of the setInterval function
    var animatorObject = this;
    //tell the animator object it is playing
    this.playing = 1;
    $("#animate" + this.index + " button.animationButton").toggleClass("pause");
    //Start the animation loop
    requestAnimationFrame(this.loop.bind(this));

    //start the auto update process (polls json for new images)
    if (this.reloadInterval_id == null) {
      this.reloadInterval_id = setInterval(function(){
        animatorObject.populateImages() }, animatorObject.reloadInterval);
    }
	}
}

//Animator object method pause.  Pause the loop if it is currently playing
Animator.prototype.pause = function(){
  //if the animation is currently playing
  if(this.playing){
    //stop the auto update process (don't refresh the images while paused)
    if (this.reloadInterval_id != null) {
      //cancel the autoupdate
      clearInterval(this.reloadInterval_id);
      //clear the reloadInterval_id
      this.reloadInterval_id=null;
    }
    //tell the animation it is no longer playing
    this.playing = 0;
    $("#animate" + this.index + " button.animationButton").toggleClass("pause");
	}
}

//Animator object method nextFrame.  Show the next frame of the loop.
Animator.prototype.nextFrame = function(){
  //iterate the frame number
  this.currentFrame++;
  //If this should be the first frame, loop the index back to 0
  if(this.currentFrame == this.numFrames){
    this.currentFrame = 0;
  }

  /*if (this.currentFrame > this.numFrames) {
    console.log("currentFrame: ", this.currentFrame, " has surpassed numFrames: ", this.numFrames)
  }*/

  if (this.useCanvas != "no") {
  // Set the image to the next frame
    drawImageOnCanvas($('#' + this.id).children("canvas.animationCanvas")[0], this.images[this.currentFrame]);
  }
  else{
    // Set the image to the next frame
    $('#' + this.id).children("img").attr("src", this.images[this.currentFrame].src);
  }

  // "Move" the slider to the next frame
  $('#' + this.id).children("div.animationToolbar").children("div.animationToolbarSlider").slider("value", this.currentFrame);

}

//loadLoop runs when the button is clicked (not used for autostart animations).
//Calls the prototype function loadLoop on the animate object to do the actual loading
function loadLoop(index) {  
  $('#' + animators[index].id).children('div.animationToolbar').children('button.loadButton').unbind("click",animators[index].loadHandler); //unbind load event from the button
  animators[index].loadLoop();
}

//Play or pause the loop depending upon whether it is currently playing or
//paused.  Takes the id of the loop to play or pause, which is used as the index
//into the array of animator objects
function playpause(index){

  //Is the loop currently playing?
  if(animators[index].playing){
    //pause it
    animators[index].pause();
  }
  //otherwise, the loop is paused
  else{
    //play it
    animators[index].play();
  }
}

// If it's the first time called, we're loading the "latest" image and need to set dimensions that won't change
// for subsequent image loads. We set these here because we must be sure the image is loaded before using
// its dimensions, otherwise intermittent gliches occur
function replaceImageWithCanvas(canvas, imageSource) {

  var context = canvas.getContext('2d');
  var imageObj = new Image();

  if (typeof imageSource === 'string' && imageSource.trim() !== '') {
    imageObj.src = imageSource;
  }
  // "https://services.swpc.noaa.gov/images/animations/"
  //once the original image is loaded, replace it with a canvas element of the same height and width
  imageObj.onload = function() {
    canvas.height = imageObj.naturalHeight;
    canvas.width = imageObj.naturalWidth;

    $(canvas).css("max-width",imageObj.naturalWidth);
    $(canvas).parent('div.animation').children('div.animationToolbar').css('maxWidth', imageObj.naturalWidth);
    $(canvas).parent('div.animation').children('div.progressBar').css('maxWidth', imageObj.naturalWidth);
    context.drawImage(imageObj,0,0);
  }

  imageObj.onerror = function () {
    console.warn("Image not found:", imageSource);
  };
}

// render an image on a canvas
function drawImageOnCanvas(canvas, imageObj) {
  var context = canvas.getContext('2d');
  context.drawImage(imageObj,0,0);
}

//Use request animation frame to loop through the images.  This helps with
//performance, cpu usage, and battery life on mobile platforms
Animator.prototype.loop = function(timestamp){

  var delay = this.frameDelay;

  //if this is the last frame
  if(this.currentFrame == this.numFrames - 1){
    //use the dwellTime for the frame delay instead of the normal frameDelay
    delay = this.dwellTime;
  }

  //if the time elapsed since the last frame was rendered is at least the
  //frameDelay (in ms), render the next frame
  if(timestamp - this.lastFramePlayed >= delay){
    this.lastFramePlayed = timestamp;
    this.nextFrame();
  }
  //keep requesting frames unless something has paused the animation
  if(this.playing){
    requestAnimationFrame(this.loop.bind(this));
  }
}

//wrap everythign in jquery for the drupal namespace's benefit
})(jQuery);
