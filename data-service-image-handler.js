var linkTarget = "";
var lightBoxSizeElement = "";
jQuery(document).ready(function() {  

  //Get Data service url from DOM (embedded by NOAA scales)
  dataservice_url = jQuery("#dataservice_url").html();  
  
  //loop through each image and make it lightBoxAble if:
  //   1.  It contains the dataservice url (is a data service resource)
  //   2.  Is not of class thumbnail (exclude sxi thumbnails)
  //   3.  Is not an animation (no parent div of class animation), those are handled by animator.js
  jQuery( "img" ).each(function( index ) {
    if ((jQuery(this).attr('src').indexOf(dataservice_url) > -1) && (! jQuery(this).hasClass( "thumbnail" )) && (jQuery(this).parent('div.animation').length == 0)) {
      jQuery(this).addClass("lightBoxable");
      jQuery(this).attr('title', 'Click to view full screen');
    }
  });

  //If a lightBoxable image is clicked..
  jQuery("img.lightBoxable").click(function(){
    //Set the max-width to the width of the image if the width is non-zero
    if (this.naturalWidth != 0) {
      jQuery(this).css("max-width",this.naturalWidth);
    }
        
    
    //toggle the lightbox
    return toggleImgLightBox(jQuery(this));
  });
  
  //If the window is resized, check to see if the lightboxable image is too large to vertically center in the window
  jQuery(window).resize(function(){    
    checkTooTall();
  });
});

//This function will toggle an image or animation in or out of lightbox mode
//lightBoxImg argument is an image object in the DOM
function toggleImgLightBox(lightBoxImg){

  //in a div of class lightbox, just remove the parent div
  if (jQuery('#lightBox').length) {
    lightBoxImg.unwrap();
  }
  //Not an animation, not in a div of lightbox, wrap the img in a lightBox div
  else{
    lightBoxImg.wrap("<div id='lightBox'></div>");
  }
  lightBoxSizeElement = lightBoxImg;
  toggleLightBoxCommon(lightBoxImg);

  //return false to cancel the click event downstream
  return false;
}

//called by animator.js
function toggleAnimationLightBox(lightBoxAnimation){
       var parent = jQuery(lightBoxAnimation).parent();
       var grandParent = jQuery(parent).parent();

        if (jQuery(grandParent).attr("id") == 'lightBox') {
            jQuery(parent).unwrap();
        } else {
            jQuery(parent).wrap('<div id="lightBox"></div>');
        }
      
    lightBoxSizeElement = parent;
    toggleLightBoxCommon(lightBoxAnimation);
    return false;
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
    //jQuery("div.lightBox").append("<a class='lightBoxProductPageLink' href='" + linkTarget + "'><br \>More information about this product</a>");
  }
  //If there is no <a> tag wrapping the image, but a linkTarget is set, the image
  //has just been removed from a lightbox, put the wrapping link back
  else if (linkTarget) {
    lightBoxElement.wrap("<a href=\"" + linkTarget + "\"></a>");
    //jQuery("a.lightBoxProductPageLink").remove();
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
