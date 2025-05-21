(function($) {

    $(document).ready(function() {

        // Assign classes to significant embedded list levels.
        $('section.block-system-main-menu ul:first-child').addClass('level-1');
        $('ul.level-1 > li > ul').addClass('level-2');
        $('ul.level-2 > li > ul').addClass('level-3');

        // Reposition submenus under parent list items when the menu is open and the windows is resized.
        $(window).resize(function() {
            if ($('li.highlighted').position()) {
            $('ul.level-2').css('top', $('li.highlighted').position().top + $('li.highlighted').height() + 3 + 'px');
            }
        });

        // Clicking anywhere outside of a second level menu will close it.
        $('html').click(function() {
            $('ul.level-2.visible').toggleClass('visible');
            $('li.highlighted').toggleClass('highlighted');
        });

        $('ul.level-2').click(function(event){
            event.stopPropagation();
        });

        // Instantiate menu behavior.
        setMenuBehavior();

        // This menu is entirely click based.
        function setMenuBehavior() {
            $('.level-1 > li > a').click(
                function(event) {

                    // Unset any previously highlighted list items.
                    $('.highlighted').toggleClass('highlighted');

                    // Set this list item to hightlighted.
                    $(this).parent('li').toggleClass('highlighted');

                    // Set the two click behavior only for menu items with sublevels.
                    if($(this).parent('li').children('ul.level-2').length == 0 || $(this).parent('li').children('ul.level-2').hasClass('visible')) {
                        return true;
                    }
                    else{
                        $('ul.level-2.visible').toggleClass('visible');
                        $(this).parent('li').children('ul.level-2').toggleClass('visible');

                        // Reposition the submenu under its parent list item.
                        $('ul.level-2').css('top', $(this).position().top + $(this).parent('li').height() + 3 + 'px');

                        event.preventDefault();
                        return false;
                    } 
                }
            );
        }
    });

})(jQuery);
