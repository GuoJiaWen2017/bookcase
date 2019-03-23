define([
  'underscore'
], function() {

  var System = {};
  var userAgent = navigator.userAgent;
  var canvas = document.createElement('canvas');
  var expWebGl = true;
  try {
    if (!canvas.getContext('experimental-webgl')) {
      expWebGl = false;
    }
  } catch(e) {
    expWebGl = false;
  }

  // Order matters!
  System.Browsers = {
    'Arora': /Arora/,
    'Chrome': /Chrome/,
    'Epiphany': /Epiphany/,
    'Firefox': /Firefox/,
    'Mobile Safari': /Mobile Safari/,
    'Internet Explorer': /MSIE/,
    'Midori': /Midori/,
    'Opera': /Opera/,
    'Safari': /Safari/
  };

  System.OS = {
    'Android': /Android/,
    'Chrome OS': /CrOS/,
    'iOS': /iP[ao]d|iPhone/i,
    'Linux': /Linux/,
    'Mac OS': /Mac OS/,
    'Windows': /windows/
  };

  // Public Variables
  System.browser = which(System.Browsers);

  System.os = which(System.OS);

  System.supports = {
    canvas: !!window.CanvasRenderingContext2D,
    localStorage: supports(localStorage.getItem),
    file: !!window.File && !!window.FileReader && !!window.FileList && !!window.Blob,
    fileSystem: !!window.requestFileSystem,
    requestAnimationFrame: !!window.mozRequestAnimationFrame || !!window.webkitRequestAnimationFrame || !!window.oRequestAnimationFrame || !!window.msRequestAnimationFrame,
    sessionStorage: supports(sessionStorage.getItem),
    webgl: !!window.WebGLRenderingContext && expWebGl,
    worker: !!window.Worker
  };

  function supports(item) {
    try {
      return !! item;
    } catch(error) {
      return false;
    }
  }

  function which(list) {

    var result = [];
    _.each(list, function(value, key) {
      if (value.test(navigator.userAgent)) {
        result.push(key);
      }
    });

    if(_.isEmpty(result)) {
      return false;
    } else {
      return _.first(result);
    }
  }

  return System;

});
