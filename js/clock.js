jQuery(document).ready(function() {
    clock();
});

function clock() {
    var n = new Date().getTime();
    jQuery('#clock').text(strftimeUTC('%A, %B %d, %Y %H:%M:%S UTC', new Date(n)));
    timer = setTimeout("clock()",1000);
};
