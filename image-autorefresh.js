//set refresh interval in ms
var reloadTime = 60001;
var autoRefreshImages = [];

//When the document is ready, wait for the refresh interval and run the reloader
jQuery(document).ready(function() {
  jQuery( "img.autorefresh" ).each(function( index ) {
    autoRefreshImages[index] = new AutoRefreshImage(index, 0, 0, jQuery(this));
  });

  // If we have auto refresh images kick off the reloadWorker
  if (autoRefreshImages.length > 0) {
    setTimeout(reloadWorker, reloadTime);
  }
});

// AutoRefreshImage object constructor
function AutoRefreshImage(index, lastModTime, priorLastModTime, jQueryImage) {
  // the index used to distinguish multiple AutoRefreshImage's on a page
  this.index = index;
  this.lastModTime = lastModTime;
  this.priorLastModTime = priorLastModTime;
  this.jQueryImage = jQueryImage;
  // The XMLHttpRequest object
  this.req = null;
}

function reloadWorker() {
  var currentPageImages = []; // Holds updated list of images

  //iterate over all image tags with the autorefresh class
  for(var i = 0; i < autoRefreshImages.length; ++i) {
    // Ignore image elements that have been removed
    var imageElement = jQuery("img[src='" + autoRefreshImages[i].jQueryImage[0].src + "']");
    if (imageElement.length > 0) {
      autoRefreshImages[i].req = new XMLHttpRequest();
      // We need to save the autoRefreshImage object as a new property here otherwise there's no way to retrieve
      // the source URL in IE in the readyStateChange callback and it's non-standard across browsers
      autoRefreshImages[i].req.autoRefreshImage = autoRefreshImages[i];

      //strip any existing anchors from the image url
      sourceUrl = autoRefreshImages[i].jQueryImage[0].src.replace(/\?.*$/,'');

      autoRefreshImages[i].req.open("HEAD", sourceUrl, true);
      autoRefreshImages[i].req.onreadystatechange = autoRefreshImages[i].readyStateChange;
      autoRefreshImages[i].req.send();

      currentPageImages.push(autoRefreshImages[i]);
    }
  }
  // Throw out removed images
  autoRefreshImages = currentPageImages;

  if (autoRefreshImages.length > 0) {
    // call the reloader again on the refresh interval
    setTimeout(reloadWorker, reloadTime);
  }
}

AutoRefreshImage.prototype.readyStateChange = function() {
  var image = this.autoRefreshImage;

  // Internet Explorer will hang at this state for 2 minutes before proceeding to state 4, but aborting "fixes" the issue
  // and doesn't break Chrome
  if (image != null && image.req.readyState === 2 && image.req.status == 200) {
    if (image.alterImageTag(image)) {
      image.req.abort();
    }
  }
}

// If a new image is available, replace the img src url on the page with the
// image plus a query string argument with last modified file time
// (e.g. image.png&time=1367615515626)
// This will cause the browser to reload, rather than using cached version
// Browser will load image name without the ?... section
AutoRefreshImage.prototype.alterImageTag = function(image) {
  var lastModString = image.req.getResponseHeader('Last-Modified');

  if (lastModString != null) {
    image.lastModTime = Date.parse(lastModString);

    if (image.lastModTime > 0 && (image.lastModTime > image.priorLastModTime || image.jQueryImage[0].src.indexOf("?time=") == -1)) {
      //strip any existing anchors from the image url
      sourceUrl = image.jQueryImage[0].src.replace(/\?.*$/,'');

      image.jQueryImage.attr("src", sourceUrl + "?time=" + image.lastModTime);
      image.priorLastModTime = image.lastModTime;
    }
    return true;
  }
  else {
    return false;
  }
}
