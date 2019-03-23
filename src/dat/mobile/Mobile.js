define([
  'jquery'],
    function() {
      var UPDATE_INTERVAL = 1000;
      var API_URL = ''; // http://mahoganyapi.appspot.com
      var fresh = true;

      var th = document.getElementsByTagName('head')[0];
      var s = document.createElement('script');
      s.setAttribute('type','text/javascript');
      s.setAttribute('src','/talkgadget/channel.js');
      th.appendChild(s);

      var MobileInterface = function(bookShelf, namespace) {
        this.namespace = namespace;
        this.lastBook = undefined;
        this.bookShelf = bookShelf;
        this.bookShelf._showCover = bookShelf.showCover;
        var _this = this;
        this.bookShelf.showCover = function() {
          _this.locked = true;
          _this.bookShelf._showCover.apply(_this.bookShelf, arguments);
          _this.bookChanged(_this.bookShelf.lastOpenedId);
          _this.locked = false;
        }
      };
      MobileInterface.prototype = {
        checkForBook: function() {
          var _this = this;
//          var rid = Math.random();
          $.getJSON(API_URL + 'api/'+_this.namespace+'/token?id='+_this.namespace, function(data) {
//          $.getJSON(API_URL + '/api/'+_this.namespace+'/token', function(data) {
            var channel = new goog.appengine.Channel(data.token);
            socket = channel.open();
            socket.onmessage = function(e) {
              data = JSON.parse(e.data);
              if (data.action == 'setCurrentBook') {
                var id = data.arguments[0];
                if (id != undefined && id != _this.lastBook && !_this.locked) {
                  console.log("book set over channel ", id);
                  _this.bookShelf.goToBookById(id, true);
                }
              }
            };
          });
        },
        bookChanged: function(id) {
          console.log("book changed ", id);
          var _this = this;
          this.lastBook = id;
          $.ajax({
            type: 'GET',
            url: API_URL + 'api/' + _this.namespace + '/setCurrentBook',
            data: {
              id: id,
              clientId: _this.namespace
            },
            dataType: 'jsonp',
            success: function() {
            }
          });
        }
      };
      return MobileInterface;
    });
