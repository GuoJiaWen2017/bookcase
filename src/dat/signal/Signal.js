define([], function() {
  var localHandler = (function() {
    try {
      document.createEvent('CustomEvent');
      return {
        createEvent: function(type, data) {
          var evt = document.createEvent('CustomEvent');
          evt.initEvent(type, true, false);
          for(var property in data) {
            if(evt[property] === undefined) {
              evt[property] = data[property];
            }
          }
          return evt;
        },
        _listeners: {},
        bind: function(type, listener, property) {
          type = 's_'+type;
          window.addEventListener(type, listener, true);
          this._listeners[type] = this._listeners[type] || [];
          this._listeners[type].push(listener);
        },
        unbind: function(type, listener) {
          type = 's_'+type;
          if (listener === undefined && this._listeners[type] !== 'undefined') {
            while (listener = this._listeners[type].shift()) {
              window.removeEventListener(type, listener, true);
            }
          } else {
            window.removeEventListener(type, listener, true);
            if(this._listeners[type] !== 'undefined') {
              var idx = this._listeners[type].indexOf(listener);
              if (idx !== -1) {
                this._listeners[type].splice(idx,1);
              }
            }
          }
        },
        getListeners: function(type) {
          type = 's_'+type;
          return this._listeners[type];
        },
        trigger: function(type, data) {
          type = 's_'+type;
          window.dispatchEvent(this.createEvent(type, data));
        }
      };
    } catch(err) {
      return {
        createEvent: function(type, data) {
          var evt = {};
          for(var property in data) {
            if(evt[property] === undefined) {
              evt[property] = data[property];
            }
          }
          evt.type = type;
          return evt;
        },
        _listeners: {},
        bind: function(type, listener, property) {
          type = 's_'+type;
          this._listeners[type] = this._listeners[type] || [];
          this._listeners[type].push(listener);
        },
        unbind: function(type, listener) {
          type = 's_'+type;
          if (listener === undefined && this._listeners[type] !== 'undefined') {
            while (listener = this._listeners[type].shift()) {
            }
          } else {
            if(this._listeners[type] !== 'undefined') {
              var idx = this._listeners[type].indexOf(listener);
              if (idx !== -1) {
                this._listeners[type].splice(idx,1);
              }
            }
          }
        },
        getListeners: function(type) {
          type = 's_'+type;
          return this._listeners[type];
        },
        trigger: function(type, data) {
          type = 's_'+type;
          var listeners = this._listeners[type];
          var evt = this.createEvent(type, data);
          if (listeners) {
            for(var i=0;i<listeners.length;i++) {
              listeners[i](evt);
            }
          }
        }
      };
    }
  })();

  var cidGenerator = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  };

  var channelHandler = {
    _cid: '',
    _hasRun: false,
    _types: [],
    config: function(host, channelType) {
      this.host = host;
      this.channelType = channelType || 'user'; // or event
      if (this.channelType == 'user') {
        this._cid = cidGenerator();
      }
      if (this._hasRun === false) {
        var s = document.createElement('script');
        s.setAttribute('type','text/javascript');
        s.setAttribute('src','/talkgadget/channel.js');
        document.getElementsByTagName('head')[0].appendChild(s);
        this._hasRun = true;
      } else {
        throw "Warning: you can only have one channel per page."
      }
      this._update_channel();
      return this;
    },
    bind: function(type, listener) {
      if (this.channelType == 'user') {
        this._send_msg('bind', {
              cid: this._cid,
              type: type
            });
      } else {
        if(this._types.indexOf(type) === -1) {
          this._types.push(type);
          this._types.sort();
          this._cid = this._types.join(',');
          this._update_channel();
        }
      }
      localHandler.bind(type, listener);
    },
    unbind: function(type, listener) {
      if (this.channelType == 'user') {
        this._send_msg('unbind', {
              cid: this._cid,
              type: type
            });
      } else {
        var idx = this._types.indexOf(type);
        if (idx !== -1) {
          this._types.splice(idx, 1);
          this._types.sort();
          this._cid = this._types.join(',');
          this._update_channel();
        }
      }
      localHandler.unbind(type, listener);
    },
    trigger: function(type, data) {
      var msg = {
        type: type,
        data: data
      };
      msg.data._ts = Date.now();
      this._send_msg('trigger', msg);
    },
    _send_msg: function(action, params) {
      var self = this;
      $.ajax({
            type: 'POST',
            url: self.host+'/'+action,
            data: JSON.stringify(params),
            processData: false,
            contentType: 'application/json',
            error: function() {
              if (self._timeout < 10000) {
                setTimeout(function() {
                  self._send_msg(action, params);
                }, self._timeout);
                self._timeout *= 2;
              }
            }
          });
    },
    _timeout: 100,
    _update_channel: function() {
      var self = this;
      $('#wcs-iframe').remove();
      $.get(self.host+'/channel', {
            'cid': self._cid,
            'type': self.channelType
          }, function(token) {
        self._token = token;
        $('#wcs-iframe').remove();
        if (goog === undefined) {
          if (self._timeout < 10000) {
            setTimeout(self._update_channel, self._timeout);
          }
          self._timeout *= 2;
        } else {
          self._channel = new goog.appengine.Channel(token);
          self._socket = self._channel.open();
          self._socket.onmessage = function(m) {
            // console.log(m);
            m = JSON.parse(m.data);
            localHandler.trigger(m.type, m.data);
          };
        }
      });
    },
    getListeners: localHandler.getListeners
  };

  var WebSocketHandler = function(_super, host) {
    console.log('websocket handler');
    this._super = _super;
    this.host = host;
    this._queue = [];
    this.sock = this.getOrCreate();
  };
  WebSocketHandler._sockets = {};
  WebSocketHandler.prototype = {
    getOrCreate: function() {
      var sock = WebSocketHandler._sockets[this.host];
      if (sock === undefined) {
	console.log('new socket');
	console.log(this.host);
        sock = new WebSocket(this.host);
        var that = this;
        sock.onopen = function(e) {
          console.log('connected');
          while (msg = that._queue.shift()) {
            that.sock.send(msg);
          }
        };
        var defaultToLocal = function() {
          that._super._handler = localHandler;
        };
        sock.onerror = function(e) {
		console.log('error', e);
		defaultToLocal();
	};
        sock.onclose = function(e) {
		console.log('closed', e);
		defaultToLocal();
	};
        sock.onmessage = function(e) {
          var msg = JSON.parse(e.data);
//          console.log(msg);
          localHandler.trigger(msg.type,msg.data);
        };
        WebSocketHandler._sockets[this.host] = sock;
      }
      return sock;
    },
    bind: function(type, listener, property) {
      var listeners = localHandler._listeners[type];
      if (listeners === undefined || listeners.length === 0) {
        this._send_msg('bind', type);
      }
      localHandler.bind(type, listener);
    },
    unbind: function(type, listener) {
      localHandler.unbind(type, listener);
      var listeners = localHandler._listeners[type];
      if (listeners && listeners.length === 0) {
        this._send_msg('unbind', type);
      }
    },
    trigger: function(type, data) {
      var msg = {
        type: type,
        data: data
      };
      msg.data._ts = Date.now();
      this._send_msg('trigger', msg);
    },
    _send_msg: function(action, params) {
      var msg = JSON.stringify({
        action: action,
        params: params
      });
      if (this.sock.readyState !== 1) {
        this._queue.push(msg);
      } else {
        this.sock.send(msg);
      }
    },
    getListeners: localHandler.getListeners
  };

  var Signal = function(type, config) {
    config = config || {};
    if (type === 'websocket') {
      this._handler = new WebSocketHandler(this, config.address);
      if (this._handler.readyState === WebSocket.CLOSED) {
        this._handler = localHandler;
      }
    } else if (type === 'channel') {
      this._handler = channelHandler.config(config.address, config.type);
    } else {
      this._handler = localHandler;
    }
  };

  Signal.prototype = {
    bind: function(type, listener, property) {
      this._handler.bind.apply(this._handler, arguments);
      return this; // For chaining
    },
    unbind: function(type, listener) {
      this._handler.unbind.apply(this._handler, arguments);
      return this;  // For chaining
    },
    trigger: function(type, data) {
      this._handler.trigger.apply(this._handler, arguments);
      return this;  // For chaining
    },
    getListeners: function(type) {
      return this._handler.getListeners.apply(this._handler, arguments);
    },
    _localHandler: localHandler
  };

  return Signal;
});


