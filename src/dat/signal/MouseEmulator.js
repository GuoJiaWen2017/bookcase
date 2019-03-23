define([
],
function() {

  var MIN_MOVEMENT_FOR_CLICK = 10;
  var ADDRESS_BAR_HEIGHT = window.outerHeight - window.innerHeight;
  var MAX_TOUCHES_FOR_CLICK = 2;
  var MIN_EVENT_TIME = 50;

  /**
   * Create Mouse Event
   *
   * @param {String} type click, mousedown, mouseup,
   *                  mouseover, mousemove, mouseout.
   * @param {Number} x X position on screen.
   * @param {Number} y Y position on screen.
   */
  function mouseEvent(type, x, y) {
    var evt = document.createEvent('MouseEvents');
    evt.initMouseEvent(type, true, true, window, 1, x, y,
        x - window.screenX,
        y - window.screenY - ADDRESS_BAR_HEIGHT,
        false, false, false, false, 0, null);
    evt.generated = true;
    return evt;
  }

  function dispatch(evt) {
    var element = document.elementFromPoint(evt.clientX, evt.clientY);
    if(element) {
      element.dispatchEvent(evt);
    }
  }

  var MouseEmulator = function(signal, params) {
    params = params || {};
    debug = params.debug || false;
    var lastX = 0, lastY = 0;
    if (debug) {
      var tSize = 10;
      function circle(ctx,x,y,size,color) {
        ctx.fillStyle = color;
        size = size | tSize;
        ctx.beginPath();
        ctx.arc(x,y,size, 0, Math.PI*2, true);
        ctx.closePath();
        ctx.fill();
      }
      var ctx = $('<canvas id="mouseDebug"></canvas>').
          attr('width', $(window).width()).
          attr('height', $(window).height()).
          appendTo($('body')).
          css({
            width: $(window).width(),
            height: $(window).height(),
            position: 'absolute',
            backgroundColor: 'rgba(0,0,0,0.5)',
            top: 0,
            left: 0
          }).
          get(0).getContext('2d');
      window.addEventListener('mousedown', function(e) {
        ctx.clearRect(0,0,$(window).width(),$(window).height());
        circle(ctx, e.clientX, e.clientY, 20, 'rgb(255,0,0)');
      });
      window.addEventListener('mousemove', function(e) {
        circle(ctx, e.clientX, e.clientY, 10, 'rgb(255,255,255)');
      });
      window.addEventListener('mouseup', function(e) {
        circle(ctx, e.clientX, e.clientY, 50, 'rgb(0,255,0)');
      });
      window.addEventListener('click', function(e) {
        circle(ctx, e.clientX, e.clientY, 20, 'rgb(0,0,255)');
      });
    }
    signal.bind('touchstart', function(e) {
      if (this._down) { return; }
      this._down = {
        x: e.x,
        y: e.y,
        dx: 0,
        dy: 0,
        mx: e.x,
        my: e.y,
        ts: Date.now(),
        touches: e.touches
      };
      dispatch(mouseEvent('mousedown', e.x, e.y));
    }).bind('touchmove', function(e) {
      if( this._down ) {
        this._down.dx += Math.abs(this._down.mx - e.x);
        this._down.dy += Math.abs(this._down.my - e.y);
        this._down.mx = e.x;
        this._down.my = e.y;
        this._down.touches = Math.max(this._down.touches, e.touches);
      }
      if(lastX !== e.x && lastY !== e.y) {
        dispatch(mouseEvent('mousemove', e.x, e.y));
        lastX = e.x; lastY = e.y;
      }
    }).bind('touchend', function(e) {
      if (this._down) {
        clearTimeout(this._down.touchend);
        this._down.touchend = setTimeout(function() {
          dispatch(mouseEvent('mouseup', e.x, e.y));
          if (this._down.dx < MIN_MOVEMENT_FOR_CLICK &&
              this._down.dy < MIN_MOVEMENT_FOR_CLICK &&
              this._down.touches <= MAX_TOUCHES_FOR_CLICK) {
            dispatch(mouseEvent('click', e.x, e.y));
          }
          this._down = undefined;
        }, MIN_EVENT_TIME);
      }
    });
  };

  MouseEmulator.prototype = {
  };

  return MouseEmulator;
});
