define(['jquery', 'underscore'], function() {

  var domElement = document.createElement('div');
  domElement.setAttribute('id', 'console');
  domElement.innerHTML = 'Aww, snap!';

  document.body.appendChild(domElement);


  var d = $(domElement);
  d.attr('id', 'show-message');
  d.hide();


  var fadeTimeout;
  var showing = false;

  var showMessage = function(msg, param, forceWidth, forceHeight) {

  $(window).bind('resize', layout);
    d.html(msg);

    if (!showing) {
      clearTimeout(fadeTimeout);
      if (_.isFunction(param)) {
        d.fadeIn(param);
      } else {
        d.fadeIn();
      }
      showing = true;
      if (_.isUndefined(param)) {
        fadeTimeout = setTimeout(function() {
          d.fadeOut();
          showing = false;
          $(window).unbind('resize', layout);
        }, 5000);
      }
    }
//    $(window).trigger('resize');
    layout();
    function layout() {


      var y = ($(window).height() - forceHeight || d.height()) / 2;
      var x = ($(window).width() - forceWidth || d.width()) / 2;
      d.css({
        top: y,
        left: x
      });


    }
  };
  return showMessage;

});
