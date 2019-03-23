require({
  paths: {
    'jquery': 'third-party/jquery.1.6.2.min',
    'order': 'third-party/requirejs/order',
    'text': 'third-party/requirejs/text',
    'three': 'third-party/three/build/Three',
    'stats': 'third-party/Stats',
    'RequestAnimationFrame': 'third-party/RequestAnimationFrame',
    'underscore': 'third-party/underscore'
  },
  waitSeconds: 1000,
  priority: ['jquery', 'three']
});


require([
  'dat/signal/Signal',
  'dat/signal/MouseEmulator',
  'dat/mobile/Mobile',
  'dat/utils/System',
  'dat/mahog/showMessage',
  'dat/utils/urlArgs',
  'text!dat/mahog/splash.html',
  'jquery'
], function(Signal, MouseEmulator, Mobile, system, showMessage, urlArgs, splashHTML) {

  require.ready(function() {

    var $win = $(window);

    var makeSelectable = function(elem, selectable) {

      if (elem === undefined || elem.style === undefined) return;

      elem.onselectstart = selectable ? function() {
        return false;
      } : function() {
      };

      elem.style.MozUserSelect = selectable ? 'auto' : 'none';
      elem.style.KhtmlUserSelect = selectable ? 'auto' : 'none';
      elem.unselectable = selectable ? 'on' : 'off';

    }

    makeSelectable(document.body, false);

    if (urlArgs['installation'] === undefined && urlArgs['installation_debug'] === undefined) {
      // add chrome experiment logo
      $('<div class="shout-out"><a href="http://www.chromeexperiments.com/detail/webgl-bookcase/" target="_blank"><img src="textures/ui/ce.png" alt="This is a Chrome Experiment."/></a></div>')
          .css({
            position: 'fixed',
            display: 'none',
            bottom: 0,
            left: 0,
            zIndex: 1002
          })
          .appendTo('body')
          .fadeIn();

      $('<div class="legal"><a href="http://www.google.com/intl/en/policies/privacy/" target="_blank">Privacy Policy</a> <a href="http://www.google.com/intl/en/policies/terms/" target="_blank">Terms of Service</a>')
        .css({
          position: 'fixed',
          display: 'none',
          bottom: 0,
          right: 0,
          zIndex: 1002
        })
        .appendTo('body')
        .fadeIn();
    }

    if (system.supports.webgl) {

      showMessage(splashHTML, function() {

            if (urlArgs['installation'] !== undefined) {
              // Emulate a mouse when given touch events from the signal socket
              var touchSignal = new Signal('websocket',
                  {address: 'ws://localhost:8001/ws'});
              window.touchSignal = touchSignal;
              var ms = new MouseEmulator(touchSignal);
            }

        var DEBUG = false;
        if (DEBUG) {
             require(['dat/mahog/Bookshelf'], gogoPowerBookshelf);
        } else {
          require(['../build/bookshelf-build.min'], function() {

              var timer = setInterval(function() {
                try {
                  gogoPowerBookshelf();
                  clearInterval(timer);
                } catch (e) {
                  // console.log('catching');
                }
              }, 500);
          });
        }


        function gogoPowerBookshelf() {

          var Bookshelf = require('dat/mahog/Bookshelf');

          var bookShelf = new Bookshelf();

          var namespace = urlArgs['namespace'];
          //if (namespace && (urlArgs['installation'] || urlArgs['installation_debug'])) {
          if (namespace) {
            var mobile = new Mobile(bookShelf, namespace);
            //mobile.checkForBook();
          }

          $(bookShelf.domElement)
              .appendTo('body');

          $('<div id="darken-bg" style="display: none;" />')
              .appendTo('body')
              .fadeIn();

          bookShelf.ready(function() {

            startExperience();

            function startExperience(e) {
              if (e) {
                e.preventDefault();
              }
              $('#darken-bg').fadeOut(function() {
                $(this).remove();
              });
              $('#show-message').fadeOut(function() {
                // add event listeners
                $(this).remove();
                bookShelf.addEventListeners();
              });
            }

          });

        }

    }, 463, 280);


    } else {

      var ratio = 1;
      var $contents = $('<img />')
          .attr({
            id: 'mahogany-bg',
            src: 'textures/ui/book-helix.jpg?q=' + new Date().getTime(),
            alt: ''
          })
          .css({
            position: 'fixed',
            opacity: 0.6,
            display: 'hidden',
            zIndex: -1,
            border: 0
          })
          .load(function() {
            var $img = $('#mahogany-bg');
            $img
                .height($win.height())
                .css({
                  top: 0,
                  left: ($win.width() - $img.width()) / 2.0
                })
                .fadeIn();
            $win.trigger('resize');
          })
          .appendTo('body');

      var msg = '<iframe width="640" height="360" src="http://www.youtube.com/embed/6GqhJDPi-Ug" frameborder="0" allowfullscreen></iframe><br /><br />';

      if (system.browser !== 'Chrome' && system.os !== 'Chrome OS') {
        msg += 'Unfortunately, either your web browser or your graphics card doesn\'t support <a href="http://get.webgl.org/">WebGL</a>.';
        msg += '<br /><br />We recommend you try it again with <a href="http://www.google.com/aclk?sa=L&ai=CaNH07Z13TpK7D6WyiALE94GxBqmmrvQB0bDj5huYtYDDRwgAEAFQooG4zf7_____AWDJ9viGyKOgGYgBAcgBAaoEFk_Qnp0L-B8TZK_mmZAuIaCPJDSQQJCgBho&sig=AOD64_0SmbTclk11S9e3HDI169-TTpMT2Q&ved=0CA4Q0Qw&adurl=http://www.google.com/chrome/intl/en/make/download.html%3F%26brand%3DCHMB%26utm_campaign%3Den%26utm_source%3Den-ha-na-us-sk%26utm_medium%3Dha">Google Chrome</a>.';
      } else {
        msg += 'Unfortunately, your computer\'s graphics card doesn\'t support <a href="http://get.webgl.org/">WebGL</a>, which is required for this experiment.';
      }

      showMessage(msg, true);

      $win.resize(function() {
        $contents
            .height($win.height())
            .css({
              left: ($win.width() - $contents.width()) / 2.0
            });
        $('#show-message')
          .css({
            'text-align': 'center',
            left: ($win.width() - $('#show-message').outerWidth()) / 2,
            top: ($win.height() - $('#show-message').outerHeight()) / 2
          })
      })
      .trigger('resize');

    }

  });

});
