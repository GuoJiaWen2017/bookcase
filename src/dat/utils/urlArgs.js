define([
], function() {

  var result = {};
  var search = window.location.search.toString();

  search = search.replace('\?', '');
  search = search.split('\&');

  for (var i = 0; i < search.length; i++) {

    var keyValue = search[i].split("\=");

    if (keyValue && keyValue[0] != "") {
      result[keyValue[0]] = keyValue[1];
    }

  }

  return result;

});