(function ($) {
    $(document).ready(function() {

        // Intitially the height is off by ~7 pixels.
        $(window).on('resize load', function() {
            // Setting the height based on the image itself is
            // unreliable.
            var setHeight = $("div.animation.selected").height();
            $("div.list").height(setHeight);
        });

        $('.selection').click(function() {
            $('.selection').removeClass("selected");
            $(this).addClass("selected");
            $('.animation').hide();

            var currentId = $(this).attr('id');

            $('.animation.' + currentId).show();
            $('.animation.' + currentId).css('display','inline-block');
        })

    });
})(jQuery);
