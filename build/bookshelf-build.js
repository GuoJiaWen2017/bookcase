
/**
 * @license RequireJS text 0.25.0 Copyright (c) 2010-2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
/*jslint regexp: false, nomen: false, plusplus: false, strict: false */
/*global require: false, XMLHttpRequest: false, ActiveXObject: false,
  define: false, window: false, process: false, Packages: false,
  java: false, location: false */

(function () {
    var progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        buildMap = [];

   define('text',[],function () {
        var text, get, fs;

        if (typeof window !== "undefined" && window.navigator && window.document) {
            get = function (url, callback) {
                var xhr = text.createXhr();
                xhr.open('GET', url, true);
                xhr.onreadystatechange = function (evt) {
                    //Do not explicitly handle errors, those should be
                    //visible via console output in the browser.
                    if (xhr.readyState === 4) {
                        callback(xhr.responseText);
                    }
                };
                xhr.send(null);
            };
        } else if (typeof process !== "undefined" &&
                 process.versions &&
                 !!process.versions.node) {
            //Using special require.nodeRequire, something added by r.js.
            fs = require.nodeRequire('fs');

            get = function (url, callback) {
                callback(fs.readFileSync(url, 'utf8'));
            };
        } else if (typeof Packages !== 'undefined') {
            //Why Java, why is this so awkward?
            get = function (url, callback) {
                var encoding = "utf-8",
                    file = new java.io.File(url),
                    lineSeparator = java.lang.System.getProperty("line.separator"),
                    input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                    stringBuffer, line,
                    content = '';
                try {
                    stringBuffer = new java.lang.StringBuffer();
                    line = input.readLine();

                    // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                    // http://www.unicode.org/faq/utf_bom.html

                    // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                    // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                    if (line && line.length() && line.charAt(0) === 0xfeff) {
                        // Eat the BOM, since we've already found the encoding on this file,
                        // and we plan to concatenating this buffer with others; the BOM should
                        // only appear at the top of a file.
                        line = line.substring(1);
                    }

                    stringBuffer.append(line);

                    while ((line = input.readLine()) !== null) {
                        stringBuffer.append(lineSeparator);
                        stringBuffer.append(line);
                    }
                    //Make sure we return a JavaScript string and not a Java string.
                    content = String(stringBuffer.toString()); //String
                } finally {
                    input.close();
                }
                callback(content);
            };
        }

        text = {
            version: '0.25.0',

            strip: function (content) {
                //Strips <?xml ...?> declarations so that external SVG and XML
                //documents can be added to a document without worry. Also, if the string
                //is an HTML document, only the part inside the body tag is returned.
                if (content) {
                    content = content.replace(xmlRegExp, "");
                    var matches = content.match(bodyRegExp);
                    if (matches) {
                        content = matches[1];
                    }
                } else {
                    content = "";
                }
                return content;
            },

            jsEscape: function (content) {
                return content.replace(/(['\\])/g, '\\$1')
                    .replace(/[\f]/g, "\\f")
                    .replace(/[\b]/g, "\\b")
                    .replace(/[\n]/g, "\\n")
                    .replace(/[\t]/g, "\\t")
                    .replace(/[\r]/g, "\\r");
            },

            createXhr: function () {
                //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
                var xhr, i, progId;
                if (typeof XMLHttpRequest !== "undefined") {
                    return new XMLHttpRequest();
                } else {
                    for (i = 0; i < 3; i++) {
                        progId = progIds[i];
                        try {
                            xhr = new ActiveXObject(progId);
                        } catch (e) {}

                        if (xhr) {
                            progIds = [progId];  // so faster next time
                            break;
                        }
                    }
                }

                if (!xhr) {
                    throw new Error("createXhr(): XMLHttpRequest not available");
                }

                return xhr;
            },

            get: get,

            /**
             * Parses a resource name into its component parts. Resource names
             * look like: module/name.ext!strip, where the !strip part is
             * optional.
             * @param {String} name the resource name
             * @returns {Object} with properties "moduleName", "ext" and "strip"
             * where strip is a boolean.
             */
            parseName: function (name) {
                var strip = false, index = name.indexOf("."),
                    modName = name.substring(0, index),
                    ext = name.substring(index + 1, name.length);

                index = ext.indexOf("!");
                if (index !== -1) {
                    //Pull off the strip arg.
                    strip = ext.substring(index + 1, ext.length);
                    strip = strip === "strip";
                    ext = ext.substring(0, index);
                }

                return {
                    moduleName: modName,
                    ext: ext,
                    strip: strip
                };
            },

            xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

            /**
             * Is an URL on another domain. Only works for browser use, returns
             * false in non-browser environments. Only used to know if an
             * optimized .js version of a text resource should be loaded
             * instead.
             * @param {String} url
             * @returns Boolean
             */
            canUseXhr: function (url, protocol, hostname, port) {
                var match = text.xdRegExp.exec(url),
                    uProtocol, uHostName, uPort;
                if (!match) {
                    return true;
                }
                uProtocol = match[2];
                uHostName = match[3];

                uHostName = uHostName.split(':');
                uPort = uHostName[1];
                uHostName = uHostName[0];

                return (!uProtocol || uProtocol === protocol) &&
                       (!uHostName || uHostName === hostname) &&
                       ((!uPort && !uHostName) || uPort === port);
            },

            finishLoad: function (name, strip, content, onLoad, config) {
                content = strip ? text.strip(content) : content;
                if (config.isBuild && config.inlineText) {
                    buildMap[name] = content;
                }
                onLoad(content);
            },

            load: function (name, req, onLoad, config) {
                //Name has format: some.module.filext!strip
                //The strip part is optional.
                //if strip is present, then that means only get the string contents
                //inside a body tag in an HTML string. For XML/SVG content it means
                //removing the <?xml ...?> declarations so the content can be inserted
                //into the current doc without problems.

                var parsed = text.parseName(name),
                    nonStripName = parsed.moduleName + '.' + parsed.ext,
                    url = req.toUrl(nonStripName);

                //Load the text. Use XHR if possible and in a browser.
                if (!hasLocation || text.canUseXhr(url)) {
                    text.get(url, function (content) {
                        text.finishLoad(name, parsed.strip, content, onLoad, config);
                    });
                } else {
                    //Need to fetch the resource across domains. Assume
                    //the resource has been optimized into a JS module. Fetch
                    //by the module name + extension, but do not include the
                    //!strip part to avoid file system issues.
                    req([nonStripName], function (content) {
                        text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                                        parsed.strip, content, onLoad, config);
                    });
                }
            },

            write: function (pluginName, moduleName, write, config) {
                if (moduleName in buildMap) {
                    var content = text.jsEscape(buildMap[moduleName]);
                    write("define('" + pluginName + "!" + moduleName  +
                          "', function () { return '" + content + "';});\n");
                }
            },

            writeFile: function (pluginName, moduleName, req, write, config) {
                var parsed = text.parseName(moduleName),
                    nonStripName = parsed.moduleName + '.' + parsed.ext,
                    //Use a '.js' file name so that it indicates it is a
                    //script that can be loaded across domains.
                    fileName = req.toUrl(parsed.moduleName + '.' +
                                         parsed.ext) + '.js';

                //Leverage own load() method to load plugin value, but only
                //write out values that do not have the strip argument,
                //to avoid any potential issues with ! in file names.
                text.load(nonStripName, req, function (value) {
                    //Use own write() method to construct full module value.
                    text.write(pluginName, nonStripName, function (contents) {
                        write(fileName, contents);
                    }, config);
                }, config);
            }
        };

        return text;
    });
}());
define('text!dat/mahog/data/config.json', function () {
    return '{\n  "name": "dat.mahog",\n  "src": "client/src",\n  "build": "client/build",\n  "js": ["dat.mahog"],\n\n  "seed_path": "raw/seed.json",\n\n  "categories_path": "data/categories.json",\n  "original_ids_path": "data/original_ids.json",\n  "ids_path": "data/ids.json",\n  "colors_path": "data/colors.json",\n  "dominant_colors_path": "data/dominant_colors.json",\n  "aspect_ratios_path": "data/aspect_ratios.json",\n  "more_info_path": "data/more_info.json",\n  "more_info_dir": "data/more_info",\n  "count_path": "data/count.json",\n\n  "failed_path": "data/failed.json",\n  "exclude_path": "data/exclude.json",\n  "manual_exclude_path": "data/manual_exclude.json",\n  "manual_include_path": "data/manual_include.json",\n\n  "trimmed_id_path": "data/trimmed.json",\n  "trimmed_path": "data/trimmed",\n  "trimmed_rejects": "data/trimmed_rejects.json",\n\n  "merged_path": "data/merged",\n  "qr_dir": "data/qr",\n  "qr_path": "data/qr_failed.json",\n  "fullsize_path": "data/fullsize",\n  "fullsize_square_path": "data/fullsize_square",\n  "spritesheet_path": "data/spritesheets",\n\n  "spritesheet_size": 1024,\n  "spritesheet_count": 36,\n  "spritesheet_quality": 95,\n\n  "fullsize_zoom": 3\n}\n';
});
define('text!dat/mahog/data/count.json', function () { return '{"count": 10965}';});

define('dat/mahog/CONFIG',[
  'text!dat/mahog/data/config.json',
  'text!dat/mahog/data/count.json'
  ], function(config, count) {

  var CONFIG = JSON.parse(config);
  CONFIG.count = JSON.parse(count).count;

  return CONFIG;

});

define('dat/utils/utils',[], function() {

  var utils = {

    sign: function(v) {
      return v >= 0 ? 1 : -1;
    },

    lerp: function(a, b, t) {
      return (b - a) * t + a;
    },

    map: function(v, i1, i2, o1, o2) {
      return o1 + (o2 - o1) * ((v - i1) / (i2 - i1));
    },

    cmap: function(v, i1, i2, o1, o2) {
      return utils.clamp(o1 + (o2 - o1) * (v - i1) / (i2 - i1), o1, o2);
    },

    wrap: function(value, rangeSize) {
      while (value < 0) {
        value += rangeSize;
      }
      return value % rangeSize;
    },

    cap: function(v, maxMagnitude) {
      if (Math.abs(v) > maxMagnitude) {
        return utils.sign(v) * maxMagnitude;
      } else {
        return v;
      }
    },

    dist: function(x1, y1, x2, y2) {
      return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
    },

    clamp: function(v, min, max) {
      var ma = Math.max(min, max);
      var mi = Math.min(min, max);
      if (v > ma) return ma;
      if (v < mi) return mi;
      return v;
    },

    roundToDecimal: function(value, decimals) {
      var tenTo = Math.pow(10, decimals);
      return Math.round(value * tenTo) / tenTo;
    },

    random: function() {

      if (arguments.length == 0) {

        return Math.random();

      } else if (arguments.length == 1) {

        if (typeof arguments[0] == 'number') {

          return random() * arguments[0];

        } else if (typeof arguments[0] == 'array') {

          return arguments[0][Math.floor(random(arguments[0].length))];

        }

      } else if (arguments.length == 2) {

        return lerp(arguments[0], arguments[1], random());

      }

    },

    clone: function(obj) {
      if (obj == null || typeof obj != 'object')
        return obj;
      var temp = obj.constructor(); // changed
      for (var key in obj)
        temp[key] = clone(obj[key]);
      return temp;
    },

    bezier: function(a, b, c, d, t) {
      var t1 = 1.0 - t;
      return a * t1 * t1 * t1 + 3 * b * t * t1 * t1 + 3 * c * t * t * t1 +
        d * t * t * t;
    },

    commaify: function(s, d) {
      if (!d) {
        d = 3;
      }
      var s = s.toString().split('').reverse().join('');
      var r = '';
      var j = 0;
      for (var i = 0; i < s.length; i++) {
        var l = s.charAt(i);
        if (j > d - 1) {
          j = 0;
          r += ',';
        } else {
          j++;
        }
        r += l;
      }
      return r.split('').reverse().join('');
    }

  };

  return utils;

});

define('dat/mahog/params',['dat/mahog/CONFIG', 'dat/utils/utils'], function(CONFIG, datutils) {

  return {

      TINT_DEBUG: true,

      SHELF_TEXTURE: '/textures/wood.jpg',
      SHELF_NORMALS: '/textures/wood-normal-hard.jpg',

      STATIC_COVER_LIGHT_MAP_SRC: '/textures/lightMap_static.jpg',

      MORPHING_COVER_LIGHT_MAP_SRC: '/textures/lightMap_cover.jpg',
      MORPHING_PAGES_LIGHT_MAP_SRC: '/textures/lightMap_pages.jpg',

      MORPHING_COVER_GEOMETRY_SRC: '/models/book_cover1.js',
      MORPHING_PAGES_GEOMETRY_SRC: '/models/book_pages1.js',

    numBookDisplayers: 500,

      maxTextures: 50,

      bookSize: 40,
      minAspectRatio: 0.79,
      shelfHeight: 63,
      spiralRadius: 448,
      cameraDistance: 719,
      booksPerCircle: 59,
      bookSpacing: 30,
      bookTwist: 2.199,
      baseFov: 30,
      maxFov: 50,
      fovCap: Math.PI / 2,
      fovCurve: 1.6445,
      scaleFov: true,
      loopHeight: 200,
      grabTextures: 750,
      lightDistance: 0,
      openDistance: 120,
      applyThumbnailStaggerSize: 200,
      imageRequestStaggerSize: 1,

      labelWidth: 550,
      labelHeight: 20,
      labelOffsetY: 54,
      labelOffsetX: 30,

      projectTitle: 'Mahogany',
      projectDescription: 'Browse thousands of titles from Google Books, ' +
        'using WebGL on Google Chrome.',
      smallPrint: 'Learn more at <strong>goto/mahog</strong>. Library ' +
        'includes ' + datutils.commaify(CONFIG.count) + ' books. Data from ' +
        'the public Google Books API. Updated 14 July 2011.',

      backgroundImage: 'textures/ui/texture.jpg',

      tileSizeCorrect: -0.0005,

      // fontStyle font-size should be labelHeight / 1.5
      fontStyle: '32px Lora, EB Garamond, serif',
      fill: '#000',
      offsetTheta: 0,

      focusOffset: 1,

      lookAhead: 1000,

      near: 725,
      far: 1400,
      bookOpenTime: 800,
      bookCloseTime: 1500,

      cameraPositionDriftLength: 3000,
      cameraTargetDriftLength: 1500,
      orbitDriftLength: 1200,

      insideFace: true,
      outsideFace: true,
      bottomFace: true,
      topFace: true,
      wireframe: false,
      shelfDepth: 40,
      shelfThickness: 3,
      shelfResolution: 70,
      shelfYOffset: 1.5,
      shelfXOffset: 0,
      topTextureSpan: 14,
      sideTextureSpan: 9,
      orbits: Math.PI * 60,

      errorString: 'Unable to open book.',

      maxOpen: 0.93,
      pagesTextureWidth: 1600,
      pagesAspectRatio: 2.4,
      pagesScale: 1.435,
      openVel: 0.001,
      fullOpenEffort: 600,
      openThreshold: 0.08,

      dragEpsilon: 12,
      idleUntilDemo: 6 * 60 * 1000,

      closeButtonFadeSpeed: 200,

      numBooksPerDemo: 5

    };

});

// Three.js r44 - http://github.com/mrdoob/three.js
var THREE = THREE || {};
THREE.Color = function (b) {
    b !== void 0 && this.setHex(b);
    return this
};
THREE.Color.prototype={constructor:THREE.Color,r:1,g:1,b:1,copy:function(b){this.r=b.r;this.g=b.g;this.b=b.b;return this},setRGB:function(b,c,e){this.r=b;this.g=c;this.b=e;return this},setHSV:function(b,c,e){var f,h,m;if(e==0)this.r=this.g=this.b=0;else switch(f=Math.floor(b*6),h=b*6-f,b=e*(1-c),m=e*(1-c*h),c=e*(1-c*(1-h)),f){case 1:this.r=m;this.g=e;this.b=b;break;case 2:this.r=b;this.g=e;this.b=c;break;case 3:this.r=b;this.g=m;this.b=e;break;case 4:this.r=c;this.g=b;this.b=e;break;case 5:this.r=
e;this.g=b;this.b=m;break;case 6:case 0:this.r=e,this.g=c,this.b=b}return this},setHex:function(b){b=Math.floor(b);this.r=(b>>16&255)/255;this.g=(b>>8&255)/255;this.b=(b&255)/255;return this},getHex:function(){return~~(this.r*255)<<16^~~(this.g*255)<<8^~~(this.b*255)},getContextStyle:function(){return"rgb("+Math.floor(this.r*255)+","+Math.floor(this.g*255)+","+Math.floor(this.b*255)+")"},clone:function(){return(new THREE.Color).setRGB(this.r,this.g,this.b)}};
THREE.Vector2=function(b,c){this.x=b||0;this.y=c||0};
THREE.Vector2.prototype={constructor:THREE.Vector2,set:function(b,c){this.x=b;this.y=c;return this},copy:function(b){this.x=b.x;this.y=b.y;return this},clone:function(){return new THREE.Vector2(this.x,this.y)},add:function(b,c){this.x=b.x+c.x;this.y=b.y+c.y;return this},addSelf:function(b){this.x+=b.x;this.y+=b.y;return this},sub:function(b,c){this.x=b.x-c.x;this.y=b.y-c.y;return this},subSelf:function(b){this.x-=b.x;this.y-=b.y;return this},multiplyScalar:function(b){this.x*=b;this.y*=b;return this},
divideScalar:function(b){b?(this.x/=b,this.y/=b):this.set(0,0);return this},negate:function(){return this.multiplyScalar(-1)},dot:function(b){return this.x*b.x+this.y*b.y},lengthSq:function(){return this.x*this.x+this.y*this.y},length:function(){return Math.sqrt(this.lengthSq())},normalize:function(){return this.divideScalar(this.length())},distanceTo:function(b){return Math.sqrt(this.distanceToSquared(b))},distanceToSquared:function(b){var c=this.x-b.x,b=this.y-b.y;return c*c+b*b},setLength:function(b){return this.normalize().multiplyScalar(b)},
equals:function(b){return b.x==this.x&&b.y==this.y}};THREE.Vector3=function(b,c,e){this.x=b||0;this.y=c||0;this.z=e||0};
THREE.Vector3.prototype={constructor:THREE.Vector3,set:function(b,c,e){this.x=b;this.y=c;this.z=e;return this},copy:function(b){this.x=b.x;this.y=b.y;this.z=b.z;return this},clone:function(){return new THREE.Vector3(this.x,this.y,this.z)},add:function(b,c){this.x=b.x+c.x;this.y=b.y+c.y;this.z=b.z+c.z;return this},addSelf:function(b){this.x+=b.x;this.y+=b.y;this.z+=b.z;return this},addScalar:function(b){this.x+=b;this.y+=b;this.z+=b;return this},sub:function(b,c){this.x=b.x-c.x;this.y=b.y-c.y;this.z=
b.z-c.z;return this},subSelf:function(b){this.x-=b.x;this.y-=b.y;this.z-=b.z;return this},multiply:function(b,c){this.x=b.x*c.x;this.y=b.y*c.y;this.z=b.z*c.z;return this},multiplySelf:function(b){this.x*=b.x;this.y*=b.y;this.z*=b.z;return this},multiplyScalar:function(b){this.x*=b;this.y*=b;this.z*=b;return this},divideSelf:function(b){this.x/=b.x;this.y/=b.y;this.z/=b.z;return this},divideScalar:function(b){b?(this.x/=b,this.y/=b,this.z/=b):this.set(0,0,0);return this},negate:function(){return this.multiplyScalar(-1)},
dot:function(b){return this.x*b.x+this.y*b.y+this.z*b.z},lengthSq:function(){return this.x*this.x+this.y*this.y+this.z*this.z},length:function(){return Math.sqrt(this.lengthSq())},lengthManhattan:function(){return this.x+this.y+this.z},normalize:function(){return this.divideScalar(this.length())},setLength:function(b){return this.normalize().multiplyScalar(b)},cross:function(b,c){this.x=b.y*c.z-b.z*c.y;this.y=b.z*c.x-b.x*c.z;this.z=b.x*c.y-b.y*c.x;return this},crossSelf:function(b){return this.set(this.y*
b.z-this.z*b.y,this.z*b.x-this.x*b.z,this.x*b.y-this.y*b.x)},distanceTo:function(b){return Math.sqrt(this.distanceToSquared(b))},distanceToSquared:function(b){return(new THREE.Vector3).sub(this,b).lengthSq()},setPositionFromMatrix:function(b){this.x=b.n14;this.y=b.n24;this.z=b.n34},setRotationFromMatrix:function(b){var c=Math.cos(this.y);this.y=Math.asin(b.n13);Math.abs(c)>1.0E-5?(this.x=Math.atan2(-b.n23/c,b.n33/c),this.z=Math.atan2(-b.n12/c,b.n11/c)):(this.x=0,this.z=Math.atan2(b.n21,b.n22))},isZero:function(){return this.lengthSq()<
1.0E-4}};THREE.Vector4=function(b,c,e,f){this.x=b||0;this.y=c||0;this.z=e||0;this.w=f||1};
THREE.Vector4.prototype={constructor:THREE.Vector4,set:function(b,c,e,f){this.x=b;this.y=c;this.z=e;this.w=f;return this},copy:function(b){this.x=b.x;this.y=b.y;this.z=b.z;this.w=b.w||1},clone:function(){return new THREE.Vector4(this.x,this.y,this.z,this.w)},add:function(b,c){this.x=b.x+c.x;this.y=b.y+c.y;this.z=b.z+c.z;this.w=b.w+c.w;return this},addSelf:function(b){this.x+=b.x;this.y+=b.y;this.z+=b.z;this.w+=b.w;return this},sub:function(b,c){this.x=b.x-c.x;this.y=b.y-c.y;this.z=b.z-c.z;this.w=
b.w-c.w;return this},subSelf:function(b){this.x-=b.x;this.y-=b.y;this.z-=b.z;this.w-=b.w;return this},multiplyScalar:function(b){this.x*=b;this.y*=b;this.z*=b;this.w*=b;return this},divideScalar:function(b){b?(this.x/=b,this.y/=b,this.z/=b,this.w/=b):(this.z=this.y=this.x=0,this.w=1);return this},negate:function(){return this.multiplyScalar(-1)},dot:function(b){return this.x*b.x+this.y*b.y+this.z*b.z+this.w*b.w},lengthSq:function(){return this.dot(this)},length:function(){return Math.sqrt(this.lengthSq())},
normalize:function(){return this.divideScalar(this.length())},setLength:function(b){return this.normalize().multiplyScalar(b)},lerpSelf:function(b,c){this.x+=(b.x-this.x)*c;this.y+=(b.y-this.y)*c;this.z+=(b.z-this.z)*c;this.w+=(b.w-this.w)*c;return this}};THREE.Ray=function(b,c){this.origin=b||new THREE.Vector3;this.direction=c||new THREE.Vector3};
THREE.Ray.prototype={constructor:THREE.Ray,intersectScene:function(b){return this.intersectObjects(b.objects)},intersectObjects:function(b){var c,e,f=[];c=0;for(e=b.length;c<e;c++)f=f.concat(this.intersectObject(b[c]));f.sort(function(b,e){return b.distance-e.distance});return f},intersectObject:function(b){function c(b,e,c){var f;f=c.clone().subSelf(b).dot(e);if(f<=0)return null;b=b.clone().addSelf(e.clone().multiplyScalar(f));return c.distanceTo(b)}function e(b,e,c,f){var f=f.clone().subSelf(e),
c=c.clone().subSelf(e),h=b.clone().subSelf(e),b=f.dot(f),e=f.dot(c),f=f.dot(h),k=c.dot(c),c=c.dot(h),h=1/(b*k-e*e),k=(k*f-e*c)*h,b=(b*c-e*f)*h;return k>0&&b>0&&k+b<1}if(b instanceof THREE.Particle){var f=c(this.origin,this.direction,b.matrixWorld.getPosition());if(f==null||f>b.scale.x)return[];return[{distance:f,point:b.position,face:null,object:b}]}else if(b instanceof THREE.Mesh){f=c(this.origin,this.direction,b.matrixWorld.getPosition());if(f==null||f>b.geometry.boundingSphere.radius*Math.max(b.scale.x,
Math.max(b.scale.y,b.scale.z)))return[];var h,m,k,n,u,p,v,t,x,w,z=b.geometry,y=z.vertices,B=[],f=0;for(h=z.faces.length;f<h;f++)if(m=z.faces[f],x=this.origin.clone(),w=this.direction.clone(),p=b.matrixWorld,k=p.multiplyVector3(m.centroid.clone()).subSelf(x),t=k.dot(w),!(t<=0)&&(k=p.multiplyVector3(y[m.a].position.clone()),n=p.multiplyVector3(y[m.b].position.clone()),u=p.multiplyVector3(y[m.c].position.clone()),p=m instanceof THREE.Face4?p.multiplyVector3(y[m.d].position.clone()):null,v=b.matrixRotationWorld.multiplyVector3(m.normal.clone()),
t=w.dot(v),b.doubleSided||(b.flipSided?t>0:t<0)))if(t=v.dot((new THREE.Vector3).sub(k,x))/t,x=x.addSelf(w.multiplyScalar(t)),m instanceof THREE.Face3)e(x,k,n,u)&&(m={distance:this.origin.distanceTo(x),point:x,face:m,object:b},B.push(m));else if(m instanceof THREE.Face4&&(e(x,k,n,p)||e(x,n,u,p)))m={distance:this.origin.distanceTo(x),point:x,face:m,object:b},B.push(m);B.sort(function(b,e){return b.distance-e.distance});return B}else return[]}};
THREE.Rectangle=function(){function b(){m=f-c;k=h-e}var c,e,f,h,m,k,n=!0;this.getX=function(){return c};this.getY=function(){return e};this.getWidth=function(){return m};this.getHeight=function(){return k};this.getLeft=function(){return c};this.getTop=function(){return e};this.getRight=function(){return f};this.getBottom=function(){return h};this.set=function(k,m,v,t){n=!1;c=k;e=m;f=v;h=t;b()};this.addPoint=function(k,m){n?(n=!1,c=k,e=m,f=k,h=m):(c=c<k?c:k,e=e<m?e:m,f=f>k?f:k,h=h>m?h:m);b()};this.add3Points=
function(k,m,v,t,x,w){n?(n=!1,c=k<v?k<x?k:x:v<x?v:x,e=m<t?m<w?m:w:t<w?t:w,f=k>v?k>x?k:x:v>x?v:x,h=m>t?m>w?m:w:t>w?t:w):(c=k<v?k<x?k<c?k:c:x<c?x:c:v<x?v<c?v:c:x<c?x:c,e=m<t?m<w?m<e?m:e:w<e?w:e:t<w?t<e?t:e:w<e?w:e,f=k>v?k>x?k>f?k:f:x>f?x:f:v>x?v>f?v:f:x>f?x:f,h=m>t?m>w?m>h?m:h:w>h?w:h:t>w?t>h?t:h:w>h?w:h);b()};this.addRectangle=function(k){n?(n=!1,c=k.getLeft(),e=k.getTop(),f=k.getRight(),h=k.getBottom()):(c=c<k.getLeft()?c:k.getLeft(),e=e<k.getTop()?e:k.getTop(),f=f>k.getRight()?f:k.getRight(),h=h>
k.getBottom()?h:k.getBottom());b()};this.inflate=function(k){c-=k;e-=k;f+=k;h+=k;b()};this.minSelf=function(k){c=c>k.getLeft()?c:k.getLeft();e=e>k.getTop()?e:k.getTop();f=f<k.getRight()?f:k.getRight();h=h<k.getBottom()?h:k.getBottom();b()};this.instersects=function(b){return Math.min(f,b.getRight())-Math.max(c,b.getLeft())>=0&&Math.min(h,b.getBottom())-Math.max(e,b.getTop())>=0};this.empty=function(){n=!0;h=f=e=c=0;b()};this.isEmpty=function(){return n}};THREE.Matrix3=function(){this.m=[]};
THREE.Matrix3.prototype={constructor:THREE.Matrix3,transpose:function(){var b,c=this.m;b=c[1];c[1]=c[3];c[3]=b;b=c[2];c[2]=c[6];c[6]=b;b=c[5];c[5]=c[7];c[7]=b;return this},transposeIntoArray:function(b){var c=this.m;b[0]=c[0];b[1]=c[3];b[2]=c[6];b[3]=c[1];b[4]=c[4];b[5]=c[7];b[6]=c[2];b[7]=c[5];b[8]=c[8];return this}};THREE.Matrix4=function(b,c,e,f,h,m,k,n,u,p,v,t,x,w,z,y){this.set(b||1,c||0,e||0,f||0,h||0,m||1,k||0,n||0,u||0,p||0,v||1,t||0,x||0,w||0,z||0,y||1);this.flat=Array(16);this.m33=new THREE.Matrix3};
THREE.Matrix4.prototype={constructor:THREE.Matrix4,set:function(b,c,e,f,h,m,k,n,u,p,v,t,x,w,z,y){this.n11=b;this.n12=c;this.n13=e;this.n14=f;this.n21=h;this.n22=m;this.n23=k;this.n24=n;this.n31=u;this.n32=p;this.n33=v;this.n34=t;this.n41=x;this.n42=w;this.n43=z;this.n44=y;return this},identity:function(){this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1);return this},copy:function(b){this.set(b.n11,b.n12,b.n13,b.n14,b.n21,b.n22,b.n23,b.n24,b.n31,b.n32,b.n33,b.n34,b.n41,b.n42,b.n43,b.n44);return this},lookAt:function(b,
c,e){var f=THREE.Matrix4.__v1,h=THREE.Matrix4.__v2,m=THREE.Matrix4.__v3;m.sub(b,c).normalize();if(m.length()===0)m.z=1;f.cross(e,m).normalize();f.length()===0&&(m.x+=1.0E-4,f.cross(e,m).normalize());h.cross(m,f).normalize();this.n11=f.x;this.n12=h.x;this.n13=m.x;this.n21=f.y;this.n22=h.y;this.n23=m.y;this.n31=f.z;this.n32=h.z;this.n33=m.z;return this},multiplyVector3:function(b){var c=b.x,e=b.y,f=b.z,h=1/(this.n41*c+this.n42*e+this.n43*f+this.n44);b.x=(this.n11*c+this.n12*e+this.n13*f+this.n14)*h;
b.y=(this.n21*c+this.n22*e+this.n23*f+this.n24)*h;b.z=(this.n31*c+this.n32*e+this.n33*f+this.n34)*h;return b},multiplyVector4:function(b){var c=b.x,e=b.y,f=b.z,h=b.w;b.x=this.n11*c+this.n12*e+this.n13*f+this.n14*h;b.y=this.n21*c+this.n22*e+this.n23*f+this.n24*h;b.z=this.n31*c+this.n32*e+this.n33*f+this.n34*h;b.w=this.n41*c+this.n42*e+this.n43*f+this.n44*h;return b},rotateAxis:function(b){var c=b.x,e=b.y,f=b.z;b.x=c*this.n11+e*this.n12+f*this.n13;b.y=c*this.n21+e*this.n22+f*this.n23;b.z=c*this.n31+
e*this.n32+f*this.n33;b.normalize();return b},crossVector:function(b){var c=new THREE.Vector4;c.x=this.n11*b.x+this.n12*b.y+this.n13*b.z+this.n14*b.w;c.y=this.n21*b.x+this.n22*b.y+this.n23*b.z+this.n24*b.w;c.z=this.n31*b.x+this.n32*b.y+this.n33*b.z+this.n34*b.w;c.w=b.w?this.n41*b.x+this.n42*b.y+this.n43*b.z+this.n44*b.w:1;return c},multiply:function(b,c){var e=b.n11,f=b.n12,h=b.n13,m=b.n14,k=b.n21,n=b.n22,u=b.n23,p=b.n24,v=b.n31,t=b.n32,x=b.n33,w=b.n34,z=b.n41,y=b.n42,B=b.n43,D=b.n44,G=c.n11,H=c.n12,
E=c.n13,N=c.n14,F=c.n21,I=c.n22,C=c.n23,K=c.n24,U=c.n31,L=c.n32,O=c.n33,S=c.n34,P=c.n41,o=c.n42,W=c.n43,na=c.n44;this.n11=e*G+f*F+h*U+m*P;this.n12=e*H+f*I+h*L+m*o;this.n13=e*E+f*C+h*O+m*W;this.n14=e*N+f*K+h*S+m*na;this.n21=k*G+n*F+u*U+p*P;this.n22=k*H+n*I+u*L+p*o;this.n23=k*E+n*C+u*O+p*W;this.n24=k*N+n*K+u*S+p*na;this.n31=v*G+t*F+x*U+w*P;this.n32=v*H+t*I+x*L+w*o;this.n33=v*E+t*C+x*O+w*W;this.n34=v*N+t*K+x*S+w*na;this.n41=z*G+y*F+B*U+D*P;this.n42=z*H+y*I+B*L+D*o;this.n43=z*E+y*C+B*O+D*W;this.n44=z*
N+y*K+B*S+D*na;return this},multiplyToArray:function(b,c,e){this.multiply(b,c);e[0]=this.n11;e[1]=this.n21;e[2]=this.n31;e[3]=this.n41;e[4]=this.n12;e[5]=this.n22;e[6]=this.n32;e[7]=this.n42;e[8]=this.n13;e[9]=this.n23;e[10]=this.n33;e[11]=this.n43;e[12]=this.n14;e[13]=this.n24;e[14]=this.n34;e[15]=this.n44;return this},multiplySelf:function(b){this.multiply(this,b);return this},multiplyScalar:function(b){this.n11*=b;this.n12*=b;this.n13*=b;this.n14*=b;this.n21*=b;this.n22*=b;this.n23*=b;this.n24*=
b;this.n31*=b;this.n32*=b;this.n33*=b;this.n34*=b;this.n41*=b;this.n42*=b;this.n43*=b;this.n44*=b;return this},determinant:function(){var b=this.n11,c=this.n12,e=this.n13,f=this.n14,h=this.n21,m=this.n22,k=this.n23,n=this.n24,u=this.n31,p=this.n32,v=this.n33,t=this.n34,x=this.n41,w=this.n42,z=this.n43,y=this.n44;return f*k*p*x-e*n*p*x-f*m*v*x+c*n*v*x+e*m*t*x-c*k*t*x-f*k*u*w+e*n*u*w+f*h*v*w-b*n*v*w-e*h*t*w+b*k*t*w+f*m*u*z-c*n*u*z-f*h*p*z+b*n*p*z+c*h*t*z-b*m*t*z-e*m*u*y+c*k*u*y+e*h*p*y-b*k*p*y-c*h*
v*y+b*m*v*y},transpose:function(){var b;b=this.n21;this.n21=this.n12;this.n12=b;b=this.n31;this.n31=this.n13;this.n13=b;b=this.n32;this.n32=this.n23;this.n23=b;b=this.n41;this.n41=this.n14;this.n14=b;b=this.n42;this.n42=this.n24;this.n24=b;b=this.n43;this.n43=this.n34;this.n43=b;return this},clone:function(){var b=new THREE.Matrix4;b.n11=this.n11;b.n12=this.n12;b.n13=this.n13;b.n14=this.n14;b.n21=this.n21;b.n22=this.n22;b.n23=this.n23;b.n24=this.n24;b.n31=this.n31;b.n32=this.n32;b.n33=this.n33;b.n34=
this.n34;b.n41=this.n41;b.n42=this.n42;b.n43=this.n43;b.n44=this.n44;return b},flatten:function(){this.flat[0]=this.n11;this.flat[1]=this.n21;this.flat[2]=this.n31;this.flat[3]=this.n41;this.flat[4]=this.n12;this.flat[5]=this.n22;this.flat[6]=this.n32;this.flat[7]=this.n42;this.flat[8]=this.n13;this.flat[9]=this.n23;this.flat[10]=this.n33;this.flat[11]=this.n43;this.flat[12]=this.n14;this.flat[13]=this.n24;this.flat[14]=this.n34;this.flat[15]=this.n44;return this.flat},flattenToArray:function(b){b[0]=
this.n11;b[1]=this.n21;b[2]=this.n31;b[3]=this.n41;b[4]=this.n12;b[5]=this.n22;b[6]=this.n32;b[7]=this.n42;b[8]=this.n13;b[9]=this.n23;b[10]=this.n33;b[11]=this.n43;b[12]=this.n14;b[13]=this.n24;b[14]=this.n34;b[15]=this.n44;return b},flattenToArrayOffset:function(b,c){b[c]=this.n11;b[c+1]=this.n21;b[c+2]=this.n31;b[c+3]=this.n41;b[c+4]=this.n12;b[c+5]=this.n22;b[c+6]=this.n32;b[c+7]=this.n42;b[c+8]=this.n13;b[c+9]=this.n23;b[c+10]=this.n33;b[c+11]=this.n43;b[c+12]=this.n14;b[c+13]=this.n24;b[c+14]=
this.n34;b[c+15]=this.n44;return b},setTranslation:function(b,c,e){this.set(1,0,0,b,0,1,0,c,0,0,1,e,0,0,0,1);return this},setScale:function(b,c,e){this.set(b,0,0,0,0,c,0,0,0,0,e,0,0,0,0,1);return this},setRotationX:function(b){var c=Math.cos(b),b=Math.sin(b);this.set(1,0,0,0,0,c,-b,0,0,b,c,0,0,0,0,1);return this},setRotationY:function(b){var c=Math.cos(b),b=Math.sin(b);this.set(c,0,b,0,0,1,0,0,-b,0,c,0,0,0,0,1);return this},setRotationZ:function(b){var c=Math.cos(b),b=Math.sin(b);this.set(c,-b,0,
0,b,c,0,0,0,0,1,0,0,0,0,1);return this},setRotationAxis:function(b,c){var e=Math.cos(c),f=Math.sin(c),h=1-e,m=b.x,k=b.y,n=b.z,u=h*m,p=h*k;this.set(u*m+e,u*k-f*n,u*n+f*k,0,u*k+f*n,p*k+e,p*n-f*m,0,u*n-f*k,p*n+f*m,h*n*n+e,0,0,0,0,1);return this},setPosition:function(b){this.n14=b.x;this.n24=b.y;this.n34=b.z;return this},getPosition:function(){if(!this.position)this.position=new THREE.Vector3;this.position.set(this.n14,this.n24,this.n34);return this.position},getColumnX:function(){if(!this.columnX)this.columnX=
new THREE.Vector3;this.columnX.set(this.n11,this.n21,this.n31);return this.columnX},getColumnY:function(){if(!this.columnY)this.columnY=new THREE.Vector3;this.columnY.set(this.n12,this.n22,this.n32);return this.columnY},getColumnZ:function(){if(!this.columnZ)this.columnZ=new THREE.Vector3;this.columnZ.set(this.n13,this.n23,this.n33);return this.columnZ},setRotationFromEuler:function(b,c){var e=b.x,f=b.y,h=b.z,m=Math.cos(e),e=Math.sin(e),k=Math.cos(f),f=Math.sin(f),n=Math.cos(h),h=Math.sin(h);switch(c){case "YXZ":var u=
k*n,p=k*h,v=f*n,t=f*h;this.n11=u+t*e;this.n12=v*e-p;this.n13=m*f;this.n21=m*h;this.n22=m*n;this.n23=-e;this.n31=p*e-v;this.n32=t+u*e;this.n33=m*k;break;case "ZXY":u=k*n;p=k*h;v=f*n;t=f*h;this.n11=u-t*e;this.n12=-m*h;this.n13=v+p*e;this.n21=p+v*e;this.n22=m*n;this.n23=t-u*e;this.n31=-m*f;this.n32=e;this.n33=m*k;break;case "ZYX":u=m*n;p=m*h;v=e*n;t=e*h;this.n11=k*n;this.n12=v*f-p;this.n13=u*f+t;this.n21=k*h;this.n22=t*f+u;this.n23=p*f-v;this.n31=-f;this.n32=e*k;this.n33=m*k;break;case "YZX":u=m*k;p=
m*f;v=e*k;t=e*f;this.n11=k*n;this.n12=t-u*h;this.n13=v*h+p;this.n21=h;this.n22=m*n;this.n23=-e*n;this.n31=-f*n;this.n32=p*h+v;this.n33=u-t*h;break;case "XZY":u=m*k;p=m*f;v=e*k;t=e*f;this.n11=k*n;this.n12=-h;this.n13=f*n;this.n21=u*h+t;this.n22=m*n;this.n23=p*h-v;this.n31=v*h-p;this.n32=e*n;this.n33=t*h+u;break;default:u=m*n,p=m*h,v=e*n,t=e*h,this.n11=k*n,this.n12=-k*h,this.n13=f,this.n21=p+v*f,this.n22=u-t*f,this.n23=-e*k,this.n31=t-u*f,this.n32=v+p*f,this.n33=m*k}return this},setRotationFromQuaternion:function(b){var c=
b.x,e=b.y,f=b.z,h=b.w,m=c+c,k=e+e,n=f+f,b=c*m,u=c*k;c*=n;var p=e*k;e*=n;f*=n;m*=h;k*=h;h*=n;this.n11=1-(p+f);this.n12=u-h;this.n13=c+k;this.n21=u+h;this.n22=1-(b+f);this.n23=e-m;this.n31=c-k;this.n32=e+m;this.n33=1-(b+p);return this},scale:function(b){var c=b.x,e=b.y,b=b.z;this.n11*=c;this.n12*=e;this.n13*=b;this.n21*=c;this.n22*=e;this.n23*=b;this.n31*=c;this.n32*=e;this.n33*=b;this.n41*=c;this.n42*=e;this.n43*=b;return this},compose:function(b,c,e){var f=THREE.Matrix4.__m1,h=THREE.Matrix4.__m2;
f.identity();f.setRotationFromQuaternion(c);h.setScale(e.x,e.y,e.z);this.multiply(f,h);this.n14=b.x;this.n24=b.y;this.n34=b.z;return this},decompose:function(b,c,e){var f=THREE.Matrix4.__v1,h=THREE.Matrix4.__v2,m=THREE.Matrix4.__v3;f.set(this.n11,this.n21,this.n31);h.set(this.n12,this.n22,this.n32);m.set(this.n13,this.n23,this.n33);b=b instanceof THREE.Vector3?b:new THREE.Vector3;c=c instanceof THREE.Quaternion?c:new THREE.Quaternion;e=e instanceof THREE.Vector3?e:new THREE.Vector3;e.x=f.length();
e.y=h.length();e.z=m.length();b.x=this.n14;b.y=this.n24;b.z=this.n34;f=THREE.Matrix4.__m1;f.copy(this);f.n11/=e.x;f.n21/=e.x;f.n31/=e.x;f.n12/=e.y;f.n22/=e.y;f.n32/=e.y;f.n13/=e.z;f.n23/=e.z;f.n33/=e.z;c.setFromRotationMatrix(f);return[b,c,e]},extractPosition:function(b){this.n14=b.n14;this.n24=b.n24;this.n34=b.n34},extractRotation:function(b,c){var e=1/c.x,f=1/c.y,h=1/c.z;this.n11=b.n11*e;this.n21=b.n21*e;this.n31=b.n31*e;this.n12=b.n12*f;this.n22=b.n22*f;this.n32=b.n32*f;this.n13=b.n13*h;this.n23=
b.n23*h;this.n33=b.n33*h}};
THREE.Matrix4.makeInvert=function(b,c){var e=b.n11,f=b.n12,h=b.n13,m=b.n14,k=b.n21,n=b.n22,u=b.n23,p=b.n24,v=b.n31,t=b.n32,x=b.n33,w=b.n34,z=b.n41,y=b.n42,B=b.n43,D=b.n44;c===void 0&&(c=new THREE.Matrix4);c.n11=u*w*y-p*x*y+p*t*B-n*w*B-u*t*D+n*x*D;c.n12=m*x*y-h*w*y-m*t*B+f*w*B+h*t*D-f*x*D;c.n13=h*p*y-m*u*y+m*n*B-f*p*B-h*n*D+f*u*D;c.n14=m*u*t-h*p*t-m*n*x+f*p*x+h*n*w-f*u*w;c.n21=p*x*z-u*w*z-p*v*B+k*w*B+u*v*D-k*x*D;c.n22=h*w*z-m*x*z+m*v*B-e*w*B-h*v*D+e*x*D;c.n23=m*u*z-h*p*z-m*k*B+e*p*B+h*k*D-e*u*D;c.n24=
h*p*v-m*u*v+m*k*x-e*p*x-h*k*w+e*u*w;c.n31=n*w*z-p*t*z+p*v*y-k*w*y-n*v*D+k*t*D;c.n32=m*t*z-f*w*z-m*v*y+e*w*y+f*v*D-e*t*D;c.n33=h*p*z-m*n*z+m*k*y-e*p*y-f*k*D+e*n*D;c.n34=m*n*v-f*p*v-m*k*t+e*p*t+f*k*w-e*n*w;c.n41=u*t*z-n*x*z-u*v*y+k*x*y+n*v*B-k*t*B;c.n42=f*x*z-h*t*z+h*v*y-e*x*y-f*v*B+e*t*B;c.n43=h*n*z-f*u*z-h*k*y+e*u*y+f*k*B-e*n*B;c.n44=f*u*v-h*n*v+h*k*t-e*u*t-f*k*x+e*n*x;c.multiplyScalar(1/b.determinant());return c};
THREE.Matrix4.makeInvert3x3=function(b){var c=b.m33,e=c.m,f=b.n33*b.n22-b.n32*b.n23,h=-b.n33*b.n21+b.n31*b.n23,m=b.n32*b.n21-b.n31*b.n22,k=-b.n33*b.n12+b.n32*b.n13,n=b.n33*b.n11-b.n31*b.n13,u=-b.n32*b.n11+b.n31*b.n12,p=b.n23*b.n12-b.n22*b.n13,v=-b.n23*b.n11+b.n21*b.n13,t=b.n22*b.n11-b.n21*b.n12,b=b.n11*f+b.n21*k+b.n31*p;b==0&&console.error("THREE.Matrix4.makeInvert3x3: Matrix not invertible.");b=1/b;e[0]=b*f;e[1]=b*h;e[2]=b*m;e[3]=b*k;e[4]=b*n;e[5]=b*u;e[6]=b*p;e[7]=b*v;e[8]=b*t;return c};
THREE.Matrix4.makeFrustum=function(b,c,e,f,h,m){var k;k=new THREE.Matrix4;k.n11=2*h/(c-b);k.n12=0;k.n13=(c+b)/(c-b);k.n14=0;k.n21=0;k.n22=2*h/(f-e);k.n23=(f+e)/(f-e);k.n24=0;k.n31=0;k.n32=0;k.n33=-(m+h)/(m-h);k.n34=-2*m*h/(m-h);k.n41=0;k.n42=0;k.n43=-1;k.n44=0;return k};THREE.Matrix4.makePerspective=function(b,c,e,f){var h,b=e*Math.tan(b*Math.PI/360);h=-b;return THREE.Matrix4.makeFrustum(h*c,b*c,h,b,e,f)};
THREE.Matrix4.makeOrtho=function(b,c,e,f,h,m){var k,n,u,p;k=new THREE.Matrix4;n=c-b;u=e-f;p=m-h;k.n11=2/n;k.n12=0;k.n13=0;k.n14=-((c+b)/n);k.n21=0;k.n22=2/u;k.n23=0;k.n24=-((e+f)/u);k.n31=0;k.n32=0;k.n33=-2/p;k.n34=-((m+h)/p);k.n41=0;k.n42=0;k.n43=0;k.n44=1;return k};THREE.Matrix4.__v1=new THREE.Vector3;THREE.Matrix4.__v2=new THREE.Vector3;THREE.Matrix4.__v3=new THREE.Vector3;THREE.Matrix4.__m1=new THREE.Matrix4;THREE.Matrix4.__m2=new THREE.Matrix4;
THREE.Object3D=function(){this.id=THREE.Object3DCount++;this.name="";this.parent=void 0;this.children=[];this.up=new THREE.Vector3(0,1,0);this.position=new THREE.Vector3;this.rotation=new THREE.Vector3;this.eulerOrder="XYZ";this.scale=new THREE.Vector3(1,1,1);this.flipSided=this.doubleSided=this.dynamic=!1;this.renderDepth=null;this.rotationAutoUpdate=!0;this.matrix=new THREE.Matrix4;this.matrixWorld=new THREE.Matrix4;this.matrixRotationWorld=new THREE.Matrix4;this.matrixWorldNeedsUpdate=this.matrixAutoUpdate=
!0;this.quaternion=new THREE.Quaternion;this.useQuaternion=!1;this.boundRadius=0;this.boundRadiusScale=1;this.visible=!0;this.receiveShadow=this.castShadow=!1;this.frustumCulled=!0;this._vector=new THREE.Vector3};
THREE.Object3D.prototype={constructor:THREE.Object3D,translate:function(b,c){this.matrix.rotateAxis(c);this.position.addSelf(c.multiplyScalar(b))},translateX:function(b){this.translate(b,this._vector.set(1,0,0))},translateY:function(b){this.translate(b,this._vector.set(0,1,0))},translateZ:function(b){this.translate(b,this._vector.set(0,0,1))},lookAt:function(b){this.matrix.lookAt(b,this.position,this.up);this.rotationAutoUpdate&&this.rotation.setRotationFromMatrix(this.matrix)},addChild:function(b){if(this.children.indexOf(b)===
-1){b.parent!==void 0&&b.parent.removeChild(b);b.parent=this;this.children.push(b);for(var c=this;c.parent!==void 0;)c=c.parent;c!==void 0&&c instanceof THREE.Scene&&c.addChildRecurse(b)}},removeChild:function(b){var c=this,e=this.children.indexOf(b);if(e!==-1){b.parent=void 0;for(this.children.splice(e,1);c.parent!==void 0;)c=c.parent;c!==void 0&&c instanceof THREE.Scene&&c.removeChildRecurse(b)}},getChildByName:function(b,c){var e,f,h;e=0;for(f=this.children.length;e<f;e++){h=this.children[e];if(h.name===
b)return h;if(c&&(h=h.getChildByName(b,c),h!==void 0))return h}},updateMatrix:function(){this.matrix.setPosition(this.position);this.useQuaternion?this.matrix.setRotationFromQuaternion(this.quaternion):this.matrix.setRotationFromEuler(this.rotation,this.eulerOrder);if(this.scale.x!==1||this.scale.y!==1||this.scale.z!==1)this.matrix.scale(this.scale),this.boundRadiusScale=Math.max(this.scale.x,Math.max(this.scale.y,this.scale.z));this.matrixWorldNeedsUpdate=!0},update:function(b,c,e){this.matrixAutoUpdate&&
this.updateMatrix();if(this.matrixWorldNeedsUpdate||c)b?this.matrixWorld.multiply(b,this.matrix):this.matrixWorld.copy(this.matrix),this.matrixRotationWorld.extractRotation(this.matrixWorld,this.scale),this.matrixWorldNeedsUpdate=!1,c=!0;for(var b=0,f=this.children.length;b<f;b++)this.children[b].update(this.matrixWorld,c,e)}};THREE.Object3DCount=0;
THREE.Projector=function(){function b(){var b=u[n]=u[n]||new THREE.RenderableVertex;n++;return b}function c(b,e){return e.z-b.z}function e(b,e){var c=0,f=1,k=b.z+b.w,h=e.z+e.w,m=-b.z+b.w,n=-e.z+e.w;return k>=0&&h>=0&&m>=0&&n>=0?!0:k<0&&h<0||m<0&&n<0?!1:(k<0?c=Math.max(c,k/(k-h)):h<0&&(f=Math.min(f,k/(k-h))),m<0?c=Math.max(c,m/(m-n)):n<0&&(f=Math.min(f,m/(m-n))),f<c?!1:(b.lerpSelf(e,c),e.lerpSelf(b,1-f),!0))}var f,h,m=[],k,n,u=[],p,v,t=[],x,w=[],z,y,B=[],D,G,H=[],E=[],N=[],F=new THREE.Vector4,I=new THREE.Vector4,
C=new THREE.Matrix4,K=new THREE.Matrix4,U=[new THREE.Vector4,new THREE.Vector4,new THREE.Vector4,new THREE.Vector4,new THREE.Vector4,new THREE.Vector4],L=new THREE.Vector4,O=new THREE.Vector4;this.projectVector=function(b,e){C.multiply(e.projectionMatrix,e.matrixWorldInverse);C.multiplyVector3(b);return b};this.unprojectVector=function(b,e){C.multiply(e.matrixWorld,THREE.Matrix4.makeInvert(e.projectionMatrix));C.multiplyVector3(b);return b};this.projectObjects=function(b,e,k){var n,u;h=E.length=0;
n=b.objects;b=0;for(e=n.length;b<e;b++){u=n[b];var w;if(!(w=!u.visible))if(w=u instanceof THREE.Mesh)if(w=u.frustumCulled){a:{w=void 0;for(var t=u.matrixWorld,p=-u.geometry.boundingSphere.radius*Math.max(u.scale.x,Math.max(u.scale.y,u.scale.z)),v=0;v<6;v++)if(w=U[v].x*t.n14+U[v].y*t.n24+U[v].z*t.n34+U[v].w,w<=p){w=!1;break a}w=!0}w=!w}if(!w)w=m[h]=m[h]||new THREE.RenderableObject,h++,f=w,F.copy(u.position),C.multiplyVector3(F),f.object=u,f.z=F.z,E.push(f)}k&&E.sort(c);return E};this.projectScene=
function(f,h,m){var E=h.near,F=h.far,R,ia,aa,ma,fa,ga,da,$,ca,X,ja,ea,qa,V,pa,va,ra;G=y=x=v=N.length=0;h.matrixAutoUpdate&&h.update(void 0,!0);f.update(void 0,!1,h);C.multiply(h.projectionMatrix,h.matrixWorldInverse);U[0].set(C.n41-C.n11,C.n42-C.n12,C.n43-C.n13,C.n44-C.n14);U[1].set(C.n41+C.n11,C.n42+C.n12,C.n43+C.n13,C.n44+C.n14);U[2].set(C.n41+C.n21,C.n42+C.n22,C.n43+C.n23,C.n44+C.n24);U[3].set(C.n41-C.n21,C.n42-C.n22,C.n43-C.n23,C.n44-C.n24);U[4].set(C.n41-C.n31,C.n42-C.n32,C.n43-C.n33,C.n44-C.n34);
U[5].set(C.n41+C.n31,C.n42+C.n32,C.n43+C.n33,C.n44+C.n34);for(R=0;R<6;R++)ca=U[R],ca.divideScalar(Math.sqrt(ca.x*ca.x+ca.y*ca.y+ca.z*ca.z));ca=this.projectObjects(f,h,!0);f=0;for(R=ca.length;f<R;f++)if(X=ca[f].object,X.visible)if(ja=X.matrixWorld,ea=X.matrixRotationWorld,qa=X.materials,V=X.overdraw,n=0,X instanceof THREE.Mesh){pa=X.geometry;ma=pa.vertices;va=pa.faces;pa=pa.faceVertexUvs;ia=0;for(aa=ma.length;ia<aa;ia++)k=b(),k.positionWorld.copy(ma[ia].position),ja.multiplyVector3(k.positionWorld),
k.positionScreen.copy(k.positionWorld),C.multiplyVector4(k.positionScreen),k.positionScreen.x/=k.positionScreen.w,k.positionScreen.y/=k.positionScreen.w,k.visible=k.positionScreen.z>E&&k.positionScreen.z<F;ma=0;for(ia=va.length;ma<ia;ma++){aa=va[ma];if(aa instanceof THREE.Face3)if(fa=u[aa.a],ga=u[aa.b],da=u[aa.c],fa.visible&&ga.visible&&da.visible&&(X.doubleSided||X.flipSided!=(da.positionScreen.x-fa.positionScreen.x)*(ga.positionScreen.y-fa.positionScreen.y)-(da.positionScreen.y-fa.positionScreen.y)*
(ga.positionScreen.x-fa.positionScreen.x)<0))$=t[v]=t[v]||new THREE.RenderableFace3,v++,p=$,p.v1.copy(fa),p.v2.copy(ga),p.v3.copy(da);else continue;else if(aa instanceof THREE.Face4)if(fa=u[aa.a],ga=u[aa.b],da=u[aa.c],$=u[aa.d],fa.visible&&ga.visible&&da.visible&&$.visible&&(X.doubleSided||X.flipSided!=(($.positionScreen.x-fa.positionScreen.x)*(ga.positionScreen.y-fa.positionScreen.y)-($.positionScreen.y-fa.positionScreen.y)*(ga.positionScreen.x-fa.positionScreen.x)<0||(ga.positionScreen.x-da.positionScreen.x)*
($.positionScreen.y-da.positionScreen.y)-(ga.positionScreen.y-da.positionScreen.y)*($.positionScreen.x-da.positionScreen.x)<0)))ra=w[x]=w[x]||new THREE.RenderableFace4,x++,p=ra,p.v1.copy(fa),p.v2.copy(ga),p.v3.copy(da),p.v4.copy($);else continue;p.normalWorld.copy(aa.normal);ea.multiplyVector3(p.normalWorld);p.centroidWorld.copy(aa.centroid);ja.multiplyVector3(p.centroidWorld);p.centroidScreen.copy(p.centroidWorld);C.multiplyVector3(p.centroidScreen);da=aa.vertexNormals;fa=0;for(ga=da.length;fa<ga;fa++)$=
p.vertexNormalsWorld[fa],$.copy(da[fa]),ea.multiplyVector3($);fa=0;for(ga=pa.length;fa<ga;fa++)if(ra=pa[fa][ma]){da=0;for($=ra.length;da<$;da++)p.uvs[fa][da]=ra[da]}p.meshMaterials=qa;p.faceMaterials=aa.materials;p.overdraw=V;p.z=p.centroidScreen.z;N.push(p)}}else if(X instanceof THREE.Line){K.multiply(C,ja);ma=X.geometry.vertices;fa=b();fa.positionScreen.copy(ma[0].position);K.multiplyVector4(fa.positionScreen);ia=1;for(aa=ma.length;ia<aa;ia++)if(fa=b(),fa.positionScreen.copy(ma[ia].position),K.multiplyVector4(fa.positionScreen),
ga=u[n-2],L.copy(fa.positionScreen),O.copy(ga.positionScreen),e(L,O))L.multiplyScalar(1/L.w),O.multiplyScalar(1/O.w),ja=B[y]=B[y]||new THREE.RenderableLine,y++,z=ja,z.v1.positionScreen.copy(L),z.v2.positionScreen.copy(O),z.z=Math.max(L.z,O.z),z.materials=X.materials,N.push(z)}else if(X instanceof THREE.Particle&&(I.set(X.matrixWorld.n14,X.matrixWorld.n24,X.matrixWorld.n34,1),C.multiplyVector4(I),I.z/=I.w,I.z>0&&I.z<1))ja=H[G]=H[G]||new THREE.RenderableParticle,G++,D=ja,D.x=I.x/I.w,D.y=I.y/I.w,D.z=
I.z,D.rotation=X.rotation.z,D.scale.x=X.scale.x*Math.abs(D.x-(I.x+h.projectionMatrix.n11)/(I.w+h.projectionMatrix.n14)),D.scale.y=X.scale.y*Math.abs(D.y-(I.y+h.projectionMatrix.n22)/(I.w+h.projectionMatrix.n24)),D.materials=X.materials,N.push(D);m&&N.sort(c);return N}};THREE.Quaternion=function(b,c,e,f){this.set(b||0,c||0,e||0,f!==void 0?f:1)};
THREE.Quaternion.prototype={constructor:THREE.Quaternion,set:function(b,c,e,f){this.x=b;this.y=c;this.z=e;this.w=f;return this},copy:function(b){this.x=b.x;this.y=b.y;this.z=b.z;this.w=b.w;return this},setFromEuler:function(b){var c=0.5*Math.PI/360,e=b.x*c,f=b.y*c,h=b.z*c,b=Math.cos(f),f=Math.sin(f),c=Math.cos(-h),h=Math.sin(-h),m=Math.cos(e),e=Math.sin(e),k=b*c,n=f*h;this.w=k*m-n*e;this.x=k*e+n*m;this.y=f*c*m+b*h*e;this.z=b*h*m-f*c*e;return this},setFromAxisAngle:function(b,c){var e=c/2,f=Math.sin(e);
this.x=b.x*f;this.y=b.y*f;this.z=b.z*f;this.w=Math.cos(e);return this},setFromRotationMatrix:function(b){var c=Math.pow(b.determinant(),1/3);this.w=Math.sqrt(Math.max(0,c+b.n11+b.n22+b.n33))/2;this.x=Math.sqrt(Math.max(0,c+b.n11-b.n22-b.n33))/2;this.y=Math.sqrt(Math.max(0,c-b.n11+b.n22-b.n33))/2;this.z=Math.sqrt(Math.max(0,c-b.n11-b.n22+b.n33))/2;this.x=b.n32-b.n23<0?-Math.abs(this.x):Math.abs(this.x);this.y=b.n13-b.n31<0?-Math.abs(this.y):Math.abs(this.y);this.z=b.n21-b.n12<0?-Math.abs(this.z):Math.abs(this.z);
this.normalize();return this},calculateW:function(){this.w=-Math.sqrt(Math.abs(1-this.x*this.x-this.y*this.y-this.z*this.z));return this},inverse:function(){this.x*=-1;this.y*=-1;this.z*=-1;return this},length:function(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)},normalize:function(){var b=Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w);b==0?this.w=this.z=this.y=this.x=0:(b=1/b,this.x*=b,this.y*=b,this.z*=b,this.w*=b);return this},multiplySelf:function(b){var c=
this.x,e=this.y,f=this.z,h=this.w,m=b.x,k=b.y,n=b.z,b=b.w;this.x=c*b+h*m+e*n-f*k;this.y=e*b+h*k+f*m-c*n;this.z=f*b+h*n+c*k-e*m;this.w=h*b-c*m-e*k-f*n;return this},multiply:function(b,c){this.x=b.x*c.w+b.y*c.z-b.z*c.y+b.w*c.x;this.y=-b.x*c.z+b.y*c.w+b.z*c.x+b.w*c.y;this.z=b.x*c.y-b.y*c.x+b.z*c.w+b.w*c.z;this.w=-b.x*c.x-b.y*c.y-b.z*c.z+b.w*c.w;return this},multiplyVector3:function(b,c){c||(c=b);var e=b.x,f=b.y,h=b.z,m=this.x,k=this.y,n=this.z,u=this.w,p=u*e+k*h-n*f,v=u*f+n*e-m*h,t=u*h+m*f-k*e,e=-m*
e-k*f-n*h;c.x=p*u+e*-m+v*-n-t*-k;c.y=v*u+e*-k+t*-m-p*-n;c.z=t*u+e*-n+p*-k-v*-m;return c}};THREE.Quaternion.slerp=function(b,c,e,f){var h=b.w*c.w+b.x*c.x+b.y*c.y+b.z*c.z;if(Math.abs(h)>=1)return e.w=b.w,e.x=b.x,e.y=b.y,e.z=b.z,e;var m=Math.acos(h),k=Math.sqrt(1-h*h);if(Math.abs(k)<0.001)return e.w=0.5*(b.w+c.w),e.x=0.5*(b.x+c.x),e.y=0.5*(b.y+c.y),e.z=0.5*(b.z+c.z),e;h=Math.sin((1-f)*m)/k;f=Math.sin(f*m)/k;e.w=b.w*h+c.w*f;e.x=b.x*h+c.x*f;e.y=b.y*h+c.y*f;e.z=b.z*h+c.z*f;return e};
THREE.Vertex=function(b){this.position=b||new THREE.Vector3};THREE.Face3=function(b,c,e,f,h,m){this.a=b;this.b=c;this.c=e;this.normal=f instanceof THREE.Vector3?f:new THREE.Vector3;this.vertexNormals=f instanceof Array?f:[];this.color=h instanceof THREE.Color?h:new THREE.Color;this.vertexColors=h instanceof Array?h:[];this.vertexTangents=[];this.materials=m instanceof Array?m:[m];this.centroid=new THREE.Vector3};
THREE.Face4=function(b,c,e,f,h,m,k){this.a=b;this.b=c;this.c=e;this.d=f;this.normal=h instanceof THREE.Vector3?h:new THREE.Vector3;this.vertexNormals=h instanceof Array?h:[];this.color=m instanceof THREE.Color?m:new THREE.Color;this.vertexColors=m instanceof Array?m:[];this.vertexTangents=[];this.materials=k instanceof Array?k:[k];this.centroid=new THREE.Vector3};THREE.UV=function(b,c){this.u=b||0;this.v=c||0};
THREE.UV.prototype={constructor:THREE.UV,set:function(b,c){this.u=b;this.v=c;return this},copy:function(b){this.u=b.u;this.v=b.v;return this},clone:function(){return new THREE.UV(this.u,this.v)}};
THREE.Geometry=function(){this.id=THREE.GeometryCount++;this.vertices=[];this.colors=[];this.faces=[];this.edges=[];this.faceUvs=[[]];this.faceVertexUvs=[[]];this.morphTargets=[];this.morphColors=[];this.skinWeights=[];this.skinIndices=[];this.boundingSphere=this.boundingBox=null;this.dynamic=this.hasTangents=!1};
THREE.Geometry.prototype={constructor:THREE.Geometry,computeCentroids:function(){var b,c,e;b=0;for(c=this.faces.length;b<c;b++)e=this.faces[b],e.centroid.set(0,0,0),e instanceof THREE.Face3?(e.centroid.addSelf(this.vertices[e.a].position),e.centroid.addSelf(this.vertices[e.b].position),e.centroid.addSelf(this.vertices[e.c].position),e.centroid.divideScalar(3)):e instanceof THREE.Face4&&(e.centroid.addSelf(this.vertices[e.a].position),e.centroid.addSelf(this.vertices[e.b].position),e.centroid.addSelf(this.vertices[e.c].position),
e.centroid.addSelf(this.vertices[e.d].position),e.centroid.divideScalar(4))},computeFaceNormals:function(b){var c,e,f,h,m,k,n=new THREE.Vector3,u=new THREE.Vector3;f=0;for(h=this.faces.length;f<h;f++){m=this.faces[f];if(b&&m.vertexNormals.length){n.set(0,0,0);c=0;for(e=m.vertexNormals.length;c<e;c++)n.addSelf(m.vertexNormals[c]);n.divideScalar(3)}else c=this.vertices[m.a],e=this.vertices[m.b],k=this.vertices[m.c],n.sub(k.position,e.position),u.sub(c.position,e.position),n.crossSelf(u);n.isZero()||
n.normalize();m.normal.copy(n)}},computeVertexNormals:function(){var b,c,e,f;if(this.__tmpVertices==void 0){f=this.__tmpVertices=Array(this.vertices.length);b=0;for(c=this.vertices.length;b<c;b++)f[b]=new THREE.Vector3;b=0;for(c=this.faces.length;b<c;b++)if(e=this.faces[b],e instanceof THREE.Face3)e.vertexNormals=[new THREE.Vector3,new THREE.Vector3,new THREE.Vector3];else if(e instanceof THREE.Face4)e.vertexNormals=[new THREE.Vector3,new THREE.Vector3,new THREE.Vector3,new THREE.Vector3]}else{f=
this.__tmpVertices;b=0;for(c=this.vertices.length;b<c;b++)f[b].set(0,0,0)}b=0;for(c=this.faces.length;b<c;b++)e=this.faces[b],e instanceof THREE.Face3?(f[e.a].addSelf(e.normal),f[e.b].addSelf(e.normal),f[e.c].addSelf(e.normal)):e instanceof THREE.Face4&&(f[e.a].addSelf(e.normal),f[e.b].addSelf(e.normal),f[e.c].addSelf(e.normal),f[e.d].addSelf(e.normal));b=0;for(c=this.vertices.length;b<c;b++)f[b].normalize();b=0;for(c=this.faces.length;b<c;b++)e=this.faces[b],e instanceof THREE.Face3?(e.vertexNormals[0].copy(f[e.a]),
e.vertexNormals[1].copy(f[e.b]),e.vertexNormals[2].copy(f[e.c])):e instanceof THREE.Face4&&(e.vertexNormals[0].copy(f[e.a]),e.vertexNormals[1].copy(f[e.b]),e.vertexNormals[2].copy(f[e.c]),e.vertexNormals[3].copy(f[e.d]))},computeTangents:function(){function b(b,e,c,f,h,m,o){n=b.vertices[e].position;u=b.vertices[c].position;p=b.vertices[f].position;v=k[h];t=k[m];x=k[o];w=u.x-n.x;z=p.x-n.x;y=u.y-n.y;B=p.y-n.y;D=u.z-n.z;G=p.z-n.z;H=t.u-v.u;E=x.u-v.u;N=t.v-v.v;F=x.v-v.v;I=1/(H*F-E*N);L.set((F*w-N*z)*
I,(F*y-N*B)*I,(F*D-N*G)*I);O.set((H*z-E*w)*I,(H*B-E*y)*I,(H*G-E*D)*I);K[e].addSelf(L);K[c].addSelf(L);K[f].addSelf(L);U[e].addSelf(O);U[c].addSelf(O);U[f].addSelf(O)}var c,e,f,h,m,k,n,u,p,v,t,x,w,z,y,B,D,G,H,E,N,F,I,C,K=[],U=[],L=new THREE.Vector3,O=new THREE.Vector3,S=new THREE.Vector3,P=new THREE.Vector3,o=new THREE.Vector3;c=0;for(e=this.vertices.length;c<e;c++)K[c]=new THREE.Vector3,U[c]=new THREE.Vector3;c=0;for(e=this.faces.length;c<e;c++)m=this.faces[c],k=this.faceVertexUvs[0][c],m instanceof
THREE.Face3?b(this,m.a,m.b,m.c,0,1,2):m instanceof THREE.Face4&&(b(this,m.a,m.b,m.c,0,1,2),b(this,m.a,m.b,m.d,0,1,3));var W=["a","b","c","d"];c=0;for(e=this.faces.length;c<e;c++){m=this.faces[c];for(f=0;f<m.vertexNormals.length;f++)o.copy(m.vertexNormals[f]),h=m[W[f]],C=K[h],S.copy(C),S.subSelf(o.multiplyScalar(o.dot(C))).normalize(),P.cross(m.vertexNormals[f],C),h=P.dot(U[h]),h=h<0?-1:1,m.vertexTangents[f]=new THREE.Vector4(S.x,S.y,S.z,h)}this.hasTangents=!0},computeBoundingBox:function(){var b;
if(this.vertices.length>0){this.boundingBox={x:[this.vertices[0].position.x,this.vertices[0].position.x],y:[this.vertices[0].position.y,this.vertices[0].position.y],z:[this.vertices[0].position.z,this.vertices[0].position.z]};for(var c=1,e=this.vertices.length;c<e;c++){b=this.vertices[c];if(b.position.x<this.boundingBox.x[0])this.boundingBox.x[0]=b.position.x;else if(b.position.x>this.boundingBox.x[1])this.boundingBox.x[1]=b.position.x;if(b.position.y<this.boundingBox.y[0])this.boundingBox.y[0]=b.position.y;
else if(b.position.y>this.boundingBox.y[1])this.boundingBox.y[1]=b.position.y;if(b.position.z<this.boundingBox.z[0])this.boundingBox.z[0]=b.position.z;else if(b.position.z>this.boundingBox.z[1])this.boundingBox.z[1]=b.position.z}}},computeBoundingSphere:function(){for(var b=0,c=0,e=this.vertices.length;c<e;c++)b=Math.max(b,this.vertices[c].position.length());this.boundingSphere={radius:b}},computeEdgeFaces:function(){function b(b,e){return Math.min(b,e)+"_"+Math.max(b,e)}function c(b,e,c){b[e]===
void 0?(b[e]={set:{},array:[]},b[e].set[c]=1,b[e].array.push(c)):b[e].set[c]===void 0&&(b[e].set[c]=1,b[e].array.push(c))}var e,f,h,m,k,n={};e=0;for(f=this.faces.length;e<f;e++)k=this.faces[e],k instanceof THREE.Face3?(h=b(k.a,k.b),c(n,h,e),h=b(k.b,k.c),c(n,h,e),h=b(k.a,k.c),c(n,h,e)):k instanceof THREE.Face4&&(h=b(k.b,k.d),c(n,h,e),h=b(k.a,k.b),c(n,h,e),h=b(k.a,k.d),c(n,h,e),h=b(k.b,k.c),c(n,h,e),h=b(k.c,k.d),c(n,h,e));e=0;for(f=this.edges.length;e<f;e++){k=this.edges[e];h=k.vertexIndices[0];m=k.vertexIndices[1];
k.faceIndices=n[b(h,m)].array;for(h=0;h<k.faceIndices.length;h++)m=k.faceIndices[h],k.faces.push(this.faces[m])}}};THREE.GeometryCount=0;
THREE.Spline=function(b){function c(b,e,c,f,k,h,m){b=(c-b)*0.5;f=(f-e)*0.5;return(2*(e-c)+b+f)*m+(-3*(e-c)-2*b-f)*h+b*k+e}this.points=b;var e=[],f={x:0,y:0,z:0},h,m,k,n,u,p,v,t,x;this.initFromArray=function(b){this.points=[];for(var e=0;e<b.length;e++)this.points[e]={x:b[e][0],y:b[e][1],z:b[e][2]}};this.getPoint=function(b){h=(this.points.length-1)*b;m=Math.floor(h);k=h-m;e[0]=m==0?m:m-1;e[1]=m;e[2]=m>this.points.length-2?m:m+1;e[3]=m>this.points.length-3?m:m+2;p=this.points[e[0]];v=this.points[e[1]];
t=this.points[e[2]];x=this.points[e[3]];n=k*k;u=k*n;f.x=c(p.x,v.x,t.x,x.x,k,n,u);f.y=c(p.y,v.y,t.y,x.y,k,n,u);f.z=c(p.z,v.z,t.z,x.z,k,n,u);return f};this.getControlPointsArray=function(){var b,e,c=this.points.length,f=[];for(b=0;b<c;b++)e=this.points[b],f[b]=[e.x,e.y,e.z];return f};this.getLength=function(b){var e,c,f=e=e=0,k=new THREE.Vector3,h=new THREE.Vector3,m=[],n=0;m[0]=0;b||(b=100);c=this.points.length*b;k.copy(this.points[0]);for(b=1;b<c;b++)e=b/c,position=this.getPoint(e),h.copy(position),
n+=h.distanceTo(k),k.copy(position),e*=this.points.length-1,e=Math.floor(e),e!=f&&(m[e]=n,f=e);m[m.length]=n;return{chunks:m,total:n}};this.reparametrizeByArcLength=function(b){var e,c,f,k,h,m,n=[],u=new THREE.Vector3,t=this.getLength();n.push(u.copy(this.points[0]).clone());for(e=1;e<this.points.length;e++){c=t.chunks[e]-t.chunks[e-1];m=Math.ceil(b*c/t.total);k=(e-1)/(this.points.length-1);h=e/(this.points.length-1);for(c=1;c<m-1;c++)f=k+c*(1/m)*(h-k),position=this.getPoint(f),n.push(u.copy(position).clone());
n.push(u.copy(this.points[e]).clone())}this.points=n}};THREE.Edge=function(b,c,e,f){this.vertices=[b,c];this.vertexIndices=[e,f];this.faces=[];this.faceIndices=[]};THREE.Camera=function(b,c,e,f,h){THREE.Object3D.call(this);this.fov=b||50;this.aspect=c||1;this.near=e||0.1;this.far=f||2E3;this.target=h||new THREE.Object3D;this.useTarget=!0;this.matrixWorldInverse=new THREE.Matrix4;this.projectionMatrix=null;this.updateProjectionMatrix()};THREE.Camera.prototype=new THREE.Object3D;
THREE.Camera.prototype.constructor=THREE.Camera;THREE.Camera.prototype.supr=THREE.Object3D.prototype;THREE.Camera.prototype.translate=function(b,c){this.matrix.rotateAxis(c);c.multiplyScalar(b);this.position.addSelf(c);this.target.position.addSelf(c)};
THREE.Camera.prototype.updateProjectionMatrix=function(){if(this.fullWidth){var b=this.fullWidth/this.fullHeight,c=Math.tan(this.fov*Math.PI/360)*this.near,e=-c,f=b*e,b=Math.abs(b*c-f),e=Math.abs(c-e);this.projectionMatrix=THREE.Matrix4.makeFrustum(f+this.x*b/this.fullWidth,f+(this.x+this.width)*b/this.fullWidth,c-(this.y+this.height)*e/this.fullHeight,c-this.y*e/this.fullHeight,this.near,this.far)}else this.projectionMatrix=THREE.Matrix4.makePerspective(this.fov,this.aspect,this.near,this.far)};
THREE.Camera.prototype.setViewOffset=function(b,c,e,f,h,m){this.fullWidth=b;this.fullHeight=c;this.x=e;this.y=f;this.width=h;this.height=m;this.updateProjectionMatrix()};
THREE.Camera.prototype.update=function(b,c,e){if(this.useTarget)this.matrix.lookAt(this.position,this.target.position,this.up),this.matrix.setPosition(this.position),b?this.matrixWorld.multiply(b,this.matrix):this.matrixWorld.copy(this.matrix),THREE.Matrix4.makeInvert(this.matrixWorld,this.matrixWorldInverse),c=!0;else if(this.matrixAutoUpdate&&this.updateMatrix(),c||this.matrixWorldNeedsUpdate)b?this.matrixWorld.multiply(b,this.matrix):this.matrixWorld.copy(this.matrix),this.matrixWorldNeedsUpdate=
!1,c=!0,THREE.Matrix4.makeInvert(this.matrixWorld,this.matrixWorldInverse);for(b=0;b<this.children.length;b++)this.children[b].update(this.matrixWorld,c,e)};THREE.OrthoCamera=function(b,c,e,f,h,m,k){THREE.Camera.call(this,45,1,h,m,k);this.left=b;this.right=c;this.top=e;this.bottom=f;this.updateProjectionMatrix()};THREE.OrthoCamera.prototype=new THREE.Camera;THREE.OrthoCamera.prototype.constructor=THREE.OrthoCamera;
THREE.OrthoCamera.prototype.updateProjectionMatrix=function(){this.projectionMatrix=THREE.Matrix4.makeOrtho(this.left,this.right,this.top,this.bottom,this.near,this.far)};THREE.Light=function(b){THREE.Object3D.call(this);this.color=new THREE.Color(b)};THREE.Light.prototype=new THREE.Object3D;THREE.Light.prototype.constructor=THREE.Light;THREE.Light.prototype.supr=THREE.Object3D.prototype;THREE.AmbientLight=function(b){THREE.Light.call(this,b)};THREE.AmbientLight.prototype=new THREE.Light;
THREE.AmbientLight.prototype.constructor=THREE.AmbientLight;THREE.DirectionalLight=function(b,c,e,f){THREE.Light.call(this,b);this.position=new THREE.Vector3(0,1,0);this.intensity=c||1;this.distance=e||0;this.castShadow=f!==void 0?f:!1};THREE.DirectionalLight.prototype=new THREE.Light;THREE.DirectionalLight.prototype.constructor=THREE.DirectionalLight;THREE.PointLight=function(b,c,e){THREE.Light.call(this,b);this.position=new THREE.Vector3;this.intensity=c||1;this.distance=e||0};
THREE.PointLight.prototype=new THREE.Light;THREE.PointLight.prototype.constructor=THREE.PointLight;THREE.SpotLight=function(b,c,e,f){THREE.Light.call(this,b);this.position=new THREE.Vector3(0,1,0);this.target=new THREE.Object3D;this.intensity=c||1;this.distance=e||0;this.castShadow=f!==void 0?f:!1};THREE.SpotLight.prototype=new THREE.Light;THREE.SpotLight.prototype.constructor=THREE.SpotLight;
THREE.Material=function(b){this.id=THREE.MaterialCount++;b=b||{};this.opacity=b.opacity!==void 0?b.opacity:1;this.transparent=b.transparent!==void 0?b.transparent:!1;this.blending=b.blending!==void 0?b.blending:THREE.NormalBlending;this.depthTest=b.depthTest!==void 0?b.depthTest:!0;this.polygonOffset=b.polygonOffset!==void 0?b.polygonOffset:!1;this.polygonOffsetFactor=b.polygonOffsetFactor!==void 0?b.polygonOffsetFactor:0;this.polygonOffsetUnits=b.polygonOffsetUnits!==void 0?b.polygonOffsetUnits:
0;this.alphaTest=b.alphaTest!==void 0?b.alphaTest:0};THREE.MaterialCount=0;THREE.NoShading=0;THREE.FlatShading=1;THREE.SmoothShading=2;THREE.NoColors=0;THREE.FaceColors=1;THREE.VertexColors=2;THREE.NormalBlending=0;THREE.AdditiveBlending=1;THREE.SubtractiveBlending=2;THREE.MultiplyBlending=3;THREE.AdditiveAlphaBlending=4;
THREE.LineBasicMaterial=function(b){THREE.Material.call(this,b);b=b||{};this.color=b.color!==void 0?new THREE.Color(b.color):new THREE.Color(16777215);this.linewidth=b.linewidth!==void 0?b.linewidth:1;this.linecap=b.linecap!==void 0?b.linecap:"round";this.linejoin=b.linejoin!==void 0?b.linejoin:"round";this.vertexColors=b.vertexColors?b.vertexColors:!1};THREE.LineBasicMaterial.prototype=new THREE.Material;THREE.LineBasicMaterial.prototype.constructor=THREE.LineBasicMaterial;
THREE.MeshBasicMaterial=function(b){THREE.Material.call(this,b);b=b||{};this.color=b.color!==void 0?new THREE.Color(b.color):new THREE.Color(16777215);this.map=b.map!==void 0?b.map:null;this.lightMap=b.lightMap!==void 0?b.lightMap:null;this.envMap=b.envMap!==void 0?b.envMap:null;this.combine=b.combine!==void 0?b.combine:THREE.MultiplyOperation;this.reflectivity=b.reflectivity!==void 0?b.reflectivity:1;this.refractionRatio=b.refractionRatio!==void 0?b.refractionRatio:0.98;this.shading=b.shading!==
void 0?b.shading:THREE.SmoothShading;this.wireframe=b.wireframe!==void 0?b.wireframe:!1;this.wireframeLinewidth=b.wireframeLinewidth!==void 0?b.wireframeLinewidth:1;this.wireframeLinecap=b.wireframeLinecap!==void 0?b.wireframeLinecap:"round";this.wireframeLinejoin=b.wireframeLinejoin!==void 0?b.wireframeLinejoin:"round";this.vertexColors=b.vertexColors!==void 0?b.vertexColors:!1;this.skinning=b.skinning!==void 0?b.skinning:!1;this.morphTargets=b.morphTargets!==void 0?b.morphTargets:!1};
THREE.MeshBasicMaterial.prototype=new THREE.Material;THREE.MeshBasicMaterial.prototype.constructor=THREE.MeshBasicMaterial;
THREE.MeshLambertMaterial=function(b){THREE.Material.call(this,b);b=b||{};this.color=b.color!==void 0?new THREE.Color(b.color):new THREE.Color(16777215);this.map=b.map!==void 0?b.map:null;this.lightMap=b.lightMap!==void 0?b.lightMap:null;this.envMap=b.envMap!==void 0?b.envMap:null;this.combine=b.combine!==void 0?b.combine:THREE.MultiplyOperation;this.reflectivity=b.reflectivity!==void 0?b.reflectivity:1;this.refractionRatio=b.refractionRatio!==void 0?b.refractionRatio:0.98;this.shading=b.shading!==
void 0?b.shading:THREE.SmoothShading;this.wireframe=b.wireframe!==void 0?b.wireframe:!1;this.wireframeLinewidth=b.wireframeLinewidth!==void 0?b.wireframeLinewidth:1;this.wireframeLinecap=b.wireframeLinecap!==void 0?b.wireframeLinecap:"round";this.wireframeLinejoin=b.wireframeLinejoin!==void 0?b.wireframeLinejoin:"round";this.vertexColors=b.vertexColors!==void 0?b.vertexColors:!1;this.skinning=b.skinning!==void 0?b.skinning:!1;this.morphTargets=b.morphTargets!==void 0?b.morphTargets:!1};
THREE.MeshLambertMaterial.prototype=new THREE.Material;THREE.MeshLambertMaterial.prototype.constructor=THREE.MeshLambertMaterial;
THREE.MeshPhongMaterial=function(b){THREE.Material.call(this,b);b=b||{};this.color=b.color!==void 0?new THREE.Color(b.color):new THREE.Color(16777215);this.ambient=b.ambient!==void 0?new THREE.Color(b.ambient):new THREE.Color(328965);this.specular=b.specular!==void 0?new THREE.Color(b.specular):new THREE.Color(1118481);this.shininess=b.shininess!==void 0?b.shininess:30;this.map=b.map!==void 0?b.map:null;this.lightMap=b.lightMap!==void 0?b.lightMap:null;this.envMap=b.envMap!==void 0?b.envMap:null;
this.combine=b.combine!==void 0?b.combine:THREE.MultiplyOperation;this.reflectivity=b.reflectivity!==void 0?b.reflectivity:1;this.refractionRatio=b.refractionRatio!==void 0?b.refractionRatio:0.98;this.shading=b.shading!==void 0?b.shading:THREE.SmoothShading;this.wireframe=b.wireframe!==void 0?b.wireframe:!1;this.wireframeLinewidth=b.wireframeLinewidth!==void 0?b.wireframeLinewidth:1;this.wireframeLinecap=b.wireframeLinecap!==void 0?b.wireframeLinecap:"round";this.wireframeLinejoin=b.wireframeLinejoin!==
void 0?b.wireframeLinejoin:"round";this.vertexColors=b.vertexColors!==void 0?b.vertexColors:!1;this.skinning=b.skinning!==void 0?b.skinning:!1;this.morphTargets=b.morphTargets!==void 0?b.morphTargets:!1};THREE.MeshPhongMaterial.prototype=new THREE.Material;THREE.MeshPhongMaterial.prototype.constructor=THREE.MeshPhongMaterial;
THREE.MeshDepthMaterial=function(b){THREE.Material.call(this,b);b=b||{};this.shading=b.shading!==void 0?b.shading:THREE.SmoothShading;this.wireframe=b.wireframe!==void 0?b.wireframe:!1;this.wireframeLinewidth=b.wireframeLinewidth!==void 0?b.wireframeLinewidth:1};THREE.MeshDepthMaterial.prototype=new THREE.Material;THREE.MeshDepthMaterial.prototype.constructor=THREE.MeshDepthMaterial;
THREE.MeshNormalMaterial=function(b){THREE.Material.call(this,b);b=b||{};this.shading=b.shading?b.shading:THREE.FlatShading;this.wireframe=b.wireframe?b.wireframe:!1;this.wireframeLinewidth=b.wireframeLinewidth?b.wireframeLinewidth:1};THREE.MeshNormalMaterial.prototype=new THREE.Material;THREE.MeshNormalMaterial.prototype.constructor=THREE.MeshNormalMaterial;THREE.MeshFaceMaterial=function(){};
THREE.MeshShaderMaterial=function(b){THREE.Material.call(this,b);b=b||{};this.fragmentShader=b.fragmentShader!==void 0?b.fragmentShader:"void main() {}";this.vertexShader=b.vertexShader!==void 0?b.vertexShader:"void main() {}";this.uniforms=b.uniforms!==void 0?b.uniforms:{};this.attributes=b.attributes;this.shading=b.shading!==void 0?b.shading:THREE.SmoothShading;this.wireframe=b.wireframe!==void 0?b.wireframe:!1;this.wireframeLinewidth=b.wireframeLinewidth!==void 0?b.wireframeLinewidth:1;this.fog=
b.fog!==void 0?b.fog:!1;this.lights=b.lights!==void 0?b.lights:!1;this.vertexColors=b.vertexColors!==void 0?b.vertexColors:!1;this.skinning=b.skinning!==void 0?b.skinning:!1;this.morphTargets=b.morphTargets!==void 0?b.morphTargets:!1};THREE.MeshShaderMaterial.prototype=new THREE.Material;THREE.MeshShaderMaterial.prototype.constructor=THREE.MeshShaderMaterial;
THREE.ParticleBasicMaterial=function(b){THREE.Material.call(this,b);b=b||{};this.color=b.color!==void 0?new THREE.Color(b.color):new THREE.Color(16777215);this.map=b.map!==void 0?b.map:null;this.size=b.size!==void 0?b.size:1;this.sizeAttenuation=b.sizeAttenuation!==void 0?b.sizeAttenuation:!0;this.vertexColors=b.vertexColors!==void 0?b.vertexColors:!1};THREE.ParticleBasicMaterial.prototype=new THREE.Material;THREE.ParticleBasicMaterial.prototype.constructor=THREE.ParticleBasicMaterial;
THREE.ParticleCanvasMaterial=function(b){THREE.Material.call(this,b);b=b||{};this.color=b.color!==void 0?new THREE.Color(b.color):new THREE.Color(16777215);this.program=b.program!==void 0?b.program:function(){}};THREE.ParticleCanvasMaterial.prototype=new THREE.Material;THREE.ParticleCanvasMaterial.prototype.constructor=THREE.ParticleCanvasMaterial;THREE.ParticleDOMMaterial=function(b){THREE.Material.call(this);this.domElement=b};
THREE.Texture=function(b,c,e,f,h,m){this.id=THREE.TextureCount++;this.image=b;this.mapping=c!==void 0?c:new THREE.UVMapping;this.wrapS=e!==void 0?e:THREE.ClampToEdgeWrapping;this.wrapT=f!==void 0?f:THREE.ClampToEdgeWrapping;this.magFilter=h!==void 0?h:THREE.LinearFilter;this.minFilter=m!==void 0?m:THREE.LinearMipMapLinearFilter;this.offset=new THREE.Vector2(0,0);this.repeat=new THREE.Vector2(1,1);this.needsUpdate=!1};
THREE.Texture.prototype={constructor:THREE.Texture,clone:function(){var b=new THREE.Texture(this.image,this.mapping,this.wrapS,this.wrapT,this.magFilter,this.minFilter);b.offset.copy(this.offset);b.repeat.copy(this.repeat);return b}};THREE.TextureCount=0;THREE.MultiplyOperation=0;THREE.MixOperation=1;THREE.CubeReflectionMapping=function(){};THREE.CubeRefractionMapping=function(){};THREE.LatitudeReflectionMapping=function(){};THREE.LatitudeRefractionMapping=function(){};
THREE.SphericalReflectionMapping=function(){};THREE.SphericalRefractionMapping=function(){};THREE.UVMapping=function(){};THREE.RepeatWrapping=0;THREE.ClampToEdgeWrapping=1;THREE.MirroredRepeatWrapping=2;THREE.NearestFilter=3;THREE.NearestMipMapNearestFilter=4;THREE.NearestMipMapLinearFilter=5;THREE.LinearFilter=6;THREE.LinearMipMapNearestFilter=7;THREE.LinearMipMapLinearFilter=8;THREE.ByteType=9;THREE.UnsignedByteType=10;THREE.ShortType=11;THREE.UnsignedShortType=12;THREE.IntType=13;
THREE.UnsignedIntType=14;THREE.FloatType=15;THREE.AlphaFormat=16;THREE.RGBFormat=17;THREE.RGBAFormat=18;THREE.LuminanceFormat=19;THREE.LuminanceAlphaFormat=20;THREE.DataTexture=function(b,c,e,f,h,m,k,n,u){THREE.Texture.call(this,null,h,m,k,n,u);this.image={data:b,width:c,height:e};this.format=f!==void 0?f:THREE.RGBAFormat};THREE.DataTexture.prototype=new THREE.Texture;THREE.DataTexture.prototype.constructor=THREE.DataTexture;
THREE.DataTexture.prototype.clone=function(){var b=new THREE.DataTexture(this.data.slice(0),this.mapping,this.wrapS,this.wrapT,this.magFilter,this.minFilter);b.offset.copy(this.offset);b.repeat.copy(this.repeat);return b};THREE.Particle=function(b){THREE.Object3D.call(this);this.materials=b instanceof Array?b:[b]};THREE.Particle.prototype=new THREE.Object3D;THREE.Particle.prototype.constructor=THREE.Particle;
THREE.ParticleSystem=function(b,c){THREE.Object3D.call(this);this.geometry=b;this.materials=c instanceof Array?c:[c];this.sortParticles=!1};THREE.ParticleSystem.prototype=new THREE.Object3D;THREE.ParticleSystem.prototype.constructor=THREE.ParticleSystem;THREE.Line=function(b,c,e){THREE.Object3D.call(this);this.geometry=b;this.materials=c instanceof Array?c:[c];this.type=e!=void 0?e:THREE.LineStrip};THREE.LineStrip=0;THREE.LinePieces=1;THREE.Line.prototype=new THREE.Object3D;
THREE.Line.prototype.constructor=THREE.Line;
THREE.Mesh=function(b,c){THREE.Object3D.call(this);this.geometry=b;this.materials=c&&c.length?c:[c];this.overdraw=!1;if(this.geometry&&(this.geometry.boundingSphere||this.geometry.computeBoundingSphere(),this.boundRadius=b.boundingSphere.radius,this.geometry.morphTargets.length)){this.morphTargetBase=-1;this.morphTargetForcedOrder=[];this.morphTargetInfluences=[];this.morphTargetDictionary={};for(var e=0;e<this.geometry.morphTargets.length;e++)this.morphTargetInfluences.push(0),this.morphTargetDictionary[this.geometry.morphTargets[e].name]=
e}};THREE.Mesh.prototype=new THREE.Object3D;THREE.Mesh.prototype.constructor=THREE.Mesh;THREE.Mesh.prototype.supr=THREE.Object3D.prototype;THREE.Mesh.prototype.getMorphTargetIndexByName=function(b){if(this.morphTargetDictionary[b]!==void 0)return this.morphTargetDictionary[b];console.log("THREE.Mesh.getMorphTargetIndexByName: morph target "+b+" does not exist. Returning 0.");return 0};
THREE.Bone=function(b){THREE.Object3D.call(this);this.skin=b;this.skinMatrix=new THREE.Matrix4;this.hasNoneBoneChildren=!1};THREE.Bone.prototype=new THREE.Object3D;THREE.Bone.prototype.constructor=THREE.Bone;THREE.Bone.prototype.supr=THREE.Object3D.prototype;
THREE.Bone.prototype.update=function(b,c,e){this.matrixAutoUpdate&&(c|=this.updateMatrix());if(c||this.matrixWorldNeedsUpdate)b?this.skinMatrix.multiply(b,this.matrix):this.skinMatrix.copy(this.matrix),this.matrixWorldNeedsUpdate=!1,c=!0;var f,h=this.children.length;if(this.hasNoneBoneChildren){this.matrixWorld.multiply(this.skin.matrixWorld,this.skinMatrix);for(f=0;f<h;f++)b=this.children[f],b instanceof THREE.Bone?b.update(this.skinMatrix,c,e):b.update(this.matrixWorld,!0,e)}else for(f=0;f<h;f++)this.children[f].update(this.skinMatrix,
c,e)};THREE.Bone.prototype.addChild=function(b){if(this.children.indexOf(b)===-1&&(b.parent!==void 0&&b.parent.removeChild(b),b.parent=this,this.children.push(b),!(b instanceof THREE.Bone)))this.hasNoneBoneChildren=!0};
THREE.SkinnedMesh=function(b,c){THREE.Mesh.call(this,b,c);this.identityMatrix=new THREE.Matrix4;this.bones=[];this.boneMatrices=[];var e,f,h,m,k,n;if(this.geometry.bones!==void 0){for(e=0;e<this.geometry.bones.length;e++)h=this.geometry.bones[e],m=h.pos,k=h.rotq,n=h.scl,f=this.addBone(),f.name=h.name,f.position.set(m[0],m[1],m[2]),f.quaternion.set(k[0],k[1],k[2],k[3]),f.useQuaternion=!0,n!==void 0?f.scale.set(n[0],n[1],n[2]):f.scale.set(1,1,1);for(e=0;e<this.bones.length;e++)h=this.geometry.bones[e],
f=this.bones[e],h.parent===-1?this.addChild(f):this.bones[h.parent].addChild(f);this.boneMatrices=new Float32Array(16*this.bones.length);this.pose()}};THREE.SkinnedMesh.prototype=new THREE.Mesh;THREE.SkinnedMesh.prototype.constructor=THREE.SkinnedMesh;
THREE.SkinnedMesh.prototype.update=function(b,c,e){if(this.visible){this.matrixAutoUpdate&&(c|=this.updateMatrix());if(c||this.matrixWorldNeedsUpdate)b?this.matrixWorld.multiply(b,this.matrix):this.matrixWorld.copy(this.matrix),this.matrixWorldNeedsUpdate=!1,c=!0;var f,h=this.children.length;for(f=0;f<h;f++)b=this.children[f],b instanceof THREE.Bone?b.update(this.identityMatrix,!1,e):b.update(this.matrixWorld,c,e);e=this.bones.length;ba=this.bones;bm=this.boneMatrices;for(c=0;c<e;c++)ba[c].skinMatrix.flattenToArrayOffset(bm,
c*16)}};THREE.SkinnedMesh.prototype.addBone=function(b){b===void 0&&(b=new THREE.Bone(this));this.bones.push(b);return b};
THREE.SkinnedMesh.prototype.pose=function(){this.update(void 0,!0);for(var b,c=[],e=0;e<this.bones.length;e++)b=this.bones[e],c.push(THREE.Matrix4.makeInvert(b.skinMatrix)),b.skinMatrix.flattenToArrayOffset(this.boneMatrices,e*16);if(this.geometry.skinVerticesA===void 0){this.geometry.skinVerticesA=[];this.geometry.skinVerticesB=[];var f;for(b=0;b<this.geometry.skinIndices.length;b++){var e=this.geometry.vertices[b].position,h=this.geometry.skinIndices[b].x,m=this.geometry.skinIndices[b].y;f=new THREE.Vector3(e.x,
e.y,e.z);this.geometry.skinVerticesA.push(c[h].multiplyVector3(f));f=new THREE.Vector3(e.x,e.y,e.z);this.geometry.skinVerticesB.push(c[m].multiplyVector3(f));this.geometry.skinWeights[b].x+this.geometry.skinWeights[b].y!==1&&(e=(1-(this.geometry.skinWeights[b].x+this.geometry.skinWeights[b].y))*0.5,this.geometry.skinWeights[b].x+=e,this.geometry.skinWeights[b].y+=e)}}};THREE.Ribbon=function(b,c){THREE.Object3D.call(this);this.geometry=b;this.materials=c instanceof Array?c:[c]};
THREE.Ribbon.prototype=new THREE.Object3D;THREE.Ribbon.prototype.constructor=THREE.Ribbon;THREE.LOD=function(){THREE.Object3D.call(this);this.LODs=[]};THREE.LOD.prototype=new THREE.Object3D;THREE.LOD.prototype.constructor=THREE.LOD;THREE.LOD.prototype.supr=THREE.Object3D.prototype;THREE.LOD.prototype.add=function(b,c){c===void 0&&(c=0);for(var c=Math.abs(c),e=0;e<this.LODs.length;e++)if(c<this.LODs[e].visibleAtDistance)break;this.LODs.splice(e,0,{visibleAtDistance:c,object3D:b});this.addChild(b)};
THREE.LOD.prototype.update=function(b,c,e){this.matrixAutoUpdate&&(c|=this.updateMatrix());if(c||this.matrixWorldNeedsUpdate)b?this.matrixWorld.multiply(b,this.matrix):this.matrixWorld.copy(this.matrix),this.matrixWorldNeedsUpdate=!1,c=!0;if(this.LODs.length>1){b=e.matrixWorldInverse;b=-(b.n31*this.position.x+b.n32*this.position.y+b.n33*this.position.z+b.n34);this.LODs[0].object3D.visible=!0;for(var f=1;f<this.LODs.length;f++)if(b>=this.LODs[f].visibleAtDistance)this.LODs[f-1].object3D.visible=!1,
this.LODs[f].object3D.visible=!0;else break;for(;f<this.LODs.length;f++)this.LODs[f].object3D.visible=!1}for(b=0;b<this.children.length;b++)this.children[b].update(this.matrixWorld,c,e)};
THREE.Sprite=function(b){THREE.Object3D.call(this);if(b.material!==void 0)this.material=b.material,this.map=void 0,this.blending=material.blending;else if(b.map!==void 0)this.map=b.map instanceof THREE.Texture?b.map:THREE.ImageUtils.loadTexture(b.map),this.material=void 0,this.blending=b.blending!==void 0?b.blending:THREE.NormalBlending;this.useScreenCoordinates=b.useScreenCoordinates!==void 0?b.useScreenCoordinates:!0;this.mergeWith3D=b.mergeWith3D!==void 0?b.mergeWith3D:!this.useScreenCoordinates;
this.affectedByDistance=b.affectedByDistance!==void 0?b.affectedByDistance:!this.useScreenCoordinates;this.scaleByViewport=b.scaleByViewport!==void 0?b.scaleByViewport:!this.affectedByDistance;this.alignment=b.alignment instanceof THREE.Vector2?b.alignment:THREE.SpriteAlignment.center;this.rotation3d=this.rotation;this.rotation=0;this.opacity=1;this.uvOffset=new THREE.Vector2(0,0);this.uvScale=new THREE.Vector2(1,1)};THREE.Sprite.prototype=new THREE.Object3D;THREE.Sprite.prototype.constructor=THREE.Sprite;
THREE.Sprite.prototype.supr=THREE.Object3D.prototype;THREE.Sprite.prototype.updateMatrix=function(){this.matrix.setPosition(this.position);this.rotation3d.set(0,0,this.rotation);this.matrix.setRotationFromEuler(this.rotation3d);if(this.scale.x!==1||this.scale.y!==1)this.matrix.scale(this.scale),this.boundRadiusScale=Math.max(this.scale.x,this.scale.y);this.matrixWorldNeedsUpdate=!0};THREE.SpriteAlignment={};THREE.SpriteAlignment.topLeft=new THREE.Vector2(1,-1);
THREE.SpriteAlignment.topCenter=new THREE.Vector2(0,-1);THREE.SpriteAlignment.topRight=new THREE.Vector2(-1,-1);THREE.SpriteAlignment.centerLeft=new THREE.Vector2(1,0);THREE.SpriteAlignment.center=new THREE.Vector2(0,0);THREE.SpriteAlignment.centerRight=new THREE.Vector2(-1,0);THREE.SpriteAlignment.bottomLeft=new THREE.Vector2(1,1);THREE.SpriteAlignment.bottomCenter=new THREE.Vector2(0,1);THREE.SpriteAlignment.bottomRight=new THREE.Vector2(-1,1);
THREE.Scene=function(){THREE.Object3D.call(this);this.matrixAutoUpdate=!1;this.collisions=this.overrideMaterial=this.fog=null;this.objects=[];this.lights=[];this.__objectsAdded=[];this.__objectsRemoved=[]};THREE.Scene.prototype=new THREE.Object3D;THREE.Scene.prototype.constructor=THREE.Scene;THREE.Scene.prototype.supr=THREE.Object3D.prototype;THREE.Scene.prototype.addChild=function(b){this.supr.addChild.call(this,b);this.addChildRecurse(b)};
THREE.Scene.prototype.addChildRecurse=function(b){if(b instanceof THREE.Light)this.lights.indexOf(b)===-1&&this.lights.push(b);else if(!(b instanceof THREE.Camera||b instanceof THREE.Bone)&&this.objects.indexOf(b)===-1)this.objects.push(b),this.__objectsAdded.push(b);for(var c=0;c<b.children.length;c++)this.addChildRecurse(b.children[c])};THREE.Scene.prototype.removeChild=function(b){this.supr.removeChild.call(this,b);this.removeChildRecurse(b)};
THREE.Scene.prototype.removeChildRecurse=function(b){if(b instanceof THREE.Light){var c=this.lights.indexOf(b);c!==-1&&this.lights.splice(c,1)}else b instanceof THREE.Camera||(c=this.objects.indexOf(b),c!==-1&&(this.objects.splice(c,1),this.__objectsRemoved.push(b)));for(c=0;c<b.children.length;c++)this.removeChildRecurse(b.children[c])};THREE.Scene.prototype.addObject=THREE.Scene.prototype.addChild;THREE.Scene.prototype.removeObject=THREE.Scene.prototype.removeChild;
THREE.Scene.prototype.addLight=THREE.Scene.prototype.addChild;THREE.Scene.prototype.removeLight=THREE.Scene.prototype.removeChild;THREE.Fog=function(b,c,e){this.color=new THREE.Color(b);this.near=c||1;this.far=e||1E3};THREE.FogExp2=function(b,c){this.color=new THREE.Color(b);this.density=c!==void 0?c:2.5E-4};
THREE.DOMRenderer=function(){THREE.Renderer.call(this);var b=null,c=new THREE.Projector,e,f,h,m;this.domElement=document.createElement("div");this.setSize=function(b,c){e=b;f=c;h=e/2;m=f/2};this.render=function(e,f){var u,p,v,t,x,w,z,y;b=c.projectScene(e,f);u=0;for(p=b.length;u<p;u++)if(x=b[u],x instanceof THREE.RenderableParticle){z=x.x*h+h;y=x.y*m+m;v=0;for(t=x.material.length;v<t;v++)if(w=x.material[v],w instanceof THREE.ParticleDOMMaterial)w=w.domElement,w.style.left=z+"px",w.style.top=y+"px"}}};
THREE.CanvasRenderer=function(b){function c(b){if(B!=b)w.globalAlpha=B=b}function e(b){if(D!=b){switch(b){case THREE.NormalBlending:w.globalCompositeOperation="source-over";break;case THREE.AdditiveBlending:w.globalCompositeOperation="lighter";break;case THREE.SubtractiveBlending:w.globalCompositeOperation="darker"}D=b}}function f(b){if(G!=b)w.strokeStyle=G=b}function h(b){if(H!=b)w.fillStyle=H=b}var m=this,k=null,n=new THREE.Projector,b=b||{},u=b.canvas!==void 0?b.canvas:document.createElement("canvas"),
p,v,t,x,w=u.getContext("2d"),z=new THREE.Color(0),y=0,B=1,D=0,G=null,H=null,E=null,N=null,F=null,I,C,K,U,L=new THREE.RenderableVertex,O=new THREE.RenderableVertex,S,P,o,W,na,R,ia,aa,ma,fa,ga,da,$=new THREE.Color(0),ca=new THREE.Color(0),X=new THREE.Color(0),ja=new THREE.Color(0),ea=new THREE.Color(0),qa=[],V,pa,va,ra,sa,Ca,wa,Aa,za,Fa,M=new THREE.Rectangle,Z=new THREE.Rectangle,T=new THREE.Rectangle,xa=!1,ha=new THREE.Color,ka=new THREE.Color,ya=new THREE.Color,ta=new THREE.Color,oa=new THREE.Vector3,
Y,Ga,la,Ba,Va,Da,b=16;Y=document.createElement("canvas");Y.width=Y.height=2;Ga=Y.getContext("2d");Ga.fillStyle="rgba(0,0,0,1)";Ga.fillRect(0,0,2,2);la=Ga.getImageData(0,0,2,2);Ba=la.data;Va=document.createElement("canvas");Va.width=Va.height=b;Da=Va.getContext("2d");Da.translate(-b/2,-b/2);Da.scale(b,b);b--;this.domElement=u;this.sortElements=this.sortObjects=this.autoClear=!0;this.data={vertices:0,faces:0};this.setSize=function(b,e){p=b;v=e;t=Math.floor(p/2);x=Math.floor(v/2);u.width=p;u.height=
v;M.set(-t,-x,t,x);Z.set(-t,-x,t,x);B=1;D=0;F=N=E=H=G=null};this.setClearColor=function(b,e){z.copy(b);y=e;Z.set(-t,-x,t,x)};this.setClearColorHex=function(b,e){z.setHex(b);y=e;Z.set(-t,-x,t,x)};this.clear=function(){w.setTransform(1,0,0,-1,t,x);Z.isEmpty()||(Z.minSelf(M),Z.inflate(2),y<1&&w.clearRect(Math.floor(Z.getX()),Math.floor(Z.getY()),Math.floor(Z.getWidth()),Math.floor(Z.getHeight())),y>0&&(e(THREE.NormalBlending),c(1),h("rgba("+Math.floor(z.r*255)+","+Math.floor(z.g*255)+","+Math.floor(z.b*
255)+","+y+")"),w.fillRect(Math.floor(Z.getX()),Math.floor(Z.getY()),Math.floor(Z.getWidth()),Math.floor(Z.getHeight()))),Z.empty())};this.render=function(b,u){function p(b){var e,c,f,k=b.lights;ka.setRGB(0,0,0);ya.setRGB(0,0,0);ta.setRGB(0,0,0);b=0;for(e=k.length;b<e;b++)c=k[b],f=c.color,c instanceof THREE.AmbientLight?(ka.r+=f.r,ka.g+=f.g,ka.b+=f.b):c instanceof THREE.DirectionalLight?(ya.r+=f.r,ya.g+=f.g,ya.b+=f.b):c instanceof THREE.PointLight&&(ta.r+=f.r,ta.g+=f.g,ta.b+=f.b)}function v(b,e,c,
f){var k,h,m,o,n=b.lights,b=0;for(k=n.length;b<k;b++)h=n[b],m=h.color,h instanceof THREE.DirectionalLight?(o=c.dot(h.position),o<=0||(o*=h.intensity,f.r+=m.r*o,f.g+=m.g*o,f.b+=m.b*o)):h instanceof THREE.PointLight&&(o=c.dot(oa.sub(h.position,e).normalize()),o<=0||(o*=h.distance==0?1:1-Math.min(e.distanceTo(h.position)/h.distance,1),o!=0&&(o*=h.intensity,f.r+=m.r*o,f.g+=m.g*o,f.b+=m.b*o)))}function z(b,k,m){c(m.opacity);e(m.blending);var o,n,u,la,p,v;if(m instanceof THREE.ParticleBasicMaterial){if(m.map)la=
m.map.image,p=la.width>>1,v=la.height>>1,m=k.scale.x*t,u=k.scale.y*x,o=m*p,n=u*v,T.set(b.x-o,b.y-n,b.x+o,b.y+n),M.instersects(T)&&(w.save(),w.translate(b.x,b.y),w.rotate(-k.rotation),w.scale(m,-u),w.translate(-p,-v),w.drawImage(la,0,0),w.restore())}else m instanceof THREE.ParticleCanvasMaterial&&(o=k.scale.x*t,n=k.scale.y*x,T.set(b.x-o,b.y-n,b.x+o,b.y+n),M.instersects(T)&&(f(m.color.getContextStyle()),h(m.color.getContextStyle()),w.save(),w.translate(b.x,b.y),w.rotate(-k.rotation),w.scale(o,n),m.program(w),
w.restore()))}function B(b,k,h,m){c(m.opacity);e(m.blending);w.beginPath();w.moveTo(b.positionScreen.x,b.positionScreen.y);w.lineTo(k.positionScreen.x,k.positionScreen.y);w.closePath();if(m instanceof THREE.LineBasicMaterial){b=m.linewidth;if(E!=b)w.lineWidth=E=b;b=m.linecap;if(N!=b)w.lineCap=N=b;b=m.linejoin;if(F!=b)w.lineJoin=F=b;f(m.color.getContextStyle());w.stroke();T.inflate(m.linewidth*2)}}function y(b,f,k,h,n,t,la,p,w){m.data.vertices+=3;m.data.faces++;c(p.opacity);e(p.blending);S=b.positionScreen.x;
P=b.positionScreen.y;o=f.positionScreen.x;W=f.positionScreen.y;na=k.positionScreen.x;R=k.positionScreen.y;G(S,P,o,W,na,R);if(p instanceof THREE.MeshBasicMaterial)if(p.map)p.map.mapping instanceof THREE.UVMapping&&(ra=la.uvs[0],Ya(S,P,o,W,na,R,ra[h].u,ra[h].v,ra[n].u,ra[n].v,ra[t].u,ra[t].v,p.map));else if(p.envMap){if(p.envMap.mapping instanceof THREE.SphericalReflectionMapping)b=u.matrixWorldInverse,oa.copy(la.vertexNormalsWorld[0]),sa=(oa.x*b.n11+oa.y*b.n12+oa.z*b.n13)*0.5+0.5,Ca=-(oa.x*b.n21+oa.y*
b.n22+oa.z*b.n23)*0.5+0.5,oa.copy(la.vertexNormalsWorld[1]),wa=(oa.x*b.n11+oa.y*b.n12+oa.z*b.n13)*0.5+0.5,Aa=-(oa.x*b.n21+oa.y*b.n22+oa.z*b.n23)*0.5+0.5,oa.copy(la.vertexNormalsWorld[2]),za=(oa.x*b.n11+oa.y*b.n12+oa.z*b.n13)*0.5+0.5,Fa=-(oa.x*b.n21+oa.y*b.n22+oa.z*b.n23)*0.5+0.5,Ya(S,P,o,W,na,R,sa,Ca,wa,Aa,za,Fa,p.envMap)}else p.wireframe?Ja(p.color,p.wireframeLinewidth,p.wireframeLinecap,p.wireframeLinejoin):Ka(p.color);else if(p instanceof THREE.MeshLambertMaterial)p.map&&!p.wireframe&&(p.map.mapping instanceof
THREE.UVMapping&&(ra=la.uvs[0],Ya(S,P,o,W,na,R,ra[h].u,ra[h].v,ra[n].u,ra[n].v,ra[t].u,ra[t].v,p.map)),e(THREE.SubtractiveBlending)),xa?!p.wireframe&&p.shading==THREE.SmoothShading&&la.vertexNormalsWorld.length==3?(ca.r=X.r=ja.r=ka.r,ca.g=X.g=ja.g=ka.g,ca.b=X.b=ja.b=ka.b,v(w,la.v1.positionWorld,la.vertexNormalsWorld[0],ca),v(w,la.v2.positionWorld,la.vertexNormalsWorld[1],X),v(w,la.v3.positionWorld,la.vertexNormalsWorld[2],ja),ea.r=(X.r+ja.r)*0.5,ea.g=(X.g+ja.g)*0.5,ea.b=(X.b+ja.b)*0.5,va=Wa(ca,X,
ja,ea),Sa(S,P,o,W,na,R,0,0,1,0,0,1,va)):(ha.r=ka.r,ha.g=ka.g,ha.b=ka.b,v(w,la.centroidWorld,la.normalWorld,ha),$.r=Math.max(0,Math.min(p.color.r*ha.r,1)),$.g=Math.max(0,Math.min(p.color.g*ha.g,1)),$.b=Math.max(0,Math.min(p.color.b*ha.b,1)),p.wireframe?Ja($,p.wireframeLinewidth,p.wireframeLinecap,p.wireframeLinejoin):Ka($)):p.wireframe?Ja(p.color,p.wireframeLinewidth,p.wireframeLinecap,p.wireframeLinejoin):Ka(p.color);else if(p instanceof THREE.MeshDepthMaterial)V=u.near,pa=u.far,ca.r=ca.g=ca.b=1-
Na(b.positionScreen.z,V,pa),X.r=X.g=X.b=1-Na(f.positionScreen.z,V,pa),ja.r=ja.g=ja.b=1-Na(k.positionScreen.z,V,pa),ea.r=(X.r+ja.r)*0.5,ea.g=(X.g+ja.g)*0.5,ea.b=(X.b+ja.b)*0.5,va=Wa(ca,X,ja,ea),Sa(S,P,o,W,na,R,0,0,1,0,0,1,va);else if(p instanceof THREE.MeshNormalMaterial)$.r=Ta(la.normalWorld.x),$.g=Ta(la.normalWorld.y),$.b=Ta(la.normalWorld.z),p.wireframe?Ja($,p.wireframeLinewidth,p.wireframeLinecap,p.wireframeLinejoin):Ka($)}function D(b,f,k,h,n,p,la,t,w){m.data.vertices+=4;m.data.faces++;c(t.opacity);
e(t.blending);if(t.map||t.envMap)y(b,f,h,0,1,3,la,t,w),y(n,k,p,1,2,3,la,t,w);else if(S=b.positionScreen.x,P=b.positionScreen.y,o=f.positionScreen.x,W=f.positionScreen.y,na=k.positionScreen.x,R=k.positionScreen.y,ia=h.positionScreen.x,aa=h.positionScreen.y,ma=n.positionScreen.x,fa=n.positionScreen.y,ga=p.positionScreen.x,da=p.positionScreen.y,t instanceof THREE.MeshBasicMaterial)H(S,P,o,W,na,R,ia,aa),t.wireframe?Ja(t.color,t.wireframeLinewidth,t.wireframeLinecap,t.wireframeLinejoin):Ka(t.color);else if(t instanceof
THREE.MeshLambertMaterial)xa?!t.wireframe&&t.shading==THREE.SmoothShading&&la.vertexNormalsWorld.length==4?(ca.r=X.r=ja.r=ea.r=ka.r,ca.g=X.g=ja.g=ea.g=ka.g,ca.b=X.b=ja.b=ea.b=ka.b,v(w,la.v1.positionWorld,la.vertexNormalsWorld[0],ca),v(w,la.v2.positionWorld,la.vertexNormalsWorld[1],X),v(w,la.v4.positionWorld,la.vertexNormalsWorld[3],ja),v(w,la.v3.positionWorld,la.vertexNormalsWorld[2],ea),va=Wa(ca,X,ja,ea),G(S,P,o,W,ia,aa),Sa(S,P,o,W,ia,aa,0,0,1,0,0,1,va),G(ma,fa,na,R,ga,da),Sa(ma,fa,na,R,ga,da,1,
0,1,1,0,1,va)):(ha.r=ka.r,ha.g=ka.g,ha.b=ka.b,v(w,la.centroidWorld,la.normalWorld,ha),$.r=Math.max(0,Math.min(t.color.r*ha.r,1)),$.g=Math.max(0,Math.min(t.color.g*ha.g,1)),$.b=Math.max(0,Math.min(t.color.b*ha.b,1)),H(S,P,o,W,na,R,ia,aa),t.wireframe?Ja($,t.wireframeLinewidth,t.wireframeLinecap,t.wireframeLinejoin):Ka($)):(H(S,P,o,W,na,R,ia,aa),t.wireframe?Ja(t.color,t.wireframeLinewidth,t.wireframeLinecap,t.wireframeLinejoin):Ka(t.color));else if(t instanceof THREE.MeshNormalMaterial)$.r=Ta(la.normalWorld.x),
$.g=Ta(la.normalWorld.y),$.b=Ta(la.normalWorld.z),H(S,P,o,W,na,R,ia,aa),t.wireframe?Ja($,t.wireframeLinewidth,t.wireframeLinecap,t.wireframeLinejoin):Ka($);else if(t instanceof THREE.MeshDepthMaterial)V=u.near,pa=u.far,ca.r=ca.g=ca.b=1-Na(b.positionScreen.z,V,pa),X.r=X.g=X.b=1-Na(f.positionScreen.z,V,pa),ja.r=ja.g=ja.b=1-Na(h.positionScreen.z,V,pa),ea.r=ea.g=ea.b=1-Na(k.positionScreen.z,V,pa),va=Wa(ca,X,ja,ea),G(S,P,o,W,ia,aa),Sa(S,P,o,W,ia,aa,0,0,1,0,0,1,va),G(ma,fa,na,R,ga,da),Sa(ma,fa,na,R,ga,
da,1,0,1,1,0,1,va)}function G(b,e,c,f,k,h){w.beginPath();w.moveTo(b,e);w.lineTo(c,f);w.lineTo(k,h);w.lineTo(b,e);w.closePath()}function H(b,e,c,f,k,h,m,o){w.beginPath();w.moveTo(b,e);w.lineTo(c,f);w.lineTo(k,h);w.lineTo(m,o);w.lineTo(b,e);w.closePath()}function Ja(b,e,c,k){if(E!=e)w.lineWidth=E=e;if(N!=c)w.lineCap=N=c;if(F!=k)w.lineJoin=F=k;f(b.getContextStyle());w.stroke();T.inflate(e*2)}function Ka(b){h(b.getContextStyle());w.fill()}function Ya(b,e,c,f,k,m,o,n,t,p,la,u,v){if(v.image.width!=0){if(v.needsUpdate==
!0||qa[v.id]==void 0){var x=v.wrapS==THREE.RepeatWrapping,Da=v.wrapT==THREE.RepeatWrapping;qa[v.id]=w.createPattern(v.image,x&&Da?"repeat":x&&!Da?"repeat-x":!x&&Da?"repeat-y":"no-repeat");v.needsUpdate=!1}h(qa[v.id]);var x=v.offset.x/v.repeat.x,Da=v.offset.y/v.repeat.y,M=(v.image.width-1)*v.repeat.x,v=(v.image.height-1)*v.repeat.y,o=(o+x)*M,n=(n+Da)*v,t=(t+x)*M,p=(p+Da)*v,la=(la+x)*M,u=(u+Da)*v;c-=b;f-=e;k-=b;m-=e;t-=o;p-=n;la-=o;u-=n;x=1/(t*u-la*p);v=(u*c-p*k)*x;p=(u*f-p*m)*x;c=(t*k-la*c)*x;f=(t*
m-la*f)*x;b=b-v*o-c*n;e=e-p*o-f*n;w.save();w.transform(v,p,c,f,b,e);w.fill();w.restore()}}function Sa(b,e,c,f,k,h,m,o,n,t,p,la,u){var v,x;v=u.width-1;x=u.height-1;m*=v;o*=x;n*=v;t*=x;p*=v;la*=x;c-=b;f-=e;k-=b;h-=e;n-=m;t-=o;p-=m;la-=o;x=1/(n*la-p*t);v=(la*c-t*k)*x;t=(la*f-t*h)*x;c=(n*k-p*c)*x;f=(n*h-p*f)*x;b=b-v*m-c*o;e=e-t*m-f*o;w.save();w.transform(v,t,c,f,b,e);w.clip();w.drawImage(u,0,0);w.restore()}function Wa(b,e,c,f){var k=~~(b.r*255),h=~~(b.g*255),b=~~(b.b*255),m=~~(e.r*255),o=~~(e.g*255),
e=~~(e.b*255),n=~~(c.r*255),t=~~(c.g*255),c=~~(c.b*255),p=~~(f.r*255),u=~~(f.g*255),f=~~(f.b*255);Ba[0]=k<0?0:k>255?255:k;Ba[1]=h<0?0:h>255?255:h;Ba[2]=b<0?0:b>255?255:b;Ba[4]=m<0?0:m>255?255:m;Ba[5]=o<0?0:o>255?255:o;Ba[6]=e<0?0:e>255?255:e;Ba[8]=n<0?0:n>255?255:n;Ba[9]=t<0?0:t>255?255:t;Ba[10]=c<0?0:c>255?255:c;Ba[12]=p<0?0:p>255?255:p;Ba[13]=u<0?0:u>255?255:u;Ba[14]=f<0?0:f>255?255:f;Ga.putImageData(la,0,0);Da.drawImage(Y,0,0);return Va}function Na(b,e,c){b=(b-e)/(c-e);return b*b*(3-2*b)}function Ta(b){b=
(b+1)*0.5;return b<0?0:b>1?1:b}function La(b,e){var c=e.x-b.x,f=e.y-b.y,k=c*c+f*f;k!=0&&(k=1/Math.sqrt(k),c*=k,f*=k,e.x+=c,e.y+=f,b.x-=c,b.y-=f)}var Xa,bb,ua,Ea,Ma,Ua,J,A;this.autoClear?this.clear():w.setTransform(1,0,0,-1,t,x);m.data.vertices=0;m.data.faces=0;k=n.projectScene(b,u,this.sortElements);(xa=b.lights.length>0)&&p(b);Xa=0;for(bb=k.length;Xa<bb;Xa++){ua=k[Xa];T.empty();if(ua instanceof THREE.RenderableParticle){I=ua;I.x*=t;I.y*=x;Ea=0;for(Ma=ua.materials.length;Ea<Ma;)A=ua.materials[Ea++],
A.opacity!=0&&z(I,ua,A,b)}else if(ua instanceof THREE.RenderableLine){if(I=ua.v1,C=ua.v2,I.positionScreen.x*=t,I.positionScreen.y*=x,C.positionScreen.x*=t,C.positionScreen.y*=x,T.addPoint(I.positionScreen.x,I.positionScreen.y),T.addPoint(C.positionScreen.x,C.positionScreen.y),M.instersects(T)){Ea=0;for(Ma=ua.materials.length;Ea<Ma;)A=ua.materials[Ea++],A.opacity!=0&&B(I,C,ua,A,b)}}else if(ua instanceof THREE.RenderableFace3){if(I=ua.v1,C=ua.v2,K=ua.v3,I.positionScreen.x*=t,I.positionScreen.y*=x,C.positionScreen.x*=
t,C.positionScreen.y*=x,K.positionScreen.x*=t,K.positionScreen.y*=x,ua.overdraw&&(La(I.positionScreen,C.positionScreen),La(C.positionScreen,K.positionScreen),La(K.positionScreen,I.positionScreen)),T.add3Points(I.positionScreen.x,I.positionScreen.y,C.positionScreen.x,C.positionScreen.y,K.positionScreen.x,K.positionScreen.y),M.instersects(T)){Ea=0;for(Ma=ua.meshMaterials.length;Ea<Ma;)if(A=ua.meshMaterials[Ea++],A instanceof THREE.MeshFaceMaterial){Ua=0;for(J=ua.faceMaterials.length;Ua<J;)(A=ua.faceMaterials[Ua++])&&
A.opacity!=0&&y(I,C,K,0,1,2,ua,A,b)}else A.opacity!=0&&y(I,C,K,0,1,2,ua,A,b)}}else if(ua instanceof THREE.RenderableFace4&&(I=ua.v1,C=ua.v2,K=ua.v3,U=ua.v4,I.positionScreen.x*=t,I.positionScreen.y*=x,C.positionScreen.x*=t,C.positionScreen.y*=x,K.positionScreen.x*=t,K.positionScreen.y*=x,U.positionScreen.x*=t,U.positionScreen.y*=x,L.positionScreen.copy(C.positionScreen),O.positionScreen.copy(U.positionScreen),ua.overdraw&&(La(I.positionScreen,C.positionScreen),La(C.positionScreen,U.positionScreen),
La(U.positionScreen,I.positionScreen),La(K.positionScreen,L.positionScreen),La(K.positionScreen,O.positionScreen)),T.addPoint(I.positionScreen.x,I.positionScreen.y),T.addPoint(C.positionScreen.x,C.positionScreen.y),T.addPoint(K.positionScreen.x,K.positionScreen.y),T.addPoint(U.positionScreen.x,U.positionScreen.y),M.instersects(T))){Ea=0;for(Ma=ua.meshMaterials.length;Ea<Ma;)if(A=ua.meshMaterials[Ea++],A instanceof THREE.MeshFaceMaterial){Ua=0;for(J=ua.faceMaterials.length;Ua<J;)(A=ua.faceMaterials[Ua++])&&
A.opacity!=0&&D(I,C,K,U,L,O,ua,A,b)}else A.opacity!=0&&D(I,C,K,U,L,O,ua,A,b)}Z.addRectangle(T)}w.setTransform(1,0,0,1,0,0)}};
THREE.SVGRenderer=function(){function b(b,e,c){var f,k,h,m;f=0;for(k=b.lights.length;f<k;f++)h=b.lights[f],h instanceof THREE.DirectionalLight?(m=e.normalWorld.dot(h.position)*h.intensity,m>0&&(c.r+=h.color.r*m,c.g+=h.color.g*m,c.b+=h.color.b*m)):h instanceof THREE.PointLight&&(U.sub(h.position,e.centroidWorld),U.normalize(),m=e.normalWorld.dot(U)*h.intensity,m>0&&(c.r+=h.color.r*m,c.g+=h.color.g*m,c.b+=h.color.b*m))}function c(e,c,k,o,n,t){m.data.vertices+=3;m.data.faces++;S=f(P++);S.setAttribute("d",
"M "+e.positionScreen.x+" "+e.positionScreen.y+" L "+c.positionScreen.x+" "+c.positionScreen.y+" L "+k.positionScreen.x+","+k.positionScreen.y+"z");n instanceof THREE.MeshBasicMaterial?E.copy(n.color):n instanceof THREE.MeshLambertMaterial?H?(N.r=F.r,N.g=F.g,N.b=F.b,b(t,o,N),E.r=Math.max(0,Math.min(n.color.r*N.r,1)),E.g=Math.max(0,Math.min(n.color.g*N.g,1)),E.b=Math.max(0,Math.min(n.color.b*N.b,1))):E.copy(n.color):n instanceof THREE.MeshDepthMaterial?(K=1-n.__2near/(n.__farPlusNear-o.z*n.__farMinusNear),
E.setRGB(K,K,K)):n instanceof THREE.MeshNormalMaterial&&E.setRGB(h(o.normalWorld.x),h(o.normalWorld.y),h(o.normalWorld.z));n.wireframe?S.setAttribute("style","fill: none; stroke: "+E.getContextStyle()+"; stroke-width: "+n.wireframeLinewidth+"; stroke-opacity: "+n.opacity+"; stroke-linecap: "+n.wireframeLinecap+"; stroke-linejoin: "+n.wireframeLinejoin):S.setAttribute("style","fill: "+E.getContextStyle()+"; fill-opacity: "+n.opacity);u.appendChild(S)}function e(e,c,k,o,n,t,p){m.data.vertices+=4;m.data.faces++;
S=f(P++);S.setAttribute("d","M "+e.positionScreen.x+" "+e.positionScreen.y+" L "+c.positionScreen.x+" "+c.positionScreen.y+" L "+k.positionScreen.x+","+k.positionScreen.y+" L "+o.positionScreen.x+","+o.positionScreen.y+"z");t instanceof THREE.MeshBasicMaterial?E.copy(t.color):t instanceof THREE.MeshLambertMaterial?H?(N.r=F.r,N.g=F.g,N.b=F.b,b(p,n,N),E.r=Math.max(0,Math.min(t.color.r*N.r,1)),E.g=Math.max(0,Math.min(t.color.g*N.g,1)),E.b=Math.max(0,Math.min(t.color.b*N.b,1))):E.copy(t.color):t instanceof
THREE.MeshDepthMaterial?(K=1-t.__2near/(t.__farPlusNear-n.z*t.__farMinusNear),E.setRGB(K,K,K)):t instanceof THREE.MeshNormalMaterial&&E.setRGB(h(n.normalWorld.x),h(n.normalWorld.y),h(n.normalWorld.z));t.wireframe?S.setAttribute("style","fill: none; stroke: "+E.getContextStyle()+"; stroke-width: "+t.wireframeLinewidth+"; stroke-opacity: "+t.opacity+"; stroke-linecap: "+t.wireframeLinecap+"; stroke-linejoin: "+t.wireframeLinejoin):S.setAttribute("style","fill: "+E.getContextStyle()+"; fill-opacity: "+
t.opacity);u.appendChild(S)}function f(b){L[b]==null&&(L[b]=document.createElementNS("http://www.w3.org/2000/svg","path"),W==0&&L[b].setAttribute("shape-rendering","crispEdges"));return L[b]}function h(b){b=(b+1)*0.5;return b<0?0:b>1?1:b}var m=this,k=null,n=new THREE.Projector,u=document.createElementNS("http://www.w3.org/2000/svg","svg"),p,v,t,x,w,z,y,B,D=new THREE.Rectangle,G=new THREE.Rectangle,H=!1,E=new THREE.Color(16777215),N=new THREE.Color(16777215),F=new THREE.Color(0),I=new THREE.Color(0),
C=new THREE.Color(0),K,U=new THREE.Vector3,L=[],O=[],S,P,o,W=1;this.domElement=u;this.sortElements=this.sortObjects=this.autoClear=!0;this.data={vertices:0,faces:0};this.setQuality=function(b){switch(b){case "high":W=1;break;case "low":W=0}};this.setSize=function(b,e){p=b;v=e;t=p/2;x=v/2;u.setAttribute("viewBox",-t+" "+-x+" "+p+" "+v);u.setAttribute("width",p);u.setAttribute("height",v);D.set(-t,-x,t,x)};this.clear=function(){for(;u.childNodes.length>0;)u.removeChild(u.childNodes[0])};this.render=
function(b,f){var h,p,v,E,N,L,K,ca;this.autoClear&&this.clear();m.data.vertices=0;m.data.faces=0;k=n.projectScene(b,f,this.sortElements);o=P=0;if(H=b.lights.length>0){K=b.lights;F.setRGB(0,0,0);I.setRGB(0,0,0);C.setRGB(0,0,0);h=0;for(p=K.length;h<p;h++)v=K[h],E=v.color,v instanceof THREE.AmbientLight?(F.r+=E.r,F.g+=E.g,F.b+=E.b):v instanceof THREE.DirectionalLight?(I.r+=E.r,I.g+=E.g,I.b+=E.b):v instanceof THREE.PointLight&&(C.r+=E.r,C.g+=E.g,C.b+=E.b)}h=0;for(p=k.length;h<p;h++)if(K=k[h],G.empty(),
K instanceof THREE.RenderableParticle){w=K;w.x*=t;w.y*=-x;v=0;for(E=K.materials.length;v<E;)v++}else if(K instanceof THREE.RenderableLine){if(w=K.v1,z=K.v2,w.positionScreen.x*=t,w.positionScreen.y*=-x,z.positionScreen.x*=t,z.positionScreen.y*=-x,G.addPoint(w.positionScreen.x,w.positionScreen.y),G.addPoint(z.positionScreen.x,z.positionScreen.y),D.instersects(G)){v=0;for(E=K.materials.length;v<E;)if((ca=K.materials[v++])&&ca.opacity!=0){N=w;L=z;var X=o++;O[X]==null&&(O[X]=document.createElementNS("http://www.w3.org/2000/svg",
"line"),W==0&&O[X].setAttribute("shape-rendering","crispEdges"));S=O[X];S.setAttribute("x1",N.positionScreen.x);S.setAttribute("y1",N.positionScreen.y);S.setAttribute("x2",L.positionScreen.x);S.setAttribute("y2",L.positionScreen.y);ca instanceof THREE.LineBasicMaterial&&(S.setAttribute("style","fill: none; stroke: "+ca.color.getContextStyle()+"; stroke-width: "+ca.linewidth+"; stroke-opacity: "+ca.opacity+"; stroke-linecap: "+ca.linecap+"; stroke-linejoin: "+ca.linejoin),u.appendChild(S))}}}else if(K instanceof
THREE.RenderableFace3){if(w=K.v1,z=K.v2,y=K.v3,w.positionScreen.x*=t,w.positionScreen.y*=-x,z.positionScreen.x*=t,z.positionScreen.y*=-x,y.positionScreen.x*=t,y.positionScreen.y*=-x,G.addPoint(w.positionScreen.x,w.positionScreen.y),G.addPoint(z.positionScreen.x,z.positionScreen.y),G.addPoint(y.positionScreen.x,y.positionScreen.y),D.instersects(G)){v=0;for(E=K.meshMaterials.length;v<E;)if(ca=K.meshMaterials[v++],ca instanceof THREE.MeshFaceMaterial){N=0;for(L=K.faceMaterials.length;N<L;)(ca=K.faceMaterials[N++])&&
ca.opacity!=0&&c(w,z,y,K,ca,b)}else ca&&ca.opacity!=0&&c(w,z,y,K,ca,b)}}else if(K instanceof THREE.RenderableFace4&&(w=K.v1,z=K.v2,y=K.v3,B=K.v4,w.positionScreen.x*=t,w.positionScreen.y*=-x,z.positionScreen.x*=t,z.positionScreen.y*=-x,y.positionScreen.x*=t,y.positionScreen.y*=-x,B.positionScreen.x*=t,B.positionScreen.y*=-x,G.addPoint(w.positionScreen.x,w.positionScreen.y),G.addPoint(z.positionScreen.x,z.positionScreen.y),G.addPoint(y.positionScreen.x,y.positionScreen.y),G.addPoint(B.positionScreen.x,
B.positionScreen.y),D.instersects(G))){v=0;for(E=K.meshMaterials.length;v<E;)if(ca=K.meshMaterials[v++],ca instanceof THREE.MeshFaceMaterial){N=0;for(L=K.faceMaterials.length;N<L;)(ca=K.faceMaterials[N++])&&ca.opacity!=0&&e(w,z,y,B,K,ca,b)}else ca&&ca.opacity!=0&&e(w,z,y,B,K,ca,b)}}};
THREE.ShaderChunk={fog_pars_fragment:"#ifdef USE_FOG\nuniform vec3 fogColor;\n#ifdef FOG_EXP2\nuniform float fogDensity;\n#else\nuniform float fogNear;\nuniform float fogFar;\n#endif\n#endif",fog_fragment:"#ifdef USE_FOG\nfloat depth = gl_FragCoord.z / gl_FragCoord.w;\n#ifdef FOG_EXP2\nconst float LOG2 = 1.442695;\nfloat fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );\nfogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );\n#else\nfloat fogFactor = smoothstep( fogNear, fogFar, depth );\n#endif\ngl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );\n#endif",envmap_pars_fragment:"#ifdef USE_ENVMAP\nvarying vec3 vReflect;\nuniform float reflectivity;\nuniform samplerCube envMap;\nuniform int combine;\n#endif",
envmap_fragment:"#ifdef USE_ENVMAP\nvec4 cubeColor = textureCube( envMap, vec3( -vReflect.x, vReflect.yz ) );\nif ( combine == 1 ) {\ngl_FragColor = vec4( mix( gl_FragColor.xyz, cubeColor.xyz, reflectivity ), opacity );\n} else {\ngl_FragColor = gl_FragColor * cubeColor;\n}\n#endif",envmap_pars_vertex:"#ifdef USE_ENVMAP\nvarying vec3 vReflect;\nuniform float refractionRatio;\nuniform bool useRefract;\n#endif",envmap_vertex:"#ifdef USE_ENVMAP\nvec4 mPosition = objectMatrix * vec4( position, 1.0 );\nvec3 nWorld = mat3( objectMatrix[ 0 ].xyz, objectMatrix[ 1 ].xyz, objectMatrix[ 2 ].xyz ) * normal;\nif ( useRefract ) {\nvReflect = refract( normalize( mPosition.xyz - cameraPosition ), normalize( nWorld.xyz ), refractionRatio );\n} else {\nvReflect = reflect( normalize( mPosition.xyz - cameraPosition ), normalize( nWorld.xyz ) );\n}\n#endif",
map_particle_pars_fragment:"#ifdef USE_MAP\nuniform sampler2D map;\n#endif",map_particle_fragment:"#ifdef USE_MAP\ngl_FragColor = gl_FragColor * texture2D( map, gl_PointCoord );\n#endif",map_pars_vertex:"#ifdef USE_MAP\nvarying vec2 vUv;\nuniform vec4 offsetRepeat;\n#endif",map_pars_fragment:"#ifdef USE_MAP\nvarying vec2 vUv;\nuniform sampler2D map;\n#endif",map_vertex:"#ifdef USE_MAP\nvUv = uv * offsetRepeat.zw + offsetRepeat.xy;\n#endif",map_fragment:"#ifdef USE_MAP\ngl_FragColor = gl_FragColor * texture2D( map, vUv );\n#endif",
lightmap_pars_fragment:"#ifdef USE_LIGHTMAP\nvarying vec2 vUv2;\nuniform sampler2D lightMap;\n#endif",lightmap_pars_vertex:"#ifdef USE_LIGHTMAP\nvarying vec2 vUv2;\n#endif",lightmap_fragment:"#ifdef USE_LIGHTMAP\ngl_FragColor = gl_FragColor * texture2D( lightMap, vUv2 );\n#endif",lightmap_vertex:"#ifdef USE_LIGHTMAP\nvUv2 = uv2;\n#endif",lights_pars_vertex:"uniform bool enableLighting;\nuniform vec3 ambientLightColor;\n#if MAX_DIR_LIGHTS > 0\nuniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];\nuniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];\n#endif\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];\nuniform float pointLightDistance[ MAX_POINT_LIGHTS ];\n#ifdef PHONG\nvarying vec4 vPointLight[ MAX_POINT_LIGHTS ];\n#endif\n#endif",
lights_vertex:"if ( !enableLighting ) {\nvLightWeighting = vec3( 1.0 );\n} else {\nvLightWeighting = ambientLightColor;\n#if MAX_DIR_LIGHTS > 0\nfor( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );\nfloat directionalLightWeighting = max( dot( transformedNormal, normalize( lDirection.xyz ) ), 0.0 );\nvLightWeighting += directionalLightColor[ i ] * directionalLightWeighting;\n}\n#endif\n#if MAX_POINT_LIGHTS > 0\nfor( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz - mvPosition.xyz;\nfloat lDistance = 1.0;\nif ( pointLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );\nlVector = normalize( lVector );\nfloat pointLightWeighting = max( dot( transformedNormal, lVector ), 0.0 );\nvLightWeighting += pointLightColor[ i ] * pointLightWeighting * lDistance;\n#ifdef PHONG\nvPointLight[ i ] = vec4( lVector, lDistance );\n#endif\n}\n#endif\n}",
lights_pars_fragment:"#if MAX_DIR_LIGHTS > 0\nuniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];\n#endif\n#if MAX_POINT_LIGHTS > 0\nvarying vec4 vPointLight[ MAX_POINT_LIGHTS ];\n#endif\nvarying vec3 vViewPosition;\nvarying vec3 vNormal;",lights_fragment:"vec3 normal = normalize( vNormal );\nvec3 viewPosition = normalize( vViewPosition );\nvec4 mColor = vec4( diffuse, opacity );\nvec4 mSpecular = vec4( specular, opacity );\n#if MAX_POINT_LIGHTS > 0\nvec4 pointDiffuse  = vec4( vec3( 0.0 ), 1.0 );\nvec4 pointSpecular = vec4( vec3( 0.0 ), 1.0 );\nfor ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\nvec3 pointVector = normalize( vPointLight[ i ].xyz );\nvec3 pointHalfVector = normalize( vPointLight[ i ].xyz + viewPosition );\nfloat pointDistance = vPointLight[ i ].w;\nfloat pointDotNormalHalf = dot( normal, pointHalfVector );\nfloat pointDiffuseWeight = max( dot( normal, pointVector ), 0.0 );\nfloat pointSpecularWeight = 0.0;\nif ( pointDotNormalHalf >= 0.0 )\npointSpecularWeight = pow( pointDotNormalHalf, shininess );\npointDiffuse  += mColor * pointDiffuseWeight * pointDistance;\npointSpecular += mSpecular * pointSpecularWeight * pointDistance;\n}\n#endif\n#if MAX_DIR_LIGHTS > 0\nvec4 dirDiffuse  = vec4( vec3( 0.0 ), 1.0 );\nvec4 dirSpecular = vec4( vec3( 0.0 ), 1.0 );\nfor( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );\nvec3 dirVector = normalize( lDirection.xyz );\nvec3 dirHalfVector = normalize( lDirection.xyz + viewPosition );\nfloat dirDotNormalHalf = dot( normal, dirHalfVector );\nfloat dirDiffuseWeight = max( dot( normal, dirVector ), 0.0 );\nfloat dirSpecularWeight = 0.0;\nif ( dirDotNormalHalf >= 0.0 )\ndirSpecularWeight = pow( dirDotNormalHalf, shininess );\ndirDiffuse  += mColor * dirDiffuseWeight;\ndirSpecular += mSpecular * dirSpecularWeight;\n}\n#endif\nvec4 totalLight = vec4( ambient, opacity );\n#if MAX_DIR_LIGHTS > 0\ntotalLight += dirDiffuse + dirSpecular;\n#endif\n#if MAX_POINT_LIGHTS > 0\ntotalLight += pointDiffuse + pointSpecular;\n#endif\ngl_FragColor = gl_FragColor * totalLight;",
color_pars_fragment:"#ifdef USE_COLOR\nvarying vec3 vColor;\n#endif",color_fragment:"#ifdef USE_COLOR\ngl_FragColor = gl_FragColor * vec4( vColor, opacity );\n#endif",color_pars_vertex:"#ifdef USE_COLOR\nvarying vec3 vColor;\n#endif",color_vertex:"#ifdef USE_COLOR\nvColor = color;\n#endif",skinning_pars_vertex:"#ifdef USE_SKINNING\nuniform mat4 boneGlobalMatrices[ MAX_BONES ];\n#endif",skinning_vertex:"#ifdef USE_SKINNING\ngl_Position  = ( boneGlobalMatrices[ int( skinIndex.x ) ] * skinVertexA ) * skinWeight.x;\ngl_Position += ( boneGlobalMatrices[ int( skinIndex.y ) ] * skinVertexB ) * skinWeight.y;\ngl_Position  = projectionMatrix * viewMatrix * objectMatrix * gl_Position;\n#endif",
morphtarget_pars_vertex:"#ifdef USE_MORPHTARGETS\nuniform float morphTargetInfluences[ 8 ];\n#endif",morphtarget_vertex:"#ifdef USE_MORPHTARGETS\nvec3 morphed = vec3( 0.0, 0.0, 0.0 );\nmorphed += ( morphTarget0 - position ) * morphTargetInfluences[ 0 ];\nmorphed += ( morphTarget1 - position ) * morphTargetInfluences[ 1 ];\nmorphed += ( morphTarget2 - position ) * morphTargetInfluences[ 2 ];\nmorphed += ( morphTarget3 - position ) * morphTargetInfluences[ 3 ];\nmorphed += ( morphTarget4 - position ) * morphTargetInfluences[ 4 ];\nmorphed += ( morphTarget5 - position ) * morphTargetInfluences[ 5 ];\nmorphed += ( morphTarget6 - position ) * morphTargetInfluences[ 6 ];\nmorphed += ( morphTarget7 - position ) * morphTargetInfluences[ 7 ];\nmorphed += position;\ngl_Position = projectionMatrix * modelViewMatrix * vec4( morphed, 1.0 );\n#endif",
default_vertex:"#ifndef USE_MORPHTARGETS\n#ifndef USE_SKINNING\ngl_Position = projectionMatrix * mvPosition;\n#endif\n#endif",shadowmap_pars_fragment:"#ifdef USE_SHADOWMAP\nuniform sampler2D shadowMap[ MAX_SHADOWS ];\nuniform float shadowDarkness;\nuniform float shadowBias;\nvarying vec4 vShadowCoord[ MAX_SHADOWS ];\nfloat unpackDepth( const in vec4 rgba_depth ) {\nconst vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );\nfloat depth = dot( rgba_depth, bit_shift );\nreturn depth;\n}\n#endif",
shadowmap_fragment:"#ifdef USE_SHADOWMAP\n#ifdef SHADOWMAP_SOFT\nconst float xPixelOffset = 1.0 / SHADOWMAP_WIDTH;\nconst float yPixelOffset = 1.0 / SHADOWMAP_HEIGHT;\n#endif\nvec4 shadowColor = vec4( 1.0 );\nfor( int i = 0; i < MAX_SHADOWS; i ++ ) {\nvec3 shadowCoord = vShadowCoord[ i ].xyz / vShadowCoord[ i ].w;\nif ( shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0 ) {\n#ifdef SHADOWMAP_SOFT\nfloat shadow = 0.0;\nfor ( float y = -1.25; y <= 1.25; y += 1.25 )\nfor ( float x = -1.25; x <= 1.25; x += 1.25 ) {\nvec4 rgbaDepth = texture2D( shadowMap[ i ], vec2( x * xPixelOffset, y * yPixelOffset ) + shadowCoord.xy );\nfloat fDepth = unpackDepth( rgbaDepth );\nif ( fDepth < ( shadowCoord.z + shadowBias ) )\nshadow += 1.0;\n}\nshadow /= 9.0;\nshadowColor = shadowColor * vec4( vec3( ( 1.0 - shadowDarkness * shadow ) ), 1.0 );\n#else\nvec4 rgbaDepth = texture2D( shadowMap[ i ], shadowCoord.xy );\nfloat fDepth = unpackDepth( rgbaDepth );\nif ( fDepth < ( shadowCoord.z + shadowBias ) )\nshadowColor = shadowColor * vec4( vec3( shadowDarkness ), 1.0 );\n#endif\n}\n}\ngl_FragColor = gl_FragColor * shadowColor;\n#endif",
shadowmap_pars_vertex:"#ifdef USE_SHADOWMAP\nvarying vec4 vShadowCoord[ MAX_SHADOWS ];\nuniform mat4 shadowMatrix[ MAX_SHADOWS ];\n#endif",shadowmap_vertex:"#ifdef USE_SHADOWMAP\nfor( int i = 0; i < MAX_SHADOWS; i ++ ) {\nvShadowCoord[ i ] = shadowMatrix[ i ] * objectMatrix * vec4( position, 1.0 );\n}\n#endif",alphatest_fragment:"#ifdef ALPHATEST\nif ( gl_FragColor.a < ALPHATEST ) discard;\n#endif"};
THREE.UniformsUtils={merge:function(b){var c,e,f,h={};for(c=0;c<b.length;c++)for(e in f=this.clone(b[c]),f)h[e]=f[e];return h},clone:function(b){var c,e,f,h={};for(c in b)for(e in h[c]={},b[c])f=b[c][e],h[c][e]=f instanceof THREE.Color||f instanceof THREE.Vector2||f instanceof THREE.Vector3||f instanceof THREE.Vector4||f instanceof THREE.Matrix4||f instanceof THREE.Texture?f.clone():f instanceof Array?f.slice():f;return h}};
THREE.UniformsLib={common:{diffuse:{type:"c",value:new THREE.Color(15658734)},opacity:{type:"f",value:1},map:{type:"t",value:0,texture:null},offsetRepeat:{type:"v4",value:new THREE.Vector4(0,0,1,1)},lightMap:{type:"t",value:2,texture:null},envMap:{type:"t",value:1,texture:null},useRefract:{type:"i",value:0},reflectivity:{type:"f",value:1},refractionRatio:{type:"f",value:0.98},combine:{type:"i",value:0},morphTargetInfluences:{type:"f",value:0}},fog:{fogDensity:{type:"f",value:2.5E-4},fogNear:{type:"f",
value:1},fogFar:{type:"f",value:2E3},fogColor:{type:"c",value:new THREE.Color(16777215)}},lights:{enableLighting:{type:"i",value:1},ambientLightColor:{type:"fv",value:[]},directionalLightDirection:{type:"fv",value:[]},directionalLightColor:{type:"fv",value:[]},pointLightColor:{type:"fv",value:[]},pointLightPosition:{type:"fv",value:[]},pointLightDistance:{type:"fv1",value:[]}},particle:{psColor:{type:"c",value:new THREE.Color(15658734)},opacity:{type:"f",value:1},size:{type:"f",value:1},scale:{type:"f",
value:1},map:{type:"t",value:0,texture:null},fogDensity:{type:"f",value:2.5E-4},fogNear:{type:"f",value:1},fogFar:{type:"f",value:2E3},fogColor:{type:"c",value:new THREE.Color(16777215)}},shadowmap:{shadowMap:{type:"tv",value:3,texture:[]},shadowMatrix:{type:"m4v",value:[]},shadowBias:{type:"f",value:0.0039},shadowDarkness:{type:"f",value:0.2}}};
THREE.ShaderLib={lensFlareVertexTexture:{vertexShader:"uniform vec3 screenPosition;\nuniform vec2 scale;\nuniform float rotation;\nuniform int renderType;\nuniform sampler2D occlusionMap;\nattribute vec2 position;\nattribute vec2 UV;\nvarying vec2 vUV;\nvarying float vVisibility;\nvoid main() {\nvUV = UV;\nvec2 pos = position;\nif( renderType == 2 ) {\nvec4 visibility = texture2D( occlusionMap, vec2( 0.1, 0.1 ) ) +\ntexture2D( occlusionMap, vec2( 0.5, 0.1 ) ) +\ntexture2D( occlusionMap, vec2( 0.9, 0.1 ) ) +\ntexture2D( occlusionMap, vec2( 0.9, 0.5 ) ) +\ntexture2D( occlusionMap, vec2( 0.9, 0.9 ) ) +\ntexture2D( occlusionMap, vec2( 0.5, 0.9 ) ) +\ntexture2D( occlusionMap, vec2( 0.1, 0.9 ) ) +\ntexture2D( occlusionMap, vec2( 0.1, 0.5 ) ) +\ntexture2D( occlusionMap, vec2( 0.5, 0.5 ) );\nvVisibility = (       visibility.r / 9.0 ) *\n( 1.0 - visibility.g / 9.0 ) *\n(       visibility.b / 9.0 ) *\n( 1.0 - visibility.a / 9.0 );\npos.x = cos( rotation ) * position.x - sin( rotation ) * position.y;\npos.y = sin( rotation ) * position.x + cos( rotation ) * position.y;\n}\ngl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );\n}",fragmentShader:"#ifdef GL_ES\nprecision highp float;\n#endif\nuniform sampler2D map;\nuniform float opacity;\nuniform int renderType;\nvarying vec2 vUV;\nvarying float vVisibility;\nvoid main() {\nif( renderType == 0 ) {\ngl_FragColor = vec4( 1.0, 0.0, 1.0, 0.0 );\n} else if( renderType == 1 ) {\ngl_FragColor = texture2D( map, vUV );\n} else {\nvec4 color = texture2D( map, vUV );\ncolor.a *= opacity * vVisibility;\ngl_FragColor = color;\n}\n}"},
lensFlare:{vertexShader:"uniform vec3 screenPosition;\nuniform vec2 scale;\nuniform float rotation;\nuniform int renderType;\nattribute vec2 position;\nattribute vec2 UV;\nvarying vec2 vUV;\nvoid main() {\nvUV = UV;\nvec2 pos = position;\nif( renderType == 2 ) {\npos.x = cos( rotation ) * position.x - sin( rotation ) * position.y;\npos.y = sin( rotation ) * position.x + cos( rotation ) * position.y;\n}\ngl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );\n}",fragmentShader:"#ifdef GL_ES\nprecision highp float;\n#endif\nuniform sampler2D map;\nuniform sampler2D occlusionMap;\nuniform float opacity;\nuniform int renderType;\nvarying vec2 vUV;\nvoid main() {\nif( renderType == 0 ) {\ngl_FragColor = vec4( texture2D( map, vUV ).rgb, 0.0 );\n} else if( renderType == 1 ) {\ngl_FragColor = texture2D( map, vUV );\n} else {\nfloat visibility = texture2D( occlusionMap, vec2( 0.5, 0.1 ) ).a +\ntexture2D( occlusionMap, vec2( 0.9, 0.5 ) ).a +\ntexture2D( occlusionMap, vec2( 0.5, 0.9 ) ).a +\ntexture2D( occlusionMap, vec2( 0.1, 0.5 ) ).a;\nvisibility = ( 1.0 - visibility / 4.0 );\nvec4 color = texture2D( map, vUV );\ncolor.a *= opacity * visibility;\ngl_FragColor = color;\n}\n}"},
sprite:{vertexShader:"uniform int useScreenCoordinates;\nuniform int affectedByDistance;\nuniform vec3 screenPosition;\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\nuniform float rotation;\nuniform vec2 scale;\nuniform vec2 alignment;\nuniform vec2 uvOffset;\nuniform vec2 uvScale;\nattribute vec2 position;\nattribute vec2 uv;\nvarying vec2 vUV;\nvoid main() {\nvUV = uvOffset + uv * uvScale;\nvec2 alignedPosition = position + alignment;\nvec2 rotatedPosition;\nrotatedPosition.x = ( cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y ) * scale.x;\nrotatedPosition.y = ( sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y ) * scale.y;\nvec4 finalPosition;\nif( useScreenCoordinates != 0 ) {\nfinalPosition = vec4( screenPosition.xy + rotatedPosition, screenPosition.z, 1.0 );\n} else {\nfinalPosition = projectionMatrix * modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );\nfinalPosition.xy += rotatedPosition * ( affectedByDistance == 1 ? 1.0 : finalPosition.z );\n}\ngl_Position = finalPosition;\n}",
fragmentShader:"#ifdef GL_ES\nprecision highp float;\n#endif\nuniform sampler2D map;\nuniform float opacity;\nvarying vec2 vUV;\nvoid main() {\nvec4 color = texture2D( map, vUV );\ncolor.a *= opacity;\ngl_FragColor = color;\n}"},shadowPost:{vertexShader:"uniform \tmat4 \tprojectionMatrix;\nattribute \tvec3 \tposition;\nvoid main() {\ngl_Position = projectionMatrix * vec4( position, 1.0 );\n}",fragmentShader:"#ifdef GL_ES\nprecision highp float;\n#endif\nuniform \tfloat \tdarkness;\nvoid main() {\ngl_FragColor = vec4( 0, 0, 0, darkness );\n}"},
shadowVolumeDynamic:{uniforms:{directionalLightDirection:{type:"fv",value:[]}},vertexShader:"uniform \tvec3 \tdirectionalLightDirection;\nvoid main() {\nvec4 pos      = objectMatrix * vec4( position, 1.0 );\nvec3 norm     = mat3( objectMatrix[ 0 ].xyz, objectMatrix[ 1 ].xyz, objectMatrix[ 2 ].xyz ) * normal;\nvec4 extruded = vec4( directionalLightDirection * 5000.0 * step( 0.0, dot( directionalLightDirection, norm ) ), 0.0 );\ngl_Position   = projectionMatrix * viewMatrix * ( pos + extruded );\n}",
fragmentShader:"void main() {\ngl_FragColor = vec4( 1.0 );\n}"},depth:{uniforms:{mNear:{type:"f",value:1},mFar:{type:"f",value:2E3},opacity:{type:"f",value:1}},fragmentShader:"uniform float mNear;\nuniform float mFar;\nuniform float opacity;\nvoid main() {\nfloat depth = gl_FragCoord.z / gl_FragCoord.w;\nfloat color = 1.0 - smoothstep( mNear, mFar, depth );\ngl_FragColor = vec4( vec3( color ), opacity );\n}",vertexShader:"void main() {\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}"},
normal:{uniforms:{opacity:{type:"f",value:1}},fragmentShader:"uniform float opacity;\nvarying vec3 vNormal;\nvoid main() {\ngl_FragColor = vec4( 0.5 * normalize( vNormal ) + 0.5, opacity );\n}",vertexShader:"varying vec3 vNormal;\nvoid main() {\nvec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\nvNormal = normalize( normalMatrix * normal );\ngl_Position = projectionMatrix * mvPosition;\n}"},basic:{uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.common,THREE.UniformsLib.fog,THREE.UniformsLib.shadowmap]),
fragmentShader:["uniform vec3 diffuse;\nuniform float opacity;",THREE.ShaderChunk.color_pars_fragment,THREE.ShaderChunk.map_pars_fragment,THREE.ShaderChunk.lightmap_pars_fragment,THREE.ShaderChunk.envmap_pars_fragment,THREE.ShaderChunk.fog_pars_fragment,THREE.ShaderChunk.shadowmap_pars_fragment,"void main() {\ngl_FragColor = vec4( diffuse, opacity );",THREE.ShaderChunk.map_fragment,THREE.ShaderChunk.alphatest_fragment,THREE.ShaderChunk.lightmap_fragment,THREE.ShaderChunk.color_fragment,THREE.ShaderChunk.envmap_fragment,
THREE.ShaderChunk.shadowmap_fragment,THREE.ShaderChunk.fog_fragment,"}"].join("\n"),vertexShader:[THREE.ShaderChunk.map_pars_vertex,THREE.ShaderChunk.lightmap_pars_vertex,THREE.ShaderChunk.envmap_pars_vertex,THREE.ShaderChunk.color_pars_vertex,THREE.ShaderChunk.skinning_pars_vertex,THREE.ShaderChunk.morphtarget_pars_vertex,THREE.ShaderChunk.shadowmap_pars_vertex,"void main() {\nvec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",THREE.ShaderChunk.map_vertex,THREE.ShaderChunk.lightmap_vertex,
THREE.ShaderChunk.envmap_vertex,THREE.ShaderChunk.color_vertex,THREE.ShaderChunk.skinning_vertex,THREE.ShaderChunk.morphtarget_vertex,THREE.ShaderChunk.default_vertex,THREE.ShaderChunk.shadowmap_vertex,"}"].join("\n")},lambert:{uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.common,THREE.UniformsLib.fog,THREE.UniformsLib.lights,THREE.UniformsLib.shadowmap]),fragmentShader:["uniform vec3 diffuse;\nuniform float opacity;\nvarying vec3 vLightWeighting;",THREE.ShaderChunk.color_pars_fragment,THREE.ShaderChunk.map_pars_fragment,
THREE.ShaderChunk.lightmap_pars_fragment,THREE.ShaderChunk.envmap_pars_fragment,THREE.ShaderChunk.fog_pars_fragment,THREE.ShaderChunk.shadowmap_pars_fragment,"void main() {\ngl_FragColor = vec4( diffuse, opacity );",THREE.ShaderChunk.map_fragment,THREE.ShaderChunk.alphatest_fragment,"gl_FragColor = gl_FragColor * vec4( vLightWeighting, 1.0 );",THREE.ShaderChunk.lightmap_fragment,THREE.ShaderChunk.color_fragment,THREE.ShaderChunk.envmap_fragment,THREE.ShaderChunk.shadowmap_fragment,THREE.ShaderChunk.fog_fragment,
"}"].join("\n"),vertexShader:["varying vec3 vLightWeighting;",THREE.ShaderChunk.map_pars_vertex,THREE.ShaderChunk.lightmap_pars_vertex,THREE.ShaderChunk.envmap_pars_vertex,THREE.ShaderChunk.lights_pars_vertex,THREE.ShaderChunk.color_pars_vertex,THREE.ShaderChunk.skinning_pars_vertex,THREE.ShaderChunk.morphtarget_pars_vertex,THREE.ShaderChunk.shadowmap_pars_vertex,"void main() {\nvec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",THREE.ShaderChunk.map_vertex,THREE.ShaderChunk.lightmap_vertex,
THREE.ShaderChunk.envmap_vertex,THREE.ShaderChunk.color_vertex,"vec3 transformedNormal = normalize( normalMatrix * normal );",THREE.ShaderChunk.lights_vertex,THREE.ShaderChunk.skinning_vertex,THREE.ShaderChunk.morphtarget_vertex,THREE.ShaderChunk.default_vertex,THREE.ShaderChunk.shadowmap_vertex,"}"].join("\n")},phong:{uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.common,THREE.UniformsLib.fog,THREE.UniformsLib.lights,THREE.UniformsLib.shadowmap,{ambient:{type:"c",value:new THREE.Color(328965)},
specular:{type:"c",value:new THREE.Color(1118481)},shininess:{type:"f",value:30}}]),fragmentShader:["uniform vec3 diffuse;\nuniform float opacity;\nuniform vec3 ambient;\nuniform vec3 specular;\nuniform float shininess;\nvarying vec3 vLightWeighting;",THREE.ShaderChunk.color_pars_fragment,THREE.ShaderChunk.map_pars_fragment,THREE.ShaderChunk.lightmap_pars_fragment,THREE.ShaderChunk.envmap_pars_fragment,THREE.ShaderChunk.fog_pars_fragment,THREE.ShaderChunk.lights_pars_fragment,THREE.ShaderChunk.shadowmap_pars_fragment,
"void main() {\ngl_FragColor = vec4( vLightWeighting, 1.0 );",THREE.ShaderChunk.map_fragment,THREE.ShaderChunk.alphatest_fragment,THREE.ShaderChunk.lights_fragment,THREE.ShaderChunk.lightmap_fragment,THREE.ShaderChunk.color_fragment,THREE.ShaderChunk.envmap_fragment,THREE.ShaderChunk.shadowmap_fragment,THREE.ShaderChunk.fog_fragment,"}"].join("\n"),vertexShader:["#define PHONG\nvarying vec3 vLightWeighting;\nvarying vec3 vViewPosition;\nvarying vec3 vNormal;",THREE.ShaderChunk.map_pars_vertex,THREE.ShaderChunk.lightmap_pars_vertex,
THREE.ShaderChunk.envmap_pars_vertex,THREE.ShaderChunk.lights_pars_vertex,THREE.ShaderChunk.color_pars_vertex,THREE.ShaderChunk.skinning_pars_vertex,THREE.ShaderChunk.morphtarget_pars_vertex,THREE.ShaderChunk.shadowmap_pars_vertex,"void main() {\nvec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",THREE.ShaderChunk.map_vertex,THREE.ShaderChunk.lightmap_vertex,THREE.ShaderChunk.envmap_vertex,THREE.ShaderChunk.color_vertex,"#ifndef USE_ENVMAP\nvec4 mPosition = objectMatrix * vec4( position, 1.0 );\n#endif\nvViewPosition = -mvPosition.xyz;\nvec3 transformedNormal = normalize( normalMatrix * normal );\nvNormal = transformedNormal;",
THREE.ShaderChunk.lights_vertex,THREE.ShaderChunk.skinning_vertex,THREE.ShaderChunk.morphtarget_vertex,THREE.ShaderChunk.default_vertex,THREE.ShaderChunk.shadowmap_vertex,"}"].join("\n")},particle_basic:{uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.particle,THREE.UniformsLib.shadowmap]),fragmentShader:["uniform vec3 psColor;\nuniform float opacity;",THREE.ShaderChunk.color_pars_fragment,THREE.ShaderChunk.map_particle_pars_fragment,THREE.ShaderChunk.fog_pars_fragment,THREE.ShaderChunk.shadowmap_pars_fragment,
"void main() {\ngl_FragColor = vec4( psColor, opacity );",THREE.ShaderChunk.map_particle_fragment,THREE.ShaderChunk.alphatest_fragment,THREE.ShaderChunk.color_fragment,THREE.ShaderChunk.shadowmap_fragment,THREE.ShaderChunk.fog_fragment,"}"].join("\n"),vertexShader:["uniform float size;\nuniform float scale;",THREE.ShaderChunk.color_pars_vertex,THREE.ShaderChunk.shadowmap_pars_vertex,"void main() {",THREE.ShaderChunk.color_vertex,"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\n#ifdef USE_SIZEATTENUATION\ngl_PointSize = size * ( scale / length( mvPosition.xyz ) );\n#else\ngl_PointSize = size;\n#endif\ngl_Position = projectionMatrix * mvPosition;",
THREE.ShaderChunk.shadowmap_vertex,"}"].join("\n")},depthRGBA:{uniforms:{},fragmentShader:"vec4 pack_depth( const in float depth ) {\nconst vec4 bit_shift = vec4( 256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0 );\nconst vec4 bit_mask  = vec4( 0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0 );\nvec4 res = fract( depth * bit_shift );\nres -= res.xxyz * bit_mask;\nreturn res;\n}\nvoid main() {\ngl_FragData[ 0 ] = pack_depth( gl_FragCoord.z );\n}",vertexShader:[THREE.ShaderChunk.morphtarget_pars_vertex,
"void main() {\nvec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",THREE.ShaderChunk.morphtarget_vertex,THREE.ShaderChunk.default_vertex,"}"].join("\n")}};
THREE.WebGLRenderer=function(b){function c(b,e,c){var f,k,h,m=b.vertices,n=m.length,t=b.colors,p=t.length,u=b.__vertexArray,v=b.__colorArray,w=b.__sortArray,x=b.__dirtyVertices,M=b.__dirtyColors,T=b.__webglCustomAttributes,z,y;if(T)for(z in T)T[z].offset=0;if(c.sortParticles){pa.multiplySelf(c.matrixWorld);for(f=0;f<n;f++)k=m[f].position,sa.copy(k),pa.multiplyVector3(sa),w[f]=[sa.z,f];w.sort(function(b,e){return e[0]-b[0]});for(f=0;f<n;f++)k=m[w[f][1]].position,h=f*3,u[h]=k.x,u[h+1]=k.y,u[h+2]=k.z;
for(f=0;f<p;f++)h=f*3,color=t[w[f][1]],v[h]=color.r,v[h+1]=color.g,v[h+2]=color.b;if(T)for(z in T){f=T[z];t=f.value.length;for(h=0;h<t;h++){index=w[h][1];p=f.offset;if(f.size===1){if(f.boundTo===void 0||f.boundTo==="vertices")f.array[p]=f.value[index]}else{if(f.boundTo===void 0||f.boundTo==="vertices")y=f.value[index];f.size===2?(f.array[p]=y.x,f.array[p+1]=y.y):f.size===3?f.type==="c"?(f.array[p]=y.r,f.array[p+1]=y.g,f.array[p+2]=y.b):(f.array[p]=y.x,f.array[p+1]=y.y,f.array[p+2]=y.z):(f.array[p]=
y.x,f.array[p+1]=y.y,f.array[p+2]=y.z,f.array[p+3]=y.w)}f.offset+=f.size}}}else{if(x)for(f=0;f<n;f++)k=m[f].position,h=f*3,u[h]=k.x,u[h+1]=k.y,u[h+2]=k.z;if(M)for(f=0;f<p;f++)color=t[f],h=f*3,v[h]=color.r,v[h+1]=color.g,v[h+2]=color.b;if(T)for(z in T)if(f=T[z],f.__original.needsUpdate){t=f.value.length;for(h=0;h<t;h++){p=f.offset;if(f.size===1){if(f.boundTo===void 0||f.boundTo==="vertices")f.array[p]=f.value[h]}else{if(f.boundTo===void 0||f.boundTo==="vertices")y=f.value[h];f.size===2?(f.array[p]=
y.x,f.array[p+1]=y.y):f.size===3?f.type==="c"?(f.array[p]=y.r,f.array[p+1]=y.g,f.array[p+2]=y.b):(f.array[p]=y.x,f.array[p+1]=y.y,f.array[p+2]=y.z):(f.array[p]=y.x,f.array[p+1]=y.y,f.array[p+2]=y.z,f.array[p+3]=y.w)}f.offset+=f.size}}}if(x||c.sortParticles)o.bindBuffer(o.ARRAY_BUFFER,b.__webglVertexBuffer),o.bufferData(o.ARRAY_BUFFER,u,e);if(M||c.sortParticles)o.bindBuffer(o.ARRAY_BUFFER,b.__webglColorBuffer),o.bufferData(o.ARRAY_BUFFER,v,e);if(T)for(z in T)if(f=T[z],f.__original.needsUpdate||c.sortParticles)o.bindBuffer(o.ARRAY_BUFFER,
f.buffer),o.bufferData(o.ARRAY_BUFFER,f.array,e)}function e(b,e,c,f,h){f.program||P.initMaterial(f,e,c,h);if(f.morphTargets&&!h.__webglMorphTargetInfluences){h.__webglMorphTargetInfluences=new Float32Array(P.maxMorphTargets);for(var k=0,m=P.maxMorphTargets;k<m;k++)h.__webglMorphTargetInfluences[k]=0}var k=f.program,m=k.uniforms,n=f.uniforms;k!=na&&(o.useProgram(k),na=k);o.uniformMatrix4fv(m.projectionMatrix,!1,va);if(c&&(f instanceof THREE.MeshBasicMaterial||f instanceof THREE.MeshLambertMaterial||
f instanceof THREE.MeshPhongMaterial||f instanceof THREE.LineBasicMaterial||f instanceof THREE.ParticleBasicMaterial||f.fog))if(n.fogColor.value=c.color,c instanceof THREE.Fog)n.fogNear.value=c.near,n.fogFar.value=c.far;else if(c instanceof THREE.FogExp2)n.fogDensity.value=c.density;if(f instanceof THREE.MeshPhongMaterial||f instanceof THREE.MeshLambertMaterial||f.lights){var p,t,u,v=0,w=0,x=0,M,T,z,y=Ca,B=y.directional.colors,Z=y.directional.positions,D=y.point.colors,G=y.point.positions,H=y.point.distances,
E=0,V=0,c=t=z=0;for(p=e.length;c<p;c++)if(t=e[c],u=t.color,M=t.position,T=t.intensity,z=t.distance,t instanceof THREE.AmbientLight)v+=u.r,w+=u.g,x+=u.b;else if(t instanceof THREE.DirectionalLight)z=E*3,B[z]=u.r*T,B[z+1]=u.g*T,B[z+2]=u.b*T,Z[z]=M.x,Z[z+1]=M.y,Z[z+2]=M.z,E+=1;else if(t instanceof THREE.SpotLight)z=E*3,B[z]=u.r*T,B[z+1]=u.g*T,B[z+2]=u.b*T,u=1/M.length(),Z[z]=M.x*u,Z[z+1]=M.y*u,Z[z+2]=M.z*u,E+=1;else if(t instanceof THREE.PointLight)t=V*3,D[t]=u.r*T,D[t+1]=u.g*T,D[t+2]=u.b*T,G[t]=M.x,
G[t+1]=M.y,G[t+2]=M.z,H[V]=z,V+=1;for(c=E*3;c<B.length;c++)B[c]=0;for(c=V*3;c<D.length;c++)D[c]=0;y.point.length=V;y.directional.length=E;y.ambient[0]=v;y.ambient[1]=w;y.ambient[2]=x;e=Ca;n.enableLighting.value=e.directional.length+e.point.length;n.ambientLightColor.value=e.ambient;n.directionalLightColor.value=e.directional.colors;n.directionalLightDirection.value=e.directional.positions;n.pointLightColor.value=e.point.colors;n.pointLightPosition.value=e.point.positions;n.pointLightDistance.value=
e.point.distances}if(f instanceof THREE.MeshBasicMaterial||f instanceof THREE.MeshLambertMaterial||f instanceof THREE.MeshPhongMaterial)n.diffuse.value=f.color,n.opacity.value=f.opacity,(n.map.texture=f.map)&&n.offsetRepeat.value.set(f.map.offset.x,f.map.offset.y,f.map.repeat.x,f.map.repeat.y),n.lightMap.texture=f.lightMap,n.envMap.texture=f.envMap,n.reflectivity.value=f.reflectivity,n.refractionRatio.value=f.refractionRatio,n.combine.value=f.combine,n.useRefract.value=f.envMap&&f.envMap.mapping instanceof
THREE.CubeRefractionMapping;if(f instanceof THREE.LineBasicMaterial)n.diffuse.value=f.color,n.opacity.value=f.opacity;else if(f instanceof THREE.ParticleBasicMaterial)n.psColor.value=f.color,n.opacity.value=f.opacity,n.size.value=f.size,n.scale.value=wa.height/2,n.map.texture=f.map;else if(f instanceof THREE.MeshPhongMaterial)n.ambient.value=f.ambient,n.specular.value=f.specular,n.shininess.value=f.shininess;else if(f instanceof THREE.MeshDepthMaterial)n.mNear.value=b.near,n.mFar.value=b.far,n.opacity.value=
f.opacity;else if(f instanceof THREE.MeshNormalMaterial)n.opacity.value=f.opacity;if(h.receiveShadow&&!f._shadowPass&&n.shadowMatrix){for(e=0;e<xa.length;e++)n.shadowMatrix.value[e]=xa[e],n.shadowMap.texture[e]=P.shadowMap[e];n.shadowDarkness.value=P.shadowMapDarkness;n.shadowBias.value=P.shadowMapBias}for(var ka in n)if(p=k.uniforms[ka])if(c=n[ka],v=c.type,e=c.value,v=="i")o.uniform1i(p,e);else if(v=="f")o.uniform1f(p,e);else if(v=="v2")o.uniform2f(p,e.x,e.y);else if(v=="v3")o.uniform3f(p,e.x,e.y,
e.z);else if(v=="v4")o.uniform4f(p,e.x,e.y,e.z,e.w);else if(v=="c")o.uniform3f(p,e.r,e.g,e.b);else if(v=="fv1")o.uniform1fv(p,e);else if(v=="fv")o.uniform3fv(p,e);else if(v=="v3v"){if(!c._array)c._array=new Float32Array(3*e.length);v=0;for(w=e.length;v<w;v++)x=v*3,c._array[x]=e[v].x,c._array[x+1]=e[v].y,c._array[x+2]=e[v].z;o.uniform3fv(p,c._array)}else if(v=="m4"){if(!c._array)c._array=new Float32Array(16);e.flattenToArray(c._array);o.uniformMatrix4fv(p,!1,c._array)}else if(v=="m4v"){if(!c._array)c._array=
new Float32Array(16*e.length);v=0;for(w=e.length;v<w;v++)e[v].flattenToArrayOffset(c._array,v*16);o.uniformMatrix4fv(p,!1,c._array)}else if(v=="t"){if(o.uniform1i(p,e),p=c.texture)if(p.image instanceof Array&&p.image.length==6){if(c=p,c.image.length==6)if(c.needsUpdate){if(!c.image.__webglTextureCube)c.image.__webglTextureCube=o.createTexture();o.activeTexture(o.TEXTURE0+e);o.bindTexture(o.TEXTURE_CUBE_MAP,c.image.__webglTextureCube);for(e=0;e<6;e++)o.texImage2D(o.TEXTURE_CUBE_MAP_POSITIVE_X+e,0,
o.RGBA,o.RGBA,o.UNSIGNED_BYTE,c.image[e]);I(o.TEXTURE_CUBE_MAP,c,c.image[0]);c.needsUpdate=!1}else o.activeTexture(o.TEXTURE0+e),o.bindTexture(o.TEXTURE_CUBE_MAP,c.image.__webglTextureCube)}else p instanceof THREE.WebGLRenderTargetCube?(c=p,o.activeTexture(o.TEXTURE0+e),o.bindTexture(o.TEXTURE_CUBE_MAP,c.__webglTexture)):C(p,e)}else if(v=="tv"){if(!c._array){c._array=[];v=0;for(w=c.texture.length;v<w;v++)c._array[v]=e+v}o.uniform1iv(p,c._array);v=0;for(w=c.texture.length;v<w;v++)(p=c.texture[v])&&
C(p,c._array[v])}o.uniformMatrix4fv(m.modelViewMatrix,!1,h._modelViewMatrixArray);m.normalMatrix&&o.uniformMatrix3fv(m.normalMatrix,!1,h._normalMatrixArray);(f instanceof THREE.MeshShaderMaterial||f instanceof THREE.MeshPhongMaterial||f.envMap)&&m.cameraPosition!==null&&o.uniform3f(m.cameraPosition,b.position.x,b.position.y,b.position.z);(f instanceof THREE.MeshShaderMaterial||f.envMap||f.skinning||h.receiveShadow)&&m.objectMatrix!==null&&o.uniformMatrix4fv(m.objectMatrix,!1,h._objectMatrixArray);
(f instanceof THREE.MeshPhongMaterial||f instanceof THREE.MeshLambertMaterial||f instanceof THREE.MeshShaderMaterial||f.skinning)&&m.viewMatrix!==null&&o.uniformMatrix4fv(m.viewMatrix,!1,ra);f.skinning&&(o.uniformMatrix4fv(m.cameraInverseMatrix,!1,ra),o.uniformMatrix4fv(m.boneGlobalMatrices,!1,h.boneMatrices));return k}function f(b,c,f,h,k,m){if(h.opacity!=0){var n,b=e(b,c,f,h,m).attributes;if(!h.morphTargets&&b.position>=0)o.bindBuffer(o.ARRAY_BUFFER,k.__webglVertexBuffer),o.vertexAttribPointer(b.position,
3,o.FLOAT,!1,0,0);else if(m.morphTargetBase){c=h.program.attributes;m.morphTargetBase!==-1?(o.bindBuffer(o.ARRAY_BUFFER,k.__webglMorphTargetsBuffers[m.morphTargetBase]),o.vertexAttribPointer(c.position,3,o.FLOAT,!1,0,0)):c.position>=0&&(o.bindBuffer(o.ARRAY_BUFFER,k.__webglVertexBuffer),o.vertexAttribPointer(c.position,3,o.FLOAT,!1,0,0));if(m.morphTargetForcedOrder.length)for(var f=0,p=m.morphTargetForcedOrder,t=m.morphTargetInfluences;f<h.numSupportedMorphTargets&&f<p.length;)o.bindBuffer(o.ARRAY_BUFFER,
k.__webglMorphTargetsBuffers[p[f]]),o.vertexAttribPointer(c["morphTarget"+f],3,o.FLOAT,!1,0,0),m.__webglMorphTargetInfluences[f]=t[p[f]],f++;else{var p=[],u=-1,v=0,t=m.morphTargetInfluences,w,x=t.length,f=0;for(m.morphTargetBase!==-1&&(p[m.morphTargetBase]=!0);f<h.numSupportedMorphTargets;){for(w=0;w<x;w++)!p[w]&&t[w]>u&&(v=w,u=t[v]);o.bindBuffer(o.ARRAY_BUFFER,k.__webglMorphTargetsBuffers[v]);o.vertexAttribPointer(c["morphTarget"+f],3,o.FLOAT,!1,0,0);m.__webglMorphTargetInfluences[f]=u;p[v]=1;u=
-1;f++}}h.program.uniforms.morphTargetInfluences!==null&&o.uniform1fv(h.program.uniforms.morphTargetInfluences,m.__webglMorphTargetInfluences)}if(k.__webglCustomAttributes)for(n in k.__webglCustomAttributes)b[n]>=0&&(c=k.__webglCustomAttributes[n],o.bindBuffer(o.ARRAY_BUFFER,c.buffer),o.vertexAttribPointer(b[n],c.size,o.FLOAT,!1,0,0));b.color>=0&&(o.bindBuffer(o.ARRAY_BUFFER,k.__webglColorBuffer),o.vertexAttribPointer(b.color,3,o.FLOAT,!1,0,0));b.normal>=0&&(o.bindBuffer(o.ARRAY_BUFFER,k.__webglNormalBuffer),
o.vertexAttribPointer(b.normal,3,o.FLOAT,!1,0,0));b.tangent>=0&&(o.bindBuffer(o.ARRAY_BUFFER,k.__webglTangentBuffer),o.vertexAttribPointer(b.tangent,4,o.FLOAT,!1,0,0));b.uv>=0&&(k.__webglUVBuffer?(o.bindBuffer(o.ARRAY_BUFFER,k.__webglUVBuffer),o.vertexAttribPointer(b.uv,2,o.FLOAT,!1,0,0),o.enableVertexAttribArray(b.uv)):o.disableVertexAttribArray(b.uv));b.uv2>=0&&(k.__webglUV2Buffer?(o.bindBuffer(o.ARRAY_BUFFER,k.__webglUV2Buffer),o.vertexAttribPointer(b.uv2,2,o.FLOAT,!1,0,0),o.enableVertexAttribArray(b.uv2)):
o.disableVertexAttribArray(b.uv2));h.skinning&&b.skinVertexA>=0&&b.skinVertexB>=0&&b.skinIndex>=0&&b.skinWeight>=0&&(o.bindBuffer(o.ARRAY_BUFFER,k.__webglSkinVertexABuffer),o.vertexAttribPointer(b.skinVertexA,4,o.FLOAT,!1,0,0),o.bindBuffer(o.ARRAY_BUFFER,k.__webglSkinVertexBBuffer),o.vertexAttribPointer(b.skinVertexB,4,o.FLOAT,!1,0,0),o.bindBuffer(o.ARRAY_BUFFER,k.__webglSkinIndicesBuffer),o.vertexAttribPointer(b.skinIndex,4,o.FLOAT,!1,0,0),o.bindBuffer(o.ARRAY_BUFFER,k.__webglSkinWeightsBuffer),
o.vertexAttribPointer(b.skinWeight,4,o.FLOAT,!1,0,0));m instanceof THREE.Mesh?(h.wireframe?(o.lineWidth(h.wireframeLinewidth),o.bindBuffer(o.ELEMENT_ARRAY_BUFFER,k.__webglLineBuffer),o.drawElements(o.LINES,k.__webglLineCount,o.UNSIGNED_SHORT,0)):(o.bindBuffer(o.ELEMENT_ARRAY_BUFFER,k.__webglFaceBuffer),o.drawElements(o.TRIANGLES,k.__webglFaceCount,o.UNSIGNED_SHORT,0)),P.data.vertices+=k.__webglFaceCount,P.data.faces+=k.__webglFaceCount/3,P.data.drawCalls++):m instanceof THREE.Line?(m=m.type==THREE.LineStrip?
o.LINE_STRIP:o.LINES,o.lineWidth(h.linewidth),o.drawArrays(m,0,k.__webglLineCount),P.data.drawCalls++):m instanceof THREE.ParticleSystem?(o.drawArrays(o.POINTS,0,k.__webglParticleCount),P.data.drawCalls++):m instanceof THREE.Ribbon&&(o.drawArrays(o.TRIANGLE_STRIP,0,k.__webglVertexCount),P.data.drawCalls++)}}function h(b,e,c){if(!b.__webglVertexBuffer)b.__webglVertexBuffer=o.createBuffer();if(!b.__webglNormalBuffer)b.__webglNormalBuffer=o.createBuffer();b.hasPos&&(o.bindBuffer(o.ARRAY_BUFFER,b.__webglVertexBuffer),
o.bufferData(o.ARRAY_BUFFER,b.positionArray,o.DYNAMIC_DRAW),o.enableVertexAttribArray(e.attributes.position),o.vertexAttribPointer(e.attributes.position,3,o.FLOAT,!1,0,0));if(b.hasNormal){o.bindBuffer(o.ARRAY_BUFFER,b.__webglNormalBuffer);if(c==THREE.FlatShading){var f,k,h,m,n,p,t,u,v,w,x=b.count*3;for(w=0;w<x;w+=9)c=b.normalArray,f=c[w],k=c[w+1],h=c[w+2],m=c[w+3],p=c[w+4],u=c[w+5],n=c[w+6],t=c[w+7],v=c[w+8],f=(f+m+n)/3,k=(k+p+t)/3,h=(h+u+v)/3,c[w]=f,c[w+1]=k,c[w+2]=h,c[w+3]=f,c[w+4]=k,c[w+5]=h,c[w+
6]=f,c[w+7]=k,c[w+8]=h}o.bufferData(o.ARRAY_BUFFER,b.normalArray,o.DYNAMIC_DRAW);o.enableVertexAttribArray(e.attributes.normal);o.vertexAttribPointer(e.attributes.normal,3,o.FLOAT,!1,0,0)}o.drawArrays(o.TRIANGLES,0,b.count);b.count=0}function m(b){if(aa!=b.doubleSided)b.doubleSided?o.disable(o.CULL_FACE):o.enable(o.CULL_FACE),aa=b.doubleSided;if(ma!=b.flipSided)b.flipSided?o.frontFace(o.CW):o.frontFace(o.CCW),ma=b.flipSided}function k(b){ga!=b&&(b?o.enable(o.DEPTH_TEST):o.disable(o.DEPTH_TEST),ga=
b)}function n(b,e,c){da!=b&&(b?o.enable(o.POLYGON_OFFSET_FILL):o.disable(o.POLYGON_OFFSET_FILL),da=b);if(b&&($!=e||ca!=c))o.polygonOffset(e,c),$=e,ca=c}function u(b){V[0].set(b.n41-b.n11,b.n42-b.n12,b.n43-b.n13,b.n44-b.n14);V[1].set(b.n41+b.n11,b.n42+b.n12,b.n43+b.n13,b.n44+b.n14);V[2].set(b.n41+b.n21,b.n42+b.n22,b.n43+b.n23,b.n44+b.n24);V[3].set(b.n41-b.n21,b.n42-b.n22,b.n43-b.n23,b.n44-b.n24);V[4].set(b.n41-b.n31,b.n42-b.n32,b.n43-b.n33,b.n44-b.n34);V[5].set(b.n41+b.n31,b.n42+b.n32,b.n43+b.n33,
b.n44+b.n34);for(var e,b=0;b<6;b++)e=V[b],e.divideScalar(Math.sqrt(e.x*e.x+e.y*e.y+e.z*e.z))}function p(b){for(var e=b.matrixWorld,c=-b.geometry.boundingSphere.radius*Math.max(b.scale.x,Math.max(b.scale.y,b.scale.z)),f=0;f<6;f++)if(b=V[f].x*e.n14+V[f].y*e.n24+V[f].z*e.n34+V[f].w,b<=c)return!1;return!0}function v(b,e){b.list[b.count]=e;b.count+=1}function t(b){var e,c,f=b.object,k=b.opaque,h=b.transparent;h.count=0;b=k.count=0;for(e=f.materials.length;b<e;b++)c=f.materials[b],c.transparent?v(h,c):
v(k,c)}function x(b){var e,c,f,k,h=b.object,m=b.buffer,n=b.opaque,o=b.transparent;o.count=0;b=n.count=0;for(f=h.materials.length;b<f;b++)if(e=h.materials[b],e instanceof THREE.MeshFaceMaterial){e=0;for(c=m.materials.length;e<c;e++)(k=m.materials[e])&&(k.transparent?v(o,k):v(n,k))}else(k=e)&&(k.transparent?v(o,k):v(n,k))}function w(b,e){return e.z-b.z}function z(b,c){var n,t,v,w=0,x,z,y,D,G=b.lights;T||(T=new THREE.Camera(P.shadowCameraFov,c.aspect,P.shadowCameraNear,P.shadowCameraFar));n=0;for(t=
G.length;n<t;n++)if(v=G[n],v instanceof THREE.SpotLight&&v.castShadow){P.shadowMap[w]||(P.shadowMap[w]=new THREE.WebGLRenderTarget(P.shadowMapWidth,P.shadowMapHeight,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat}));xa[w]||(xa[w]=new THREE.Matrix4);x=P.shadowMap[w];z=xa[w];T.position.copy(v.position);T.target.position.copy(v.target.position);T.update(void 0,!0);b.update(void 0,!1,T);z.set(0.5,0,0,0.5,0,0.5,0,0.5,0,0,0.5,0.5,0,0,0,1);z.multiplySelf(T.projectionMatrix);
z.multiplySelf(T.matrixWorldInverse);T.matrixWorldInverse.flattenToArray(ra);T.projectionMatrix.flattenToArray(va);pa.multiply(T.projectionMatrix,T.matrixWorldInverse);u(pa);P.initWebGLObjects(b);K(x);o.clearColor(1,1,1,1);P.clear();o.clearColor(M.r,M.g,M.b,Z);z=b.__webglObjects.length;v=b.__webglObjectsImmediate.length;for(x=0;x<z;x++)y=b.__webglObjects[x],D=y.object,D.visible&&D.castShadow?!(D instanceof THREE.Mesh)||!D.frustumCulled||p(D)?(D.matrixWorld.flattenToArray(D._objectMatrixArray),B(D,
T,!1),y.render=!0):y.render=!1:y.render=!1;k(!0);F(THREE.NormalBlending);for(x=0;x<z;x++)if(y=b.__webglObjects[x],y.render)D=y.object,buffer=y.buffer,m(D),y=D.customDepthMaterial?D.customDepthMaterial:D.geometry.morphTargets.length?ya:ka,f(T,G,null,y,buffer,D);for(x=0;x<v;x++)y=b.__webglObjectsImmediate[x],D=y.object,D.visible&&D.castShadow&&(D.matrixAutoUpdate&&D.matrixWorld.flattenToArray(D._objectMatrixArray),B(D,T,!1),m(D),program=e(T,G,null,ka,D),D.render(function(b){h(b,program,ka.shading)}));
w++}}function y(b,e){var c,f,k;c=Y.attributes;var h=Y.uniforms,m=qa/ea,n,p=[],t=ea*0.5,u=qa*0.5,v=!0;o.useProgram(Y.program);na=Y.program;ga=fa=-1;Ga||(o.enableVertexAttribArray(Y.attributes.position),o.enableVertexAttribArray(Y.attributes.uv),Ga=!0);o.disable(o.CULL_FACE);o.enable(o.BLEND);o.depthMask(!0);o.bindBuffer(o.ARRAY_BUFFER,Y.vertexBuffer);o.vertexAttribPointer(c.position,2,o.FLOAT,!1,16,0);o.vertexAttribPointer(c.uv,2,o.FLOAT,!1,16,8);o.bindBuffer(o.ELEMENT_ARRAY_BUFFER,Y.elementBuffer);
o.uniformMatrix4fv(h.projectionMatrix,!1,va);o.activeTexture(o.TEXTURE0);o.uniform1i(h.map,0);c=0;for(f=b.__webglSprites.length;c<f;c++)k=b.__webglSprites[c],k.useScreenCoordinates?k.z=-k.position.z:(k._modelViewMatrix.multiplyToArray(e.matrixWorldInverse,k.matrixWorld,k._modelViewMatrixArray),k.z=-k._modelViewMatrix.n34);b.__webglSprites.sort(w);c=0;for(f=b.__webglSprites.length;c<f;c++)k=b.__webglSprites[c],k.material===void 0&&k.map&&k.map.image&&k.map.image.width&&(k.useScreenCoordinates?(o.uniform1i(h.useScreenCoordinates,
1),o.uniform3f(h.screenPosition,(k.position.x-t)/t,(u-k.position.y)/u,Math.max(0,Math.min(1,k.position.z)))):(o.uniform1i(h.useScreenCoordinates,0),o.uniform1i(h.affectedByDistance,k.affectedByDistance?1:0),o.uniformMatrix4fv(h.modelViewMatrix,!1,k._modelViewMatrixArray)),n=k.map.image.width/(k.scaleByViewport?qa:1),p[0]=n*m*k.scale.x,p[1]=n*k.scale.y,o.uniform2f(h.uvScale,k.uvScale.x,k.uvScale.y),o.uniform2f(h.uvOffset,k.uvOffset.x,k.uvOffset.y),o.uniform2f(h.alignment,k.alignment.x,k.alignment.y),
o.uniform1f(h.opacity,k.opacity),o.uniform1f(h.rotation,k.rotation),o.uniform2fv(h.scale,p),k.mergeWith3D&&!v?(o.enable(o.DEPTH_TEST),v=!0):!k.mergeWith3D&&v&&(o.disable(o.DEPTH_TEST),v=!1),F(k.blending),C(k.map,0),o.drawElements(o.TRIANGLES,6,o.UNSIGNED_SHORT,0));o.enable(o.CULL_FACE);o.enable(o.DEPTH_TEST);o.depthMask(ia)}function B(b,e,c){b._modelViewMatrix.multiplyToArray(e.matrixWorldInverse,b.matrixWorld,b._modelViewMatrixArray);c&&THREE.Matrix4.makeInvert3x3(b._modelViewMatrix).transposeIntoArray(b._normalMatrixArray)}
function D(b){var e,c,f,k;k=b.__materials;b=0;for(c=k.length;b<c;b++)if(f=k[b],f.attributes)for(e in f.attributes)if(f.attributes[e].needsUpdate)return!0;return!1}function G(b){var e,c,f,k;k=b.__materials;b=0;for(c=k.length;b<c;b++)if(f=k[b],f.attributes)for(e in f.attributes)f.attributes[e].needsUpdate=!1}function H(b,e){var c;for(c=b.length-1;c>=0;c--)b[c].object==e&&b.splice(c,1)}function E(b){function e(b){var k=[];c=0;for(f=b.length;c<f;c++)b[c]==void 0?k.push("undefined"):k.push(b[c].id);return k.join("_")}
var c,f,k,h,m,n,o,p,t={},u=b.morphTargets!==void 0?b.morphTargets.length:0;b.geometryGroups={};k=0;for(h=b.faces.length;k<h;k++)m=b.faces[k],n=m.materials,o=e(n),t[o]==void 0&&(t[o]={hash:o,counter:0}),p=t[o].hash+"_"+t[o].counter,b.geometryGroups[p]==void 0&&(b.geometryGroups[p]={faces:[],materials:n,vertices:0,numMorphTargets:u}),m=m instanceof THREE.Face3?3:4,b.geometryGroups[p].vertices+m>65535&&(t[o].counter+=1,p=t[o].hash+"_"+t[o].counter,b.geometryGroups[p]==void 0&&(b.geometryGroups[p]={faces:[],
materials:n,vertices:0,numMorphTargets:u})),b.geometryGroups[p].faces.push(k),b.geometryGroups[p].vertices+=m;b.geometryGroupsList=[];for(var v in b.geometryGroups)b.geometryGroupsList.push(b.geometryGroups[v])}function N(b,e,c){b.push({buffer:e,object:c,opaque:{list:[],count:0},transparent:{list:[],count:0}})}function F(b){if(b!=fa){switch(b){case THREE.AdditiveBlending:o.blendEquation(o.FUNC_ADD);o.blendFunc(o.SRC_ALPHA,o.ONE);break;case THREE.SubtractiveBlending:o.blendEquation(o.FUNC_ADD);o.blendFunc(o.ZERO,
o.ONE_MINUS_SRC_COLOR);break;case THREE.MultiplyBlending:o.blendEquation(o.FUNC_ADD);o.blendFunc(o.ZERO,o.SRC_COLOR);break;default:o.blendEquationSeparate(o.FUNC_ADD,o.FUNC_ADD),o.blendFuncSeparate(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA,o.ONE,o.ONE_MINUS_SRC_ALPHA)}fa=b}}function I(b,e,c){(c.width&c.width-1)==0&&(c.height&c.height-1)==0?(o.texParameteri(b,o.TEXTURE_WRAP_S,S(e.wrapS)),o.texParameteri(b,o.TEXTURE_WRAP_T,S(e.wrapT)),o.texParameteri(b,o.TEXTURE_MAG_FILTER,S(e.magFilter)),o.texParameteri(b,
o.TEXTURE_MIN_FILTER,S(e.minFilter)),o.generateMipmap(b)):(o.texParameteri(b,o.TEXTURE_WRAP_S,o.CLAMP_TO_EDGE),o.texParameteri(b,o.TEXTURE_WRAP_T,o.CLAMP_TO_EDGE),o.texParameteri(b,o.TEXTURE_MAG_FILTER,O(e.magFilter)),o.texParameteri(b,o.TEXTURE_MIN_FILTER,O(e.minFilter)))}function C(b,e){if(b.needsUpdate){if(!b.__webglInit)b.__webglInit=!0,b.__webglTexture=o.createTexture();o.activeTexture(o.TEXTURE0+e);o.bindTexture(o.TEXTURE_2D,b.__webglTexture);b instanceof THREE.DataTexture?o.texImage2D(o.TEXTURE_2D,
0,S(b.format),b.image.width,b.image.height,0,S(b.format),o.UNSIGNED_BYTE,b.image.data):o.texImage2D(o.TEXTURE_2D,0,o.RGBA,o.RGBA,o.UNSIGNED_BYTE,b.image);I(o.TEXTURE_2D,b,b.image);b.needsUpdate=!1}else o.activeTexture(o.TEXTURE0+e),o.bindTexture(o.TEXTURE_2D,b.__webglTexture)}function K(b){var e=b instanceof THREE.WebGLRenderTargetCube;if(b&&!b.__webglFramebuffer){if(b.depthBuffer===void 0)b.depthBuffer=!0;if(b.stencilBuffer===void 0)b.stencilBuffer=!0;b.__webglRenderbuffer=o.createRenderbuffer();
b.__webglTexture=o.createTexture();if(e){o.bindTexture(o.TEXTURE_CUBE_MAP,b.__webglTexture);I(o.TEXTURE_CUBE_MAP,b,b);b.__webglFramebuffer=[];for(var c=0;c<6;c++)b.__webglFramebuffer[c]=o.createFramebuffer(),o.texImage2D(o.TEXTURE_CUBE_MAP_POSITIVE_X+c,0,S(b.format),b.width,b.height,0,S(b.format),S(b.type),null)}else b.__webglFramebuffer=o.createFramebuffer(),o.bindTexture(o.TEXTURE_2D,b.__webglTexture),I(o.TEXTURE_2D,b,b),o.texImage2D(o.TEXTURE_2D,0,S(b.format),b.width,b.height,0,S(b.format),S(b.type),
null);o.bindRenderbuffer(o.RENDERBUFFER,b.__webglRenderbuffer);if(e)for(c=0;c<6;++c)o.bindFramebuffer(o.FRAMEBUFFER,b.__webglFramebuffer[c]),o.framebufferTexture2D(o.FRAMEBUFFER,o.COLOR_ATTACHMENT0,o.TEXTURE_CUBE_MAP_POSITIVE_X+c,b.__webglTexture,0);else o.bindFramebuffer(o.FRAMEBUFFER,b.__webglFramebuffer),o.framebufferTexture2D(o.FRAMEBUFFER,o.COLOR_ATTACHMENT0,o.TEXTURE_2D,b.__webglTexture,0);b.depthBuffer&&!b.stencilBuffer?(o.renderbufferStorage(o.RENDERBUFFER,o.DEPTH_COMPONENT16,b.width,b.height),
o.framebufferRenderbuffer(o.FRAMEBUFFER,o.DEPTH_ATTACHMENT,o.RENDERBUFFER,b.__webglRenderbuffer)):b.depthBuffer&&b.stencilBuffer?(o.renderbufferStorage(o.RENDERBUFFER,o.DEPTH_STENCIL,b.width,b.height),o.framebufferRenderbuffer(o.FRAMEBUFFER,o.DEPTH_STENCIL_ATTACHMENT,o.RENDERBUFFER,b.__webglRenderbuffer)):o.renderbufferStorage(o.RENDERBUFFER,o.RGBA4,b.width,b.height);e?o.bindTexture(o.TEXTURE_CUBE_MAP,null):o.bindTexture(o.TEXTURE_2D,null);o.bindRenderbuffer(o.RENDERBUFFER,null);o.bindFramebuffer(o.FRAMEBUFFER,
null)}var f,k;b?(e=e?b.__webglFramebuffer[b.activeCubeFace]:b.__webglFramebuffer,c=b.width,b=b.height,k=f=0):(e=null,c=ea,b=qa,f=X,k=ja);e!=R&&(o.bindFramebuffer(o.FRAMEBUFFER,e),o.viewport(f,k,c,b),R=e)}function U(b){b instanceof THREE.WebGLRenderTargetCube?(o.bindTexture(o.TEXTURE_CUBE_MAP,b.__webglTexture),o.generateMipmap(o.TEXTURE_CUBE_MAP),o.bindTexture(o.TEXTURE_CUBE_MAP,null)):(o.bindTexture(o.TEXTURE_2D,b.__webglTexture),o.generateMipmap(o.TEXTURE_2D),o.bindTexture(o.TEXTURE_2D,null))}function L(b,
e){var c;b=="fragment"?c=o.createShader(o.FRAGMENT_SHADER):b=="vertex"&&(c=o.createShader(o.VERTEX_SHADER));o.shaderSource(c,e);o.compileShader(c);if(!o.getShaderParameter(c,o.COMPILE_STATUS))return console.error(o.getShaderInfoLog(c)),console.error(e),null;return c}function O(b){switch(b){case THREE.NearestFilter:case THREE.NearestMipMapNearestFilter:case THREE.NearestMipMapLinearFilter:return o.NEAREST;default:return o.LINEAR}}function S(b){switch(b){case THREE.RepeatWrapping:return o.REPEAT;case THREE.ClampToEdgeWrapping:return o.CLAMP_TO_EDGE;
case THREE.MirroredRepeatWrapping:return o.MIRRORED_REPEAT;case THREE.NearestFilter:return o.NEAREST;case THREE.NearestMipMapNearestFilter:return o.NEAREST_MIPMAP_NEAREST;case THREE.NearestMipMapLinearFilter:return o.NEAREST_MIPMAP_LINEAR;case THREE.LinearFilter:return o.LINEAR;case THREE.LinearMipMapNearestFilter:return o.LINEAR_MIPMAP_NEAREST;case THREE.LinearMipMapLinearFilter:return o.LINEAR_MIPMAP_LINEAR;case THREE.ByteType:return o.BYTE;case THREE.UnsignedByteType:return o.UNSIGNED_BYTE;case THREE.ShortType:return o.SHORT;
case THREE.UnsignedShortType:return o.UNSIGNED_SHORT;case THREE.IntType:return o.INT;case THREE.UnsignedShortType:return o.UNSIGNED_INT;case THREE.FloatType:return o.FLOAT;case THREE.AlphaFormat:return o.ALPHA;case THREE.RGBFormat:return o.RGB;case THREE.RGBAFormat:return o.RGBA;case THREE.LuminanceFormat:return o.LUMINANCE;case THREE.LuminanceAlphaFormat:return o.LUMINANCE_ALPHA}return 0}var P=this,o,W=[],na=null,R=null,ia=!0,aa=null,ma=null,fa=null,ga=null,da=null,$=null,ca=null,X=0,ja=0,ea=0,qa=
0,V=[new THREE.Vector4,new THREE.Vector4,new THREE.Vector4,new THREE.Vector4,new THREE.Vector4,new THREE.Vector4],pa=new THREE.Matrix4,va=new Float32Array(16),ra=new Float32Array(16),sa=new THREE.Vector4,Ca={ambient:[0,0,0],directional:{length:0,colors:[],positions:[]},point:{length:0,colors:[],positions:[],distances:[]}},b=b||{},wa=b.canvas!==void 0?b.canvas:document.createElement("canvas"),Aa=b.stencil!==void 0?b.stencil:!0,za=b.preserveDrawingBuffer!==void 0?b.preserveDrawingBuffer:!1,Fa=b.antialias!==
void 0?b.antialias:!1,M=b.clearColor!==void 0?new THREE.Color(b.clearColor):new THREE.Color(0),Z=b.clearAlpha!==void 0?b.clearAlpha:0;_maxLights=b.maxLights!==void 0?b.maxLights:4;this.data={vertices:0,faces:0,drawCalls:0};this.maxMorphTargets=8;this.domElement=wa;this.sortObjects=this.autoClear=!0;this.shadowMapBias=0.0039;this.shadowMapDarkness=0.5;this.shadowMapHeight=this.shadowMapWidth=512;this.shadowCameraNear=1;this.shadowCameraFar=5E3;this.shadowCameraFov=50;this.shadowMap=[];this.shadowMapEnabled=
!1;this.shadowMapSoft=!0;var T,xa=[],b=THREE.ShaderLib.depthRGBA,ha=THREE.UniformsUtils.clone(b.uniforms),ka=new THREE.MeshShaderMaterial({fragmentShader:b.fragmentShader,vertexShader:b.vertexShader,uniforms:ha}),ya=new THREE.MeshShaderMaterial({fragmentShader:b.fragmentShader,vertexShader:b.vertexShader,uniforms:ha,morphTargets:!0});ka._shadowPass=!0;ya._shadowPass=!0;try{if(!(o=wa.getContext("experimental-webgl",{antialias:Fa,stencil:Aa,preserveDrawingBuffer:za})))throw"Error creating WebGL context.";
console.log(navigator.userAgent+" | "+o.getParameter(o.VERSION)+" | "+o.getParameter(o.VENDOR)+" | "+o.getParameter(o.RENDERER)+" | "+o.getParameter(o.SHADING_LANGUAGE_VERSION))}catch(ta){console.error(ta)}o.clearColor(0,0,0,1);o.clearDepth(1);o.clearStencil(0);o.enable(o.DEPTH_TEST);o.depthFunc(o.LEQUAL);o.frontFace(o.CCW);o.cullFace(o.BACK);o.enable(o.CULL_FACE);o.enable(o.BLEND);o.blendEquation(o.FUNC_ADD);o.blendFunc(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA);o.clearColor(M.r,M.g,M.b,Z);this.context=
o;var oa=o.getParameter(o.MAX_VERTEX_TEXTURE_IMAGE_UNITS)>0,Y={};Y.vertices=new Float32Array(16);Y.faces=new Uint16Array(6);i=0;Y.vertices[i++]=-1;Y.vertices[i++]=-1;Y.vertices[i++]=0;Y.vertices[i++]=1;Y.vertices[i++]=1;Y.vertices[i++]=-1;Y.vertices[i++]=1;Y.vertices[i++]=1;Y.vertices[i++]=1;Y.vertices[i++]=1;Y.vertices[i++]=1;Y.vertices[i++]=0;Y.vertices[i++]=-1;Y.vertices[i++]=1;Y.vertices[i++]=0;i=Y.vertices[i++]=0;Y.faces[i++]=0;Y.faces[i++]=1;Y.faces[i++]=2;Y.faces[i++]=0;Y.faces[i++]=2;Y.faces[i++]=
3;Y.vertexBuffer=o.createBuffer();Y.elementBuffer=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,Y.vertexBuffer);o.bufferData(o.ARRAY_BUFFER,Y.vertices,o.STATIC_DRAW);o.bindBuffer(o.ELEMENT_ARRAY_BUFFER,Y.elementBuffer);o.bufferData(o.ELEMENT_ARRAY_BUFFER,Y.faces,o.STATIC_DRAW);Y.program=o.createProgram();o.attachShader(Y.program,L("fragment",THREE.ShaderLib.sprite.fragmentShader));o.attachShader(Y.program,L("vertex",THREE.ShaderLib.sprite.vertexShader));o.linkProgram(Y.program);Y.attributes={};Y.uniforms=
{};Y.attributes.position=o.getAttribLocation(Y.program,"position");Y.attributes.uv=o.getAttribLocation(Y.program,"uv");Y.uniforms.uvOffset=o.getUniformLocation(Y.program,"uvOffset");Y.uniforms.uvScale=o.getUniformLocation(Y.program,"uvScale");Y.uniforms.rotation=o.getUniformLocation(Y.program,"rotation");Y.uniforms.scale=o.getUniformLocation(Y.program,"scale");Y.uniforms.alignment=o.getUniformLocation(Y.program,"alignment");Y.uniforms.map=o.getUniformLocation(Y.program,"map");Y.uniforms.opacity=o.getUniformLocation(Y.program,
"opacity");Y.uniforms.useScreenCoordinates=o.getUniformLocation(Y.program,"useScreenCoordinates");Y.uniforms.affectedByDistance=o.getUniformLocation(Y.program,"affectedByDistance");Y.uniforms.screenPosition=o.getUniformLocation(Y.program,"screenPosition");Y.uniforms.modelViewMatrix=o.getUniformLocation(Y.program,"modelViewMatrix");Y.uniforms.projectionMatrix=o.getUniformLocation(Y.program,"projectionMatrix");var Ga=!1;this.setSize=function(b,e){wa.width=b;wa.height=e;this.setViewport(0,0,wa.width,
wa.height)};this.setViewport=function(b,e,c,f){X=b;ja=e;ea=c;qa=f;o.viewport(X,ja,ea,qa)};this.setScissor=function(b,e,c,f){o.scissor(b,e,c,f)};this.enableScissorTest=function(b){b?o.enable(o.SCISSOR_TEST):o.disable(o.SCISSOR_TEST)};this.enableDepthBufferWrite=function(b){ia=b;o.depthMask(b)};this.setClearColorHex=function(b,e){M.setHex(b);Z=e;o.clearColor(M.r,M.g,M.b,Z)};this.setClearColor=function(b,e){M.copy(b);Z=e;o.clearColor(M.r,M.g,M.b,Z)};this.clear=function(){o.clear(o.COLOR_BUFFER_BIT|o.DEPTH_BUFFER_BIT|
o.STENCIL_BUFFER_BIT)};this.getContext=function(){return o};this.deallocateObject=function(b){if(b.__webglInit)if(b.__webglInit=!1,delete b._modelViewMatrix,delete b._normalMatrixArray,delete b._modelViewMatrixArray,delete b._objectMatrixArray,b instanceof THREE.Mesh)for(g in b.geometry.geometryGroups){var e=b.geometry.geometryGroups[g];o.deleteBuffer(e.__webglVertexBuffer);o.deleteBuffer(e.__webglNormalBuffer);o.deleteBuffer(e.__webglTangentBuffer);o.deleteBuffer(e.__webglColorBuffer);o.deleteBuffer(e.__webglUVBuffer);
o.deleteBuffer(e.__webglUV2Buffer);o.deleteBuffer(e.__webglSkinVertexABuffer);o.deleteBuffer(e.__webglSkinVertexBBuffer);o.deleteBuffer(e.__webglSkinIndicesBuffer);o.deleteBuffer(e.__webglSkinWeightsBuffer);o.deleteBuffer(e.__webglFaceBuffer);o.deleteBuffer(e.__webglLineBuffer);if(e.numMorphTargets)for(var c=0,f=e.numMorphTargets;c<f;c++)o.deleteBuffer(e.__webglMorphTargetsBuffers[c])}else if(b instanceof THREE.Ribbon)b=b.geometry,o.deleteBuffer(b.__webglVertexBuffer),o.deleteBuffer(b.__webglColorBuffer);
else if(b instanceof THREE.Line)b=b.geometry,o.deleteBuffer(b.__webglVertexBuffer),o.deleteBuffer(b.__webglColorBuffer);else if(b instanceof THREE.ParticleSystem)b=b.geometry,o.deleteBuffer(b.__webglVertexBuffer),o.deleteBuffer(b.__webglColorBuffer)};this.deallocateTexture=function(b){if(b.__webglInit)b.__webglInit=!1,o.deleteTexture(b.__webglTexture)};this.initMaterial=function(b,e,c,f){var k,h,m;b instanceof THREE.MeshDepthMaterial?m="depth":b instanceof THREE.MeshNormalMaterial?m="normal":b instanceof
THREE.MeshBasicMaterial?m="basic":b instanceof THREE.MeshLambertMaterial?m="lambert":b instanceof THREE.MeshPhongMaterial?m="phong":b instanceof THREE.LineBasicMaterial?m="basic":b instanceof THREE.ParticleBasicMaterial&&(m="particle_basic");if(m){var n=THREE.ShaderLib[m];b.uniforms=THREE.UniformsUtils.clone(n.uniforms);b.vertexShader=n.vertexShader;b.fragmentShader=n.fragmentShader}var p,t,u;p=u=n=0;for(t=e.length;p<t;p++)h=e[p],h instanceof THREE.SpotLight&&u++,h instanceof THREE.DirectionalLight&&
u++,h instanceof THREE.PointLight&&n++;n+u<=_maxLights?p=u:(p=Math.ceil(_maxLights*u/(n+u)),n=_maxLights-p);h={directional:p,point:n};n=u=0;for(p=e.length;n<p;n++)t=e[n],t instanceof THREE.SpotLight&&t.castShadow&&u++;var v=50;if(f!==void 0&&f instanceof THREE.SkinnedMesh)v=f.bones.length;var w;a:{p=b.fragmentShader;t=b.vertexShader;var n=b.uniforms,e=b.attributes,c={map:!!b.map,envMap:!!b.envMap,lightMap:!!b.lightMap,vertexColors:b.vertexColors,fog:c,sizeAttenuation:b.sizeAttenuation,skinning:b.skinning,
morphTargets:b.morphTargets,maxMorphTargets:this.maxMorphTargets,maxDirLights:h.directional,maxPointLights:h.point,maxBones:v,shadowMapEnabled:this.shadowMapEnabled&&f.receiveShadow,shadowMapSoft:this.shadowMapSoft,shadowMapWidth:this.shadowMapWidth,shadowMapHeight:this.shadowMapHeight,maxShadows:u,alphaTest:b.alphaTest},x,f=[];m?f.push(m):(f.push(p),f.push(t));for(x in c)f.push(x),f.push(c[x]);m=f.join();x=0;for(f=W.length;x<f;x++)if(W[x].code==m){w=W[x].program;break a}x=o.createProgram();f=[oa?
"#define VERTEX_TEXTURES":"","#define MAX_DIR_LIGHTS "+c.maxDirLights,"#define MAX_POINT_LIGHTS "+c.maxPointLights,"#define MAX_SHADOWS "+c.maxShadows,"#define MAX_BONES "+c.maxBones,c.map?"#define USE_MAP":"",c.envMap?"#define USE_ENVMAP":"",c.lightMap?"#define USE_LIGHTMAP":"",c.vertexColors?"#define USE_COLOR":"",c.skinning?"#define USE_SKINNING":"",c.morphTargets?"#define USE_MORPHTARGETS":"",c.shadowMapEnabled?"#define USE_SHADOWMAP":"",c.shadowMapSoft?"#define SHADOWMAP_SOFT":"",c.sizeAttenuation?
"#define USE_SIZEATTENUATION":"","uniform mat4 objectMatrix;\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\nuniform mat4 viewMatrix;\nuniform mat3 normalMatrix;\nuniform vec3 cameraPosition;\nuniform mat4 cameraInverseMatrix;\nattribute vec3 position;\nattribute vec3 normal;\nattribute vec2 uv;\nattribute vec2 uv2;\n#ifdef USE_COLOR\nattribute vec3 color;\n#endif\n#ifdef USE_MORPHTARGETS\nattribute vec3 morphTarget0;\nattribute vec3 morphTarget1;\nattribute vec3 morphTarget2;\nattribute vec3 morphTarget3;\nattribute vec3 morphTarget4;\nattribute vec3 morphTarget5;\nattribute vec3 morphTarget6;\nattribute vec3 morphTarget7;\n#endif\n#ifdef USE_SKINNING\nattribute vec4 skinVertexA;\nattribute vec4 skinVertexB;\nattribute vec4 skinIndex;\nattribute vec4 skinWeight;\n#endif\n"].join("\n");
h=["#ifdef GL_ES\nprecision highp float;\n#endif","#define MAX_DIR_LIGHTS "+c.maxDirLights,"#define MAX_POINT_LIGHTS "+c.maxPointLights,"#define MAX_SHADOWS "+c.maxShadows,c.alphaTest?"#define ALPHATEST "+c.alphaTest:"",c.fog?"#define USE_FOG":"",c.fog instanceof THREE.FogExp2?"#define FOG_EXP2":"",c.map?"#define USE_MAP":"",c.envMap?"#define USE_ENVMAP":"",c.lightMap?"#define USE_LIGHTMAP":"",c.vertexColors?"#define USE_COLOR":"",c.shadowMapEnabled?"#define USE_SHADOWMAP":"",c.shadowMapSoft?"#define SHADOWMAP_SOFT":
"",c.shadowMapSoft?"#define SHADOWMAP_WIDTH "+c.shadowMapWidth.toFixed(1):"",c.shadowMapSoft?"#define SHADOWMAP_HEIGHT "+c.shadowMapHeight.toFixed(1):"","uniform mat4 viewMatrix;\nuniform vec3 cameraPosition;\n"].join("\n");o.attachShader(x,L("fragment",h+p));o.attachShader(x,L("vertex",f+t));o.linkProgram(x);o.getProgramParameter(x,o.LINK_STATUS)||console.error("Could not initialise shader\nVALIDATE_STATUS: "+o.getProgramParameter(x,o.VALIDATE_STATUS)+", gl error ["+o.getError()+"]");x.uniforms=
{};x.attributes={};var M,f=["viewMatrix","modelViewMatrix","projectionMatrix","normalMatrix","objectMatrix","cameraPosition","cameraInverseMatrix","boneGlobalMatrices","morphTargetInfluences"];for(M in n)f.push(M);M=f;f=0;for(n=M.length;f<n;f++)p=M[f],x.uniforms[p]=o.getUniformLocation(x,p);f=["position","normal","uv","uv2","tangent","color","skinVertexA","skinVertexB","skinIndex","skinWeight"];for(M=0;M<c.maxMorphTargets;M++)f.push("morphTarget"+M);for(w in e)f.push(w);w=f;M=0;for(e=w.length;M<e;M++)c=
w[M],x.attributes[c]=o.getAttribLocation(x,c);W.push({program:x,code:m});w=x}b.program=w;w=b.program.attributes;w.position>=0&&o.enableVertexAttribArray(w.position);w.color>=0&&o.enableVertexAttribArray(w.color);w.normal>=0&&o.enableVertexAttribArray(w.normal);w.tangent>=0&&o.enableVertexAttribArray(w.tangent);b.skinning&&w.skinVertexA>=0&&w.skinVertexB>=0&&w.skinIndex>=0&&w.skinWeight>=0&&(o.enableVertexAttribArray(w.skinVertexA),o.enableVertexAttribArray(w.skinVertexB),o.enableVertexAttribArray(w.skinIndex),
o.enableVertexAttribArray(w.skinWeight));if(b.attributes)for(k in b.attributes)w[k]!==void 0&&w[k]>=0&&o.enableVertexAttribArray(w[k]);if(b.morphTargets)for(k=b.numSupportedMorphTargets=0;k<this.maxMorphTargets;k++)M="morphTarget"+k,w[M]>=0&&(o.enableVertexAttribArray(w[M]),b.numSupportedMorphTargets++)};this.clearTarget=function(b,c,e,f){K(b);b=0;c&&(b|=o.COLOR_BUFFER_BIT);e&&(b|=o.DEPTH_BUFFER_BIT);f&&(b|=o.STENCIL_BUFFER_BIT);o.clear(b)};this.render=function(b,c,o,v){var M,T,D,Z,G,H,E,V,ka=b.lights,
C=b.fog;this.shadowMapEnabled&&z(b,c);P.data.vertices=0;P.data.faces=0;P.data.drawCalls=0;c.matrixAutoUpdate&&c.update(void 0,!0);b.update(void 0,!1,c);c.matrixWorldInverse.flattenToArray(ra);c.projectionMatrix.flattenToArray(va);pa.multiply(c.projectionMatrix,c.matrixWorldInverse);u(pa);this.initWebGLObjects(b);K(o);(this.autoClear||v)&&this.clear();G=b.__webglObjects.length;for(v=0;v<G;v++)if(M=b.__webglObjects[v],E=M.object,E.visible)if(!(E instanceof THREE.Mesh)||!E.frustumCulled||p(E)){if(E.matrixWorld.flattenToArray(E._objectMatrixArray),
B(E,c,!0),x(M),M.render=!0,this.sortObjects)M.object.renderDepth?M.z=M.object.renderDepth:(sa.copy(E.position),pa.multiplyVector3(sa),M.z=sa.z)}else M.render=!1;else M.render=!1;this.sortObjects&&b.__webglObjects.sort(w);H=b.__webglObjectsImmediate.length;for(v=0;v<H;v++)M=b.__webglObjectsImmediate[v],E=M.object,E.visible&&(E.matrixAutoUpdate&&E.matrixWorld.flattenToArray(E._objectMatrixArray),B(E,c,!0),t(M));if(b.overrideMaterial){k(b.overrideMaterial.depthTest);F(b.overrideMaterial.blending);for(v=
0;v<G;v++)if(M=b.__webglObjects[v],M.render)E=M.object,V=M.buffer,m(E),f(c,ka,C,b.overrideMaterial,V,E);for(v=0;v<H;v++)M=b.__webglObjectsImmediate[v],E=M.object,E.visible&&(m(E),T=e(c,ka,C,b.overrideMaterial,E),E.render(function(c){h(c,T,b.overrideMaterial.shading)}))}else{F(THREE.NormalBlending);for(v=G-1;v>=0;v--)if(M=b.__webglObjects[v],M.render){E=M.object;V=M.buffer;D=M.opaque;m(E);for(M=0;M<D.count;M++)Z=D.list[M],k(Z.depthTest),n(Z.polygonOffset,Z.polygonOffsetFactor,Z.polygonOffsetUnits),
f(c,ka,C,Z,V,E)}for(v=0;v<H;v++)if(M=b.__webglObjectsImmediate[v],E=M.object,E.visible){D=M.opaque;m(E);for(M=0;M<D.count;M++)Z=D.list[M],k(Z.depthTest),n(Z.polygonOffset,Z.polygonOffsetFactor,Z.polygonOffsetUnits),T=e(c,ka,C,Z,E),E.render(function(b){h(b,T,Z.shading)})}for(v=0;v<G;v++)if(M=b.__webglObjects[v],M.render){E=M.object;V=M.buffer;D=M.transparent;m(E);for(M=0;M<D.count;M++)Z=D.list[M],F(Z.blending),k(Z.depthTest),n(Z.polygonOffset,Z.polygonOffsetFactor,Z.polygonOffsetUnits),f(c,ka,C,Z,
V,E)}for(v=0;v<H;v++)if(M=b.__webglObjectsImmediate[v],E=M.object,E.visible){D=M.transparent;m(E);for(M=0;M<D.count;M++)Z=D.list[M],F(Z.blending),k(Z.depthTest),n(Z.polygonOffset,Z.polygonOffsetFactor,Z.polygonOffsetUnits),T=e(c,ka,C,Z,E),E.render(function(b){h(b,T,Z.shading)})}}b.__webglSprites.length&&y(b,c);o&&o.minFilter!==THREE.NearestFilter&&o.minFilter!==THREE.LinearFilter&&U(o)};this.initWebGLObjects=function(b){if(!b.__webglObjects)b.__webglObjects=[],b.__webglObjectsImmediate=[],b.__webglSprites=
[];for(;b.__objectsAdded.length;){var e=b.__objectsAdded[0],f=b,k=void 0,h=void 0,m=void 0;if(!e.__webglInit)if(e.__webglInit=!0,e._modelViewMatrix=new THREE.Matrix4,e._normalMatrixArray=new Float32Array(9),e._modelViewMatrixArray=new Float32Array(16),e._objectMatrixArray=new Float32Array(16),e.matrixWorld.flattenToArray(e._objectMatrixArray),e instanceof THREE.Mesh)for(k in h=e.geometry,h.geometryGroups==void 0&&E(h),h.geometryGroups){m=h.geometryGroups[k];if(!m.__webglVertexBuffer){var n=m;n.__webglVertexBuffer=
o.createBuffer();n.__webglNormalBuffer=o.createBuffer();n.__webglTangentBuffer=o.createBuffer();n.__webglColorBuffer=o.createBuffer();n.__webglUVBuffer=o.createBuffer();n.__webglUV2Buffer=o.createBuffer();n.__webglSkinVertexABuffer=o.createBuffer();n.__webglSkinVertexBBuffer=o.createBuffer();n.__webglSkinIndicesBuffer=o.createBuffer();n.__webglSkinWeightsBuffer=o.createBuffer();n.__webglFaceBuffer=o.createBuffer();n.__webglLineBuffer=o.createBuffer();if(n.numMorphTargets){var p=void 0,t=void 0;n.__webglMorphTargetsBuffers=
[];p=0;for(t=n.numMorphTargets;p<t;p++)n.__webglMorphTargetsBuffers.push(o.createBuffer())}for(var n=m,p=e,v=void 0,u=void 0,w=void 0,x=w=void 0,M=void 0,T=void 0,z=T=t=0,y=w=u=void 0,Z=y=u=v=void 0,w=void 0,x=p.geometry,M=x.faces,y=n.faces,v=0,u=y.length;v<u;v++)w=y[v],w=M[w],w instanceof THREE.Face3?(t+=3,T+=1,z+=3):w instanceof THREE.Face4&&(t+=4,T+=2,z+=4);for(var v=n,u=p,B=y=M=void 0,V=void 0,B=void 0,w=[],M=0,y=u.materials.length;M<y;M++)if(B=u.materials[M],B instanceof THREE.MeshFaceMaterial){B=
0;for(l=v.materials.length;B<l;B++)(V=v.materials[B])&&w.push(V)}else(V=B)&&w.push(V);v=w;n.__materials=v;a:{M=u=void 0;y=v.length;for(u=0;u<y;u++)if(M=v[u],M.map||M.lightMap||M instanceof THREE.MeshShaderMaterial){u=!0;break a}u=!1}a:{y=M=void 0;w=v.length;for(M=0;M<w;M++)if(y=v[M],!(y instanceof THREE.MeshBasicMaterial&&!y.envMap||y instanceof THREE.MeshDepthMaterial)){y=y&&y.shading!=void 0&&y.shading==THREE.SmoothShading?THREE.SmoothShading:THREE.FlatShading;break a}y=!1}a:{w=M=void 0;B=v.length;
for(M=0;M<B;M++)if(w=v[M],w.vertexColors){w=w.vertexColors;break a}w=!1}n.__vertexArray=new Float32Array(t*3);if(y)n.__normalArray=new Float32Array(t*3);if(x.hasTangents)n.__tangentArray=new Float32Array(t*4);if(w)n.__colorArray=new Float32Array(t*3);if(u){if(x.faceUvs.length>0||x.faceVertexUvs.length>0)n.__uvArray=new Float32Array(t*2);if(x.faceUvs.length>1||x.faceVertexUvs.length>1)n.__uv2Array=new Float32Array(t*2)}if(p.geometry.skinWeights.length&&p.geometry.skinIndices.length)n.__skinVertexAArray=
new Float32Array(t*4),n.__skinVertexBArray=new Float32Array(t*4),n.__skinIndexArray=new Float32Array(t*4),n.__skinWeightArray=new Float32Array(t*4);n.__faceArray=new Uint16Array(T*3+(p.geometry.edgeFaces?p.geometry.edgeFaces.length*6:0));n.__lineArray=new Uint16Array(z*2);if(n.numMorphTargets){n.__morphTargetsArrays=[];x=0;for(M=n.numMorphTargets;x<M;x++)n.__morphTargetsArrays.push(new Float32Array(t*3))}n.__needsSmoothNormals=y==THREE.SmoothShading;n.__uvType=u;n.__vertexColorType=w;n.__normalType=
y;n.__webglFaceCount=T*3+(p.geometry.edgeFaces?p.geometry.edgeFaces.length*6:0);n.__webglLineCount=z*2;x=0;for(M=v.length;x<M;x++)if(u=v[x],u.attributes){if(n.__webglCustomAttributes===void 0)n.__webglCustomAttributes={};for(a in u.attributes){w=u.attributes[a];y={};for(Z in w)y[Z]=w[Z];if(!y.__webglInitialized||y.createUniqueBuffers)y.__webglInitialized=!0,T=1,y.type==="v2"?T=2:y.type==="v3"?T=3:y.type==="v4"?T=4:y.type==="c"&&(T=3),y.size=T,y.array=new Float32Array(t*T),y.buffer=o.createBuffer(),
y.buffer.belongsToAttribute=a,w.needsUpdate=!0,y.__original=w;n.__webglCustomAttributes[a]=y}}n.__inittedArrays=!0;h.__dirtyVertices=!0;h.__dirtyMorphTargets=!0;h.__dirtyElements=!0;h.__dirtyUvs=!0;h.__dirtyNormals=!0;h.__dirtyTangents=!0;h.__dirtyColors=!0}N(f.__webglObjects,m,e)}else if(e instanceof THREE.Ribbon){h=e.geometry;if(!h.__webglVertexBuffer)k=h,k.__webglVertexBuffer=o.createBuffer(),k.__webglColorBuffer=o.createBuffer(),k=h,m=k.vertices.length,k.__vertexArray=new Float32Array(m*3),k.__colorArray=
new Float32Array(m*3),k.__webglVertexCount=m,h.__dirtyVertices=!0,h.__dirtyColors=!0;N(f.__webglObjects,h,e)}else if(e instanceof THREE.Line){h=e.geometry;if(!h.__webglVertexBuffer)k=h,k.__webglVertexBuffer=o.createBuffer(),k.__webglColorBuffer=o.createBuffer(),k=h,m=k.vertices.length,k.__vertexArray=new Float32Array(m*3),k.__colorArray=new Float32Array(m*3),k.__webglLineCount=m,h.__dirtyVertices=!0,h.__dirtyColors=!0;N(f.__webglObjects,h,e)}else if(e instanceof THREE.ParticleSystem){h=e.geometry;
if(!h.__webglVertexBuffer){k=h;k.__webglVertexBuffer=o.createBuffer();k.__webglColorBuffer=o.createBuffer();k=h;m=e;n=k.vertices.length;k.__vertexArray=new Float32Array(n*3);k.__colorArray=new Float32Array(n*3);k.__sortArray=[];k.__webglParticleCount=n;k.__materials=m.materials;Z=t=p=void 0;p=0;for(t=m.materials.length;p<t;p++)if(Z=m.materials[p],Z.attributes){if(k.__webglCustomAttributes===void 0)k.__webglCustomAttributes={};for(a in Z.attributes){originalAttribute=Z.attributes[a];attribute={};for(property in originalAttribute)attribute[property]=
originalAttribute[property];if(!attribute.__webglInitialized||attribute.createUniqueBuffers)attribute.__webglInitialized=!0,size=1,attribute.type==="v2"?size=2:attribute.type==="v3"?size=3:attribute.type==="v4"?size=4:attribute.type==="c"&&(size=3),attribute.size=size,attribute.array=new Float32Array(n*size),attribute.buffer=o.createBuffer(),attribute.buffer.belongsToAttribute=a,originalAttribute.needsUpdate=!0,attribute.__original=originalAttribute;k.__webglCustomAttributes[a]=attribute}}h.__dirtyVertices=
!0;h.__dirtyColors=!0}N(f.__webglObjects,h,e)}else THREE.MarchingCubes!==void 0&&e instanceof THREE.MarchingCubes?f.__webglObjectsImmediate.push({object:e,opaque:{list:[],count:0},transparent:{list:[],count:0}}):e instanceof THREE.Sprite&&f.__webglSprites.push(e);b.__objectsAdded.splice(0,1)}for(;b.__objectsRemoved.length;){f=b.__objectsRemoved[0];e=b;if(f instanceof THREE.Mesh||f instanceof THREE.ParticleSystem||f instanceof THREE.Ribbon||f instanceof THREE.Line)H(e.__webglObjects,f);else if(f instanceof
THREE.Sprite){e=e.__webglSprites;h=void 0;for(h=e.length-1;h>=0;h--)e[h]==f&&e.splice(h,1)}else f instanceof THREE.MarchingCubes&&H(e.__webglObjectsImmediate,f);b.__objectsRemoved.splice(0,1)}e=0;for(f=b.__webglObjects.length;e<f;e++)if(k=b.__webglObjects[e].object,t=m=h=void 0,k instanceof THREE.Mesh){h=k.geometry;n=0;for(p=h.geometryGroupsList.length;n<p;n++)if(m=h.geometryGroupsList[n],t=D(m),h.__dirtyVertices||h.__dirtyMorphTargets||h.__dirtyElements||h.__dirtyUvs||h.__dirtyNormals||h.__dirtyColors||
h.__dirtyTangents||t)if(t=m,Z=o.DYNAMIC_DRAW,T=!h.dynamic,t.__inittedArrays){var ka=x=z=void 0,C=void 0,xa=ka=void 0,K=void 0,pa=void 0,ha=void 0,I=V=B=w=y=M=u=v=void 0,L=void 0,J=C=ha=C=pa=K=void 0,A=void 0,F=A=J=K=void 0,Y=void 0,va=F=A=J=ka=ka=xa=ha=C=F=A=J=Y=F=A=J=Y=F=A=J=void 0,O=0,X=0,S=0,ra=0,R=0,ca=0,P=0,ya=0,oa=0,Q=0,U=0,F=J=0,F=void 0,W=t.__vertexArray,ja=t.__uvArray,fa=t.__uv2Array,ma=t.__normalArray,$=t.__tangentArray,sa=t.__colorArray,aa=t.__skinVertexAArray,ea=t.__skinVertexBArray,ta=
t.__skinIndexArray,da=t.__skinWeightArray,na=t.__morphTargetsArrays,ga=t.__webglCustomAttributes,A=void 0,qa=t.__faceArray,ia=t.__lineArray,Ga=t.__needsSmoothNormals,u=t.__vertexColorType,v=t.__uvType,M=t.__normalType,wa=k.geometry,Ca=wa.__dirtyVertices,Aa=wa.__dirtyElements,za=wa.__dirtyUvs,Fa=wa.__dirtyNormals,Za=wa.__dirtyTangents,$a=wa.__dirtyColors,ab=wa.__dirtyMorphTargets,Oa=wa.vertices,cb=t.faces,fb=wa.faces,db=wa.faceVertexUvs[0],eb=wa.faceVertexUvs[1],Pa=wa.skinVerticesA,Qa=wa.skinVerticesB,
Ra=wa.skinIndices,Ia=wa.skinWeights,Ha=wa.morphTargets;if(ga)for(va in ga)ga[va].offset=0,ga[va].offsetSrc=0;z=0;for(x=cb.length;z<x;z++)if(ka=cb[z],C=fb[ka],db&&(y=db[ka]),eb&&(w=eb[ka]),ka=C.vertexNormals,xa=C.normal,K=C.vertexColors,pa=C.color,ha=C.vertexTangents,C instanceof THREE.Face3){if(Ca)B=Oa[C.a].position,V=Oa[C.b].position,I=Oa[C.c].position,W[X]=B.x,W[X+1]=B.y,W[X+2]=B.z,W[X+3]=V.x,W[X+4]=V.y,W[X+5]=V.z,W[X+6]=I.x,W[X+7]=I.y,W[X+8]=I.z,X+=9;if(ga)for(va in ga)if(A=ga[va],A.__original.needsUpdate)J=
A.offset,F=A.offsetSrc,A.size===1?(A.boundTo===void 0||A.boundTo==="vertices"?(A.array[J]=A.value[C.a],A.array[J+1]=A.value[C.b],A.array[J+2]=A.value[C.c]):A.boundTo==="faces"?(F=A.value[F],A.array[J]=F,A.array[J+1]=F,A.array[J+2]=F,A.offsetSrc++):A.boundTo==="faceVertices"&&(A.array[J]=A.value[F],A.array[J+1]=A.value[F+1],A.array[J+2]=A.value[F+2],A.offsetSrc+=3),A.offset+=3):(A.boundTo===void 0||A.boundTo==="vertices"?(B=A.value[C.a],V=A.value[C.b],I=A.value[C.c]):A.boundTo==="faces"?(I=V=B=F=A.value[F],
A.offsetSrc++):A.boundTo==="faceVertices"&&(B=A.value[F],V=A.value[F+1],I=A.value[F+2],A.offsetSrc+=3),A.size===2?(A.array[J]=B.x,A.array[J+1]=B.y,A.array[J+2]=V.x,A.array[J+3]=V.y,A.array[J+4]=I.x,A.array[J+5]=I.y,A.offset+=6):A.size===3?(A.type==="c"?(A.array[J]=B.r,A.array[J+1]=B.g,A.array[J+2]=B.b,A.array[J+3]=V.r,A.array[J+4]=V.g,A.array[J+5]=V.b,A.array[J+6]=I.r,A.array[J+7]=I.g,A.array[J+8]=I.b):(A.array[J]=B.x,A.array[J+1]=B.y,A.array[J+2]=B.z,A.array[J+3]=V.x,A.array[J+4]=V.y,A.array[J+5]=
V.z,A.array[J+6]=I.x,A.array[J+7]=I.y,A.array[J+8]=I.z),A.offset+=9):(A.array[J]=B.x,A.array[J+1]=B.y,A.array[J+2]=B.z,A.array[J+3]=B.w,A.array[J+4]=V.x,A.array[J+5]=V.y,A.array[J+6]=V.z,A.array[J+7]=V.w,A.array[J+8]=I.x,A.array[J+9]=I.y,A.array[J+10]=I.z,A.array[J+11]=I.w,A.offset+=12));if(ab){J=0;for(A=Ha.length;J<A;J++)B=Ha[J].vertices[C.a].position,V=Ha[J].vertices[C.b].position,I=Ha[J].vertices[C.c].position,F=na[J],F[U]=B.x,F[U+1]=B.y,F[U+2]=B.z,F[U+3]=V.x,F[U+4]=V.y,F[U+5]=V.z,F[U+6]=I.x,F[U+
7]=I.y,F[U+8]=I.z;U+=9}if(Ia.length)J=Ia[C.a],A=Ia[C.b],F=Ia[C.c],da[Q]=J.x,da[Q+1]=J.y,da[Q+2]=J.z,da[Q+3]=J.w,da[Q+4]=A.x,da[Q+5]=A.y,da[Q+6]=A.z,da[Q+7]=A.w,da[Q+8]=F.x,da[Q+9]=F.y,da[Q+10]=F.z,da[Q+11]=F.w,J=Ra[C.a],A=Ra[C.b],F=Ra[C.c],ta[Q]=J.x,ta[Q+1]=J.y,ta[Q+2]=J.z,ta[Q+3]=J.w,ta[Q+4]=A.x,ta[Q+5]=A.y,ta[Q+6]=A.z,ta[Q+7]=A.w,ta[Q+8]=F.x,ta[Q+9]=F.y,ta[Q+10]=F.z,ta[Q+11]=F.w,J=Pa[C.a],A=Pa[C.b],F=Pa[C.c],aa[Q]=J.x,aa[Q+1]=J.y,aa[Q+2]=J.z,aa[Q+3]=1,aa[Q+4]=A.x,aa[Q+5]=A.y,aa[Q+6]=A.z,aa[Q+7]=
1,aa[Q+8]=F.x,aa[Q+9]=F.y,aa[Q+10]=F.z,aa[Q+11]=1,J=Qa[C.a],A=Qa[C.b],F=Qa[C.c],ea[Q]=J.x,ea[Q+1]=J.y,ea[Q+2]=J.z,ea[Q+3]=1,ea[Q+4]=A.x,ea[Q+5]=A.y,ea[Q+6]=A.z,ea[Q+7]=1,ea[Q+8]=F.x,ea[Q+9]=F.y,ea[Q+10]=F.z,ea[Q+11]=1,Q+=12;if($a&&u)K.length==3&&u==THREE.VertexColors?(C=K[0],J=K[1],A=K[2]):A=J=C=pa,sa[oa]=C.r,sa[oa+1]=C.g,sa[oa+2]=C.b,sa[oa+3]=J.r,sa[oa+4]=J.g,sa[oa+5]=J.b,sa[oa+6]=A.r,sa[oa+7]=A.g,sa[oa+8]=A.b,oa+=9;if(Za&&wa.hasTangents)K=ha[0],pa=ha[1],C=ha[2],$[P]=K.x,$[P+1]=K.y,$[P+2]=K.z,$[P+
3]=K.w,$[P+4]=pa.x,$[P+5]=pa.y,$[P+6]=pa.z,$[P+7]=pa.w,$[P+8]=C.x,$[P+9]=C.y,$[P+10]=C.z,$[P+11]=C.w,P+=12;if(Fa&&M)if(ka.length==3&&Ga)for(ha=0;ha<3;ha++)xa=ka[ha],ma[ca]=xa.x,ma[ca+1]=xa.y,ma[ca+2]=xa.z,ca+=3;else for(ha=0;ha<3;ha++)ma[ca]=xa.x,ma[ca+1]=xa.y,ma[ca+2]=xa.z,ca+=3;if(za&&y!==void 0&&v)for(ha=0;ha<3;ha++)ka=y[ha],ja[S]=ka.u,ja[S+1]=ka.v,S+=2;if(za&&w!==void 0&&v)for(ha=0;ha<3;ha++)ka=w[ha],fa[ra]=ka.u,fa[ra+1]=ka.v,ra+=2;Aa&&(qa[R]=O,qa[R+1]=O+1,qa[R+2]=O+2,R+=3,ia[ya]=O,ia[ya+1]=O+
1,ia[ya+2]=O,ia[ya+3]=O+2,ia[ya+4]=O+1,ia[ya+5]=O+2,ya+=6,O+=3)}else if(C instanceof THREE.Face4){if(Ca)B=Oa[C.a].position,V=Oa[C.b].position,I=Oa[C.c].position,L=Oa[C.d].position,W[X]=B.x,W[X+1]=B.y,W[X+2]=B.z,W[X+3]=V.x,W[X+4]=V.y,W[X+5]=V.z,W[X+6]=I.x,W[X+7]=I.y,W[X+8]=I.z,W[X+9]=L.x,W[X+10]=L.y,W[X+11]=L.z,X+=12;if(ga)for(va in ga)if(A=ga[va],A.__original.needsUpdate)J=A.offset,F=A.offsetSrc,A.size===1?(A.boundTo===void 0||A.boundTo==="vertices"?(A.array[J]=A.value[C.a],A.array[J+1]=A.value[C.b],
A.array[J+2]=A.value[C.c],A.array[J+3]=A.value[C.d]):A.boundTo==="faces"?(F=A.value[F],A.array[J]=F,A.array[J+1]=F,A.array[J+2]=F,A.array[J+3]=F,A.offsetSrc++):A.boundTo==="faceVertices"&&(A.array[J]=A.value[F],A.array[J+1]=A.value[F+1],A.array[J+2]=A.value[F+2],A.array[J+3]=A.value[F+3],A.offsetSrc+=4),A.offset+=4):(A.boundTo===void 0||A.boundTo==="vertices"?(B=A.value[C.a],V=A.value[C.b],I=A.value[C.c],L=A.value[C.d]):A.boundTo==="faces"?(L=I=V=B=F=A.value[F],A.offsetSrc++):A.boundTo==="faceVertices"&&
(B=A.value[F],V=A.value[F+1],I=A.value[F+2],L=A.value[F+3],A.offsetSrc+=4),A.size===2?(A.array[J]=B.x,A.array[J+1]=B.y,A.array[J+2]=V.x,A.array[J+3]=V.y,A.array[J+4]=I.x,A.array[J+5]=I.y,A.array[J+6]=L.x,A.array[J+7]=L.y,A.offset+=8):A.size===3?(A.type==="c"?(A.array[J]=B.r,A.array[J+1]=B.g,A.array[J+2]=B.b,A.array[J+3]=V.r,A.array[J+4]=V.g,A.array[J+5]=V.b,A.array[J+6]=I.r,A.array[J+7]=I.g,A.array[J+8]=I.b,A.array[J+9]=L.r,A.array[J+10]=L.g,A.array[J+11]=L.b):(A.array[J]=B.x,A.array[J+1]=B.y,A.array[J+
2]=B.z,A.array[J+3]=V.x,A.array[J+4]=V.y,A.array[J+5]=V.z,A.array[J+6]=I.x,A.array[J+7]=I.y,A.array[J+8]=I.z,A.array[J+9]=L.x,A.array[J+10]=L.y,A.array[J+11]=L.z),A.offset+=12):(A.array[J]=B.x,A.array[J+1]=B.y,A.array[J+2]=B.z,A.array[J+3]=B.w,A.array[J+4]=V.x,A.array[J+5]=V.y,A.array[J+6]=V.z,A.array[J+7]=V.w,A.array[J+8]=I.x,A.array[J+9]=I.y,A.array[J+10]=I.z,A.array[J+11]=I.w,A.array[J+12]=L.x,A.array[J+13]=L.y,A.array[J+14]=L.z,A.array[J+15]=L.w,A.offset+=16));if(ab){J=0;for(A=Ha.length;J<A;J++)B=
Ha[J].vertices[C.a].position,V=Ha[J].vertices[C.b].position,I=Ha[J].vertices[C.c].position,L=Ha[J].vertices[C.d].position,F=na[J],F[U]=B.x,F[U+1]=B.y,F[U+2]=B.z,F[U+3]=V.x,F[U+4]=V.y,F[U+5]=V.z,F[U+6]=I.x,F[U+7]=I.y,F[U+8]=I.z,F[U+9]=L.x,F[U+10]=L.y,F[U+11]=L.z;U+=12}if(Ia.length)J=Ia[C.a],A=Ia[C.b],F=Ia[C.c],Y=Ia[C.d],da[Q]=J.x,da[Q+1]=J.y,da[Q+2]=J.z,da[Q+3]=J.w,da[Q+4]=A.x,da[Q+5]=A.y,da[Q+6]=A.z,da[Q+7]=A.w,da[Q+8]=F.x,da[Q+9]=F.y,da[Q+10]=F.z,da[Q+11]=F.w,da[Q+12]=Y.x,da[Q+13]=Y.y,da[Q+14]=Y.z,
da[Q+15]=Y.w,J=Ra[C.a],A=Ra[C.b],F=Ra[C.c],Y=Ra[C.d],ta[Q]=J.x,ta[Q+1]=J.y,ta[Q+2]=J.z,ta[Q+3]=J.w,ta[Q+4]=A.x,ta[Q+5]=A.y,ta[Q+6]=A.z,ta[Q+7]=A.w,ta[Q+8]=F.x,ta[Q+9]=F.y,ta[Q+10]=F.z,ta[Q+11]=F.w,ta[Q+12]=Y.x,ta[Q+13]=Y.y,ta[Q+14]=Y.z,ta[Q+15]=Y.w,J=Pa[C.a],A=Pa[C.b],F=Pa[C.c],Y=Pa[C.d],aa[Q]=J.x,aa[Q+1]=J.y,aa[Q+2]=J.z,aa[Q+3]=1,aa[Q+4]=A.x,aa[Q+5]=A.y,aa[Q+6]=A.z,aa[Q+7]=1,aa[Q+8]=F.x,aa[Q+9]=F.y,aa[Q+10]=F.z,aa[Q+11]=1,aa[Q+12]=Y.x,aa[Q+13]=Y.y,aa[Q+14]=Y.z,aa[Q+15]=1,J=Qa[C.a],A=Qa[C.b],F=Qa[C.c],
C=Qa[C.d],ea[Q]=J.x,ea[Q+1]=J.y,ea[Q+2]=J.z,ea[Q+3]=1,ea[Q+4]=A.x,ea[Q+5]=A.y,ea[Q+6]=A.z,ea[Q+7]=1,ea[Q+8]=F.x,ea[Q+9]=F.y,ea[Q+10]=F.z,ea[Q+11]=1,ea[Q+12]=C.x,ea[Q+13]=C.y,ea[Q+14]=C.z,ea[Q+15]=1,Q+=16;if($a&&u)K.length==4&&u==THREE.VertexColors?(C=K[0],J=K[1],A=K[2],K=K[3]):K=A=J=C=pa,sa[oa]=C.r,sa[oa+1]=C.g,sa[oa+2]=C.b,sa[oa+3]=J.r,sa[oa+4]=J.g,sa[oa+5]=J.b,sa[oa+6]=A.r,sa[oa+7]=A.g,sa[oa+8]=A.b,sa[oa+9]=K.r,sa[oa+10]=K.g,sa[oa+11]=K.b,oa+=12;if(Za&&wa.hasTangents)K=ha[0],pa=ha[1],C=ha[2],ha=
ha[3],$[P]=K.x,$[P+1]=K.y,$[P+2]=K.z,$[P+3]=K.w,$[P+4]=pa.x,$[P+5]=pa.y,$[P+6]=pa.z,$[P+7]=pa.w,$[P+8]=C.x,$[P+9]=C.y,$[P+10]=C.z,$[P+11]=C.w,$[P+12]=ha.x,$[P+13]=ha.y,$[P+14]=ha.z,$[P+15]=ha.w,P+=16;if(Fa&&M)if(ka.length==4&&Ga)for(ha=0;ha<4;ha++)xa=ka[ha],ma[ca]=xa.x,ma[ca+1]=xa.y,ma[ca+2]=xa.z,ca+=3;else for(ha=0;ha<4;ha++)ma[ca]=xa.x,ma[ca+1]=xa.y,ma[ca+2]=xa.z,ca+=3;if(za&&y!==void 0&&v)for(ha=0;ha<4;ha++)ka=y[ha],ja[S]=ka.u,ja[S+1]=ka.v,S+=2;if(za&&w!==void 0&&v)for(ha=0;ha<4;ha++)ka=w[ha],
fa[ra]=ka.u,fa[ra+1]=ka.v,ra+=2;Aa&&(qa[R]=O,qa[R+1]=O+1,qa[R+2]=O+3,qa[R+3]=O+1,qa[R+4]=O+2,qa[R+5]=O+3,R+=6,ia[ya]=O,ia[ya+1]=O+1,ia[ya+2]=O,ia[ya+3]=O+3,ia[ya+4]=O+1,ia[ya+5]=O+2,ia[ya+6]=O+2,ia[ya+7]=O+3,ya+=8,O+=4)}Ca&&(o.bindBuffer(o.ARRAY_BUFFER,t.__webglVertexBuffer),o.bufferData(o.ARRAY_BUFFER,W,Z));if(ga)for(va in ga)A=ga[va],A.__original.needsUpdate&&(o.bindBuffer(o.ARRAY_BUFFER,A.buffer),o.bufferData(o.ARRAY_BUFFER,A.array,Z));if(ab){J=0;for(A=Ha.length;J<A;J++)o.bindBuffer(o.ARRAY_BUFFER,
t.__webglMorphTargetsBuffers[J]),o.bufferData(o.ARRAY_BUFFER,na[J],Z)}$a&&oa>0&&(o.bindBuffer(o.ARRAY_BUFFER,t.__webglColorBuffer),o.bufferData(o.ARRAY_BUFFER,sa,Z));Fa&&(o.bindBuffer(o.ARRAY_BUFFER,t.__webglNormalBuffer),o.bufferData(o.ARRAY_BUFFER,ma,Z));Za&&wa.hasTangents&&(o.bindBuffer(o.ARRAY_BUFFER,t.__webglTangentBuffer),o.bufferData(o.ARRAY_BUFFER,$,Z));za&&S>0&&(o.bindBuffer(o.ARRAY_BUFFER,t.__webglUVBuffer),o.bufferData(o.ARRAY_BUFFER,ja,Z));za&&ra>0&&(o.bindBuffer(o.ARRAY_BUFFER,t.__webglUV2Buffer),
o.bufferData(o.ARRAY_BUFFER,fa,Z));Aa&&(o.bindBuffer(o.ELEMENT_ARRAY_BUFFER,t.__webglFaceBuffer),o.bufferData(o.ELEMENT_ARRAY_BUFFER,qa,Z),o.bindBuffer(o.ELEMENT_ARRAY_BUFFER,t.__webglLineBuffer),o.bufferData(o.ELEMENT_ARRAY_BUFFER,ia,Z));Q>0&&(o.bindBuffer(o.ARRAY_BUFFER,t.__webglSkinVertexABuffer),o.bufferData(o.ARRAY_BUFFER,aa,Z),o.bindBuffer(o.ARRAY_BUFFER,t.__webglSkinVertexBBuffer),o.bufferData(o.ARRAY_BUFFER,ea,Z),o.bindBuffer(o.ARRAY_BUFFER,t.__webglSkinIndicesBuffer),o.bufferData(o.ARRAY_BUFFER,
ta,Z),o.bindBuffer(o.ARRAY_BUFFER,t.__webglSkinWeightsBuffer),o.bufferData(o.ARRAY_BUFFER,da,Z));T&&(delete t.__inittedArrays,delete t.__colorArray,delete t.__normalArray,delete t.__tangentArray,delete t.__uvArray,delete t.__uv2Array,delete t.__faceArray,delete t.__vertexArray,delete t.__lineArray,delete t.__skinVertexAArray,delete t.__skinVertexBArray,delete t.__skinIndexArray,delete t.__skinWeightArray)}h.__dirtyVertices=!1;h.__dirtyMorphTargets=!1;h.__dirtyElements=!1;h.__dirtyUvs=!1;h.__dirtyNormals=
!1;h.__dirtyTangents=!1;h.__dirtyColors=!1;G(m)}else if(k instanceof THREE.Ribbon){h=k.geometry;if(h.__dirtyVertices||h.__dirtyColors){k=h;m=o.DYNAMIC_DRAW;n=z=T=T=void 0;x=k.vertices;p=k.colors;v=x.length;t=p.length;u=k.__vertexArray;Z=k.__colorArray;M=k.__dirtyColors;if(k.__dirtyVertices){for(T=0;T<v;T++)z=x[T].position,n=T*3,u[n]=z.x,u[n+1]=z.y,u[n+2]=z.z;o.bindBuffer(o.ARRAY_BUFFER,k.__webglVertexBuffer);o.bufferData(o.ARRAY_BUFFER,u,m)}if(M){for(T=0;T<t;T++)color=p[T],n=T*3,Z[n]=color.r,Z[n+
1]=color.g,Z[n+2]=color.b;o.bindBuffer(o.ARRAY_BUFFER,k.__webglColorBuffer);o.bufferData(o.ARRAY_BUFFER,Z,m)}}h.__dirtyVertices=!1;h.__dirtyColors=!1}else if(k instanceof THREE.Line){h=k.geometry;if(h.__dirtyVertices||h.__dirtyColors){k=h;m=o.DYNAMIC_DRAW;n=z=T=T=void 0;x=k.vertices;p=k.colors;v=x.length;t=p.length;u=k.__vertexArray;Z=k.__colorArray;M=k.__dirtyColors;if(k.__dirtyVertices){for(T=0;T<v;T++)z=x[T].position,n=T*3,u[n]=z.x,u[n+1]=z.y,u[n+2]=z.z;o.bindBuffer(o.ARRAY_BUFFER,k.__webglVertexBuffer);
o.bufferData(o.ARRAY_BUFFER,u,m)}if(M){for(T=0;T<t;T++)color=p[T],n=T*3,Z[n]=color.r,Z[n+1]=color.g,Z[n+2]=color.b;o.bindBuffer(o.ARRAY_BUFFER,k.__webglColorBuffer);o.bufferData(o.ARRAY_BUFFER,Z,m)}}h.__dirtyVertices=!1;h.__dirtyColors=!1}else if(k instanceof THREE.ParticleSystem)h=k.geometry,t=D(h),(h.__dirtyVertices||h.__dirtyColors||k.sortParticles||t)&&c(h,o.DYNAMIC_DRAW,k),h.__dirtyVertices=!1,h.__dirtyColors=!1,G(h)};this.setFaceCulling=function(b,e){b?(!e||e=="ccw"?o.frontFace(o.CCW):o.frontFace(o.CW),
b=="back"?o.cullFace(o.BACK):b=="front"?o.cullFace(o.FRONT):o.cullFace(o.FRONT_AND_BACK),o.enable(o.CULL_FACE)):o.disable(o.CULL_FACE)};this.supportsVertexTextures=function(){return oa}};
THREE.WebGLRenderTarget=function(b,c,e){this.width=b;this.height=c;e=e||{};this.wrapS=e.wrapS!==void 0?e.wrapS:THREE.ClampToEdgeWrapping;this.wrapT=e.wrapT!==void 0?e.wrapT:THREE.ClampToEdgeWrapping;this.magFilter=e.magFilter!==void 0?e.magFilter:THREE.LinearFilter;this.minFilter=e.minFilter!==void 0?e.minFilter:THREE.LinearMipMapLinearFilter;this.offset=new THREE.Vector2(0,0);this.repeat=new THREE.Vector2(1,1);this.format=e.format!==void 0?e.format:THREE.RGBAFormat;this.type=e.type!==void 0?e.type:
THREE.UnsignedByteType;this.depthBuffer=e.depthBuffer!==void 0?e.depthBuffer:!0;this.stencilBuffer=e.stencilBuffer!==void 0?e.stencilBuffer:!0};
THREE.WebGLRenderTarget.prototype.clone=function(){var b=new THREE.WebGLRenderTarget(this.width,this.height);b.wrapS=this.wrapS;b.wrapT=this.wrapT;b.magFilter=this.magFilter;b.minFilter=this.minFilter;b.offset.copy(this.offset);b.repeat.copy(this.repeat);b.format=this.format;b.type=this.type;b.depthBuffer=this.depthBuffer;b.stencilBuffer=this.stencilBuffer;return b};THREE.WebGLRenderTargetCube=function(b,c,e){THREE.WebGLRenderTarget.call(this,b,c,e);this.activeCubeFace=0};
THREE.WebGLRenderTargetCube.prototype=new THREE.WebGLRenderTarget;THREE.WebGLRenderTargetCube.prototype.constructor=THREE.WebGLRenderTargetCube;THREE.RenderableVertex=function(){this.positionWorld=new THREE.Vector3;this.positionScreen=new THREE.Vector4;this.visible=!0};THREE.RenderableVertex.prototype.copy=function(b){this.positionWorld.copy(b.positionWorld);this.positionScreen.copy(b.positionScreen)};
THREE.RenderableFace3=function(){this.v1=new THREE.RenderableVertex;this.v2=new THREE.RenderableVertex;this.v3=new THREE.RenderableVertex;this.centroidWorld=new THREE.Vector3;this.centroidScreen=new THREE.Vector3;this.normalWorld=new THREE.Vector3;this.vertexNormalsWorld=[new THREE.Vector3,new THREE.Vector3,new THREE.Vector3];this.faceMaterials=this.meshMaterials=null;this.overdraw=!1;this.uvs=[[]];this.z=null};
THREE.RenderableFace4=function(){this.v1=new THREE.RenderableVertex;this.v2=new THREE.RenderableVertex;this.v3=new THREE.RenderableVertex;this.v4=new THREE.RenderableVertex;this.centroidWorld=new THREE.Vector3;this.centroidScreen=new THREE.Vector3;this.normalWorld=new THREE.Vector3;this.vertexNormalsWorld=[new THREE.Vector3,new THREE.Vector3,new THREE.Vector3,new THREE.Vector3];this.faceMaterials=this.meshMaterials=null;this.overdraw=!1;this.uvs=[[]];this.z=null};
THREE.RenderableObject=function(){this.z=this.object=null};THREE.RenderableParticle=function(){this.rotation=this.z=this.y=this.x=null;this.scale=new THREE.Vector2;this.materials=null};THREE.RenderableLine=function(){this.z=null;this.v1=new THREE.RenderableVertex;this.v2=new THREE.RenderableVertex;this.materials=null};
THREE.ColorUtils={adjustHSV:function(b,c,e,f){var h=THREE.ColorUtils.__hsv;THREE.ColorUtils.rgbToHsv(b,h);h.h=THREE.ColorUtils.clamp(h.h+c,0,1);h.s=THREE.ColorUtils.clamp(h.s+e,0,1);h.v=THREE.ColorUtils.clamp(h.v+f,0,1);b.setHSV(h.h,h.s,h.v)},rgbToHsv:function(b,c){var e=b.r,f=b.g,h=b.b,m=Math.max(Math.max(e,f),h),k=Math.min(Math.min(e,f),h);if(k==m)k=e=0;else{var n=m-k,k=n/m,e=e==m?(f-h)/n:f==m?2+(h-e)/n:4+(e-f)/n;e/=6;e<0&&(e+=1);e>1&&(e-=1)}c===void 0&&(c={h:0,s:0,v:0});c.h=e;c.s=k;c.v=m;return c},
clamp:function(b,c,e){return b<c?c:b>e?e:b}};THREE.ColorUtils.__hsv={h:0,s:0,v:0};
THREE.GeometryUtils={merge:function(b,c){var e=c instanceof THREE.Mesh,f=b.vertices.length,h=e?c.geometry:c,m=b.vertices,k=h.vertices,n=b.faces,u=h.faces,p=b.faceVertexUvs[0],h=h.faceVertexUvs[0];e&&c.matrixAutoUpdate&&c.updateMatrix();for(var v=0,t=k.length;v<t;v++){var x=new THREE.Vertex(k[v].position.clone());e&&c.matrix.multiplyVector3(x.position);m.push(x)}v=0;for(t=u.length;v<t;v++){var k=u[v],w,z,y=k.vertexNormals,x=k.vertexColors;k instanceof THREE.Face3?w=new THREE.Face3(k.a+f,k.b+f,k.c+
f):k instanceof THREE.Face4&&(w=new THREE.Face4(k.a+f,k.b+f,k.c+f,k.d+f));w.normal.copy(k.normal);e=0;for(m=y.length;e<m;e++)z=y[e],w.vertexNormals.push(z.clone());w.color.copy(k.color);e=0;for(m=x.length;e<m;e++)z=x[e],w.vertexColors.push(z.clone());w.materials=k.materials.slice();w.centroid.copy(k.centroid);n.push(w)}v=0;for(t=h.length;v<t;v++){f=h[v];n=[];e=0;for(m=f.length;e<m;e++)n.push(new THREE.UV(f[e].u,f[e].v));p.push(n)}},clone:function(b){var c=new THREE.Geometry,e,f=b.vertices,h=b.faces,
m=b.faceVertexUvs[0],b=0;for(e=f.length;b<e;b++){var k=new THREE.Vertex(f[b].position.clone());c.vertices.push(k)}b=0;for(e=h.length;b<e;b++){var n=h[b],u,p,v=n.vertexNormals,t=n.vertexColors;n instanceof THREE.Face3?u=new THREE.Face3(n.a,n.b,n.c):n instanceof THREE.Face4&&(u=new THREE.Face4(n.a,n.b,n.c,n.d));u.normal.copy(n.normal);f=0;for(k=v.length;f<k;f++)p=v[f],u.vertexNormals.push(p.clone());u.color.copy(n.color);f=0;for(k=t.length;f<k;f++)p=t[f],u.vertexColors.push(p.clone());u.materials=n.materials.slice();
u.centroid.copy(n.centroid);c.faces.push(u)}b=0;for(e=m.length;b<e;b++){h=m[b];u=[];f=0;for(k=h.length;f<k;f++)u.push(new THREE.UV(h[f].u,h[f].v));c.faceVertexUvs[0].push(u)}return c},randomPointInTriangle:function(b,c,e){var f,h,m,k=new THREE.Vector3,n=THREE.GeometryUtils.__v1;f=THREE.GeometryUtils.random();h=THREE.GeometryUtils.random();f+h>1&&(f=1-f,h=1-h);m=1-f-h;k.copy(b);k.multiplyScalar(f);n.copy(c);n.multiplyScalar(h);k.addSelf(n);n.copy(e);n.multiplyScalar(m);k.addSelf(n);return k},randomPointInFace:function(b,
c,e){var f,h,m;if(b instanceof THREE.Face3)return f=c.vertices[b.a].position,h=c.vertices[b.b].position,m=c.vertices[b.c].position,THREE.GeometryUtils.randomPointInTriangle(f,h,m);else if(b instanceof THREE.Face4){f=c.vertices[b.a].position;h=c.vertices[b.b].position;m=c.vertices[b.c].position;var c=c.vertices[b.d].position,k;e?b._area1&&b._area2?(e=b._area1,k=b._area2):(e=THREE.GeometryUtils.triangleArea(f,h,c),k=THREE.GeometryUtils.triangleArea(h,m,c),b._area1=e,b._area2=k):(e=THREE.GeometryUtils.triangleArea(f,
h,c),k=THREE.GeometryUtils.triangleArea(h,m,c));return THREE.GeometryUtils.random()*(e+k)<e?THREE.GeometryUtils.randomPointInTriangle(f,h,c):THREE.GeometryUtils.randomPointInTriangle(h,m,c)}},randomPointsInGeometry:function(b,c){function e(b){function e(c,f){if(f<c)return c;var k=c+Math.floor((f-c)/2);return p[k]>b?e(c,k-1):p[k]<b?e(k+1,f):k}return e(0,p.length-1)}var f,h,m=b.faces,k=b.vertices,n=m.length,u=0,p=[],v,t,x,w;for(h=0;h<n;h++){f=m[h];if(f instanceof THREE.Face3)v=k[f.a].position,t=k[f.b].position,
x=k[f.c].position,f._area=THREE.GeometryUtils.triangleArea(v,t,x);else if(f instanceof THREE.Face4)v=k[f.a].position,t=k[f.b].position,x=k[f.c].position,w=k[f.d].position,f._area1=THREE.GeometryUtils.triangleArea(v,t,w),f._area2=THREE.GeometryUtils.triangleArea(t,x,w),f._area=f._area1+f._area2;u+=f._area;p[h]=u}f=[];k={};for(h=0;h<c;h++)n=THREE.GeometryUtils.random()*u,n=e(n),f[h]=THREE.GeometryUtils.randomPointInFace(m[n],b,!0),k[n]?k[n]+=1:k[n]=1;return f},triangleArea:function(b,c,e){var f,h=THREE.GeometryUtils.__v1;
h.sub(b,c);f=h.length();h.sub(b,e);b=h.length();h.sub(c,e);e=h.length();c=0.5*(f+b+e);return Math.sqrt(c*(c-f)*(c-b)*(c-e))},random16:function(){return(65280*Math.random()+255*Math.random())/65535}};THREE.GeometryUtils.random=THREE.GeometryUtils.random16;THREE.GeometryUtils.__v1=new THREE.Vector3;
THREE.ImageUtils={loadTexture:function(b,c,e){var f=new Image,h=new THREE.Texture(f,c);f.onload=function(){h.needsUpdate=!0;e&&e(this)};f.crossOrigin="";f.src=b;return h},loadTextureCube:function(b,c,e){var f,h=[],m=new THREE.Texture(h,c),c=h.loadCount=0;for(f=b.length;c<f;++c)h[c]=new Image,h[c].onload=function(){h.loadCount+=1;if(h.loadCount==6)m.needsUpdate=!0;e&&e(this)},h[c].crossOrigin="",h[c].src=b[c];return m},getNormalMap:function(b,c){var e=function(b){var e=Math.sqrt(b[0]*b[0]+b[1]*b[1]+
b[2]*b[2]);return[b[0]/e,b[1]/e,b[2]/e]};c|=1;var f=b.width,h=b.height,m=document.createElement("canvas");m.width=f;m.height=h;var k=m.getContext("2d");k.drawImage(b,0,0);for(var n=k.getImageData(0,0,f,h).data,u=k.createImageData(f,h),p=u.data,v=0;v<f;v++)for(var t=1;t<h;t++){var x=t-1<0?h-1:t-1,w=(t+1)%h,z=v-1<0?f-1:v-1,y=(v+1)%f,B=[],D=[0,0,n[(t*f+v)*4]/255*c];B.push([-1,0,n[(t*f+z)*4]/255*c]);B.push([-1,-1,n[(x*f+z)*4]/255*c]);B.push([0,-1,n[(x*f+v)*4]/255*c]);B.push([1,-1,n[(x*f+y)*4]/255*c]);
B.push([1,0,n[(t*f+y)*4]/255*c]);B.push([1,1,n[(w*f+y)*4]/255*c]);B.push([0,1,n[(w*f+v)*4]/255*c]);B.push([-1,1,n[(w*f+z)*4]/255*c]);x=[];z=B.length;for(w=0;w<z;w++){var y=B[w],G=B[(w+1)%z],y=[y[0]-D[0],y[1]-D[1],y[2]-D[2]],G=[G[0]-D[0],G[1]-D[1],G[2]-D[2]];x.push(e([y[1]*G[2]-y[2]*G[1],y[2]*G[0]-y[0]*G[2],y[0]*G[1]-y[1]*G[0]]))}B=[0,0,0];for(w=0;w<x.length;w++)B[0]+=x[w][0],B[1]+=x[w][1],B[2]+=x[w][2];B[0]/=x.length;B[1]/=x.length;B[2]/=x.length;D=(t*f+v)*4;p[D]=(B[0]+1)/2*255|0;p[D+1]=(B[1]+0.5)*
255|0;p[D+2]=B[2]*255|0;p[D+3]=255}k.putImageData(u,0,0);return m}};THREE.SceneUtils={showHierarchy:function(b,c){THREE.SceneUtils.traverseHierarchy(b,function(b){b.visible=c})},traverseHierarchy:function(b,c){var e,f,h=b.children.length;for(f=0;f<h;f++)e=b.children[f],c(e),THREE.SceneUtils.traverseHierarchy(e,c)}};
if(THREE.WebGLRenderer)THREE.ShaderUtils={lib:{fresnel:{uniforms:{mRefractionRatio:{type:"f",value:1.02},mFresnelBias:{type:"f",value:0.1},mFresnelPower:{type:"f",value:2},mFresnelScale:{type:"f",value:1},tCube:{type:"t",value:1,texture:null}},fragmentShader:"uniform samplerCube tCube;\nvarying vec3 vReflect;\nvarying vec3 vRefract[3];\nvarying float vReflectionFactor;\nvoid main() {\nvec4 reflectedColor = textureCube( tCube, vec3( -vReflect.x, vReflect.yz ) );\nvec4 refractedColor = vec4( 1.0, 1.0, 1.0, 1.0 );\nrefractedColor.r = textureCube( tCube, vec3( -vRefract[0].x, vRefract[0].yz ) ).r;\nrefractedColor.g = textureCube( tCube, vec3( -vRefract[1].x, vRefract[1].yz ) ).g;\nrefractedColor.b = textureCube( tCube, vec3( -vRefract[2].x, vRefract[2].yz ) ).b;\nrefractedColor.a = 1.0;\ngl_FragColor = mix( refractedColor, reflectedColor, clamp( vReflectionFactor, 0.0, 1.0 ) );\n}",
vertexShader:"uniform float mRefractionRatio;\nuniform float mFresnelBias;\nuniform float mFresnelScale;\nuniform float mFresnelPower;\nvarying vec3 vReflect;\nvarying vec3 vRefract[3];\nvarying float vReflectionFactor;\nvoid main() {\nvec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\nvec4 mPosition = objectMatrix * vec4( position, 1.0 );\nvec3 nWorld = normalize ( mat3( objectMatrix[0].xyz, objectMatrix[1].xyz, objectMatrix[2].xyz ) * normal );\nvec3 I = mPosition.xyz - cameraPosition;\nvReflect = reflect( I, nWorld );\nvRefract[0] = refract( normalize( I ), nWorld, mRefractionRatio );\nvRefract[1] = refract( normalize( I ), nWorld, mRefractionRatio * 0.99 );\nvRefract[2] = refract( normalize( I ), nWorld, mRefractionRatio * 0.98 );\nvReflectionFactor = mFresnelBias + mFresnelScale * pow( 1.0 + dot( normalize( I ), nWorld ), mFresnelPower );\ngl_Position = projectionMatrix * mvPosition;\n}"},
normal:{uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,THREE.UniformsLib.lights,{enableAO:{type:"i",value:0},enableDiffuse:{type:"i",value:0},enableSpecular:{type:"i",value:0},tDiffuse:{type:"t",value:0,texture:null},tNormal:{type:"t",value:2,texture:null},tSpecular:{type:"t",value:3,texture:null},tAO:{type:"t",value:4,texture:null},uNormalScale:{type:"f",value:1},tDisplacement:{type:"t",value:5,texture:null},uDisplacementBias:{type:"f",value:0},uDisplacementScale:{type:"f",value:1},uDiffuseColor:{type:"c",
value:new THREE.Color(15658734)},uSpecularColor:{type:"c",value:new THREE.Color(1118481)},uAmbientColor:{type:"c",value:new THREE.Color(328965)},uShininess:{type:"f",value:30},uOpacity:{type:"f",value:1}}]),fragmentShader:["uniform vec3 uAmbientColor;\nuniform vec3 uDiffuseColor;\nuniform vec3 uSpecularColor;\nuniform float uShininess;\nuniform float uOpacity;\nuniform bool enableDiffuse;\nuniform bool enableSpecular;\nuniform bool enableAO;\nuniform sampler2D tDiffuse;\nuniform sampler2D tNormal;\nuniform sampler2D tSpecular;\nuniform sampler2D tAO;\nuniform float uNormalScale;\nvarying vec3 vTangent;\nvarying vec3 vBinormal;\nvarying vec3 vNormal;\nvarying vec2 vUv;\nuniform vec3 ambientLightColor;\n#if MAX_DIR_LIGHTS > 0\nuniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];\nuniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];\n#endif\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];\nvarying vec4 vPointLight[ MAX_POINT_LIGHTS ];\n#endif\nvarying vec3 vViewPosition;",
THREE.ShaderChunk.fog_pars_fragment,"void main() {\ngl_FragColor = vec4( 1.0 );\nvec4 mColor = vec4( uDiffuseColor, uOpacity );\nvec4 mSpecular = vec4( uSpecularColor, uOpacity );\nvec3 specularTex = vec3( 1.0 );\nvec3 normalTex = texture2D( tNormal, vUv ).xyz * 2.0 - 1.0;\nnormalTex.xy *= uNormalScale;\nnormalTex = normalize( normalTex );\nif( enableDiffuse )\ngl_FragColor = gl_FragColor * texture2D( tDiffuse, vUv );\nif( enableAO )\ngl_FragColor = gl_FragColor * texture2D( tAO, vUv );\nif( enableSpecular )\nspecularTex = texture2D( tSpecular, vUv ).xyz;\nmat3 tsb = mat3( vTangent, vBinormal, vNormal );\nvec3 finalNormal = tsb * normalTex;\nvec3 normal = normalize( finalNormal );\nvec3 viewPosition = normalize( vViewPosition );\n#if MAX_POINT_LIGHTS > 0\nvec4 pointTotal = vec4( vec3( 0.0 ), 1.0 );\nfor ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\nvec3 pointVector = normalize( vPointLight[ i ].xyz );\nvec3 pointHalfVector = normalize( vPointLight[ i ].xyz + viewPosition );\nfloat pointDistance = vPointLight[ i ].w;\nfloat pointDotNormalHalf = dot( normal, pointHalfVector );\nfloat pointDiffuseWeight = max( dot( normal, pointVector ), 0.0 );\nfloat pointSpecularWeight = 0.0;\nif ( pointDotNormalHalf >= 0.0 )\npointSpecularWeight = specularTex.r * pow( pointDotNormalHalf, uShininess );\npointTotal  += pointDistance * vec4( pointLightColor[ i ], 1.0 ) * ( mColor * pointDiffuseWeight + mSpecular * pointSpecularWeight * pointDiffuseWeight );\n}\n#endif\n#if MAX_DIR_LIGHTS > 0\nvec4 dirTotal = vec4( vec3( 0.0 ), 1.0 );\nfor( int i = 0; i < MAX_DIR_LIGHTS; i++ ) {\nvec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );\nvec3 dirVector = normalize( lDirection.xyz );\nvec3 dirHalfVector = normalize( lDirection.xyz + viewPosition );\nfloat dirDotNormalHalf = dot( normal, dirHalfVector );\nfloat dirDiffuseWeight = max( dot( normal, dirVector ), 0.0 );\nfloat dirSpecularWeight = 0.0;\nif ( dirDotNormalHalf >= 0.0 )\ndirSpecularWeight = specularTex.r * pow( dirDotNormalHalf, uShininess );\ndirTotal  += vec4( directionalLightColor[ i ], 1.0 ) * ( mColor * dirDiffuseWeight + mSpecular * dirSpecularWeight * dirDiffuseWeight );\n}\n#endif\nvec4 totalLight = vec4( ambientLightColor * uAmbientColor, uOpacity );\n#if MAX_DIR_LIGHTS > 0\ntotalLight += dirTotal;\n#endif\n#if MAX_POINT_LIGHTS > 0\ntotalLight += pointTotal;\n#endif\ngl_FragColor = gl_FragColor * totalLight;",
THREE.ShaderChunk.fog_fragment,"}"].join("\n"),vertexShader:"attribute vec4 tangent;\n#ifdef VERTEX_TEXTURES\nuniform sampler2D tDisplacement;\nuniform float uDisplacementScale;\nuniform float uDisplacementBias;\n#endif\nvarying vec3 vTangent;\nvarying vec3 vBinormal;\nvarying vec3 vNormal;\nvarying vec2 vUv;\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];\nuniform float pointLightDistance[ MAX_POINT_LIGHTS ];\nvarying vec4 vPointLight[ MAX_POINT_LIGHTS ];\n#endif\nvarying vec3 vViewPosition;\nvoid main() {\nvec4 mPosition = objectMatrix * vec4( position, 1.0 );\nvec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\nvViewPosition = -mvPosition.xyz;\nvNormal = normalize( normalMatrix * normal );\nvTangent = normalize( normalMatrix * tangent.xyz );\nvBinormal = cross( vNormal, vTangent ) * tangent.w;\nvBinormal = normalize( vBinormal );\nvUv = uv;\n#if MAX_POINT_LIGHTS > 0\nfor( int i = 0; i < MAX_POINT_LIGHTS; i++ ) {\nvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz - mvPosition.xyz;\nfloat lDistance = 1.0;\nif ( pointLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );\nlVector = normalize( lVector );\nvPointLight[ i ] = vec4( lVector, lDistance );\n}\n#endif\n#ifdef VERTEX_TEXTURES\nvec3 dv = texture2D( tDisplacement, uv ).xyz;\nfloat df = uDisplacementScale * dv.x + uDisplacementBias;\nvec4 displacedPosition = vec4( vNormal.xyz * df, 0.0 ) + mvPosition;\ngl_Position = projectionMatrix * displacedPosition;\n#else\ngl_Position = projectionMatrix * mvPosition;\n#endif\n}"},
cube:{uniforms:{tCube:{type:"t",value:1,texture:null}},vertexShader:"varying vec3 vViewPosition;\nvoid main() {\nvec4 mPosition = objectMatrix * vec4( position, 1.0 );\nvViewPosition = cameraPosition - mPosition.xyz;\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",fragmentShader:"uniform samplerCube tCube;\nvarying vec3 vViewPosition;\nvoid main() {\nvec3 wPos = cameraPosition - vViewPosition;\ngl_FragColor = textureCube( tCube, vec3( - wPos.x, wPos.yz ) );\n}"}}};
THREE.Curve=function(){};THREE.Curve.prototype.getPoint=function(){console.log("Warning, getPoint() not implemented!");return null};THREE.Curve.prototype.getPointAt=function(b){return this.getPoint(this.getUtoTmapping(b))};THREE.Curve.prototype.getPoints=function(b){b||(b=5);var c,e=[];for(c=0;c<=b;c++)e.push(this.getPoint(c/b));return e};THREE.Curve.prototype.getSpacedPoints=function(b){b||(b=5);var c,e=[];for(c=0;c<=b;c++)e.push(this.getPointAt(c/b));return e};
THREE.Curve.prototype.getLength=function(){var b=this.getLengths();return b[b.length-1]};THREE.Curve.prototype.getLengths=function(b){b||(b=200);if(this.cacheArcLengths&&this.cacheArcLengths.length==b+1)return this.cacheArcLengths;var c=[],e,f=this.getPoint(0),h,m=0;c.push(0);for(h=1;h<=b;h++)e=this.getPoint(h/b),m+=e.distanceTo(f),c.push(m),f=e;return this.cacheArcLengths=c};
THREE.Curve.prototype.getUtoTmapping=function(b,c){var e=this.getLengths(),f=0,h=e.length,m;m=c?c:b*e[h-1];time=Date.now();for(var k=0,n=h-1,u;k<=n;)if(f=Math.floor(k+(n-k)/2),u=e[f]-m,u<0)k=f+1;else if(u>0)n=f-1;else{n=f;break}f=n;if(e[f]==m)return f/(h-1);k=e[f];return e=(f+(m-k)/(e[f+1]-k))/(h-1)};THREE.Curve.prototype.getNormalVector=function(b){b=this.getTangent(b);return new THREE.Vector2(-b.y,b.x)};
THREE.Curve.prototype.getTangent=function(b){var c=b-1.0E-4;b+=1.0E-4;c<0&&(c=0);b>1&&(b=1);var c=this.getPoint(c),b=this.getPoint(b),e=new THREE.Vector2;e.sub(b,c);return e.unit()};THREE.LineCurve=function(b,c){b instanceof THREE.Vector2?(this.v1=b,this.v2=c):THREE.LineCurve.oldConstructor.apply(this,arguments)};THREE.LineCurve.oldConstructor=function(b,c,e,f){this.constructor(new THREE.Vector2(b,c),new THREE.Vector2(e,f))};THREE.LineCurve.prototype=new THREE.Curve;
THREE.LineCurve.prototype.constructor=THREE.LineCurve;THREE.LineCurve.prototype.getPoint=function(b){var c=new THREE.Vector2;c.sub(this.v2,this.v1);c.multiplyScalar(b).addSelf(this.v1);return c};THREE.LineCurve.prototype.getPointAt=function(b){return this.getPoint(b)};THREE.LineCurve.prototype.getTangent=function(){var b=new THREE.Vector2;b.sub(this.v2,this.v1);b.normalize();return b};
THREE.QuadraticBezierCurve=function(b,c,e){if(!(c instanceof THREE.Vector2))var f=Array.prototype.slice.call(arguments),b=new THREE.Vector2(f[0],f[1]),c=new THREE.Vector2(f[2],f[3]),e=new THREE.Vector2(f[4],f[5]);this.v0=b;this.v1=c;this.v2=e};THREE.QuadraticBezierCurve.prototype=new THREE.Curve;THREE.QuadraticBezierCurve.prototype.constructor=THREE.QuadraticBezierCurve;
THREE.QuadraticBezierCurve.prototype.getPoint=function(b){var c;c=THREE.Shape.Utils.b2(b,this.v0.x,this.v1.x,this.v2.x);b=THREE.Shape.Utils.b2(b,this.v0.y,this.v1.y,this.v2.y);return new THREE.Vector2(c,b)};THREE.QuadraticBezierCurve.prototype.getTangent=function(b){var c;c=THREE.Curve.Utils.tangentQuadraticBezier(b,this.v0.x,this.v1.x,this.v2.x);b=THREE.Curve.Utils.tangentQuadraticBezier(b,this.v0.y,this.v1.y,this.v2.y);c=new THREE.Vector2(c,b);c.normalize();return c};
THREE.CubicBezierCurve=function(b,c,e,f){if(!(c instanceof THREE.Vector2))var h=Array.prototype.slice.call(arguments),b=new THREE.Vector2(h[0],h[1]),c=new THREE.Vector2(h[2],h[3]),e=new THREE.Vector2(h[4],h[5]),f=new THREE.Vector2(h[6],h[7]);this.v0=b;this.v1=c;this.v2=e;this.v3=f};THREE.CubicBezierCurve.prototype=new THREE.Curve;THREE.CubicBezierCurve.prototype.constructor=THREE.CubicBezierCurve;
THREE.CubicBezierCurve.prototype.getPoint=function(b){var c;c=THREE.Shape.Utils.b3(b,this.v0.x,this.v1.x,this.v2.x,this.v3.x);b=THREE.Shape.Utils.b3(b,this.v0.y,this.v1.y,this.v2.y,this.v3.y);return new THREE.Vector2(c,b)};THREE.CubicBezierCurve.prototype.getTangent=function(b){var c;c=THREE.Curve.Utils.tangentCubicBezier(b,this.v0.x,this.v1.x,this.v2.x,this.v3.x);b=THREE.Curve.Utils.tangentCubicBezier(b,this.v0.y,this.v1.y,this.v2.y,this.v3.y);c=new THREE.Vector2(c,b);c.normalize();return c};
THREE.SplineCurve=function(b){this.points=b};THREE.SplineCurve.prototype=new THREE.Curve;THREE.SplineCurve.prototype.constructor=THREE.SplineCurve;
THREE.SplineCurve.prototype.getPoint=function(b){var c=new THREE.Vector2,e=[],f=this.points,h;h=(f.length-1)*b;b=Math.floor(h);h-=b;e[0]=b==0?b:b-1;e[1]=b;e[2]=b>f.length-2?b:b+1;e[3]=b>f.length-3?b:b+2;c.x=THREE.Curve.Utils.interpolate(f[e[0]].x,f[e[1]].x,f[e[2]].x,f[e[3]].x,h);c.y=THREE.Curve.Utils.interpolate(f[e[0]].y,f[e[1]].y,f[e[2]].y,f[e[3]].y,h);return c};THREE.ArcCurve=function(b,c,e,f,h,m){this.aX=b;this.aY=c;this.aRadius=e;this.aStartAngle=f;this.aEndAngle=h;this.aClockwise=m};
THREE.ArcCurve.prototype=new THREE.Curve;THREE.ArcCurve.prototype.constructor=THREE.ArcCurve;THREE.ArcCurve.prototype.getPoint=function(b){var c=this.aEndAngle-this.aStartAngle;this.aClockwise||(b=1-b);b=this.aStartAngle+b*c;return new THREE.Vector2(this.aX+this.aRadius*Math.cos(b),this.aY+this.aRadius*Math.sin(b))};
THREE.Curve.Utils={tangentQuadraticBezier:function(b,c,e,f){return 2*(1-b)*(e-c)+2*b*(f-e)},tangentCubicBezier:function(b,c,e,f,h){return-3*c*(1-b)*(1-b)+3*e*(1-b)*(1-b)-6*b*e*(1-b)+6*b*f*(1-b)-3*b*b*f+3*b*b*h},tangentSpline:function(b){return 6*b*b-6*b+(3*b*b-4*b+1)+(-6*b*b+6*b)+(3*b*b-2*b)},interpolate:function(b,c,e,f,h){var b=(e-b)*0.5,f=(f-c)*0.5,m=h*h;return(2*c-2*e+b+f)*h*m+(-3*c+3*e-2*b-f)*m+b*h+c}};
THREE.Curve.create=function(b,c){b.prototype=new THREE.Curve;b.prototype.constructor=b;b.prototype.getPoint=c;return b};THREE.LineCurve3=THREE.Curve.create(function(b,c){this.v1=b;this.v2=c},function(b){var c=new THREE.Vector3;c.sub(v2,v1);c.multiplyScalar(b);c.addSelf(this.v1);return c});
THREE.QuadraticBezierCurve3=THREE.Curve.create(function(b,c,e){this.v0=b;this.v1=c;this.v2=e},function(b){var c,e;c=THREE.Shape.Utils.b2(b,this.v0.x,this.v1.x,this.v2.x);e=THREE.Shape.Utils.b2(b,this.v0.y,this.v1.y,this.v2.y);b=THREE.Shape.Utils.b2(b,this.v0.z,this.v1.z,this.v2.z);return new THREE.Vector3(c,e,b)});THREE.CurvePath=function(){this.curves=[];this.bends=[]};THREE.CurvePath.prototype=new THREE.Curve;THREE.CurvePath.prototype.constructor=THREE.CurvePath;THREE.CurvePath.prototype.add=function(b){this.curves.push(b)};
THREE.CurvePath.prototype.checkConnection=function(){};THREE.CurvePath.prototype.closePath=function(){};THREE.CurvePath.prototype.getPoint=function(b){for(var c=b*this.getLength(),e=this.getCurveLengths(),b=0;b<e.length;){if(e[b]>=c)return c=e[b]-c,b=this.curves[b],c=1-c/b.getLength(),b.getPointAt(c);b++}return null};THREE.CurvePath.prototype.getLength=function(){var b=this.getCurveLengths();return b[b.length-1]};
THREE.CurvePath.prototype.getCurveLengths=function(){if(this.cacheLengths&&this.cacheLengths.length==this.curves.length)return this.cacheLengths;var b=[],c=0,e,f=this.curves.length;for(e=0;e<f;e++)c+=this.curves[e].getLength(),b.push(c);return this.cacheLengths=b};
THREE.CurvePath.prototype.getBoundingBox=function(){var b=this.getPoints(),c,e,f,h;c=e=Number.NEGATIVE_INFINITY;f=h=Number.POSITIVE_INFINITY;var m,k,n,u;u=new THREE.Vector2;k=0;for(n=b.length;k<n;k++){m=b[k];if(m.x>c)c=m.x;else if(m.x<f)f=m.x;if(m.y>e)e=m.y;else if(m.y<e)h=m.y;u.addSelf(m.x,m.y)}return{minX:f,minY:h,maxX:c,maxY:e,centroid:u.divideScalar(n)}};THREE.CurvePath.prototype.createPointsGeometry=function(b){return this.createGeometry(this.getPoints(b,!0))};
THREE.CurvePath.prototype.createSpacedPointsGeometry=function(b){return this.createGeometry(this.getSpacedPoints(b,!0))};THREE.CurvePath.prototype.createGeometry=function(b){for(var c=new THREE.Geometry,e=0;e<b.length;e++)c.vertices.push(new THREE.Vertex(new THREE.Vector3(b[e].x,b[e].y,0)));return c};THREE.CurvePath.prototype.addWrapPath=function(b){this.bends.push(b)};
THREE.CurvePath.prototype.getTransformedPoints=function(b,c){var e=this.getPoints(b),f,h;if(!c)c=this.bends;f=0;for(h=c.length;f<h;f++)e=this.getWrapPoints(e,c[f]);return e};THREE.CurvePath.prototype.getTransformedSpacedPoints=function(b,c){var e=this.getSpacedPoints(b),f,h;if(!c)c=this.bends;f=0;for(h=c.length;f<h;f++)e=this.getWrapPoints(e,c[f]);return e};
THREE.CurvePath.prototype.getWrapPoints=function(b,c){var e=this.getBoundingBox(),f,h,m,k,n,u;f=0;for(h=b.length;f<h;f++)m=b[f],k=m.x,n=m.y,u=k/e.maxX,u=c.getUtoTmapping(u,k),k=c.getPoint(u),n=c.getNormalVector(u).multiplyScalar(n),m.x=k.x+n.x,m.y=k.y+n.y;return b};THREE.Path=function(b){THREE.CurvePath.call(this);this.actions=[];b&&this.fromPoints(b)};THREE.Path.prototype=new THREE.CurvePath;THREE.Path.prototype.constructor=THREE.Path;
THREE.PathActions={MOVE_TO:"moveTo",LINE_TO:"lineTo",QUADRATIC_CURVE_TO:"quadraticCurveTo",BEZIER_CURVE_TO:"bezierCurveTo",CSPLINE_THRU:"splineThru",ARC:"arc"};THREE.Path.prototype.fromPoints=function(b){this.moveTo(b[0].x,b[0].y);var c,e=b.length;for(c=1;c<e;c++)this.lineTo(b[c].x,b[c].y)};THREE.Path.prototype.moveTo=function(){var b=Array.prototype.slice.call(arguments);this.actions.push({action:THREE.PathActions.MOVE_TO,args:b})};
THREE.Path.prototype.lineTo=function(b,c){var e=Array.prototype.slice.call(arguments),f=this.actions[this.actions.length-1].args;this.curves.push(new THREE.LineCurve(new THREE.Vector2(f[f.length-2],f[f.length-1]),new THREE.Vector2(b,c)));this.actions.push({action:THREE.PathActions.LINE_TO,args:e})};
THREE.Path.prototype.quadraticCurveTo=function(b,c,e,f){var h=Array.prototype.slice.call(arguments),m=this.actions[this.actions.length-1].args;this.curves.push(new THREE.QuadraticBezierCurve(new THREE.Vector2(m[m.length-2],m[m.length-1]),new THREE.Vector2(b,c),new THREE.Vector2(e,f)));this.actions.push({action:THREE.PathActions.QUADRATIC_CURVE_TO,args:h})};
THREE.Path.prototype.bezierCurveTo=function(b,c,e,f,h,m){var k=Array.prototype.slice.call(arguments),n=this.actions[this.actions.length-1].args;this.curves.push(new THREE.CubicBezierCurve(new THREE.Vector2(n[n.length-2],n[n.length-1]),new THREE.Vector2(b,c),new THREE.Vector2(e,f),new THREE.Vector2(h,m)));this.actions.push({action:THREE.PathActions.BEZIER_CURVE_TO,args:k})};
THREE.Path.prototype.splineThru=function(b){var c=Array.prototype.slice.call(arguments),e=this.actions[this.actions.length-1].args,e=[new THREE.Vector2(e[e.length-2],e[e.length-1])],e=e.concat(b);this.curves.push(new THREE.SplineCurve(e));this.actions.push({action:THREE.PathActions.CSPLINE_THRU,args:c})};THREE.Path.prototype.arc=function(b,c,e,f,h,m){var k=Array.prototype.slice.call(arguments);this.curves.push(new THREE.ArcCurve(b,c,e,f,h,m));this.actions.push({action:THREE.PathActions.ARC,args:k})};
THREE.Path.prototype.getSpacedPoints=function(b){b||(b=40);for(var c=[],e=0;e<b;e++)c.push(this.getPoint(e/b));return c};
THREE.Path.prototype.getPoints=function(b,c){var b=b||12,e=[],f,h,m,k,n,u,p,v,t,x,w,z,y;f=0;for(h=this.actions.length;f<h;f++)switch(m=this.actions[f],k=m.action,m=m.args,k){case THREE.PathActions.LINE_TO:e.push(new THREE.Vector2(m[0],m[1]));break;case THREE.PathActions.QUADRATIC_CURVE_TO:n=m[2];u=m[3];t=m[0];x=m[1];e.length>0?(k=e[e.length-1],w=k.x,z=k.y):(k=this.actions[f-1].args,w=k[k.length-2],z=k[k.length-1]);for(k=1;k<=b;k++)y=k/b,m=THREE.Shape.Utils.b2(y,w,t,n),y=THREE.Shape.Utils.b2(y,z,x,
u),e.push(new THREE.Vector2(m,y));break;case THREE.PathActions.BEZIER_CURVE_TO:n=m[4];u=m[5];t=m[0];x=m[1];p=m[2];v=m[3];e.length>0?(k=e[e.length-1],w=k.x,z=k.y):(k=this.actions[f-1].args,w=k[k.length-2],z=k[k.length-1]);for(k=1;k<=b;k++)y=k/b,m=THREE.Shape.Utils.b3(y,w,t,p,n),y=THREE.Shape.Utils.b3(y,z,x,v,u),e.push(new THREE.Vector2(m,y));break;case THREE.PathActions.CSPLINE_THRU:k=this.actions[f-1].args;k=[new THREE.Vector2(k[k.length-2],k[k.length-1])];y=b*m[0].length;k=k.concat(m[0]);m=new THREE.SplineCurve(k);
for(k=1;k<=y;k++)e.push(m.getPointAt(k/y));break;case THREE.PathActions.ARC:k=this.actions[f-1].args;n=m[0];u=m[1];p=m[2];t=m[3];y=m[4];x=!!m[5];v=k[k.length-2];w=k[k.length-1];k.length==0&&(v=w=0);z=y-t;var B=b*2;for(k=1;k<=B;k++)y=k/B,x||(y=1-y),y=t+y*z,m=v+n+p*Math.cos(y),y=w+u+p*Math.sin(y),e.push(new THREE.Vector2(m,y))}c&&e.push(e[0]);return e};THREE.Path.prototype.transform=function(b,c){this.getBoundingBox();return this.getWrapPoints(this.getPoints(c),b)};
THREE.Path.prototype.nltransform=function(b,c,e,f,h,m){var k=this.getPoints(),n,u,p,v,t;n=0;for(u=k.length;n<u;n++)p=k[n],v=p.x,t=p.y,p.x=b*v+c*t+e,p.y=f*t+h*v+m;return k};
THREE.Path.prototype.debug=function(b){var c=this.getBoundingBox();b||(b=document.createElement("canvas"),b.setAttribute("width",c.maxX+100),b.setAttribute("height",c.maxY+100),document.body.appendChild(b));c=b.getContext("2d");c.fillStyle="white";c.fillRect(0,0,b.width,b.height);c.strokeStyle="black";c.beginPath();var e,f,h,b=0;for(e=this.actions.length;b<e;b++)f=this.actions[b],h=f.args,f=f.action,f!=THREE.PathActions.CSPLINE_THRU&&c[f].apply(c,h);c.stroke();c.closePath();c.strokeStyle="red";f=
this.getPoints();b=0;for(e=f.length;b<e;b++)h=f[b],c.beginPath(),c.arc(h.x,h.y,1.5,0,Math.PI*2,!1),c.stroke(),c.closePath()};
THREE.Path.prototype.toShapes=function(){var b,c,e,f,h=[],m=new THREE.Path;b=0;for(c=this.actions.length;b<c;b++)e=this.actions[b],f=e.args,e=e.action,e==THREE.PathActions.MOVE_TO&&m.actions.length!=0&&(h.push(m),m=new THREE.Path),m[e].apply(m,f);m.actions.length!=0&&h.push(m);if(h.length==0)return[];var k,m=[];if(THREE.Shape.Utils.isClockWise(h[0].getPoints())){b=0;for(c=h.length;b<c;b++)f=h[b],THREE.Shape.Utils.isClockWise(f.getPoints())?(k&&m.push(k),k=new THREE.Shape,k.actions=f.actions,k.curves=
f.curves):k.holes.push(f);m.push(k)}else{k=new THREE.Shape;b=0;for(c=h.length;b<c;b++)f=h[b],THREE.Shape.Utils.isClockWise(f.getPoints())?(k.actions=f.actions,k.curves=f.curves,m.push(k),k=new THREE.Shape):k.holes.push(f)}return m};THREE.Shape=function(){THREE.Path.apply(this,arguments);this.holes=[]};THREE.Shape.prototype=new THREE.Path;THREE.Shape.prototype.constructor=THREE.Path;THREE.Shape.prototype.extrude=function(b){return new THREE.ExtrudeGeometry(this,b)};
THREE.Shape.prototype.getPointsHoles=function(b){var c,e=this.holes.length,f=[];for(c=0;c<e;c++)f[c]=this.holes[c].getTransformedPoints(b,this.bends);return f};THREE.Shape.prototype.getSpacedPointsHoles=function(b){var c,e=this.holes.length,f=[];for(c=0;c<e;c++)f[c]=this.holes[c].getTransformedSpacedPoints(b,this.bends);return f};THREE.Shape.prototype.extractAllPoints=function(b){return{shape:this.getTransformedPoints(b),holes:this.getPointsHoles(b)}};
THREE.Shape.prototype.extractAllSpacedPoints=function(b){return{shape:this.getTransformedSpacedPoints(b),holes:this.getSpacedPointsHoles(b)}};
THREE.Shape.Utils={removeHoles:function(b,c){var e=b.concat(),f=e.concat(),h,m,k,n,u,p,v,t,x,w,z=[];for(u=0;u<c.length;u++){p=c[u];f=f.concat(p);m=Number.POSITIVE_INFINITY;for(h=0;h<p.length;h++){x=p[h];w=[];for(t=0;t<e.length;t++)v=e[t],v=x.distanceToSquared(v),w.push(v),v<m&&(m=v,k=h,n=t)}h=n-1>=0?n-1:e.length-1;m=k-1>=0?k-1:p.length-1;var y=[p[k],e[n],e[h]];t=THREE.FontUtils.Triangulate.area(y);var B=[p[k],p[m],e[n]];x=THREE.FontUtils.Triangulate.area(B);w=n;v=k;n+=1;k+=-1;n<0&&(n+=e.length);n%=
e.length;k<0&&(k+=p.length);k%=p.length;h=n-1>=0?n-1:e.length-1;m=k-1>=0?k-1:p.length-1;y=[p[k],e[n],e[h]];y=THREE.FontUtils.Triangulate.area(y);B=[p[k],p[m],e[n]];B=THREE.FontUtils.Triangulate.area(B);t+x>y+B&&(n=w,k=v,n<0&&(n+=e.length),n%=e.length,k<0&&(k+=p.length),k%=p.length,h=n-1>=0?n-1:e.length-1,m=k-1>=0?k-1:p.length-1);t=e.slice(0,n);x=e.slice(n);w=p.slice(k);v=p.slice(0,k);m=[p[k],p[m],e[n]];z.push([p[k],e[n],e[h]]);z.push(m);e=t.concat(w).concat(v).concat(x)}return{shape:e,isolatedPts:z,
allpoints:f}},triangulateShape:function(b,c){var e=THREE.Shape.Utils.removeHoles(b,c),f=e.allpoints,h=e.isolatedPts,e=THREE.FontUtils.Triangulate(e.shape,!1),m,k,n,u,p={};m=0;for(k=f.length;m<k;m++)u=f[m].x+":"+f[m].y,p[u]!==void 0&&console.log("Duplicate point",u),p[u]=m;m=0;for(k=e.length;m<k;m++){n=e[m];for(f=0;f<3;f++)u=n[f].x+":"+n[f].y,u=p[u],u!==void 0&&(n[f]=u)}m=0;for(k=h.length;m<k;m++){n=h[m];for(f=0;f<3;f++)u=n[f].x+":"+n[f].y,u=p[u],u!==void 0&&(n[f]=u)}return e.concat(h)},isClockWise:function(b){return THREE.FontUtils.Triangulate.area(b)<
0},b2p0:function(b,c){var e=1-b;return e*e*c},b2p1:function(b,c){return 2*(1-b)*b*c},b2p2:function(b,c){return b*b*c},b2:function(b,c,e,f){return this.b2p0(b,c)+this.b2p1(b,e)+this.b2p2(b,f)},b3p0:function(b,c){var e=1-b;return e*e*e*c},b3p1:function(b,c){var e=1-b;return 3*e*e*b*c},b3p2:function(b,c){return 3*(1-b)*b*b*c},b3p3:function(b,c){return b*b*b*c},b3:function(b,c,e,f,h){return this.b3p0(b,c)+this.b3p1(b,e)+this.b3p2(b,f)+this.b3p3(b,h)}};
THREE.TextPath=function(b,c){THREE.Path.call(this);this.parameters=c||{};this.set(b)};THREE.TextPath.prototype.set=function(b,c){this.text=b;var c=c||this.parameters,e=c.curveSegments!==void 0?c.curveSegments:4,f=c.font!==void 0?c.font:"helvetiker",h=c.weight!==void 0?c.weight:"normal",m=c.style!==void 0?c.style:"normal";THREE.FontUtils.size=c.size!==void 0?c.size:100;THREE.FontUtils.divisions=e;THREE.FontUtils.face=f;THREE.FontUtils.weight=h;THREE.FontUtils.style=m};
THREE.TextPath.prototype.toShapes=function(){for(var b=THREE.FontUtils.drawText(this.text).paths,c=[],e=0,f=b.length;e<f;e++)c=c.concat(b[e].toShapes());return c};
THREE.AnimationHandler=function(){var b=[],c={},e={update:function(e){for(var c=0;c<b.length;c++)b[c].update(e)},addToUpdate:function(e){b.indexOf(e)===-1&&b.push(e)},removeFromUpdate:function(e){e=b.indexOf(e);e!==-1&&b.splice(e,1)},add:function(b){c[b.name]!==void 0&&console.log("THREE.AnimationHandler.add: Warning! "+b.name+" already exists in library. Overwriting.");c[b.name]=b;if(b.initialized!==!0){for(var e=0;e<b.hierarchy.length;e++){for(var f=0;f<b.hierarchy[e].keys.length;f++){if(b.hierarchy[e].keys[f].time<
0)b.hierarchy[e].keys[f].time=0;if(b.hierarchy[e].keys[f].rot!==void 0&&!(b.hierarchy[e].keys[f].rot instanceof THREE.Quaternion)){var n=b.hierarchy[e].keys[f].rot;b.hierarchy[e].keys[f].rot=new THREE.Quaternion(n[0],n[1],n[2],n[3])}}if(b.hierarchy[e].keys[0].morphTargets!==void 0){n={};for(f=0;f<b.hierarchy[e].keys.length;f++)for(var u=0;u<b.hierarchy[e].keys[f].morphTargets.length;u++){var p=b.hierarchy[e].keys[f].morphTargets[u];n[p]=-1}b.hierarchy[e].usedMorphTargets=n;for(f=0;f<b.hierarchy[e].keys.length;f++){var v=
{};for(p in n){for(u=0;u<b.hierarchy[e].keys[f].morphTargets.length;u++)if(b.hierarchy[e].keys[f].morphTargets[u]===p){v[p]=b.hierarchy[e].keys[f].morphTargetsInfluences[u];break}u===b.hierarchy[e].keys[f].morphTargets.length&&(v[p]=0)}b.hierarchy[e].keys[f].morphTargetsInfluences=v}}for(f=1;f<b.hierarchy[e].keys.length;f++)b.hierarchy[e].keys[f].time===b.hierarchy[e].keys[f-1].time&&(b.hierarchy[e].keys.splice(f,1),f--);for(f=1;f<b.hierarchy[e].keys.length;f++)b.hierarchy[e].keys[f].index=f}f=parseInt(b.length*
b.fps,10);b.JIT={};b.JIT.hierarchy=[];for(e=0;e<b.hierarchy.length;e++)b.JIT.hierarchy.push(Array(f));b.initialized=!0}},get:function(b){if(typeof b==="string")return c[b]?c[b]:(console.log("THREE.AnimationHandler.get: Couldn't find animation "+b),null)},parse:function(b){var e=[];if(b instanceof THREE.SkinnedMesh)for(var c=0;c<b.bones.length;c++)e.push(b.bones[c]);else f(b,e);return e}},f=function(b,e){e.push(b);for(var c=0;c<b.children.length;c++)f(b.children[c],e)};e.LINEAR=0;e.CATMULLROM=1;e.CATMULLROM_FORWARD=
2;return e}();THREE.Animation=function(b,c,e,f){this.root=b;this.data=THREE.AnimationHandler.get(c);this.hierarchy=THREE.AnimationHandler.parse(b);this.currentTime=0;this.timeScale=1;this.isPlaying=!1;this.loop=this.isPaused=!0;this.interpolationType=e!==void 0?e:THREE.AnimationHandler.LINEAR;this.JITCompile=f!==void 0?f:!0;this.points=[];this.target=new THREE.Vector3};
THREE.Animation.prototype.play=function(b,c){if(!this.isPlaying){this.isPlaying=!0;this.loop=b!==void 0?b:!0;this.currentTime=c!==void 0?c:0;var e,f=this.hierarchy.length,h;for(e=0;e<f;e++){h=this.hierarchy[e];if(this.interpolationType!==THREE.AnimationHandler.CATMULLROM_FORWARD)h.useQuaternion=!0;h.matrixAutoUpdate=!0;if(h.animationCache===void 0)h.animationCache={},h.animationCache.prevKey={pos:0,rot:0,scl:0},h.animationCache.nextKey={pos:0,rot:0,scl:0},h.animationCache.originalMatrix=h instanceof
THREE.Bone?h.skinMatrix:h.matrix;var m=h.animationCache.prevKey;h=h.animationCache.nextKey;m.pos=this.data.hierarchy[e].keys[0];m.rot=this.data.hierarchy[e].keys[0];m.scl=this.data.hierarchy[e].keys[0];h.pos=this.getNextKeyWith("pos",e,1);h.rot=this.getNextKeyWith("rot",e,1);h.scl=this.getNextKeyWith("scl",e,1)}this.update(0)}this.isPaused=!1;THREE.AnimationHandler.addToUpdate(this)};
THREE.Animation.prototype.pause=function(){this.isPaused?THREE.AnimationHandler.addToUpdate(this):THREE.AnimationHandler.removeFromUpdate(this);this.isPaused=!this.isPaused};
THREE.Animation.prototype.stop=function(){this.isPaused=this.isPlaying=!1;THREE.AnimationHandler.removeFromUpdate(this);for(var b=0;b<this.hierarchy.length;b++)if(this.hierarchy[b].animationCache!==void 0)this.hierarchy[b]instanceof THREE.Bone?this.hierarchy[b].skinMatrix=this.hierarchy[b].animationCache.originalMatrix:this.hierarchy[b].matrix=this.hierarchy[b].animationCache.originalMatrix,delete this.hierarchy[b].animationCache};
THREE.Animation.prototype.update=function(b){if(this.isPlaying){var c=["pos","rot","scl"],e,f,h,m,k,n,u,p,v=this.data.JIT.hierarchy,t,x;this.currentTime+=b*this.timeScale;x=this.currentTime;t=this.currentTime%=this.data.length;p=parseInt(Math.min(t*this.data.fps,this.data.length*this.data.fps),10);for(var w=0,z=this.hierarchy.length;w<z;w++)if(b=this.hierarchy[w],u=b.animationCache,this.JITCompile&&v[w][p]!==void 0)b instanceof THREE.Bone?(b.skinMatrix=v[w][p],b.matrixAutoUpdate=!1,b.matrixWorldNeedsUpdate=
!1):(b.matrix=v[w][p],b.matrixAutoUpdate=!1,b.matrixWorldNeedsUpdate=!0);else{if(this.JITCompile)b instanceof THREE.Bone?b.skinMatrix=b.animationCache.originalMatrix:b.matrix=b.animationCache.originalMatrix;for(var y=0;y<3;y++){e=c[y];k=u.prevKey[e];n=u.nextKey[e];if(n.time<=x){if(t<x)if(this.loop){k=this.data.hierarchy[w].keys[0];for(n=this.getNextKeyWith(e,w,1);n.time<t;)k=n,n=this.getNextKeyWith(e,w,n.index+1)}else{this.stop();return}else{do k=n,n=this.getNextKeyWith(e,w,n.index+1);while(n.time<
t)}u.prevKey[e]=k;u.nextKey[e]=n}b.matrixAutoUpdate=!0;b.matrixWorldNeedsUpdate=!0;f=(t-k.time)/(n.time-k.time);h=k[e];m=n[e];if(f<0||f>1)console.log("THREE.Animation.update: Warning! Scale out of bounds:"+f+" on bone "+w),f=f<0?0:1;if(e==="pos")if(e=b.position,this.interpolationType===THREE.AnimationHandler.LINEAR)e.x=h[0]+(m[0]-h[0])*f,e.y=h[1]+(m[1]-h[1])*f,e.z=h[2]+(m[2]-h[2])*f;else{if(this.interpolationType===THREE.AnimationHandler.CATMULLROM||this.interpolationType===THREE.AnimationHandler.CATMULLROM_FORWARD)if(this.points[0]=
this.getPrevKeyWith("pos",w,k.index-1).pos,this.points[1]=h,this.points[2]=m,this.points[3]=this.getNextKeyWith("pos",w,n.index+1).pos,f=f*0.33+0.33,h=this.interpolateCatmullRom(this.points,f),e.x=h[0],e.y=h[1],e.z=h[2],this.interpolationType===THREE.AnimationHandler.CATMULLROM_FORWARD)f=this.interpolateCatmullRom(this.points,f*1.01),this.target.set(f[0],f[1],f[2]),this.target.subSelf(e),this.target.y=0,this.target.normalize(),f=Math.atan2(this.target.x,this.target.z),b.rotation.set(0,f,0)}else if(e===
"rot")THREE.Quaternion.slerp(h,m,b.quaternion,f);else if(e==="scl")e=b.scale,e.x=h[0]+(m[0]-h[0])*f,e.y=h[1]+(m[1]-h[1])*f,e.z=h[2]+(m[2]-h[2])*f}}if(this.JITCompile&&v[0][p]===void 0){this.hierarchy[0].update(void 0,!0);for(w=0;w<this.hierarchy.length;w++)v[w][p]=this.hierarchy[w]instanceof THREE.Bone?this.hierarchy[w].skinMatrix.clone():this.hierarchy[w].matrix.clone()}}};
THREE.Animation.prototype.interpolateCatmullRom=function(b,c){var e=[],f=[],h,m,k,n,u,p;h=(b.length-1)*c;m=Math.floor(h);h-=m;e[0]=m==0?m:m-1;e[1]=m;e[2]=m>b.length-2?m:m+1;e[3]=m>b.length-3?m:m+2;m=b[e[0]];n=b[e[1]];u=b[e[2]];p=b[e[3]];e=h*h;k=h*e;f[0]=this.interpolate(m[0],n[0],u[0],p[0],h,e,k);f[1]=this.interpolate(m[1],n[1],u[1],p[1],h,e,k);f[2]=this.interpolate(m[2],n[2],u[2],p[2],h,e,k);return f};
THREE.Animation.prototype.interpolate=function(b,c,e,f,h,m,k){b=(e-b)*0.5;f=(f-c)*0.5;return(2*(c-e)+b+f)*k+(-3*(c-e)-2*b-f)*m+b*h+c};THREE.Animation.prototype.getNextKeyWith=function(b,c,e){var f=this.data.hierarchy[c].keys;for(this.interpolationType===THREE.AnimationHandler.CATMULLROM||this.interpolationType===THREE.AnimationHandler.CATMULLROM_FORWARD?e=e<f.length-1?e:f.length-1:e%=f.length;e<f.length;e++)if(f[e][b]!==void 0)return f[e];return this.data.hierarchy[c].keys[0]};
THREE.Animation.prototype.getPrevKeyWith=function(b,c,e){for(var f=this.data.hierarchy[c].keys,e=this.interpolationType===THREE.AnimationHandler.CATMULLROM||this.interpolationType===THREE.AnimationHandler.CATMULLROM_FORWARD?e>0?e:0:e>=0?e:e+f.length;e>=0;e--)if(f[e][b]!==void 0)return f[e];return this.data.hierarchy[c].keys[f.length-1]};
THREE.FirstPersonCamera=function(b){function c(b,c){return function(){c.apply(b,arguments)}}THREE.Camera.call(this,b.fov,b.aspect,b.near,b.far,b.target);this.movementSpeed=1;this.lookSpeed=0.005;this.noFly=!1;this.lookVertical=!0;this.autoForward=!1;this.activeLook=!0;this.heightSpeed=!1;this.heightCoef=1;this.heightMin=0;this.constrainVertical=!1;this.verticalMin=0;this.verticalMax=3.14;this.domElement=document;this.lastUpdate=(new Date).getTime();this.tdiff=0;if(b){if(b.movementSpeed!==void 0)this.movementSpeed=
b.movementSpeed;if(b.lookSpeed!==void 0)this.lookSpeed=b.lookSpeed;if(b.noFly!==void 0)this.noFly=b.noFly;if(b.lookVertical!==void 0)this.lookVertical=b.lookVertical;if(b.autoForward!==void 0)this.autoForward=b.autoForward;if(b.activeLook!==void 0)this.activeLook=b.activeLook;if(b.heightSpeed!==void 0)this.heightSpeed=b.heightSpeed;if(b.heightCoef!==void 0)this.heightCoef=b.heightCoef;if(b.heightMin!==void 0)this.heightMin=b.heightMin;if(b.heightMax!==void 0)this.heightMax=b.heightMax;if(b.constrainVertical!==
void 0)this.constrainVertical=b.constrainVertical;if(b.verticalMin!==void 0)this.verticalMin=b.verticalMin;if(b.verticalMax!==void 0)this.verticalMax=b.verticalMax;if(b.domElement!==void 0)this.domElement=b.domElement}this.theta=this.phi=this.lon=this.lat=this.mouseY=this.mouseX=this.autoSpeedFactor=0;this.mouseDragOn=this.freeze=this.moveRight=this.moveLeft=this.moveBackward=this.moveForward=!1;this.windowHalfX=window.innerWidth/2;this.windowHalfY=window.innerHeight/2;this.onMouseDown=function(b){b.preventDefault();
b.stopPropagation();if(this.activeLook)switch(b.button){case 0:this.moveForward=!0;break;case 2:this.moveBackward=!0}this.mouseDragOn=!0};this.onMouseUp=function(b){b.preventDefault();b.stopPropagation();if(this.activeLook)switch(b.button){case 0:this.moveForward=!1;break;case 2:this.moveBackward=!1}this.mouseDragOn=!1};this.onMouseMove=function(b){this.mouseX=b.clientX-this.windowHalfX;this.mouseY=b.clientY-this.windowHalfY};this.onKeyDown=function(b){switch(b.keyCode){case 38:case 87:this.moveForward=
!0;break;case 37:case 65:this.moveLeft=!0;break;case 40:case 83:this.moveBackward=!0;break;case 39:case 68:this.moveRight=!0;break;case 82:this.moveUp=!0;break;case 70:this.moveDown=!0;break;case 81:this.freeze=!this.freeze}};this.onKeyUp=function(b){switch(b.keyCode){case 38:case 87:this.moveForward=!1;break;case 37:case 65:this.moveLeft=!1;break;case 40:case 83:this.moveBackward=!1;break;case 39:case 68:this.moveRight=!1;break;case 82:this.moveUp=!1;break;case 70:this.moveDown=!1}};this.update=
function(){var b=(new Date).getTime();this.tdiff=(b-this.lastUpdate)/1E3;this.lastUpdate=b;if(!this.freeze){this.autoSpeedFactor=this.heightSpeed?this.tdiff*((this.position.y<this.heightMin?this.heightMin:this.position.y>this.heightMax?this.heightMax:this.position.y)-this.heightMin)*this.heightCoef:0;var c=this.tdiff*this.movementSpeed;(this.moveForward||this.autoForward&&!this.moveBackward)&&this.translateZ(-(c+this.autoSpeedFactor));this.moveBackward&&this.translateZ(c);this.moveLeft&&this.translateX(-c);
this.moveRight&&this.translateX(c);this.moveUp&&this.translateY(c);this.moveDown&&this.translateY(-c);c=this.tdiff*this.lookSpeed;this.activeLook||(c=0);this.lon+=this.mouseX*c;this.lookVertical&&(this.lat-=this.mouseY*c);this.lat=Math.max(-85,Math.min(85,this.lat));this.phi=(90-this.lat)*Math.PI/180;this.theta=this.lon*Math.PI/180;var b=this.target.position,h=this.position;b.x=h.x+100*Math.sin(this.phi)*Math.cos(this.theta);b.y=h.y+100*Math.cos(this.phi);b.z=h.z+100*Math.sin(this.phi)*Math.sin(this.theta)}b=
1;this.constrainVertical&&(b=3.14/(this.verticalMax-this.verticalMin));this.lon+=this.mouseX*c;this.lookVertical&&(this.lat-=this.mouseY*c*b);this.lat=Math.max(-85,Math.min(85,this.lat));this.phi=(90-this.lat)*Math.PI/180;this.theta=this.lon*Math.PI/180;if(this.constrainVertical)this.phi=(this.phi-0)*(this.verticalMax-this.verticalMin)/3.14+this.verticalMin;b=this.target.position;h=this.position;b.x=h.x+100*Math.sin(this.phi)*Math.cos(this.theta);b.y=h.y+100*Math.cos(this.phi);b.z=h.z+100*Math.sin(this.phi)*
Math.sin(this.theta);this.supr.update.call(this)};this.domElement.addEventListener("contextmenu",function(b){b.preventDefault()},!1);this.domElement.addEventListener("mousemove",c(this,this.onMouseMove),!1);this.domElement.addEventListener("mousedown",c(this,this.onMouseDown),!1);this.domElement.addEventListener("mouseup",c(this,this.onMouseUp),!1);this.domElement.addEventListener("keydown",c(this,this.onKeyDown),!1);this.domElement.addEventListener("keyup",c(this,this.onKeyUp),!1)};
THREE.FirstPersonCamera.prototype=new THREE.Camera;THREE.FirstPersonCamera.prototype.constructor=THREE.FirstPersonCamera;THREE.FirstPersonCamera.prototype.supr=THREE.Camera.prototype;THREE.FirstPersonCamera.prototype.translate=function(b,c){this.matrix.rotateAxis(c);if(this.noFly)c.y=0;this.position.addSelf(c.multiplyScalar(b));this.target.position.addSelf(c.multiplyScalar(b))};
THREE.PathCamera=function(b){function c(b,e,c,f){var k={name:c,fps:0.6,length:f,hierarchy:[]},h,m=e.getControlPointsArray(),n=e.getLength(),u=m.length,G=0;h=u-1;e={parent:-1,keys:[]};e.keys[0]={time:0,pos:m[0],rot:[0,0,0,1],scl:[1,1,1]};e.keys[h]={time:f,pos:m[h],rot:[0,0,0,1],scl:[1,1,1]};for(h=1;h<u-1;h++)G=f*n.chunks[h]/n.total,e.keys[h]={time:G,pos:m[h]};k.hierarchy[0]=e;THREE.AnimationHandler.add(k);return new THREE.Animation(b,c,THREE.AnimationHandler.CATMULLROM_FORWARD,!1)}function e(b,e){var c,
f,k=new THREE.Geometry;for(c=0;c<b.points.length*e;c++)f=c/(b.points.length*e),f=b.getPoint(f),k.vertices[c]=new THREE.Vertex(new THREE.Vector3(f.x,f.y,f.z));return k}function f(b,c){var f=e(c,10),k=e(c,10),h=new THREE.LineBasicMaterial({color:16711680,linewidth:3});lineObj=new THREE.Line(f,h);particleObj=new THREE.ParticleSystem(k,new THREE.ParticleBasicMaterial({color:16755200,size:3}));lineObj.scale.set(1,1,1);b.addChild(lineObj);particleObj.scale.set(1,1,1);b.addChild(particleObj);k=new THREE.SphereGeometry(1,
16,8);h=new THREE.MeshBasicMaterial({color:65280});for(i=0;i<c.points.length;i++)f=new THREE.Mesh(k,h),f.position.copy(c.points[i]),f.updateMatrix(),b.addChild(f)}THREE.Camera.call(this,b.fov,b.aspect,b.near,b.far,b.target);this.id="PathCamera"+THREE.PathCameraIdCounter++;this.duration=1E4;this.waypoints=[];this.useConstantSpeed=!0;this.resamplingCoef=50;this.debugPath=new THREE.Object3D;this.debugDummy=new THREE.Object3D;this.animationParent=new THREE.Object3D;this.lookSpeed=0.005;this.lookHorizontal=
this.lookVertical=!0;this.verticalAngleMap={srcRange:[0,6.28],dstRange:[0,6.28]};this.horizontalAngleMap={srcRange:[0,6.28],dstRange:[0,6.28]};this.domElement=document;if(b){if(b.duration!==void 0)this.duration=b.duration*1E3;if(b.waypoints!==void 0)this.waypoints=b.waypoints;if(b.useConstantSpeed!==void 0)this.useConstantSpeed=b.useConstantSpeed;if(b.resamplingCoef!==void 0)this.resamplingCoef=b.resamplingCoef;if(b.createDebugPath!==void 0)this.createDebugPath=b.createDebugPath;if(b.createDebugDummy!==
void 0)this.createDebugDummy=b.createDebugDummy;if(b.lookSpeed!==void 0)this.lookSpeed=b.lookSpeed;if(b.lookVertical!==void 0)this.lookVertical=b.lookVertical;if(b.lookHorizontal!==void 0)this.lookHorizontal=b.lookHorizontal;if(b.verticalAngleMap!==void 0)this.verticalAngleMap=b.verticalAngleMap;if(b.horizontalAngleMap!==void 0)this.horizontalAngleMap=b.horizontalAngleMap;if(b.domElement!==void 0)this.domElement=b.domElement}this.theta=this.phi=this.lon=this.lat=this.mouseY=this.mouseX=0;this.windowHalfX=
window.innerWidth/2;this.windowHalfY=window.innerHeight/2;var h=Math.PI*2,m=Math.PI/180;this.update=function(b,e,c){var f,k;this.lookHorizontal&&(this.lon+=this.mouseX*this.lookSpeed);this.lookVertical&&(this.lat-=this.mouseY*this.lookSpeed);this.lon=Math.max(0,Math.min(360,this.lon));this.lat=Math.max(-85,Math.min(85,this.lat));this.phi=(90-this.lat)*m;this.theta=this.lon*m;f=this.phi%h;this.phi=f>=0?f:f+h;f=this.verticalAngleMap.srcRange;k=this.verticalAngleMap.dstRange;var n=k[1]-k[0];this.phi=
TWEEN.Easing.Quadratic.EaseInOut(((this.phi-f[0])*(k[1]-k[0])/(f[1]-f[0])+k[0]-k[0])/n)*n+k[0];f=this.horizontalAngleMap.srcRange;k=this.horizontalAngleMap.dstRange;n=k[1]-k[0];this.theta=TWEEN.Easing.Quadratic.EaseInOut(((this.theta-f[0])*(k[1]-k[0])/(f[1]-f[0])+k[0]-k[0])/n)*n+k[0];f=this.target.position;f.x=100*Math.sin(this.phi)*Math.cos(this.theta);f.y=100*Math.cos(this.phi);f.z=100*Math.sin(this.phi)*Math.sin(this.theta);this.supr.update.call(this,b,e,c)};this.onMouseMove=function(b){this.mouseX=
b.clientX-this.windowHalfX;this.mouseY=b.clientY-this.windowHalfY};this.spline=new THREE.Spline;this.spline.initFromArray(this.waypoints);this.useConstantSpeed&&this.spline.reparametrizeByArcLength(this.resamplingCoef);if(this.createDebugDummy){var b=new THREE.MeshLambertMaterial({color:30719}),k=new THREE.MeshLambertMaterial({color:65280}),n=new THREE.CubeGeometry(10,10,20),u=new THREE.CubeGeometry(2,2,10);this.animationParent=new THREE.Mesh(n,b);b=new THREE.Mesh(u,k);b.position.set(0,10,0);this.animation=
c(this.animationParent,this.spline,this.id,this.duration);this.animationParent.addChild(this);this.animationParent.addChild(this.target);this.animationParent.addChild(b)}else this.animation=c(this.animationParent,this.spline,this.id,this.duration),this.animationParent.addChild(this.target),this.animationParent.addChild(this);this.createDebugPath&&f(this.debugPath,this.spline);this.domElement.addEventListener("mousemove",function(b,e){return function(){e.apply(b,arguments)}}(this,this.onMouseMove),
!1)};THREE.PathCamera.prototype=new THREE.Camera;THREE.PathCamera.prototype.constructor=THREE.PathCamera;THREE.PathCamera.prototype.supr=THREE.Camera.prototype;THREE.PathCameraIdCounter=0;
THREE.FlyCamera=function(b){function c(b,c){return function(){c.apply(b,arguments)}}THREE.Camera.call(this,b.fov,b.aspect,b.near,b.far,b.target);this.tmpQuaternion=new THREE.Quaternion;this.movementSpeed=1;this.rollSpeed=0.005;this.autoForward=this.dragToLook=!1;this.domElement=document;if(b){if(b.movementSpeed!==void 0)this.movementSpeed=b.movementSpeed;if(b.rollSpeed!==void 0)this.rollSpeed=b.rollSpeed;if(b.dragToLook!==void 0)this.dragToLook=b.dragToLook;if(b.autoForward!==void 0)this.autoForward=
b.autoForward;if(b.domElement!==void 0)this.domElement=b.domElement}this.useTarget=!1;this.useQuaternion=!0;this.mouseStatus=0;this.moveState={up:0,down:0,left:0,right:0,forward:0,back:0,pitchUp:0,pitchDown:0,yawLeft:0,yawRight:0,rollLeft:0,rollRight:0};this.moveVector=new THREE.Vector3(0,0,0);this.rotationVector=new THREE.Vector3(0,0,0);this.lastUpdate=-1;this.tdiff=0;this.handleEvent=function(b){if(typeof this[b.type]=="function")this[b.type](b)};this.keydown=function(b){if(!b.altKey){switch(b.keyCode){case 16:this.movementSpeedMultiplier=
0.1;break;case 87:this.moveState.forward=1;break;case 83:this.moveState.back=1;break;case 65:this.moveState.left=1;break;case 68:this.moveState.right=1;break;case 82:this.moveState.up=1;break;case 70:this.moveState.down=1;break;case 38:this.moveState.pitchUp=1;break;case 40:this.moveState.pitchDown=1;break;case 37:this.moveState.yawLeft=1;break;case 39:this.moveState.yawRight=1;break;case 81:this.moveState.rollLeft=1;break;case 69:this.moveState.rollRight=1}this.updateMovementVector();this.updateRotationVector()}};
this.keyup=function(b){switch(b.keyCode){case 16:this.movementSpeedMultiplier=1;break;case 87:this.moveState.forward=0;break;case 83:this.moveState.back=0;break;case 65:this.moveState.left=0;break;case 68:this.moveState.right=0;break;case 82:this.moveState.up=0;break;case 70:this.moveState.down=0;break;case 38:this.moveState.pitchUp=0;break;case 40:this.moveState.pitchDown=0;break;case 37:this.moveState.yawLeft=0;break;case 39:this.moveState.yawRight=0;break;case 81:this.moveState.rollLeft=0;break;
case 69:this.moveState.rollRight=0}this.updateMovementVector();this.updateRotationVector()};this.mousedown=function(b){b.preventDefault();b.stopPropagation();if(this.dragToLook)this.mouseStatus++;else switch(b.button){case 0:this.moveForward=!0;break;case 2:this.moveBackward=!0}};this.mousemove=function(b){if(!this.dragToLook||this.mouseStatus>0){var c=this.getContainerDimensions(),h=c.size[0]/2,m=c.size[1]/2;this.moveState.yawLeft=-(b.clientX-c.offset[0]-h)/h;this.moveState.pitchDown=(b.clientY-
c.offset[1]-m)/m;this.updateRotationVector()}};this.mouseup=function(b){b.preventDefault();b.stopPropagation();if(this.dragToLook)this.mouseStatus--,this.moveState.yawLeft=this.moveState.pitchDown=0;else switch(b.button){case 0:this.moveForward=!1;break;case 2:this.moveBackward=!1}this.updateRotationVector()};this.update=function(){var b=(new Date).getTime();if(this.lastUpdate==-1)this.lastUpdate=b;this.tdiff=(b-this.lastUpdate)/1E3;this.lastUpdate=b;var b=this.tdiff*this.movementSpeed,c=this.tdiff*
this.rollSpeed;this.translateX(this.moveVector.x*b);this.translateY(this.moveVector.y*b);this.translateZ(this.moveVector.z*b);this.tmpQuaternion.set(this.rotationVector.x*c,this.rotationVector.y*c,this.rotationVector.z*c,1).normalize();this.quaternion.multiplySelf(this.tmpQuaternion);this.matrix.setPosition(this.position);this.matrix.setRotationFromQuaternion(this.quaternion);this.matrixWorldNeedsUpdate=!0;this.supr.update.call(this)};this.updateMovementVector=function(){var b=this.moveState.forward||
this.autoForward&&!this.moveState.back?1:0;this.moveVector.x=-this.moveState.left+this.moveState.right;this.moveVector.y=-this.moveState.down+this.moveState.up;this.moveVector.z=-b+this.moveState.back};this.updateRotationVector=function(){this.rotationVector.x=-this.moveState.pitchDown+this.moveState.pitchUp;this.rotationVector.y=-this.moveState.yawRight+this.moveState.yawLeft;this.rotationVector.z=-this.moveState.rollRight+this.moveState.rollLeft};this.getContainerDimensions=function(){return this.domElement!=
document?{size:[this.domElement.offsetWidth,this.domElement.offsetHeight],offset:[this.domElement.offsetLeft,this.domElement.offsetTop]}:{size:[window.innerWidth,window.innerHeight],offset:[0,0]}};this.domElement.addEventListener("mousemove",c(this,this.mousemove),!1);this.domElement.addEventListener("mousedown",c(this,this.mousedown),!1);this.domElement.addEventListener("mouseup",c(this,this.mouseup),!1);window.addEventListener("keydown",c(this,this.keydown),!1);window.addEventListener("keyup",c(this,
this.keyup),!1);this.updateMovementVector();this.updateRotationVector()};THREE.FlyCamera.prototype=new THREE.Camera;THREE.FlyCamera.prototype.constructor=THREE.FlyCamera;THREE.FlyCamera.prototype.supr=THREE.Camera.prototype;
THREE.RollCamera=function(b,c,e,f){THREE.Camera.call(this,b,c,e,f);this.mouseLook=!0;this.autoForward=!1;this.rollSpeed=this.movementSpeed=this.lookSpeed=1;this.constrainVertical=[-0.9,0.9];this.domElement=document;this.matrixAutoUpdate=this.useTarget=!1;this.forward=new THREE.Vector3(0,0,1);this.roll=0;this.lastUpdate=-1;this.delta=0;var h=new THREE.Vector3,m=new THREE.Vector3,k=new THREE.Vector3,n=new THREE.Matrix4,u=!1,p=1,v=0,t=0,x=0,w=0,z=0,y=window.innerWidth/2,B=window.innerHeight/2;this.update=
function(){var b=(new Date).getTime();if(this.lastUpdate==-1)this.lastUpdate=b;this.delta=(b-this.lastUpdate)/1E3;this.lastUpdate=b;this.mouseLook&&(b=this.delta*this.lookSpeed,this.rotateHorizontally(b*w),this.rotateVertically(b*z));b=this.delta*this.movementSpeed;this.translateZ(b*(v>0||this.autoForward&&!(v<0)?1:v));this.translateX(b*t);this.translateY(b*x);u&&(this.roll+=this.rollSpeed*this.delta*p);if(this.forward.y>this.constrainVertical[1])this.forward.y=this.constrainVertical[1],this.forward.normalize();
else if(this.forward.y<this.constrainVertical[0])this.forward.y=this.constrainVertical[0],this.forward.normalize();k.copy(this.forward);m.set(0,1,0);h.cross(m,k).normalize();m.cross(k,h).normalize();this.matrix.n11=h.x;this.matrix.n12=m.x;this.matrix.n13=k.x;this.matrix.n21=h.y;this.matrix.n22=m.y;this.matrix.n23=k.y;this.matrix.n31=h.z;this.matrix.n32=m.z;this.matrix.n33=k.z;n.identity();n.n11=Math.cos(this.roll);n.n12=-Math.sin(this.roll);n.n21=Math.sin(this.roll);n.n22=Math.cos(this.roll);this.matrix.multiplySelf(n);
this.matrixWorldNeedsUpdate=!0;this.matrix.n14=this.position.x;this.matrix.n24=this.position.y;this.matrix.n34=this.position.z;this.supr.update.call(this)};this.translateX=function(b){this.position.x+=this.matrix.n11*b;this.position.y+=this.matrix.n21*b;this.position.z+=this.matrix.n31*b};this.translateY=function(b){this.position.x+=this.matrix.n12*b;this.position.y+=this.matrix.n22*b;this.position.z+=this.matrix.n32*b};this.translateZ=function(b){this.position.x-=this.matrix.n13*b;this.position.y-=
this.matrix.n23*b;this.position.z-=this.matrix.n33*b};this.rotateHorizontally=function(b){h.set(this.matrix.n11,this.matrix.n21,this.matrix.n31);h.multiplyScalar(b);this.forward.subSelf(h);this.forward.normalize()};this.rotateVertically=function(b){m.set(this.matrix.n12,this.matrix.n22,this.matrix.n32);m.multiplyScalar(b);this.forward.addSelf(m);this.forward.normalize()};this.domElement.addEventListener("contextmenu",function(b){b.preventDefault()},!1);this.domElement.addEventListener("mousemove",
function(b){w=(b.clientX-y)/window.innerWidth;z=(b.clientY-B)/window.innerHeight},!1);this.domElement.addEventListener("mousedown",function(b){b.preventDefault();b.stopPropagation();switch(b.button){case 0:v=1;break;case 2:v=-1}},!1);this.domElement.addEventListener("mouseup",function(b){b.preventDefault();b.stopPropagation();switch(b.button){case 0:v=0;break;case 2:v=0}},!1);this.domElement.addEventListener("keydown",function(b){switch(b.keyCode){case 38:case 87:v=1;break;case 37:case 65:t=-1;break;
case 40:case 83:v=-1;break;case 39:case 68:t=1;break;case 81:u=!0;p=1;break;case 69:u=!0;p=-1;break;case 82:x=1;break;case 70:x=-1}},!1);this.domElement.addEventListener("keyup",function(b){switch(b.keyCode){case 38:case 87:v=0;break;case 37:case 65:t=0;break;case 40:case 83:v=0;break;case 39:case 68:t=0;break;case 81:u=!1;break;case 69:u=!1;break;case 82:x=0;break;case 70:x=0}},!1)};THREE.RollCamera.prototype=new THREE.Camera;THREE.RollCamera.prototype.constructor=THREE.RollCamera;
THREE.RollCamera.prototype.supr=THREE.Camera.prototype;
THREE.TrackballCamera=function(b){function c(b,c){return function(){c.apply(b,arguments)}}b=b||{};THREE.Camera.call(this,b.fov,b.aspect,b.near,b.far,b.target);this.domElement=b.domElement||document;this.screen=b.screen||{width:window.innerWidth,height:window.innerHeight,offsetLeft:0,offsetTop:0};this.radius=b.radius||(this.screen.width+this.screen.height)/4;this.rotateSpeed=b.rotateSpeed||1;this.zoomSpeed=b.zoomSpeed||1.2;this.panSpeed=b.panSpeed||0.3;this.noZoom=b.noZoom||!1;this.noPan=b.noPan||
!1;this.staticMoving=b.staticMoving||!1;this.dynamicDampingFactor=b.dynamicDampingFactor||0.2;this.minDistance=b.minDistance||0;this.maxDistance=b.maxDistance||Infinity;this.keys=b.keys||[65,83,68];this.useTarget=!0;var e=!1,f=this.STATE.NONE,h=new THREE.Vector3,m=new THREE.Vector3,k=new THREE.Vector3,n=new THREE.Vector2,u=new THREE.Vector2,p=new THREE.Vector2,v=new THREE.Vector2;this.handleEvent=function(b){if(typeof this[b.type]=="function")this[b.type](b)};this.getMouseOnScreen=function(b,c){return new THREE.Vector2((b-
this.screen.offsetLeft)/this.radius*0.5,(c-this.screen.offsetTop)/this.radius*0.5)};this.getMouseProjectionOnBall=function(b,c){var e=new THREE.Vector3((b-this.screen.width*0.5-this.screen.offsetLeft)/this.radius,(this.screen.height*0.5+this.screen.offsetTop-c)/this.radius,0),f=e.length();f>1?e.normalize():e.z=Math.sqrt(1-f*f);h=this.position.clone().subSelf(this.target.position);f=this.up.clone().setLength(e.y);f.addSelf(this.up.clone().crossSelf(h).setLength(e.x));f.addSelf(h.setLength(e.z));return f};
this.rotateCamera=function(){var b=Math.acos(m.dot(k)/m.length()/k.length());if(b){var c=(new THREE.Vector3).cross(m,k).normalize(),e=new THREE.Quaternion;b*=this.rotateSpeed;e.setFromAxisAngle(c,-b);e.multiplyVector3(h);e.multiplyVector3(this.up);e.multiplyVector3(k);this.staticMoving?m=k:(e.setFromAxisAngle(c,b*(this.dynamicDampingFactor-1)),e.multiplyVector3(m))}};this.zoomCamera=function(){var b=1+(u.y-n.y)*this.zoomSpeed;b!==1&&b>0&&(h.multiplyScalar(b),this.staticMoving?n=u:n.y+=(u.y-n.y)*this.dynamicDampingFactor)};
this.panCamera=function(){var b=v.clone().subSelf(p);if(b.lengthSq()){b.multiplyScalar(h.length()*this.panSpeed);var c=h.clone().crossSelf(this.up).setLength(b.x);c.addSelf(this.up.clone().setLength(b.y));this.position.addSelf(c);this.target.position.addSelf(c);this.staticMoving?p=v:p.addSelf(b.sub(v,p).multiplyScalar(this.dynamicDampingFactor))}};this.checkDistances=function(){if(!this.noZoom||!this.noPan)this.position.lengthSq()>this.maxDistance*this.maxDistance&&this.position.setLength(this.maxDistance),
h.lengthSq()<this.minDistance*this.minDistance&&this.position.add(this.target.position,h.setLength(this.minDistance))};this.update=function(b,c,e){h=this.position.clone().subSelf(this.target.position);this.rotateCamera();this.noZoom||this.zoomCamera();this.noPan||this.panCamera();this.position.add(this.target.position,h);this.checkDistances();this.supr.update.call(this,b,c,e)};this.domElement.addEventListener("contextmenu",function(b){b.preventDefault()},!1);this.domElement.addEventListener("mousemove",
c(this,function(b){e&&(m=k=this.getMouseProjectionOnBall(b.clientX,b.clientY),n=u=this.getMouseOnScreen(b.clientX,b.clientY),p=v=this.getMouseOnScreen(b.clientX,b.clientY),e=!1);f!==this.STATE.NONE&&(f===this.STATE.ROTATE?k=this.getMouseProjectionOnBall(b.clientX,b.clientY):f===this.STATE.ZOOM&&!this.noZoom?u=this.getMouseOnScreen(b.clientX,b.clientY):f===this.STATE.PAN&&!this.noPan&&(v=this.getMouseOnScreen(b.clientX,b.clientY)))}),!1);this.domElement.addEventListener("mousedown",c(this,function(b){b.preventDefault();
b.stopPropagation();if(f===this.STATE.NONE)f=b.button,f===this.STATE.ROTATE?m=k=this.getMouseProjectionOnBall(b.clientX,b.clientY):f===this.STATE.ZOOM&&!this.noZoom?n=u=this.getMouseOnScreen(b.clientX,b.clientY):this.noPan||(p=v=this.getMouseOnScreen(b.clientX,b.clientY))}),!1);this.domElement.addEventListener("mouseup",c(this,function(b){b.preventDefault();b.stopPropagation();f=this.STATE.NONE}),!1);window.addEventListener("keydown",c(this,function(b){if(f===this.STATE.NONE){if(b.keyCode===this.keys[this.STATE.ROTATE])f=
this.STATE.ROTATE;else if(b.keyCode===this.keys[this.STATE.ZOOM]&&!this.noZoom)f=this.STATE.ZOOM;else if(b.keyCode===this.keys[this.STATE.PAN]&&!this.noPan)f=this.STATE.PAN;f!==this.STATE.NONE&&(e=!0)}}),!1);window.addEventListener("keyup",c(this,function(){if(f!==this.STATE.NONE)f=this.STATE.NONE}),!1)};THREE.TrackballCamera.prototype=new THREE.Camera;THREE.TrackballCamera.prototype.constructor=THREE.TrackballCamera;THREE.TrackballCamera.prototype.supr=THREE.Camera.prototype;
THREE.TrackballCamera.prototype.STATE={NONE:-1,ROTATE:0,ZOOM:1,PAN:2};THREE.QuakeCamera=THREE.FirstPersonCamera;
THREE.CubeGeometry=function(b,c,e,f,h,m,k,n,u){function p(b,c,e,k,n,p,t,u){var w,x,y=f||1,z=h||1,O=n/2,S=p/2,P=v.vertices.length;if(b=="x"&&c=="y"||b=="y"&&c=="x")w="z";else if(b=="x"&&c=="z"||b=="z"&&c=="x")w="y",z=m||1;else if(b=="z"&&c=="y"||b=="y"&&c=="z")w="x",y=m||1;var o=y+1,W=z+1;n/=y;var na=p/z;for(x=0;x<W;x++)for(p=0;p<o;p++){var R=new THREE.Vector3;R[b]=(p*n-O)*e;R[c]=(x*na-S)*k;R[w]=t;v.vertices.push(new THREE.Vertex(R))}for(x=0;x<z;x++)for(p=0;p<y;p++)v.faces.push(new THREE.Face4(p+o*
x+P,p+o*(x+1)+P,p+1+o*(x+1)+P,p+1+o*x+P,null,null,u)),v.faceVertexUvs[0].push([new THREE.UV(p/y,x/z),new THREE.UV(p/y,(x+1)/z),new THREE.UV((p+1)/y,(x+1)/z),new THREE.UV((p+1)/y,x/z)])}THREE.Geometry.call(this);var v=this,t=b/2,x=c/2,w=e/2,n=n?-1:1;if(k!==void 0)if(k instanceof Array)this.materials=k;else{this.materials=[];for(var z=0;z<6;z++)this.materials.push([k])}else this.materials=[];this.sides={px:!0,nx:!0,py:!0,ny:!0,pz:!0,nz:!0};if(u!=void 0)for(var y in u)this.sides[y]!=void 0&&(this.sides[y]=
u[y]);this.sides.px&&p("z","y",1*n,-1,e,c,-t,this.materials[0]);this.sides.nx&&p("z","y",-1*n,-1,e,c,t,this.materials[1]);this.sides.py&&p("x","z",1*n,1,b,e,x,this.materials[2]);this.sides.ny&&p("x","z",1*n,-1,b,e,-x,this.materials[3]);this.sides.pz&&p("x","y",1*n,-1,b,c,w,this.materials[4]);this.sides.nz&&p("x","y",-1*n,-1,b,c,-w,this.materials[5]);(function(){for(var b=[],c=[],e=0,f=v.vertices.length;e<f;e++){for(var k=v.vertices[e],h=!1,m=0,n=b.length;m<n;m++){var p=b[m];if(k.position.x==p.position.x&&
k.position.y==p.position.y&&k.position.z==p.position.z){c[e]=m;h=!0;break}}if(!h)c[e]=b.length,b.push(new THREE.Vertex(k.position.clone()))}e=0;for(f=v.faces.length;e<f;e++)k=v.faces[e],k.a=c[k.a],k.b=c[k.b],k.c=c[k.c],k.d=c[k.d];v.vertices=b})();this.computeCentroids();this.computeFaceNormals()};THREE.CubeGeometry.prototype=new THREE.Geometry;THREE.CubeGeometry.prototype.constructor=THREE.CubeGeometry;
THREE.CylinderGeometry=function(b,c,e,f,h,m){function k(b,c,e){n.vertices.push(new THREE.Vertex(new THREE.Vector3(b,c,e)))}THREE.Geometry.call(this);var n=this,u,p=Math.PI*2,v=f/2;for(u=0;u<b;u++)k(Math.sin(p*u/b)*c,Math.cos(p*u/b)*c,-v);for(u=0;u<b;u++)k(Math.sin(p*u/b)*e,Math.cos(p*u/b)*e,v);var t,x,w,z,y=c-e;for(u=0;u<b;u++)t=new THREE.Vector3,t.copy(n.vertices[u].position),t.z=y,t.normalize(),x=new THREE.Vector3,x.copy(n.vertices[u+b].position),x.z=y,x.normalize(),w=new THREE.Vector3,w.copy(n.vertices[b+
(u+1)%b].position),w.z=y,w.normalize(),z=new THREE.Vector3,z.copy(n.vertices[(u+1)%b].position),z.z=y,z.normalize(),n.faces.push(new THREE.Face4(u,u+b,b+(u+1)%b,(u+1)%b,[t,x,w,z]));if(e>0){e=new THREE.Vector3(0,0,-1);k(0,0,-v-(m||0));for(u=b;u<b+b/2;u++)n.faces.push(new THREE.Face4(2*b,(2*u-2*b)%b,(2*u-2*b+1)%b,(2*u-2*b+2)%b,[e,e,e,e]))}if(c>0){c=new THREE.Vector3(0,0,1);k(0,0,v+(h||0));for(u=b+b/2;u<2*b;u++)n.faces.push(new THREE.Face4(2*b+1,(2*u-2*b+2)%b+b,(2*u-2*b+1)%b+b,(2*u-2*b)%b+b,[c,c,c,c]))}u=
0;for(b=this.faces.length;u<b;u++)h=[],v=this.faces[u],c=this.vertices[v.a],m=this.vertices[v.b],e=this.vertices[v.c],t=this.vertices[v.d],h.push(new THREE.UV(0.5+Math.atan2(c.position.x,c.position.y)/p,0.5+c.position.z/f)),h.push(new THREE.UV(0.5+Math.atan2(m.position.x,m.position.y)/p,0.5+m.position.z/f)),h.push(new THREE.UV(0.5+Math.atan2(e.position.x,e.position.y)/p,0.5+e.position.z/f)),v instanceof THREE.Face4&&h.push(new THREE.UV(0.5+Math.atan2(t.position.x,t.position.y)/p,0.5+t.position.z/
f)),this.faceVertexUvs[0].push(h);this.computeCentroids();this.computeFaceNormals()};THREE.CylinderGeometry.prototype=new THREE.Geometry;THREE.CylinderGeometry.prototype.constructor=THREE.CylinderGeometry;THREE.ExtrudeGeometry=function(b,c){if(typeof b!="undefined"){THREE.Geometry.call(this);var b=b instanceof Array?b:[b],e,f=b.length,h;this.shapebb=b[f-1].getBoundingBox();for(e=0;e<f;e++)h=b[e],this.addShape(h,c);this.computeCentroids();this.computeFaceNormals()}};
THREE.ExtrudeGeometry.prototype=new THREE.Geometry;THREE.ExtrudeGeometry.prototype.constructor=THREE.ExtrudeGeometry;
THREE.ExtrudeGeometry.prototype.addShape=function(b,c){function e(b,c,e){c||console.log("die");return c.clone().multiplyScalar(e).addSelf(b)}function f(b,c,e){var f=THREE.ExtrudeGeometry.__v1,k=THREE.ExtrudeGeometry.__v2,h=THREE.ExtrudeGeometry.__v3,m=THREE.ExtrudeGeometry.__v4,n=THREE.ExtrudeGeometry.__v5,o=THREE.ExtrudeGeometry.__v6;f.set(b.x-c.x,b.y-c.y);k.set(b.x-e.x,b.y-e.y);f=f.normalize();k=k.normalize();h.set(-f.y,f.x);m.set(k.y,-k.x);n.copy(b).addSelf(h);o.copy(b).addSelf(m);if(n.equals(o))return m.clone();
n.copy(c).addSelf(h);o.copy(e).addSelf(m);h=f.dot(m);m=o.subSelf(n).dot(m);h==0&&(console.log("Either infinite or no solutions!"),m==0?console.log("Its finite solutions."):console.log("Too bad, no solutions."));m/=h;if(m<0)return c=Math.atan2(c.y-b.y,c.x-b.x),b=Math.atan2(e.y-b.y,e.x-b.x),c>b&&(b+=Math.PI*2),anglec=(c+b)/2,new THREE.Vector2(-Math.cos(anglec),-Math.sin(anglec));return f.multiplyScalar(m).addSelf(n).subSelf(b).clone()}function h(b){for(L=b.length;--L>=0;){ga=L;da=L-1;da<0&&(da=b.length-
1);for(var c=0,e=w+v*2,c=0;c<e;c++){var f=na*c,k=na*(c+1),h=$+ga+f,m=$+ga+k,o=h,f=$+da+f,k=$+da+k,p=m;o+=U;f+=U;k+=U;p+=U;K.faces.push(new THREE.Face4(o,f,k,p,null,null,E));E&&(o=c/e,f=(c+1)/e,k=n+u*2,h=(K.vertices[h].position.z+u)/k,m=(K.vertices[m].position.z+u)/k,K.faceVertexUvs[0].push([new THREE.UV(h,o),new THREE.UV(m,o),new THREE.UV(m,f),new THREE.UV(h,f)]))}}}function m(b,c,e){K.vertices.push(new THREE.Vertex(new THREE.Vector3(b,c,e)))}function k(b,c,e){b+=U;c+=U;e+=U;K.faces.push(new THREE.Face3(b,
c,e,null,null,H));if(H){var f=N.maxY,k=N.maxX,h=K.vertices[c].position.x,c=K.vertices[c].position.y,m=K.vertices[e].position.x,e=K.vertices[e].position.y;K.faceVertexUvs[0].push([new THREE.UV(K.vertices[b].position.x/k,K.vertices[b].position.y/f),new THREE.UV(h/k,c/f),new THREE.UV(m/k,e/f)])}}var n=c.amount!==void 0?c.amount:100,u=c.bevelThickness!==void 0?c.bevelThickness:6,p=c.bevelSize!==void 0?c.bevelSize:u-2,v=c.bevelSegments!==void 0?c.bevelSegments:3,t=c.bevelEnabled!==void 0?c.bevelEnabled:
!0,x=c.curveSegments!==void 0?c.curveSegments:12,w=c.steps!==void 0?c.steps:1,z=c.bendPath,y=c.extrudePath,B,D=!1,G=c.useSpacedPoints!==void 0?c.useSpacedPoints:!1,H=c.material,E=c.extrudeMaterial,N=this.shapebb;if(y)B=y.getPoints(x),w=B.length,D=!0,t=!1;t||(p=u=v=0);var F,I,C,K=this,U=this.vertices.length;z&&b.addWrapPath(z);x=G?b.extractAllSpacedPoints(x):b.extractAllPoints(x);z=x.shape;x=x.holes;if(y=!THREE.Shape.Utils.isClockWise(z)){z=z.reverse();I=0;for(C=x.length;I<C;I++)F=x[I],THREE.Shape.Utils.isClockWise(F)&&
(x[I]=F.reverse());y=!1}y=THREE.Shape.Utils.triangulateShape(z,x);G=z;I=0;for(C=x.length;I<C;I++)F=x[I],z=z.concat(F);var L,O,S,P,o,W,na=z.length,R=y.length,ia=[];L=0;O=G.length;ga=O-1;for(da=L+1;L<O;L++,ga++,da++)ga==O&&(ga=0),da==O&&(da=0),ia[L]=f(G[L],G[ga],G[da]);var aa=[],ma,fa=ia.concat();I=0;for(C=x.length;I<C;I++){F=x[I];ma=[];L=0;O=F.length;ga=O-1;for(da=L+1;L<O;L++,ga++,da++)ga==O&&(ga=0),da==O&&(da=0),ma[L]=f(F[L],F[ga],F[da]);aa.push(ma);fa=fa.concat(ma)}for(S=0;S<v;S++){P=S/v;o=u*(1-
P);P=p*Math.sin(P*Math.PI/2);L=0;for(O=G.length;L<O;L++)W=e(G[L],ia[L],P),m(W.x,W.y,-o);I=0;for(C=x.length;I<C;I++){F=x[I];ma=aa[I];L=0;for(O=F.length;L<O;L++)W=e(F[L],ma[L],P),m(W.x,W.y,-o)}}P=p;for(L=0;L<na;L++)W=t?e(z[L],fa[L],P):z[L],D?m(W.x,W.y+B[0].y,B[0].x):m(W.x,W.y,0);for(S=1;S<=w;S++)for(L=0;L<na;L++)W=t?e(z[L],fa[L],P):z[L],D?m(W.x,W.y+B[S-1].y,B[S-1].x):m(W.x,W.y,n/w*S);for(S=v-1;S>=0;S--){P=S/v;o=u*(1-P);P=p*Math.sin(P*Math.PI/2);L=0;for(O=G.length;L<O;L++)W=e(G[L],ia[L],P),m(W.x,W.y,
n+o);I=0;for(C=x.length;I<C;I++){F=x[I];ma=aa[I];L=0;for(O=F.length;L<O;L++)W=e(F[L],ma[L],P),D?m(W.x,W.y+B[w-1].y,B[w-1].x+o):m(W.x,W.y,n+o)}}if(t){t=na*0;for(L=0;L<R;L++)p=y[L],k(p[2]+t,p[1]+t,p[0]+t);t=na*(w+v*2);for(L=0;L<R;L++)p=y[L],k(p[0]+t,p[1]+t,p[2]+t)}else{for(L=0;L<R;L++)p=y[L],k(p[2],p[1],p[0]);for(L=0;L<R;L++)p=y[L],k(p[0]+na*w,p[1]+na*w,p[2]+na*w)}var ga,da,$=0;h(G);$+=G.length;I=0;for(C=x.length;I<C;I++)F=x[I],h(F),$+=F.length};THREE.ExtrudeGeometry.__v1=new THREE.Vector2;
THREE.ExtrudeGeometry.__v2=new THREE.Vector2;THREE.ExtrudeGeometry.__v3=new THREE.Vector2;THREE.ExtrudeGeometry.__v4=new THREE.Vector2;THREE.ExtrudeGeometry.__v5=new THREE.Vector2;THREE.ExtrudeGeometry.__v6=new THREE.Vector2;
THREE.IcosahedronGeometry=function(b){function c(b,c,e){var f=Math.sqrt(b*b+c*c+e*e);return h.vertices.push(new THREE.Vertex(new THREE.Vector3(b/f,c/f,e/f)))-1}function e(b,c,e,f){f.faces.push(new THREE.Face3(b,c,e))}function f(b,e){var f=h.vertices[b].position,k=h.vertices[e].position;return c((f.x+k.x)/2,(f.y+k.y)/2,(f.z+k.z)/2)}var h=this,m=new THREE.Geometry;this.subdivisions=b||0;THREE.Geometry.call(this);b=(1+Math.sqrt(5))/2;c(-1,b,0);c(1,b,0);c(-1,-b,0);c(1,-b,0);c(0,-1,b);c(0,1,b);c(0,-1,
-b);c(0,1,-b);c(b,0,-1);c(b,0,1);c(-b,0,-1);c(-b,0,1);e(0,11,5,m);e(0,5,1,m);e(0,1,7,m);e(0,7,10,m);e(0,10,11,m);e(1,5,9,m);e(5,11,4,m);e(11,10,2,m);e(10,7,6,m);e(7,1,8,m);e(3,9,4,m);e(3,4,2,m);e(3,2,6,m);e(3,6,8,m);e(3,8,9,m);e(4,9,5,m);e(2,4,11,m);e(6,2,10,m);e(8,6,7,m);e(9,8,1,m);for(var k=0;k<this.subdivisions;k++){var b=new THREE.Geometry,n;for(n in m.faces){var u=f(m.faces[n].a,m.faces[n].b),p=f(m.faces[n].b,m.faces[n].c),v=f(m.faces[n].c,m.faces[n].a);e(m.faces[n].a,u,v,b);e(m.faces[n].b,p,
u,b);e(m.faces[n].c,v,p,b);e(u,p,v,b)}m.faces=b.faces}h.faces=m.faces;this.computeCentroids();this.computeFaceNormals();this.computeVertexNormals()};THREE.IcosahedronGeometry.prototype=new THREE.Geometry;THREE.IcosahedronGeometry.prototype.constructor=THREE.IcosahedronGeometry;
THREE.LatheGeometry=function(b,c,e){THREE.Geometry.call(this);this.steps=c||12;this.angle=e||2*Math.PI;for(var c=this.angle/this.steps,e=[],f=[],h=[],m=[],k=(new THREE.Matrix4).setRotationZ(c),n=0;n<b.length;n++)this.vertices.push(new THREE.Vertex(b[n])),e[n]=b[n].clone(),f[n]=this.vertices.length-1;for(var u=0;u<=this.angle+0.001;u+=c){for(n=0;n<e.length;n++)u<this.angle?(e[n]=k.multiplyVector3(e[n].clone()),this.vertices.push(new THREE.Vertex(e[n])),h[n]=this.vertices.length-1):h=m;u==0&&(m=f);
for(n=0;n<f.length-1;n++)this.faces.push(new THREE.Face4(h[n],h[n+1],f[n+1],f[n])),this.faceVertexUvs[0].push([new THREE.UV(1-u/this.angle,n/b.length),new THREE.UV(1-u/this.angle,(n+1)/b.length),new THREE.UV(1-(u-c)/this.angle,(n+1)/b.length),new THREE.UV(1-(u-c)/this.angle,n/b.length)]);f=h;h=[]}this.computeCentroids();this.computeFaceNormals();this.computeVertexNormals()};THREE.LatheGeometry.prototype=new THREE.Geometry;THREE.LatheGeometry.prototype.constructor=THREE.LatheGeometry;
THREE.PlaneGeometry=function(b,c,e,f){THREE.Geometry.call(this);var h,m=b/2,k=c/2,e=e||1,f=f||1,n=e+1,u=f+1;b/=e;var p=c/f;for(h=0;h<u;h++)for(c=0;c<n;c++)this.vertices.push(new THREE.Vertex(new THREE.Vector3(c*b-m,-(h*p-k),0)));for(h=0;h<f;h++)for(c=0;c<e;c++)this.faces.push(new THREE.Face4(c+n*h,c+n*(h+1),c+1+n*(h+1),c+1+n*h)),this.faceVertexUvs[0].push([new THREE.UV(c/e,h/f),new THREE.UV(c/e,(h+1)/f),new THREE.UV((c+1)/e,(h+1)/f),new THREE.UV((c+1)/e,h/f)]);this.computeCentroids();this.computeFaceNormals()};
THREE.PlaneGeometry.prototype=new THREE.Geometry;THREE.PlaneGeometry.prototype.constructor=THREE.PlaneGeometry;
THREE.SphereGeometry=function(b,c,e){THREE.Geometry.call(this);for(var b=b||50,f,h=Math.PI,m=Math.max(3,c||8),k=Math.max(2,e||6),c=[],e=0;e<k+1;e++){f=e/k;var n=b*Math.cos(f*h),u=b*Math.sin(f*h),p=[],v=0;for(f=0;f<m;f++){var t=2*f/m,x=u*Math.sin(t*h),t=u*Math.cos(t*h);(e==0||e==k)&&f>0||(v=this.vertices.push(new THREE.Vertex(new THREE.Vector3(t,n,x)))-1);p.push(v)}c.push(p)}for(var w,z,y,h=c.length,e=0;e<h;e++)if(m=c[e].length,e>0)for(f=0;f<m;f++){p=f==m-1;k=c[e][p?0:f+1];n=c[e][p?m-1:f];u=c[e-1][p?
m-1:f];p=c[e-1][p?0:f+1];x=e/(h-1);w=(e-1)/(h-1);z=(f+1)/m;var t=f/m,v=new THREE.UV(1-z,x),x=new THREE.UV(1-t,x),t=new THREE.UV(1-t,w),B=new THREE.UV(1-z,w);e<c.length-1&&(w=this.vertices[k].position.clone(),z=this.vertices[n].position.clone(),y=this.vertices[u].position.clone(),w.normalize(),z.normalize(),y.normalize(),this.faces.push(new THREE.Face3(k,n,u,[new THREE.Vector3(w.x,w.y,w.z),new THREE.Vector3(z.x,z.y,z.z),new THREE.Vector3(y.x,y.y,y.z)])),this.faceVertexUvs[0].push([v,x,t]));e>1&&(w=
this.vertices[k].position.clone(),z=this.vertices[u].position.clone(),y=this.vertices[p].position.clone(),w.normalize(),z.normalize(),y.normalize(),this.faces.push(new THREE.Face3(k,u,p,[new THREE.Vector3(w.x,w.y,w.z),new THREE.Vector3(z.x,z.y,z.z),new THREE.Vector3(y.x,y.y,y.z)])),this.faceVertexUvs[0].push([v,t,B]))}this.computeCentroids();this.computeFaceNormals();this.computeVertexNormals();this.boundingSphere={radius:b}};THREE.SphereGeometry.prototype=new THREE.Geometry;
THREE.SphereGeometry.prototype.constructor=THREE.SphereGeometry;
THREE.TextGeometry=function(b,c){var e=(new THREE.TextPath(b,c)).toShapes();c.amount=c.height!==void 0?c.height:50;if(c.bevelThickness===void 0)c.bevelThickness=10;if(c.bevelSize===void 0)c.bevelSize=8;if(c.bevelEnabled===void 0)c.bevelEnabled=!1;if(c.bend){var f=e[e.length-1].getBoundingBox().maxX;c.bendPath=new THREE.QuadraticBezierCurve(new THREE.Vector2(0,0),new THREE.Vector2(f/2,120),new THREE.Vector2(f,0))}THREE.ExtrudeGeometry.call(this,e,c)};THREE.TextGeometry.prototype=new THREE.ExtrudeGeometry;
THREE.TextGeometry.prototype.constructor=THREE.TextGeometry;
THREE.FontUtils={faces:{},face:"helvetiker",weight:"normal",style:"normal",size:150,divisions:10,getFace:function(){return this.faces[this.face][this.weight][this.style]},getTextShapes:function(b,c){return(new TextPath(b,c)).toShapes()},loadFace:function(b){var c=b.familyName.toLowerCase();this.faces[c]=this.faces[c]||{};this.faces[c][b.cssFontWeight]=this.faces[c][b.cssFontWeight]||{};this.faces[c][b.cssFontWeight][b.cssFontStyle]=b;return this.faces[c][b.cssFontWeight][b.cssFontStyle]=b},drawText:function(b){for(var c=
this.getFace(),e=this.size/c.resolution,f=0,h=String(b).split(""),m=h.length,k=[],b=0;b<m;b++){var n=new THREE.Path,n=this.extractGlyphPoints(h[b],c,e,f,n);f+=n.offset;k.push(n.path)}return{paths:k,offset:f/2}},extractGlyphPoints:function(b,c,e,f,h){var m=[],k,n,u,p,v,t,x,w,z,y,B=c.glyphs[b]||c.glyphs[ctxt.options.fallbackCharacter];if(B){if(B.o){c=B._cachedOutline||(B._cachedOutline=B.o.split(" "));u=c.length;for(b=0;b<u;)switch(n=c[b++],n){case "m":n=c[b++]*e+f;p=c[b++]*e;m.push(new THREE.Vector2(n,
p));h.moveTo(n,p);break;case "l":n=c[b++]*e+f;p=c[b++]*e;m.push(new THREE.Vector2(n,p));h.lineTo(n,p);break;case "q":n=c[b++]*e+f;p=c[b++]*e;x=c[b++]*e+f;w=c[b++]*e;h.quadraticCurveTo(x,w,n,p);if(k=m[m.length-1]){v=k.x;t=k.y;k=1;for(divisions=this.divisions;k<=divisions;k++){var D=k/divisions,G=THREE.Shape.Utils.b2(D,v,x,n),D=THREE.Shape.Utils.b2(D,t,w,p);m.push(new THREE.Vector2(G,D))}}break;case "b":if(n=c[b++]*e+f,p=c[b++]*e,x=c[b++]*e+f,w=c[b++]*-e,z=c[b++]*e+f,y=c[b++]*-e,h.bezierCurveTo(n,p,
x,w,z,y),k=m[m.length-1]){v=k.x;t=k.y;k=1;for(divisions=this.divisions;k<=divisions;k++)D=k/divisions,G=THREE.Shape.Utils.b3(D,v,x,z,n),D=THREE.Shape.Utils.b3(D,t,w,y,p),m.push(new THREE.Vector2(G,D))}}}return{offset:B.ha*e,points:m,path:h}}}};
(function(b){var c=function(b){for(var c=b.length,h=0,m=c-1,k=0;k<c;m=k++)h+=b[m].x*b[k].y-b[k].x*b[m].y;return h*0.5};b.Triangulate=function(b,f){var h=b.length;if(h<3)return null;var m=[],k=[],n=[],u,p,v;if(c(b)>0)for(p=0;p<h;p++)k[p]=p;else for(p=0;p<h;p++)k[p]=h-1-p;var t=2*h;for(p=h-1;h>2;){if(t--<=0){console.log("Warning, unable to triangulate polygon!");if(f)return n;return m}u=p;h<=u&&(u=0);p=u+1;h<=p&&(p=0);v=p+1;h<=v&&(v=0);var x;a:{x=b;var w=u,z=p,y=v,B=h,D=k,G=void 0,H=void 0,E=void 0,
N=void 0,F=void 0,I=void 0,C=void 0,K=void 0,U=void 0,H=x[D[w]].x,E=x[D[w]].y,N=x[D[z]].x,F=x[D[z]].y,I=x[D[y]].x,C=x[D[y]].y;if(1.0E-10>(N-H)*(C-E)-(F-E)*(I-H))x=!1;else{for(G=0;G<B;G++)if(!(G==w||G==z||G==y)){var K=x[D[G]].x,U=x[D[G]].y,L=void 0,O=void 0,S=void 0,P=void 0,o=void 0,W=void 0,na=void 0,R=void 0,ia=void 0,aa=void 0,ma=void 0,fa=void 0,L=S=o=void 0,L=I-N,O=C-F,S=H-I,P=E-C,o=N-H,W=F-E,na=K-H,R=U-E,ia=K-N,aa=U-F,ma=K-I,fa=U-C,L=L*aa-O*ia,o=o*R-W*na,S=S*fa-P*ma;if(L>=0&&S>=0&&o>=0){x=!1;
break a}}x=!0}}if(x){m.push([b[k[u]],b[k[p]],b[k[v]]]);n.push([k[u],k[p],k[v]]);u=p;for(v=p+1;v<h;u++,v++)k[u]=k[v];h--;t=2*h}}if(f)return n;return m};b.Triangulate.area=c;return b})(THREE.FontUtils);window._typeface_js={faces:THREE.FontUtils.faces,loadFace:THREE.FontUtils.loadFace};
THREE.TorusGeometry=function(b,c,e,f,h){THREE.Geometry.call(this);this.radius=b||100;this.tube=c||40;this.segmentsR=e||8;this.segmentsT=f||6;this.arc=h||Math.PI*2;h=new THREE.Vector3;b=[];c=[];for(e=0;e<=this.segmentsR;e++)for(f=0;f<=this.segmentsT;f++){var m=f/this.segmentsT*this.arc,k=e/this.segmentsR*Math.PI*2;h.x=this.radius*Math.cos(m);h.y=this.radius*Math.sin(m);var n=new THREE.Vector3;n.x=(this.radius+this.tube*Math.cos(k))*Math.cos(m);n.y=(this.radius+this.tube*Math.cos(k))*Math.sin(m);n.z=
this.tube*Math.sin(k);this.vertices.push(new THREE.Vertex(n));b.push(new THREE.UV(f/this.segmentsT,1-e/this.segmentsR));c.push(n.clone().subSelf(h).normalize())}for(e=1;e<=this.segmentsR;e++)for(f=1;f<=this.segmentsT;f++){var h=(this.segmentsT+1)*e+f-1,m=(this.segmentsT+1)*(e-1)+f-1,k=(this.segmentsT+1)*(e-1)+f,n=(this.segmentsT+1)*e+f,u=new THREE.Face4(h,m,k,n,[c[h],c[m],c[k],c[n]]);u.normal.addSelf(c[h]);u.normal.addSelf(c[m]);u.normal.addSelf(c[k]);u.normal.addSelf(c[n]);u.normal.normalize();this.faces.push(u);
this.faceVertexUvs[0].push([b[h].clone(),b[m].clone(),b[k].clone(),b[n].clone()])}this.computeCentroids()};THREE.TorusGeometry.prototype=new THREE.Geometry;THREE.TorusGeometry.prototype.constructor=THREE.TorusGeometry;
THREE.TorusKnotGeometry=function(b,c,e,f,h,m,k){function n(b,c,e,f,k,h){c=e/f*b;e=Math.cos(c);return new THREE.Vector3(k*(2+e)*0.5*Math.cos(b),k*(2+e)*Math.sin(b)*0.5,h*k*Math.sin(c)*0.5)}THREE.Geometry.call(this);this.radius=b||200;this.tube=c||40;this.segmentsR=e||64;this.segmentsT=f||8;this.p=h||2;this.q=m||3;this.heightScale=k||1;this.grid=Array(this.segmentsR);e=new THREE.Vector3;f=new THREE.Vector3;m=new THREE.Vector3;for(b=0;b<this.segmentsR;++b){this.grid[b]=Array(this.segmentsT);for(c=0;c<
this.segmentsT;++c){var u=b/this.segmentsR*2*this.p*Math.PI,k=c/this.segmentsT*2*Math.PI,h=n(u,k,this.q,this.p,this.radius,this.heightScale),u=n(u+0.01,k,this.q,this.p,this.radius,this.heightScale);e.x=u.x-h.x;e.y=u.y-h.y;e.z=u.z-h.z;f.x=u.x+h.x;f.y=u.y+h.y;f.z=u.z+h.z;m.cross(e,f);f.cross(m,e);m.normalize();f.normalize();u=-this.tube*Math.cos(k);k=this.tube*Math.sin(k);h.x+=u*f.x+k*m.x;h.y+=u*f.y+k*m.y;h.z+=u*f.z+k*m.z;this.grid[b][c]=this.vertices.push(new THREE.Vertex(new THREE.Vector3(h.x,h.y,
h.z)))-1}}for(b=0;b<this.segmentsR;++b)for(c=0;c<this.segmentsT;++c){var f=(b+1)%this.segmentsR,m=(c+1)%this.segmentsT,h=this.grid[b][c],e=this.grid[f][c],f=this.grid[f][m],m=this.grid[b][m],k=new THREE.UV(b/this.segmentsR,c/this.segmentsT),u=new THREE.UV((b+1)/this.segmentsR,c/this.segmentsT),p=new THREE.UV((b+1)/this.segmentsR,(c+1)/this.segmentsT),v=new THREE.UV(b/this.segmentsR,(c+1)/this.segmentsT);this.faces.push(new THREE.Face4(h,e,f,m));this.faceVertexUvs[0].push([k,u,p,v])}this.computeCentroids();
this.computeFaceNormals();this.computeVertexNormals()};THREE.TorusKnotGeometry.prototype=new THREE.Geometry;THREE.TorusKnotGeometry.prototype.constructor=THREE.TorusKnotGeometry;THREE.Loader=function(b){this.statusDomElement=(this.showStatus=b)?THREE.Loader.prototype.addStatusElement():null;this.onLoadStart=function(){};this.onLoadProgress=function(){};this.onLoadComplete=function(){}};
THREE.Loader.prototype={addStatusElement:function(){var b=document.createElement("div");b.style.position="absolute";b.style.right="0px";b.style.top="0px";b.style.fontSize="0.8em";b.style.textAlign="left";b.style.background="rgba(0,0,0,0.25)";b.style.color="#fff";b.style.width="120px";b.style.padding="0.5em 0.5em 0.5em 0.5em";b.style.zIndex=1E3;b.innerHTML="Loading ...";return b},updateProgress:function(b){var c="Loaded ";c+=b.total?(100*b.loaded/b.total).toFixed(0)+"%":(b.loaded/1E3).toFixed(2)+" KB";
this.statusDomElement.innerHTML=c},extractUrlbase:function(b){b=b.split("/");b.pop();return b.join("/")},init_materials:function(b,c,e){b.materials=[];for(var f=0;f<c.length;++f)b.materials[f]=[THREE.Loader.prototype.createMaterial(c[f],e)]},hasNormals:function(b){var c,e,f=b.materials.length;for(e=0;e<f;e++)if(c=b.materials[e][0],c instanceof THREE.MeshShaderMaterial)return!0;return!1},createMaterial:function(b,c){function e(b){b=Math.log(b)/Math.LN2;return Math.floor(b)==b}function f(b,c){var f=
new Image;f.onload=function(){if(!e(this.width)||!e(this.height)){var c=Math.pow(2,Math.round(Math.log(this.width)/Math.LN2)),f=Math.pow(2,Math.round(Math.log(this.height)/Math.LN2));b.image.width=c;b.image.height=f;b.image.getContext("2d").drawImage(this,0,0,c,f)}else b.image=this;b.needsUpdate=!0};f.src=c}function h(b,e,k,h,m,n){var p=document.createElement("canvas");b[e]=new THREE.Texture(p);b[e].sourceFile=k;if(h){b[e].repeat.set(h[0],h[1]);if(h[0]!=1)b[e].wrapS=THREE.RepeatWrapping;if(h[1]!=
1)b[e].wrapT=THREE.RepeatWrapping}m&&b[e].offset.set(m[0],m[1]);if(n){h={repeat:THREE.RepeatWrapping,mirror:THREE.MirroredRepeatWrapping};if(h[n[0]]!==void 0)b[e].wrapS=h[n[0]];if(h[n[1]]!==void 0)b[e].wrapT=h[n[1]]}f(b[e],c+"/"+k)}function m(b){return(b[0]*255<<16)+(b[1]*255<<8)+b[2]*255}var k,n,u;n="MeshLambertMaterial";k={color:15658734,opacity:1,map:null,lightMap:null,normalMap:null,wireframe:b.wireframe};b.shading&&(b.shading=="Phong"?n="MeshPhongMaterial":b.shading=="Basic"&&(n="MeshBasicMaterial"));
if(b.blending)if(b.blending=="Additive")k.blending=THREE.AdditiveBlending;else if(b.blending=="Subtractive")k.blending=THREE.SubtractiveBlending;else if(b.blending=="Multiply")k.blending=THREE.MultiplyBlending;if(b.transparent!==void 0||b.opacity<1)k.transparent=b.transparent;if(b.depthTest!==void 0)k.depthTest=b.depthTest;if(b.vertexColors!==void 0)if(b.vertexColors=="face")k.vertexColors=THREE.FaceColors;else if(b.vertexColors)k.vertexColors=THREE.VertexColors;if(b.colorDiffuse)k.color=m(b.colorDiffuse);
else if(b.DbgColor)k.color=b.DbgColor;if(b.colorSpecular)k.specular=m(b.colorSpecular);if(b.colorAmbient)k.ambient=m(b.colorAmbient);if(b.transparency)k.opacity=b.transparency;if(b.specularCoef)k.shininess=b.specularCoef;b.mapDiffuse&&c&&h(k,"map",b.mapDiffuse,b.mapDiffuseRepeat,b.mapDiffuseOffset,b.mapDiffuseWrap);b.mapLight&&c&&h(k,"lightMap",b.mapLight,b.mapLightRepeat,b.mapLightOffset,b.mapLightWrap);b.mapNormal&&c&&h(k,"normalMap",b.mapNormal,b.mapNormalRepeat,b.mapNormalOffset,b.mapNormalWrap);
b.mapSpecular&&c&&h(k,"specularMap",b.mapSpecular,b.mapSpecularRepeat,b.mapSpecularOffset,b.mapSpecularWrap);if(b.mapNormal){var p=THREE.ShaderUtils.lib.normal,v=THREE.UniformsUtils.clone(p.uniforms),t=k.color;n=k.specular;u=k.ambient;var x=k.shininess;v.tNormal.texture=k.normalMap;if(b.mapNormalFactor)v.uNormalScale.value=b.mapNormalFactor;if(k.map)v.tDiffuse.texture=k.map,v.enableDiffuse.value=!0;if(k.specularMap)v.tSpecular.texture=k.specularMap,v.enableSpecular.value=!0;if(k.lightMap)v.tAO.texture=
k.lightMap,v.enableAO.value=!0;v.uDiffuseColor.value.setHex(t);v.uSpecularColor.value.setHex(n);v.uAmbientColor.value.setHex(u);v.uShininess.value=x;if(k.opacity)v.uOpacity.value=k.opacity;k=new THREE.MeshShaderMaterial({fragmentShader:p.fragmentShader,vertexShader:p.vertexShader,uniforms:v,lights:!0,fog:!0})}else k=new THREE[n](k);return k},constructor:THREE.Loader};THREE.BinaryLoader=function(b){THREE.Loader.call(this,b)};THREE.BinaryLoader.prototype=new THREE.Loader;
THREE.BinaryLoader.prototype.constructor=THREE.BinaryLoader;THREE.BinaryLoader.prototype.supr=THREE.Loader.prototype;
THREE.BinaryLoader.prototype.load=function(b){var c=b.model,e=b.callback,f=b.texture_path?b.texture_path:THREE.Loader.prototype.extractUrlbase(c),h=b.bin_path?b.bin_path:THREE.Loader.prototype.extractUrlbase(c),b=(new Date).getTime(),c=new Worker(c),m=this.showProgress?THREE.Loader.prototype.updateProgress:null;c.onmessage=function(b){THREE.BinaryLoader.prototype.loadAjaxBuffers(b.data.buffers,b.data.materials,e,h,f,m)};c.onerror=function(b){alert("worker.onerror: "+b.message+"\n"+b.data);b.preventDefault()};
c.postMessage(b)};
THREE.BinaryLoader.prototype.loadAjaxBuffers=function(b,c,e,f,h,m){var k=new XMLHttpRequest,n=f+"/"+b,u=0;k.onreadystatechange=function(){k.readyState==4?k.status==200||k.status==0?THREE.BinaryLoader.prototype.createBinModel(k.responseText,e,h,c):alert("Couldn't load ["+n+"] ["+k.status+"]"):k.readyState==3?m&&(u==0&&(u=k.getResponseHeader("Content-Length")),m({total:u,loaded:k.responseText.length})):k.readyState==2&&(u=k.getResponseHeader("Content-Length"))};k.open("GET",n,!0);k.overrideMimeType("text/plain; charset=x-user-defined");
k.setRequestHeader("Content-Type","text/plain");k.send(null)};
THREE.BinaryLoader.prototype.createBinModel=function(b,c,e,f){var h=function(c){function e(b,c){var f=v(b,c),k=v(b,c+1),h=v(b,c+2),m=v(b,c+3),n=(m<<1&255|h>>7)-127;f|=(h&127)<<16|k<<8;if(f==0&&n==-127)return 0;return(1-2*(m>>7))*(1+f*Math.pow(2,-23))*Math.pow(2,n)}function h(b,c){var e=v(b,c),f=v(b,c+1),k=v(b,c+2);return(v(b,c+3)<<24)+(k<<16)+(f<<8)+e}function u(b,c){var e=v(b,c);return(v(b,c+1)<<8)+e}function p(b,c){var e=v(b,c);return e>127?e-256:e}function v(b,c){return b.charCodeAt(c)&255}function t(c){var e,
f,k;e=h(b,c);f=h(b,c+F);k=h(b,c+I);c=u(b,c+C);D.faces.push(new THREE.Face3(e,f,k,null,null,D.materials[c]))}function x(c){var e,f,k,m,o,p;e=h(b,c);f=h(b,c+F);k=h(b,c+I);m=u(b,c+C);o=h(b,c+K);p=h(b,c+U);c=h(b,c+L);m=D.materials[m];var t=E[p*3],v=E[p*3+1];p=E[p*3+2];var w=E[c*3],M=E[c*3+1],c=E[c*3+2];D.faces.push(new THREE.Face3(e,f,k,[new THREE.Vector3(E[o*3],E[o*3+1],E[o*3+2]),new THREE.Vector3(t,v,p),new THREE.Vector3(w,M,c)],null,m))}function w(c){var e,f,k,m;e=h(b,c);f=h(b,c+O);k=h(b,c+S);m=h(b,
c+P);c=u(b,c+o);D.faces.push(new THREE.Face4(e,f,k,m,null,null,D.materials[c]))}function z(c){var e,f,k,m,p,t,v,w;e=h(b,c);f=h(b,c+O);k=h(b,c+S);m=h(b,c+P);p=u(b,c+o);t=h(b,c+W);v=h(b,c+na);w=h(b,c+R);c=h(b,c+ia);p=D.materials[p];var x=E[v*3],M=E[v*3+1];v=E[v*3+2];var y=E[w*3],T=E[w*3+1];w=E[w*3+2];var z=E[c*3],B=E[c*3+1],c=E[c*3+2];D.faces.push(new THREE.Face4(e,f,k,m,[new THREE.Vector3(E[t*3],E[t*3+1],E[t*3+2]),new THREE.Vector3(x,M,v),new THREE.Vector3(y,T,w),new THREE.Vector3(z,B,c)],null,p))}
function y(c){var e,f,k,m;e=h(b,c);f=h(b,c+aa);k=h(b,c+ma);c=N[e*2];m=N[e*2+1];e=N[f*2];var o=D.faceVertexUvs[0];f=N[f*2+1];var p=N[k*2];k=N[k*2+1];var t=[];t.push(new THREE.UV(c,m));t.push(new THREE.UV(e,f));t.push(new THREE.UV(p,k));o.push(t)}function B(c){var e,f,k,m,o,p;e=h(b,c);f=h(b,c+fa);k=h(b,c+ga);m=h(b,c+da);c=N[e*2];o=N[e*2+1];e=N[f*2];p=N[f*2+1];f=N[k*2];var t=D.faceVertexUvs[0];k=N[k*2+1];var u=N[m*2];m=N[m*2+1];var v=[];v.push(new THREE.UV(c,o));v.push(new THREE.UV(e,p));v.push(new THREE.UV(f,
k));v.push(new THREE.UV(u,m));t.push(v)}var D=this,G=0,H,E=[],N=[],F,I,C,K,U,L,O,S,P,o,W,na,R,ia,aa,ma,fa,ga,da,$,ca,X,ja,ea,qa;THREE.Geometry.call(this);THREE.Loader.prototype.init_materials(D,f,c);H={signature:b.substr(G,8),header_bytes:v(b,G+8),vertex_coordinate_bytes:v(b,G+9),normal_coordinate_bytes:v(b,G+10),uv_coordinate_bytes:v(b,G+11),vertex_index_bytes:v(b,G+12),normal_index_bytes:v(b,G+13),uv_index_bytes:v(b,G+14),material_index_bytes:v(b,G+15),nvertices:h(b,G+16),nnormals:h(b,G+16+4),nuvs:h(b,
G+16+8),ntri_flat:h(b,G+16+12),ntri_smooth:h(b,G+16+16),ntri_flat_uv:h(b,G+16+20),ntri_smooth_uv:h(b,G+16+24),nquad_flat:h(b,G+16+28),nquad_smooth:h(b,G+16+32),nquad_flat_uv:h(b,G+16+36),nquad_smooth_uv:h(b,G+16+40)};G+=H.header_bytes;F=H.vertex_index_bytes;I=H.vertex_index_bytes*2;C=H.vertex_index_bytes*3;K=H.vertex_index_bytes*3+H.material_index_bytes;U=H.vertex_index_bytes*3+H.material_index_bytes+H.normal_index_bytes;L=H.vertex_index_bytes*3+H.material_index_bytes+H.normal_index_bytes*2;O=H.vertex_index_bytes;
S=H.vertex_index_bytes*2;P=H.vertex_index_bytes*3;o=H.vertex_index_bytes*4;W=H.vertex_index_bytes*4+H.material_index_bytes;na=H.vertex_index_bytes*4+H.material_index_bytes+H.normal_index_bytes;R=H.vertex_index_bytes*4+H.material_index_bytes+H.normal_index_bytes*2;ia=H.vertex_index_bytes*4+H.material_index_bytes+H.normal_index_bytes*3;aa=H.uv_index_bytes;ma=H.uv_index_bytes*2;fa=H.uv_index_bytes;ga=H.uv_index_bytes*2;da=H.uv_index_bytes*3;c=H.vertex_index_bytes*3+H.material_index_bytes;qa=H.vertex_index_bytes*
4+H.material_index_bytes;$=H.ntri_flat*c;ca=H.ntri_smooth*(c+H.normal_index_bytes*3);X=H.ntri_flat_uv*(c+H.uv_index_bytes*3);ja=H.ntri_smooth_uv*(c+H.normal_index_bytes*3+H.uv_index_bytes*3);ea=H.nquad_flat*qa;c=H.nquad_smooth*(qa+H.normal_index_bytes*4);qa=H.nquad_flat_uv*(qa+H.uv_index_bytes*4);G+=function(c){for(var f,h,m,n=H.vertex_coordinate_bytes*3,o=c+H.nvertices*n;c<o;c+=n)f=e(b,c),h=e(b,c+H.vertex_coordinate_bytes),m=e(b,c+H.vertex_coordinate_bytes*2),D.vertices.push(new THREE.Vertex(new THREE.Vector3(f,
h,m)));return H.nvertices*n}(G);G+=function(c){for(var e,f,k,h=H.normal_coordinate_bytes*3,m=c+H.nnormals*h;c<m;c+=h)e=p(b,c),f=p(b,c+H.normal_coordinate_bytes),k=p(b,c+H.normal_coordinate_bytes*2),E.push(e/127,f/127,k/127);return H.nnormals*h}(G);G+=function(c){for(var f,h,m=H.uv_coordinate_bytes*2,n=c+H.nuvs*m;c<n;c+=m)f=e(b,c),h=e(b,c+H.uv_coordinate_bytes),N.push(f,h);return H.nuvs*m}(G);$=G+$;ca=$+ca;X=ca+X;ja=X+ja;ea=ja+ea;c=ea+c;qa=c+qa;(function(b){var c,e=H.vertex_index_bytes*3+H.material_index_bytes,
f=e+H.uv_index_bytes*3,k=b+H.ntri_flat_uv*f;for(c=b;c<k;c+=f)t(c),y(c+e);return k-b})(ca);(function(b){var c,e=H.vertex_index_bytes*3+H.material_index_bytes+H.normal_index_bytes*3,f=e+H.uv_index_bytes*3,k=b+H.ntri_smooth_uv*f;for(c=b;c<k;c+=f)x(c),y(c+e);return k-b})(X);(function(b){var c,e=H.vertex_index_bytes*4+H.material_index_bytes,f=e+H.uv_index_bytes*4,k=b+H.nquad_flat_uv*f;for(c=b;c<k;c+=f)w(c),B(c+e);return k-b})(c);(function(b){var c,e=H.vertex_index_bytes*4+H.material_index_bytes+H.normal_index_bytes*
4,f=e+H.uv_index_bytes*4,k=b+H.nquad_smooth_uv*f;for(c=b;c<k;c+=f)z(c),B(c+e);return k-b})(qa);(function(b){var c,e=H.vertex_index_bytes*3+H.material_index_bytes,f=b+H.ntri_flat*e;for(c=b;c<f;c+=e)t(c);return f-b})(G);(function(b){var c,e=H.vertex_index_bytes*3+H.material_index_bytes+H.normal_index_bytes*3,f=b+H.ntri_smooth*e;for(c=b;c<f;c+=e)x(c);return f-b})($);(function(b){var c,e=H.vertex_index_bytes*4+H.material_index_bytes,f=b+H.nquad_flat*e;for(c=b;c<f;c+=e)w(c);return f-b})(ja);(function(b){var c,
e=H.vertex_index_bytes*4+H.material_index_bytes+H.normal_index_bytes*4,f=b+H.nquad_smooth*e;for(c=b;c<f;c+=e)z(c);return f-b})(ea);this.computeCentroids();this.computeFaceNormals();THREE.Loader.prototype.hasNormals(this)&&this.computeTangents()};h.prototype=new THREE.Geometry;h.prototype.constructor=h;c(new h(e))};
var ColladaLoader=function(){function b(b,c,e){for(var b=$.evaluate(b,$,R,XPathResult.ORDERED_NODE_ITERATOR_TYPE,null),f={},k=b.iterateNext(),h=0;k;){k=(new c).parse(k);if(k.id.length==0)k.id=e+h++;f[k.id]=k;k=b.iterateNext()}return f}function c(){var b=1E6,c=-b,e=0,f;for(f in qa)for(var k=qa[f],h=0;h<k.sampler.length;h++){var m=k.sampler[h];m.create();b=Math.min(b,m.startTime);c=Math.max(c,m.endTime);e=Math.max(e,m.input.length)}return{start:b,end:c,frames:e}}function e(b,c,f,k){b.world=b.world||
new THREE.Matrix4;b.world.copy(b.matrix);if(b.channels&&b.channels.length){var h=b.channels[0].sampler.output[f];h instanceof THREE.Matrix4&&b.world.copy(h)}k&&b.world.multiply(k,b.world);c.push(b);for(k=0;k<b.nodes.length;k++)e(b.nodes[k],c,f,b.world)}function f(b,f,k){var h=V[f.url];if(!h||!h.skin)console.log("could not find skin controller!");else if(!f.skeleton||!f.skeleton.length)console.log("could not find the skeleton for the skin!");else{var m=c(),f=X.getChildById(f.skeleton[0],!0)||X.getChildBySid(f.skeleton[0],
!0),n,o,p,t,v=new THREE.Vector3,u;for(n=0;n<b.vertices.length;n++)h.skin.bindShapeMatrix.multiplyVector3(b.vertices[n].position);for(k=0;k<m.frames;k++){var w=[],x=[];for(n=0;n<b.vertices.length;n++)x.push(new THREE.Vertex(new THREE.Vector3));e(f,w,k);n=w;o=h.skin;for(t=0;t<n.length;t++){p=n[t];u=-1;for(var y=0;y<o.joints.length;y++)if(p.sid==o.joints[y]){u=y;break}if(u>=0){y=o.invBindMatrices[u];p.invBindMatrix=y;p.skinningMatrix=new THREE.Matrix4;p.skinningMatrix.multiply(p.world,y);p.weights=[];
for(y=0;y<o.weights.length;y++)for(var z=0;z<o.weights[y].length;z++){var B=o.weights[y][z];B.joint==u&&p.weights.push(B)}}else throw"could not find joint!";}for(n=0;n<w.length;n++)for(o=0;o<w[n].weights.length;o++)p=w[n].weights[o],t=p.index,p=p.weight,u=b.vertices[t],t=x[t],v.x=u.position.x,v.y=u.position.y,v.z=u.position.z,w[n].skinningMatrix.multiplyVector3(v),t.position.x+=v.x*p,t.position.y+=v.y*p,t.position.z+=v.z*p;b.morphTargets.push({name:"target_"+k,vertices:x})}}}function h(b){var c=new THREE.Object3D,
e,k,m;c.name=b.id||"";c.matrixAutoUpdate=!1;c.matrix=b.matrix;for(m=0;m<b.controllers.length;m++){var n=V[b.controllers[m].url];switch(n.type){case "skin":if(pa[n.skin.source]){var o=new z;o.url=n.skin.source;o.instance_material=b.controllers[m].instance_material;b.geometries.push(o);e=b.controllers[m]}else if(V[n.skin.source]&&(k=n=V[n.skin.source],n.morph&&pa[n.morph.source]))o=new z,o.url=n.morph.source,o.instance_material=b.controllers[m].instance_material,b.geometries.push(o);break;case "morph":if(pa[n.morph.source])o=
new z,o.url=n.morph.source,o.instance_material=b.controllers[m].instance_material,b.geometries.push(o),k=b.controllers[m];console.log("DAE: morph-controller partially supported.")}}for(m=0;m<b.geometries.length;m++){var n=b.geometries[m],o=n.instance_material,n=pa[n.url],p={},t=0,v;if(n&&n.mesh&&n.mesh.primitives){if(c.name.length==0)c.name=n.id;if(o)for(j=0;j<o.length;j++){v=o[j];var u=ra[va[v.target].instance_effect.url].shader;u.material.opacity=!u.material.opacity?1:u.material.opacity;v=p[v.symbol]=
u.material;t++}o=v||new THREE.MeshLambertMaterial({color:14540253,shading:THREE.FlatShading});n=n.mesh.geometry3js;if(t>1){o=new THREE.MeshFaceMaterial;for(j=0;j<n.faces.length;j++)t=n.faces[j],t.materials=[p[t.daeMaterial]]}if(e!==void 0)f(n,e),o.morphTargets=!0,o=new THREE.SkinnedMesh(n,o),o.skeleton=e.skeleton,o.skinController=V[e.url],o.skinInstanceController=e,o.name="skin_"+za.length,za.push(o);else if(k!==void 0){p=n;t=k instanceof x?V[k.url]:k;if(!t||!t.morph)console.log("could not find morph controller!");
else{t=t.morph;for(u=0;u<t.targets.length;u++){var w=pa[t.targets[u]];if(w.mesh&&w.mesh.primitives&&w.mesh.primitives.length)w=w.mesh.primitives[0].geometry,w.vertices.length===p.vertices.length&&p.morphTargets.push({name:"target_1",vertices:w.vertices})}p.morphTargets.push({name:"target_Z",vertices:p.vertices})}o.morphTargets=!0;o=new THREE.Mesh(n,o);o.name="morph_"+Aa.length;Aa.push(o)}else o=new THREE.Mesh(n,o);c.addChild(o)}}for(m=0;m<b.nodes.length;m++)c.addChild(h(b.nodes[m],b));return c}function m(){this.init_from=
this.id=""}function k(){this.type=this.name=this.id="";this.morph=this.skin=null}function n(){this.weights=this.targets=this.source=this.method=null}function u(){this.source="";this.bindShapeMatrix=null;this.invBindMatrices=[];this.joints=[];this.weights=[]}function p(){this.name=this.id="";this.nodes=[];this.scene=new THREE.Object3D}function v(){this.sid=this.name=this.id="";this.nodes=[];this.controllers=[];this.transforms=[];this.geometries=[];this.channels=[];this.matrix=new THREE.Matrix4}function t(){this.type=
this.sid="";this.data=[];this.matrix=new THREE.Matrix4}function x(){this.url="";this.skeleton=[];this.instance_material=[]}function w(){this.target=this.symbol=""}function z(){this.url="";this.instance_material=[]}function y(){this.id="";this.mesh=null}function B(b){this.geometry=b.id;this.primitives=[];this.geometry3js=this.vertices=null}function D(){}function G(){this.material="";this.count=0;this.inputs=[];this.vcount=null;this.p=[];this.geometry=new THREE.Geometry}function H(){this.source="";
this.stride=this.count=0;this.params=[]}function E(){this.input={}}function N(){this.semantic="";this.offset=0;this.source="";this.set=0}function F(b){this.id=b;this.type=null}function I(){this.name=this.id="";this.instance_effect=null}function C(){this.color=new THREE.Color(0);this.color.setRGB(Math.random(),Math.random(),Math.random());this.color.a=1;this.texcoord=this.texture=null}function K(b,c){this.type=b;this.effect=c;this.material=null}function U(b){this.effect=b;this.format=this.init_from=
null}function L(b){this.effect=b;this.mipfilter=this.magfilter=this.minfilter=this.wrap_t=this.wrap_s=this.source=null}function O(){this.name=this.id="";this.sampler=this.surface=this.shader=null}function S(){this.url=""}function P(){this.name=this.id="";this.source={};this.sampler=[];this.channel=[]}function o(b){this.animation=b;this.target=this.source="";this.member=this.arrIndices=this.arrSyntax=this.dotSyntax=this.sid=null}function W(b){this.id="";this.animation=b;this.inputs=[];this.endTime=
this.startTime=this.interpolation=this.output=this.input=null;this.duration=0}function na(b){var c=b.getAttribute("id");if(ja[c]!=void 0)return ja[c];ja[c]=(new F(c)).parse(b);return ja[c]}function R(b){if(b=="dae")return"http://www.collada.org/2005/11/COLLADASchema";return null}function ia(b){for(var b=ma(b),c=[],e=0;e<b.length;e++)c.push(parseFloat(b[e]));return c}function aa(b){for(var b=ma(b),c=[],e=0;e<b.length;e++)c.push(parseInt(b[e],10));return c}function ma(b){return b.replace(/^\s+/,"").replace(/\s+$/,
"").split(/\s+/)}function fa(b,c,e){return b.hasAttribute(c)?parseInt(b.getAttribute(c),10):e}function ga(b,c){if(b===void 0){for(var e="0.";e.length<c+2;)e+="0";return e}c=c||2;e=b.toString().split(".");for(e[1]=e.length>1?e[1].substr(0,c):"0";e[1].length<c;)e[1]+="0";return e.join(".")}function da(b,c){var e="";e+=ga(b.x,c)+",";e+=ga(b.y,c)+",";e+=ga(b.z,c);return e}var $=null,ca=null,X,ja={},ea={},qa={},V={},pa={},va={},ra={},sa,Ca=null,wa,Aa,za,Fa=THREE.SmoothShading;m.prototype.parse=function(b){this.id=
b.getAttribute("id");for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeName=="init_from")this.init_from=e.textContent}return this};k.prototype.parse=function(b){this.id=b.getAttribute("id");this.name=b.getAttribute("name");this.type="none";for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];switch(e.nodeName){case "skin":this.skin=(new u).parse(e);this.type=e.nodeName;break;case "morph":this.morph=(new n).parse(e),this.type=e.nodeName}}return this};n.prototype.parse=function(b){var c=
{},e=[],f;this.method=b.getAttribute("method");this.source=b.getAttribute("source").replace(/^#/,"");for(f=0;f<b.childNodes.length;f++){var k=b.childNodes[f];if(k.nodeType==1)switch(k.nodeName){case "source":k=(new F).parse(k);c[k.id]=k;break;case "targets":e=this.parseInputs(k);break;default:console.log(k.nodeName)}}for(f=0;f<e.length;f++)switch(b=e[f],k=c[b.source],b.semantic){case "MORPH_TARGET":this.targets=k.read();break;case "MORPH_WEIGHT":this.weights=k.read()}return this};n.prototype.parseInputs=
function(b){for(var c=[],e=0;e<b.childNodes.length;e++){var f=b.childNodes[e];if(f.nodeType==1)switch(f.nodeName){case "input":c.push((new N).parse(f))}}return c};u.prototype.parse=function(b){var c={},e,f;this.source=b.getAttribute("source").replace(/^#/,"");this.invBindMatrices=[];this.joints=[];this.weights=[];for(var k=0;k<b.childNodes.length;k++){var h=b.childNodes[k];if(h.nodeType==1)switch(h.nodeName){case "bind_shape_matrix":h=ia(h.textContent);this.bindShapeMatrix=new THREE.Matrix4;this.bindShapeMatrix.set(h[0],
h[1],h[2],h[3],h[4],h[5],h[6],h[7],h[8],h[9],h[10],h[11],h[12],h[13],h[14],h[15]);break;case "source":h=(new F).parse(h);c[h.id]=h;break;case "joints":e=h;break;case "vertex_weights":f=h;break;default:console.log(h.nodeName)}}this.parseJoints(e,c);this.parseWeights(f,c);return this};u.prototype.parseJoints=function(b,c){for(var e=0;e<b.childNodes.length;e++){var f=b.childNodes[e];if(f.nodeType==1)switch(f.nodeName){case "input":var f=(new N).parse(f),k=c[f.source];if(f.semantic=="JOINT")this.joints=
k.read();else if(f.semantic=="INV_BIND_MATRIX")this.invBindMatrices=k.read()}}};u.prototype.parseWeights=function(b,c){for(var e,f,k=[],h=0;h<b.childNodes.length;h++){var m=b.childNodes[h];if(m.nodeType==1)switch(m.nodeName){case "input":k.push((new N).parse(m));break;case "v":e=aa(m.textContent);break;case "vcount":f=aa(m.textContent)}}for(h=m=0;h<f.length;h++){for(var n=f[h],o=[],p=0;p<n;p++){for(var t={},u=0;u<k.length;u++){var v=k[u],w=e[m+v.offset];switch(v.semantic){case "JOINT":t.joint=w;break;
case "WEIGHT":t.weight=c[v.source].data[w]}}o.push(t);m+=k.length}for(p=0;p<o.length;p++)o[p].index=h;this.weights.push(o)}};p.prototype.getChildById=function(b,c){for(var e=0;e<this.nodes.length;e++){var f=this.nodes[e].getChildById(b,c);if(f)return f}return null};p.prototype.getChildBySid=function(b,c){for(var e=0;e<this.nodes.length;e++){var f=this.nodes[e].getChildBySid(b,c);if(f)return f}return null};p.prototype.parse=function(b){this.id=b.getAttribute("id");this.name=b.getAttribute("name");
this.nodes=[];for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeType==1)switch(e.nodeName){case "node":this.nodes.push((new v).parse(e))}}return this};v.prototype.getChannelForTransform=function(b){for(var c=0;c<this.channels.length;c++){var e=this.channels[c],f=e.target.split("/");f.shift();var k=f.shift(),h=k.indexOf(".")>=0,m=k.indexOf("(")>=0,n;if(h)f=k.split("."),k=f.shift(),f.shift();else if(m){n=k.split("(");k=n.shift();for(f=0;f<n.length;f++)n[f]=parseInt(n[f].replace(/\)/,
""))}if(k==b)return e.info={sid:k,dotSyntax:h,arrSyntax:m,arrIndices:n},e}return null};v.prototype.getChildById=function(b,c){if(this.id==b)return this;if(c)for(var e=0;e<this.nodes.length;e++){var f=this.nodes[e].getChildById(b,c);if(f)return f}return null};v.prototype.getChildBySid=function(b,c){if(this.sid==b)return this;if(c)for(var e=0;e<this.nodes.length;e++){var f=this.nodes[e].getChildBySid(b,c);if(f)return f}return null};v.prototype.getTransformBySid=function(b){for(var c=0;c<this.transforms.length;c++)if(this.transforms[c].sid==
b)return this.transforms[c];return null};v.prototype.parse=function(b){var c;this.id=b.getAttribute("id");this.sid=b.getAttribute("sid");this.name=b.getAttribute("name");this.type=b.getAttribute("type");this.type=this.type=="JOINT"?this.type:"NODE";this.nodes=[];this.transforms=[];this.geometries=[];this.controllers=[];this.matrix=new THREE.Matrix4;for(var e=0;e<b.childNodes.length;e++)if(c=b.childNodes[e],c.nodeType==1)switch(c.nodeName){case "node":this.nodes.push((new v).parse(c));break;case "instance_camera":break;
case "instance_controller":this.controllers.push((new x).parse(c));break;case "instance_geometry":this.geometries.push((new z).parse(c));break;case "instance_light":break;case "instance_node":c=c.getAttribute("url").replace(/^#/,"");(c=$.evaluate(".//dae:library_nodes//dae:node[@id='"+c+"']",$,R,XPathResult.ORDERED_NODE_ITERATOR_TYPE,null).iterateNext())&&this.nodes.push((new v).parse(c));break;case "rotate":case "translate":case "scale":case "matrix":case "lookat":case "skew":this.transforms.push((new t).parse(c));
break;case "extra":break;default:console.log(c.nodeName)}b=[];e=1E6;c=-1E6;for(var f in qa)for(var k=qa[f],h=0;h<k.channel.length;h++){var m=k.channel[h],n=k.sampler[h];f=m.target.split("/")[0];if(f==this.id)n.create(),m.sampler=n,e=Math.min(e,n.startTime),c=Math.max(c,n.endTime),b.push(m)}if(b.length)this.startTime=e,this.endTime=c;if((this.channels=b)&&this.channels.length){f=1E7;for(i=0;i<this.channels.length;i++){b=this.channels[i].sampler;for(e=0;e<b.input.length-1;e++)f=Math.min(f,b.input[e+
1]-b.input[e])}e=[];for(b=this.startTime;b<this.endTime;b+=f){c=b;for(var k={},o=h=void 0,h=0;h<this.channels.length;h++)o=this.channels[h],k[o.sid]=o;m=new THREE.Matrix4;for(h=0;h<this.transforms.length;h++)if(n=this.transforms[h],o=k[n.sid],o!==void 0){for(var p=o.sampler,u,o=0;o<p.input.length-1;o++)if(p.input[o+1]>c){u=p.output[o];break}m=u!==void 0?u instanceof THREE.Matrix4?m.multiply(m,u):m.multiply(m,n.matrix):m.multiply(m,n.matrix)}else m=m.multiply(m,n.matrix);c=m;e.push({time:b,pos:[c.n14,
c.n24,c.n34],rotq:[0,0,0,1],scl:[1,1,1]})}this.keys=e}this.updateMatrix();return this};v.prototype.updateMatrix=function(){this.matrix.identity();for(var b=0;b<this.transforms.length;b++)this.matrix.multiply(this.matrix,this.transforms[b].matrix)};t.prototype.parse=function(b){this.sid=b.getAttribute("sid");this.type=b.nodeName;this.data=ia(b.textContent);this.updateMatrix();return this};t.prototype.updateMatrix=function(){var b=0;this.matrix.identity();switch(this.type){case "matrix":this.matrix.set(this.data[0],
this.data[1],this.data[2],this.data[3],this.data[4],this.data[5],this.data[6],this.data[7],this.data[8],this.data[9],this.data[10],this.data[11],this.data[12],this.data[13],this.data[14],this.data[15]);break;case "translate":this.matrix.setTranslation(this.data[0],this.data[1],this.data[2]);break;case "rotate":b=this.data[3]*(Math.PI/180);this.matrix.setRotationAxis(new THREE.Vector3(this.data[0],this.data[1],this.data[2]),b);break;case "scale":this.matrix.setScale(this.data[0],this.data[1],this.data[2])}return this.matrix};
x.prototype.parse=function(b){this.url=b.getAttribute("url").replace(/^#/,"");this.skeleton=[];this.instance_material=[];for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeType==1)switch(e.nodeName){case "skeleton":this.skeleton.push(e.textContent.replace(/^#/,""));break;case "bind_material":if(e=$.evaluate(".//dae:instance_material",e,R,XPathResult.ORDERED_NODE_ITERATOR_TYPE,null))for(var f=e.iterateNext();f;)this.instance_material.push((new w).parse(f)),f=e.iterateNext()}}return this};
w.prototype.parse=function(b){this.symbol=b.getAttribute("symbol");this.target=b.getAttribute("target").replace(/^#/,"");return this};z.prototype.parse=function(b){this.url=b.getAttribute("url").replace(/^#/,"");this.instance_material=[];for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeType==1&&e.nodeName=="bind_material"){if(b=$.evaluate(".//dae:instance_material",e,R,XPathResult.ORDERED_NODE_ITERATOR_TYPE,null))for(c=b.iterateNext();c;)this.instance_material.push((new w).parse(c)),
c=b.iterateNext();break}}return this};y.prototype.parse=function(b){this.id=b.getAttribute("id");for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];switch(e.nodeName){case "mesh":this.mesh=(new B(this)).parse(e)}}return this};B.prototype.parse=function(b){function c(b,e){var f=da(b.position);k[f]===void 0&&(k[f]={v:b,index:e});return k[f]}this.primitives=[];var e;for(e=0;e<b.childNodes.length;e++){var f=b.childNodes[e];switch(f.nodeName){case "source":na(f);break;case "vertices":this.vertices=
(new E).parse(f);break;case "triangles":this.primitives.push((new G).parse(f));break;case "polygons":console.warn("polygon holes not yet supported!");case "polylist":this.primitives.push((new D).parse(f))}}var k={};this.geometry3js=new THREE.Geometry;f=ja[this.vertices.input.POSITION.source].data;for(b=e=0;e<f.length;e+=3,b++){var h=new THREE.Vertex(new THREE.Vector3(f[e],f[e+1],f[e+2]));c(h,b);this.geometry3js.vertices.push(h)}for(e=0;e<this.primitives.length;e++)primitive=this.primitives[e],primitive.setVertices(this.vertices),
this.handlePrimitive(primitive,this.geometry3js,k);this.geometry3js.computeCentroids();this.geometry3js.computeFaceNormals();this.geometry3js.computeVertexNormals();this.geometry3js.computeBoundingBox();return this};B.prototype.handlePrimitive=function(b,c,e){var f=0,k,h,m=b.p,n=b.inputs,o,p,t,u=0,v=3,w=[];for(k=0;k<n.length;k++)o=n[k],o.semantic=="TEXCOORD"&&w.push(o.set);for(;f<m.length;){var x=[],y=[],z={};b.vcount&&(v=b.vcount[u++]);for(k=0;k<v;k++)for(h=0;h<n.length;h++)switch(o=n[h],source=
ja[o.source],p=m[f+k*n.length+o.offset],numParams=source.accessor.params.length,t=p*numParams,o.semantic){case "VERTEX":o=da(c.vertices[p].position);x.push(e[o].index);break;case "NORMAL":y.push(new THREE.Vector3(source.data[t+0],source.data[t+1],source.data[t+2]));break;case "TEXCOORD":z[o.set]===void 0&&(z[o.set]=[]),z[o.set].push(new THREE.UV(source.data[t+0],source.data[t+1]))}h=new THREE.Face3(x[0],x[1],x[2],[y[0],y[1],y[2]]);h.daeMaterial=b.material;c.faces.push(h);for(h=0;h<w.length;h++)o=
z[w[h]],c.faceVertexUvs[h].push([o[0],o[1],o[2]]);if(v>3)for(k=2;k<x.length-1;k++){h=new THREE.Face3(x[0],x[k],x[k+1],[y[0],y[k],y[k+1]]);h.daeMaterial=b.material;c.faces.push(h);for(h=0;h<w.length;h++)o=z[w[h]],c.faceVertexUvs[h].push([o[0],o[k],o[k+1]])}f+=n.length*v}};D.prototype=new G;D.prototype.constructor=D;G.prototype.setVertices=function(b){for(var c=0;c<this.inputs.length;c++)if(this.inputs[c].source==b.id)this.inputs[c].source=b.input.POSITION.source};G.prototype.parse=function(b){this.inputs=
[];this.material=b.getAttribute("material");this.count=fa(b,"count",0);for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];switch(e.nodeName){case "input":this.inputs.push((new N).parse(b.childNodes[c]));break;case "vcount":this.vcount=aa(e.textContent);break;case "p":this.p=aa(e.textContent)}}return this};H.prototype.parse=function(b){this.params=[];this.source=b.getAttribute("source");this.count=fa(b,"count",0);this.stride=fa(b,"stride",0);for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];
if(e.nodeName=="param"){var f={};f.name=e.getAttribute("name");f.type=e.getAttribute("type");this.params.push(f)}}return this};E.prototype.parse=function(b){this.id=b.getAttribute("id");for(var c=0;c<b.childNodes.length;c++)b.childNodes[c].nodeName=="input"&&(input=(new N).parse(b.childNodes[c]),this.input[input.semantic]=input);return this};N.prototype.parse=function(b){this.semantic=b.getAttribute("semantic");this.source=b.getAttribute("source").replace(/^#/,"");this.set=fa(b,"set",-1);this.offset=
fa(b,"offset",0);if(this.semantic=="TEXCOORD"&&this.set<0)this.set=0;return this};F.prototype.parse=function(b){this.id=b.getAttribute("id");for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];switch(e.nodeName){case "bool_array":for(var f=ma(e.textContent),k=[],h=0;h<f.length;h++)k.push(f[h]=="true"||f[h]=="1"?!0:!1);this.data=k;this.type=e.nodeName;break;case "float_array":this.data=ia(e.textContent);this.type=e.nodeName;break;case "int_array":this.data=aa(e.textContent);this.type=e.nodeName;
break;case "IDREF_array":case "Name_array":this.data=ma(e.textContent);this.type=e.nodeName;break;case "technique_common":for(f=0;f<e.childNodes.length;f++)if(e.childNodes[f].nodeName=="accessor"){this.accessor=(new H).parse(e.childNodes[f]);break}}}return this};F.prototype.read=function(){var b=[],c=this.accessor.params[0];switch(c.type){case "IDREF":case "Name":case "float":return this.data;case "float4x4":for(c=0;c<this.data.length;c+=16){var e=this.data.slice(c,c+16),f=new THREE.Matrix4;f.set(e[0],
e[1],e[2],e[3],e[4],e[5],e[6],e[7],e[8],e[9],e[10],e[11],e[12],e[13],e[14],e[15]);b.push(f)}break;default:console.log("Dae::Source:read dont know how to read "+c.type)}return b};I.prototype.parse=function(b){this.id=b.getAttribute("id");this.name=b.getAttribute("name");for(var c=0;c<b.childNodes.length;c++)if(b.childNodes[c].nodeName=="instance_effect"){this.instance_effect=(new S).parse(b.childNodes[c]);break}return this};C.prototype.isColor=function(){return this.texture==null};C.prototype.isTexture=
function(){return this.texture!=null};C.prototype.parse=function(b){for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeType==1)switch(e.nodeName){case "color":e=ia(e.textContent);this.color=new THREE.Color(0);this.color.setRGB(e[0],e[1],e[2]);this.color.a=e[3];break;case "texture":this.texture=e.getAttribute("texture"),this.texcoord=e.getAttribute("texcoord")}}return this};K.prototype.parse=function(b){for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeType==
1)switch(e.nodeName){case "ambient":case "emission":case "diffuse":case "specular":case "transparent":this[e.nodeName]=(new C).parse(e);break;case "shininess":case "reflectivity":case "transparency":var f;f=$.evaluate(".//dae:float",e,R,XPathResult.ORDERED_NODE_ITERATOR_TYPE,null);for(var k=f.iterateNext(),h=[];k;)h.push(k),k=f.iterateNext();f=h;f.length>0&&(this[e.nodeName]=parseFloat(f[0].textContent))}}this.create();return this};K.prototype.create=function(){var b={},c=this.transparency!==void 0&&
this.transparency<1,e;for(e in this)switch(e){case "ambient":case "emission":case "diffuse":case "specular":var f=this[e];if(f instanceof C)if(f.isTexture()){if(this.effect.sampler&&this.effect.surface&&this.effect.sampler.source==this.effect.surface.sid&&(f=ea[this.effect.surface.init_from]))b.map=THREE.ImageUtils.loadTexture(wa+f.init_from),b.map.wrapS=THREE.RepeatWrapping,b.map.wrapT=THREE.RepeatWrapping,b.map.repeat.x=1,b.map.repeat.y=-1}else e=="diffuse"?b.color=f.color.getHex():c||(b[e]=f.color.getHex());
break;case "shininess":case "reflectivity":b[e]=this[e];break;case "transparency":if(c)b.transparent=!0,b.opacity=this[e],c=!0}b.shading=Fa;return this.material=new THREE.MeshLambertMaterial(b)};U.prototype.parse=function(b){for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeType==1)switch(e.nodeName){case "init_from":this.init_from=e.textContent;break;case "format":this.format=e.textContent;break;default:console.log("unhandled Surface prop: "+e.nodeName)}}return this};L.prototype.parse=
function(b){for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeType==1)switch(e.nodeName){case "source":this.source=e.textContent;break;case "minfilter":this.minfilter=e.textContent;break;case "magfilter":this.magfilter=e.textContent;break;case "mipfilter":this.mipfilter=e.textContent;break;case "wrap_s":this.wrap_s=e.textContent;break;case "wrap_t":this.wrap_t=e.textContent;break;default:console.log("unhandled Sampler2D prop: "+e.nodeName)}}return this};O.prototype.create=function(){if(this.shader==
null)return null};O.prototype.parse=function(b){this.id=b.getAttribute("id");this.name=b.getAttribute("name");this.shader=null;for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeType==1)switch(e.nodeName){case "profile_COMMON":this.parseTechnique(this.parseProfileCOMMON(e))}}return this};O.prototype.parseNewparam=function(b){for(var c=b.getAttribute("sid"),e=0;e<b.childNodes.length;e++){var f=b.childNodes[e];if(f.nodeType==1)switch(f.nodeName){case "surface":this.surface=(new U(this)).parse(f);
this.surface.sid=c;break;case "sampler2D":this.sampler=(new L(this)).parse(f);this.sampler.sid=c;break;case "extra":break;default:console.log(f.nodeName)}}};O.prototype.parseProfileCOMMON=function(b){for(var c,e=0;e<b.childNodes.length;e++){var f=b.childNodes[e];if(f.nodeType==1)switch(f.nodeName){case "profile_COMMON":this.parseProfileCOMMON(f);break;case "technique":c=f;break;case "newparam":this.parseNewparam(f);break;case "extra":break;default:console.log(f.nodeName)}}return c};O.prototype.parseTechnique=
function(b){for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeType==1)switch(e.nodeName){case "lambert":case "blinn":case "phong":this.shader=(new K(e.nodeName,this)).parse(e)}}};S.prototype.parse=function(b){this.url=b.getAttribute("url").replace(/^#/,"");return this};P.prototype.parse=function(b){this.id=b.getAttribute("id");this.name=b.getAttribute("name");this.source={};for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeType==1)switch(e.nodeName){case "source":e=
(new F).parse(e);this.source[e.id]=e;break;case "sampler":this.sampler.push((new W(this)).parse(e));break;case "channel":this.channel.push((new o(this)).parse(e))}}return this};o.prototype.parse=function(b){this.source=b.getAttribute("source").replace(/^#/,"");this.target=b.getAttribute("target");var c=this.target.split("/");c.shift();var b=c.shift(),e=b.indexOf(".")>=0,f=b.indexOf("(")>=0,k,h;if(e)c=b.split("."),b=c.shift(),h=c.shift();else if(f){k=b.split("(");b=k.shift();for(c=0;c<k.length;c++)k[c]=
parseInt(k[c].replace(/\)/,""))}this.sid=b;this.dotSyntax=e;this.arrSyntax=f;this.arrIndices=k;this.member=h;return this};W.prototype.parse=function(b){this.id=b.getAttribute("id");this.inputs=[];for(var c=0;c<b.childNodes.length;c++){var e=b.childNodes[c];if(e.nodeType==1)switch(e.nodeName){case "input":this.inputs.push((new N).parse(e))}}return this};W.prototype.create=function(){for(var b=0;b<this.inputs.length;b++){var c=this.inputs[b],e=this.animation.source[c.source];switch(c.semantic){case "INPUT":this.input=
e.read();break;case "OUTPUT":this.output=e.read();break;case "INTERPOLATION":this.interpolation=e.read();break;case "IN_TANGENT":break;case "OUT_TANGENT":break;default:console.log(c.semantic)}}this.duration=this.endTime=this.startTime=0;if(this.input.length){this.startTime=1E8;this.endTime=-1E8;for(b=0;b<this.input.length;b++)this.startTime=Math.min(this.startTime,this.input[b]),this.endTime=Math.max(this.endTime,this.input[b]);this.duration=this.endTime-this.startTime}};return{load:function(e,f){if(document.implementation&&
document.implementation.createDocument){document.implementation.createDocument("http://www.collada.org/2005/11/COLLADASchema","COLLADA",null);e+="?rnd="+Math.random();var n=new XMLHttpRequest;n.overrideMimeType&&n.overrideMimeType("text/xml");n.onreadystatechange=function(){if(n.readyState==4&&(n.status==0||n.status==200)){Ca=f;var o,t=e;$=n.responseXML;o=Ca;t!==void 0&&(t=t.split("/"),t.pop(),wa=t.join("/")+"/");ea=b("//dae:library_images/dae:image",m,"image");va=b("//dae:library_materials/dae:material",
I,"material");ra=b("//dae:library_effects/dae:effect",O,"effect");pa=b("//dae:library_geometries/dae:geometry",y,"geometry");V=b("//dae:library_controllers/dae:controller",k,"controller");qa=b("//dae:library_animations/dae:animation",P,"animation");sa=b(".//dae:library_visual_scenes/dae:visual_scene",p,"visual_scene");Aa=[];za=[];(t=$.evaluate(".//dae:scene/dae:instance_visual_scene",$,R,XPathResult.ORDERED_NODE_ITERATOR_TYPE,null).iterateNext())?(t=t.getAttribute("url").replace(/^#/,""),X=sa[t]):
X=null;ca=new THREE.Object3D;for(t=0;t<X.nodes.length;t++)ca.addChild(h(X.nodes[t]));c();for(var u in qa);u={scene:ca,morphs:Aa,skins:za,dae:{images:ea,materials:va,effects:ra,geometries:pa,controllers:V,animations:qa,visualScenes:sa,scene:X}};o&&o(u)}};n.open("GET",e,!0);n.send(null)}else alert("Don't know how to parse XML!")},setPreferredShading:function(b){Fa=b},applySkin:f,geometries:pa}};THREE.JSONLoader=function(b){THREE.Loader.call(this,b)};THREE.JSONLoader.prototype=new THREE.Loader;
THREE.JSONLoader.prototype.constructor=THREE.JSONLoader;THREE.JSONLoader.prototype.supr=THREE.Loader.prototype;THREE.JSONLoader.prototype.load=function(b){var c=this,e=b.model,f=b.callback,h=b.texture_path?b.texture_path:this.extractUrlbase(e),b=new Worker(e);b.onmessage=function(b){c.createModel(b.data,f,h);c.onLoadComplete()};this.onLoadStart();b.postMessage((new Date).getTime())};
THREE.JSONLoader.prototype.createModel=function(b,c,e){var f=new THREE.Geometry,h=b.scale!==void 0?1/b.scale:1;this.init_materials(f,b.materials,e);(function(c){if(b.version===void 0||b.version!=2)console.error("Deprecated file format.");else{var e,h,u,p,v,t,x,w,z,y,B,D,G,H,E=b.faces;t=b.vertices;var N=b.normals,F=b.colors,I=0;for(e=0;e<b.uvs.length;e++)b.uvs[e].length&&I++;for(e=0;e<I;e++)f.faceUvs[e]=[],f.faceVertexUvs[e]=[];p=0;for(v=t.length;p<v;)x=new THREE.Vertex,x.position.x=t[p++]*c,x.position.y=
t[p++]*c,x.position.z=t[p++]*c,f.vertices.push(x);p=0;for(v=E.length;p<v;){c=E[p++];t=c&1;u=c&2;e=c&4;h=c&8;w=c&16;x=c&32;y=c&64;c&=128;t?(B=new THREE.Face4,B.a=E[p++],B.b=E[p++],B.c=E[p++],B.d=E[p++],t=4):(B=new THREE.Face3,B.a=E[p++],B.b=E[p++],B.c=E[p++],t=3);if(u)u=E[p++],B.materials=f.materials[u];u=f.faces.length;if(e)for(e=0;e<I;e++)D=b.uvs[e],z=E[p++],H=D[z*2],z=D[z*2+1],f.faceUvs[e][u]=new THREE.UV(H,z);if(h)for(e=0;e<I;e++){D=b.uvs[e];G=[];for(h=0;h<t;h++)z=E[p++],H=D[z*2],z=D[z*2+1],G[h]=
new THREE.UV(H,z);f.faceVertexUvs[e][u]=G}if(w)w=E[p++]*3,h=new THREE.Vector3,h.x=N[w++],h.y=N[w++],h.z=N[w],B.normal=h;if(x)for(e=0;e<t;e++)w=E[p++]*3,h=new THREE.Vector3,h.x=N[w++],h.y=N[w++],h.z=N[w],B.vertexNormals.push(h);if(y)x=E[p++],x=new THREE.Color(F[x]),B.color=x;if(c)for(e=0;e<t;e++)x=E[p++],x=new THREE.Color(F[x]),B.vertexColors.push(x);f.faces.push(B)}}})(h);(function(){var c,e,h,u;if(b.skinWeights){c=0;for(e=b.skinWeights.length;c<e;c+=2)h=b.skinWeights[c],u=b.skinWeights[c+1],f.skinWeights.push(new THREE.Vector4(h,
u,0,0))}if(b.skinIndices){c=0;for(e=b.skinIndices.length;c<e;c+=2)h=b.skinIndices[c],u=b.skinIndices[c+1],f.skinIndices.push(new THREE.Vector4(h,u,0,0))}f.bones=b.bones;f.animation=b.animation})();(function(c){if(b.morphTargets!==void 0){var e,h,u,p,v,t,x,w,z;e=0;for(h=b.morphTargets.length;e<h;e++){f.morphTargets[e]={};f.morphTargets[e].name=b.morphTargets[e].name;f.morphTargets[e].vertices=[];w=f.morphTargets[e].vertices;z=b.morphTargets[e].vertices;u=0;for(p=z.length;u<p;u+=3)v=z[u]*c,t=z[u+1]*
c,x=z[u+2]*c,w.push(new THREE.Vertex(new THREE.Vector3(v,t,x)))}}if(b.morphColors!==void 0){e=0;for(h=b.morphColors.length;e<h;e++){f.morphColors[e]={};f.morphColors[e].name=b.morphColors[e].name;f.morphColors[e].colors=[];p=f.morphColors[e].colors;v=b.morphColors[e].colors;c=0;for(u=v.length;c<u;c+=3)t=new THREE.Color(16755200),t.setRGB(v[c],v[c+1],v[c+2]),p.push(t)}}})(h);(function(){if(b.edges!==void 0){var c,e,h;for(c=0;c<b.edges.length;c+=2)e=b.edges[c],h=b.edges[c+1],f.edges.push(new THREE.Edge(f.vertices[e],
f.vertices[h],e,h))}})();f.computeCentroids();f.computeFaceNormals();this.hasNormals(f)&&f.computeTangents();c(f)};THREE.SceneLoader=function(){this.onLoadStart=function(){};this.onLoadProgress=function(){};this.onLoadComplete=function(){};this.callbackSync=function(){};this.callbackProgress=function(){}};
THREE.SceneLoader.prototype={load:function(b,c){var e=this,f=new Worker(b);f.postMessage(0);var h=THREE.Loader.prototype.extractUrlbase(b);f.onmessage=function(b){function f(b,c){return c=="relativeToHTML"?b:h+"/"+b}function n(){for(w in O.objects)if(!R.objects[w])if(G=O.objects[w],G.geometry!==void 0){if(F=R.geometries[G.geometry]){var b=!1;U=[];for(aa=0;aa<G.materials.length;aa++)U[aa]=R.materials[G.materials[aa]],b=U[aa]instanceof THREE.MeshShaderMaterial;b&&F.computeTangents();H=G.position;r=
G.rotation;q=G.quaternion;s=G.scale;q=0;U.length==0&&(U[0]=new THREE.MeshFaceMaterial);U.length>1&&(U=[new THREE.MeshFaceMaterial]);object=new THREE.Mesh(F,U);object.name=w;object.position.set(H[0],H[1],H[2]);q?(object.quaternion.set(q[0],q[1],q[2],q[3]),object.useQuaternion=!0):object.rotation.set(r[0],r[1],r[2]);object.scale.set(s[0],s[1],s[2]);object.visible=G.visible;R.scene.addObject(object);R.objects[w]=object;G.meshCollider&&(b=THREE.CollisionUtils.MeshColliderWBox(object),R.scene.collisions.colliders.push(b));
if(G.castsShadow)b=new THREE.ShadowVolume(F),R.scene.addChild(b),b.position=object.position,b.rotation=object.rotation,b.scale=object.scale;G.trigger&&G.trigger.toLowerCase()!="none"&&(b={type:G.trigger,object:G},R.triggers[object.name]=b)}}else H=G.position,r=G.rotation,q=G.quaternion,s=G.scale,q=0,object=new THREE.Object3D,object.name=w,object.position.set(H[0],H[1],H[2]),q?(object.quaternion.set(q[0],q[1],q[2],q[3]),object.useQuaternion=!0):object.rotation.set(r[0],r[1],r[2]),object.scale.set(s[0],
s[1],s[2]),object.visible=G.visible!==void 0?G.visible:!1,R.scene.addObject(object),R.objects[w]=object,R.empties[w]=object,G.trigger&&G.trigger.toLowerCase()!="none"&&(b={type:G.trigger,object:G},R.triggers[object.name]=b)}function u(b){return function(c){R.geometries[b]=c;n();P-=1;e.onLoadComplete();v()}}function p(b){return function(c){R.geometries[b]=c}}function v(){e.callbackProgress({totalModels:W,totalTextures:na,loadedModels:W-P,loadedTextures:na-o},R);e.onLoadProgress();P==0&&o==0&&c(R)}
var t,x,w,z,y,B,D,G,H,E,N,F,I,C,K,U,L,O,S,P,o,W,na,R;O=b.data;K=new THREE.BinaryLoader;S=new THREE.JSONLoader;o=P=0;R={scene:new THREE.Scene,geometries:{},materials:{},textures:{},objects:{},cameras:{},lights:{},fogs:{},triggers:{},empties:{}};b=!1;for(w in O.objects)if(G=O.objects[w],G.meshCollider){b=!0;break}if(b)R.scene.collisions=new THREE.CollisionSystem;if(O.transform){b=O.transform.position;E=O.transform.rotation;var ia=O.transform.scale;b&&R.scene.position.set(b[0],b[1],b[2]);E&&R.scene.rotation.set(E[0],
E[1],E[2]);ia&&R.scene.scale.set(ia[0],ia[1],ia[2]);(b||E||ia)&&R.scene.updateMatrix()}b=function(){o-=1;v();e.onLoadComplete()};for(y in O.cameras){E=O.cameras[y];if(E.type=="perspective")I=new THREE.Camera(E.fov,E.aspect,E.near,E.far);else if(E.type=="ortho")I=new THREE.Camera,I.projectionMatrix=THREE.Matrix4.makeOrtho(E.left,E.right,E.top,E.bottom,E.near,E.far);H=E.position;E=E.target;I.position.set(H[0],H[1],H[2]);I.target.position.set(E[0],E[1],E[2]);R.cameras[y]=I}for(z in O.lights)y=O.lights[z],
I=y.color!==void 0?y.color:16777215,E=y.intensity!==void 0?y.intensity:1,y.type=="directional"?(H=y.direction,L=new THREE.DirectionalLight(I,E),L.position.set(H[0],H[1],H[2]),L.position.normalize()):y.type=="point"?(H=y.position,d=y.distance,L=new THREE.PointLight(I,E,d),L.position.set(H[0],H[1],H[2])):y.type=="ambient"&&(L=new THREE.AmbientLight(I)),R.scene.addLight(L),R.lights[z]=L;for(B in O.fogs)z=O.fogs[B],z.type=="linear"?C=new THREE.Fog(0,z.near,z.far):z.type=="exp2"&&(C=new THREE.FogExp2(0,
z.density)),E=z.color,C.color.setRGB(E[0],E[1],E[2]),R.fogs[B]=C;if(R.cameras&&O.defaults.camera)R.currentCamera=R.cameras[O.defaults.camera];if(R.fogs&&O.defaults.fog)R.scene.fog=R.fogs[O.defaults.fog];E=O.defaults.bgcolor;R.bgColor=new THREE.Color;R.bgColor.setRGB(E[0],E[1],E[2]);R.bgColorAlpha=O.defaults.bgalpha;for(t in O.geometries)if(B=O.geometries[t],B.type=="bin_mesh"||B.type=="ascii_mesh")P+=1,e.onLoadStart();W=P;for(t in O.geometries)B=O.geometries[t],B.type=="cube"?(F=new THREE.CubeGeometry(B.width,
B.height,B.depth,B.segmentsWidth,B.segmentsHeight,B.segmentsDepth,null,B.flipped,B.sides),R.geometries[t]=F):B.type=="plane"?(F=new THREE.PlaneGeometry(B.width,B.height,B.segmentsWidth,B.segmentsHeight),R.geometries[t]=F):B.type=="sphere"?(F=new THREE.SphereGeometry(B.radius,B.segmentsWidth,B.segmentsHeight),R.geometries[t]=F):B.type=="cylinder"?(F=new THREE.CylinderGeometry(B.numSegs,B.topRad,B.botRad,B.height,B.topOffset,B.botOffset),R.geometries[t]=F):B.type=="torus"?(F=new THREE.TorusGeometry(B.radius,
B.tube,B.segmentsR,B.segmentsT),R.geometries[t]=F):B.type=="icosahedron"?(F=new THREE.IcosahedronGeometry(B.subdivisions),R.geometries[t]=F):B.type=="bin_mesh"?K.load({model:f(B.url,O.urlBaseType),callback:u(t)}):B.type=="ascii_mesh"?S.load({model:f(B.url,O.urlBaseType),callback:u(t)}):B.type=="embedded_mesh"&&(B=O.embeds[B.id])&&S.createModel(B,p(t),"");for(D in O.textures)if(t=O.textures[D],t.url instanceof Array){o+=t.url.length;for(K=0;K<t.url.length;K++)e.onLoadStart()}else o+=1,e.onLoadStart();
na=o;for(D in O.textures){t=O.textures[D];if(t.mapping!=void 0&&THREE[t.mapping]!=void 0)t.mapping=new THREE[t.mapping];if(t.url instanceof Array){K=[];for(var aa=0;aa<t.url.length;aa++)K[aa]=f(t.url[aa],O.urlBaseType);K=THREE.ImageUtils.loadTextureCube(K,t.mapping,b)}else{K=THREE.ImageUtils.loadTexture(f(t.url,O.urlBaseType),t.mapping,b);if(THREE[t.minFilter]!=void 0)K.minFilter=THREE[t.minFilter];if(THREE[t.magFilter]!=void 0)K.magFilter=THREE[t.magFilter];if(t.repeat){K.repeat.set(t.repeat[0],
t.repeat[1]);if(t.repeat[0]!=1)K.wrapS=THREE.RepeatWrapping;if(t.repeat[1]!=1)K.wrapT=THREE.RepeatWrapping}t.offset&&K.offset.set(t.offset[0],t.offset[1]);if(t.wrap){S={repeat:THREE.RepeatWrapping,mirror:THREE.MirroredRepeatWrapping};if(S[t.wrap[0]]!==void 0)K.wrapS=S[t.wrap[0]];if(S[t.wrap[1]]!==void 0)K.wrapT=S[t.wrap[1]]}}R.textures[D]=K}for(x in O.materials){D=O.materials[x];for(N in D.parameters)if(N=="envMap"||N=="map"||N=="lightMap")D.parameters[N]=R.textures[D.parameters[N]];else if(N=="shading")D.parameters[N]=
D.parameters[N]=="flat"?THREE.FlatShading:THREE.SmoothShading;else if(N=="blending")D.parameters[N]=THREE[D.parameters[N]]?THREE[D.parameters[N]]:THREE.NormalBlending;else if(N=="combine")D.parameters[N]=D.parameters[N]=="MixOperation"?THREE.MixOperation:THREE.MultiplyOperation;else if(N=="vertexColors")if(D.parameters[N]=="face")D.parameters[N]=THREE.FaceColors;else if(D.parameters[N])D.parameters[N]=THREE.VertexColors;if(D.parameters.opacity!==void 0&&D.parameters.opacity<1)D.parameters.transparent=
!0;if(D.parameters.normalMap){t=THREE.ShaderUtils.lib.normal;b=THREE.UniformsUtils.clone(t.uniforms);K=D.parameters.color;S=D.parameters.specular;B=D.parameters.ambient;C=D.parameters.shininess;b.tNormal.texture=R.textures[D.parameters.normalMap];if(D.parameters.normalMapFactor)b.uNormalScale.value=D.parameters.normalMapFactor;if(D.parameters.map)b.tDiffuse.texture=D.parameters.map,b.enableDiffuse.value=!0;if(D.parameters.lightMap)b.tAO.texture=D.parameters.lightMap,b.enableAO.value=!0;if(D.parameters.specularMap)b.tSpecular.texture=
R.textures[D.parameters.specularMap],b.enableSpecular.value=!0;b.uDiffuseColor.value.setHex(K);b.uSpecularColor.value.setHex(S);b.uAmbientColor.value.setHex(B);b.uShininess.value=C;if(D.parameters.opacity)b.uOpacity.value=D.parameters.opacity;D=new THREE.MeshShaderMaterial({fragmentShader:t.fragmentShader,vertexShader:t.vertexShader,uniforms:b,lights:!0,fog:!0})}else D=new THREE[D.type](D.parameters);R.materials[x]=D}n();e.callbackSync(R)}},constructor:THREE.SceneLoader};THREE.UTF8Loader=function(){};
THREE.UTF8Loader.prototype=new THREE.UTF8Loader;THREE.UTF8Loader.prototype.constructor=THREE.UTF8Loader;
THREE.UTF8Loader.prototype.load=function(b){var c=new XMLHttpRequest,e=b.model,f=b.callback,h=b.scale!==void 0?b.scale:1,m=b.offsetX!==void 0?b.offsetX:0,k=b.offsetY!==void 0?b.offsetY:0,n=b.offsetZ!==void 0?b.offsetZ:0;c.onreadystatechange=function(){c.readyState==4?c.status==200||c.status==0?THREE.UTF8Loader.prototype.createModel(c.responseText,f,h,m,k,n):alert("Couldn't load ["+e+"] ["+c.status+"]"):c.readyState!=3&&c.readyState==2&&c.getResponseHeader("Content-Length")};c.open("GET",e,!0);c.send(null)};
THREE.UTF8Loader.prototype.decompressMesh=function(b){var c=b.charCodeAt(0);c>=57344&&(c-=2048);c++;for(var e=new Float32Array(8*c),f=1,h=0;h<8;h++){for(var m=0,k=0;k<c;++k){var n=b.charCodeAt(k+f);m+=n>>1^-(n&1);e[8*k+h]=m}f+=c}c=b.length-f;m=new Uint16Array(c);for(h=k=0;h<c;h++)n=b.charCodeAt(h+f),m[h]=k-n,n==0&&k++;return[e,m]};
THREE.UTF8Loader.prototype.createModel=function(b,c,e,f,h,m){var k=function(){var c=this;c.materials=[];THREE.Geometry.call(this);var k=THREE.UTF8Loader.prototype.decompressMesh(b),p=[],v=[];(function(b,k,p){for(var u,v,B,D=b.length;p<D;p+=k)u=b[p],v=b[p+1],B=b[p+2],u=u/16383*e,v=v/16383*e,B=B/16383*e,u+=f,v+=h,B+=m,c.vertices.push(new THREE.Vertex(new THREE.Vector3(u,v,B)))})(k[0],8,0);(function(b,c,e){for(var f,h,k=b.length;e<k;e+=c)f=b[e],h=b[e+1],f/=1023,h/=1023,v.push(f,h)})(k[0],8,3);(function(b,
c,e){for(var f,h,k,m=b.length;e<m;e+=c)f=b[e],h=b[e+1],k=b[e+2],f=(f-512)/511,h=(h-512)/511,k=(k-512)/511,p.push(f,h,k)})(k[0],8,5);(function(b){var e,f,h,k,m,u,G,H,E,N=b.length;for(e=0;e<N;e+=3){f=b[e];h=b[e+1];k=b[e+2];m=c;H=f;E=h;u=k;G=f;var F=h,I=k,C=m.materials[0],K=p[F*3],U=p[F*3+1],F=p[F*3+2],L=p[I*3],O=p[I*3+1],I=p[I*3+2];G=new THREE.Vector3(p[G*3],p[G*3+1],p[G*3+2]);F=new THREE.Vector3(K,U,F);I=new THREE.Vector3(L,O,I);m.faces.push(new THREE.Face3(H,E,u,[G,F,I],null,C));m=v[f*2];f=v[f*2+
1];u=v[h*2];G=v[h*2+1];H=v[k*2];E=v[k*2+1];k=c.faceVertexUvs[0];h=u;u=G;G=[];G.push(new THREE.UV(m,f));G.push(new THREE.UV(h,u));G.push(new THREE.UV(H,E));k.push(G)}})(k[1]);this.computeCentroids();this.computeFaceNormals()};k.prototype=new THREE.Geometry;k.prototype.constructor=k;c(new k)};
THREE.MarchingCubes=function(b,c){THREE.Object3D.call(this);this.materials=c instanceof Array?c:[c];this.init=function(b){this.isolation=80;this.size=b;this.size2=this.size*this.size;this.size3=this.size2*this.size;this.halfsize=this.size/2;this.delta=2/this.size;this.yd=this.size;this.zd=this.size2;this.field=new Float32Array(this.size3);this.normal_cache=new Float32Array(this.size3*3);this.vlist=new Float32Array(36);this.nlist=new Float32Array(36);this.firstDraw=!0;this.maxCount=4096;this.count=
0;this.hasNormal=this.hasPos=!1;this.positionArray=new Float32Array(this.maxCount*3);this.normalArray=new Float32Array(this.maxCount*3)};this.lerp=function(b,c,h){return b+(c-b)*h};this.VIntX=function(b,c,h,m,k,n,u,p,v,t){k=(k-v)/(t-v);v=this.normal_cache;c[m]=n+k*this.delta;c[m+1]=u;c[m+2]=p;h[m]=this.lerp(v[b],v[b+3],k);h[m+1]=this.lerp(v[b+1],v[b+4],k);h[m+2]=this.lerp(v[b+2],v[b+5],k)};this.VIntY=function(b,c,h,m,k,n,u,p,v,t){k=(k-v)/(t-v);v=this.normal_cache;c[m]=n;c[m+1]=u+k*this.delta;c[m+
2]=p;c=b+this.yd*3;h[m]=this.lerp(v[b],v[c],k);h[m+1]=this.lerp(v[b+1],v[c+1],k);h[m+2]=this.lerp(v[b+2],v[c+2],k)};this.VIntZ=function(b,c,h,m,k,n,u,p,v,t){k=(k-v)/(t-v);v=this.normal_cache;c[m]=n;c[m+1]=u;c[m+2]=p+k*this.delta;c=b+this.zd*3;h[m]=this.lerp(v[b],v[c],k);h[m+1]=this.lerp(v[b+1],v[c+1],k);h[m+2]=this.lerp(v[b+2],v[c+2],k)};this.compNorm=function(b){var c=b*3;this.normal_cache[c]==0&&(this.normal_cache[c]=this.field[b-1]-this.field[b+1],this.normal_cache[c+1]=this.field[b-this.yd]-this.field[b+
this.yd],this.normal_cache[c+2]=this.field[b-this.zd]-this.field[b+this.zd])};this.polygonize=function(b,c,h,m,k,n){var u=m+1,p=m+this.yd,v=m+this.zd,t=u+this.yd,x=u+this.zd,w=m+this.yd+this.zd,z=u+this.yd+this.zd,y=0,B=this.field[m],D=this.field[u],G=this.field[p],H=this.field[t],E=this.field[v],N=this.field[x],F=this.field[w],I=this.field[z];B<k&&(y|=1);D<k&&(y|=2);G<k&&(y|=8);H<k&&(y|=4);E<k&&(y|=16);N<k&&(y|=32);F<k&&(y|=128);I<k&&(y|=64);var C=THREE.edgeTable[y];if(C==0)return 0;var K=this.delta,
U=b+K,L=c+K,K=h+K;C&1&&(this.compNorm(m),this.compNorm(u),this.VIntX(m*3,this.vlist,this.nlist,0,k,b,c,h,B,D));C&2&&(this.compNorm(u),this.compNorm(t),this.VIntY(u*3,this.vlist,this.nlist,3,k,U,c,h,D,H));C&4&&(this.compNorm(p),this.compNorm(t),this.VIntX(p*3,this.vlist,this.nlist,6,k,b,L,h,G,H));C&8&&(this.compNorm(m),this.compNorm(p),this.VIntY(m*3,this.vlist,this.nlist,9,k,b,c,h,B,G));C&16&&(this.compNorm(v),this.compNorm(x),this.VIntX(v*3,this.vlist,this.nlist,12,k,b,c,K,E,N));C&32&&(this.compNorm(x),
this.compNorm(z),this.VIntY(x*3,this.vlist,this.nlist,15,k,U,c,K,N,I));C&64&&(this.compNorm(w),this.compNorm(z),this.VIntX(w*3,this.vlist,this.nlist,18,k,b,L,K,F,I));C&128&&(this.compNorm(v),this.compNorm(w),this.VIntY(v*3,this.vlist,this.nlist,21,k,b,c,K,E,F));C&256&&(this.compNorm(m),this.compNorm(v),this.VIntZ(m*3,this.vlist,this.nlist,24,k,b,c,h,B,E));C&512&&(this.compNorm(u),this.compNorm(x),this.VIntZ(u*3,this.vlist,this.nlist,27,k,U,c,h,D,N));C&1024&&(this.compNorm(t),this.compNorm(z),this.VIntZ(t*
3,this.vlist,this.nlist,30,k,U,L,h,H,I));C&2048&&(this.compNorm(p),this.compNorm(w),this.VIntZ(p*3,this.vlist,this.nlist,33,k,b,L,h,G,F));y<<=4;for(k=m=0;THREE.triTable[y+k]!=-1;)b=y+k,c=b+1,h=b+2,this.posnormtriv(this.vlist,this.nlist,3*THREE.triTable[b],3*THREE.triTable[c],3*THREE.triTable[h],n),k+=3,m++;return m};this.posnormtriv=function(b,c,h,m,k,n){var u=this.count*3;this.positionArray[u]=b[h];this.positionArray[u+1]=b[h+1];this.positionArray[u+2]=b[h+2];this.positionArray[u+3]=b[m];this.positionArray[u+
4]=b[m+1];this.positionArray[u+5]=b[m+2];this.positionArray[u+6]=b[k];this.positionArray[u+7]=b[k+1];this.positionArray[u+8]=b[k+2];this.normalArray[u]=c[h];this.normalArray[u+1]=c[h+1];this.normalArray[u+2]=c[h+2];this.normalArray[u+3]=c[m];this.normalArray[u+4]=c[m+1];this.normalArray[u+5]=c[m+2];this.normalArray[u+6]=c[k];this.normalArray[u+7]=c[k+1];this.normalArray[u+8]=c[k+2];this.hasNormal=this.hasPos=!0;this.count+=3;this.count>=this.maxCount-3&&n(this)};this.begin=function(){this.count=0;
this.hasNormal=this.hasPos=!1};this.end=function(b){if(this.count!=0){for(var c=this.count*3;c<this.positionArray.length;c++)this.positionArray[c]=0;b(this)}};this.addBall=function(b,c,h,m,k){var n=this.size*Math.sqrt(m/k),u=h*this.size,p=c*this.size,v=b*this.size,t=Math.floor(u-n);t<1&&(t=1);u=Math.floor(u+n);u>this.size-1&&(u=this.size-1);var x=Math.floor(p-n);x<1&&(x=1);p=Math.floor(p+n);p>this.size-1&&(p=this.size-1);var w=Math.floor(v-n);w<1&&(w=1);n=Math.floor(v+n);n>this.size-1&&(n=this.size-
1);for(var z,y,B,D,G,H;t<u;t++){v=this.size2*t;y=t/this.size-h;G=y*y;for(y=x;y<p;y++){B=v+this.size*y;z=y/this.size-c;H=z*z;for(z=w;z<n;z++)D=z/this.size-b,D=m/(1.0E-6+D*D+H+G)-k,D>0&&(this.field[B+z]+=D)}}};this.addPlaneX=function(b,c){var h,m,k,n,u,p=this.size,v=this.yd,t=this.zd,x=this.field,w=p*Math.sqrt(b/c);w>p&&(w=p);for(h=0;h<w;h++)if(m=h/p,m*=m,n=b/(1.0E-4+m)-c,n>0)for(m=0;m<p;m++){u=h+m*v;for(k=0;k<p;k++)x[t*k+u]+=n}};this.addPlaneY=function(b,c){var h,m,k,n,u,p,v=this.size,t=this.yd,x=
this.zd,w=this.field,z=v*Math.sqrt(b/c);z>v&&(z=v);for(m=0;m<z;m++)if(h=m/v,h*=h,n=b/(1.0E-4+h)-c,n>0){u=m*t;for(h=0;h<v;h++){p=u+h;for(k=0;k<v;k++)w[x*k+p]+=n}}};this.addPlaneZ=function(b,c){var h,m,k,n,u,p;size=this.size;yd=this.yd;zd=this.zd;field=this.field;dist=size*Math.sqrt(b/c);dist>size&&(dist=size);for(k=0;k<dist;k++)if(h=k/size,h*=h,n=b/(1.0E-4+h)-c,n>0){u=zd*k;for(m=0;m<size;m++){p=u+m*yd;for(h=0;h<size;h++)field[p+h]+=n}}};this.reset=function(){var b;for(b=0;b<this.size3;b++)this.normal_cache[b*
3]=0,this.field[b]=0};this.render=function(b){this.begin();var c,h,m,k,n,u,p,v,t,x=this.size-2;for(k=1;k<x;k++){t=this.size2*k;p=(k-this.halfsize)/this.halfsize;for(m=1;m<x;m++){v=t+this.size*m;u=(m-this.halfsize)/this.halfsize;for(h=1;h<x;h++)n=(h-this.halfsize)/this.halfsize,c=v+h,this.polygonize(n,u,p,c,this.isolation,b)}}this.end(b)};this.generateGeometry=function(){var b=0,c=new THREE.Geometry,h=[];this.render(function(m){var k,n,u,p,v,t,x,w;for(k=0;k<m.count;k++)x=k*3,v=x+1,w=x+2,n=m.positionArray[x],
u=m.positionArray[v],p=m.positionArray[w],t=new THREE.Vector3(n,u,p),n=m.normalArray[x],u=m.normalArray[v],p=m.normalArray[w],x=new THREE.Vector3(n,u,p),x.normalize(),v=new THREE.Vertex(t),c.vertices.push(v),h.push(x);nfaces=m.count/3;for(k=0;k<nfaces;k++)x=(b+k)*3,v=x+1,w=x+2,t=h[x],n=h[v],u=h[w],x=new THREE.Face3(x,v,w,[t,n,u]),c.faces.push(x);b+=nfaces;m.count=0});return c};this.init(b)};THREE.MarchingCubes.prototype=new THREE.Object3D;THREE.MarchingCubes.prototype.constructor=THREE.MarchingCubes;
THREE.edgeTable=new Int32Array([0,265,515,778,1030,1295,1541,1804,2060,2309,2575,2822,3082,3331,3593,3840,400,153,915,666,1430,1183,1941,1692,2460,2197,2975,2710,3482,3219,3993,3728,560,825,51,314,1590,1855,1077,1340,2620,2869,2111,2358,3642,3891,3129,3376,928,681,419,170,1958,1711,1445,1196,2988,2725,2479,2214,4010,3747,3497,3232,1120,1385,1635,1898,102,367,613,876,3180,3429,3695,3942,2154,2403,2665,2912,1520,1273,2035,1786,502,255,1013,764,3580,3317,4095,3830,2554,2291,3065,2800,1616,1881,1107,
1370,598,863,85,348,3676,3925,3167,3414,2650,2899,2137,2384,1984,1737,1475,1226,966,719,453,204,4044,3781,3535,3270,3018,2755,2505,2240,2240,2505,2755,3018,3270,3535,3781,4044,204,453,719,966,1226,1475,1737,1984,2384,2137,2899,2650,3414,3167,3925,3676,348,85,863,598,1370,1107,1881,1616,2800,3065,2291,2554,3830,4095,3317,3580,764,1013,255,502,1786,2035,1273,1520,2912,2665,2403,2154,3942,3695,3429,3180,876,613,367,102,1898,1635,1385,1120,3232,3497,3747,4010,2214,2479,2725,2988,1196,1445,1711,1958,170,
419,681,928,3376,3129,3891,3642,2358,2111,2869,2620,1340,1077,1855,1590,314,51,825,560,3728,3993,3219,3482,2710,2975,2197,2460,1692,1941,1183,1430,666,915,153,400,3840,3593,3331,3082,2822,2575,2309,2060,1804,1541,1295,1030,778,515,265,0]);
THREE.triTable=new Int32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,8,3,9,8,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,2,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,1,2,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,2,10,0,2,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,8,3,2,10,8,10,9,8,-1,-1,-1,-1,-1,-1,-1,3,11,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,11,2,8,11,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,9,0,2,3,11,-1,-1,-1,-1,-1,
-1,-1,-1,-1,-1,1,11,2,1,9,11,9,8,11,-1,-1,-1,-1,-1,-1,-1,3,10,1,11,10,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,10,1,0,8,10,8,11,10,-1,-1,-1,-1,-1,-1,-1,3,9,0,3,11,9,11,10,9,-1,-1,-1,-1,-1,-1,-1,9,8,10,10,8,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,7,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,3,0,7,3,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,9,8,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,1,9,4,7,1,7,3,1,-1,-1,-1,-1,-1,-1,-1,1,2,10,8,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,4,7,3,0,4,1,2,10,-1,-1,-1,-1,-1,-1,-1,9,2,10,9,0,2,8,4,7,
-1,-1,-1,-1,-1,-1,-1,2,10,9,2,9,7,2,7,3,7,9,4,-1,-1,-1,-1,8,4,7,3,11,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,4,7,11,2,4,2,0,4,-1,-1,-1,-1,-1,-1,-1,9,0,1,8,4,7,2,3,11,-1,-1,-1,-1,-1,-1,-1,4,7,11,9,4,11,9,11,2,9,2,1,-1,-1,-1,-1,3,10,1,3,11,10,7,8,4,-1,-1,-1,-1,-1,-1,-1,1,11,10,1,4,11,1,0,4,7,11,4,-1,-1,-1,-1,4,7,8,9,0,11,9,11,10,11,0,3,-1,-1,-1,-1,4,7,11,4,11,9,9,11,10,-1,-1,-1,-1,-1,-1,-1,9,5,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,5,4,0,8,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,5,4,1,5,0,-1,-1,-1,-1,-1,-1,
-1,-1,-1,-1,8,5,4,8,3,5,3,1,5,-1,-1,-1,-1,-1,-1,-1,1,2,10,9,5,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,0,8,1,2,10,4,9,5,-1,-1,-1,-1,-1,-1,-1,5,2,10,5,4,2,4,0,2,-1,-1,-1,-1,-1,-1,-1,2,10,5,3,2,5,3,5,4,3,4,8,-1,-1,-1,-1,9,5,4,2,3,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,11,2,0,8,11,4,9,5,-1,-1,-1,-1,-1,-1,-1,0,5,4,0,1,5,2,3,11,-1,-1,-1,-1,-1,-1,-1,2,1,5,2,5,8,2,8,11,4,8,5,-1,-1,-1,-1,10,3,11,10,1,3,9,5,4,-1,-1,-1,-1,-1,-1,-1,4,9,5,0,8,1,8,10,1,8,11,10,-1,-1,-1,-1,5,4,0,5,0,11,5,11,10,11,0,3,-1,-1,-1,-1,5,4,8,5,
8,10,10,8,11,-1,-1,-1,-1,-1,-1,-1,9,7,8,5,7,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,3,0,9,5,3,5,7,3,-1,-1,-1,-1,-1,-1,-1,0,7,8,0,1,7,1,5,7,-1,-1,-1,-1,-1,-1,-1,1,5,3,3,5,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,7,8,9,5,7,10,1,2,-1,-1,-1,-1,-1,-1,-1,10,1,2,9,5,0,5,3,0,5,7,3,-1,-1,-1,-1,8,0,2,8,2,5,8,5,7,10,5,2,-1,-1,-1,-1,2,10,5,2,5,3,3,5,7,-1,-1,-1,-1,-1,-1,-1,7,9,5,7,8,9,3,11,2,-1,-1,-1,-1,-1,-1,-1,9,5,7,9,7,2,9,2,0,2,7,11,-1,-1,-1,-1,2,3,11,0,1,8,1,7,8,1,5,7,-1,-1,-1,-1,11,2,1,11,1,7,7,1,5,-1,-1,-1,-1,-1,-1,
-1,9,5,8,8,5,7,10,1,3,10,3,11,-1,-1,-1,-1,5,7,0,5,0,9,7,11,0,1,0,10,11,10,0,-1,11,10,0,11,0,3,10,5,0,8,0,7,5,7,0,-1,11,10,5,7,11,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,6,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,5,10,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,0,1,5,10,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,8,3,1,9,8,5,10,6,-1,-1,-1,-1,-1,-1,-1,1,6,5,2,6,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,6,5,1,2,6,3,0,8,-1,-1,-1,-1,-1,-1,-1,9,6,5,9,0,6,0,2,6,-1,-1,-1,-1,-1,-1,-1,5,9,8,5,8,2,5,2,6,3,2,8,-1,-1,-1,-1,2,3,11,10,6,
5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,0,8,11,2,0,10,6,5,-1,-1,-1,-1,-1,-1,-1,0,1,9,2,3,11,5,10,6,-1,-1,-1,-1,-1,-1,-1,5,10,6,1,9,2,9,11,2,9,8,11,-1,-1,-1,-1,6,3,11,6,5,3,5,1,3,-1,-1,-1,-1,-1,-1,-1,0,8,11,0,11,5,0,5,1,5,11,6,-1,-1,-1,-1,3,11,6,0,3,6,0,6,5,0,5,9,-1,-1,-1,-1,6,5,9,6,9,11,11,9,8,-1,-1,-1,-1,-1,-1,-1,5,10,6,4,7,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,3,0,4,7,3,6,5,10,-1,-1,-1,-1,-1,-1,-1,1,9,0,5,10,6,8,4,7,-1,-1,-1,-1,-1,-1,-1,10,6,5,1,9,7,1,7,3,7,9,4,-1,-1,-1,-1,6,1,2,6,5,1,4,7,8,-1,-1,-1,-1,
-1,-1,-1,1,2,5,5,2,6,3,0,4,3,4,7,-1,-1,-1,-1,8,4,7,9,0,5,0,6,5,0,2,6,-1,-1,-1,-1,7,3,9,7,9,4,3,2,9,5,9,6,2,6,9,-1,3,11,2,7,8,4,10,6,5,-1,-1,-1,-1,-1,-1,-1,5,10,6,4,7,2,4,2,0,2,7,11,-1,-1,-1,-1,0,1,9,4,7,8,2,3,11,5,10,6,-1,-1,-1,-1,9,2,1,9,11,2,9,4,11,7,11,4,5,10,6,-1,8,4,7,3,11,5,3,5,1,5,11,6,-1,-1,-1,-1,5,1,11,5,11,6,1,0,11,7,11,4,0,4,11,-1,0,5,9,0,6,5,0,3,6,11,6,3,8,4,7,-1,6,5,9,6,9,11,4,7,9,7,11,9,-1,-1,-1,-1,10,4,9,6,4,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,10,6,4,9,10,0,8,3,-1,-1,-1,-1,-1,-1,-1,
10,0,1,10,6,0,6,4,0,-1,-1,-1,-1,-1,-1,-1,8,3,1,8,1,6,8,6,4,6,1,10,-1,-1,-1,-1,1,4,9,1,2,4,2,6,4,-1,-1,-1,-1,-1,-1,-1,3,0,8,1,2,9,2,4,9,2,6,4,-1,-1,-1,-1,0,2,4,4,2,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,3,2,8,2,4,4,2,6,-1,-1,-1,-1,-1,-1,-1,10,4,9,10,6,4,11,2,3,-1,-1,-1,-1,-1,-1,-1,0,8,2,2,8,11,4,9,10,4,10,6,-1,-1,-1,-1,3,11,2,0,1,6,0,6,4,6,1,10,-1,-1,-1,-1,6,4,1,6,1,10,4,8,1,2,1,11,8,11,1,-1,9,6,4,9,3,6,9,1,3,11,6,3,-1,-1,-1,-1,8,11,1,8,1,0,11,6,1,9,1,4,6,4,1,-1,3,11,6,3,6,0,0,6,4,-1,-1,-1,-1,-1,-1,-1,
6,4,8,11,6,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,10,6,7,8,10,8,9,10,-1,-1,-1,-1,-1,-1,-1,0,7,3,0,10,7,0,9,10,6,7,10,-1,-1,-1,-1,10,6,7,1,10,7,1,7,8,1,8,0,-1,-1,-1,-1,10,6,7,10,7,1,1,7,3,-1,-1,-1,-1,-1,-1,-1,1,2,6,1,6,8,1,8,9,8,6,7,-1,-1,-1,-1,2,6,9,2,9,1,6,7,9,0,9,3,7,3,9,-1,7,8,0,7,0,6,6,0,2,-1,-1,-1,-1,-1,-1,-1,7,3,2,6,7,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,11,10,6,8,10,8,9,8,6,7,-1,-1,-1,-1,2,0,7,2,7,11,0,9,7,6,7,10,9,10,7,-1,1,8,0,1,7,8,1,10,7,6,7,10,2,3,11,-1,11,2,1,11,1,7,10,6,1,6,7,1,-1,-1,-1,-1,
8,9,6,8,6,7,9,1,6,11,6,3,1,3,6,-1,0,9,1,11,6,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,8,0,7,0,6,3,11,0,11,6,0,-1,-1,-1,-1,7,11,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,0,8,11,7,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,9,11,7,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,1,9,8,3,1,11,7,6,-1,-1,-1,-1,-1,-1,-1,10,1,2,6,11,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,2,10,3,0,8,6,11,7,-1,-1,-1,-1,-1,-1,-1,2,9,0,2,10,9,6,11,7,-1,-1,-1,-1,-1,-1,-1,6,11,7,2,10,3,10,8,3,10,9,8,-1,-1,-1,-1,7,
2,3,6,2,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,0,8,7,6,0,6,2,0,-1,-1,-1,-1,-1,-1,-1,2,7,6,2,3,7,0,1,9,-1,-1,-1,-1,-1,-1,-1,1,6,2,1,8,6,1,9,8,8,7,6,-1,-1,-1,-1,10,7,6,10,1,7,1,3,7,-1,-1,-1,-1,-1,-1,-1,10,7,6,1,7,10,1,8,7,1,0,8,-1,-1,-1,-1,0,3,7,0,7,10,0,10,9,6,10,7,-1,-1,-1,-1,7,6,10,7,10,8,8,10,9,-1,-1,-1,-1,-1,-1,-1,6,8,4,11,8,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,6,11,3,0,6,0,4,6,-1,-1,-1,-1,-1,-1,-1,8,6,11,8,4,6,9,0,1,-1,-1,-1,-1,-1,-1,-1,9,4,6,9,6,3,9,3,1,11,3,6,-1,-1,-1,-1,6,8,4,6,11,8,2,10,1,-1,-1,-1,
-1,-1,-1,-1,1,2,10,3,0,11,0,6,11,0,4,6,-1,-1,-1,-1,4,11,8,4,6,11,0,2,9,2,10,9,-1,-1,-1,-1,10,9,3,10,3,2,9,4,3,11,3,6,4,6,3,-1,8,2,3,8,4,2,4,6,2,-1,-1,-1,-1,-1,-1,-1,0,4,2,4,6,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,9,0,2,3,4,2,4,6,4,3,8,-1,-1,-1,-1,1,9,4,1,4,2,2,4,6,-1,-1,-1,-1,-1,-1,-1,8,1,3,8,6,1,8,4,6,6,10,1,-1,-1,-1,-1,10,1,0,10,0,6,6,0,4,-1,-1,-1,-1,-1,-1,-1,4,6,3,4,3,8,6,10,3,0,3,9,10,9,3,-1,10,9,4,6,10,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,9,5,7,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,4,9,5,11,7,6,
-1,-1,-1,-1,-1,-1,-1,5,0,1,5,4,0,7,6,11,-1,-1,-1,-1,-1,-1,-1,11,7,6,8,3,4,3,5,4,3,1,5,-1,-1,-1,-1,9,5,4,10,1,2,7,6,11,-1,-1,-1,-1,-1,-1,-1,6,11,7,1,2,10,0,8,3,4,9,5,-1,-1,-1,-1,7,6,11,5,4,10,4,2,10,4,0,2,-1,-1,-1,-1,3,4,8,3,5,4,3,2,5,10,5,2,11,7,6,-1,7,2,3,7,6,2,5,4,9,-1,-1,-1,-1,-1,-1,-1,9,5,4,0,8,6,0,6,2,6,8,7,-1,-1,-1,-1,3,6,2,3,7,6,1,5,0,5,4,0,-1,-1,-1,-1,6,2,8,6,8,7,2,1,8,4,8,5,1,5,8,-1,9,5,4,10,1,6,1,7,6,1,3,7,-1,-1,-1,-1,1,6,10,1,7,6,1,0,7,8,7,0,9,5,4,-1,4,0,10,4,10,5,0,3,10,6,10,7,3,7,10,
-1,7,6,10,7,10,8,5,4,10,4,8,10,-1,-1,-1,-1,6,9,5,6,11,9,11,8,9,-1,-1,-1,-1,-1,-1,-1,3,6,11,0,6,3,0,5,6,0,9,5,-1,-1,-1,-1,0,11,8,0,5,11,0,1,5,5,6,11,-1,-1,-1,-1,6,11,3,6,3,5,5,3,1,-1,-1,-1,-1,-1,-1,-1,1,2,10,9,5,11,9,11,8,11,5,6,-1,-1,-1,-1,0,11,3,0,6,11,0,9,6,5,6,9,1,2,10,-1,11,8,5,11,5,6,8,0,5,10,5,2,0,2,5,-1,6,11,3,6,3,5,2,10,3,10,5,3,-1,-1,-1,-1,5,8,9,5,2,8,5,6,2,3,8,2,-1,-1,-1,-1,9,5,6,9,6,0,0,6,2,-1,-1,-1,-1,-1,-1,-1,1,5,8,1,8,0,5,6,8,3,8,2,6,2,8,-1,1,5,6,2,1,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
1,3,6,1,6,10,3,8,6,5,6,9,8,9,6,-1,10,1,0,10,0,6,9,5,0,5,6,0,-1,-1,-1,-1,0,3,8,5,6,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,5,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,5,10,7,5,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,5,10,11,7,5,8,3,0,-1,-1,-1,-1,-1,-1,-1,5,11,7,5,10,11,1,9,0,-1,-1,-1,-1,-1,-1,-1,10,7,5,10,11,7,9,8,1,8,3,1,-1,-1,-1,-1,11,1,2,11,7,1,7,5,1,-1,-1,-1,-1,-1,-1,-1,0,8,3,1,2,7,1,7,5,7,2,11,-1,-1,-1,-1,9,7,5,9,2,7,9,0,2,2,11,7,-1,-1,-1,-1,7,5,2,7,2,11,5,9,2,3,2,8,9,8,2,-1,2,5,10,2,3,5,3,7,5,-1,-1,
-1,-1,-1,-1,-1,8,2,0,8,5,2,8,7,5,10,2,5,-1,-1,-1,-1,9,0,1,5,10,3,5,3,7,3,10,2,-1,-1,-1,-1,9,8,2,9,2,1,8,7,2,10,2,5,7,5,2,-1,1,3,5,3,7,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,7,0,7,1,1,7,5,-1,-1,-1,-1,-1,-1,-1,9,0,3,9,3,5,5,3,7,-1,-1,-1,-1,-1,-1,-1,9,8,7,5,9,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,8,4,5,10,8,10,11,8,-1,-1,-1,-1,-1,-1,-1,5,0,4,5,11,0,5,10,11,11,3,0,-1,-1,-1,-1,0,1,9,8,4,10,8,10,11,10,4,5,-1,-1,-1,-1,10,11,4,10,4,5,11,3,4,9,4,1,3,1,4,-1,2,5,1,2,8,5,2,11,8,4,5,8,-1,-1,-1,-1,0,4,11,0,11,3,4,5,11,
2,11,1,5,1,11,-1,0,2,5,0,5,9,2,11,5,4,5,8,11,8,5,-1,9,4,5,2,11,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,5,10,3,5,2,3,4,5,3,8,4,-1,-1,-1,-1,5,10,2,5,2,4,4,2,0,-1,-1,-1,-1,-1,-1,-1,3,10,2,3,5,10,3,8,5,4,5,8,0,1,9,-1,5,10,2,5,2,4,1,9,2,9,4,2,-1,-1,-1,-1,8,4,5,8,5,3,3,5,1,-1,-1,-1,-1,-1,-1,-1,0,4,5,1,0,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,4,5,8,5,3,9,0,5,0,3,5,-1,-1,-1,-1,9,4,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,11,7,4,9,11,9,10,11,-1,-1,-1,-1,-1,-1,-1,0,8,3,4,9,7,9,11,7,9,10,11,-1,-1,-1,-1,1,10,11,1,11,
4,1,4,0,7,4,11,-1,-1,-1,-1,3,1,4,3,4,8,1,10,4,7,4,11,10,11,4,-1,4,11,7,9,11,4,9,2,11,9,1,2,-1,-1,-1,-1,9,7,4,9,11,7,9,1,11,2,11,1,0,8,3,-1,11,7,4,11,4,2,2,4,0,-1,-1,-1,-1,-1,-1,-1,11,7,4,11,4,2,8,3,4,3,2,4,-1,-1,-1,-1,2,9,10,2,7,9,2,3,7,7,4,9,-1,-1,-1,-1,9,10,7,9,7,4,10,2,7,8,7,0,2,0,7,-1,3,7,10,3,10,2,7,4,10,1,10,0,4,0,10,-1,1,10,2,8,7,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,9,1,4,1,7,7,1,3,-1,-1,-1,-1,-1,-1,-1,4,9,1,4,1,7,0,8,1,8,7,1,-1,-1,-1,-1,4,0,3,7,4,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,8,7,-1,-1,-1,
-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,10,8,10,11,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,0,9,3,9,11,11,9,10,-1,-1,-1,-1,-1,-1,-1,0,1,10,0,10,8,8,10,11,-1,-1,-1,-1,-1,-1,-1,3,1,10,11,3,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,2,11,1,11,9,9,11,8,-1,-1,-1,-1,-1,-1,-1,3,0,9,3,9,11,1,2,9,2,11,9,-1,-1,-1,-1,0,2,11,8,0,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,2,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,8,2,8,10,10,8,9,-1,-1,-1,-1,-1,-1,-1,9,10,2,0,9,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,8,2,8,10,0,1,8,1,10,8,-1,-1,-1,-1,1,10,
2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,3,8,9,1,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,9,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,3,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]);
THREE.Trident=function(b){function c(c){return new THREE.Mesh(new THREE.CylinderGeometry(30,0.1,b.length/20,b.length/5),new THREE.MeshBasicMaterial({color:c}))}function e(b,c){var e=new THREE.Geometry;e.vertices=[new THREE.Vertex,new THREE.Vertex(b)];return new THREE.Line(e,new THREE.LineBasicMaterial({color:c}))}THREE.Object3D.call(this);var f=Math.PI/2,h,b=b||THREE.Trident.defaultParams;if(b!==THREE.Trident.defaultParams)for(h in THREE.Trident.defaultParams)b.hasOwnProperty(h)||(b[h]=THREE.Trident.defaultParams[h]);
this.scale=new THREE.Vector3(b.scale,b.scale,b.scale);this.addChild(e(new THREE.Vector3(b.length,0,0),b.xAxisColor));this.addChild(e(new THREE.Vector3(0,b.length,0),b.yAxisColor));this.addChild(e(new THREE.Vector3(0,0,b.length),b.zAxisColor));if(b.showArrows)h=c(b.xAxisColor),h.rotation.y=-f,h.position.x=b.length,this.addChild(h),h=c(b.yAxisColor),h.rotation.x=f,h.position.y=b.length,this.addChild(h),h=c(b.zAxisColor),h.rotation.y=Math.PI,h.position.z=b.length,this.addChild(h)};
THREE.Trident.prototype=new THREE.Object3D;THREE.Trident.prototype.constructor=THREE.Trident;THREE.Trident.defaultParams={xAxisColor:16711680,yAxisColor:65280,zAxisColor:255,showArrows:!0,length:100,scale:1};THREE.PlaneCollider=function(b,c){this.point=b;this.normal=c};THREE.SphereCollider=function(b,c){this.center=b;this.radius=c;this.radiusSq=c*c};THREE.BoxCollider=function(b,c){this.min=b;this.max=c;this.dynamic=!0;this.normal=new THREE.Vector3};
THREE.MeshCollider=function(b,c){this.mesh=b;this.box=c;this.numFaces=this.mesh.geometry.faces.length;this.normal=new THREE.Vector3};THREE.CollisionSystem=function(){this.collisionNormal=new THREE.Vector3;this.colliders=[];this.hits=[]};THREE.Collisions=new THREE.CollisionSystem;THREE.CollisionSystem.prototype.merge=function(b){this.colliders=this.colliders.concat(b.colliders);this.hits=this.hits.concat(b.hits)};
THREE.CollisionSystem.prototype.rayCastAll=function(b){b.direction.normalize();this.hits.length=0;var c,e,f,h,m=0;c=0;for(e=this.colliders.length;c<e;c++)if(h=this.colliders[c],f=this.rayCast(b,h),f<Number.MAX_VALUE)h.distance=f,f>m?this.hits.push(h):this.hits.unshift(h),m=f;return this.hits};
THREE.CollisionSystem.prototype.rayCastNearest=function(b){var c=this.rayCastAll(b);if(c.length==0)return null;for(var e=0;c[e]instanceof THREE.MeshCollider;){var f=this.rayMesh(b,c[e]);if(f.dist<Number.MAX_VALUE){c[e].distance=f.dist;c[e].faceIndex=f.faceIndex;break}e++}if(e>c.length)return null;return c[e]};
THREE.CollisionSystem.prototype.rayCast=function(b,c){if(c instanceof THREE.PlaneCollider)return this.rayPlane(b,c);else if(c instanceof THREE.SphereCollider)return this.raySphere(b,c);else if(c instanceof THREE.BoxCollider)return this.rayBox(b,c);else if(c instanceof THREE.MeshCollider&&c.box)return this.rayBox(b,c.box)};
THREE.CollisionSystem.prototype.rayMesh=function(b,c){for(var e=this.makeRayLocal(b,c.mesh),f=Number.MAX_VALUE,h,m=0;m<c.numFaces;m++){var k=c.mesh.geometry.faces[m],n=c.mesh.geometry.vertices[k.a].position,u=c.mesh.geometry.vertices[k.b].position,p=c.mesh.geometry.vertices[k.c].position,v=k instanceof THREE.Face4?c.mesh.geometry.vertices[k.d].position:null;k instanceof THREE.Face3?(k=this.rayTriangle(e,n,u,p,f,this.collisionNormal,c.mesh),k<f&&(f=k,h=m,c.normal.copy(this.collisionNormal),c.normal.normalize())):
k instanceof THREE.Face4&&(k=this.rayTriangle(e,n,u,v,f,this.collisionNormal,c.mesh),k<f&&(f=k,h=m,c.normal.copy(this.collisionNormal),c.normal.normalize()),k=this.rayTriangle(e,u,p,v,f,this.collisionNormal,c.mesh),k<f&&(f=k,h=m,c.normal.copy(this.collisionNormal),c.normal.normalize()))}return{dist:f,faceIndex:h}};
THREE.CollisionSystem.prototype.rayTriangle=function(b,c,e,f,h,m,k){var n=THREE.CollisionSystem.__v1,u=THREE.CollisionSystem.__v2;m.set(0,0,0);n.sub(e,c);u.sub(f,e);m.cross(n,u);n=m.dot(b.direction);if(!(n<0))if(k.doubleSided||k.flipSided)m.multiplyScalar(-1),n*=-1;else return Number.MAX_VALUE;k=m.dot(c)-m.dot(b.origin);if(!(k<=0))return Number.MAX_VALUE;if(!(k>=n*h))return Number.MAX_VALUE;k/=n;n=THREE.CollisionSystem.__v3;n.copy(b.direction);n.multiplyScalar(k);n.addSelf(b.origin);Math.abs(m.x)>
Math.abs(m.y)?Math.abs(m.x)>Math.abs(m.z)?(b=n.y-c.y,m=e.y-c.y,h=f.y-c.y,n=n.z-c.z,e=e.z-c.z,f=f.z-c.z):(b=n.x-c.x,m=e.x-c.x,h=f.x-c.x,n=n.y-c.y,e=e.y-c.y,f=f.y-c.y):Math.abs(m.y)>Math.abs(m.z)?(b=n.x-c.x,m=e.x-c.x,h=f.x-c.x,n=n.z-c.z,e=e.z-c.z,f=f.z-c.z):(b=n.x-c.x,m=e.x-c.x,h=f.x-c.x,n=n.y-c.y,e=e.y-c.y,f=f.y-c.y);c=m*f-e*h;if(c==0)return Number.MAX_VALUE;c=1/c;f=(b*f-n*h)*c;if(!(f>=0))return Number.MAX_VALUE;c*=m*n-e*b;if(!(c>=0))return Number.MAX_VALUE;if(!(1-f-c>=0))return Number.MAX_VALUE;return k};
THREE.CollisionSystem.prototype.makeRayLocal=function(b,c){var e=THREE.CollisionSystem.__m;THREE.Matrix4.makeInvert(c.matrixWorld,e);var f=THREE.CollisionSystem.__r;f.origin.copy(b.origin);f.direction.copy(b.direction);e.multiplyVector3(f.origin);e.rotateAxis(f.direction);f.direction.normalize();return f};
THREE.CollisionSystem.prototype.rayBox=function(b,c){var e;c.dynamic&&c.mesh&&c.mesh.matrixWorld?e=this.makeRayLocal(b,c.mesh):(e=THREE.CollisionSystem.__r,e.origin.copy(b.origin),e.direction.copy(b.direction));var f=0,h=0,m=0,k=0,n=0,u=0,p=!0;e.origin.x<c.min.x?(f=c.min.x-e.origin.x,f/=e.direction.x,p=!1,k=-1):e.origin.x>c.max.x&&(f=c.max.x-e.origin.x,f/=e.direction.x,p=!1,k=1);e.origin.y<c.min.y?(h=c.min.y-e.origin.y,h/=e.direction.y,p=!1,n=-1):e.origin.y>c.max.y&&(h=c.max.y-e.origin.y,h/=e.direction.y,
p=!1,n=1);e.origin.z<c.min.z?(m=c.min.z-e.origin.z,m/=e.direction.z,p=!1,u=-1):e.origin.z>c.max.z&&(m=c.max.z-e.origin.z,m/=e.direction.z,p=!1,u=1);if(p)return-1;p=0;h>f&&(p=1,f=h);m>f&&(p=2,f=m);switch(p){case 0:n=e.origin.y+e.direction.y*f;if(n<c.min.y||n>c.max.y)return Number.MAX_VALUE;e=e.origin.z+e.direction.z*f;if(e<c.min.z||e>c.max.z)return Number.MAX_VALUE;c.normal.set(k,0,0);break;case 1:k=e.origin.x+e.direction.x*f;if(k<c.min.x||k>c.max.x)return Number.MAX_VALUE;e=e.origin.z+e.direction.z*
f;if(e<c.min.z||e>c.max.z)return Number.MAX_VALUE;c.normal.set(0,n,0);break;case 2:k=e.origin.x+e.direction.x*f;if(k<c.min.x||k>c.max.x)return Number.MAX_VALUE;n=e.origin.y+e.direction.y*f;if(n<c.min.y||n>c.max.y)return Number.MAX_VALUE;c.normal.set(0,0,u)}return f};THREE.CollisionSystem.prototype.rayPlane=function(b,c){var e=b.direction.dot(c.normal),f=c.point.dot(c.normal);if(e<0)e=(f-b.origin.dot(c.normal))/e;else return Number.MAX_VALUE;return e>0?e:Number.MAX_VALUE};
THREE.CollisionSystem.prototype.raySphere=function(b,c){var e=c.center.clone().subSelf(b.origin);if(e.lengthSq<c.radiusSq)return-1;var f=e.dot(b.direction.clone());if(f<=0)return Number.MAX_VALUE;e=c.radiusSq-(e.lengthSq()-f*f);if(e>=0)return Math.abs(f)-Math.sqrt(e);return Number.MAX_VALUE};THREE.CollisionSystem.__v1=new THREE.Vector3;THREE.CollisionSystem.__v2=new THREE.Vector3;THREE.CollisionSystem.__v3=new THREE.Vector3;THREE.CollisionSystem.__nr=new THREE.Vector3;THREE.CollisionSystem.__m=new THREE.Matrix4;
THREE.CollisionSystem.__r=new THREE.Ray;THREE.CollisionUtils={};THREE.CollisionUtils.MeshOBB=function(b){b.geometry.computeBoundingBox();var c=b.geometry.boundingBox,e=new THREE.Vector3(c.x[0],c.y[0],c.z[0]),c=new THREE.Vector3(c.x[1],c.y[1],c.z[1]),e=new THREE.BoxCollider(e,c);e.mesh=b;return e};THREE.CollisionUtils.MeshAABB=function(b){var c=THREE.CollisionUtils.MeshOBB(b);c.min.addSelf(b.position);c.max.addSelf(b.position);c.dynamic=!1;return c};
THREE.CollisionUtils.MeshColliderWBox=function(b){return new THREE.MeshCollider(b,THREE.CollisionUtils.MeshOBB(b))};
if(THREE.WebGLRenderer)THREE.AnaglyphWebGLRenderer=function(b){THREE.WebGLRenderer.call(this,b);var c=this,e=this.setSize,f=this.render,h=new THREE.Camera,m=new THREE.Camera,k=new THREE.Matrix4,n=new THREE.Matrix4,u,p,v;h.useTarget=m.useTarget=!1;h.matrixAutoUpdate=m.matrixAutoUpdate=!1;var b={minFilter:THREE.LinearFilter,magFilter:THREE.NearestFilter,format:THREE.RGBAFormat},t=new THREE.WebGLRenderTarget(512,512,b),x=new THREE.WebGLRenderTarget(512,512,b),w=new THREE.Camera(53,1,1,1E4);w.position.z=
2;_material=new THREE.MeshShaderMaterial({uniforms:{mapLeft:{type:"t",value:0,texture:t},mapRight:{type:"t",value:1,texture:x}},vertexShader:"varying vec2 vUv;\nvoid main() {\nvUv = vec2( uv.x, 1.0 - uv.y );\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",fragmentShader:"uniform sampler2D mapLeft;\nuniform sampler2D mapRight;\nvarying vec2 vUv;\nvoid main() {\nvec4 colorL, colorR;\nvec2 uv = vUv;\ncolorL = texture2D( mapLeft, uv );\ncolorR = texture2D( mapRight, uv );\ngl_FragColor = vec4( colorL.g * 0.7 + colorL.b * 0.3, colorR.g, colorR.b, colorL.a + colorR.a ) * 1.1;\n}"});
var z=new THREE.Scene;z.addObject(new THREE.Mesh(new THREE.PlaneGeometry(2,2),_material));this.setSize=function(b,f){e.call(c,b,f);t.width=b;t.height=f;x.width=b;x.height=f};this.render=function(b,e){e.update(null,!0);if(u!==e.aspect||p!==e.near||v!==e.fov){u=e.aspect;p=e.near;v=e.fov;var D=e.projectionMatrix.clone(),G=125/30*0.5,H=G*p/125,E=p*Math.tan(v*Math.PI/360),N;k.n14=G;n.n14=-G;G=-E*u+H;N=E*u+H;D.n11=2*p/(N-G);D.n13=(N+G)/(N-G);h.projectionMatrix=D.clone();G=-E*u-H;N=E*u-H;D.n11=2*p/(N-G);
D.n13=(N+G)/(N-G);m.projectionMatrix=D.clone()}h.matrix=e.matrixWorld.clone().multiplySelf(n);h.update(null,!0);h.position.copy(e.position);h.near=p;h.far=e.far;f.call(c,b,h,t,!0);m.matrix=e.matrixWorld.clone().multiplySelf(k);m.update(null,!0);m.position.copy(e.position);m.near=p;m.far=e.far;f.call(c,b,m,x,!0);f.call(c,z,w)}};
if(THREE.WebGLRenderer)THREE.CrosseyedWebGLRenderer=function(b){THREE.WebGLRenderer.call(this,b);this.autoClear=!1;var c=this,e=this.setSize,f=this.render,h,m,k=new THREE.Camera,n=new THREE.Camera;c.separation=10;if(b&&b.separation!==void 0)c.separation=b.separation;(new THREE.Camera(53,window.innerWidth/2/window.innerHeight,1,1E4)).position.z=-10;this.setSize=function(b,f){e.call(c,b,f);h=b/2;m=f};this.render=function(b,e){this.clear();k.fov=e.fov;k.aspect=0.5*e.aspect;k.near=e.near;k.far=e.far;
k.updateProjectionMatrix();k.position.copy(e.position);k.target.position.copy(e.target.position);k.translateX(c.separation);n.projectionMatrix=k.projectionMatrix;n.position.copy(e.position);n.target.position.copy(e.target.position);n.translateX(-c.separation);this.setViewport(0,0,h,m);f.call(c,b,k);this.setViewport(h,0,h,m);f.call(c,b,n,!1)}};

define("three", function(){});

define('dat/mahog/shaders/BookUniforms',['dat/mahog/params','three'],
function(params) {

  var BookUniforms = {

    "near": { type: "f", value: 10 },
    "far": { type: "f", value: 1000 },

    "transparency": { type: "f", value: 1 },

    "dim": { type: "f", value: 0 },

    "fogColor": { type: "v3", value: new THREE.Vector3(0, 0, 0) },

    // TODO hook these into params, or better yet scene.fog
    "fogNear": { type: "f", value: params.near },
    "fogFar": { type: "f", value: params.far },

    "isCover": { type: "f", value: 0 },
    "isOpened": { type: "f", value: 0 },
    "thickness": { type: "f", value: 0 },

    "tint": { type: "v4", value: new THREE.Vector4(1, 1, 1, 0.001) },

    "tileSize": { type: "f", value: 1 / 16},
    "tileColumn": { type: "f", value: 0},
    "tileRow": { type: "f", value: 0},

    "texturemap": { type: "t", value: 2, texture: null },
    "lightmap": { type: "t", value: 3, texture: null },

    "enableLighting":         { type: "i", value: 1 },
    "ambientLightColor":       { type: "fv", value: [] },
    "directionalLightDirection":   { type: "fv", value: [] },
    "directionalLightColor":     { type: "fv", value: [] },
    "pointLightColor":         { type: "fv", value: [] },
    "pointLightPosition":       { type: "fv", value: [] },
    "pointLightDistance":       { type: "fv1", value: [] },

    "morphInfluences" : { type: "fv1", value: [] }

  };

  return BookUniforms;

});

/*!
 * JS Signals <http://millermedeiros.github.com/js-signals/>
 * Released under the MIT license <http://www.opensource.org/licenses/mit-license.php>
 * @author Miller Medeiros <http://millermedeiros.com/>
 * @version 0.6.1
 * @build 179 (05/03/2011 01:20 AM)
 */
(function(c){var a={VERSION:"0.6.1"};function b(h,g,e,f,d){this._listener=g;this._isOnce=e;this.context=f;this._signal=h;this._priority=d||0}b.prototype={active:true,execute:function(d){var e;if(this.active){e=this._listener.apply(this.context,d);if(this._isOnce){this.detach()}}return e},detach:function(){return this._signal.remove(this._listener)},getListener:function(){return this._listener},dispose:function(){this.detach();this._destroy()},_destroy:function(){delete this._signal;delete this._isOnce;delete this._listener;delete this.context},isOnce:function(){return this._isOnce},toString:function(){return"[SignalBinding isOnce: "+this._isOnce+", active: "+this.active+"]"}};a.Signal=function(){this._bindings=[]};a.Signal.prototype={_shouldPropagate:true,active:true,_registerListener:function(h,g,f,e){if(typeof h!=="function"){throw new Error("listener is a required param of add() and addOnce() and should be a Function.")}var d=this._indexOfListener(h),i;if(d!==-1){i=this._bindings[d];if(i.isOnce()!==g){throw new Error("You cannot add"+(g?"":"Once")+"() then add"+(!g?"":"Once")+"() the same listener without removing the relationship first.")}}else{i=new b(this,h,g,f,e);this._addBinding(i)}return i},_addBinding:function(d){var e=this._bindings.length;do{--e}while(this._bindings[e]&&d._priority<=this._bindings[e]._priority);this._bindings.splice(e+1,0,d)},_indexOfListener:function(d){var e=this._bindings.length;while(e--){if(this._bindings[e]._listener===d){return e}}return -1},add:function(f,e,d){return this._registerListener(f,false,e,d)},addOnce:function(f,e,d){return this._registerListener(f,true,e,d)},remove:function(e){if(typeof e!=="function"){throw new Error("listener is a required param of remove() and should be a Function.")}var d=this._indexOfListener(e);if(d!==-1){this._bindings[d]._destroy();this._bindings.splice(d,1)}return e},removeAll:function(){var d=this._bindings.length;while(d--){this._bindings[d]._destroy()}this._bindings.length=0},getNumListeners:function(){return this._bindings.length},halt:function(){this._shouldPropagate=false},dispatch:function(e){if(!this.active){return}var d=Array.prototype.slice.call(arguments),g=this._bindings.slice(),f=this._bindings.length;this._shouldPropagate=true;do{f--}while(g[f]&&this._shouldPropagate&&g[f].execute(d)!==false)},dispose:function(){this.removeAll();delete this._bindings},toString:function(){return"[Signal active: "+this.active+" numListeners: "+this.getNumListeners()+"]"}};c.signals=a}(window||global||this));
define("third-party/js-signals.min", function(){});

define('dat/mahog/BookInfo',[
  'third-party/js-signals.min'
], function() {

  var BookInfo = function(data) {

    this.data = data || {};
    this.status = new BookStatus(this);
    this.textures = {};
    this.id = undefined;
    this.bookDisplayer = undefined;
    this.applyThumbnail = function() {};


  };

  return BookInfo;

  function BookStatus(info) {

    var _this = this;

    defineBooleanWithSignal(info, 'displayer_attached');

    defineBooleanWithSignal(info, 'data_request_queued', true);

    defineBooleanWithSignal(info, 'data_requested');
    defineBooleanWithSignal(info, 'data_received');

    defineBooleanWithSignal(info, 'thumbnail_requested');
    defineBooleanWithSignal(info, 'thumbnail_received');
    defineBooleanWithSignal(info, 'thumbnail_created');
    defineBooleanWithSignal(info, 'thumbnail_applied', true);

    defineBooleanWithSignal(info, 'fullsize_requested');
    defineBooleanWithSignal(info, 'fullsize_received');
    defineBooleanWithSignal(info, 'fullsize_applied');

    this.registerListeners = function(listenerObject) {
//
//          for (var i in listenerObject) {
//            _this.signals[i].add(listenerObject[i]);
//          }

    };

    this.clearListeners = function() {
//          for (var i in _this.signals) {
//            _this.signals[i].removeAll();
//          }
    };

    /**
     * Creates a boolean property as well as a signal in the _this.signals
     * object that's automatically dispatched upon change of that
     * property's value.
     */
    function defineBooleanWithSignal(info, name, blockRedundant) {

      info[name] = false;

//
//          var val = false;
////          _this.signals['on_' + name] = new signals.Signal();
//          _this.__defineSetter__(name, function(v) {
//
//            if (val == v && blockRedundant) {
//              return;
//            }
////
////            val = v;
////
//            _this.signals['on_' + name].dispatch(v);
//
//
//          });
//          _this.__defineGetter__(name, function() {
//            return val;
//          });

    }

  }
});

define('dat/utils/urlArgs',[
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
define('dat/mahog/utils',[
  'dat/mahog/params',
  'dat/utils/urlArgs'
], function(params, urlArgs) {

  return {

    //thumbnailURL: function(bookId) {
      //return '/thumbnails/' + bookId + '.1.png';
    //},

    qrURL: function(bookId) {
//      if (urlArgs['installation']) {
        //return '/bookcase/api/qr/' + bookId;
        return 'api/qr/' + bookId;
//      } else {
        //return 'http://chart.googleapis.com/chart?chs=500x500&cht=qr&chl=http%3A%2F%2Fbooks.google.com%2Fbooks%3Fid%3D' + bookId + '%26dapp%3D1%26output%3Dmstore%26source%3Dge-ip-app';
//      }
    },

    fullsizeURL: function(bookId) {
//
      //return 'http://bks7.books.google.com/books?id=' + bookId +
          //'&printsec=frontcover' +
          //'&img=1' +
          //'&zoom=3' +
          //'&sig=ACfU3U1KvT3BshhBVhxgSl_cbwadWcVJlw' +
          //'&source=gbs_gdata';

//      return '/fullsize/' + bookId + '.3.png';
      return 'api/image/' + bookId;
      //return '/bookcase/api/image/' + bookId;
    },

    orbitToY: function(orbit) {
      return - orbit * params.shelfHeight / (Math.PI * 2);
    },

    yToRevolution: function(y) {
      var whole = Math.floor(y / params.shelfHeight);
      var remainder = y / params.shelfHeight - whole;
      return - Math.PI * 2 * remainder;
    },

    yToOrbit: function(y) {
      return - Math.PI * 2 * y / params.shelfHeight;
    },

    indexToY: function(index) {
      return (index / params.booksPerCircle) * params.shelfHeight;
    },

    yToIndex: function(y) {
      return y / params.shelfHeight * params.booksPerCircle;
    },

    orbitToIndex: function(orbit) {
      return this.yToIndex(this.orbitToY(orbit));
    }

  };

});

define('text!dat/mahog/data/dominant_colors.json', function () { return '[[255, 255, 255], [1, 1, 1], [0, 0, 0], [255, 255, 255], [227, 7, 10], [255, 255, 255], [255, 255, 255], [81, 66, 117], [0, 0, 0], [255, 255, 255], [255, 255, 255], [159, 0, 0], [255, 255, 255], [24, 34, 44], [255, 255, 255], [50, 51, 38], [255, 255, 255], [250, 214, 135], [255, 255, 255], [161, 189, 209], [255, 255, 255], [100, 16, 18], [232, 24, 40], [223, 227, 230], [255, 255, 255], [255, 255, 255], [255, 255, 255], [3, 7, 8], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 0, 0], [255, 255, 255], [19, 15, 12], [246, 159, 28], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [121, 73, 120], [153, 28, 31], [255, 255, 255], [0, 255, 0], [255, 255, 255], [255, 255, 0], [246, 243, 236], [0, 0, 0], [1, 1, 1], [0, 0, 0], [0, 139, 204], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [183, 184, 169], [0, 0, 0], [255, 255, 255], [255, 1, 0], [23, 117, 239], [255, 255, 255], [255, 255, 255], [255, 255, 255], [9, 8, 14], [40, 40, 88], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [34, 39, 42], [255, 255, 255], [0, 0, 0], [216, 56, 40], [255, 255, 255], [0, 195, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [5, 6, 8], [255, 255, 255], [1, 1, 0], [0, 0, 0], [255, 30, 25], [248, 200, 200], [255, 0, 0], [255, 255, 255], [254, 212, 74], [18, 12, 12], [255, 70, 0], [255, 255, 255], [255, 255, 255], [255, 243, 0], [255, 0, 0], [255, 255, 255], [35, 31, 32], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 232, 183], [255, 255, 255], [0, 255, 255], [255, 255, 255], [34, 32, 33], [0, 9, 8], [0, 0, 0], [239, 185, 255], [56, 50, 52], [255, 255, 255], [0, 1, 5], [0, 69, 41], [165, 207, 99], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [43, 24, 17], [255, 255, 255], [255, 255, 255], [237, 115, 94], [175, 147, 82], [0, 0, 0], [255, 69, 34], [255, 248, 0], [255, 243, 167], [255, 255, 0], [255, 255, 255], [239, 229, 214], [255, 255, 255], [255, 255, 255], [248, 232, 232], [68, 23, 27], [255, 255, 255], [255, 255, 255], [15, 8, 16], [16, 20, 19], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [254, 255, 255], [255, 8, 0], [250, 214, 135], [255, 255, 255], [254, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [1, 2, 7], [2, 205, 213], [255, 255, 255], [240, 247, 255], [1, 1, 1], [216, 152, 40], [90, 145, 138], [56, 56, 72], [154, 154, 154], [255, 255, 255], [255, 255, 255], [255, 255, 255], [232, 24, 40], [255, 255, 255], [255, 255, 255], [69, 39, 31], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [237, 33, 36], [0, 0, 0], [0, 12, 16], [7, 6, 4], [255, 255, 255], [34, 24, 23], [255, 255, 255], [25, 27, 22], [192, 31, 37], [0, 0, 0], [253, 253, 253], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [1, 2, 6], [243, 244, 213], [18, 18, 20], [0, 0, 0], [0, 0, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [0, 28, 255], [255, 29, 36], [249, 230, 187], [209, 178, 0], [255, 255, 255], [255, 255, 255], [255, 244, 216], [255, 255, 255], [255, 69, 0], [255, 255, 255], [0, 0, 0], [126, 52, 54], [0, 81, 255], [255, 255, 255], [43, 38, 42], [24, 120, 184], [255, 255, 255], [255, 255, 255], [13, 12, 10], [0, 255, 255], [98, 148, 159], [23, 14, 31], [0, 0, 0], [255, 255, 255], [248, 232, 8], [255, 255, 255], [0, 0, 0], [178, 138, 5], [255, 255, 255], [3, 1, 2], [255, 255, 255], [255, 255, 255], [248, 243, 247], [255, 255, 255], [255, 255, 255], [254, 243, 213], [239, 232, 210], [255, 255, 137], [127, 27, 27], [255, 255, 255], [255, 255, 255], [7, 55, 116], [231, 232, 234], [255, 255, 255], [255, 255, 255], [254, 245, 108], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [155, 154, 156], [0, 0, 0], [255, 255, 255], [255, 255, 255], [79, 80, 84], [8, 8, 8], [255, 255, 255], [4, 2, 3], [255, 255, 0], [255, 255, 255], [95, 31, 34], [255, 255, 255], [183, 184, 169], [255, 255, 255], [255, 255, 255], [255, 255, 255], [252, 226, 41], [255, 255, 255], [119, 13, 25], [130, 175, 216], [255, 1, 0], [0, 0, 0], [255, 255, 255], [255, 255, 255], [88, 104, 136], [255, 255, 255], [6, 19, 24], [229, 227, 215], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 7, 8], [0, 0, 0], [0, 0, 0], [1, 1, 1], [255, 255, 255], [255, 255, 255], [111, 135, 181], [0, 0, 0], [59, 186, 218], [255, 199, 157], [223, 220, 214], [255, 81, 134], [255, 255, 255], [0, 0, 0], [255, 255, 255], [11, 11, 11], [1, 1, 1], [255, 255, 255], [14, 14, 14], [0, 234, 198], [255, 255, 255], [255, 255, 251], [8, 8, 8], [255, 17, 111], [255, 255, 255], [238, 227, 30], [238, 248, 247], [254, 254, 254], [255, 255, 255], [255, 255, 255], [39, 14, 16], [255, 26, 20], [255, 255, 255], [254, 253, 232], [255, 255, 255], [255, 255, 255], [255, 255, 255], [204, 223, 206], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [23, 32, 49], [255, 0, 0], [6, 8, 7], [238, 217, 0], [0, 144, 189], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [245, 29, 0], [253, 179, 22], [0, 0, 0], [255, 255, 255], [255, 76, 60], [255, 255, 255], [150, 143, 0], [0, 0, 0], [255, 255, 255], [0, 255, 255], [127, 100, 73], [255, 255, 255], [255, 255, 255], [234, 214, 163], [255, 255, 255], [255, 255, 255], [255, 255, 255], [12, 31, 149], [255, 255, 255], [16, 15, 13], [142, 156, 0], [255, 255, 255], [16, 18, 17], [15, 15, 65], [0, 0, 0], [179, 64, 180], [255, 255, 255], [19, 65, 89], [90, 151, 182], [19, 18, 16], [255, 255, 255], [255, 255, 122], [164, 89, 47], [255, 255, 255], [65, 174, 255], [0, 6, 15], [255, 255, 255], [20, 182, 76], [241, 51, 37], [200, 56, 24], [255, 255, 255], [255, 255, 255], [255, 255, 241], [153, 31, 20], [255, 255, 255], [213, 231, 219], [196, 216, 225], [255, 255, 255], [255, 255, 255], [137, 138, 129], [255, 255, 255], [255, 255, 255], [242, 225, 216], [255, 255, 255], [7, 11, 14], [254, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [198, 214, 214], [196, 196, 196], [248, 232, 200], [255, 255, 255], [255, 255, 255], [255, 255, 255], [8, 9, 11], [14, 21, 34], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 254, 249], [20, 18, 18], [254, 255, 239], [149, 54, 49], [255, 255, 255], [255, 255, 255], [255, 249, 234], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 253], [255, 255, 255], [19, 15, 12], [255, 255, 255], [46, 123, 163], [57, 154, 207], [255, 222, 157], [1, 29, 77], [247, 130, 35], [34, 11, 57], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [239, 255, 255], [246, 159, 28], [128, 62, 12], [0, 0, 0], [19, 119, 194], [255, 255, 255], [255, 255, 220], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [53, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [252, 223, 9], [255, 255, 255], [255, 255, 255], [255, 255, 255], [1, 1, 1], [255, 255, 255], [56, 56, 56], [255, 255, 255], [232, 234, 247], [255, 255, 255], [242, 241, 228], [254, 254, 254], [35, 31, 32], [233, 248, 249], [250, 254, 255], [255, 255, 255], [232, 225, 220], [255, 255, 255], [59, 63, 66], [249, 242, 189], [255, 39, 255], [0, 81, 122], [255, 255, 255], [0, 173, 239], [255, 186, 27], [255, 255, 255], [31, 30, 28], [255, 255, 255], [3, 3, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [37, 64, 142], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [249, 255, 205], [0, 121, 194], [167, 216, 29], [24, 200, 40], [41, 43, 40], [255, 255, 255], [250, 248, 227], [255, 255, 255], [255, 255, 255], [0, 166, 222], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 56, 82], [216, 216, 216], [43, 163, 255], [255, 255, 255], [255, 255, 30], [71, 71, 71], [255, 255, 255], [255, 255, 255], [24, 120, 200], [255, 255, 255], [255, 255, 255], [255, 255, 255], [250, 6, 8], [255, 255, 255], [0, 0, 82], [206, 172, 125], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [0, 160, 47], [35, 31, 30], [39, 102, 19], [255, 255, 255], [5, 6, 8], [255, 251, 240], [0, 0, 0], [216, 40, 40], [239, 49, 33], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [53, 112, 57], [255, 255, 255], [255, 255, 255], [211, 76, 56], [255, 255, 255], [255, 255, 255], [24, 24, 26], [248, 88, 40], [255, 255, 255], [0, 0, 0], [122, 128, 186], [255, 73, 16], [255, 255, 255], [78, 201, 242], [255, 255, 255], [11, 10, 15], [0, 0, 0], [255, 229, 0], [255, 255, 255], [255, 255, 15], [255, 227, 255], [72, 73, 69], [255, 255, 255], [255, 164, 155], [255, 21, 0], [8, 20, 8], [0, 0, 0], [255, 255, 255], [21, 24, 42], [255, 255, 255], [255, 255, 255], [255, 255, 255], [38, 51, 95], [255, 255, 255], [134, 24, 27], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [105, 154, 212], [24, 27, 30], [3, 7, 8], [226, 244, 255], [255, 255, 255], [255, 255, 255], [104, 200, 168], [23, 22, 0], [10, 10, 12], [153, 28, 31], [255, 255, 255], [255, 255, 255], [255, 221, 0], [57, 73, 124], [93, 0, 0], [111, 83, 49], [255, 255, 255], [255, 255, 255], [255, 240, 23], [3, 153, 126], [114, 90, 253], [203, 144, 53], [255, 255, 255], [15, 44, 255], [255, 255, 255], [0, 139, 204], [0, 41, 75], [255, 24, 33], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [91, 143, 157], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 33, 34], [252, 243, 225], [2, 0, 1], [0, 0, 0], [255, 255, 255], [255, 255, 255], [253, 255, 254], [246, 19, 0], [255, 255, 255], [255, 30, 25], [255, 255, 255], [255, 255, 255], [255, 255, 255], [188, 215, 40], [157, 205, 164], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [22, 51, 91], [0, 49, 242], [255, 255, 255], [255, 255, 255], [8, 10, 9], [255, 255, 255], [5, 6, 8], [255, 253, 232], [255, 255, 255], [255, 103, 135], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 20, 15], [255, 255, 255], [12, 0, 0], [255, 255, 255], [255, 198, 231], [0, 0, 243], [255, 255, 255], [8, 8, 8], [241, 90, 63], [206, 197, 142], [8, 0, 0], [255, 255, 255], [32, 17, 12], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [100, 126, 78], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [1, 1, 0], [35, 31, 32], [255, 255, 255], [184, 216, 24], [255, 255, 255], [0, 28, 255], [6, 24, 0], [254, 24, 0], [255, 255, 255], [255, 255, 255], [6, 24, 0], [255, 255, 255], [184, 216, 24], [210, 0, 9], [6, 24, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [200, 216, 40], [255, 255, 255], [255, 255, 255], [6, 24, 0], [255, 255, 255], [6, 24, 0], [6, 24, 0], [255, 255, 255], [255, 255, 255], [6, 24, 0], [255, 255, 255], [6, 24, 0], [254, 242, 0], [255, 255, 255], [200, 216, 40], [255, 255, 255], [6, 24, 0], [6, 24, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [3, 7, 8], [233, 213, 200], [6, 24, 0], [147, 0, 0], [6, 24, 0], [255, 255, 255], [184, 216, 24], [6, 24, 34], [24, 200, 40], [255, 255, 255], [255, 255, 255], [6, 24, 0], [200, 216, 40], [40, 40, 40], [6, 24, 0], [255, 255, 255], [255, 255, 255], [6, 24, 0], [255, 255, 255], [0, 173, 239], [200, 216, 40], [6, 24, 0], [255, 255, 255], [255, 255, 255], [226, 246, 246], [6, 24, 0], [6, 24, 34], [239, 94, 39], [255, 255, 255], [255, 255, 255], [255, 255, 255], [6, 24, 34], [33, 43, 98], [6, 24, 0], [6, 24, 34], [6, 24, 34], [255, 255, 255], [255, 255, 255], [255, 255, 255], [254, 254, 254], [255, 255, 255], [200, 216, 40], [6, 23, 0], [200, 216, 40], [255, 255, 255], [255, 255, 255], [6, 24, 34], [6, 24, 0], [8, 88, 72], [255, 255, 255], [255, 255, 255], [253, 241, 189], [16, 17, 22], [223, 211, 197], [175, 30, 37], [0, 234, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 200, 1], [255, 255, 255], [255, 255, 255], [220, 27, 48], [39, 34, 100], [172, 36, 40], [255, 255, 255], [248, 253, 255], [236, 236, 236], [238, 232, 204], [176, 146, 71], [255, 255, 0], [240, 232, 211], [182, 216, 5], [255, 255, 255], [250, 247, 29], [255, 255, 255], [249, 240, 201], [255, 255, 255], [254, 232, 1], [246, 135, 17], [200, 224, 255], [255, 255, 255], [215, 200, 158], [255, 27, 48], [255, 255, 255], [255, 255, 255], [6, 24, 0], [8, 56, 8], [35, 31, 32], [4, 3, 8], [255, 255, 255], [187, 90, 21], [255, 76, 28], [231, 229, 170], [255, 255, 255], [6, 24, 0], [230, 226, 237], [254, 254, 254], [10, 10, 10], [255, 255, 255], [255, 255, 255], [255, 255, 255], [254, 242, 0], [255, 247, 224], [118, 56, 37], [255, 255, 255], [255, 255, 255], [206, 19, 67], [186, 3, 34], [255, 255, 33], [255, 255, 255], [255, 255, 255], [255, 255, 231], [255, 238, 237], [6, 24, 0], [255, 255, 255], [255, 255, 255], [254, 23, 0], [24, 88, 168], [13, 22, 21], [6, 24, 0], [193, 142, 85], [25, 27, 22], [255, 255, 255], [255, 255, 255], [112, 198, 47], [255, 255, 255], [254, 245, 230], [255, 255, 255], [255, 255, 255], [231, 219, 8], [83, 153, 208], [255, 255, 255], [231, 231, 231], [28, 44, 77], [150, 202, 76], [81, 35, 11], [255, 22, 42], [0, 0, 225], [82, 52, 14], [223, 76, 24], [255, 255, 255], [255, 255, 255], [1, 1, 0], [255, 255, 255], [255, 16, 16], [255, 255, 255], [255, 255, 255], [91, 87, 161], [255, 255, 255], [255, 89, 33], [210, 235, 239], [255, 255, 255], [186, 233, 251], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 82], [255, 42, 43], [255, 255, 255], [249, 239, 79], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [50, 51, 53], [255, 255, 255], [6, 0, 0], [243, 232, 178], [255, 255, 255], [255, 243, 24], [246, 214, 0], [255, 202, 32], [255, 255, 255], [233, 213, 200], [238, 65, 48], [32, 18, 17], [255, 255, 255], [193, 228, 229], [255, 255, 255], [51, 88, 132], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 15, 13], [6, 24, 0], [255, 255, 255], [248, 248, 216], [247, 203, 16], [255, 30, 0], [255, 255, 255], [176, 163, 207], [222, 217, 239], [255, 243, 223], [255, 35, 47], [255, 255, 255], [255, 255, 255], [255, 0, 0], [191, 222, 20], [255, 255, 255], [255, 176, 0], [254, 56, 45], [255, 255, 255], [253, 252, 222], [255, 255, 255], [255, 255, 255], [255, 255, 255], [198, 222, 100], [255, 255, 255], [255, 255, 255], [255, 255, 255], [154, 1, 81], [255, 255, 255], [214, 177, 122], [255, 129, 49], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 255, 255], [255, 255, 255], [255, 255, 255], [220, 29, 36], [255, 255, 149], [255, 255, 76], [139, 173, 0], [21, 17, 14], [246, 189, 170], [255, 255, 255], [255, 252, 217], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [18, 16, 19], [231, 250, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [197, 38, 42], [96, 187, 70], [182, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [254, 252, 191], [255, 255, 255], [250, 244, 255], [209, 121, 112], [255, 0, 40], [0, 0, 0], [16, 17, 0], [255, 255, 255], [6, 24, 34], [255, 21, 20], [255, 255, 255], [22, 24, 23], [255, 255, 255], [255, 255, 255], [224, 76, 25], [255, 255, 255], [0, 0, 0], [255, 249, 233], [255, 255, 255], [35, 15, 14], [255, 255, 255], [255, 255, 255], [255, 255, 255], [6, 24, 0], [239, 233, 211], [229, 0, 0], [255, 255, 255], [237, 56, 151], [255, 255, 255], [236, 33, 39], [241, 228, 194], [255, 255, 255], [255, 255, 255], [255, 255, 255], [247, 247, 249], [255, 255, 255], [255, 255, 255], [255, 255, 255], [220, 69, 48], [255, 255, 0], [247, 21, 16], [0, 0, 0], [254, 232, 0], [255, 255, 255], [185, 30, 34], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 254, 0], [255, 255, 255], [11, 5, 5], [255, 255, 255], [255, 255, 98], [255, 255, 255], [6, 7, 9], [255, 255, 255], [255, 255, 255], [255, 255, 255], [24, 32, 25], [255, 0, 0], [255, 255, 255], [255, 255, 255], [255, 8, 0], [255, 255, 255], [255, 255, 255], [0, 87, 23], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [25, 28, 31], [255, 255, 255], [255, 255, 255], [83, 44, 0], [255, 255, 255], [255, 255, 255], [41, 24, 255], [255, 255, 255], [255, 16, 24], [255, 255, 255], [255, 255, 255], [216, 200, 104], [255, 255, 255], [238, 27, 42], [0, 29, 0], [0, 154, 0], [255, 255, 255], [176, 0, 0], [255, 255, 255], [1, 10, 27], [26, 27, 31], [0, 0, 0], [0, 255, 255], [255, 255, 255], [40, 8, 8], [255, 255, 255], [255, 255, 255], [124, 72, 155], [255, 49, 0], [255, 0, 0], [1, 1, 1], [0, 0, 0], [123, 208, 232], [255, 211, 255], [19, 20, 50], [0, 9, 8], [255, 255, 255], [46, 52, 45], [255, 255, 255], [255, 221, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [13, 22, 101], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 1, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [5, 6, 8], [5, 6, 8], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [48, 65, 34], [255, 255, 255], [241, 215, 174], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [31, 21, 21], [255, 29, 16], [255, 255, 255], [255, 255, 255], [114, 36, 49], [0, 47, 57], [165, 29, 34], [255, 21, 0], [255, 255, 255], [19, 20, 19], [24, 24, 24], [255, 255, 255], [1, 27, 140], [255, 255, 255], [16, 7, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [20, 27, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [4, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 0], [158, 32, 40], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [50, 95, 148], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 24, 27], [6, 7, 9], [0, 0, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [46, 47, 52], [6, 19, 0], [21, 19, 22], [255, 255, 255], [255, 255, 255], [3, 7, 8], [255, 85, 53], [255, 255, 255], [0, 0, 0], [154, 12, 0], [17, 14, 18], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 255], [80, 54, 52], [80, 81, 83], [255, 255, 255], [255, 0, 0], [0, 1, 6], [255, 255, 255], [255, 255, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [95, 93, 105], [255, 255, 255], [255, 255, 255], [255, 255, 255], [19, 13, 13], [255, 255, 255], [255, 255, 42], [255, 0, 0], [255, 0, 0], [255, 254, 0], [255, 1, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 221, 155], [75, 38, 0], [255, 255, 255], [255, 66, 27], [255, 255, 255], [255, 255, 255], [7, 6, 11], [255, 255, 255], [0, 0, 0], [255, 0, 0], [73, 138, 49], [255, 255, 255], [255, 255, 255], [255, 9, 10], [0, 255, 0], [255, 44, 34], [8, 8, 8], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 38, 34], [255, 13, 39], [255, 255, 255], [46, 52, 45], [0, 0, 0], [255, 255, 98], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [0, 111, 144], [255, 255, 255], [21, 22, 36], [21, 27, 43], [255, 255, 255], [248, 168, 56], [255, 255, 255], [255, 255, 255], [255, 74, 87], [255, 255, 255], [255, 252, 247], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 44, 29], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [181, 195, 230], [198, 184, 171], [255, 255, 255], [254, 245, 152], [238, 77, 48], [0, 89, 133], [255, 255, 255], [189, 216, 239], [54, 246, 79], [240, 241, 236], [255, 255, 255], [255, 0, 0], [5, 5, 5], [203, 239, 251], [255, 255, 255], [25, 21, 18], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 0, 0], [255, 255, 255], [255, 23, 0], [255, 255, 255], [50, 133, 115], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 13, 16], [255, 255, 255], [255, 255, 255], [0, 255, 0], [255, 255, 255], [255, 255, 255], [255, 72, 0], [5, 6, 8], [4, 2, 3], [255, 255, 255], [0, 22, 48], [255, 255, 255], [255, 255, 255], [29, 214, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 131], [15, 18, 133], [255, 255, 255], [255, 255, 255], [26, 72, 161], [255, 255, 255], [8, 10, 8], [0, 0, 0], [0, 255, 0], [255, 255, 0], [255, 255, 255], [255, 255, 255], [251, 245, 223], [255, 255, 255], [0, 0, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [161, 156, 42], [255, 255, 255], [255, 255, 255], [147, 196, 241], [0, 70, 255], [255, 255, 255], [255, 255, 255], [183, 17, 55], [1, 0, 0], [225, 233, 235], [255, 0, 0], [83, 44, 0], [255, 255, 255], [255, 255, 255], [255, 255, 40], [203, 0, 44], [255, 255, 255], [255, 255, 255], [16, 15, 13], [255, 255, 255], [2, 2, 2], [255, 183, 166], [255, 255, 255], [250, 248, 255], [1, 12, 66], [17, 13, 10], [255, 203, 5], [10, 8, 9], [255, 255, 255], [96, 86, 85], [255, 235, 249], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [31, 148, 188], [255, 255, 0], [255, 13, 39], [255, 255, 255], [223, 227, 230], [255, 255, 255], [50, 194, 220], [255, 16, 24], [0, 0, 0], [255, 255, 255], [0, 0, 0], [255, 255, 250], [255, 250, 243], [255, 255, 255], [255, 255, 255], [17, 20, 16], [255, 255, 255], [0, 0, 0], [115, 95, 94], [255, 255, 255], [1, 85, 0], [255, 255, 255], [13, 22, 101], [234, 167, 27], [255, 255, 255], [255, 255, 255], [0, 113, 189], [255, 255, 255], [48, 19, 16], [16, 17, 16], [101, 15, 54], [230, 228, 212], [255, 255, 255], [0, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [226, 231, 237], [34, 30, 0], [255, 255, 255], [24, 0, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [0, 0, 255], [253, 255, 254], [255, 0, 0], [3, 7, 8], [255, 255, 255], [1, 1, 1], [41, 41, 41], [255, 255, 255], [255, 255, 255], [148, 215, 215], [255, 255, 255], [0, 0, 0], [255, 255, 255], [26, 27, 31], [255, 255, 255], [195, 181, 12], [255, 255, 255], [0, 0, 0], [255, 255, 255], [0, 0, 0], [0, 0, 0], [255, 255, 255], [255, 255, 255], [18, 40, 53], [255, 255, 255], [237, 27, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [230, 232, 73], [180, 32, 42], [255, 15, 13], [255, 49, 0], [19, 19, 255], [255, 255, 255], [255, 255, 233], [255, 255, 255], [70, 0, 0], [0, 0, 255], [0, 0, 0], [255, 255, 255], [253, 255, 254], [0, 0, 255], [255, 255, 255], [255, 255, 255], [255, 173, 255], [255, 244, 255], [0, 223, 171], [3, 7, 8], [255, 233, 0], [8, 182, 17], [16, 52, 108], [255, 255, 255], [255, 255, 13], [230, 244, 201], [237, 27, 36], [255, 255, 255], [255, 23, 22], [253, 250, 245], [255, 255, 255], [255, 15, 17], [0, 0, 0], [255, 255, 255], [255, 255, 255], [19, 20, 50], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [143, 27, 72], [255, 255, 255], [255, 255, 255], [30, 20, 18], [255, 255, 255], [91, 134, 62], [0, 0, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [178, 169, 149], [8, 6, 18], [11, 12, 7], [29, 108, 175], [255, 255, 255], [0, 0, 0], [255, 0, 0], [255, 255, 255], [253, 253, 253], [212, 61, 40], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [221, 198, 96], [255, 255, 255], [0, 0, 0], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 17, 15], [255, 255, 255], [255, 255, 255], [198, 220, 206], [255, 255, 255], [174, 32, 72], [255, 255, 255], [254, 177, 23], [11, 0, 0], [255, 255, 255], [33, 0, 0], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 0], [255, 237, 230], [204, 181, 232], [255, 1, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [179, 163, 60], [255, 255, 255], [255, 255, 255], [197, 219, 224], [255, 23, 39], [255, 0, 16], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 0], [255, 255, 255], [255, 75, 56], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 202, 255], [255, 255, 255], [255, 0, 0], [0, 255, 0], [255, 255, 255], [255, 75, 74], [255, 255, 255], [255, 255, 255], [1, 1, 1], [255, 255, 255], [255, 255, 255], [167, 226, 36], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [189, 37, 43], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [8, 24, 8], [255, 255, 255], [255, 250, 231], [255, 45, 39], [255, 255, 255], [255, 255, 255], [18, 20, 34], [228, 219, 179], [3, 7, 8], [255, 255, 255], [255, 255, 255], [255, 243, 255], [255, 255, 255], [255, 255, 13], [255, 255, 255], [0, 9, 8], [255, 250, 255], [255, 255, 255], [255, 255, 255], [0, 187, 181], [255, 255, 255], [121, 73, 120], [255, 16, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 29, 0], [110, 154, 137], [255, 255, 255], [155, 31, 41], [255, 85, 95], [255, 255, 255], [0, 0, 0], [255, 255, 255], [136, 56, 72], [255, 255, 255], [255, 255, 255], [156, 194, 169], [10, 12, 15], [255, 255, 255], [255, 255, 255], [31, 1, 0], [255, 255, 255], [125, 35, 27], [0, 0, 0], [1, 3, 0], [255, 255, 255], [255, 253, 240], [255, 229, 255], [0, 0, 0], [0, 73, 36], [10, 10, 10], [255, 255, 255], [255, 255, 255], [255, 247, 0], [15, 12, 16], [255, 255, 255], [255, 255, 255], [255, 255, 255], [189, 22, 29], [255, 255, 255], [55, 0, 147], [40, 36, 15], [255, 255, 255], [255, 255, 255], [254, 254, 123], [66, 181, 225], [114, 36, 49], [255, 134, 146], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [0, 0, 0], [66, 224, 159], [247, 174, 46], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 254], [248, 237, 205], [86, 104, 174], [251, 208, 7], [19, 20, 19], [255, 255, 0], [255, 255, 255], [255, 255, 255], [1, 1, 1], [255, 255, 255], [240, 226, 189], [255, 255, 255], [1, 27, 140], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [17, 15, 16], [255, 255, 255], [16, 7, 255], [255, 255, 255], [7, 6, 11], [255, 255, 255], [255, 255, 255], [126, 65, 34], [206, 175, 123], [0, 255, 255], [255, 248, 237], [255, 255, 255], [0, 255, 255], [0, 0, 0], [20, 27, 255], [255, 255, 255], [255, 255, 255], [0, 255, 255], [255, 0, 0], [255, 5, 0], [243, 251, 253], [248, 200, 216], [216, 216, 232], [255, 0, 112], [255, 255, 255], [255, 255, 255], [56, 40, 40], [255, 255, 255], [57, 44, 0], [41, 45, 0], [221, 123, 50], [0, 0, 0], [255, 255, 255], [255, 255, 255], [0, 8, 0], [255, 212, 59], [255, 255, 255], [232, 207, 127], [161, 127, 90], [27, 237, 240], [156, 32, 34], [255, 255, 255], [191, 202, 204], [255, 255, 255], [0, 133, 255], [255, 255, 255], [59, 137, 183], [254, 254, 7], [242, 233, 173], [52, 60, 60], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 226, 39], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 121, 33], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 151, 40], [0, 0, 0], [54, 38, 39], [248, 248, 232], [255, 255, 255], [255, 194, 152], [21, 16, 13], [202, 127, 2], [255, 255, 255], [0, 255, 255], [18, 53, 9], [10, 10, 10], [0, 255, 255], [255, 255, 255], [255, 255, 255], [255, 205, 181], [255, 255, 255], [255, 255, 255], [255, 255, 82], [255, 255, 255], [255, 255, 255], [129, 109, 51], [0, 0, 0], [50, 95, 148], [255, 255, 255], [255, 255, 255], [159, 137, 181], [255, 53, 96], [255, 255, 255], [97, 143, 156], [5, 7, 6], [255, 255, 255], [0, 0, 0], [255, 255, 255], [0, 22, 0], [255, 255, 255], [0, 0, 16], [255, 255, 255], [255, 255, 255], [240, 236, 246], [209, 210, 212], [255, 255, 255], [255, 255, 255], [32, 13, 17], [1, 1, 1], [0, 0, 0], [255, 255, 255], [6, 8, 5], [255, 255, 255], [5, 6, 8], [100, 113, 165], [0, 120, 137], [5, 6, 8], [255, 255, 255], [255, 255, 255], [255, 7, 0], [46, 47, 52], [255, 255, 255], [255, 255, 255], [11, 23, 255], [6, 19, 0], [255, 141, 64], [255, 198, 0], [0, 0, 12], [255, 255, 255], [255, 30, 0], [255, 255, 255], [255, 142, 198], [255, 255, 255], [255, 135, 13], [255, 16, 15], [1, 1, 1], [255, 206, 43], [255, 255, 255], [255, 255, 255], [69, 255, 255], [3, 7, 8], [255, 255, 255], [255, 255, 255], [0, 170, 0], [255, 255, 255], [255, 255, 255], [1, 149, 175], [255, 72, 69], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 30, 25], [255, 255, 255], [255, 242, 213], [255, 255, 255], [29, 55, 35], [3, 2, 0], [39, 40, 255], [255, 255, 255], [17, 14, 18], [255, 255, 255], [43, 48, 140], [255, 255, 255], [255, 255, 255], [92, 88, 53], [255, 255, 255], [255, 255, 255], [8, 0, 0], [44, 210, 212], [248, 44, 255], [255, 255, 255], [16, 7, 2], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 78, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 0, 255], [243, 247, 255], [255, 255, 255], [80, 54, 52], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 68, 0], [80, 81, 83], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 70, 0], [18, 20, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 243, 0], [0, 0, 14], [255, 255, 255], [255, 255, 255], [255, 255, 250], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 8, 7], [37, 21, 255], [7, 6, 11], [255, 0, 0], [255, 30, 38], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 236, 164], [0, 1, 6], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 189, 217], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 31, 9], [255, 0, 0], [255, 255, 255], [255, 255, 255], [0, 218, 54], [255, 255, 255], [35, 31, 32], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [167, 214, 218], [255, 255, 255], [254, 252, 240], [12, 33, 16], [255, 255, 255], [0, 162, 228], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [110, 154, 137], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [0, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [220, 217, 195], [17, 19, 60], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 0], [255, 255, 255], [255, 255, 255], [191, 0, 0], [160, 59, 17], [56, 255, 49], [160, 59, 17], [255, 255, 49], [255, 255, 255], [160, 59, 17], [72, 179, 70], [72, 179, 70], [72, 179, 70], [160, 59, 17], [255, 102, 0], [58, 53, 49], [72, 179, 70], [72, 179, 70], [0, 137, 204], [160, 59, 17], [255, 246, 247], [60, 50, 49], [247, 255, 255], [72, 179, 70], [0, 0, 0], [255, 255, 247], [0, 137, 204], [255, 255, 247], [255, 255, 255], [59, 49, 48], [0, 85, 171], [255, 255, 49], [72, 179, 70], [0, 137, 204], [191, 0, 0], [0, 137, 204], [59, 56, 49], [255, 255, 49], [56, 255, 49], [255, 102, 0], [0, 85, 171], [191, 0, 0], [247, 255, 255], [191, 0, 0], [0, 85, 171], [255, 102, 0], [255, 102, 0], [0, 137, 204], [255, 255, 247], [57, 52, 48], [49, 58, 53], [191, 0, 0], [255, 255, 247], [56, 255, 49], [72, 179, 70], [191, 0, 0], [191, 0, 0], [49, 52, 255], [51, 255, 50], [255, 255, 247], [49, 58, 57], [0, 85, 171], [160, 59, 17], [191, 0, 0], [191, 0, 0], [191, 0, 0], [50, 50, 60], [72, 179, 70], [191, 0, 0], [191, 0, 0], [50, 50, 60], [191, 0, 0], [220, 212, 201], [42, 16, 8], [255, 102, 0], [0, 137, 204], [72, 179, 70], [255, 102, 0], [51, 58, 50], [49, 58, 55], [0, 85, 171], [160, 59, 17], [255, 255, 255], [255, 255, 49], [16, 18, 14], [255, 255, 247], [255, 102, 0], [0, 85, 171], [160, 59, 17], [255, 102, 0], [255, 102, 0], [0, 137, 204], [57, 52, 48], [59, 49, 48], [57, 58, 50], [160, 59, 17], [255, 255, 49], [55, 58, 49], [0, 85, 171], [191, 0, 0], [247, 255, 255], [255, 255, 255], [255, 102, 0], [191, 0, 0], [49, 52, 255], [60, 50, 49], [191, 0, 0], [58, 55, 48], [255, 255, 49], [0, 85, 171], [255, 255, 49], [0, 137, 204], [255, 102, 0], [255, 49, 48], [255, 102, 0], [48, 58, 49], [72, 179, 70], [58, 58, 50], [60, 50, 49], [0, 85, 171], [72, 179, 70], [0, 85, 171], [255, 255, 247], [191, 0, 0], [0, 85, 171], [48, 58, 49], [72, 179, 70], [0, 137, 204], [72, 179, 70], [55, 58, 49], [255, 50, 49], [255, 255, 255], [255, 102, 0], [255, 255, 255], [160, 59, 17], [255, 102, 0], [72, 179, 70], [160, 59, 17], [191, 0, 0], [255, 102, 0], [255, 102, 0], [255, 250, 48], [57, 58, 50], [72, 179, 70], [0, 85, 171], [191, 0, 0], [72, 179, 70], [255, 255, 247], [191, 0, 0], [255, 102, 0], [160, 59, 17], [0, 137, 204], [160, 59, 17], [255, 102, 0], [160, 59, 17], [255, 255, 255], [72, 179, 70], [191, 0, 0], [5, 255, 255], [72, 179, 70], [160, 59, 17], [52, 57, 50], [58, 58, 50], [255, 255, 255], [48, 255, 49], [191, 0, 0], [160, 59, 17], [72, 179, 70], [255, 255, 255], [57, 57, 49], [191, 0, 0], [191, 0, 0], [0, 85, 171], [0, 85, 171], [0, 85, 171], [255, 102, 0], [58, 55, 48], [0, 137, 204], [49, 255, 57], [72, 179, 70], [255, 102, 0], [255, 102, 0], [160, 59, 17], [255, 50, 49], [56, 28, 30], [72, 179, 70], [255, 255, 247], [49, 58, 53], [255, 102, 0], [52, 255, 50], [255, 255, 49], [160, 59, 17], [160, 59, 17], [0, 137, 204], [0, 137, 204], [0, 85, 171], [191, 0, 0], [0, 85, 171], [0, 85, 171], [57, 58, 50], [48, 58, 49], [49, 58, 57], [0, 85, 171], [58, 55, 50], [0, 137, 204], [0, 137, 204], [255, 255, 247], [0, 137, 204], [221, 206, 195], [72, 179, 70], [255, 255, 255], [191, 0, 0], [72, 179, 70], [72, 179, 70], [72, 179, 70], [160, 59, 17], [160, 59, 17], [0, 137, 204], [160, 59, 17], [160, 59, 17], [255, 255, 247], [0, 85, 171], [255, 255, 49], [59, 49, 48], [0, 137, 204], [160, 59, 17], [59, 56, 49], [160, 59, 17], [72, 179, 70], [0, 85, 171], [0, 85, 171], [55, 58, 49], [0, 85, 171], [255, 255, 247], [0, 85, 171], [225, 213, 170], [0, 137, 204], [255, 102, 0], [160, 59, 17], [160, 59, 17], [255, 255, 255], [160, 59, 17], [0, 85, 171], [72, 179, 70], [0, 85, 171], [56, 57, 49], [191, 0, 0], [58, 53, 49], [51, 58, 50], [255, 102, 0], [0, 137, 204], [0, 85, 171], [160, 59, 17], [72, 179, 70], [72, 179, 70], [55, 255, 49], [247, 255, 255], [160, 59, 17], [59, 49, 48], [0, 137, 204], [49, 255, 51], [255, 53, 49], [0, 137, 204], [255, 255, 247], [58, 55, 48], [191, 0, 0], [72, 179, 70], [0, 85, 171], [72, 179, 70], [255, 255, 255], [58, 58, 50], [191, 0, 0], [160, 59, 17], [0, 137, 204], [255, 255, 247], [160, 59, 17], [0, 137, 204], [0, 137, 204], [72, 179, 70], [255, 255, 247], [255, 50, 49], [191, 0, 0], [255, 255, 255], [59, 49, 48], [49, 52, 61], [0, 137, 204], [255, 102, 0], [255, 255, 255], [0, 137, 204], [255, 53, 49], [247, 255, 255], [255, 255, 255], [255, 102, 0], [59, 56, 49], [72, 179, 70], [72, 179, 70], [72, 179, 70], [57, 57, 49], [57, 57, 49], [0, 85, 171], [58, 58, 50], [191, 0, 0], [255, 102, 0], [255, 255, 255], [59, 49, 48], [72, 179, 70], [191, 0, 0], [255, 255, 247], [0, 85, 171], [0, 137, 204], [49, 255, 255], [255, 255, 247], [160, 59, 17], [160, 59, 17], [255, 255, 247], [0, 137, 204], [160, 59, 17], [0, 137, 204], [255, 102, 0], [72, 179, 70], [255, 255, 255], [255, 255, 255], [0, 85, 171], [57, 58, 50], [0, 85, 171], [255, 255, 255], [255, 102, 0], [255, 255, 247], [0, 137, 204], [57, 57, 49], [255, 102, 0], [49, 52, 61], [117, 107, 39], [255, 255, 255], [56, 57, 49], [0, 85, 171], [59, 56, 49], [191, 0, 0], [0, 85, 171], [72, 179, 70], [52, 58, 48], [255, 255, 48], [60, 50, 49], [0, 137, 204], [49, 58, 57], [51, 58, 50], [191, 0, 0], [57, 57, 49], [0, 137, 204], [255, 255, 247], [72, 179, 70], [0, 85, 171], [255, 255, 247], [255, 102, 0], [0, 137, 204], [55, 58, 49], [255, 255, 247], [0, 137, 204], [52, 255, 50], [0, 137, 204], [248, 249, 235], [0, 137, 204], [57, 52, 48], [52, 255, 50], [160, 59, 17], [225, 218, 198], [191, 0, 0], [0, 137, 204], [0, 85, 171], [191, 0, 0], [191, 0, 0], [191, 0, 0], [60, 50, 49], [0, 85, 171], [0, 85, 171], [255, 102, 0], [255, 102, 0], [255, 102, 0], [255, 255, 49], [255, 49, 48], [0, 137, 204], [57, 57, 49], [0, 85, 171], [191, 0, 0], [0, 85, 171], [191, 0, 0], [58, 55, 50], [255, 255, 255], [50, 50, 60], [0, 85, 171], [58, 55, 50], [58, 53, 49], [255, 255, 255], [255, 255, 49], [255, 102, 0], [0, 137, 204], [0, 137, 204], [255, 255, 255], [0, 85, 171], [191, 0, 0], [255, 254, 49], [0, 85, 171], [255, 255, 255], [255, 102, 0], [160, 59, 17], [255, 102, 0], [59, 56, 49], [59, 49, 48], [160, 59, 17], [0, 85, 171], [49, 57, 59], [255, 255, 255], [0, 85, 171], [0, 137, 204], [49, 58, 55], [160, 59, 17], [0, 137, 204], [52, 58, 48], [255, 49, 48], [48, 56, 58], [57, 52, 48], [72, 179, 70], [0, 137, 204], [255, 102, 0], [255, 255, 255], [0, 137, 204], [160, 59, 17], [255, 255, 255], [49, 58, 53], [51, 58, 50], [49, 255, 255], [58, 58, 50], [0, 137, 204], [191, 0, 0], [0, 85, 171], [52, 57, 50], [58, 53, 49], [72, 179, 70], [51, 58, 50], [58, 53, 49], [0, 137, 204], [0, 137, 204], [0, 137, 204], [255, 255, 255], [0, 137, 204], [72, 179, 70], [255, 102, 0], [59, 49, 48], [49, 58, 57], [255, 255, 48], [51, 255, 50], [72, 179, 70], [0, 85, 171], [72, 179, 70], [72, 179, 70], [61, 72, 56], [255, 255, 255], [0, 137, 204], [0, 137, 204], [0, 137, 204], [0, 137, 204], [191, 0, 0], [255, 255, 255], [72, 179, 70], [51, 58, 50], [0, 85, 171], [49, 58, 57], [255, 255, 255], [60, 50, 49], [58, 55, 48], [72, 180, 71], [72, 180, 71], [255, 255, 255], [0, 84, 170], [160, 59, 17], [153, 147, 129], [255, 101, 1], [0, 137, 205], [48, 58, 49], [52, 58, 48], [0, 137, 205], [0, 137, 204], [57, 52, 48], [160, 59, 17], [255, 255, 247], [255, 255, 247], [160, 59, 17], [160, 59, 17], [0, 137, 204], [255, 101, 1], [48, 255, 49], [190, 0, 2], [191, 0, 0], [160, 59, 17], [255, 255, 255], [160, 59, 17], [190, 0, 2], [0, 85, 171], [72, 180, 71], [0, 137, 205], [255, 102, 0], [253, 254, 246], [160, 59, 17], [72, 180, 71], [255, 255, 255], [72, 180, 71], [190, 0, 2], [0, 137, 205], [72, 180, 71], [0, 84, 170], [0, 84, 170], [255, 250, 247], [49, 52, 61], [255, 101, 1], [255, 255, 42], [34, 32, 33], [255, 255, 255], [255, 255, 255], [10, 4, 26], [239, 229, 214], [255, 255, 255], [251, 245, 223], [0, 9, 8], [255, 255, 255], [0, 0, 0], [98, 148, 159], [248, 232, 8], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 1, 0], [203, 204, 199], [40, 8, 8], [255, 255, 255], [255, 255, 255], [255, 255, 255], [90, 198, 208], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 195, 49], [0, 3, 5], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [253, 251, 252], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [82, 47, 129], [83, 83, 119], [255, 255, 255], [255, 29, 36], [255, 255, 255], [248, 232, 200], [0, 23, 0], [0, 7, 15], [6, 24, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [178, 162, 133], [255, 0, 0], [255, 0, 0], [0, 0, 0], [255, 0, 0], [5, 1, 2], [0, 0, 0], [242, 185, 56], [0, 87, 23], [94, 159, 186], [255, 255, 255], [255, 255, 255], [255, 30, 47], [255, 255, 255], [0, 255, 255], [212, 212, 174], [0, 0, 0], [0, 93, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [146, 26, 28], [0, 0, 0], [255, 255, 255], [255, 255, 0], [122, 144, 59], [255, 255, 255], [255, 28, 99], [161, 156, 42], [255, 255, 255], [0, 146, 43], [1, 0, 0], [243, 118, 152], [255, 255, 255], [1, 1, 1], [6, 6, 8], [255, 183, 166], [255, 203, 5], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 0, 0], [42, 69, 138], [0, 0, 0], [255, 255, 255], [233, 245, 246], [0, 0, 0], [11, 12, 47], [255, 255, 255], [0, 0, 0], [187, 90, 73], [255, 14, 50], [162, 49, 45], [255, 255, 255], [45, 138, 117], [45, 138, 117], [35, 34, 203], [249, 247, 230], [248, 232, 184], [255, 255, 255], [237, 211, 36], [255, 255, 225], [255, 255, 255], [245, 235, 173], [255, 27, 26], [0, 255, 255], [255, 255, 255], [35, 31, 32], [0, 0, 0], [0, 0, 0], [255, 255, 255], [255, 0, 0], [25, 36, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [237, 27, 0], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [0, 0, 255], [255, 255, 255], [255, 233, 0], [111, 195, 195], [255, 255, 255], [228, 238, 255], [10, 10, 12], [255, 255, 255], [5, 0, 6], [255, 23, 22], [255, 255, 255], [0, 255, 255], [0, 0, 0], [255, 255, 255], [206, 206, 228], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 40, 78], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [252, 223, 9], [166, 71, 101], [255, 255, 255], [255, 255, 255], [13, 13, 11], [255, 255, 255], [165, 70, 154], [255, 255, 255], [127, 27, 27], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [152, 200, 72], [255, 255, 255], [242, 241, 228], [20, 48, 223], [242, 242, 242], [0, 0, 0], [25, 58, 62], [255, 255, 255], [197, 219, 224], [255, 255, 40], [142, 145, 0], [255, 202, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [19, 39, 74], [255, 255, 255], [255, 255, 255], [255, 255, 255], [99, 203, 232], [255, 255, 255], [255, 228, 124], [0, 0, 0], [0, 0, 0], [253, 252, 248], [255, 255, 255], [239, 243, 255], [255, 255, 255], [255, 255, 255], [24, 136, 200], [255, 255, 255], [255, 255, 255], [255, 255, 255], [209, 31, 42], [239, 214, 43], [241, 246, 0], [255, 255, 255], [229, 228, 224], [255, 255, 255], [255, 255, 255], [229, 227, 215], [0, 0, 0], [0, 0, 0], [255, 255, 255], [31, 21, 21], [255, 46, 49], [255, 255, 255], [35, 64, 142], [0, 0, 0], [1, 1, 1], [36, 95, 175], [0, 6, 17], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [243, 227, 227], [5, 6, 8], [255, 255, 249], [0, 0, 0], [255, 255, 255], [250, 254, 255], [40, 135, 255], [120, 56, 104], [86, 104, 174], [0, 0, 0], [255, 255, 255], [120, 56, 104], [14, 14, 14], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [247, 245, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [245, 28, 213], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [22, 51, 91], [255, 255, 255], [0, 0, 0], [243, 243, 243], [4, 0, 0], [255, 255, 255], [255, 255, 255], [248, 248, 246], [255, 255, 255], [248, 88, 40], [0, 0, 0], [255, 255, 255], [0, 0, 0], [10, 10, 10], [23, 32, 49], [6, 8, 7], [6, 6, 6], [255, 255, 255], [255, 255, 255], [99, 74, 159], [255, 255, 255], [85, 24, 6], [129, 109, 51], [255, 0, 37], [164, 188, 255], [246, 234, 188], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 209, 205], [255, 255, 255], [255, 255, 255], [111, 195, 195], [255, 255, 255], [0, 195, 255], [232, 56, 40], [255, 255, 255], [255, 231, 225], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [254, 254, 252], [255, 135, 13], [255, 255, 255], [0, 5, 6], [41, 31, 22], [1, 3, 2], [255, 255, 255], [255, 255, 255], [255, 255, 255], [1, 56, 95], [0, 0, 0], [255, 255, 255], [255, 255, 255], [227, 231, 236], [255, 255, 255], [255, 255, 255], [255, 255, 255], [247, 245, 232], [255, 70, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 232, 236], [255, 37, 124], [255, 255, 255], [255, 8, 7], [255, 255, 255], [255, 243, 209], [255, 41, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [45, 75, 165], [0, 1, 1], [255, 255, 255], [12, 255, 255], [255, 255, 255], [255, 255, 255], [253, 255, 254], [255, 255, 255], [255, 255, 255], [255, 255, 255], [24, 24, 26], [255, 255, 255], [36, 54, 139], [255, 255, 0], [0, 0, 0], [255, 255, 255], [19, 176, 66], [255, 255, 255], [242, 225, 216], [255, 255, 255], [0, 0, 6], [255, 40, 26], [8, 72, 104], [131, 83, 135], [0, 178, 182], [255, 255, 255], [255, 8, 0], [254, 254, 242], [255, 255, 255], [255, 255, 255], [215, 202, 111], [0, 0, 0], [255, 255, 252], [255, 255, 0], [0, 255, 255], [255, 255, 255], [88, 8, 40], [0, 0, 0], [255, 255, 255], [240, 149, 192], [255, 255, 255], [253, 253, 255], [51, 58, 50], [255, 20, 255], [255, 255, 255], [193, 224, 25], [227, 34, 41], [0, 0, 210], [208, 28, 20], [53, 68, 68], [248, 247, 242], [255, 255, 255], [255, 255, 255], [26, 72, 161], [255, 255, 255], [35, 75, 25], [255, 255, 255], [255, 249, 227], [5, 108, 55], [255, 35, 39], [255, 35, 47], [255, 255, 255], [255, 212, 59], [255, 243, 230], [255, 30, 0], [255, 255, 255], [255, 255, 255], [148, 143, 198], [255, 255, 255], [59, 56, 49], [223, 227, 230], [255, 255, 255], [255, 255, 255], [255, 255, 247], [0, 0, 0], [49, 52, 57], [72, 180, 71], [216, 40, 40], [0, 78, 0], [0, 255, 255], [255, 255, 255], [34, 26, 0], [0, 1, 11], [206, 229, 70], [140, 148, 196], [246, 243, 255], [171, 210, 179], [30, 37, 39], [179, 77, 57], [172, 148, 121], [221, 205, 17], [81, 43, 72], [115, 139, 149], [255, 249, 255], [106, 44, 40], [241, 233, 216], [2, 3, 23], [4, 53, 100], [150, 56, 59], [255, 202, 24], [255, 8, 255], [255, 202, 24], [22, 26, 109], [152, 48, 49], [98, 81, 56], [71, 111, 115], [82, 68, 149], [255, 255, 255], [115, 36, 44], [0, 4, 71], [255, 255, 255], [205, 179, 146], [244, 158, 73], [160, 101, 62], [154, 157, 167], [255, 204, 25], [102, 156, 169], [160, 59, 17], [1, 22, 34], [122, 66, 54], [129, 43, 52], [32, 39, 77], [14, 13, 11], [255, 9, 210], [91, 59, 58], [0, 0, 50], [0, 0, 0], [1, 54, 48], [0, 0, 10], [244, 184, 135], [169, 129, 130], [195, 213, 228], [124, 38, 36], [17, 15, 37], [0, 0, 6], [24, 23, 33], [136, 8, 88], [222, 194, 154], [23, 61, 78], [255, 233, 197], [78, 101, 58], [255, 255, 255], [255, 255, 255], [137, 104, 110], [33, 27, 60], [255, 255, 255], [30, 41, 115], [255, 255, 255], [155, 49, 53], [213, 158, 102], [11, 0, 28], [29, 42, 46], [38, 69, 89], [101, 139, 209], [229, 171, 97], [15, 29, 159], [255, 236, 129], [247, 238, 157], [15, 17, 16], [237, 121, 72], [184, 190, 204], [255, 255, 255], [200, 143, 171], [82, 138, 208], [117, 116, 90], [142, 66, 174], [0, 0, 6], [253, 201, 0], [202, 71, 74], [0, 0, 5], [255, 255, 255], [240, 142, 85], [229, 50, 47], [59, 123, 173], [169, 178, 149], [0, 0, 2], [255, 255, 255], [239, 57, 57], [201, 173, 125], [255, 255, 255], [240, 0, 235], [59, 89, 135], [211, 0, 0], [255, 255, 255], [44, 67, 156], [27, 26, 25], [38, 93, 175], [0, 229, 0], [19, 15, 54], [255, 255, 255], [246, 241, 245], [0, 0, 10], [1, 0, 0], [102, 154, 188], [248, 168, 24], [74, 34, 33], [245, 245, 255], [252, 245, 203], [55, 73, 43], [177, 78, 42], [0, 9, 71], [216, 103, 64], [255, 255, 255], [41, 44, 100], [161, 152, 112], [27, 0, 135], [255, 255, 255], [0, 0, 2], [228, 234, 192], [147, 165, 177], [145, 45, 40], [255, 88, 255], [255, 255, 255], [0, 19, 61], [60, 77, 147], [255, 255, 255], [151, 145, 115], [14, 49, 96], [50, 64, 132], [128, 33, 28], [248, 0, 67], [0, 0, 52], [255, 255, 255], [61, 53, 49], [255, 255, 255], [212, 104, 98], [255, 255, 255], [97, 36, 84], [255, 255, 255], [189, 126, 116], [32, 56, 25], [109, 42, 96], [255, 255, 255], [255, 249, 207], [201, 239, 250], [164, 137, 115], [170, 176, 192], [30, 46, 79], [2, 0, 14], [151, 169, 232], [245, 120, 69], [255, 255, 255], [23, 64, 42], [38, 47, 106], [255, 255, 255], [255, 255, 255], [83, 163, 164], [215, 144, 82], [35, 94, 121], [130, 58, 66], [139, 205, 190], [10, 21, 33], [207, 170, 124], [255, 255, 255], [19, 20, 41], [255, 255, 255], [245, 197, 85], [69, 60, 47], [22, 52, 48], [136, 8, 88], [48, 91, 115], [233, 186, 132], [186, 206, 238], [94, 68, 68], [0, 0, 134], [255, 255, 255], [42, 39, 95], [43, 94, 95], [32, 64, 148], [125, 51, 37], [56, 57, 49], [248, 193, 117], [32, 0, 0], [255, 255, 255], [0, 0, 216], [60, 126, 190], [137, 140, 192], [133, 69, 59], [24, 19, 52], [174, 197, 223], [248, 168, 24], [47, 25, 28], [243, 118, 247], [51, 89, 152], [10, 44, 31], [146, 53, 43], [255, 255, 255], [162, 176, 185], [185, 22, 21], [235, 195, 160], [0, 0, 6], [123, 163, 162], [0, 0, 0], [95, 126, 255], [190, 210, 242], [215, 158, 139], [38, 45, 118], [126, 156, 219], [255, 255, 255], [136, 107, 65], [18, 22, 33], [139, 111, 81], [255, 255, 255], [174, 155, 85], [74, 87, 117], [0, 10, 47], [217, 194, 146], [0, 0, 5], [22, 54, 84], [69, 17, 27], [232, 230, 235], [187, 217, 255], [109, 45, 54], [150, 51, 31], [232, 209, 199], [31, 44, 97], [174, 155, 79], [228, 202, 178], [255, 255, 255], [28, 44, 68], [126, 180, 229], [131, 13, 8], [255, 255, 255], [144, 140, 130], [25, 27, 39], [179, 75, 69], [230, 139, 56], [253, 115, 68], [0, 37, 125], [192, 139, 29], [192, 136, 92], [239, 148, 74], [241, 234, 205], [0, 0, 2], [36, 79, 100], [0, 42, 43], [142, 42, 37], [238, 227, 226], [4, 4, 17], [227, 194, 157], [65, 37, 86], [255, 226, 215], [239, 174, 98], [167, 200, 217], [255, 255, 255], [255, 255, 255], [22, 23, 36], [39, 60, 123], [28, 26, 52], [0, 24, 12], [27, 69, 130], [230, 184, 105], [15, 26, 80], [155, 182, 159], [98, 45, 46], [244, 242, 248], [202, 89, 66], [3, 15, 65], [247, 241, 84], [255, 226, 212], [248, 168, 24], [29, 33, 98], [200, 184, 151], [255, 255, 255], [255, 255, 255], [31, 35, 63], [255, 255, 255], [114, 164, 228], [0, 0, 0], [246, 245, 119], [249, 245, 246], [95, 57, 126], [136, 112, 82], [20, 32, 102], [255, 255, 255], [121, 159, 179], [254, 166, 144], [45, 0, 227], [239, 240, 242], [174, 185, 235], [112, 99, 55], [179, 205, 235], [255, 118, 0], [255, 255, 255], [107, 130, 224], [85, 115, 188], [191, 230, 212], [78, 66, 173], [69, 20, 12], [255, 255, 255], [255, 255, 255], [171, 151, 123], [255, 255, 255], [18, 61, 16], [43, 42, 57], [35, 26, 66], [21, 23, 34], [216, 204, 128], [253, 202, 61], [213, 224, 145], [171, 159, 200], [14, 33, 0], [93, 128, 48], [255, 255, 255], [113, 104, 163], [142, 83, 42], [58, 67, 104], [138, 38, 38], [140, 47, 31], [255, 255, 255], [122, 135, 123], [236, 196, 125], [255, 204, 25], [229, 28, 32], [255, 255, 255], [255, 255, 0], [0, 12, 25], [38, 49, 90], [30, 63, 53], [255, 255, 255], [26, 27, 80], [6, 24, 106], [218, 116, 157], [255, 255, 255], [35, 42, 115], [255, 47, 255], [0, 0, 40], [35, 128, 122], [27, 26, 35], [252, 0, 255], [113, 95, 65], [251, 250, 255], [66, 142, 128], [46, 124, 209], [30, 28, 127], [188, 138, 0], [242, 0, 0], [159, 93, 133], [32, 52, 128], [238, 227, 182], [190, 228, 238], [132, 43, 70], [247, 244, 249], [11, 10, 16], [213, 200, 173], [235, 179, 210], [11, 11, 17], [38, 24, 16], [104, 118, 168], [255, 255, 255], [243, 159, 73], [141, 144, 156], [211, 76, 70], [255, 255, 255], [254, 254, 254], [255, 255, 255], [22, 111, 185], [27, 35, 71], [77, 27, 34], [175, 50, 51], [255, 255, 255], [52, 91, 65], [170, 166, 165], [12, 0, 2], [207, 229, 164], [252, 150, 128], [7, 37, 110], [156, 92, 77], [155, 66, 63], [205, 203, 198], [2, 2, 4], [0, 0, 137], [24, 22, 54], [240, 200, 86], [143, 53, 52], [229, 202, 181], [254, 142, 70], [192, 185, 167], [255, 255, 255], [36, 41, 90], [0, 0, 55], [255, 255, 255], [174, 115, 109], [159, 52, 54], [255, 228, 74], [192, 8, 14], [255, 255, 255], [244, 158, 73], [99, 21, 43], [255, 247, 16], [255, 242, 213], [13, 11, 22], [225, 200, 178], [255, 255, 255], [181, 130, 41], [242, 208, 59], [50, 107, 109], [17, 57, 64], [255, 255, 255], [31, 33, 36], [63, 42, 107], [83, 41, 45], [161, 188, 217], [175, 118, 110], [122, 169, 227], [253, 250, 255], [80, 125, 188], [248, 247, 253], [62, 62, 66], [121, 44, 94], [255, 255, 255], [29, 46, 134], [163, 189, 108], [151, 50, 43], [49, 128, 98], [81, 34, 36], [31, 12, 0], [255, 219, 175], [146, 34, 33], [67, 91, 143], [133, 53, 122], [121, 28, 30], [47, 66, 154], [60, 94, 71], [31, 40, 74], [178, 201, 139], [72, 10, 22], [242, 231, 56], [22, 243, 247], [249, 89, 78], [131, 47, 36], [255, 255, 255], [170, 196, 226], [191, 106, 26], [255, 255, 255], [151, 0, 213], [43, 25, 30], [35, 29, 69], [28, 110, 104], [106, 39, 40], [32, 25, 9], [76, 68, 107], [1, 0, 6], [255, 234, 132], [1, 0, 5], [117, 128, 190], [151, 10, 44], [255, 255, 255], [0, 0, 10], [0, 0, 5], [56, 57, 83], [0, 12, 53], [160, 149, 121], [255, 255, 255], [248, 246, 249], [247, 240, 210], [185, 223, 208], [255, 235, 139], [81, 43, 68], [13, 13, 15], [34, 67, 52], [240, 239, 250], [199, 67, 55], [43, 39, 54], [28, 33, 76], [103, 73, 132], [40, 84, 176], [0, 0, 0], [0, 0, 0], [221, 75, 61], [252, 212, 154], [183, 151, 118], [36, 55, 115], [212, 191, 166], [116, 40, 255], [255, 202, 99], [112, 50, 205], [28, 109, 63], [109, 52, 59], [182, 186, 197], [200, 195, 63], [90, 138, 200], [163, 167, 145], [181, 116, 84], [193, 135, 61], [55, 83, 127], [58, 114, 125], [244, 158, 73], [6, 24, 49], [0, 0, 0], [37, 0, 5], [255, 255, 255], [26, 38, 74], [153, 168, 255], [1, 26, 37], [66, 49, 106], [2, 159, 26], [0, 0, 11], [2, 1, 6], [255, 255, 255], [15, 17, 20], [158, 49, 43], [57, 101, 176], [106, 49, 119], [76, 28, 32], [35, 0, 188], [38, 35, 114], [136, 8, 56], [29, 28, 42], [232, 195, 161], [24, 119, 56], [254, 254, 254], [32, 21, 71], [255, 255, 255], [255, 255, 255], [62, 39, 64], [255, 255, 255], [38, 67, 130], [88, 104, 104], [0, 0, 5], [31, 43, 123], [255, 255, 255], [129, 31, 20], [204, 218, 180], [39, 41, 98], [224, 204, 175], [0, 0, 0], [251, 244, 198], [239, 237, 239], [255, 76, 255], [255, 255, 255], [255, 255, 255], [34, 41, 96], [14, 27, 80], [22, 21, 60], [16, 19, 31], [49, 255, 255], [208, 189, 177], [15, 0, 16], [94, 117, 211], [21, 54, 171], [52, 146, 208], [255, 255, 255], [0, 0, 114], [169, 174, 186], [138, 40, 27], [0, 3, 23], [254, 254, 254], [242, 241, 243], [255, 255, 0], [62, 57, 73], [243, 240, 255], [214, 84, 85], [181, 165, 209], [88, 38, 39], [67, 27, 24], [255, 255, 255], [3, 20, 98], [241, 80, 54], [10, 36, 155], [173, 122, 128], [1, 0, 5], [34, 29, 30], [76, 25, 44], [173, 185, 232], [255, 255, 255], [216, 26, 89], [0, 0, 0], [234, 220, 185], [21, 21, 82], [26, 26, 28], [89, 132, 166], [231, 173, 126], [255, 255, 255], [13, 17, 46], [245, 226, 180], [254, 255, 255], [255, 255, 255], [0, 1, 6], [45, 97, 145], [244, 234, 238], [127, 121, 132], [193, 38, 54], [176, 112, 50], [255, 254, 233], [7, 132, 89], [42, 38, 96], [249, 246, 249], [255, 255, 255], [234, 217, 223], [255, 255, 255], [255, 255, 255], [175, 202, 231], [11, 14, 23], [155, 158, 171], [175, 162, 143], [69, 127, 137], [133, 38, 32], [255, 255, 255], [160, 21, 24], [255, 254, 171], [244, 158, 73], [255, 17, 20], [0, 5, 32], [86, 96, 146], [0, 137, 205], [251, 241, 240], [182, 71, 73], [231, 129, 255], [182, 155, 137], [0, 0, 0], [0, 0, 254], [72, 180, 71], [40, 69, 172], [126, 136, 50], [240, 191, 147], [167, 162, 180], [22, 56, 49], [22, 68, 155], [137, 57, 55], [92, 79, 192], [31, 26, 106], [160, 41, 135], [74, 122, 122], [255, 255, 255], [0, 0, 13], [89, 70, 40], [72, 133, 204], [107, 60, 63], [160, 61, 167], [79, 65, 48], [0, 0, 0], [241, 207, 92], [243, 240, 246], [43, 0, 12], [24, 24, 36], [238, 237, 242], [8, 72, 248], [91, 81, 172], [194, 104, 79], [15, 24, 48], [203, 70, 76], [27, 29, 27], [67, 125, 189], [33, 44, 72], [208, 220, 255], [143, 0, 40], [255, 255, 255], [255, 255, 255], [248, 168, 24], [23, 31, 31], [255, 255, 117], [183, 0, 37], [199, 175, 142], [214, 225, 208], [239, 198, 132], [17, 64, 177], [113, 35, 31], [198, 128, 59], [255, 255, 31], [255, 255, 255], [0, 137, 205], [25, 42, 129], [238, 193, 68], [255, 255, 255], [1, 0, 5], [36, 43, 79], [255, 255, 255], [8, 104, 184], [41, 61, 159], [255, 255, 255], [255, 255, 255], [0, 7, 41], [191, 83, 48], [198, 173, 153], [211, 203, 58], [97, 148, 152], [30, 139, 119], [204, 148, 99], [8, 9, 13], [25, 147, 120], [57, 35, 76], [117, 157, 204], [136, 147, 197], [27, 44, 92], [255, 255, 255], [60, 94, 170], [175, 65, 65], [221, 82, 59], [237, 232, 182], [255, 255, 16], [250, 249, 255], [210, 0, 0], [0, 24, 21], [168, 162, 130], [22, 9, 12], [209, 228, 235], [225, 89, 123], [66, 176, 234], [255, 255, 255], [7, 7, 0], [238, 235, 230], [190, 124, 40], [91, 100, 118], [138, 168, 170], [255, 0, 0], [39, 26, 43], [42, 43, 88], [0, 0, 0], [255, 255, 255], [29, 125, 64], [193, 153, 118], [171, 149, 119], [255, 255, 255], [255, 255, 255], [249, 248, 255], [157, 161, 174], [205, 81, 67], [255, 255, 255], [210, 65, 0], [49, 86, 176], [41, 10, 9], [0, 0, 0], [93, 31, 31], [112, 0, 37], [231, 153, 93], [156, 156, 166], [41, 50, 122], [206, 10, 12], [255, 255, 255], [255, 253, 228], [25, 15, 0], [45, 0, 194], [43, 71, 92], [223, 207, 189], [0, 0, 0], [79, 132, 202], [29, 31, 97], [147, 157, 118], [201, 75, 255], [72, 0, 0], [18, 0, 53], [77, 130, 195], [0, 0, 10], [0, 0, 55], [255, 255, 255], [128, 118, 106], [217, 202, 167], [25, 24, 21], [146, 150, 68], [255, 241, 243], [255, 255, 255], [181, 46, 52], [66, 18, 36], [0, 165, 55], [5, 17, 88], [63, 80, 130], [32, 38, 72], [254, 254, 254], [243, 237, 249], [255, 96, 53], [0, 0, 0], [153, 140, 118], [36, 24, 66], [206, 19, 67], [29, 20, 14], [132, 155, 222], [194, 175, 189], [189, 157, 137], [117, 63, 45], [215, 106, 77], [185, 181, 185], [255, 0, 210], [82, 41, 111], [80, 107, 110], [20, 24, 30], [130, 58, 51], [104, 94, 70], [255, 255, 255], [255, 237, 67], [118, 127, 60], [0, 0, 2], [255, 255, 255], [0, 0, 6], [254, 69, 255], [39, 53, 16], [1, 0, 3], [237, 181, 91], [117, 40, 32], [255, 255, 255], [168, 204, 181], [224, 232, 255], [255, 133, 0], [179, 70, 47], [44, 58, 39], [75, 91, 127], [17, 18, 13], [255, 255, 255], [3, 12, 48], [198, 90, 69], [122, 27, 112], [0, 0, 5], [156, 56, 56], [111, 0, 104], [14, 41, 131], [236, 234, 239], [255, 255, 255], [109, 42, 50], [240, 194, 119], [249, 244, 251], [184, 120, 56], [0, 0, 0], [253, 77, 64], [63, 30, 55], [43, 183, 240], [212, 186, 161], [161, 75, 67], [230, 244, 172], [31, 58, 121], [17, 68, 125], [214, 68, 29], [90, 28, 67], [254, 254, 254], [241, 227, 194], [97, 23, 166], [28, 31, 44], [157, 161, 172], [174, 163, 139], [0, 94, 0], [50, 28, 77], [27, 59, 64], [255, 255, 247], [68, 184, 79], [2, 1, 15], [55, 27, 68], [151, 201, 242], [255, 25, 255], [76, 126, 193], [35, 29, 67], [175, 175, 255], [47, 79, 88], [255, 255, 255], [82, 32, 22], [40, 54, 100], [144, 63, 61], [54, 73, 140], [249, 243, 247], [247, 244, 251], [0, 0, 0], [240, 210, 147], [59, 45, 98], [46, 69, 143], [188, 154, 65], [34, 41, 112], [12, 23, 142], [23, 31, 84], [209, 223, 249], [174, 202, 226], [255, 240, 195], [27, 27, 39], [156, 161, 175], [255, 236, 162], [160, 172, 225], [88, 61, 150], [238, 223, 192], [255, 255, 255], [255, 220, 253], [44, 46, 25], [137, 184, 255], [0, 0, 18], [255, 255, 255], [172, 104, 0], [255, 255, 255], [255, 0, 0], [101, 44, 47], [12, 11, 40], [255, 255, 255], [0, 133, 167], [35, 59, 54], [255, 255, 255], [148, 47, 49], [102, 38, 40], [255, 213, 179], [0, 30, 0], [29, 28, 86], [255, 128, 191], [195, 204, 255], [223, 196, 162], [225, 74, 47], [255, 255, 255], [209, 95, 70], [247, 206, 127], [255, 255, 255], [0, 0, 0], [255, 255, 255], [28, 59, 104], [1, 0, 14], [203, 121, 39], [255, 255, 255], [255, 155, 255], [255, 255, 255], [36, 29, 61], [123, 40, 51], [246, 240, 252], [255, 202, 24], [241, 181, 123], [25, 50, 107], [126, 156, 210], [142, 109, 78], [252, 250, 255], [19, 26, 115], [255, 255, 255], [101, 132, 45], [255, 255, 255], [48, 76, 158], [176, 136, 48], [74, 66, 100], [255, 255, 255], [79, 61, 99], [0, 0, 0], [0, 5, 16], [20, 21, 31], [32, 51, 255], [255, 12, 19], [26, 42, 138], [0, 113, 95], [255, 255, 255], [244, 230, 82], [255, 182, 252], [255, 255, 255], [237, 174, 102], [35, 61, 119], [165, 0, 0], [244, 242, 255], [214, 80, 63], [205, 188, 159], [255, 255, 255], [32, 33, 56], [0, 25, 87], [0, 0, 47], [255, 255, 255], [62, 22, 21], [25, 17, 45], [239, 171, 114], [79, 37, 51], [0, 0, 6], [29, 35, 72], [2, 24, 25], [255, 0, 0], [27, 0, 128], [16, 18, 27], [7, 0, 16], [244, 158, 73], [22, 46, 141], [163, 168, 185], [252, 234, 227], [130, 105, 99], [255, 0, 0], [36, 56, 140], [69, 99, 124], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [130, 42, 31], [1, 0, 213], [49, 52, 90], [250, 247, 248], [0, 0, 5], [0, 0, 0], [176, 180, 189], [0, 6, 16], [229, 200, 207], [255, 217, 162], [172, 155, 113], [196, 214, 238], [235, 219, 185], [248, 247, 255], [233, 175, 178], [205, 172, 125], [9, 24, 57], [93, 93, 105], [13, 73, 105], [9, 23, 95], [62, 28, 88], [255, 255, 255], [35, 112, 207], [237, 233, 218], [13, 55, 52], [22, 24, 63], [255, 255, 255], [206, 196, 124], [247, 205, 40], [255, 255, 255], [18, 20, 51], [3, 0, 0], [88, 136, 184], [0, 0, 0], [0, 0, 2], [255, 255, 255], [15, 56, 199], [14, 29, 60], [141, 99, 75], [156, 53, 63], [80, 38, 40], [255, 255, 255], [28, 32, 103], [255, 45, 45], [23, 2, 0], [36, 243, 255], [52, 255, 48], [163, 45, 45], [21, 29, 77], [105, 83, 35], [37, 50, 59], [255, 202, 24], [255, 255, 255], [218, 196, 152], [75, 107, 171], [255, 255, 255], [210, 46, 95], [97, 120, 72], [255, 255, 255], [190, 165, 9], [136, 166, 238], [5, 9, 20], [162, 166, 178], [255, 241, 95], [248, 120, 40], [255, 255, 255], [38, 56, 245], [194, 0, 0], [221, 190, 170], [213, 74, 107], [235, 15, 22], [30, 35, 76], [213, 214, 238], [0, 0, 148], [92, 34, 60], [155, 50, 40], [22, 26, 51], [40, 40, 88], [62, 140, 192], [255, 255, 255], [255, 255, 255], [243, 236, 195], [252, 252, 255], [61, 66, 122], [205, 83, 43], [170, 133, 114], [0, 211, 194], [255, 255, 255], [21, 43, 51], [188, 67, 70], [255, 255, 255], [248, 245, 240], [156, 89, 72], [95, 22, 28], [150, 158, 178], [240, 6, 8], [14, 21, 73], [84, 150, 232], [211, 179, 147], [84, 43, 114], [255, 30, 34], [234, 221, 174], [142, 134, 175], [255, 254, 250], [57, 98, 150], [146, 57, 44], [100, 40, 41], [157, 162, 174], [56, 45, 109], [227, 223, 240], [239, 229, 189], [255, 255, 255], [192, 168, 101], [18, 22, 31], [123, 211, 198], [244, 241, 255], [255, 255, 255], [255, 255, 255], [242, 218, 130], [255, 255, 255], [255, 202, 24], [255, 255, 255], [121, 115, 138], [77, 144, 192], [10, 21, 83], [205, 108, 67], [15, 18, 24], [234, 216, 177], [130, 8, 6], [21, 50, 123], [46, 122, 189], [150, 38, 35], [248, 249, 239], [255, 255, 255], [255, 255, 255], [63, 90, 255], [28, 29, 43], [29, 41, 120], [20, 30, 72], [75, 76, 0], [208, 195, 159], [255, 255, 255], [255, 255, 255], [130, 40, 38], [82, 114, 194], [248, 152, 40], [95, 109, 141], [248, 184, 24], [249, 124, 255], [6, 28, 88], [26, 109, 185], [187, 209, 255], [191, 64, 47], [253, 255, 255], [31, 80, 110], [72, 39, 61], [62, 47, 63], [255, 246, 247], [255, 255, 255], [0, 102, 151], [219, 28, 76], [101, 12, 12], [188, 189, 212], [38, 49, 58], [166, 173, 183], [90, 100, 74], [255, 255, 255], [27, 43, 93], [12, 23, 94], [204, 177, 150], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [1, 0, 7], [255, 255, 255], [10, 128, 116], [255, 255, 255], [255, 255, 255], [18, 31, 83], [30, 30, 97], [157, 161, 193], [63, 98, 118], [164, 68, 64], [228, 105, 68], [242, 240, 255], [139, 36, 32], [242, 193, 255], [255, 255, 255], [0, 0, 0], [145, 116, 118], [255, 255, 255], [35, 65, 131], [127, 38, 38], [231, 183, 149], [190, 122, 78], [144, 172, 115], [194, 38, 58], [255, 255, 255], [253, 254, 188], [116, 136, 227], [25, 28, 32], [150, 47, 48], [0, 0, 0], [228, 239, 245], [20, 66, 107], [47, 98, 164], [42, 76, 133], [180, 57, 119], [203, 210, 176], [255, 255, 255], [1, 0, 5], [112, 126, 73], [23, 27, 55], [255, 255, 255], [162, 53, 54], [205, 182, 160], [71, 46, 108], [250, 188, 9], [255, 255, 255], [255, 255, 255], [255, 255, 255], [126, 49, 75], [41, 51, 149], [124, 159, 226], [255, 255, 255], [167, 177, 199], [23, 29, 116], [255, 255, 255], [57, 77, 146], [255, 48, 49], [52, 16, 17], [225, 213, 186], [255, 255, 255], [117, 39, 244], [201, 0, 49], [39, 124, 218], [47, 59, 86], [248, 168, 24], [189, 110, 49], [6, 31, 98], [1, 15, 76], [38, 48, 96], [2, 8, 40], [130, 53, 60], [17, 61, 27], [217, 113, 69], [160, 163, 181], [250, 216, 171], [88, 27, 31], [217, 193, 167], [22, 33, 36], [36, 38, 78], [109, 51, 66], [255, 255, 255], [255, 255, 255], [141, 125, 185], [255, 215, 243], [237, 241, 235], [179, 141, 170], [254, 254, 254], [161, 58, 66], [47, 20, 101], [0, 2, 7], [206, 212, 228], [26, 25, 30], [149, 185, 212], [182, 145, 93], [19, 27, 63], [255, 255, 255], [251, 250, 255], [246, 247, 202], [255, 255, 255], [60, 43, 93], [0, 8, 25], [219, 68, 113], [232, 189, 83], [31, 33, 64], [191, 210, 243], [210, 174, 204], [255, 255, 255], [23, 25, 255], [3, 13, 24], [255, 242, 211], [159, 165, 174], [255, 26, 34], [0, 0, 0], [228, 150, 97], [3, 0, 0], [221, 82, 59], [43, 51, 97], [244, 222, 192], [98, 40, 39], [217, 68, 60], [255, 255, 255], [0, 148, 44], [255, 255, 255], [0, 132, 204], [0, 127, 255], [255, 255, 255], [67, 94, 163], [255, 255, 255], [160, 59, 17], [63, 100, 80], [227, 87, 69], [130, 192, 228], [160, 51, 51], [145, 119, 98], [44, 80, 177], [242, 243, 248], [255, 255, 255], [245, 252, 255], [255, 255, 255], [126, 173, 218], [241, 237, 238], [255, 255, 255], [255, 255, 255], [163, 158, 30], [202, 103, 42], [255, 255, 255], [210, 223, 192], [1, 1, 7], [43, 50, 140], [255, 101, 1], [255, 255, 255], [250, 245, 251], [255, 255, 255], [32, 33, 102], [255, 216, 144], [246, 242, 250], [131, 118, 176], [221, 214, 29], [255, 255, 255], [0, 0, 0], [213, 171, 131], [11, 13, 26], [233, 225, 173], [129, 121, 162], [136, 8, 56], [0, 97, 255], [11, 11, 23], [253, 241, 24], [159, 175, 169], [255, 255, 255], [28, 38, 100], [159, 51, 42], [60, 115, 181], [70, 129, 180], [6, 27, 61], [14, 18, 76], [239, 179, 97], [163, 66, 43], [248, 233, 180], [0, 242, 241], [255, 255, 255], [230, 214, 178], [24, 93, 70], [255, 255, 255], [2, 0, 7], [43, 52, 115], [240, 191, 103], [255, 255, 255], [135, 0, 49], [0, 0, 0], [28, 22, 88], [255, 255, 255], [14, 14, 22], [9, 8, 0], [143, 48, 48], [225, 0, 57], [32, 122, 167], [255, 255, 255], [198, 181, 173], [44, 74, 160], [219, 191, 51], [255, 234, 255], [22, 25, 60], [83, 78, 145], [255, 241, 202], [110, 136, 125], [255, 255, 255], [138, 39, 37], [195, 121, 122], [172, 138, 132], [255, 255, 255], [72, 56, 152], [35, 88, 164], [15, 19, 27], [120, 40, 72], [255, 255, 24], [171, 59, 44], [29, 28, 35], [59, 56, 49], [17, 68, 80], [198, 158, 76], [0, 0, 5], [208, 213, 180], [24, 24, 34], [206, 191, 179], [140, 191, 243], [240, 101, 101], [189, 175, 138], [3, 74, 115], [0, 0, 6], [143, 47, 48], [148, 97, 23], [221, 186, 148], [255, 255, 255], [194, 80, 131], [78, 120, 62], [24, 24, 40], [0, 8, 40], [34, 48, 85], [247, 247, 247], [132, 77, 93], [255, 255, 255], [0, 149, 87], [74, 141, 66], [255, 78, 58], [254, 242, 97], [2, 103, 85], [163, 186, 228], [255, 255, 255], [0, 0, 2], [119, 57, 38], [255, 36, 255], [232, 196, 71], [33, 35, 40], [68, 28, 26], [200, 213, 220], [255, 255, 255], [255, 255, 255], [193, 193, 108], [255, 0, 0], [149, 54, 49], [245, 243, 255], [30, 43, 85], [151, 114, 78], [255, 255, 255], [34, 73, 32], [244, 158, 73], [116, 71, 47], [51, 70, 146], [255, 255, 255], [37, 63, 86], [234, 86, 42], [96, 159, 202], [22, 27, 126], [254, 137, 60], [30, 212, 226], [255, 255, 255], [255, 255, 255], [0, 5, 25], [0, 45, 255], [179, 202, 225], [1, 1, 0], [47, 29, 55], [255, 255, 255], [9, 21, 41], [255, 255, 255], [255, 101, 79], [237, 195, 141], [250, 221, 154], [248, 118, 193], [1, 0, 5], [255, 252, 253], [25, 63, 90], [243, 212, 179], [43, 57, 126], [23, 19, 61], [54, 68, 142], [26, 127, 52], [17, 15, 29], [224, 111, 69], [25, 21, 18], [252, 243, 109], [1, 21, 56], [183, 198, 176], [172, 199, 220], [136, 123, 107], [241, 205, 140], [33, 30, 92], [120, 109, 165], [101, 145, 63], [183, 136, 136], [255, 49, 47], [95, 33, 49], [255, 255, 255], [199, 146, 64], [0, 175, 214], [197, 192, 192], [254, 247, 157], [230, 19, 96], [164, 161, 116], [255, 255, 255], [46, 48, 88], [74, 25, 44], [124, 72, 68], [238, 42, 103], [0, 0, 0], [206, 154, 107], [22, 27, 24], [181, 72, 77], [255, 255, 255], [183, 125, 137], [149, 50, 44], [1, 1, 0], [255, 255, 255], [0, 0, 0], [255, 123, 172], [0, 0, 255], [255, 255, 255], [28, 21, 109], [32, 45, 78], [255, 255, 255], [253, 249, 237], [121, 160, 166], [209, 86, 125], [16, 16, 28], [255, 255, 255], [219, 0, 64], [251, 248, 231], [213, 166, 83], [178, 194, 218], [123, 25, 39], [243, 234, 150], [52, 40, 27], [245, 215, 173], [0, 0, 6], [255, 252, 195], [117, 18, 9], [161, 163, 133], [28, 25, 103], [172, 187, 220], [0, 0, 6], [228, 190, 0], [132, 127, 95], [255, 255, 255], [187, 1, 38], [8, 26, 95], [37, 34, 106], [255, 255, 255], [141, 161, 35], [141, 63, 64], [252, 188, 10], [255, 255, 255], [34, 61, 171], [12, 46, 26], [255, 62, 44], [255, 255, 255], [236, 27, 211], [255, 255, 255], [29, 0, 187], [43, 0, 129], [0, 9, 76], [190, 72, 45], [146, 52, 52], [73, 46, 116], [255, 255, 255], [255, 28, 30], [7, 4, 11], [210, 36, 49], [0, 0, 0], [255, 255, 255], [28, 36, 23], [2, 0, 3], [161, 91, 55], [169, 75, 75], [21, 21, 33], [251, 249, 253], [0, 0, 0], [168, 69, 0], [255, 31, 28], [0, 50, 206], [45, 157, 108], [255, 255, 255], [255, 255, 255], [152, 43, 46], [48, 27, 183], [143, 183, 205], [54, 50, 98], [184, 181, 185], [255, 255, 255], [239, 236, 234], [251, 242, 205], [22, 19, 20], [246, 235, 219], [28, 60, 80], [255, 255, 255], [248, 184, 24], [62, 79, 112], [20, 23, 37], [171, 149, 98], [138, 44, 44], [40, 100, 63], [148, 34, 70], [255, 255, 255], [154, 168, 197], [255, 255, 255], [255, 40, 252], [243, 210, 152], [30, 24, 103], [47, 74, 98], [105, 53, 45], [24, 33, 88], [229, 23, 26], [24, 37, 54], [19, 22, 31], [161, 165, 177], [44, 115, 168], [158, 59, 59], [11, 10, 16], [176, 183, 193], [2, 0, 11], [189, 232, 211], [95, 47, 94], [29, 47, 130], [0, 0, 254], [14, 17, 27], [236, 217, 184], [255, 255, 255], [14, 110, 149], [31, 87, 146], [160, 40, 50], [253, 245, 208], [255, 204, 25], [171, 98, 75], [139, 40, 42], [14, 16, 255], [15, 32, 76], [255, 255, 255], [231, 203, 163], [255, 255, 255], [240, 183, 196], [243, 136, 63], [255, 255, 255], [178, 69, 40], [153, 76, 60], [255, 255, 255], [244, 158, 73], [118, 29, 11], [16, 47, 68], [132, 173, 232], [7, 27, 34], [50, 73, 38], [146, 56, 61], [248, 168, 24], [247, 210, 170], [255, 245, 104], [255, 255, 255], [255, 255, 255], [223, 197, 156], [33, 83, 131], [30, 31, 0], [0, 0, 0], [220, 200, 189], [255, 255, 255], [244, 158, 73], [148, 43, 40], [248, 248, 200], [255, 255, 255], [255, 255, 255], [39, 63, 148], [98, 155, 215], [255, 82, 63], [36, 75, 155], [27, 35, 104], [255, 255, 255], [255, 255, 255], [76, 141, 234], [250, 247, 248], [195, 148, 101], [255, 255, 255], [230, 150, 93], [24, 16, 23], [25, 15, 20], [117, 132, 192], [242, 201, 146], [157, 179, 229], [240, 204, 169], [255, 255, 255], [0, 0, 2], [0, 146, 110], [104, 52, 66], [255, 255, 255], [0, 0, 0], [0, 0, 0], [136, 8, 88], [0, 118, 130], [32, 42, 90], [255, 255, 255], [158, 52, 49], [0, 0, 240], [74, 125, 191], [255, 255, 255], [30, 30, 42], [255, 255, 255], [178, 0, 13], [64, 103, 182], [84, 32, 45], [229, 194, 187], [217, 35, 47], [12, 0, 0], [150, 39, 57], [109, 77, 53], [255, 254, 255], [198, 122, 0], [0, 27, 50], [193, 60, 54], [17, 115, 135], [153, 146, 177], [255, 254, 254], [100, 56, 61], [255, 255, 255], [0, 0, 0], [106, 49, 191], [23, 43, 255], [193, 17, 33], [162, 133, 127], [35, 35, 45], [242, 229, 185], [255, 28, 25], [126, 55, 9], [237, 173, 88], [255, 255, 255], [29, 56, 117], [54, 97, 113], [0, 0, 0], [255, 255, 255], [255, 255, 255], [236, 165, 125], [233, 107, 56], [255, 255, 255], [227, 223, 238], [0, 15, 47], [100, 126, 126], [13, 12, 10], [63, 52, 19], [247, 245, 246], [255, 255, 255], [44, 83, 143], [3, 4, 16], [236, 229, 200], [255, 255, 255], [255, 255, 255], [94, 56, 39], [33, 36, 76], [237, 232, 229], [201, 175, 141], [125, 52, 59], [255, 255, 255], [0, 0, 0], [2, 0, 0], [215, 238, 244], [254, 255, 255], [43, 57, 91], [19, 30, 116], [11, 43, 106], [255, 255, 255], [0, 0, 2], [0, 37, 131], [243, 158, 54], [249, 246, 252], [132, 71, 72], [6, 6, 17], [0, 0, 5], [255, 202, 24], [242, 202, 146], [168, 177, 208], [24, 37, 81], [21, 234, 230], [255, 24, 40], [196, 68, 59], [37, 89, 82], [30, 37, 65], [255, 255, 255], [255, 255, 195], [55, 58, 49], [109, 44, 42], [117, 131, 150], [255, 144, 72], [147, 152, 165], [255, 255, 255], [239, 191, 0], [215, 211, 245], [215, 200, 164], [49, 35, 147], [47, 125, 129], [109, 30, 56], [8, 12, 24], [255, 255, 255], [145, 64, 127], [255, 11, 60], [0, 0, 6], [0, 0, 22], [206, 179, 163], [109, 34, 40], [30, 43, 95], [255, 255, 255], [255, 118, 202], [29, 54, 98], [225, 23, 52], [255, 255, 255], [255, 255, 255], [255, 255, 255], [127, 41, 39], [0, 0, 255], [255, 255, 255], [108, 55, 65], [73, 126, 142], [255, 240, 23], [213, 0, 56], [230, 228, 235], [58, 54, 75], [51, 76, 122], [0, 0, 0], [0, 0, 0], [255, 255, 255], [40, 34, 78], [255, 233, 194], [255, 255, 255], [0, 0, 0], [59, 34, 36], [28, 30, 45], [255, 255, 255], [165, 116, 115], [236, 191, 156], [246, 106, 86], [255, 160, 60], [190, 136, 48], [0, 0, 10], [240, 130, 255], [35, 91, 127], [148, 47, 40], [233, 213, 58], [155, 63, 184], [0, 0, 10], [13, 55, 70], [239, 195, 149], [128, 49, 56], [94, 18, 29], [15, 18, 63], [255, 255, 255], [61, 148, 150], [28, 139, 214], [255, 255, 255], [36, 27, 88], [132, 99, 94], [0, 157, 255], [195, 221, 243], [175, 168, 118], [49, 255, 53], [255, 255, 255], [147, 172, 216], [234, 232, 245], [255, 255, 255], [0, 193, 200], [255, 255, 255], [255, 255, 255], [252, 251, 255], [250, 239, 246], [65, 154, 178], [250, 248, 253], [21, 24, 29], [50, 62, 124], [255, 255, 255], [0, 0, 0], [1, 0, 0], [15, 15, 18], [166, 0, 0], [255, 255, 255], [28, 0, 0], [41, 13, 123], [255, 255, 255], [226, 131, 83], [141, 54, 54], [255, 255, 255], [196, 91, 77], [0, 0, 0], [153, 70, 59], [232, 209, 157], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [36, 36, 71], [0, 0, 12], [11, 45, 93], [24, 28, 63], [222, 194, 182], [0, 0, 167], [201, 163, 84], [37, 33, 61], [0, 0, 79], [9, 28, 255], [255, 255, 255], [160, 59, 17], [0, 26, 53], [0, 0, 188], [255, 255, 255], [255, 255, 255], [255, 255, 255], [190, 0, 2], [77, 111, 118], [255, 202, 24], [29, 21, 61], [0, 20, 49], [244, 158, 73], [151, 71, 64], [135, 114, 69], [255, 255, 255], [25, 41, 88], [198, 134, 86], [217, 194, 159], [255, 255, 255], [0, 0, 0], [233, 105, 91], [208, 68, 77], [0, 0, 0], [59, 138, 84], [116, 98, 140], [0, 254, 254], [255, 255, 255], [247, 226, 182], [238, 186, 87], [24, 36, 151], [242, 228, 187], [54, 84, 121], [255, 255, 255], [255, 255, 255], [155, 49, 53], [13, 48, 29], [243, 158, 73], [99, 44, 84], [25, 49, 162], [85, 51, 101], [240, 220, 192], [186, 116, 123], [145, 42, 35], [255, 255, 255], [4, 46, 52], [19, 22, 35], [13, 48, 135], [191, 67, 51], [194, 163, 138], [0, 0, 2], [26, 53, 109], [132, 39, 33], [255, 255, 255], [0, 0, 0], [28, 51, 92], [0, 119, 60], [255, 255, 255], [77, 128, 188], [205, 194, 174], [0, 0, 0], [253, 239, 201], [229, 169, 102], [255, 255, 255], [255, 255, 255], [44, 111, 104], [163, 55, 59], [131, 65, 38], [92, 38, 14], [230, 23, 80], [191, 113, 140], [212, 239, 214], [205, 185, 189], [9, 11, 16], [241, 224, 102], [255, 255, 255], [212, 228, 255], [182, 47, 42], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 204, 25], [252, 250, 207], [244, 232, 0], [0, 0, 0], [255, 255, 255], [42, 49, 82], [140, 143, 156], [162, 61, 43], [196, 153, 110], [46, 58, 103], [35, 42, 122], [26, 101, 183], [19, 61, 49], [184, 0, 0], [187, 179, 166], [255, 40, 51], [68, 130, 83], [255, 255, 255], [36, 23, 31], [255, 255, 255], [230, 83, 64], [46, 51, 125], [111, 38, 30], [208, 0, 2], [214, 206, 192], [126, 157, 140], [0, 0, 0], [255, 255, 255], [115, 130, 182], [166, 98, 33], [248, 244, 243], [130, 104, 99], [18, 34, 121], [249, 241, 219], [17, 34, 28], [244, 158, 73], [255, 255, 255], [43, 33, 70], [29, 91, 61], [1, 0, 6], [21, 72, 113], [255, 255, 0], [16, 84, 38], [0, 0, 0], [255, 255, 255], [159, 57, 60], [255, 255, 255], [0, 0, 222], [242, 243, 245], [218, 140, 68], [22, 28, 50], [0, 0, 0], [190, 174, 110], [130, 155, 219], [242, 214, 181], [255, 255, 255], [1, 1, 13], [51, 27, 35], [0, 0, 34], [146, 52, 53], [1, 0, 41], [28, 72, 185], [163, 56, 43], [13, 28, 38], [107, 48, 48], [33, 62, 110], [25, 209, 216], [2, 0, 13], [31, 59, 130], [158, 40, 36], [1, 0, 5], [161, 50, 47], [144, 207, 60], [179, 57, 39], [246, 229, 73], [22, 33, 66], [253, 255, 254], [255, 255, 255], [253, 253, 255], [250, 28, 0], [8, 0, 0], [245, 221, 191], [255, 255, 255], [13, 12, 22], [112, 117, 58], [255, 255, 245], [144, 127, 108], [209, 209, 145], [250, 133, 108], [30, 16, 58], [255, 255, 255], [11, 5, 5], [244, 242, 255], [255, 255, 255], [2, 27, 243], [248, 248, 200], [238, 197, 142], [0, 7, 53], [196, 17, 49], [255, 255, 255], [0, 177, 149], [223, 0, 95], [255, 255, 255], [255, 255, 255], [174, 114, 54], [77, 87, 117], [0, 53, 0], [164, 165, 182], [162, 142, 91], [255, 245, 235], [255, 255, 255], [0, 0, 6], [255, 239, 255], [177, 205, 237], [255, 255, 255], [5, 52, 40], [38, 35, 56], [212, 0, 0], [255, 255, 255], [71, 66, 32], [145, 161, 173], [255, 255, 255], [0, 15, 58], [25, 91, 0], [122, 134, 0], [236, 111, 89], [255, 247, 95], [247, 247, 249], [223, 84, 35], [126, 175, 201], [255, 255, 255], [186, 173, 193], [40, 54, 119], [255, 255, 255], [0, 0, 0], [248, 248, 255], [157, 101, 33], [135, 18, 17], [255, 255, 255], [33, 46, 118], [199, 63, 52], [253, 224, 5], [0, 0, 0], [255, 255, 255], [255, 255, 255], [254, 254, 254], [33, 29, 52], [35, 35, 46], [255, 186, 150], [113, 58, 47], [7, 18, 24], [255, 255, 255], [6, 39, 114], [0, 91, 179], [28, 28, 41], [173, 157, 115], [39, 54, 255], [204, 198, 232], [255, 255, 255], [223, 184, 143], [16, 57, 49], [255, 227, 187], [195, 134, 209], [245, 248, 255], [255, 255, 255], [196, 75, 60], [0, 7, 15], [3, 22, 255], [184, 183, 223], [255, 255, 255], [4, 17, 61], [36, 37, 73], [0, 0, 71], [0, 0, 2], [215, 219, 193], [47, 76, 146], [8, 11, 25], [255, 255, 255], [170, 65, 46], [255, 255, 255], [26, 27, 47], [31, 37, 88], [134, 164, 224], [34, 87, 106], [245, 208, 113], [220, 93, 87], [184, 63, 62], [255, 255, 255], [164, 184, 100], [22, 69, 121], [6, 41, 81], [181, 185, 196], [255, 255, 255], [150, 45, 42], [19, 30, 68], [255, 255, 255], [35, 55, 138], [61, 69, 136], [15, 63, 31], [255, 217, 119], [255, 255, 255], [38, 127, 25], [255, 255, 255], [198, 177, 154], [238, 233, 194], [215, 179, 143], [1, 0, 6], [33, 116, 161], [0, 13, 60], [249, 245, 246], [189, 62, 54], [168, 172, 186], [66, 124, 80], [231, 119, 73], [160, 186, 178], [51, 255, 50], [246, 244, 255], [233, 163, 0], [193, 180, 150], [255, 0, 0], [255, 255, 255], [112, 161, 147], [78, 142, 177], [255, 255, 255], [34, 38, 69], [32, 27, 59], [152, 104, 56], [17, 15, 74], [208, 72, 119], [12, 0, 6], [201, 103, 194], [82, 41, 61], [55, 72, 148], [241, 224, 156], [241, 237, 249], [0, 0, 103], [243, 241, 241], [208, 225, 246], [109, 153, 227], [255, 70, 112], [42, 38, 30], [39, 30, 62], [165, 185, 39], [45, 72, 90], [192, 109, 43], [148, 47, 49], [195, 176, 140], [217, 183, 112], [0, 0, 0], [22, 64, 91], [38, 37, 85], [190, 0, 2], [155, 158, 170], [0, 0, 13], [193, 208, 207], [30, 40, 73], [1, 1, 11], [9, 3, 13], [32, 47, 88], [68, 40, 144], [244, 158, 73], [137, 131, 0], [16, 15, 26], [255, 255, 255], [202, 160, 105], [255, 255, 255], [78, 85, 106], [173, 201, 211], [37, 45, 117], [29, 0, 0], [255, 255, 255], [75, 74, 53], [0, 0, 6], [124, 130, 188], [57, 88, 255], [244, 158, 73], [244, 210, 51], [255, 255, 255], [29, 45, 98], [0, 6, 42], [255, 255, 255], [255, 255, 255], [170, 111, 80], [73, 38, 62], [0, 0, 0], [255, 255, 255], [255, 247, 249], [1, 0, 13], [255, 255, 255], [163, 149, 113], [169, 130, 149], [255, 253, 130], [224, 124, 92], [48, 60, 96], [216, 223, 233], [35, 31, 138], [26, 52, 95], [33, 34, 43], [248, 242, 246], [40, 58, 133], [202, 165, 119], [73, 82, 180], [225, 179, 182], [29, 86, 114], [0, 0, 10], [245, 0, 0], [155, 165, 184], [255, 255, 255], [238, 235, 108], [101, 84, 162], [255, 202, 24], [236, 200, 169], [255, 255, 255], [255, 255, 255], [213, 105, 30], [95, 46, 68], [255, 202, 24], [255, 255, 255], [27, 35, 37], [22, 25, 34], [0, 43, 87], [18, 48, 50], [0, 0, 0], [34, 33, 64], [255, 25, 36], [0, 0, 0], [110, 78, 61], [0, 0, 23], [1, 1, 1], [0, 4, 0], [5, 23, 23], [157, 58, 53], [190, 132, 40], [154, 87, 77], [255, 255, 255], [174, 155, 185], [0, 0, 0], [136, 8, 56], [255, 236, 204], [25, 26, 56], [160, 54, 55], [54, 79, 156], [211, 179, 62], [255, 255, 253], [235, 205, 135], [225, 0, 0], [208, 178, 144], [203, 29, 24], [182, 102, 155], [38, 91, 60], [18, 100, 255], [18, 34, 255], [240, 181, 17], [166, 71, 52], [249, 241, 238], [246, 209, 154], [11, 22, 101], [248, 177, 61], [8, 12, 20], [255, 255, 255], [5, 24, 108], [255, 213, 212], [114, 37, 45], [123, 76, 82], [38, 26, 33], [206, 200, 24], [144, 53, 50], [82, 147, 255], [255, 26, 112], [255, 255, 255], [193, 166, 81], [158, 214, 239], [223, 157, 111], [1, 0, 140], [255, 247, 219], [8, 10, 22], [23, 34, 88], [32, 31, 89], [255, 255, 255], [116, 129, 173], [0, 0, 0], [71, 140, 197], [255, 234, 67], [215, 94, 67], [68, 87, 167], [255, 255, 255], [82, 43, 255], [237, 241, 247], [255, 255, 255], [163, 170, 181], [0, 1, 15], [239, 239, 239], [255, 255, 255], [254, 243, 163], [41, 39, 255], [106, 130, 173], [255, 255, 255], [50, 53, 171], [95, 39, 56], [222, 82, 63], [0, 0, 6], [42, 19, 11], [255, 255, 255], [0, 0, 11], [255, 156, 23], [255, 255, 255], [96, 89, 123], [255, 255, 255], [145, 152, 188], [53, 53, 126], [234, 96, 58], [213, 68, 41], [27, 79, 69], [181, 20, 43], [255, 230, 123], [242, 236, 219], [7, 5, 7], [44, 83, 143], [177, 151, 118], [239, 80, 60], [251, 133, 120], [43, 99, 88], [46, 91, 36], [38, 39, 76], [31, 47, 98], [0, 0, 0], [0, 0, 0], [101, 145, 217], [203, 176, 151], [237, 200, 0], [166, 170, 206], [44, 58, 112], [97, 142, 68], [227, 0, 25], [0, 19, 30], [125, 1, 61], [255, 255, 255], [0, 0, 0], [255, 49, 49], [186, 151, 120], [24, 40, 109], [255, 255, 255], [255, 255, 255], [0, 0, 65], [132, 100, 169], [168, 164, 159], [38, 60, 141], [187, 98, 51], [199, 212, 208], [255, 76, 54], [101, 101, 92], [98, 144, 75], [255, 255, 255], [56, 32, 55], [110, 123, 142], [235, 219, 193], [255, 255, 255], [132, 138, 172], [255, 219, 169], [21, 41, 163], [251, 245, 213], [255, 255, 255], [255, 255, 255], [242, 214, 174], [145, 166, 218], [255, 255, 255], [58, 97, 105], [123, 45, 34], [241, 252, 246], [93, 30, 25], [33, 37, 48], [44, 88, 133], [255, 255, 255], [254, 252, 255], [19, 120, 47], [255, 255, 255], [5, 3, 9], [255, 255, 255], [49, 49, 96], [255, 255, 255], [255, 255, 255], [255, 255, 255], [212, 180, 155], [255, 255, 255], [255, 255, 255], [195, 74, 68], [12, 42, 106], [24, 44, 139], [176, 0, 21], [239, 231, 231], [161, 164, 177], [50, 69, 145], [25, 32, 81], [0, 0, 6], [255, 255, 255], [255, 255, 255], [212, 155, 100], [146, 152, 164], [121, 25, 28], [92, 39, 51], [41, 34, 113], [26, 113, 188], [1, 143, 207], [5, 72, 99], [149, 40, 40], [188, 127, 72], [183, 139, 112], [230, 221, 175], [99, 49, 62], [124, 130, 0], [255, 247, 255], [9, 62, 83], [255, 255, 255], [240, 239, 241], [42, 86, 161], [1, 47, 64], [255, 118, 108], [60, 50, 49], [0, 0, 5], [151, 150, 38], [12, 0, 8], [23, 102, 44], [135, 98, 67], [17, 18, 61], [0, 0, 0], [11, 9, 13], [255, 255, 255], [224, 211, 217], [255, 255, 255], [201, 161, 100], [170, 65, 72], [255, 255, 255], [39, 60, 75], [255, 58, 3], [0, 12, 45], [163, 182, 74], [179, 192, 140], [8, 56, 104], [165, 137, 150], [142, 187, 220], [242, 202, 107], [133, 183, 223], [255, 255, 255], [130, 0, 216], [43, 14, 55], [45, 61, 98], [245, 29, 235], [255, 255, 255], [32, 66, 91], [0, 0, 0], [255, 204, 25], [255, 255, 76], [25, 7, 26], [0, 0, 10], [26, 20, 35], [219, 196, 44], [220, 210, 192], [195, 180, 138], [4, 27, 96], [255, 253, 251], [255, 255, 255], [6, 9, 22], [235, 157, 66], [255, 255, 255], [249, 217, 173], [149, 184, 182], [145, 125, 78], [255, 255, 255], [1, 0, 6], [255, 255, 255], [55, 157, 143], [143, 45, 29], [255, 255, 255], [255, 255, 255], [12, 15, 24], [252, 252, 252], [239, 247, 252], [48, 65, 139], [200, 206, 234], [0, 56, 73], [149, 48, 31], [0, 71, 83], [8, 74, 123], [27, 37, 73], [27, 25, 64], [0, 0, 13], [241, 213, 80], [132, 44, 60], [255, 255, 255], [255, 255, 255], [36, 48, 104], [36, 32, 101], [255, 255, 255], [0, 0, 0], [194, 200, 221], [255, 255, 255], [214, 183, 33], [215, 212, 199], [250, 244, 250], [136, 173, 105], [0, 255, 255], [93, 41, 47], [0, 0, 0], [123, 67, 53], [28, 84, 48], [234, 177, 46], [203, 66, 58], [41, 74, 67], [238, 237, 242], [0, 0, 243], [56, 74, 92], [255, 0, 0], [11, 13, 22], [118, 40, 51], [55, 57, 50], [71, 99, 111], [29, 63, 130], [181, 49, 42], [3, 21, 35], [248, 245, 255], [173, 177, 187], [215, 50, 66], [0, 0, 215], [222, 120, 62], [144, 42, 28], [97, 123, 52], [165, 180, 234], [0, 0, 0], [1, 0, 5], [235, 51, 101], [255, 255, 255], [254, 254, 254], [255, 255, 215], [147, 119, 73], [240, 228, 180], [209, 198, 159], [150, 117, 95], [240, 190, 100], [144, 66, 62], [214, 26, 31], [55, 46, 112], [34, 46, 104], [117, 103, 69], [0, 0, 0], [232, 199, 235], [70, 124, 195], [0, 4, 22], [15, 0, 0], [0, 0, 0], [37, 99, 255], [2, 0, 6], [244, 158, 73], [158, 146, 173], [181, 0, 0], [244, 0, 11], [165, 46, 48], [48, 61, 162], [255, 255, 255], [19, 28, 134], [0, 0, 255], [243, 244, 213], [18, 12, 11], [255, 255, 255], [255, 255, 255], [78, 56, 42], [118, 171, 198], [255, 235, 228], [1, 3, 15], [255, 255, 255], [0, 0, 0], [255, 255, 255], [136, 8, 88], [137, 109, 39], [255, 255, 255], [255, 74, 53], [48, 69, 146], [135, 140, 154], [247, 246, 247], [255, 255, 255], [109, 42, 56], [107, 124, 155], [226, 210, 177], [220, 195, 159], [0, 0, 0], [38, 37, 113], [43, 62, 103], [112, 48, 41], [112, 28, 93], [0, 0, 15], [48, 54, 92], [0, 0, 86], [53, 255, 255], [101, 24, 32], [1, 1, 1], [150, 255, 100], [255, 255, 255], [250, 246, 249], [12, 14, 20], [22, 26, 35], [255, 255, 255], [152, 59, 72], [30, 54, 165], [255, 252, 255], [170, 147, 104], [255, 255, 255], [39, 30, 82], [200, 181, 130], [123, 42, 56], [255, 208, 196], [204, 29, 76], [25, 45, 85], [25, 36, 255], [38, 32, 43], [255, 246, 0], [234, 108, 60], [16, 18, 26], [0, 0, 82], [255, 255, 255], [213, 190, 157], [255, 255, 255], [255, 255, 255], [136, 168, 136], [74, 21, 38], [29, 24, 65], [251, 247, 175], [147, 123, 78], [255, 255, 255], [241, 17, 0], [54, 58, 122], [14, 66, 105], [130, 98, 76], [8, 22, 103], [231, 189, 102], [14, 17, 28], [18, 36, 87], [255, 255, 255], [255, 255, 255], [0, 86, 185], [255, 255, 255], [57, 79, 115], [8, 29, 93], [24, 72, 152], [255, 255, 255], [26, 36, 116], [121, 141, 200], [94, 115, 43], [205, 65, 77], [167, 32, 122], [10, 30, 99], [196, 105, 90], [126, 146, 179], [243, 229, 184], [74, 35, 40], [18, 48, 45], [7, 48, 39], [255, 106, 0], [233, 127, 80], [28, 43, 99], [218, 96, 79], [250, 247, 255], [138, 162, 208], [233, 203, 194], [9, 31, 92], [134, 109, 66], [203, 87, 68], [21, 30, 68], [222, 1, 74], [53, 115, 107], [255, 255, 255], [114, 125, 120], [26, 21, 27], [244, 158, 73], [193, 146, 98], [207, 153, 193], [150, 195, 139], [218, 80, 38], [0, 0, 0], [248, 245, 247], [232, 92, 32], [255, 255, 255], [21, 19, 14], [94, 27, 31], [255, 255, 255], [59, 51, 91], [255, 255, 255], [30, 41, 103], [236, 194, 168], [255, 255, 255], [147, 157, 167], [16, 25, 93], [40, 88, 135], [27, 45, 77], [2, 49, 103], [255, 255, 255], [157, 187, 212], [50, 44, 118], [255, 255, 255], [155, 164, 77], [255, 255, 255], [4, 25, 106], [10, 0, 0], [60, 74, 148], [255, 255, 255], [48, 85, 167], [202, 212, 237], [11, 22, 15], [11, 74, 127], [29, 64, 84], [255, 255, 255], [9, 30, 59], [255, 255, 255], [234, 97, 78], [255, 255, 255], [0, 0, 5], [249, 226, 164], [0, 0, 34], [255, 255, 0], [81, 122, 32], [214, 189, 166], [24, 29, 80], [19, 60, 140], [245, 116, 51], [141, 113, 65], [255, 17, 12], [169, 122, 83], [255, 255, 255], [1, 0, 5], [18, 20, 47], [207, 19, 52], [194, 166, 147], [0, 0, 0], [240, 226, 135], [111, 145, 189], [41, 151, 211], [29, 42, 102], [0, 0, 0], [34, 48, 95], [0, 0, 6], [235, 203, 100], [88, 24, 24], [228, 118, 124], [12, 33, 116], [29, 31, 116], [255, 255, 255], [36, 75, 187], [255, 255, 255], [36, 92, 255], [255, 247, 211], [144, 182, 169], [95, 168, 79], [49, 49, 79], [255, 255, 255], [255, 242, 225], [16, 26, 98], [10, 63, 68], [0, 1, 57], [109, 127, 151], [61, 92, 156], [18, 21, 192], [255, 255, 255], [255, 255, 255], [255, 255, 37], [144, 177, 154], [255, 255, 255], [48, 46, 40], [215, 194, 152], [255, 202, 24], [255, 255, 255], [9, 9, 14], [241, 237, 200], [255, 255, 255], [238, 201, 0], [8, 104, 168], [52, 107, 196], [240, 199, 144], [238, 160, 110], [30, 28, 0], [1, 0, 5], [27, 8, 27], [14, 14, 23], [123, 140, 218], [238, 49, 97], [204, 147, 129], [46, 61, 97], [235, 230, 174], [3, 23, 55], [12, 27, 48], [230, 209, 167], [245, 163, 87], [243, 158, 73], [224, 208, 184], [149, 201, 238], [12, 30, 107], [1, 2, 14], [255, 255, 255], [212, 40, 65], [255, 255, 255], [189, 25, 31], [210, 173, 39], [153, 49, 52], [1, 0, 255], [255, 202, 24], [12, 48, 71], [202, 80, 70], [210, 202, 183], [30, 27, 21], [255, 255, 255], [87, 99, 135], [57, 70, 127], [192, 47, 66], [93, 151, 58], [130, 157, 198], [34, 71, 146], [249, 246, 255], [255, 253, 249], [186, 84, 49], [76, 26, 36], [57, 93, 137], [255, 0, 5], [106, 152, 172], [24, 25, 37], [25, 192, 229], [244, 244, 255], [166, 62, 43], [113, 102, 165], [23, 34, 138], [45, 108, 117], [242, 240, 245], [255, 255, 255], [242, 35, 102], [39, 56, 100], [255, 255, 255], [43, 53, 124], [0, 124, 132], [20, 45, 83], [250, 250, 61], [52, 57, 50], [100, 146, 113], [0, 0, 5], [255, 255, 255], [24, 16, 17], [40, 48, 95], [255, 255, 255], [18, 132, 63], [43, 9, 13], [148, 34, 70], [9, 12, 17], [72, 164, 150], [255, 255, 255], [149, 155, 170], [254, 249, 250], [243, 235, 197], [193, 231, 253], [99, 86, 126], [29, 44, 72], [104, 74, 117], [186, 158, 255], [67, 113, 199], [185, 189, 198], [0, 254, 156], [0, 0, 0], [164, 143, 119], [251, 232, 137], [53, 46, 117], [231, 134, 80], [148, 106, 88], [40, 136, 70], [255, 255, 255], [255, 255, 255], [145, 118, 68], [22, 51, 52], [232, 25, 27], [38, 54, 106], [23, 26, 39], [255, 255, 255], [63, 12, 11], [72, 35, 15], [187, 209, 236], [27, 59, 139], [228, 43, 40], [190, 38, 69], [19, 21, 26], [224, 115, 84], [130, 136, 168], [255, 255, 255], [200, 75, 58], [255, 255, 59], [27, 23, 71], [200, 96, 91], [3, 31, 99], [255, 44, 73], [255, 11, 19], [28, 27, 255], [74, 23, 20], [129, 172, 213], [28, 56, 121], [255, 255, 255], [162, 165, 182], [255, 255, 255], [33, 30, 73], [117, 44, 51], [25, 42, 48], [232, 215, 192], [255, 255, 255], [136, 71, 65], [255, 255, 255], [31, 31, 46], [0, 0, 10], [232, 167, 65], [26, 104, 186], [0, 0, 0], [53, 75, 143], [32, 25, 76], [255, 253, 251], [255, 190, 0], [219, 97, 84], [29, 31, 44], [255, 255, 255], [45, 45, 121], [153, 160, 170], [255, 255, 255], [115, 164, 176], [148, 60, 60], [255, 250, 255], [225, 209, 194], [215, 19, 102], [43, 53, 101], [0, 0, 19], [255, 252, 197], [203, 70, 43], [255, 255, 255], [206, 189, 163], [255, 255, 255], [255, 255, 253], [145, 126, 117], [208, 110, 56], [41, 19, 23], [255, 112, 49], [194, 193, 115], [1, 1, 1], [43, 75, 88], [71, 52, 91], [232, 87, 58], [12, 12, 9], [16, 32, 36], [2, 5, 79], [255, 255, 255], [6, 6, 0], [255, 255, 255], [10, 40, 99], [29, 43, 94], [241, 201, 44], [57, 52, 111], [216, 143, 71], [195, 178, 159], [25, 30, 52], [56, 238, 255], [0, 27, 48], [255, 255, 255], [244, 158, 73], [40, 59, 145], [25, 60, 72], [242, 238, 65], [32, 0, 26], [17, 20, 28], [255, 255, 255], [23, 97, 104], [8, 104, 184], [113, 164, 176], [255, 255, 255], [255, 213, 114], [255, 255, 255], [21, 27, 69], [213, 0, 0], [116, 0, 138], [240, 0, 221], [14, 11, 84], [209, 190, 69], [255, 255, 255], [86, 53, 65], [0, 71, 51], [0, 0, 0], [246, 242, 244], [255, 255, 255], [255, 26, 41], [29, 31, 68], [202, 137, 86], [147, 55, 60], [38, 255, 255], [249, 239, 255], [72, 34, 40], [255, 255, 255], [89, 30, 36], [188, 70, 61], [59, 100, 65], [225, 215, 193], [18, 34, 84], [130, 119, 92], [149, 80, 48], [255, 147, 99], [35, 31, 32], [135, 81, 157], [28, 22, 65], [96, 146, 181], [251, 1, 2], [255, 159, 255], [21, 31, 119], [68, 120, 70], [255, 249, 245], [46, 40, 118], [140, 46, 47], [155, 124, 139], [238, 165, 0], [146, 76, 54], [255, 29, 86], [255, 255, 255], [0, 0, 255], [243, 235, 197], [26, 25, 30], [255, 230, 130], [27, 38, 91], [119, 109, 74], [255, 255, 255], [255, 255, 255], [104, 129, 255], [113, 0, 0], [95, 96, 54], [195, 211, 149], [255, 237, 69], [53, 71, 143], [227, 0, 255], [112, 115, 58], [141, 132, 114], [178, 169, 217], [242, 209, 153], [255, 255, 255], [40, 24, 24], [113, 57, 53], [0, 0, 0], [253, 200, 67], [237, 236, 242], [255, 255, 255], [126, 115, 54], [146, 116, 97], [0, 28, 24], [120, 102, 86], [187, 187, 150], [255, 255, 255], [99, 118, 201], [24, 27, 108], [255, 255, 255], [25, 25, 25], [1, 0, 5], [255, 255, 255], [0, 17, 172], [255, 255, 255], [209, 213, 240], [52, 69, 86], [145, 53, 39], [255, 255, 255], [41, 57, 107], [255, 255, 255], [0, 0, 0], [243, 136, 92], [255, 169, 132], [249, 247, 253], [61, 118, 210], [252, 234, 198], [255, 217, 162], [255, 240, 214], [255, 255, 255], [196, 193, 255], [229, 0, 60], [236, 236, 224], [131, 156, 223], [0, 136, 178], [1, 64, 131], [131, 39, 40], [17, 22, 77], [1, 9, 63], [49, 63, 106], [36, 50, 91], [62, 111, 184], [134, 202, 36], [48, 41, 114], [171, 177, 188], [255, 255, 255], [41, 47, 74], [76, 37, 23], [0, 0, 10], [13, 56, 39], [255, 255, 0], [34, 22, 100], [4, 8, 37], [44, 61, 113], [255, 245, 32], [255, 255, 255], [255, 255, 255], [26, 26, 41], [1, 0, 5], [255, 204, 25], [5, 9, 21], [65, 62, 77], [206, 86, 131], [160, 59, 17], [255, 202, 24], [118, 156, 56], [210, 179, 149], [208, 68, 49], [201, 180, 137], [51, 49, 132], [19, 28, 44], [252, 225, 145], [83, 27, 134], [0, 0, 13], [48, 100, 82], [255, 170, 21], [205, 83, 62], [189, 116, 40], [144, 0, 0], [243, 239, 235], [169, 174, 190], [29, 27, 38], [237, 237, 93], [92, 14, 13], [255, 223, 123], [60, 26, 70], [100, 114, 213], [194, 226, 205], [50, 41, 98], [205, 127, 84], [28, 82, 69], [255, 255, 255], [93, 109, 125], [2, 4, 19], [0, 0, 0], [82, 114, 161], [144, 40, 35], [255, 255, 255], [221, 4, 33], [225, 206, 191], [255, 255, 255], [179, 149, 115], [255, 255, 255], [185, 0, 5], [16, 12, 0], [29, 134, 23], [255, 255, 255], [255, 255, 255], [126, 114, 0], [20, 24, 52], [136, 8, 88], [34, 70, 154], [255, 137, 25], [134, 165, 227], [255, 255, 255], [19, 27, 64], [236, 32, 25], [201, 133, 96], [123, 52, 53], [153, 52, 60], [157, 160, 165], [0, 15, 67], [70, 102, 176], [124, 48, 71], [255, 164, 85], [31, 51, 137], [205, 31, 222], [255, 229, 198], [180, 66, 44], [22, 23, 46], [255, 234, 95], [216, 86, 55], [75, 68, 143], [3, 49, 57], [233, 163, 56], [0, 0, 0], [14, 27, 120], [0, 0, 2], [1, 0, 5], [235, 224, 160], [28, 104, 127], [92, 127, 181], [151, 50, 46], [170, 175, 190], [255, 255, 255], [255, 249, 83], [248, 218, 111], [255, 202, 24], [215, 181, 155], [255, 255, 255], [51, 70, 119], [177, 194, 210], [133, 46, 39], [70, 17, 34], [122, 54, 118], [244, 188, 50], [159, 134, 136], [255, 255, 255], [233, 90, 48], [54, 56, 69], [255, 255, 255], [24, 55, 56], [171, 183, 217], [23, 52, 90], [172, 45, 38], [26, 34, 68], [81, 102, 45], [0, 0, 138], [174, 255, 255], [50, 116, 117], [106, 132, 205], [255, 255, 255], [18, 73, 76], [28, 47, 152], [101, 123, 181], [252, 222, 156], [0, 25, 82], [105, 117, 176], [195, 226, 255], [255, 255, 255], [8, 12, 21], [156, 50, 48], [140, 141, 158], [255, 255, 255], [48, 84, 68], [255, 255, 255], [13, 17, 26], [152, 40, 72], [40, 113, 136], [244, 112, 89], [107, 39, 31], [178, 125, 53], [25, 30, 45], [225, 244, 249], [158, 165, 178], [145, 42, 43], [108, 53, 53], [0, 0, 255], [255, 255, 255], [155, 91, 81], [255, 255, 255], [255, 255, 255], [252, 252, 252], [200, 174, 0], [40, 61, 91], [0, 0, 11], [31, 53, 244], [38, 37, 103], [10, 10, 20], [14, 12, 53], [207, 117, 0], [154, 200, 181], [75, 182, 195], [0, 0, 17], [169, 172, 181], [156, 177, 114], [0, 0, 83], [238, 229, 202], [107, 113, 139], [143, 15, 0], [168, 39, 32], [0, 3, 121], [13, 30, 160], [14, 14, 255], [219, 174, 80], [230, 195, 157], [245, 241, 236], [139, 77, 68], [255, 255, 255], [255, 167, 152], [70, 82, 131], [255, 253, 251], [5, 0, 10], [0, 0, 44], [24, 25, 29], [203, 64, 45], [255, 255, 255], [81, 41, 49], [251, 248, 207], [140, 175, 185], [67, 231, 142], [235, 177, 107], [255, 228, 192], [138, 127, 166], [37, 104, 142], [43, 68, 143], [1, 89, 101], [22, 48, 61], [0, 0, 0], [255, 255, 255], [1, 0, 5], [34, 70, 95], [23, 62, 158], [255, 97, 50], [49, 80, 255], [17, 18, 50], [87, 107, 173], [57, 102, 116], [42, 46, 87], [13, 63, 77], [242, 239, 232], [200, 119, 37], [254, 238, 194], [41, 37, 104], [224, 110, 55], [1, 0, 5], [244, 41, 37], [79, 116, 124], [0, 3, 24], [0, 0, 0], [214, 197, 169], [219, 240, 97], [6, 4, 4], [16, 21, 59], [1, 2, 14], [0, 0, 10], [232, 132, 103], [111, 130, 191], [255, 255, 255], [155, 195, 168], [207, 0, 0], [34, 53, 140], [254, 248, 224], [255, 255, 255], [255, 255, 255], [255, 255, 255], [20, 37, 70], [175, 147, 128], [23, 66, 120], [241, 186, 172], [254, 254, 254], [246, 149, 66], [155, 47, 47], [73, 35, 44], [24, 72, 152], [22, 14, 100], [88, 65, 47], [191, 203, 184], [131, 38, 35], [255, 255, 255], [205, 63, 60], [255, 255, 255], [227, 80, 69], [251, 252, 255], [248, 59, 53], [223, 78, 123], [210, 61, 54], [254, 254, 254], [0, 0, 0], [255, 255, 255], [160, 159, 165], [0, 0, 2], [123, 34, 39], [170, 180, 218], [37, 49, 130], [242, 233, 0], [146, 84, 123], [23, 24, 37], [255, 255, 255], [0, 171, 232], [255, 202, 24], [35, 41, 122], [38, 44, 35], [115, 126, 159], [1, 0, 5], [178, 149, 118], [16, 15, 21], [246, 241, 238], [255, 0, 0], [57, 67, 120], [134, 130, 178], [151, 140, 183], [226, 243, 180], [249, 212, 70], [236, 120, 66], [29, 34, 37], [68, 158, 161], [0, 0, 0], [141, 131, 185], [35, 3, 8], [103, 128, 160], [152, 40, 72], [62, 71, 255], [194, 66, 67], [11, 7, 5], [255, 255, 255], [236, 205, 195], [76, 133, 207], [247, 188, 120], [39, 40, 121], [115, 131, 179], [241, 198, 136], [171, 180, 229], [6, 29, 108], [174, 159, 158], [38, 98, 93], [68, 35, 40], [202, 38, 141], [36, 93, 120], [241, 194, 113], [255, 255, 255], [0, 0, 0], [0, 0, 0], [55, 79, 144], [0, 0, 67], [255, 255, 255], [15, 13, 27], [0, 0, 46], [94, 139, 209], [231, 76, 41], [255, 255, 255], [9, 51, 122], [101, 24, 74], [62, 0, 0], [231, 195, 169], [247, 206, 255], [51, 86, 168], [2, 0, 6], [0, 0, 12], [73, 98, 128], [38, 35, 124], [124, 103, 0], [192, 79, 45], [172, 175, 190], [31, 22, 15], [255, 255, 255], [222, 201, 177], [247, 246, 244], [99, 127, 207], [166, 171, 189], [255, 126, 109], [228, 228, 243], [64, 63, 97], [209, 39, 41], [136, 8, 88], [144, 170, 219], [27, 58, 81], [11, 29, 43], [28, 23, 35], [201, 149, 37], [56, 70, 105], [18, 100, 148], [255, 255, 255], [172, 32, 35], [157, 161, 173], [153, 154, 156], [106, 125, 255], [8, 11, 20], [240, 226, 153], [50, 57, 143], [187, 59, 122], [36, 113, 157], [54, 92, 121], [103, 129, 162], [104, 150, 219], [255, 215, 58], [13, 24, 66], [213, 10, 237], [213, 137, 85], [0, 0, 0], [40, 64, 142], [0, 1, 5], [169, 173, 185], [13, 15, 18], [249, 234, 203], [30, 40, 115], [252, 251, 250], [129, 223, 205], [192, 193, 235], [12, 15, 24], [55, 14, 14], [102, 45, 30], [0, 0, 0], [255, 255, 255], [27, 70, 48], [4, 4, 4], [169, 73, 85], [141, 41, 41], [0, 0, 0], [157, 144, 106], [138, 134, 189], [21, 23, 18], [87, 132, 87], [4, 29, 103], [147, 36, 33], [254, 254, 254], [255, 255, 255], [255, 255, 255], [255, 255, 255], [247, 130, 35], [255, 255, 255], [19, 15, 12], [246, 159, 28], [10, 10, 0], [128, 62, 12], [255, 255, 255], [0, 160, 216], [255, 243, 24], [250, 254, 255], [59, 186, 218], [255, 244, 84], [244, 113, 35], [255, 255, 255], [40, 40, 88], [255, 255, 255], [247, 130, 35], [255, 0, 40], [0, 0, 0], [255, 0, 0], [255, 255, 255], [255, 255, 255], [147, 142, 87], [16, 16, 8], [255, 255, 255], [255, 255, 255], [255, 228, 225], [24, 20, 24], [16, 9, 15], [135, 205, 213], [255, 255, 255], [255, 255, 255], [247, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 5, 40], [49, 58, 57], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 85, 55], [255, 255, 255], [255, 230, 200], [242, 249, 255], [93, 85, 86], [253, 239, 46], [255, 255, 255], [255, 255, 255], [191, 0, 0], [198, 184, 171], [16, 15, 17], [15, 14, 12], [0, 0, 0], [12, 0, 0], [255, 255, 255], [255, 255, 255], [255, 253, 210], [255, 255, 255], [254, 255, 255], [255, 243, 213], [158, 144, 101], [255, 252, 0], [1, 1, 1], [240, 228, 236], [0, 0, 0], [255, 255, 255], [255, 255, 255], [251, 248, 243], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [160, 59, 17], [0, 173, 93], [255, 255, 255], [0, 0, 0], [8, 8, 8], [12, 72, 57], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 0, 0], [0, 0, 0], [255, 255, 255], [1, 0, 255], [0, 137, 205], [254, 254, 7], [255, 255, 255], [255, 255, 255], [247, 21, 16], [255, 255, 255], [255, 255, 255], [255, 255, 255], [203, 207, 206], [31, 148, 188], [168, 152, 152], [255, 255, 255], [255, 255, 255], [255, 255, 233], [1, 0, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 1, 22], [206, 175, 123], [243, 251, 253], [255, 255, 255], [94, 134, 43], [0, 0, 0], [255, 255, 255], [252, 228, 194], [255, 255, 255], [255, 255, 255], [255, 229, 0], [255, 255, 255], [255, 255, 255], [255, 0, 0], [237, 217, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [166, 222, 204], [0, 3, 8], [255, 255, 255], [132, 17, 24], [239, 255, 255], [1, 85, 0], [60, 41, 120], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 0, 0], [232, 152, 56], [0, 0, 0], [49, 73, 111], [0, 255, 255], [247, 243, 231], [24, 23, 0], [255, 255, 255], [255, 0, 16], [252, 243, 225], [255, 255, 255], [41, 111, 163], [0, 81, 122], [53, 53, 53], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [9, 8, 14], [255, 255, 255], [255, 0, 0], [255, 26, 25], [255, 255, 255], [255, 255, 255], [43, 163, 255], [0, 8, 0], [0, 0, 0], [255, 255, 255], [157, 0, 157], [28, 14, 11], [255, 255, 255], [10, 8, 9], [89, 86, 177], [77, 47, 37], [255, 255, 255], [255, 255, 255], [53, 112, 57], [17, 43, 100], [204, 219, 219], [61, 52, 129], [255, 77, 46], [255, 255, 255], [112, 101, 157], [226, 203, 132], [255, 245, 173], [252, 243, 247], [47, 62, 134], [208, 179, 130], [55, 52, 117], [244, 158, 73], [47, 74, 31], [88, 41, 85], [122, 61, 44], [164, 200, 215], [236, 105, 77], [255, 255, 255], [255, 255, 255], [0, 0, 147], [255, 255, 255], [255, 0, 249], [133, 102, 92], [0, 0, 6], [255, 255, 255], [26, 24, 94], [212, 196, 199], [78, 123, 162], [0, 0, 0], [254, 252, 255], [255, 255, 255], [255, 204, 25], [124, 144, 134], [130, 78, 141], [23, 30, 109], [251, 230, 88], [255, 255, 255], [136, 185, 206], [36, 83, 161], [0, 0, 2], [255, 255, 255], [59, 50, 41], [255, 255, 255], [255, 245, 164], [243, 225, 195], [255, 255, 247], [255, 255, 255], [0, 0, 19], [25, 40, 50], [255, 253, 202], [23, 39, 255], [181, 168, 152], [128, 40, 31], [140, 216, 232], [255, 220, 126], [255, 255, 255], [163, 64, 61], [77, 112, 118], [166, 163, 190], [255, 198, 75], [30, 26, 40], [60, 57, 76], [255, 255, 255], [138, 71, 54], [251, 249, 255], [87, 100, 119], [255, 255, 255], [0, 0, 0], [243, 208, 176], [255, 255, 255], [237, 221, 200], [0, 11, 21], [237, 0, 241], [243, 193, 82], [0, 0, 255], [240, 236, 74], [146, 145, 159], [255, 255, 255], [244, 217, 196], [164, 164, 175], [255, 255, 255], [161, 162, 192], [255, 37, 43], [11, 30, 133], [139, 47, 47], [255, 255, 255], [250, 247, 255], [132, 61, 55], [255, 244, 247], [241, 237, 26], [255, 255, 255], [244, 204, 147], [223, 131, 46], [0, 0, 2], [35, 128, 122], [45, 134, 224], [82, 52, 73], [30, 28, 127], [130, 73, 85], [255, 255, 255], [244, 158, 73], [13, 129, 68], [244, 158, 73], [170, 55, 42], [255, 255, 255], [0, 0, 0], [195, 228, 0], [218, 232, 88], [14, 50, 38], [199, 24, 55], [101, 96, 95], [119, 125, 123], [0, 0, 2], [0, 0, 129], [108, 108, 119], [31, 50, 129], [133, 44, 40], [255, 255, 255], [238, 0, 0], [1, 12, 44], [249, 89, 78], [54, 37, 41], [159, 5, 59], [187, 50, 38], [255, 255, 255], [221, 84, 47], [245, 227, 122], [237, 96, 96], [255, 255, 255], [0, 0, 0], [255, 246, 215], [244, 158, 73], [22, 31, 255], [243, 241, 247], [255, 255, 255], [24, 41, 163], [37, 63, 75], [255, 255, 255], [235, 114, 105], [255, 255, 255], [195, 99, 48], [68, 182, 174], [2, 0, 0], [101, 116, 137], [185, 45, 34], [255, 255, 255], [255, 255, 255], [0, 0, 0], [149, 44, 38], [255, 255, 255], [28, 35, 51], [255, 255, 255], [23, 39, 160], [186, 107, 36], [244, 158, 73], [150, 138, 92], [86, 77, 108], [255, 255, 255], [76, 111, 118], [212, 197, 179], [34, 255, 255], [255, 240, 201], [255, 255, 255], [255, 255, 255], [0, 0, 0], [127, 175, 180], [255, 255, 255], [46, 84, 74], [117, 51, 47], [0, 0, 11], [255, 255, 255], [54, 51, 122], [28, 16, 24], [255, 255, 255], [0, 0, 0], [247, 244, 255], [166, 155, 147], [56, 143, 162], [30, 28, 128], [83, 155, 181], [255, 255, 255], [255, 58, 63], [244, 158, 73], [252, 238, 195], [91, 119, 31], [239, 206, 152], [255, 255, 255], [250, 209, 69], [1, 1, 5], [0, 18, 51], [244, 158, 73], [245, 240, 206], [255, 255, 255], [243, 159, 73], [255, 255, 255], [0, 0, 2], [0, 2, 33], [255, 246, 99], [22, 59, 68], [12, 0, 0], [255, 216, 131], [15, 40, 122], [255, 255, 255], [231, 228, 238], [12, 58, 65], [238, 211, 184], [117, 184, 255], [255, 255, 255], [255, 255, 205], [139, 189, 237], [4, 5, 17], [140, 51, 45], [22, 27, 60], [244, 158, 73], [201, 160, 15], [255, 255, 255], [32, 54, 138], [242, 127, 73], [87, 102, 162], [232, 0, 209], [3, 1, 7], [255, 255, 255], [255, 255, 255], [255, 255, 255], [140, 33, 24], [255, 255, 255], [160, 59, 17], [238, 237, 251], [69, 16, 28], [243, 203, 51], [141, 52, 24], [27, 72, 71], [38, 39, 58], [244, 158, 73], [0, 0, 2], [95, 97, 77], [28, 32, 70], [17, 34, 49], [149, 168, 73], [123, 57, 33], [255, 255, 255], [186, 118, 255], [108, 101, 142], [12, 22, 120], [0, 0, 10], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 84, 170], [242, 227, 125], [194, 52, 41], [149, 138, 142], [57, 100, 143], [243, 159, 73], [0, 0, 0], [234, 246, 77], [6, 45, 78], [250, 31, 38], [0, 0, 10], [100, 95, 149], [172, 160, 139], [22, 57, 183], [255, 5, 15], [244, 158, 73], [13, 107, 89], [92, 34, 60], [10, 13, 24], [32, 26, 74], [114, 136, 181], [67, 29, 40], [39, 32, 87], [255, 255, 255], [255, 255, 255], [33, 51, 57], [234, 90, 60], [238, 142, 67], [142, 67, 42], [48, 38, 150], [139, 140, 175], [51, 82, 128], [0, 0, 2], [245, 238, 215], [1, 235, 206], [255, 255, 255], [150, 38, 35], [35, 40, 98], [244, 158, 73], [255, 255, 255], [44, 57, 58], [50, 24, 43], [170, 143, 125], [171, 136, 54], [204, 188, 177], [255, 255, 255], [39, 29, 84], [40, 30, 98], [30, 30, 61], [194, 82, 43], [20, 42, 83], [0, 0, 0], [222, 231, 95], [90, 55, 86], [44, 56, 127], [243, 207, 116], [10, 54, 79], [255, 255, 255], [253, 187, 92], [24, 39, 93], [255, 255, 255], [162, 72, 60], [182, 184, 255], [255, 255, 255], [239, 203, 150], [47, 117, 199], [255, 241, 153], [255, 204, 25], [233, 175, 0], [127, 104, 255], [67, 94, 163], [255, 255, 255], [0, 0, 0], [255, 255, 255], [163, 158, 30], [127, 148, 175], [0, 0, 13], [166, 154, 104], [255, 255, 255], [243, 158, 73], [245, 32, 39], [86, 30, 36], [18, 38, 152], [255, 255, 255], [10, 8, 9], [9, 11, 22], [255, 255, 255], [125, 138, 183], [64, 100, 181], [81, 30, 65], [0, 0, 5], [243, 158, 73], [57, 46, 95], [194, 80, 131], [151, 141, 120], [21, 35, 154], [94, 42, 43], [22, 43, 155], [240, 240, 107], [255, 255, 255], [75, 41, 40], [255, 255, 255], [136, 112, 70], [51, 118, 123], [26, 38, 15], [240, 210, 157], [255, 255, 255], [220, 98, 64], [30, 28, 127], [188, 177, 139], [12, 17, 20], [45, 27, 75], [255, 255, 255], [255, 255, 255], [85, 45, 115], [255, 255, 255], [120, 109, 165], [13, 129, 68], [29, 25, 67], [8, 36, 94], [0, 0, 204], [172, 166, 180], [51, 133, 175], [224, 86, 53], [255, 255, 255], [247, 207, 98], [69, 202, 229], [0, 0, 0], [255, 255, 255], [182, 202, 212], [255, 255, 255], [255, 238, 176], [52, 105, 192], [15, 29, 134], [3, 42, 60], [255, 255, 255], [255, 255, 255], [16, 19, 27], [255, 255, 255], [0, 0, 0], [244, 158, 73], [255, 255, 255], [0, 10, 20], [142, 116, 172], [0, 0, 0], [255, 7, 14], [8, 21, 61], [45, 49, 161], [0, 146, 110], [23, 52, 91], [75, 154, 166], [243, 159, 73], [255, 255, 255], [37, 99, 166], [0, 0, 2], [23, 63, 117], [255, 255, 255], [43, 118, 201], [0, 19, 21], [94, 30, 31], [213, 0, 0], [90, 114, 160], [8, 14, 26], [141, 157, 172], [137, 162, 235], [232, 90, 54], [42, 38, 45], [27, 27, 32], [255, 255, 255], [193, 110, 71], [81, 135, 112], [248, 245, 255], [255, 255, 255], [5, 1, 0], [255, 255, 255], [37, 0, 21], [255, 255, 255], [188, 160, 139], [255, 255, 255], [26, 32, 0], [255, 255, 255], [250, 223, 78], [22, 56, 86], [248, 233, 202], [255, 237, 221], [250, 249, 255], [76, 151, 161], [218, 197, 0], [225, 214, 68], [243, 231, 229], [41, 48, 112], [134, 39, 36], [22, 24, 23], [255, 255, 255], [0, 157, 255], [255, 255, 255], [195, 221, 243], [0, 0, 2], [243, 159, 73], [243, 158, 73], [255, 255, 255], [241, 242, 244], [255, 255, 255], [36, 47, 130], [12, 27, 54], [170, 0, 27], [244, 158, 73], [0, 0, 0], [255, 255, 255], [11, 13, 25], [19, 20, 58], [77, 111, 118], [105, 30, 33], [115, 89, 82], [255, 255, 255], [238, 222, 207], [255, 255, 255], [255, 255, 255], [243, 158, 73], [255, 255, 255], [121, 49, 47], [6, 7, 19], [104, 248, 152], [244, 158, 73], [128, 3, 16], [255, 255, 255], [3, 12, 41], [255, 255, 255], [235, 178, 120], [255, 255, 255], [255, 255, 255], [16, 63, 64], [244, 158, 73], [247, 245, 248], [108, 147, 220], [130, 104, 99], [243, 38, 35], [244, 158, 73], [255, 255, 255], [28, 27, 37], [76, 113, 180], [25, 26, 57], [1, 1, 11], [147, 53, 52], [255, 255, 255], [244, 158, 73], [255, 255, 255], [207, 152, 109], [246, 241, 255], [0, 1, 24], [1, 76, 144], [9, 55, 62], [235, 107, 56], [254, 254, 254], [255, 255, 255], [37, 33, 34], [248, 246, 251], [249, 247, 251], [12, 15, 21], [255, 255, 255], [225, 107, 70], [15, 12, 19], [234, 236, 236], [145, 70, 100], [57, 78, 147], [46, 51, 115], [203, 179, 193], [89, 63, 129], [69, 27, 25], [1, 72, 54], [255, 255, 255], [255, 255, 255], [248, 222, 45], [179, 152, 156], [255, 217, 157], [255, 255, 255], [180, 187, 207], [0, 33, 45], [248, 32, 25], [254, 251, 250], [175, 196, 187], [39, 49, 87], [104, 99, 80], [77, 109, 172], [233, 163, 0], [112, 40, 45], [223, 227, 226], [185, 238, 198], [11, 11, 24], [157, 190, 221], [255, 255, 255], [9, 41, 35], [107, 24, 22], [255, 255, 255], [255, 255, 255], [255, 244, 248], [222, 70, 46], [4, 10, 22], [115, 103, 212], [255, 255, 255], [36, 30, 36], [101, 25, 30], [208, 203, 210], [155, 196, 152], [255, 255, 255], [213, 105, 30], [0, 0, 23], [0, 0, 0], [223, 156, 87], [20, 18, 29], [55, 61, 142], [16, 17, 21], [13, 28, 24], [23, 31, 57], [186, 205, 253], [242, 243, 239], [94, 115, 180], [255, 126, 203], [112, 27, 30], [244, 209, 112], [25, 30, 106], [255, 204, 25], [255, 255, 255], [179, 51, 44], [18, 48, 167], [197, 197, 91], [205, 75, 46], [30, 26, 38], [1, 1, 13], [188, 107, 60], [0, 0, 2], [0, 0, 2], [27, 27, 33], [255, 255, 255], [119, 135, 160], [255, 255, 255], [125, 117, 104], [255, 255, 255], [255, 255, 255], [236, 170, 137], [244, 158, 73], [0, 0, 0], [173, 123, 70], [208, 73, 40], [0, 0, 0], [255, 255, 255], [39, 57, 82], [252, 175, 61], [38, 53, 70], [39, 48, 86], [7, 7, 0], [252, 252, 252], [234, 246, 79], [28, 55, 129], [243, 158, 73], [57, 58, 98], [255, 255, 255], [51, 159, 255], [255, 255, 255], [255, 255, 255], [8, 9, 19], [21, 33, 83], [255, 248, 221], [244, 158, 73], [255, 255, 255], [255, 255, 255], [17, 15, 37], [243, 159, 73], [27, 79, 188], [79, 184, 156], [255, 255, 255], [0, 0, 2], [255, 255, 255], [36, 40, 44], [14, 27, 106], [255, 238, 204], [0, 0, 0], [163, 162, 174], [247, 210, 147], [223, 66, 51], [1, 0, 5], [22, 56, 174], [255, 255, 255], [255, 255, 255], [193, 158, 85], [255, 255, 255], [244, 158, 73], [5, 8, 13], [9, 10, 14], [255, 202, 24], [32, 78, 158], [255, 251, 251], [0, 0, 206], [159, 52, 65], [162, 121, 131], [255, 255, 255], [255, 255, 255], [195, 0, 51], [255, 255, 255], [125, 47, 77], [202, 198, 183], [248, 160, 26], [0, 0, 32], [33, 30, 79], [0, 0, 0], [255, 255, 255], [254, 254, 254], [10, 13, 25], [39, 30, 82], [255, 255, 255], [255, 255, 255], [246, 196, 70], [95, 144, 210], [100, 131, 220], [191, 55, 39], [244, 158, 73], [255, 255, 255], [28, 20, 33], [214, 137, 79], [30, 29, 64], [173, 199, 222], [31, 71, 200], [251, 252, 255], [255, 216, 166], [192, 192, 213], [233, 127, 80], [247, 245, 250], [244, 158, 73], [241, 211, 0], [18, 85, 105], [255, 255, 255], [145, 49, 32], [30, 52, 130], [149, 133, 158], [8, 12, 25], [244, 158, 73], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 17, 12], [148, 46, 40], [126, 59, 50], [59, 74, 106], [255, 255, 255], [129, 46, 36], [255, 255, 255], [197, 19, 55], [255, 255, 255], [167, 200, 236], [71, 73, 138], [0, 1, 57], [255, 255, 255], [25, 27, 36], [255, 255, 255], [244, 158, 73], [255, 252, 255], [22, 13, 44], [244, 158, 73], [243, 158, 73], [153, 133, 172], [255, 250, 255], [218, 67, 40], [36, 46, 137], [203, 213, 178], [255, 248, 161], [255, 255, 24], [113, 102, 165], [255, 255, 255], [255, 255, 255], [255, 255, 255], [232, 8, 8], [255, 255, 255], [27, 89, 98], [209, 197, 99], [244, 158, 73], [221, 191, 118], [255, 255, 255], [34, 33, 82], [255, 255, 255], [244, 158, 73], [37, 28, 72], [6, 22, 38], [237, 236, 235], [255, 202, 24], [53, 75, 143], [13, 107, 89], [215, 19, 102], [192, 73, 51], [3, 42, 50], [0, 0, 70], [244, 158, 73], [105, 39, 37], [0, 0, 6], [10, 11, 16], [244, 235, 205], [200, 168, 129], [8, 6, 0], [255, 255, 255], [255, 255, 255], [249, 248, 255], [255, 255, 255], [143, 53, 60], [255, 255, 255], [255, 255, 255], [245, 231, 113], [255, 255, 255], [152, 171, 202], [180, 217, 226], [28, 27, 37], [255, 255, 255], [243, 237, 248], [242, 209, 153], [236, 178, 120], [255, 255, 255], [0, 44, 47], [37, 30, 39], [245, 248, 255], [8, 5, 255], [110, 62, 61], [80, 39, 51], [0, 0, 2], [255, 255, 255], [0, 1, 14], [0, 0, 255], [133, 153, 178], [251, 252, 255], [145, 60, 55], [160, 59, 17], [51, 39, 100], [104, 128, 53], [48, 58, 49], [126, 141, 122], [255, 255, 255], [128, 47, 34], [241, 28, 26], [173, 199, 92], [255, 255, 255], [150, 106, 62], [183, 64, 46], [25, 25, 30], [192, 200, 121], [241, 26, 18], [248, 243, 247], [176, 31, 38], [72, 180, 71], [255, 255, 255], [190, 54, 38], [17, 18, 25], [255, 255, 255], [244, 158, 73], [0, 0, 0], [255, 255, 255], [255, 255, 255], [51, 85, 61], [244, 158, 73], [112, 141, 142], [18, 53, 152], [255, 255, 255], [174, 140, 102], [73, 18, 28], [0, 84, 170], [132, 30, 15], [20, 24, 28], [118, 80, 68], [127, 131, 154], [38, 43, 64], [255, 255, 255], [255, 255, 255], [0, 111, 174], [126, 102, 84], [33, 79, 101], [255, 255, 255], [104, 106, 101], [0, 84, 170], [172, 0, 209], [0, 0, 5], [2, 5, 76], [36, 78, 158], [0, 0, 5], [177, 153, 174], [0, 0, 0], [11, 13, 26], [255, 255, 255], [1, 0, 7], [0, 0, 5], [147, 134, 125], [255, 255, 255], [241, 184, 114], [243, 159, 73], [222, 122, 153], [122, 29, 21], [249, 241, 177], [188, 189, 177], [255, 255, 255], [28, 39, 57], [255, 255, 255], [229, 214, 193], [172, 177, 154], [14, 26, 74], [248, 190, 116], [204, 147, 69], [106, 33, 26], [12, 7, 34], [35, 57, 170], [208, 173, 154], [247, 252, 116], [26, 0, 100], [255, 255, 255], [255, 255, 255], [255, 78, 0], [0, 19, 29], [255, 255, 255], [0, 1, 5], [0, 0, 0], [216, 214, 215], [202, 31, 26], [218, 195, 0], [0, 90, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [251, 248, 0], [50, 52, 49], [167, 165, 140], [40, 40, 40], [35, 15, 14], [255, 255, 255], [234, 221, 200], [241, 203, 143], [255, 255, 255], [0, 12, 16], [251, 246, 242], [1, 2, 6], [0, 0, 0], [0, 28, 255], [255, 255, 255], [22, 21, 21], [255, 255, 255], [239, 239, 239], [255, 255, 255], [255, 255, 255], [255, 255, 255], [242, 246, 249], [255, 255, 255], [255, 255, 137], [255, 0, 0], [30, 123, 193], [0, 0, 0], [255, 229, 0], [16, 31, 24], [51, 127, 141], [26, 22, 11], [0, 0, 0], [255, 255, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [15, 7, 8], [255, 255, 255], [6, 19, 24], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 7, 8], [0, 9, 8], [221, 229, 239], [255, 220, 224], [255, 255, 255], [241, 236, 230], [255, 255, 255], [241, 238, 233], [4, 7, 11], [255, 255, 255], [23, 32, 49], [255, 255, 255], [0, 0, 0], [255, 255, 255], [0, 0, 0], [5, 6, 8], [255, 251, 240], [249, 230, 198], [255, 255, 255], [255, 255, 255], [19, 65, 89], [255, 255, 255], [0, 0, 0], [25, 27, 255], [226, 211, 193], [213, 15, 64], [255, 255, 255], [7, 12, 8], [164, 32, 38], [137, 138, 129], [248, 248, 248], [255, 255, 255], [255, 255, 255], [255, 255, 214], [250, 235, 142], [255, 255, 255], [13, 13, 11], [0, 0, 0], [241, 31, 42], [232, 248, 232], [254, 243, 239], [248, 8, 8], [0, 0, 0], [255, 129, 116], [242, 91, 34], [252, 249, 170], [0, 0, 0], [247, 247, 247], [234, 167, 27], [255, 0, 255], [248, 200, 8], [248, 245, 228], [255, 255, 255], [85, 255, 214], [255, 255, 255], [239, 4, 123], [255, 255, 255], [255, 255, 255], [235, 246, 252], [255, 255, 0], [255, 0, 0], [255, 255, 255], [0, 9, 8], [255, 255, 255], [248, 112, 90], [183, 184, 169], [255, 255, 255], [0, 178, 56], [107, 211, 248], [0, 0, 0], [0, 0, 0], [255, 255, 255], [212, 0, 200], [3, 3, 3], [255, 255, 255], [210, 216, 180], [35, 31, 32], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [17, 37, 255], [136, 200, 72], [239, 234, 219], [254, 255, 250], [22, 24, 23], [252, 203, 5], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [246, 213, 48], [255, 255, 255], [52, 53, 53], [255, 255, 255], [255, 255, 255], [205, 73, 71], [255, 255, 255], [95, 61, 52], [255, 255, 255], [1, 0, 14], [255, 243, 0], [255, 255, 255], [255, 195, 49], [0, 77, 0], [255, 255, 255], [255, 175, 255], [255, 255, 255], [6, 24, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [207, 112, 94], [255, 255, 255], [229, 255, 168], [253, 237, 237], [0, 0, 0], [255, 255, 255], [255, 255, 255], [253, 253, 253], [23, 42, 56], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 254, 253], [120, 174, 63], [233, 255, 253], [255, 255, 255], [237, 243, 235], [254, 253, 251], [255, 255, 255], [48, 0, 0], [253, 252, 222], [242, 239, 255], [88, 42, 38], [255, 252, 217], [255, 255, 255], [199, 234, 253], [255, 30, 47], [21, 18, 47], [255, 255, 255], [254, 254, 254], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [243, 118, 152], [2, 78, 40], [255, 255, 255], [255, 255, 255], [44, 50, 131], [255, 229, 202], [255, 255, 255], [255, 255, 255], [255, 255, 255], [1, 1, 1], [0, 0, 2], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 252, 217], [255, 255, 255], [255, 255, 255], [254, 254, 252], [247, 209, 72], [255, 255, 255], [255, 255, 0], [255, 255, 255], [0, 255, 255], [170, 194, 8], [255, 255, 255], [28, 44, 77], [108, 118, 128], [26, 0, 0], [255, 255, 255], [255, 18, 12], [116, 33, 30], [19, 19, 255], [202, 213, 196], [253, 252, 222], [253, 253, 193], [255, 255, 255], [6, 9, 23], [251, 243, 204], [254, 255, 255], [255, 255, 255], [120, 104, 88], [255, 255, 255], [0, 160, 216], [0, 0, 0], [0, 0, 0], [255, 255, 255], [172, 93, 52], [40, 24, 40], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [231, 235, 247], [0, 0, 0], [253, 235, 220], [6, 24, 0], [255, 255, 255], [168, 154, 155], [255, 255, 255], [255, 255, 255], [240, 229, 167], [52, 25, 34], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [115, 165, 214], [255, 255, 255], [0, 122, 57], [0, 0, 0], [220, 212, 103], [255, 255, 255], [218, 124, 52], [255, 18, 12], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [229, 228, 224], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [3, 0, 0], [36, 95, 175], [255, 255, 255], [255, 243, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [6, 24, 34], [209, 169, 99], [255, 255, 0], [240, 223, 200], [255, 0, 0], [255, 0, 0], [189, 189, 186], [244, 245, 247], [255, 255, 255], [255, 255, 255], [6, 0, 0], [0, 0, 0], [0, 0, 0], [6, 24, 34], [206, 207, 18], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 252, 217], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [32, 65, 100], [15, 19, 49], [255, 255, 255], [6, 24, 0], [0, 0, 0], [169, 110, 108], [222, 153, 104], [159, 104, 118], [237, 56, 0], [169, 173, 131], [255, 255, 255], [6, 24, 0], [240, 242, 241], [255, 253, 217], [255, 255, 255], [0, 0, 0], [45, 181, 140], [255, 255, 255], [0, 0, 0], [255, 0, 11], [210, 172, 153], [255, 255, 255], [166, 217, 62], [255, 255, 255], [245, 120, 36], [255, 255, 255], [255, 253, 0], [148, 180, 193], [255, 255, 255], [255, 255, 255], [232, 239, 247], [0, 0, 0], [255, 255, 255], [255, 255, 255], [210, 101, 55], [0, 0, 16], [0, 0, 0], [255, 255, 255], [0, 0, 26], [255, 255, 255], [231, 234, 212], [255, 255, 255], [152, 216, 88], [255, 255, 255], [196, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [78, 7, 103], [255, 255, 255], [250, 250, 250], [255, 255, 255], [255, 101, 1], [255, 255, 255], [0, 137, 205], [255, 255, 255], [255, 255, 255], [0, 0, 0], [20, 20, 18], [107, 61, 47], [255, 255, 255], [0, 0, 0], [255, 255, 255], [0, 9, 24], [255, 255, 255], [255, 255, 255], [0, 0, 0], [144, 42, 38], [254, 0, 0], [255, 255, 255], [255, 255, 255], [222, 25, 34], [72, 179, 70], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 38, 34], [255, 255, 255], [255, 255, 255], [10, 6, 7], [255, 255, 255], [255, 255, 255], [0, 23, 0], [255, 255, 255], [1, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [238, 77, 48], [21, 65, 44], [255, 255, 255], [0, 0, 0], [0, 0, 0], [0, 255, 0], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 70, 255], [1, 0, 0], [225, 233, 235], [255, 255, 40], [255, 203, 5], [73, 255, 255], [255, 255, 255], [0, 0, 0], [223, 227, 230], [12, 72, 57], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [237, 27, 0], [255, 255, 255], [255, 15, 13], [255, 255, 255], [255, 255, 255], [3, 7, 8], [0, 0, 0], [255, 255, 255], [3, 7, 8], [255, 233, 0], [237, 27, 36], [255, 255, 255], [0, 0, 0], [255, 255, 255], [0, 0, 0], [0, 0, 0], [255, 255, 255], [6, 7, 9], [255, 255, 255], [255, 255, 255], [255, 255, 255], [181, 178, 126], [212, 61, 40], [3, 0, 0], [174, 32, 72], [1, 1, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 5, 40], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 75, 74], [255, 255, 255], [255, 255, 255], [255, 255, 255], [167, 226, 36], [0, 0, 0], [255, 255, 255], [255, 255, 255], [189, 37, 43], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 0, 0], [190, 18, 22], [255, 255, 255], [155, 31, 41], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [10, 12, 15], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 247, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [55, 0, 255], [255, 255, 255], [0, 0, 0], [0, 0, 0], [149, 0, 0], [1, 1, 1], [255, 255, 255], [240, 226, 189], [255, 255, 255], [255, 255, 255], [126, 65, 34], [0, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [27, 237, 240], [52, 60, 60], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 151, 40], [54, 38, 39], [21, 16, 13], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [97, 143, 156], [0, 22, 0], [0, 195, 255], [149, 176, 125], [212, 91, 44], [1, 1, 1], [255, 40, 40], [6, 8, 5], [255, 255, 255], [255, 255, 255], [1, 1, 1], [255, 206, 43], [255, 255, 255], [19, 9, 9], [255, 255, 255], [255, 255, 255], [255, 30, 25], [22, 22, 22], [29, 55, 35], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [8, 13, 16], [255, 255, 255], [255, 255, 255], [255, 70, 0], [255, 243, 0], [255, 8, 7], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [49, 58, 88], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [1, 1, 1], [255, 255, 255], [10, 6, 7], [248, 168, 56], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [35, 31, 32], [250, 214, 135], [51, 79, 100], [255, 255, 255], [161, 189, 209], [0, 9, 8], [255, 255, 255], [100, 16, 18], [255, 255, 255], [111, 146, 161], [0, 0, 0], [223, 227, 230], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [0, 34, 255], [255, 248, 237], [255, 255, 255], [255, 255, 255], [0, 0, 0], [253, 255, 254], [255, 255, 255], [121, 73, 120], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 0], [1, 0, 255], [255, 246, 219], [255, 255, 255], [1, 1, 1], [255, 255, 255], [0, 0, 0], [238, 238, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [183, 184, 169], [255, 79, 173], [255, 1, 0], [255, 255, 255], [23, 117, 239], [11, 23, 52], [255, 33, 34], [255, 255, 255], [255, 255, 255], [1, 3, 0], [0, 0, 0], [59, 186, 218], [255, 255, 255], [234, 232, 233], [40, 40, 88], [206, 175, 123], [189, 189, 186], [216, 216, 232], [255, 255, 255], [187, 32, 36], [255, 255, 255], [255, 255, 255], [0, 0, 0], [34, 39, 42], [255, 255, 255], [255, 255, 82], [255, 255, 255], [238, 217, 0], [255, 255, 255], [255, 255, 36], [255, 40, 40], [255, 255, 255], [50, 52, 22], [5, 6, 8], [255, 255, 255], [255, 198, 0], [255, 255, 255], [1, 1, 0], [252, 228, 194], [90, 198, 208], [0, 0, 0], [255, 30, 25], [74, 77, 59], [206, 197, 142], [8, 0, 0], [255, 255, 255], [255, 255, 255], [254, 212, 74], [18, 12, 12], [255, 70, 0], [255, 255, 255], [255, 243, 0], [173, 171, 122], [216, 40, 40], [0, 173, 93], [238, 36, 144], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [251, 253, 253], [0, 0, 0], [255, 255, 255], [255, 255, 255], [14, 4, 5], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [23, 22, 18], [0, 0, 0], [255, 255, 255], [245, 228, 0], [255, 255, 255], [225, 28, 212], [255, 255, 255], [255, 255, 255], [179, 144, 181], [255, 253, 255], [255, 9, 0], [255, 255, 255], [255, 255, 255], [37, 31, 34], [42, 62, 86], [232, 168, 200], [216, 2, 2], [255, 255, 255], [255, 255, 255], [255, 255, 255], [252, 241, 209], [255, 252, 214], [6, 7, 6], [39, 66, 93], [255, 255, 255], [197, 32, 46], [0, 255, 0], [255, 255, 255], [0, 0, 0], [0, 0, 0], [0, 0, 0], [255, 25, 27], [255, 233, 255], [255, 255, 255], [255, 255, 255], [0, 22, 255], [255, 255, 255], [255, 72, 0], [10, 12, 11], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [255, 0, 0], [24, 22, 29], [228, 25, 55], [255, 255, 255], [255, 255, 255], [0, 255, 255], [255, 255, 255], [1, 3, 2], [195, 215, 226], [255, 255, 255], [0, 110, 110], [0, 0, 0], [24, 34, 44], [255, 255, 255], [255, 255, 255], [255, 255, 255], [80, 51, 46], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [208, 225, 232], [8, 10, 9], [255, 255, 255], [255, 255, 255], [255, 0, 64], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [8, 168, 232], [255, 152, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 0, 0], [0, 0, 0], [25, 9, 10], [255, 255, 255], [1, 1, 1], [0, 38, 21], [3, 3, 0], [255, 255, 255], [210, 218, 218], [220, 8, 8], [253, 250, 245], [255, 252, 208], [14, 11, 4], [255, 255, 255], [36, 8, 0], [255, 255, 255], [255, 255, 54], [4, 16, 16], [255, 8, 11], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 107], [219, 18, 21], [0, 0, 0], [255, 255, 255], [255, 255, 255], [117, 135, 149], [58, 162, 217], [255, 255, 255], [255, 255, 255], [255, 214, 124], [255, 255, 255], [255, 255, 255], [1, 3, 2], [171, 30, 36], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [17, 17, 73], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [56, 56, 56], [255, 255, 255], [35, 58, 57], [255, 255, 255], [255, 255, 255], [2, 2, 2], [255, 0, 0], [255, 255, 255], [0, 0, 0], [216, 214, 219], [15, 18, 27], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 58, 37], [255, 255, 255], [255, 25, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 18, 15], [255, 255, 255], [255, 255, 255], [0, 4, 0], [255, 32, 30], [255, 255, 255], [0, 255, 14], [0, 0, 0], [213, 170, 226], [255, 255, 255], [255, 255, 255], [255, 255, 255], [8, 20, 36], [8, 184, 200], [0, 0, 0], [255, 255, 255], [12, 8, 7], [255, 255, 255], [255, 255, 255], [255, 140, 56], [254, 252, 237], [231, 203, 143], [4, 5, 7], [255, 255, 255], [232, 231, 255], [2, 0, 19], [68, 86, 96], [255, 81, 39], [0, 0, 0], [225, 226, 228], [255, 255, 255], [255, 255, 255], [17, 21, 0], [255, 255, 255], [242, 89, 32], [8, 24, 40], [135, 205, 213], [255, 255, 255], [17, 18, 20], [0, 0, 0], [255, 255, 255], [255, 51, 255], [255, 255, 255], [255, 255, 255], [238, 235, 215], [207, 208, 200], [255, 255, 255], [255, 255, 255], [248, 248, 8], [255, 255, 255], [207, 34, 40], [115, 115, 115], [0, 0, 0], [255, 255, 255], [10, 8, 0], [13, 0, 0], [255, 255, 255], [218, 230, 244], [255, 255, 255], [255, 255, 255], [255, 217, 41], [255, 255, 255], [0, 15, 8], [0, 34, 255], [255, 61, 0], [255, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [235, 247, 243], [255, 255, 255], [0, 0, 0], [239, 57, 44], [255, 255, 255], [255, 220, 213], [241, 239, 218], [253, 242, 136], [246, 48, 138], [92, 128, 40], [27, 19, 23], [255, 255, 255], [113, 255, 0], [228, 56, 44], [255, 255, 255], [36, 33, 62], [77, 34, 15], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 8, 73], [255, 255, 255], [0, 0, 0], [230, 231, 218], [255, 255, 255], [255, 255, 255], [0, 0, 0], [22, 11, 16], [0, 114, 255], [255, 255, 255], [253, 253, 253], [249, 247, 242], [255, 255, 255], [255, 255, 255], [255, 163, 155], [227, 237, 239], [255, 255, 255], [0, 4, 7], [6, 7, 9], [255, 244, 222], [23, 43, 28], [2, 2, 2], [10, 12, 0], [46, 22, 20], [255, 255, 255], [0, 255, 0], [255, 102, 35], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [247, 245, 240], [238, 239, 237], [255, 107, 73], [213, 0, 0], [250, 132, 197], [68, 86, 96], [240, 36, 125], [255, 255, 255], [20, 13, 17], [35, 15, 17], [255, 255, 255], [255, 53, 45], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 247, 238], [255, 255, 255], [51, 21, 11], [255, 47, 91], [246, 243, 236], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 83, 38], [34, 24, 24], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [68, 86, 96], [255, 255, 255], [255, 255, 255], [255, 255, 255], [143, 29, 101], [173, 48, 42], [239, 241, 236], [43, 41, 31], [245, 245, 245], [0, 0, 0], [255, 255, 255], [14, 19, 27], [30, 0, 0], [10, 10, 8], [1, 1, 1], [255, 65, 24], [255, 255, 255], [0, 0, 0], [254, 247, 156], [255, 255, 255], [0, 0, 0], [255, 253, 228], [255, 255, 255], [255, 255, 255], [21, 101, 155], [255, 255, 255], [255, 255, 255], [1, 1, 1], [14, 19, 39], [247, 245, 224], [255, 255, 255], [153, 55, 46], [0, 0, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [0, 140, 115], [28, 30, 31], [255, 30, 39], [255, 5, 40], [146, 213, 225], [255, 255, 255], [44, 53, 0], [245, 0, 197], [23, 13, 11], [255, 255, 255], [241, 82, 61], [255, 255, 255], [255, 255, 255], [1, 1, 1], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 55, 18], [255, 255, 255], [255, 15, 14], [111, 111, 109], [255, 255, 255], [255, 255, 255], [150, 110, 61], [255, 255, 255], [255, 240, 146], [246, 247, 253], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [161, 0, 239], [255, 8, 8], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [255, 255, 255], [255, 247, 237], [0, 0, 0], [255, 255, 255], [255, 178, 146], [255, 0, 0], [255, 255, 255], [255, 255, 255], [0, 0, 0], [101, 86, 0], [255, 255, 255], [255, 255, 255], [228, 25, 55], [255, 255, 255], [33, 29, 30], [0, 255, 255], [255, 229, 181], [67, 48, 33], [255, 255, 255], [255, 255, 255], [17, 18, 255], [0, 0, 0], [0, 1, 22], [237, 45, 0], [255, 255, 255], [255, 255, 255], [0, 244, 0], [8, 184, 184], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [3, 3, 16], [255, 255, 255], [4, 8, 0], [255, 255, 255], [245, 235, 224], [241, 43, 51], [47, 17, 15], [44, 129, 196], [164, 219, 216], [255, 255, 255], [255, 255, 255], [0, 0, 0], [235, 237, 224], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 82, 0], [7, 7, 9], [255, 255, 255], [255, 255, 255], [190, 138, 142], [170, 44, 40], [0, 0, 10], [244, 225, 0], [17, 16, 14], [255, 255, 255], [255, 255, 255], [140, 167, 70], [78, 67, 65], [142, 111, 171], [255, 255, 0], [5, 24, 30], [0, 72, 149], [255, 255, 255], [255, 255, 255], [235, 246, 248], [24, 24, 26], [255, 255, 255], [216, 104, 40], [255, 255, 255], [0, 0, 0], [13, 17, 21], [255, 255, 255], [255, 255, 255], [255, 255, 255], [185, 135, 72], [255, 38, 38], [132, 2, 4], [255, 245, 124], [255, 225, 200], [255, 255, 255], [255, 255, 38], [197, 43, 43], [56, 51, 46], [61, 0, 0], [79, 10, 7], [255, 255, 255], [1, 174, 217], [248, 248, 216], [255, 255, 255], [40, 40, 88], [255, 255, 255], [232, 208, 234], [0, 0, 0], [1, 182, 209], [195, 32, 37], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [36, 32, 33], [255, 238, 236], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 20, 255], [255, 40, 40], [0, 0, 0], [187, 32, 36], [255, 255, 255], [255, 255, 255], [255, 255, 255], [23, 22, 17], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 27, 34], [255, 15, 11], [0, 0, 0], [255, 255, 255], [255, 0, 0], [9, 10, 15], [25, 16, 87], [255, 255, 255], [117, 217, 243], [255, 255, 255], [255, 255, 255], [10, 10, 244], [255, 255, 255], [6, 0, 0], [255, 255, 255], [1, 1, 1], [255, 255, 255], [255, 255, 255], [255, 255, 255], [115, 105, 161], [0, 0, 0], [255, 255, 255], [239, 237, 236], [255, 255, 255], [0, 116, 74], [255, 255, 255], [0, 11, 11], [255, 255, 0], [255, 255, 255], [244, 245, 239], [255, 255, 255], [225, 0, 0], [255, 255, 255], [0, 88, 168], [255, 255, 255], [228, 25, 55], [255, 255, 255], [0, 4, 0], [1, 143, 209], [11, 22, 39], [255, 22, 17], [255, 255, 255], [120, 216, 232], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [31, 0, 0], [255, 255, 255], [120, 14, 14], [255, 255, 255], [255, 255, 255], [18, 21, 30], [17, 130, 196], [54, 85, 0], [255, 255, 15], [35, 32, 19], [255, 255, 255], [6, 5, 10], [255, 255, 36], [24, 19, 16], [255, 156, 0], [0, 255, 255], [255, 255, 255], [0, 0, 0], [200, 152, 40], [56, 61, 62], [161, 208, 238], [249, 251, 250], [255, 255, 255], [255, 255, 255], [255, 255, 255], [240, 242, 241], [255, 255, 255], [255, 255, 255], [241, 210, 181], [200, 237, 222], [16, 20, 19], [255, 255, 255], [255, 255, 255], [125, 162, 170], [255, 255, 255], [8, 72, 88], [255, 255, 255], [255, 255, 255], [255, 255, 255], [252, 228, 194], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [219, 220, 217], [255, 255, 255], [255, 255, 255], [2, 4, 3], [255, 255, 255], [3, 7, 8], [0, 0, 0], [255, 255, 255], [255, 255, 255], [228, 29, 36], [23, 23, 23], [255, 255, 255], [255, 255, 255], [16, 24, 23], [255, 203, 217], [0, 186, 12], [255, 255, 255], [255, 255, 255], [228, 25, 55], [17, 19, 255], [255, 255, 255], [246, 221, 7], [3, 4, 0], [250, 23, 21], [255, 255, 255], [185, 147, 196], [255, 240, 209], [255, 255, 255], [255, 255, 255], [0, 22, 35], [216, 18, 12], [255, 255, 255], [255, 255, 255], [7, 8, 10], [166, 30, 34], [255, 199, 255], [255, 255, 255], [255, 255, 255], [255, 255, 101], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 250, 153], [255, 255, 255], [5, 5, 0], [253, 239, 46], [232, 233, 228], [255, 255, 255], [255, 31, 255], [0, 0, 0], [255, 255, 255], [0, 200, 209], [59, 50, 35], [141, 141, 0], [107, 110, 115], [0, 141, 255], [241, 85, 11], [255, 255, 255], [172, 208, 192], [255, 255, 255], [255, 255, 255], [230, 233, 226], [255, 255, 255], [255, 255, 255], [0, 0, 0], [248, 235, 18], [0, 19, 34], [255, 255, 0], [254, 223, 45], [40, 31, 21], [209, 204, 200], [255, 18, 0], [80, 17, 255], [167, 169, 38], [43, 47, 50], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [133, 0, 65], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 0, 0], [8, 9, 11], [255, 227, 255], [255, 255, 255], [53, 164, 220], [255, 255, 255], [42, 53, 57], [255, 255, 255], [255, 255, 255], [255, 255, 255], [251, 247, 244], [0, 0, 0], [237, 38, 45], [255, 255, 255], [238, 28, 39], [211, 0, 0], [255, 255, 255], [69, 12, 13], [35, 190, 77], [255, 26, 20], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 168, 0], [255, 255, 255], [255, 255, 255], [0, 64, 58], [235, 230, 210], [255, 255, 255], [195, 203, 30], [251, 253, 253], [255, 255, 255], [0, 0, 0], [0, 0, 0], [0, 35, 100], [26, 210, 222], [255, 255, 255], [255, 255, 255], [127, 163, 215], [133, 129, 117], [255, 255, 255], [252, 214, 213], [0, 114, 63], [112, 230, 255], [255, 247, 192], [255, 255, 255], [255, 255, 255], [255, 255, 0], [243, 240, 255], [45, 112, 191], [255, 254, 252], [255, 255, 255], [232, 8, 8], [255, 255, 255], [5, 6, 8], [255, 255, 255], [255, 255, 255], [255, 0, 255], [0, 173, 207], [255, 255, 255], [235, 246, 252], [216, 40, 56], [255, 255, 255], [61, 101, 163], [242, 219, 237], [33, 29, 24], [45, 43, 44], [255, 26, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 248, 232], [255, 250, 251], [225, 229, 232], [199, 227, 248], [51, 70, 63], [130, 194, 57], [255, 87, 38], [255, 255, 255], [245, 246, 228], [255, 255, 255], [184, 25, 128], [255, 0, 0], [255, 255, 255], [0, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [128, 214, 247], [255, 255, 255], [255, 255, 255], [32, 172, 231], [207, 235, 247], [228, 224, 222], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [246, 137, 32], [255, 255, 255], [13, 12, 10], [255, 255, 255], [0, 0, 0], [10, 14, 17], [251, 253, 252], [255, 251, 239], [255, 255, 255], [0, 27, 56], [0, 0, 0], [255, 255, 255], [255, 254, 249], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [254, 254, 254], [255, 255, 255], [0, 49, 74], [255, 255, 75], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [178, 138, 5], [242, 246, 249], [15, 14, 12], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 235, 197], [34, 4, 6], [232, 232, 216], [8, 40, 88], [255, 229, 0], [0, 42, 66], [208, 195, 153], [8, 40, 88], [255, 93, 48], [0, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [201, 77, 76], [254, 254, 254], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 240, 16], [0, 137, 205], [216, 216, 216], [0, 0, 0], [255, 175, 0], [254, 254, 254], [238, 65, 49], [250, 6, 8], [222, 218, 215], [232, 56, 40], [255, 255, 255], [216, 40, 40], [0, 0, 0], [255, 255, 255], [5, 6, 8], [16, 15, 13], [255, 255, 255], [255, 255, 255], [200, 8, 24], [255, 255, 255], [0, 0, 255], [19, 18, 16], [255, 255, 255], [0, 0, 10], [4, 8, 11], [255, 255, 255], [242, 225, 216], [255, 255, 255], [255, 255, 255], [248, 168, 120], [255, 255, 255], [255, 255, 255], [0, 0, 6], [9, 73, 53], [152, 152, 152], [255, 255, 255], [230, 204, 133], [86, 151, 193], [6, 24, 34], [255, 255, 255], [215, 211, 214], [255, 255, 255], [255, 255, 0], [255, 255, 8], [255, 255, 255], [255, 255, 255], [224, 232, 11], [248, 232, 232], [0, 85, 139], [166, 222, 204], [255, 227, 237], [255, 251, 222], [0, 0, 0], [255, 246, 65], [255, 255, 255], [6, 24, 0], [247, 247, 247], [255, 255, 255], [255, 255, 255], [185, 185, 185], [255, 255, 255], [255, 130, 255], [0, 0, 0], [248, 104, 184], [21, 26, 0], [255, 31, 49], [254, 242, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [253, 255, 252], [121, 130, 67], [255, 255, 255], [255, 253, 246], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 255, 255], [246, 240, 180], [255, 0, 177], [255, 255, 255], [255, 255, 255], [255, 0, 0], [204, 187, 68], [1, 1, 1], [255, 255, 255], [120, 184, 232], [218, 221, 230], [0, 0, 0], [216, 232, 248], [97, 94, 32], [255, 255, 255], [234, 209, 205], [16, 15, 13], [234, 235, 239], [255, 255, 255], [255, 255, 255], [154, 1, 81], [249, 245, 235], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [241, 241, 241], [255, 238, 103], [255, 255, 255], [6, 24, 0], [255, 255, 255], [40, 24, 24], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [254, 23, 0], [254, 242, 0], [211, 60, 42], [248, 184, 24], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 162], [254, 251, 232], [255, 255, 255], [255, 6, 120], [255, 255, 255], [166, 197, 199], [255, 255, 255], [255, 255, 255], [255, 255, 0], [255, 255, 255], [219, 190, 147], [255, 255, 255], [250, 162, 28], [223, 166, 182], [56, 44, 18], [17, 43, 100], [255, 255, 255], [255, 255, 255], [55, 64, 131], [216, 185, 204], [246, 246, 246], [7, 3, 6], [0, 249, 248], [255, 255, 255], [0, 0, 0], [56, 255, 255], [255, 255, 255], [255, 29, 36], [255, 255, 255], [255, 252, 247], [255, 255, 255], [0, 0, 0], [195, 165, 17], [255, 255, 255], [255, 255, 255], [255, 23, 0], [255, 255, 255], [255, 255, 255], [250, 214, 135], [255, 255, 255], [255, 255, 255], [122, 144, 59], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 255, 255], [16, 9, 15], [255, 255, 255], [255, 255, 255], [248, 200, 8], [255, 255, 255], [1, 1, 1], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [49, 64, 0], [255, 255, 255], [237, 237, 235], [255, 255, 13], [0, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 174, 219], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 39, 20], [255, 255, 255], [255, 255, 255], [245, 242, 223], [210, 35, 42], [66, 108, 190], [255, 255, 255], [255, 255, 255], [255, 255, 255], [204, 179, 155], [255, 255, 255], [248, 248, 232], [255, 255, 255], [0, 255, 255], [112, 120, 68], [255, 255, 255], [255, 255, 255], [255, 255, 255], [8, 31, 98], [0, 0, 0], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [124, 77, 64], [23, 21, 14], [255, 255, 255], [121, 7, 7], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [109, 24, 63], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [232, 200, 136], [255, 255, 255], [255, 255, 255], [255, 255, 255], [16, 190, 15], [16, 15, 13], [251, 244, 226], [255, 255, 255], [243, 31, 34], [255, 255, 255], [0, 1, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 0, 0], [240, 231, 174], [1, 1, 1], [255, 255, 255], [246, 115, 35], [255, 255, 255], [1, 1, 1], [255, 141, 64], [83, 0, 30], [164, 186, 173], [255, 250, 239], [40, 57, 160], [255, 255, 255], [40, 36, 15], [255, 255, 255], [255, 255, 255], [234, 167, 27], [16, 7, 2], [228, 182, 96], [166, 190, 80], [248, 241, 223], [0, 0, 0], [254, 212, 74], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [2, 0, 0], [206, 194, 194], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [50, 194, 220], [0, 9, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 231, 40], [38, 37, 32], [255, 255, 255], [255, 255, 255], [255, 255, 255], [232, 207, 127], [255, 194, 152], [10, 10, 10], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 254, 0], [255, 255, 255], [255, 255, 255], [255, 66, 27], [255, 255, 255], [7, 6, 11], [255, 12, 107], [255, 255, 255], [255, 43, 0], [255, 255, 255], [255, 44, 34], [255, 255, 255], [255, 13, 39], [255, 255, 98], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 74, 87], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [18, 67, 225], [255, 0, 0], [255, 255, 255], [255, 0, 0], [255, 0, 0], [23, 18, 16], [255, 255, 255], [255, 255, 255], [255, 255, 255], [18, 156, 255], [255, 13, 16], [255, 255, 255], [255, 255, 255], [255, 255, 255], [4, 2, 3], [255, 255, 255], [255, 255, 255], [255, 255, 255], [29, 214, 255], [255, 255, 193], [255, 255, 0], [3, 7, 8], [255, 255, 255], [255, 255, 0], [255, 255, 255], [183, 17, 55], [255, 255, 255], [255, 255, 255], [255, 53, 68], [255, 255, 255], [255, 207, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [20, 18, 19], [32, 0, 0], [255, 13, 39], [0, 0, 0], [255, 255, 250], [255, 255, 255], [255, 255, 255], [255, 255, 255], [51, 35, 255], [48, 19, 16], [255, 255, 255], [0, 0, 0], [0, 0, 0], [183, 17, 55], [17, 21, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [18, 44, 255], [255, 0, 0], [29, 19, 18], [255, 47, 91], [255, 255, 255], [255, 255, 255], [18, 40, 53], [255, 255, 255], [0, 223, 171], [237, 22, 29], [255, 255, 255], [255, 255, 255], [255, 255, 255], [5, 9, 10], [255, 39, 0], [255, 255, 255], [255, 255, 255], [143, 27, 72], [183, 17, 55], [255, 255, 255], [19, 17, 20], [255, 255, 255], [255, 28, 0], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 17, 15], [255, 255, 255], [255, 7, 14], [255, 255, 255], [15, 37, 37], [255, 251, 239], [1, 1, 1], [1, 1, 1], [255, 29, 67], [255, 255, 255], [255, 255, 255], [255, 23, 39], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 22, 29], [255, 0, 0], [255, 255, 255], [42, 24, 23], [255, 255, 255], [248, 255, 255], [0, 0, 0], [0, 0, 0], [255, 79, 173], [0, 0, 0], [255, 236, 255], [255, 45, 39], [18, 20, 34], [255, 255, 255], [5, 6, 8], [255, 255, 13], [255, 250, 255], [255, 255, 255], [255, 255, 255], [255, 10, 10], [255, 16, 0], [255, 46, 49], [255, 255, 255], [44, 129, 196], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [55, 0, 147], [255, 255, 255], [168, 108, 78], [13, 15, 255], [0, 0, 0], [255, 0, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 16, 16], [255, 255, 255], [255, 255, 255], [248, 200, 216], [255, 255, 255], [57, 44, 0], [41, 45, 0], [255, 212, 59], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 133, 255], [0, 0, 0], [255, 255, 255], [33, 0, 255], [255, 255, 255], [255, 255, 255], [209, 153, 255], [18, 53, 9], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [129, 109, 51], [159, 137, 181], [255, 53, 96], [216, 216, 216], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 144, 255], [255, 255, 255], [255, 255, 255], [5, 6, 8], [255, 255, 255], [255, 255, 255], [5, 6, 8], [255, 255, 255], [255, 7, 0], [255, 255, 255], [255, 30, 0], [255, 255, 255], [255, 255, 255], [255, 16, 15], [255, 20, 20], [255, 255, 255], [255, 255, 255], [255, 255, 255], [69, 255, 255], [255, 255, 255], [0, 255, 0], [1, 149, 175], [255, 72, 69], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [243, 247, 255], [255, 255, 255], [18, 20, 255], [255, 255, 255], [255, 255, 255], [174, 136, 1], [255, 255, 255], [255, 255, 255], [255, 255, 255], [7, 6, 11], [183, 17, 55], [255, 30, 38], [255, 255, 255], [255, 189, 217], [255, 255, 255], [0, 161, 206], [255, 255, 255], [0, 218, 54], [0, 185, 181], [12, 33, 16], [255, 255, 255], [255, 255, 255], [0, 162, 228], [8, 8, 8], [199, 227, 248], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [3, 7, 8], [17, 19, 60], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [239, 229, 214], [255, 255, 255], [212, 212, 174], [166, 222, 204], [249, 249, 232], [255, 255, 255], [21, 101, 155], [255, 245, 227], [255, 0, 0], [0, 0, 0], [255, 255, 255], [255, 1, 0], [23, 117, 239], [0, 0, 0], [0, 47, 57], [5, 24, 30], [254, 255, 255], [255, 255, 255], [1, 1, 1], [255, 255, 255], [0, 195, 255], [168, 255, 152], [27, 17, 36], [7, 7, 7], [255, 255, 255], [246, 247, 249], [234, 203, 141], [0, 0, 0], [7, 9, 8], [7, 133, 156], [12, 13, 8], [255, 255, 255], [254, 242, 0], [205, 218, 224], [18, 20, 24], [0, 0, 0], [255, 255, 255], [0, 26, 38], [6, 24, 34], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [254, 254, 254], [255, 255, 255], [255, 255, 255], [27, 25, 0], [232, 232, 120], [255, 255, 255], [255, 255, 255], [8, 8, 24], [255, 255, 255], [49, 73, 111], [255, 255, 255], [16, 10, 22], [255, 255, 255], [255, 255, 255], [255, 255, 255], [92, 180, 226], [255, 255, 255], [242, 226, 200], [255, 229, 20], [58, 56, 59], [210, 210, 0], [255, 255, 255], [255, 255, 0], [6, 24, 0], [11, 11, 11], [0, 0, 0], [12, 13, 21], [255, 255, 42], [255, 255, 255], [21, 27, 43], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [0, 47, 57], [255, 255, 255], [255, 255, 255], [90, 198, 208], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 0], [8, 10, 9], [255, 255, 255], [227, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [203, 224, 167], [0, 0, 0], [255, 255, 255], [255, 255, 255], [1, 1, 1], [0, 0, 0], [255, 29, 17], [10, 6, 34], [255, 255, 255], [72, 73, 69], [255, 39, 255], [255, 255, 255], [13, 13, 13], [255, 255, 255], [16, 15, 13], [255, 255, 255], [0, 0, 0], [3, 7, 8], [1, 85, 0], [0, 29, 0], [255, 255, 255], [0, 0, 0], [3, 7, 8], [226, 244, 255], [102, 28, 33], [0, 0, 0], [47, 62, 67], [255, 255, 255], [65, 65, 65], [13, 10, 19], [34, 36, 35], [255, 255, 255], [255, 255, 255], [248, 113, 32], [0, 0, 0], [255, 255, 255], [0, 0, 0], [120, 20, 119], [0, 0, 0], [0, 0, 0], [255, 1, 0], [0, 113, 189], [255, 0, 16], [0, 0, 255], [255, 255, 255], [10, 12, 15], [255, 255, 255], [255, 255, 255], [32, 1, 0], [224, 210, 176], [0, 0, 0], [232, 23, 55], [252, 243, 225], [255, 255, 0], [255, 255, 0], [255, 255, 0], [255, 255, 255], [52, 16, 103], [0, 0, 0], [231, 99, 50], [0, 0, 0], [255, 255, 255], [255, 255, 255], [9, 8, 14], [0, 0, 0], [24, 21, 136], [255, 255, 255], [0, 0, 0], [255, 255, 255], [0, 0, 0], [23, 25, 63], [35, 29, 34], [0, 0, 0], [0, 255, 255], [255, 255, 255], [255, 252, 0], [14, 6, 0], [255, 255, 255], [3, 7, 8], [255, 255, 255], [16, 15, 13], [211, 32, 38], [255, 255, 255], [18, 20, 19], [0, 0, 0], [2, 0, 0], [255, 255, 255], [255, 255, 255], [136, 0, 0], [0, 8, 0], [0, 0, 0], [0, 0, 0], [3, 6, 8], [255, 170, 255], [255, 255, 0], [237, 242, 245], [38, 91, 169], [255, 255, 255], [66, 134, 199], [0, 9, 8], [255, 255, 255], [255, 255, 255], [255, 5, 25], [43, 46, 43], [251, 251, 251], [165, 207, 99], [255, 255, 255], [0, 0, 0], [228, 200, 152], [255, 255, 255], [0, 1, 0], [255, 255, 255], [255, 255, 255], [23, 146, 221], [255, 255, 255], [175, 147, 82], [27, 69, 143], [255, 255, 255], [0, 0, 0], [247, 247, 239], [24, 88, 168], [255, 255, 0], [240, 228, 212], [51, 42, 31], [238, 39, 34], [255, 255, 255], [255, 0, 0], [255, 255, 255], [17, 12, 9], [228, 216, 200], [231, 218, 208], [216, 152, 40], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [58, 162, 75], [255, 255, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [163, 147, 98], [255, 255, 0], [24, 20, 24], [255, 255, 255], [255, 255, 255], [251, 247, 236], [255, 251, 239], [214, 233, 237], [24, 57, 74], [43, 38, 42], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 12], [255, 255, 255], [0, 0, 0], [0, 0, 0], [137, 251, 123], [10, 10, 0], [255, 255, 0], [239, 236, 224], [255, 255, 255], [255, 255, 255], [255, 69, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [235, 244, 239], [0, 255, 255], [255, 0, 255], [255, 255, 255], [255, 254, 252], [255, 255, 255], [20, 20, 18], [0, 44, 65], [255, 255, 255], [255, 0, 0], [219, 6, 35], [0, 160, 216], [255, 255, 255], [0, 0, 0], [252, 252, 252], [205, 0, 0], [255, 255, 255], [0, 0, 0], [242, 217, 0], [0, 105, 45], [255, 255, 255], [255, 255, 0], [23, 66, 119], [255, 0, 177], [65, 40, 23], [255, 255, 255], [255, 255, 255], [22, 22, 24], [255, 255, 255], [221, 226, 231], [177, 51, 36], [255, 255, 255], [255, 255, 255], [61, 51, 47], [0, 237, 242], [120, 143, 149], [255, 0, 255], [255, 255, 255], [51, 105, 162], [223, 224, 229], [255, 255, 255], [38, 91, 169], [0, 0, 0], [199, 227, 248], [0, 0, 0], [255, 255, 255], [21, 120, 0], [7, 6, 4], [255, 255, 255], [255, 230, 0], [13, 9, 10], [0, 0, 255], [233, 0, 0], [0, 255, 255], [242, 242, 242], [191, 49, 45], [0, 255, 255], [229, 224, 26], [255, 255, 255], [0, 65, 0], [237, 27, 36], [255, 255, 255], [255, 255, 255], [12, 192, 106], [143, 218, 250], [255, 255, 255], [255, 255, 255], [0, 0, 0], [196, 196, 196], [253, 249, 246], [255, 0, 0], [255, 255, 255], [254, 254, 252], [0, 0, 0], [255, 254, 255], [255, 232, 167], [3, 7, 8], [255, 255, 255], [255, 255, 0], [247, 247, 247], [255, 255, 255], [255, 255, 255], [242, 146, 50], [153, 76, 64], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [247, 247, 239], [255, 255, 255], [242, 244, 239], [255, 255, 255], [4, 4, 4], [255, 85, 55], [255, 255, 66], [27, 255, 255], [0, 0, 0], [45, 224, 53], [60, 19, 17], [255, 255, 255], [1, 1, 1], [255, 255, 255], [0, 0, 0], [38, 255, 0], [196, 34, 58], [255, 255, 255], [26, 26, 27], [6, 7, 9], [111, 191, 70], [242, 249, 255], [255, 255, 255], [247, 36, 51], [175, 211, 36], [29, 20, 15], [206, 108, 43], [184, 168, 152], [127, 100, 73], [255, 255, 255], [22, 22, 24], [255, 255, 255], [255, 255, 255], [173, 28, 33], [23, 19, 18], [252, 43, 80], [0, 14, 41], [255, 253, 251], [255, 255, 255], [247, 245, 232], [43, 65, 78], [255, 255, 255], [255, 255, 223], [0, 83, 255], [255, 255, 255], [255, 0, 0], [255, 255, 255], [212, 225, 242], [41, 37, 38], [255, 255, 0], [255, 255, 255], [255, 255, 255], [255, 221, 0], [194, 29, 45], [242, 249, 255], [255, 255, 255], [226, 230, 0], [255, 255, 255], [0, 3, 5], [255, 215, 189], [1, 1, 1], [255, 255, 255], [255, 80, 34], [0, 0, 0], [255, 255, 255], [255, 255, 255], [18, 18, 18], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [247, 247, 221], [255, 255, 255], [255, 255, 255], [255, 255, 255], [39, 85, 136], [0, 0, 0], [250, 251, 194], [248, 248, 232], [16, 18, 17], [21, 27, 43], [255, 255, 255], [83, 83, 119], [255, 248, 255], [255, 29, 36], [8, 8, 10], [0, 35, 100], [248, 232, 200], [255, 255, 255], [207, 121, 108], [0, 23, 0], [84, 105, 159], [23, 21, 18], [6, 24, 0], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [232, 248, 232], [255, 255, 255], [230, 31, 41], [252, 202, 69], [248, 246, 234], [255, 0, 0], [255, 0, 0], [255, 5, 0], [255, 119, 50], [239, 229, 214], [255, 0, 0], [0, 0, 0], [255, 255, 255], [0, 87, 23], [94, 159, 186], [143, 216, 249], [16, 0, 0], [14, 18, 27], [247, 245, 230], [17, 12, 16], [255, 255, 255], [255, 152, 0], [255, 255, 255], [255, 255, 255], [255, 30, 47], [255, 255, 255], [0, 255, 255], [50, 52, 49], [254, 255, 255], [73, 3, 8], [8, 20, 8], [212, 212, 174], [0, 0, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255], [27, 27, 27], [255, 255, 255], [198, 191, 149], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [122, 144, 59], [255, 255, 255], [255, 255, 255], [251, 245, 223], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 28, 99], [0, 146, 43], [1, 0, 0], [255, 255, 255], [243, 118, 152], [255, 255, 255], [0, 9, 8], [254, 254, 242], [50, 42, 46], [223, 242, 212], [23, 28, 22], [19, 15, 12], [255, 255, 255], [252, 15, 9], [217, 87, 5], [0, 16, 18], [31, 148, 188], [28, 17, 20], [255, 255, 255], [69, 107, 123], [223, 227, 230], [243, 231, 215], [255, 255, 255], [108, 155, 137], [16, 16, 16], [255, 255, 255], [206, 19, 67], [255, 255, 255], [233, 245, 246], [255, 255, 255], [239, 242, 247], [198, 219, 213], [255, 255, 46], [187, 90, 73], [255, 14, 50], [255, 255, 255], [254, 255, 255], [168, 152, 152], [255, 255, 255], [76, 69, 70], [255, 255, 255], [255, 255, 255], [25, 27, 255], [255, 255, 255], [249, 247, 230], [248, 232, 184], [255, 255, 0], [0, 0, 0], [255, 255, 255], [255, 27, 26], [255, 255, 255], [214, 134, 83], [0, 255, 255], [3, 7, 8], [255, 219, 99], [255, 255, 255], [255, 255, 255], [12, 45, 109], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [47, 58, 105], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 0, 0], [25, 36, 255], [0, 0, 0], [255, 255, 255], [255, 239, 233], [0, 34, 255], [255, 255, 255], [110, 154, 137], [255, 255, 255], [237, 27, 0], [255, 255, 255], [211, 198, 240], [255, 255, 255], [7, 10, 21], [255, 255, 233], [255, 255, 255], [0, 255, 255], [1, 1, 1], [24, 40, 72], [0, 0, 0], [255, 255, 255], [255, 255, 255], [12, 11, 7], [2, 2, 2], [168, 136, 88], [228, 238, 255], [10, 10, 12], [255, 23, 22], [52, 39, 33], [5, 5, 5], [255, 255, 255], [153, 28, 31], [239, 239, 239], [255, 255, 255], [206, 206, 228], [255, 255, 255], [255, 246, 215], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [254, 255, 255], [254, 254, 252], [255, 40, 78], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 0], [248, 243, 247], [252, 223, 9], [166, 71, 101], [255, 255, 255], [35, 31, 32], [255, 255, 255], [226, 32, 43], [0, 0, 0], [253, 253, 251], [255, 255, 255], [253, 255, 216], [165, 70, 154], [255, 66, 19], [0, 4, 0], [38, 37, 32], [0, 0, 0], [0, 233, 0], [127, 27, 27], [49, 73, 111], [255, 0, 0], [227, 239, 217], [12, 25, 34], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 121, 194], [255, 255, 255], [255, 255, 255], [152, 200, 72], [2, 2, 2], [255, 255, 255], [255, 255, 255], [242, 241, 228], [242, 242, 242], [255, 255, 255], [0, 0, 0], [255, 255, 255], [236, 235, 13], [255, 255, 255], [255, 255, 255], [207, 198, 181], [197, 219, 224], [255, 255, 255], [0, 139, 204], [255, 255, 255], [255, 255, 40], [255, 16, 255], [254, 255, 255], [24, 21, 16], [18, 13, 10], [255, 202, 255], [0, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 147, 255], [246, 245, 251], [255, 255, 255], [255, 248, 232], [255, 250, 251], [255, 255, 255], [255, 255, 255], [248, 247, 217], [255, 255, 255], [255, 255, 255], [234, 235, 254], [255, 254, 224], [22, 23, 27], [0, 0, 0], [51, 31, 30], [255, 228, 124], [0, 0, 0], [253, 252, 248], [255, 255, 255], [255, 255, 241], [8, 24, 8], [255, 1, 0], [255, 255, 255], [255, 255, 255], [128, 50, 64], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [0, 1, 22], [255, 255, 255], [241, 246, 0], [90, 95, 124], [255, 255, 255], [252, 243, 225], [27, 35, 97], [0, 0, 0], [229, 228, 224], [255, 255, 255], [255, 255, 0], [232, 201, 33], [143, 28, 19], [0, 0, 0], [255, 255, 255], [255, 255, 255], [176, 29, 45], [0, 193, 0], [255, 255, 255], [255, 255, 255], [31, 21, 21], [47, 17, 15], [255, 46, 49], [35, 64, 142], [193, 173, 187], [0, 1, 94], [40, 40, 40], [99, 187, 74], [52, 16, 103], [255, 255, 255], [255, 255, 255], [0, 6, 17], [255, 255, 255], [114, 36, 49], [0, 0, 0], [255, 255, 255], [96, 130, 132], [255, 255, 255], [255, 255, 255], [255, 255, 255], [240, 149, 192], [125, 166, 217], [238, 0, 255], [237, 204, 89], [255, 255, 255], [255, 255, 255], [243, 227, 227], [0, 22, 0], [255, 255, 255], [250, 254, 255], [0, 0, 0], [248, 215, 124], [255, 255, 255], [244, 241, 255], [255, 255, 255], [24, 24, 24], [255, 255, 255], [120, 56, 104], [14, 14, 14], [255, 255, 255], [40, 40, 88], [255, 255, 255], [161, 29, 139], [255, 255, 255], [0, 0, 0], [75, 77, 81], [248, 65, 67], [231, 67, 39], [247, 245, 0], [255, 255, 255], [255, 0, 0], [0, 0, 0], [255, 255, 255], [255, 255, 255], [245, 28, 213], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [216, 216, 216], [255, 255, 255], [255, 255, 221], [255, 255, 255], [255, 255, 255], [255, 255, 255], [254, 255, 255], [255, 212, 59], [156, 32, 34], [255, 255, 255], [33, 0, 255], [255, 255, 255], [255, 0, 0], [1, 3, 2], [48, 111, 67], [165, 212, 232], [0, 0, 0], [255, 255, 255], [0, 0, 0], [0, 0, 0], [255, 255, 255], [248, 88, 40], [133, 116, 72], [255, 255, 255], [127, 147, 158], [250, 228, 181], [108, 155, 137], [255, 255, 255], [105, 115, 196], [10, 10, 10], [23, 32, 49], [6, 8, 7], [28, 74, 59], [255, 14, 0], [255, 255, 82], [255, 255, 255], [255, 255, 255], [35, 37, 32], [99, 74, 159], [255, 255, 255], [244, 244, 246], [0, 0, 0], [18, 13, 8], [211, 31, 32], [0, 0, 0], [0, 0, 0], [164, 188, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255], [255, 255, 255], [238, 217, 0], [205, 144, 55], [0, 209, 205], [0, 195, 255], [254, 255, 255], [255, 231, 225], [255, 255, 255], [255, 255, 255], [255, 255, 36], [250, 244, 255], [255, 255, 255], [255, 255, 255], [253, 179, 22], [5, 6, 8], [143, 19, 81], [255, 76, 60], [0, 0, 37], [255, 102, 255], [239, 246, 230], [248, 248, 216], [255, 230, 200], [255, 255, 255], [4, 5, 0], [1, 1, 0], [16, 18, 16], [255, 255, 255], [41, 31, 22], [106, 46, 44], [255, 255, 255], [255, 255, 255], [255, 30, 25], [255, 255, 255], [22, 22, 22], [198, 170, 255], [0, 141, 255], [222, 243, 246], [0, 9, 8], [33, 37, 24], [8, 0, 0], [255, 255, 255], [0, 0, 0], [10, 9, 23], [251, 244, 228], [234, 167, 27], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 0, 0], [0, 0, 0], [255, 255, 255], [227, 231, 236], [255, 255, 255], [255, 255, 255], [254, 212, 74], [255, 255, 255], [11, 12, 14], [0, 2, 1], [166, 30, 34], [12, 31, 149], [48, 29, 15], [255, 70, 0], [255, 255, 255], [255, 255, 255], [251, 251, 243], [255, 255, 255], [255, 232, 236], [255, 37, 124], [255, 255, 255], [253, 239, 46], [255, 8, 7], [0, 0, 0], [246, 246, 245], [120, 1, 33], [255, 255, 255], [25, 24, 20], [255, 255, 255], [255, 41, 0], [200, 218, 247], [105, 162, 83], [0, 121, 194], [243, 162, 238], [255, 255, 255], [255, 29, 255], [255, 255, 255], [16, 16, 18], [255, 255, 255], [255, 251, 255], [255, 255, 255], [45, 75, 165], [0, 1, 1], [255, 255, 255], [12, 255, 255], [0, 0, 0], [4, 5, 9], [255, 255, 255], [255, 255, 255], [255, 255, 255], [246, 226, 153], [253, 255, 254], [0, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [190, 134, 183], [32, 30, 70], [255, 255, 255], [35, 31, 32], [79, 62, 140], [19, 15, 12], [22, 24, 23], [255, 234, 232], [255, 255, 255], [36, 54, 139], [0, 1, 6], [0, 0, 0], [255, 255, 255], [255, 255, 255], [211, 53, 44], [255, 255, 255], [241, 241, 240], [0, 1, 3], [255, 255, 255], [15, 14, 12], [242, 225, 216], [255, 255, 255], [197, 172, 155], [216, 40, 72], [255, 255, 255], [50, 68, 148], [247, 154, 160], [0, 0, 0], [255, 255, 255], [228, 25, 55], [250, 152, 29], [255, 0, 0], [252, 191, 23], [162, 204, 233], [252, 191, 23], [255, 255, 255], [245, 130, 32], [0, 0, 0], [255, 0, 0], [0, 195, 124], [252, 191, 23], [255, 242, 0], [248, 170, 166], [89, 97, 198], [117, 188, 234], [237, 25, 47], [228, 25, 55], [41, 42, 46], [41, 27, 160], [128, 202, 45], [236, 236, 236], [228, 25, 55], [244, 243, 239], [35, 31, 32], [255, 255, 255], [255, 154, 159], [0, 0, 121], [219, 232, 153], [0, 0, 0], [238, 23, 54], [255, 255, 255], [255, 248, 0], [254, 232, 1], [252, 191, 23], [255, 255, 255], [247, 19, 22], [255, 255, 255], [252, 191, 23], [0, 199, 239], [251, 229, 179], [255, 32, 41], [0, 123, 94], [0, 0, 0], [2, 122, 94], [255, 255, 255], [228, 25, 55], [255, 255, 255], [228, 25, 55], [255, 255, 255], [228, 25, 55], [250, 237, 0], [0, 0, 0], [89, 145, 48], [255, 0, 0], [35, 31, 32], [228, 24, 55], [251, 248, 237], [2, 122, 94], [0, 0, 0], [255, 251, 222], [252, 31, 32], [17, 12, 9], [251, 122, 94], [253, 220, 43], [159, 157, 133], [255, 255, 255], [118, 179, 207], [51, 52, 54], [255, 255, 255], [244, 219, 12], [35, 31, 32], [75, 124, 191], [194, 223, 165], [43, 44, 46], [228, 25, 55], [255, 255, 255], [246, 154, 0], [150, 0, 0], [255, 255, 0], [2, 122, 94], [0, 168, 142], [255, 0, 0], [35, 31, 32], [251, 191, 22], [20, 18, 17], [0, 0, 0], [118, 6, 116], [247, 154, 160], [252, 191, 23], [252, 191, 23], [34, 24, 23], [255, 22, 20], [16, 15, 13], [251, 191, 22], [252, 191, 23], [51, 123, 173], [250, 200, 53], [71, 1, 4], [48, 68, 159], [254, 242, 0], [35, 31, 32], [0, 108, 166], [2, 122, 94], [255, 255, 255], [175, 184, 29], [180, 127, 59], [255, 197, 38], [252, 191, 23], [255, 255, 255], [85, 255, 214], [35, 31, 32], [33, 57, 94], [20, 18, 23], [8, 56, 136], [68, 72, 78], [255, 255, 255], [255, 255, 255], [49, 53, 57], [255, 255, 255], [251, 191, 22], [245, 245, 233], [128, 100, 184], [0, 238, 231], [232, 235, 154], [255, 72, 0], [35, 31, 32], [0, 0, 0], [255, 255, 255], [19, 74, 105], [43, 39, 45], [220, 171, 76], [228, 25, 55], [42, 89, 174], [224, 61, 78], [255, 231, 255], [248, 243, 247], [228, 25, 55], [252, 31, 32], [187, 25, 49], [232, 152, 56], [39, 0, 0], [255, 255, 255], [251, 191, 22], [0, 185, 74], [252, 191, 23], [239, 23, 34], [255, 255, 255], [37, 26, 21], [0, 0, 0], [255, 255, 255], [0, 102, 156], [252, 191, 23], [35, 29, 29], [65, 106, 188], [251, 191, 22], [228, 25, 55], [255, 255, 255], [24, 23, 0], [255, 255, 255], [101, 140, 21], [255, 255, 255], [99, 155, 105], [252, 191, 23], [255, 255, 255], [2, 122, 94], [247, 154, 160], [255, 255, 255], [170, 86, 173], [255, 241, 228], [255, 255, 255], [255, 255, 255], [186, 21, 27], [17, 16, 14], [255, 255, 255], [228, 25, 55], [210, 210, 201], [254, 254, 254], [252, 191, 23], [255, 255, 255], [255, 255, 255], [255, 255, 255], [247, 203, 16], [8, 56, 136], [35, 31, 32], [16, 15, 13], [252, 191, 23], [132, 255, 80], [255, 255, 255], [255, 0, 0], [154, 28, 32], [2, 122, 94], [52, 55, 56], [4, 8, 11], [252, 191, 23], [252, 191, 23], [139, 3, 5], [2, 122, 94], [228, 25, 55], [0, 0, 0], [242, 242, 242], [61, 137, 163], [0, 25, 55], [255, 255, 255], [255, 255, 255], [219, 220, 185], [252, 191, 23], [255, 255, 255], [255, 0, 5], [0, 123, 94], [31, 35, 164], [243, 244, 246], [255, 255, 72], [170, 19, 26], [228, 25, 55], [8, 56, 136], [228, 25, 55], [251, 191, 22], [220, 213, 94], [184, 224, 229], [255, 255, 255], [8, 56, 136], [0, 122, 94], [120, 153, 108], [189, 219, 255], [255, 255, 255], [252, 191, 23], [255, 255, 255], [228, 25, 55], [217, 226, 201], [255, 255, 255], [0, 143, 76], [35, 31, 32], [228, 25, 55], [252, 191, 23], [0, 123, 94], [255, 255, 255], [252, 191, 23], [255, 255, 255], [255, 255, 0], [255, 255, 255], [0, 212, 190], [0, 122, 94], [0, 123, 94], [246, 154, 159], [255, 255, 255], [242, 226, 200], [0, 239, 248], [8, 56, 136], [0, 0, 0], [255, 255, 255], [16, 15, 13], [248, 232, 232], [35, 15, 14], [228, 25, 55], [255, 255, 255], [67, 178, 60], [255, 255, 0], [255, 255, 255], [255, 154, 160], [0, 0, 0], [228, 0, 0], [252, 191, 23], [255, 255, 255], [8, 56, 136], [0, 168, 142], [247, 215, 228], [0, 0, 0], [102, 103, 105], [255, 255, 255], [255, 255, 251], [0, 0, 0], [255, 255, 255], [255, 247, 255], [252, 31, 32], [39, 43, 44], [231, 30, 38], [224, 76, 25], [254, 254, 254], [255, 255, 255], [255, 255, 255], [255, 255, 255], [252, 191, 23], [0, 25, 27], [255, 255, 255], [104, 200, 232], [247, 154, 160], [21, 21, 23], [210, 16, 66], [228, 25, 55], [255, 154, 88], [0, 0, 0], [255, 255, 255], [255, 255, 255], [252, 191, 23], [252, 191, 23], [255, 255, 255], [252, 191, 23], [30, 68, 53], [0, 0, 0], [255, 255, 255], [189, 136, 52], [228, 25, 55], [2, 122, 94], [0, 0, 0], [126, 206, 81], [231, 216, 197], [43, 45, 44], [179, 202, 105], [255, 255, 255], [0, 0, 0], [228, 25, 55], [228, 25, 55], [241, 236, 53], [255, 82, 71], [255, 255, 255], [65, 174, 255], [0, 0, 0], [0, 248, 245], [252, 191, 23], [255, 255, 255], [252, 191, 23], [0, 0, 0], [255, 255, 191], [228, 25, 55], [2, 122, 94], [8, 56, 136], [0, 0, 0], [252, 191, 23], [255, 255, 255], [255, 255, 255], [161, 29, 42], [33, 31, 21], [252, 191, 23], [8, 56, 136], [36, 27, 10], [255, 255, 255], [0, 0, 0]]';});
define('text!dat/mahog/data/ids.json', function () { return '["-Ac81W-ZQDEC", "-sFkv-rGTJYC", "07LTDdpMZfYC", "0gLzGn-LYAQC", "1_BxUHJbK-8C", "1eVAVRRUnkAC", "1rW-QpIAs8UC", "2F1FheWJnhYC", "2T1NZUUM5JYC", "3_bJKlAOecEC", "3riJYW4TMeAC", "4e_QO0lA0FEC", "4lMynL91Mw4C", "53-gp__-Ni0C", "5sZdIZ0GBJ4C", "7-JfDlNcvhEC", "7VWZRVvoE0MC", "8QzD1qRZ3f0C", "9Oj3zPOMoiEC", "9z-9ufun9G4C", "a-apCPdumpsC", "ae89cJhLYJ4C", "afCxg5sogvAC", "AZ5J6B1-4BoC", "BATd_O0z-r0C", "btpIkZ6X6egC", "C-xXxfEAnzQC", "CYYnmQwmT2QC", "D79cOmmeQr8C", "dCq_E2MSODcC", "deaRm0KqhhsC", "dFlImpewmqUC", "dLo_GyEykjQC", "DpqPwAk8UvYC", "dxumVrUrpYcC", "dxXAi7rcRwEC", "ekJA6MZoH40C", "Eok8kGCq9rEC", "epDlSPRlP64C", "FEL8DlqjYEkC", "FN5wMOZKTYMC", "fnkCJBTdJekC", "FRx9Z-8oLKkC", "GKPktrYG7sUC", "Gqo5IlbVj2MC", "gszyGuchgQkC", "HpydZ7Xl1xwC", "IciSK2hKiQ4C", "injpY-EerZgC", "Iw_gHtk4ghYC", "JHxxM6mOAAQC", "KcOo6u5EKR8C", "kcsqGna7fBIC", "kEH1Js5RC_8C", "KosqNyzeyccC", "KPP6PhKAJgMC", "kSpQvfX1BSoC", "LBBhikJpLjwC", "lGS9Lbv0PdsC", "mAiJ8a_vk3QC", "Nhe2yvx6hP8C", "OfF0qpEoSrsC", "Ojqi8KbWuLwC", "PFYBPAS3LIEC", "qE2FPaaAa6wC", "RAUKBvP5OfgC", "rIj5x-C7D2cC", "rKq8bnUK3WoC", "rPoBYx7hRB4C", "rXeG6ivbdIcC", "sfC0p0Y9wY8C", "sTuE1RX6G7sC", "SWZ4FCf3LiQC", "T0u3mLgB7Q8C", "T5UpCOVOJboC", "tDi1X___kA8C", "TG5DXNXv2tAC", "Tu_2B0XdSW4C", "txhd-EAf4aoC", "ucpxOA3LDWcC", "uUenyaHxJfMC", "UvK1Slvkz3MC", "v2CrBj-MSg4C", "vRY8uYQUjDwC", "vzXz40IXEpIC", "W_5-RKxftbcC", "WcIJcNFzgqgC", "whdtOuA58e0C", "woDUFtbms-4C", "wQKyLoDT1RUC", "WrL9de30FDMC", "X4Z-6_UjUK8C", "yBDBEGBIUmgC", "Yz8Fnw0PlEQC", "z90HnZYAt20C", "ZfiREZrremoC", "ZfjzX7M8zt0C", "Ztp-cUw0jowC", "-3jZOkEF4hgC", "-Hw78nmNNhIC", "-o_a6Wh0hgEC", "0NP8hnGNjAsC", "0tQjH8yzrdcC", "0w2UpJzBamoC", "1amOE2BYvIYC", "1Mi8DZxNQEYC", "1MiZBNgHeawC", "1O3wuV4QBEAC", "1Qgt4oyMwJQC", "1qPnYFOtQC8C", "1T39-GfAWrUC", "1tqRGIihqw8C", "22p0JuQjciUC", "2CHxMUO08SAC", "2CU0N01MKq8C", "2jNwYjcIK6IC", "2JQW8SeseLQC", "2KERPNCkMC8C", "2KXCdI-p8xwC", "40eRknMj7W8C", "4kLJkLerSaAC", "4w0mcCMQfFoC", "58whfHOwXd4C", "5GjvwsQaJpsC", "5IH75VXZxU4C", "5NDU_8ntroUC", "5Oe6sjt3SWMC", "5rF_31RVTnMC", "5ta4u1iljDQC", "6-8joI_R2DsC", "60HJ7NklOGMC", "6BObU0ITL2MC", "6HDSdJtYpj0C", "6l2jAyf5IYsC", "6rfN-GeNlFgC", "74DRCVfzqkgC", "7A97laKeCecC", "7BUf0xhBN8EC", "7VWZRVvoE0MC", "86J0F9GsOAcC", "8fp1A2s6aQwC", "8jWTiB4UdQAC", "8QzD1qRZ3f0C", "8yD6wK7jE4gC", "94IMznRSTBcC", "9hvD2_TY0OUC", "9IQFh2qW9b0C", "9nFwTXKoS6gC", "9OgS6ILrV_8C", "9STXZ76dtkwC", "9WH1XR0NT0kC", "_am5au812vwC", "_M5RkbOs2EsC", "_MAXmVxrdasC", "_Q313x93xVIC", "_RWp0PuQ28wC", "_VXG8DuU830C", "_zr2nmsI0lUC", "a2iAh-KFdIgC", "Acvu5r1bmtIC", "afCxg5sogvAC", "auZXJuwLw8QC", "Aw4tOs-x85YC", "bFw4OjbdPdMC", "BNZ2-nzmQ_EC", "bQidDvWJsAUC", "BS6sAEtuuqYC", "BtNheyB7b_sC", "BvRtL2-qGC4C", "BZopNYe5-qcC", "c8WH6c7_RP4C", "CbJvlgHtDyMC", "CdvXLjqAcccC", "cfi0mLqWXGoC", "cl9kgQmqj54C", "cocVLbFkgyQC", "cQ0ciqF3F5gC", "CqjBCWV6Eu4C", "cr5TUCKGQ9YC", "cWWzQTVn6eoC", "CzEy6ernA3oC", "D4MTMYK4X6wC", "D5H6yvflq-wC", "D7_rJYZSi-sC", "DA3SRxogVOwC", "DDAg0LOkCjUC", "DduYXMlXgPgC", "deaRm0KqhhsC", "dELO9Pc3P50C", "Dga98586A0YC", "dKIo6D9yh3cC", "dOpZTJRfF04C", "DUcbyaGlYo4C", "dyNsQeKZ8hIC", "DZSFP5eMhDgC", "EaLYoCPqjrUC", "earytjxi6pEC", "EbquUB1D6B8C", "egD6t5_Hs_gC", "EQxgH5qLw3UC", "eTi6u-MS12kC", "eubyMCDFlu4C", "Ev4JvCyTfLkC", "evgsqlBVqr4C", "ezFPVu1MvaMC", "F5Y_QjkEu1UC", "F64IvLLwzM0C", "FCetHOb2j-MC", "Fdi-l1CsLSsC", "FIqEEO1Kc1EC", "fMtXDt1tS_EC", "fNl1sklg5RwC", "fs-cTvIegLgC", "fT8mMCUDlsMC", "FXPtglTFvKIC", "G0LZTx33-x0C", "g3x29UP5gnsC", "g44Fodu8NbAC", "G8GOS2_QwM8C", "g_1wN2RzTlcC", "GJG2O78xdbkC", "gLtfEvtrkCgC", "GoV9Aha9IhQC", "gsmalZyiNoYC", "gt7EQgH8-b4C", "gWu8_LXO6A8C", "GZWabG2SWj0C", "h6Yrv7Sixi4C", "hAWbMy0IvkkC", "HcDMKrh-_fEC", "HGnopNYgga4C", "hKzjNMFba5gC", "hR1beTwTgM8C", "hyeAO1KHjQoC", "i2Gfu-algOwC", "IDKNVdWVMlEC", "ifc8QVdWijMC", "iILGWUvHUpcC", "injpY-EerZgC", "IPJhaDPuGw8C", "itSPLM6udREC", "iUVuTbWUfQcC", "iWJsOlQvArIC", "ixaluvF7Mx8C", "j57S7Eo23kEC", "jhZ8R7lF_NcC", "jrOm0PEAQzMC", "JryN4EWam6gC", "jUW_qLMB9E0C", "jwjXltLIqRoC", "JwPsDrGz2oEC", "jYy2laAs_Q8C", "KD40sIOJ-SYC", "KF3fzxVYlpMC", "KosqNyzeyccC", "kV8Q3AiF14EC", "KvC7l-lo_JEC", "KVEq58n6iF8C", "KxLe4Y5_VqcC", "kXSKAfy5cQYC", "kyGTagqcyAcC", "l5WUWamxMGMC", "LBBhikJpLjwC", "lez8urgN7IsC", "LIoERdpnFUQC", "lj5woI0AjhsC", "lYgxhcsR8NYC", "MAyXHjLS7rEC", "MeO8b6S9lb4C", "mJ7-gzmDRo8C", "mJcOgKNGvzUC", "MKKPFqc3WqYC", "mNxe-SD0Qi0C", "mp6P88ff1YEC", "mpEBZLxaLJQC", "mRX160l72-UC", "n7eJZppCVjAC", "n856VkLmF34C", "n8jS9Wlgs24C", "n9IewwIPn-kC", "nej0pO6KHP4C", "nEjXAmEBAi8C", "nI3JXcSjvwsC", "NliRGM79z0sC", "NN5iI9oO3N0C", "O0WZTnDSDjMC", "oB4CDtS6N-8C", "oGseFpi7QG0C", "OmUJebLiytYC", "Oo-TBV4ezYMC", "OrJOvJljhNAC", "OyM3-IXdmJwC", "P7yZUMBcbxAC", "paSe7yZGUfEC", "pCP2VfWmEYwC", "PlnanYWr_lYC", "pUscmtndV7YC", "pWmV5Vx3cPwC", "Q9D80kbsKZ4C", "QKelKi8I-9YC", "qkubqKS3gagC", "qVmMyvApJHAC", "Qy7g-reIgaQC", "r3dgkm70ECEC", "R5Aczn9EZ4MC", "r7y3WIpuCD4C", "rA3Th92pTT0C", "RAw0oLs5os0C", "RC0iwqo53EgC", "Rhfi5GXwg60C", "RIPdMkiKipMC", "rjaedm_VqgAC", "RkiBDiK1b4IC", "rMrTE_JoI1QC", "rRQ-ln-SYnMC", "RtuUTyHr-5wC", "rUSEaBvq5sIC", "RW-mWK_XYZ4C", "s-IKDw_xNO4C", "s0YrhxJVw68C", "S1aY04SCeCcC", "SRFbLHcl808C", "sSLJnGMUw9wC", "sV2Zne7PFboC", "T-lmcZL_bXIC", "T53iIqrOcbIC", "t9QNVpO7X14C", "TNu0c8XiHc4C", "ToEsz_C6UsYC", "ts0EsIYrVc4C", "tU_CAUXWpCsC", "TXnD5iuM6DkC", "TYHPLULRAtAC", "u6_s98dIm30C", "uBJebCyhhmgC", "udN6caZEJesC", "UKdIMjjZDO0C", "uMq7puR-NrAC", "Up4x7U20ZVUC", "UPm7Nlxg-O8C", "uvr8XVTzrNcC", "vHx4ceDLapAC", "vyFFdl-1m-AC", "W8uJGI8se_QC", "wGgmGnc2TrEC", "WGqj5MIQ1KgC", "WhqeFP8kcOYC", "WjlMfoNKZoYC", "wlz-PwfSIdMC", "Wnc3V5m9kqgC", "wP22JQd-IjkC", "wQcMDdFC1QEC", "WrDB5XZbXZEC", "Wx00mzMRGH8C", "wYbOlD2Q_lwC", "WZEAkY1LdtAC", "XaozCbxSFbsC", "Xg-KfK7aFgcC", "xLx9wXQiHEwC", "xOi8USrW6M0C", "xv7381O0EskC", "YAv9Gv9ZIbcC", "YdtPYQHlJJIC", "Yf2UK6QUeAwC", "yHFQe17yggIC", "YLjHJNVZLnkC", "yoEZgkQxmsIC", "ySFeBcfG8AUC", "Yso319xUOF8C", "ytc1dnTiXUkC", "YuCyFqLYjyoC", "YUzwlDHiHPQC", "YV0IskcivVIC", "z-14BurnRNYC", "Z93OvsN2yq8C", "zbAJykg_ncAC", "zF6v7bX__SQC", "ZgVbSPYVs5sC", "ZI2qm9s7sZsC", "ZK8DGepq9DMC", "Zp_b7CdQnzwC", "-30E6Pjp4dwC", "-ydNYWGIussC", "0KIU3WhvK-gC", "1BnQaxG0YSUC", "1e_JFkI3DPMC", "1rW-QpIAs8UC", "26SwHFQblXwC", "2RB3j_YfEg0C", "2VEHl6rp1mAC", "2ZAptMWcCdwC", "3H2Xg5qxz-8C", "3NSImqqnxnkC", "3zWhu92ME1sC", "4-VCagWoBGAC", "4psb688KSskC", "4Z697q04X9wC", "5NfZvS8gCeQC", "66Dm4p1wxqUC", "7-uxOdOgbYwC", "7Ga0TEYaScIC", "7NeZeQ6qHq4C", "7NH5yNWMCFEC", "7X3JPMMPqYMC", "82-zKnPHa9YC", "8KFpjnioTW0C", "8Nc8FhxNF8IC", "8TyZAoyMiDsC", "92smAMgJiMUC", "9ne3r2XzbzEC", "_LhvHY7GACsC", "A3snVoXwD6oC", "ak5fLB24ircC", "akhuVP5NY-kC", "AmRxT9mHfkwC", "aWaehpOG8voC", "BmPPAjGaDuQC", "BVLBu5QR5YMC", "c-3MsLNC-vkC", "ceYlEs6gT3QC", "COJVopOZblIC", "cR2nhrCzyWwC", "d0tFXQur-q0C", "DCqFYOrGyegC", "dI66B5IY2X0C", "dIGizhIvCfcC", "dxumVrUrpYcC", "eoy-khRFxGUC", "eParwQ0YdrcC", "EZH-cSO-UkoC", "F21-T-BYprQC", "FFgY7hnWOWsC", "fH075AmvTVUC", "g0pn1ambbgkC", "G2AaD6PvdsMC", "G_GbZ6rDUrsC", "gHmb9E-w88kC", "gkaUu__vNDQC", "gKYeYvWpapQC", "GQIbnp4yQJEC", "Gqz3UF5FbI0C", "GVchqY1ZaB0C", "gZMTo93ZZtwC", "h2WTgw_Qs4kC", "h7NewH-XWgUC", "HGDhybuy45sC", "hsuhaO3oQ0kC", "i5lD4Y6Sbm0C", "Ia0W1gg3aqYC", "ib9Xzb5eFGQC", "iC-NUBtuGeQC", "ifocmqVPHUwC", "iLxklckK4tsC", "iM6sos2U554C", "in7BSJlU7z4C", "iykLVJAK49kC", "IzzooXGE6GgC", "jBFmkR5xy7UC", "JklJ0ZoJtmAC", "jNa10OYRlpsC", "JRzC5Z6wyLYC", "k-dTFB0B5CUC", "k0P11ZxGN3QC", "k7vW_dRCS3UC", "ka7VEMoenmMC", "kF26e_S6l_cC", "KF3fzxVYlpMC", "KZ227__Vyl8C", "l0qEwNqmRgcC", "L1j8ZO73fNgC", "lbOkUCVNSPoC", "lH4Mjm1YcakC", "LiC2foFeXQYC", "lNJ93YBrpzoC", "mfaoT7klxX0C", "mjasWuJANoYC", "mPfE_-GTAEsC", "Ms_VAVC4IJ0C", "n19OZlQi0NwC", "nEcVIiToC8kC", "np1RwDQfpjsC", "NuoltFFAIzUC", "oaQ9zYKu0qoC", "oFTYD9IHX5YC", "oILn8Im-GbsC", "oQoNLVqZzQYC", "oSsIfoDQHhgC", "oSXEwOdkpmAC", "p1hd3kN0odgC", "PG0ndz-nmywC", "PGMnEr9dLUoC", "PjeTO822t_4C", "poWks_q7X_oC", "q3XIFK4zQQcC", "qg61T_I1mwsC", "QgzBqhbdlvUC", "qJQ1BU83XQkC", "qR-d465uX3cC", "r23bFouhu1MC", "RiH9CEQZcOMC", "rJiV1q1SDHcC", "ro7X8HRyuEIC", "rPka_QG6Fp0C", "RRUkLhyGZVgC", "s6NB6m1nAK8C", "s9QEjj3Lx30C", "SfAgn7KXggIC", "SIexi_qgq2gC", "silrVTw9E2sC", "SvVb8TvuqEAC", "TyPO2Feqjf4C", "U77um_h_dgcC", "UglRu-CK0M0C", "UNxU-2s2sQYC", "UzRHdy2GTx0C", "vbGoBIu8UQAC", "vE5MERHPBU0C", "vmv3ZUg1UJUC", "VRFqzM3XB3oC", "wCnHmQnPNmwC", "wgCCzO5N4HkC", "x3IcNujwHxcC", "xCAD8ashi_UC", "xM7Yo1r1PhIC", "xmYBTQcF1TsC", "xQo7DTj-YnMC", "xqyj-xnch2AC", "xWjTZhw1MiUC", "yBDBEGBIUmgC", "YkHn8ogq9JMC", "yNFN1OpnkBkC", "YoVpW0zJIgYC", "YOVuQFXNcP4C", "yv5tR54Qs6sC", "Z1AJB-S8RK4C", "ZjYP5o18qQUC", "Zr6K7pxtc80C", "ZV-GPw5BYq0C", "-a6JfQ3qd0AC", "-aySX6b8FSoC", "-tRVlibWwrAC", "-ZacVHw7QhkC", "05capLEO2ygC", "07LTDdpMZfYC", "0JMqA3_JQ30C", "19vnyvh6Y8IC", "1HLKgQCccTsC", "370LF2kzw1UC", "5IaLGlxtqsAC", "6gfDfhmmHxMC", "6SF-8gmg_BcC", "7N_nmMFx98oC", "8H8WfZ_AyU8C", "8yG5UrYMQ-0C", "9wjlOC_WhHYC", "9yN1btNTj0IC", "_-xSfyrwxuYC", "_JDJ0H4BIzIC", "a2iAh-KFdIgC", "aaP4yQW2S9IC", "Bi4Z_-GmydcC", "BjOQVyNQLD0C", "c1wnePZ6wmcC", "c20ilAa3EMYC", "c3U-w4cqIMUC", "c5oks2yFukUC", "cFBUx1i73X8C", "ChLZ2Mdpdr8C", "CYYnmQwmT2QC", "DIxJQdDgS0QC", "dkYP9xtzUWQC", "E2TZw2z0MvUC", "Et9gd7otqj8C", "F5bpJ9vZhfwC", "fCunxPYp_OAC", "FN5wMOZKTYMC", "FWGsyxSc8ccC", "fzUyn3NCsZcC", "g63GBF-KPC4C", "GiFUTD1su7gC", "GxfgPMXA7SQC", "h7TLfHTGRMEC", "Hc_rTXEjeWsC", "Hjn8usbgSOwC", "hlJbtjEy7UYC", "iaHHHT4sa1MC", "IAuxsiYEdIUC", "IGRT4SQmq2AC", "iOpmCbDoyGgC", "Iu8XmX2xYXgC", "iUVuTbWUfQcC", "Iw_gHtk4ghYC", "j7YmVKxMJxQC", "jeCiIfB7da0C", "jHmjvIR9xZkC", "JjDVJGxtVqsC", "JrPYwt8yMokC", "JuG4iVilH3YC", "k9t-NCdfNH4C", "kAA7M72tFHcC", "kcsqGna7fBIC", "KIxo3jxM8b0C", "kSpQvfX1BSoC", "LaXY4ArFPgwC", "lw99Oii9R90C", "M-IRbSratpYC", "M1AUC4TY4u0C", "mBnlTKOVhi8C", "MmJeXfkFNKwC", "mRF4H71Bwd0C", "MRk0e0H27-oC", "MtNQKRG6jZ8C", "mTsznApVyEwC", "niZRM7N-1yUC", "NLGfv0jAgtgC", "NmF3c2A5k00C", "nu5L8RtxQ1kC", "NwwtNg5Xo4QC", "oI3sT-JddJQC", "orLvFmeh9JcC", "OtZGZNMHUA4C", "OYC_9Vlzcd4C", "P29bv8K6lXAC", "p8kbFmwUsdgC", "Q7Jk307w-XkC", "Q8g3Vx41ePwC", "QE364RkPna0C", "QmQiz87q0OkC", "Rdwosb3edv8C", "rKby_-We-AQC", "RsAz01zeAOgC", "rTyiMVQ105kC", "rY6NA51PBfYC", "s8rfmpJ0yYIC", "Sb8QwBX1rJsC", "sbiC0dSqrY0C", "sBPk89_MbRwC", "SxHnfLhyydoC", "t85ymw92is0C", "TfkaULToI2EC", "th8oeSCV6Q8C", "TkVqqMuZpwEC", "tmVAmITQrmIC", "tqL-dZ29ATcC", "UxpV536d5hEC", "uyHrEAEC_YMC", "VaPhkASeJ7IC", "VDin06S0V_8C", "veGXULZK6UAC", "VF588BtEzCcC", "VFPESwN4cwsC", "VSGv9ygG1poC", "vuVOwGOUVYEC", "VWwH9SboEQcC", "W2-1yYXtMF0C", "WGUNSP-LaNMC", "XZK2FzHiA8YC", "Y7cDOT_XaY4C", "YKGwdLQmVaQC", "ysEp2IhHrMUC", "YSMIxY6iEKMC", "Yz8Fnw0PlEQC", "ZfjzX7M8zt0C", "-lBr4WIvPz8C", "-Zc3V2oOqK0C", "0oXB7aFQ1FwC", "105JppJWUk4C", "1C3yNgqZnUkC", "2weL0iAfrEMC", "3NQhBTNKJB8C", "4msZ3cQHO8gC", "5f4Z1Cv2X84C", "75UTwaSKHiAC", "7XUSn0IKQEgC", "8IN3usGqzPYC", "9-8jnjgYrgYC", "9i1WgopfVToC", "_-xnEDNPxwYC", "_XzEs6TulJIC", "a_tWDLdD6B0C", "ANqnTECyE9oC", "b7WKUva_gjMC", "BkDxC_O1WisC", "crBzYLSu34gC", "CXhEJGQsJ34C", "dtSdrjjVXrwC", "EFqYStz7lV0C", "EUcGc6jEqvcC", "fCZB0yBckTgC", "fhhLFcOZGBEC", "Fp59VWEIzFgC", "g3M-uf5pruMC", "G78tE7JjgDcC", "GuA2REeoBiUC", "H4GTzba5m1kC", "h4LRlPf5q1kC", "heIAUbZj-s8C", "Hxtp87Gg-dgC", "I7-IP5P-gdMC", "ihYA7R1ZFWcC", "IQ3PJY7zs6EC", "j6CkhZ862q4C", "JHEM7lZOm1MC", "JM59G2oSN3EC", "jt7-35zypq8C", "JT_F4bJYStMC", "JypQSHAXNi0C", "ktm885vGIXEC", "kW0s1IrlbnIC", "LzgNHuKKGJIC", "lZRHFamrPTYC", "M3ha_ErsG8YC", "mShXzzKtpmEC", "MY2dCU2KPeEC", "nbiRSagoci8C", "nNj3pK2gna8C", "nTQNo45R158C", "NxykJ3b-zqwC", "p3pCgbJp_F0C", "P5ttR3SgsRQC", "P9e_9ks8I-0C", "p9vqjmOCdUoC", "PQzYdC3BtQkC", "pvZVbw84SH8C", "PYQivWd-i8gC", "r4s1QTHpQosC", "rNRlR4RGkecC", "RzDjk8u7rfAC", "S2-4gQKDKUUC", "sJl-nUYdZjgC", "sXZiavO78M4C", "TKh6fdlKwfMC", "trowcj1wZ44C", "tU63RcoRCZcC", "Uo9LDF_ZC-YC", "uxvYqDtwx2sC", "V1kKb0RKhlIC", "VENrFSQFco8C", "vV9TxTSGA3wC", "xa2-b3bsRMcC", "XcOqBdzZCsEC", "XDSERMVMLTAC", "XLvQZxX1GtUC", "yFn_v3LT934C", "YOVuQFXNcP4C", "ys_V0MftVWQC", "YWzdzzjOahIC", "ZM7ltPetQg0C", "zMRUsLNt8eAC", "-BGKavU8jB0C", "-Gw6kWP89dgC", "-l6PDMS0jQIC", "-LeUV2wr2BoC", "-XwouDKyJ2gC", "0aFx3bpLoN0C", "0FpnqTGxykIC", "0RmKcoqS8P4C", "0XVcWB-FHCYC", "10WaaHcY06IC", "13zK4DhnCH4C", "1_H1PmGEUHkC", "1C-luCqJVhEC", "1N2ccRmpdaAC", "1VesjYo46BIC", "2uChr44meR8C", "3-ZMNssUxDAC", "3fkAazdFhL8C", "3KzJr5_U4egC", "3OzdC24R7p0C", "3y88ESO9Og0C", "43gGM7InIYcC", "4EcBLlS-_7oC", "4JblsQKKp5UC", "4t4uujcNcJsC", "5b8QUomZemcC", "5BNqwkATVFQC", "5ek0v2_F5j4C", "5FFNoSioPmcC", "5IFW0O9roEMC", "5P2dgP6IIkMC", "5ujdLj5Qvq0C", "6GA3srKNFRUC", "6KZN7xPj1McC", "6Xv2D77awK4C", "7BUf0xhBN8EC", "7difwFYeDegC", "7eHHDm3IbQIC", "7GmtwLcqjRIC", "7j7pbvkhm0sC", "8ihq0DCczi4C", "8sZxihzL06EC", "8tSYa32W5iUC", "8yJfpmKv_OMC", "90M5Tw0530gC", "91myiffbyewC", "9IHZI00LUc0C", "9OEmdcwYhfEC", "9R-aGrYdyzgC", "_ClUwFV0Q_8C", "_DrJ1w-4rZEC", "aCESCcbcSV8C", "acZ8Y4SaGuoC", "ADCJDNtWqfUC", "AedT3DFLkzIC", "aeM8liycEVMC", "af1vAKzcNHgC", "ajuGcS1hnFAC", "bKVCtH4AjwgC", "bLbG-5tWKlEC", "BMdjgQUXPu8C", "bosadAZI2y4C", "BSb0GJ3ZNIwC", "bT7PO16NEz0C", "BTAqqy5HM9gC", "c4QF4q-BBXEC", "c_zntP2OimkC", "CEfOj7nPGwkC", "chWFFmyeXoYC", "ci8ZlvnjfEkC", "cirqwlWIdjUC", "CkoZ0LZNyH8C", "cm2uPFGXJKcC", "cocVLbFkgyQC", "cqeKBaTQgLEC", "cS5LIySXISkC", "csUCOBuW61cC", "CUFJ6Jw2WQ0C", "D5nXAbSifIgC", "D5rP9U6DKPsC", "d5VPrzefkeIC", "D6pn6mX0w5kC", "DBw__rjJe4IC", "Dga98586A0YC", "dgW10li4jkAC", "dHlP3pvh__QC", "DjlBsZyhaQcC", "dKyPYyWNVMsC", "dNSOkGbW_EkC", "DqgcpdVuRgcC", "dSarPnb4i6QC", "dWB3v1XBsK0C", "DWokDfcc8jcC", "DWzqgi6lcroC", "dyr8nTjVnc0C", "E32Rk9Hp-AYC", "e3DZmcYvLpMC", "E8-kZZ7PrAsC", "erLFYbSqVvQC", "eSs337bclSgC", "eTqHAtbAzg0C", "F-S2Y1UZoosC", "FJVDXIJtGZEC", "g5g_FVB5vEsC", "GCJzF4slNHgC", "gd9doP1MgecC", "gg0AYyb659cC", "gYHUqzqdzE0C", "GYnZqBjBDHoC", "gZxH7AAkzIUC", "h0hAXS9btasC", "H405zLofpJYC", "h_p6vykYQQ4C", "Ha7Z5Ccio34C", "hc0ULBqlgVgC", "he6PtCsPI0wC", "HhhT1gNKaQ8C", "hM7l02o63xQC", "hPWiQZt5aRcC", "HT6D2fD4qIwC", "hVHYgJ5JccMC", "HZDipGVmK8YC", "i04gvDRlG3IC", "I8KVxbDmAfkC", "iLy66hcmkJMC", "ImiebrbUA98C", "IQ3PJY7zs6EC", "iqLlcSlvflwC", "je2RIdOsqOwC", "jK7EyaxrqjcC", "jNA25QH8SXoC", "jo0QDroYDGkC", "jOw31xuUlkAC", "JpZwVmnzUngC", "jQtsA9RjiWMC", "JsdJh5twEzwC", "jYSY_XuKVBsC", "KqTFXw9g1zEC", "KTbGqfHdlX0C", "L0qppDj5PowC", "lBhgrgRZDQ4C", "LCBLklGJH6sC", "LRAIyOKxmxgC", "Lrtuyrh8h2gC", "LXUeNVWZyZ4C", "LYmgxcx_AW8C", "lyNwEPs-bKwC", "M04TpCjQiDwC", "M3HVRDMmID8C", "m51VTRVtPNIC", "m9BQIig6kekC", "MdG5lTFeHVwC", "megcGzrJb1YC", "Mj1pmBvYbFsC", "MKeKWwpCToMC", "MlOWsTGRARIC", "MNHHJtWRB34C", "mtWfTJo93kcC", "n1-FFBWOC9UC", "n5-6VmSLEVIC", "NA4w9AMKSfYC", "nADfM6NuoecC", "nb3ziIO-GEQC", "nOY0ZCY9itoC", "NsF40Xh9KHoC", "NxL_Z5FAVzwC", "o-NDKn-lbFYC", "o7aaimpuALYC", "O9EI6Kja3CUC", "oGbyGKMBfR0C", "OHnbtpjmY_AC", "OQ2nTaHMm1IC", "p6Es8-7f_X8C", "pAxH-S93nh4C", "PdRWRBi41S0C", "PHON1TlFtoAC", "pIrCoCG0jj0C", "PLNkIxzQ-0cC", "PV5UO1ELsSUC", "Q0VWgW9COOEC", "q2ZMsxvdeCQC", "qAo3q623slUC", "qd0SPoOqKfIC", "Qdd_BMDWW5oC", "QKb0KIOWwZYC", "qMWh5T02XGQC", "qOoqLMLp51kC", "QTjtaM_XjdAC", "qUfmLRZaSQcC", "Qwufwl4w3NMC", "rCQQ2ZSijUkC", "rfSZReWcp78C", "RIr285y9nRQC", "RndTqOYSseQC", "row2qL1qCoEC", "RRJvRT17EQIC", "RypoUoZjNkEC", "RYrsI5wMroIC", "spkEKSsfgSQC", "STmAPBqf5wMC", "sXq7k0XKJSQC", "T5KxjCQhc-8C", "T7raezEZ1bEC", "TCiRo20x3Q4C", "TCQQ6f-MrpgC", "TeCJplpETVoC", "TeilmkSRH_AC", "tf-MGA32GSIC", "ThOlFtXaq0cC", "tKLvPAScbiAC", "tqH-RUSTH40C", "TuoFvFXf3NYC", "U2pksdgrZUwC", "U8FQLBxjI2wC", "Uea0fuqZgqIC", "uNr6MXlefT4C", "UsMPRKldMzYC", "UTdSrpGonvYC", "uV_iy5VuVOEC", "UztZxSRJlV4C", "v-9Dqz6xYlkC", "V00KDCcEbfcC", "v5Wrowmc8csC", "v9FitTPWAk0C", "vErkAGvxVHYC", "vfU3Y7mKudwC", "VIBrGVtNqb8C", "VInqwHnDSd0C", "Vj7NTmylUlsC", "vM7j_cCzLPQC", "VQ8pGE3QYSMC", "VttvrPyt-EAC", "vxN6_lU84IoC", "wLg6sj_gF0kC", "wwikOB0tGKoC", "x1f94LvsI-UC", "xCA2GudEI6QC", "xh1zqeohaXAC", "Y-PzV7ZO7Y8C", "Y0xqbKSMB2UC", "YNnjSYuBGL4C", "YQLGVTN1SvYC", "YQzEvuNSAj4C", "Ys6KcOuCG24C", "YV0IskcivVIC", "YVWmKC8f_KwC", "z8j8Qrk4Ls8C", "ZbnLAfbazQ4C", "ZBpmk-NbkKQC", "zGaRpi4YdIQC", "zjgCC1ymlGQC", "Zt18aFbo91QC", "ZVvK7yp1FzkC", "ZY6bC2BPcIAC", "-GZj4J8xCJgC", "-L6Mta5ndNAC", "-PvkRdMbuy0C", "-qMYJX4_8aQC", "1FjUdrA-VFAC", "1Tny60vKmUUC", "1Y1BQkVqjtgC", "2eSpL8ZL5BIC", "2KRbyYAKQ6cC", "34L752pBlhsC", "4Debu8jRvrgC", "4PKQ8Pa0Ul0C", "4tURrenGW2kC", "4Uwrw19KVOoC", "4WqmTRin4ZMC", "5AJmojcmFE0C", "5o1ZHCjHkFkC", "6AWJpoorWoQC", "6pmBjSl35egC", "6tqHrOu-4cUC", "6VcdA01PPMcC", "6wh6ml1Pt6UC", "7mtBRAEfXvIC", "7xQpBzI4l58C", "8H91S2sw9QgC", "8IDEiNTtV7cC", "8UOzg674kdkC", "_6GePgDGGK0C", "_f6j6anyQ2MC", "_Qjfxl6_QgYC", "_sn-o-LMeskC", "A9KGpN073P0C", "abyFoVaEKYUC", "aDM4SKZCatcC", "aRDYXYZfvDkC", "B1zhqUEcPkgC", "BiAd4Q6aSEUC", "btpIkZ6X6egC", "BuxJD61uYOYC", "bzCJkaTSeHMC", "CCJhjoq9nBEC", "ccWmlymJEq0C", "CdTJvxJ77XsC", "ce89NOKPkL4C", "CP4yE9IHgLYC", "CrHWOtkHCwsC", "CWgf1t96jAkC", "dfInNTbJsk8C", "dFlImpewmqUC", "dH1sAxadZTcC", "DOLsxgRAqhQC", "dRkH_H-EFKMC", "DWqmN5NAiP4C", "e4_FQv-rmQgC", "eAyJAiQHkMIC", "egyCSa5tJTEC", "ep117AqTGW4C", "EqgV2wJhi1cC", "evvA09RzZ0oC", "Ff2HadKdyh4C", "FMU2sVYK10gC", "Fn8ysAJWUnIC", "Fp4S3oEXQAEC", "FrslsCdrL_oC", "fshvh3jWzOsC", "fSvZepCCABUC", "g63GBF-KPC4C", "gbIG-epQgyYC", "gBKtKIT-GvoC", "gqPNokxPgMcC", "Gz67bo-EgxkC", "h_hGQNs9GHwC", "hE0FKGDTurYC", "hFSx37SaQRoC", "Hl2xvndpcR0C", "HWMD4dsbRnMC", "I6BQ9yxgSaoC", "iDlrydEEJHgC", "If3o_UU9s24C", "Ifz6j6_T-s4C", "IHtQFK_sBqcC", "INyUQOZZl58C", "IUV--lkfN7kC", "J1FmPbrDgwIC", "JEj7x8eZC_oC", "jrnLxhfW7gMC", "JXm_CP3T5JcC", "K1-LL9vlxZcC", "k6mPvBQEm8QC", "k88UDDDvrS0C", "kBQNNPxuu70C", "kcsqGna7fBIC", "KfJmaUFwkMcC", "kMzH8iHyyrMC", "kO5794qbOe8C", "Ku8NG5OgmlEC", "kw2whCi_CgQC", "l_5NkzG68RUC", "L_u07lSB0bcC", "LHWE7tFmMT8C", "LP3pux703ukC", "lSybHLQbZ_kC", "lV44_bf5YnoC", "lw99Oii9R90C", "lzsQS5FeJkkC", "lZu2S7MMfT8C", "Mb9sHZJDpO8C", "MbW3_eSDGl4C", "Mg5jM9Bpz2YC", "mUEOJuwUAOkC", "nbITlF0ZiSMC", "nJ09OZlYngcC", "njWQqggGmRQC", "NuMx6tmf5iIC", "O1H7BVBsK9oC", "o2yNzFVc59cC", "Oe21i1ChvFwC", "OHclhBVv-X4C", "ot-0G0Q7lEYC", "oXz1ZblCUIUC", "ozol-RP_SK0C", "p76ueH9PWJAC", "P7Gio2slQFUC", "Ph5fp30QR9AC", "pK43Jn0RmTcC", "PllWy31yfN0C", "pt660yLyXqkC", "PvUsMAChACAC", "Q7Jk307w-XkC", "qL0GQnyPDw0C", "Qt70g8C3fXoC", "QUNoPBsxf7AC", "qZiRVmzf6I8C", "r0vgbVwxNsUC", "RA8s7kh-dSsC", "refaXw3PHeMC", "RFWfrsUueekC", "rIj5x-C7D2cC", "sCqTLoPnXp8C", "Sf2hhOWKUjwC", "sfdSGwRYwhIC", "sgYB8r45FHcC", "SNCdbj8pJg8C", "SOJtFIjyBWMC", "sosiolVa7uEC", "sxh_DW4s50wC", "sy6mx4xyvRQC", "T1I5uvZGzM0C", "t1kIollr8fQC", "tj4jpCbifaIC", "TOXraAXIqCUC", "tuspQELrwhIC", "tzItGpE83FUC", "u_ly5iCCR5kC", "uBQQmyyK6mAC", "ukRplJvGSD4C", "uNKImaUpW24C", "UNTaN-NqhpMC", "UvgGzh-6t8cC", "ux2wduAY-JcC", "UXn2vd-jsv0C", "V-HeFwF7UakC", "vaiHc4-caXYC", "vAMDDsz43RUC", "vkozsZ3-OwkC", "vV5TcbVYPfoC", "W-Zb18DC8d0C", "W9d41JPUobkC", "wtj4uu2Esr0C", "X4Z-6_UjUK8C", "xcOhW-8ceN4C", "xEKIryULO6wC", "xEYBhKlG-H0C", "xHWgnMsz8UIC", "xlXkiXE8cX8C", "y9LkuD5JLdgC", "y9S6PuuVJG0C", "Y9uJUlGwJIUC", "y_j7eSwRuVIC", "YCBFxU5rGzAC", "YJDL7vhpJvIC", "YoryriygeZgC", "YPWuR6Spo1MC", "YrET8yQqIM4C", "YX57ZkCEJNgC", "zBU58c4KpREC", "ZCyqpCqeIiEC", "ZEyWIM5tDCAC", "zezJOW8XFc0C", "ZfiREZrremoC", "ZfjzX7M8zt0C", "zIqZEjsSyIcC", "-4JaSBhEmmgC", "-76GjNpR9VUC", "-ejuRdu1o0sC", "-F7oqyLU8yEC", "-L6Mta5ndNAC", "-nwAWTMtiVMC", "-P3klEJmyYoC", "-PvkRdMbuy0C", "-RzDku2uRXIC", "-sapXk7dWcAC", "-swgfIGSElYC", "-TnVeCjM2BUC", "-VqbhDPE6RwC", "-vWT6E7gwRYC", "-xJpukMoY2kC", "02Xig2qmvr8C", "03ugn0KpZVkC", "07LTDdpMZfYC", "0E8JpmcAWgIC", "0J4QzTKvMWgC", "0mGCIWM1pOoC", "0pLN4o3jnX4C", "0qYJ1G5DCkYC", "0uRTfS1Tgn4C", "0yF95v_cIi0C", "0ZOQM0b3CIEC", "1bV993QDiRAC", "1CCCWMqPtzEC", "1CZjrwiEqWQC", "1eVAVRRUnkAC", "1h48H2_RlusC", "1KdwvK9lLVUC", "1nN5hXqGUpQC", "1nU7NLCQGQgC", "1PgKPuFIz1kC", "1QAHs3JSVnEC", "1Tny60vKmUUC", "1wA_9CKPlsYC", "1XfzbmbLnwMC", "1XtD9HhZbOQC", "1zUMv3Kv6b0C", "2-SeHlvtIXkC", "26GWYL2CpN4C", "28ZTgahpo5MC", "2hLRAkzKHjIC", "2X59P60QHnYC", "32yoIgkRJOcC", "34L752pBlhsC", "3E_xUWylr-UC", "3h9hkTsLvBsC", "3jVps2Z9LQcC", "3pu3QWtuQyEC", "3QPCicPagmkC", "3u6N2cT0bOAC", "3uni7ltr-EgC", "3Y3Koy1GyxwC", "3YJoqg9olpYC", "49Uk1oEf6JYC", "4CLIORno1rAC", "4coo9ddRaooC", "4F_TQ00gjfsC", "4GIvo8QVTLMC", "4gOtkoiJIjEC", "4GXEmkTTUpoC", "4hg0KpqgjcYC", "4IuaEfruDEwC", "4mOrEoLlJQMC", "4ny3c9qR8X8C", "4NynkhaQ8W8C", "4qonczmsK7EC", "4tvdBDk8JX4C", "4Uwrw19KVOoC", "586WOqyl34gC", "5B0VAeZsoVIC", "5ckoF81np3sC", "5d-kBuaNG9UC", "5gdqw3ax1KsC", "5H7RXIuvSE0C", "5n2e3UaU4PsC", "5ohxQyl4-O8C", "5uD_-xh13V4C", "5v08C5_ZZTAC", "5X7VZIx48PEC", "5XdIgMWhmcoC", "608lEnyfObkC", "6AWJpoorWoQC", "6AXV76B7GTIC", "6gMmbJoCPyEC", "6jfyVfKCmUoC", "6MtRNh_cgSMC", "6u_VRZHH4GIC", "6ue1tbd-dTQC", "6VJ7KzN1x_wC", "6wh6ml1Pt6UC", "7334_AEUgVgC", "74JpqIiLifEC", "7ER4mPFI9osC", "7EsxsEtV9sMC", "7gXh4VqSVUcC", "7ksTou2ZkUoC", "7mtBRAEfXvIC", "7slan0QnyRsC", "7SooukPjhjwC", "7Xf-oGYr5V8C", "7xQpBzI4l58C", "7ZbCilZXmmAC", "8fjvEUIapQIC", "8Fy9NHweW9QC", "8gelKH734-oC", "8H91S2sw9QgC", "8HdUyL1l1ksC", "8IDEiNTtV7cC", "8OXdc4vlzs8C", "8PBJOdv2H7EC", "8Pmi9jxgQxgC", "8rBdtCkit9AC", "8RDs6-P8UPAC", "8rOvpN2d9TsC", "8wfGMsWWZ-gC", "9gaTqmfdPQoC", "9JmKpUr-EFsC", "9P7h5rB2vQ0C", "9Q0_5ogipFsC", "9VYuMmcxSYcC", "9vZ64MLmVS8C", "_1CxStiRr08C", "_ALvS8AzgTAC", "_B4Bef8FTFwC", "_bPIMadGwewC", "_ceeVvxULncC", "_Cfi6UiyNlkC", "_eohr5XMnBAC", "_f5KcJAyhvoC", "_GGSLrAQYIsC", "_h4Jf64pDyAC", "_J18TXGiojQC", "_jeprgK5J6sC", "_jueZ7Tz8ywC", "_mur2PUOp8wC", "_NaVar4pJ6cC", "_oWNWR2vwysC", "_sn-o-LMeskC", "_u-czkvqm4sC", "_U9YvW-NfvIC", "_VH9YGAUbtAC", "_z7RaEmKC6cC", "_zhwTYftf-sC", "A-nGXqb5JSYC", "A8KuchLCcYkC", "abyFoVaEKYUC", "AD1Wke2hrG0C", "AfD1s_2f1FEC", "AHpEoxYiK9AC", "aJVuN5nq2qUC", "AKA7nDO9j48C", "AkeKKRbJcsMC", "akHTeRj4JOUC", "AkQjSsjvkTUC", "AlKRFqsOeZEC", "AoufDxH8x74C", "aov2z6vYpzMC", "aRDYXYZfvDkC", "asRKDggVx54C", "AUbEMUpDHjMC", "avi_Z6Gh8qwC", "AW747fOkrj0C", "aWmi9nbSr04C", "aWRCZ8rGnhkC", "AY1iHnq-xcQC", "AYi7qf0jsOAC", "AZ5J6B1-4BoC", "b0Hvl7Q_BuIC", "B1woUWB0zoEC", "B1zhqUEcPkgC", "B4dliT2lOZgC", "b592OcmrEiIC", "BBKEcM6M_BUC", "bBYG-E9nRykC", "BcCNJNcixZUC", "bCosFPTNyRwC", "BD5vHd29Ks0C", "BedB7RwA4ykC", "BeJOKgCPho4C", "BEKXF2zGG-sC", "bEWHe7swieAC", "BiAd4Q6aSEUC", "BJcgLVibkrEC", "bL0V6oCroGYC", "BNaURsY-nTAC", "bNO3yU4E1FsC", "BnqbHc7qE0UC", "bojZGsgacvsC", "bR0CXxMF2oQC", "brQZSNtn0KYC", "bX1nS36naX4C", "bZHl-c4Np9UC", "C7VKDEeOItoC", "C_-mi2hqGXQC", "C_bL0PRTQl4C", "CA6h2G_mJlIC", "cAAI89nNZEMC", "CaBAy2oYiNwC", "cAmLFWdaK-AC", "CArnmV7IE5UC", "cCo_JW12cPYC", "Cdg_NkdhoToC", "ce89NOKPkL4C", "CII4iT8yUVQC", "Cjfq3Sq4C5EC", "ClbxfqL67cwC", "COjPOyLC1NYC", "CQWlJiK5If8C", "CS6n6YeCWbkC", "cu1La-UW1uUC", "CUx9NFuHJMQC", "cW3PW9PbqPUC", "cWHKIyvyEksC", "cWQJJIgJNtUC", "CX1OBa0NxKMC", "CXFWZuxyUFQC", "CxSlyJOi1FgC", "Cyly4t2jHMsC", "CYYnmQwmT2QC", "cZ_F_J1308wC", "czC0Y_Va8BQC", "Czq_QLLkwK4C", "D-ctsVAeN-kC", "D1g9NcEBcEYC", "D58GqvTxupUC", "D8phz0hAtfIC", "DaDP_S-bMlgC", "DEussc1kYYYC", "dfInNTbJsk8C", "dkS7CMsi0CYC", "dla773aZfTIC", "DMA63zMS7lAC", "DNYRA70fpVsC", "DOLsxgRAqhQC", "dqi0a2CyavkC", "DqicTjD83CUC", "Dt67NJYFYL4C", "dX8tSRf1xuQC", "DXl5d3PpY04C", "dYMS5W6_Lb0C", "e2q53WFE7hEC", "E7Xw3-GDz4MC", "E8-kZZ7PrAsC", "e_meE2o7GMoC", "e_sTGVh4SRwC", "ECTrdkcRRZ8C", "eDl00TgFDCUC", "ego1raoSBfMC", "egyCSa5tJTEC", "eHAK8fdo0_cC", "EJFT88h-q0sC", "eK0SnBnpkA8C", "em3obwwfGUAC", "EMcjOKjbdNMC", "eN1eVGDOQ5YC", "ePwhbo8BwE0C", "eQajBqGgHkQC", "Esr4fKWU27AC", "ESr_AtJMl0AC", "ESyuaATJOd4C", "ETg4kBLS6psC", "EU9sFmi1U68C", "EuzmhRySiUMC", "evF6kdfndvYC", "EvFiS2rAlosC", "eXgmkezrzYcC", "ExTe994L0BQC", "EZSih0sBzi0C", "EzxwuTqqBhkC", "f-lv0GeeF8EC", "f0nW3qJ3tJIC", "F0v4zCQg10gC", "F2Z6uxeA0IsC", "Ffl0HCe_YV4C", "fFS2asmj4AUC", "fG49kbqrsgoC", "FIyaG5BdttAC", "fJelZ9wO11kC", "FJGUYgk2cvMC", "FjkctseJSHkC", "Fn8ysAJWUnIC", "fnSegQKAttUC", "FodGfz5li5wC", "fQ0GfacznJsC", "FshiVC33NhMC", "fTEk6vLjK-gC", "fu-kpQVvUNkC", "fVgPWLQWA4sC", "fvGy7lnl5e0C", "FykRZunc0NEC", "fyvF_1MmEMkC", "FzVlzvwrbY4C", "g-xFICaT2KgC", "g1-LVOkDfDcC", "G3-3WCuBIeMC", "G6OCU8VRYTUC", "gaWaX3c3xcUC", "gbIG-epQgyYC", "gBKtKIT-GvoC", "GCyjMr7CudIC", "gdB6wQBga2EC", "Get-rAnKUpUC", "GfZodTCFYrEC", "GgFI5pZBUu4C", "Ginqs7wJ1XAC", "GiUW7V-gdfMC", "GKfXoyCfh7EC", "GKPktrYG7sUC", "GmSGPMXp41MC", "gnEGziO0ASQC", "gQ-RkCsWFTYC", "gqPNokxPgMcC", "gRSux4SdN-IC", "gT60QdAov_MC", "GUCo0saVa8gC", "gV4SCyVYuYQC", "gVhJ1_WvDBsC", "GVHocBMsJa0C", "gVmCUL3kz8EC", "gWSU_QI39okC", "h017Dhvt9qIC", "h0oAFNvncUUC", "h3KoqdZ2jpYC", "H4pOe9pQtYIC", "H7HpQrVYspkC", "h8bNYcNwWgMC", "hb2mddOnmcgC", "Hbvw2UCKoZ4C", "Hc_rTXEjeWsC", "HcYjKlcm-pMC", "Hd3M2lQvCZQC", "hEUQWxM0nHsC", "HFotoS0lwvQC", "HnGJsP8JI8MC", "houLObK_Rh8C", "HPBrFPvlSbwC", "HPYLoLgJVKwC", "hTyf61os6q4C", "hx4zw8cp__UC", "hz_e_Ou2nIQC", "i-dzdN0xPvkC", "I1HMmRJtL2wC", "I6BQ9yxgSaoC", "IcBj0RlABDgC", "iDeDm27OnSwC", "IEQRxisj-nkC", "IHtQFK_sBqcC", "INvN7NgVFCIC", "invwNFgV7ooC", "INyUQOZZl58C", "iqVVCMpztugC", "iuc9opwJ7awC", "IUV--lkfN7kC", "iUyrNlDbzsIC", "IWvJms37_owC", "IwywDY4P6gsC", "iX5t60yJp4IC", "iXS0g4iuYzEC", "J1FmPbrDgwIC", "j1k-ALNh_AkC", "J21DrnAqy9YC", "j2l3OK6h8osC", "J2lPGw1Rtw4C", "J6DxZsLy38sC", "j7XsGbC7QKsC", "jaHqDitMkcwC", "jdsMvUHwV5YC", "JHxxM6mOAAQC", "JI6RrXDzH9UC", "JiDYXW7kIFsC", "JigkhryKpx4C", "jIqTj8wO9TAC", "JktSxVsXDZYC", "JNuRxUXjmWAC", "jOMGyirP81IC", "jVL9t0pASC0C", "jw7Ax9CcwjQC", "JxFIS87S148C", "k88UDDDvrS0C", "K8VvOPLwg-EC", "kaEecwxX7WEC", "KBFcMJ82jXIC", "kcsqGna7fBIC", "KDeCgbRa5jcC", "kflefDbfDOUC", "KgSgVDI8c2UC", "Kj5w6sZTJsoC", "kO5794qbOe8C", "KOJ6JcKqIbQC", "KqyijSJv8lwC", "kSpQvfX1BSoC", "Ku8NG5OgmlEC", "KXfziip0cCsC", "KyYHVPJfJsEC", "l_5NkzG68RUC", "la_e6cgLl-sC", "lCGyHH-9ThMC", "LecPI-LRELIC", "LEHGfCUDYfAC", "LgYDKal5OAcC", "LHtNad2Dr2MC", "liXVkOxFDqsC", "lLWuYEx1eQcC", "LMkii04pC1gC", "LMTMTcWUNWcC", "LOnmn5bytY8C", "Lsz51VJ7IVQC", "luHp2EJtQaEC", "LurjwBaxF8MC", "lV44_bf5YnoC", "LvtESY7aPcAC", "Lw86RxlWQnYC", "lw99Oii9R90C", "lXrnTDSacVMC", "lZqrZGDIFAIC", "lZu2S7MMfT8C", "m1axmPZi11YC", "m1Or0ficxlsC", "M4d-MQlEG2kC", "m8JVt054DKwC", "m_hkEz6T-x4C", "M_PLP_Kohd4C", "MblDTjG7ylUC", "mC7gkAtRC6sC", "MCP9XkskjIEC", "md6oFs29tVwC", "mDF-nk2IEg4C", "Mg5jM9Bpz2YC", "mim-M3zIAWUC", "mK6MS891avEC", "mKBy-_WBiugC", "MkTwWUbyx6UC", "mLqL7ulqj-oC", "MqMv2oNmNHcC", "MSXVXP_3cFMC", "Mt9NFfWXW7wC", "mtP0gwO7MEYC", "mU8uV6laLRAC", "mUsT853PvLcC", "MUvbLFS8Av8C", "muw8IPWgGUAC", "Mw1ky2bqh04C", "mZws9JrkC60C", "N-Kfa0UZcGUC", "n8osYvxSYh8C", "N8rTg0X-QIsC", "ncC8EF67bWAC", "NdFeQuMDINsC", "NesI-uoZwYQC", "ngZuhGcX_2wC", "nIuDdBIsS-MC", "nJIn7DinnV8C", "nJv2mifE1o4C", "njWQqggGmRQC", "nk-zDSq_6nQC", "NLwvH_ZRUh8C", "nLYzditxyIQC", "nm-BUiZMc3EC", "nO13fbQfeIUC", "nPDKveEbebMC", "nQ68hmToee0C", "nTw0jsvjg7AC", "NukmAj--nXgC", "NuMx6tmf5iIC", "NUX8dD_xxMoC", "Nwr-wjeRSmoC", "nxMbOcwxOj0C", "O7-V90OQVQsC", "o8FTqpgFivIC", "OB2HH37-I84C", "oB4OC53QYYkC", "OD7Ck6xrOoMC", "oGY9hNTcOSoC", "OHclhBVv-X4C", "OlI8KJzxBwAC", "OmUJebLiytYC", "Oo4lb9M-O5oC", "OO7VLVPMt_UC", "opqdY91BMrIC", "orWw5hZ8BsgC", "ot-0G0Q7lEYC", "oT7Ov516accC", "ou6rclxkFu8C", "owdvLQqC-dsC", "oXg0wOgdKDcC", "ozol-RP_SK0C", "p37VqBkJvL0C", "p3YW4rJ5ob8C", "p76ueH9PWJAC", "P7Gio2slQFUC", "PaGLM2GozFoC", "PbmmLSnghrEC", "PczyUV_YL2MC", "PE53nJcigosC", "pEKjhF_EUIwC", "pep9YQmYgJUC", "PGoBkEb5yf0C", "Ph5fp30QR9AC", "Ph9tE9_G7aoC", "phzzlIWxr3kC", "PiwPN3j2JXAC", "pKmJ0B8e7zUC", "pMo2v1U_VNcC", "PNjrRKR3sKoC", "PNW7TiM1BJ8C", "pOUhr4JDZbUC", "ppLI3zTIhQ4C", "PPNZYEL7pwgC", "pV8oTgZ6B3AC", "PvUsMAChACAC", "Pw-rcBpV-80C", "pwsF6n2rU-QC", "PxVsN849Cz4C", "Pybzv6lHV8IC", "q1EPx-ceN78C", "q2E_qQwNi84C", "Q3Rfm2JBti0C", "Q5QRRluMxecC", "q6zIspzVcPoC", "Q7Jk307w-XkC", "Q8k6Z7jH8a0C", "qa10pJ0PaMQC", "Qa8IoiT_3kAC", "QdiTkdgSoaYC", "QhWVUH9tNw4C", "QiO4D10VggwC", "QiTL547ISwIC", "QJqyBQlzZh0C", "qL0GQnyPDw0C", "qLfZf7f5_pkC", "QlLMwIkHVu8C", "Qms9PNSDEFoC", "Qn6XPK6_9PwC", "qPfokXOc4LwC", "QpXLNs8v_WEC", "qsijdHADx8IC", "Qt70g8C3fXoC", "QTlyR32YgJ4C", "QTQhoeH9gOAC", "QtTNYdNpJRkC", "qUgPnJLN4lEC", "qwGgE6LbWuoC", "QwptKz0-wL8C", "QXmmegPcncUC", "qZsoQyr70zkC", "r0hw66pmL8wC", "r0SqH14yQBIC", "r0vgbVwxNsUC", "R1cIsQiFoCwC", "R5-edU1taWAC", "RB0X01C7pg8C", "rBYgS_sNEh0C", "rC8VSWUV828C", "rFn1T6E0UJEC", "RFWfrsUueekC", "RgdA-8B8Jo8C", "rGEEFkQlnYkC", "rjTH9c476t0C", "rKq8bnUK3WoC", "RkZeR4-1O9EC", "RLpxnrnXXhYC", "RMd3GpIFxcUC", "RmvQfoKiPCQC", "RNmeL_6s3OsC", "rpWP3KPA5kIC", "rRYjYKrShPwC", "Rt70xjfLrfsC", "RV-fNYzEZlwC", "rVYbIigCAIMC", "rwrHxpn-ydMC", "rxlhF88yrg0C", "RZ_J2zSCsBMC", "RZavt1b_0BAC", "RZll-GR0Oi4C", "S5njq1FhUUgC", "s6ZPTdkgHlkC", "S7IcZd5UYmcC", "s87JIfNWSKgC", "s8zIH7dnYCsC", "sCqTLoPnXp8C", "Sds79NgjU7oC", "SEQr7Y2ESicC", "seXnMV9-vmkC", "sfdSGwRYwhIC", "sgYB8r45FHcC", "SIBukbtIZ6AC", "SIGIlqKAaW8C", "SIGkFwAmFKwC", "sN_FF1GBPosC", "SNdZ96QZ768C", "SOeYus07mmEC", "SOJtFIjyBWMC", "sosiolVa7uEC", "SoxnKRQyj10C", "suVX7iZ3Z2sC", "sW5w27ZLekoC", "SxQuvJbN0dsC", "T5UpCOVOJboC", "T97vHe-Q8OMC", "TBr8IVfeakoC", "TEp_QVl5lVEC", "TGfGcACdMmEC", "tHK2RxUm3xUC", "Ti7CSFe9WfQC", "tjnjQkoBnBMC", "Tmq3nTH_uu0C", "tMrWdiJa5kIC", "tNKtrgmE1fUC", "TqwIc4C2GSQC", "trfXmiUm5PgC", "TRYAQyzJGNkC", "tS7gOpmrcy0C", "TtJ0VT4AnMkC", "tu16MecA8cEC", "tuoHq4clR3sC", "tuSGXALbaLIC", "tuspQELrwhIC", "Tv77pfIsaVYC", "tW2dzj1LJQsC", "TX3-BA_UOo4C", "tzItGpE83FUC", "u1HkFE75cAYC", "u5CQpfaElJYC", "u7Pvlu1-1ngC", "U8r6PaETKA4C", "ubodMGnHnx0C", "UcAyzspqfycC", "uDg6E3p80tEC", "UDuEFOTuCFIC", "uevG9aAp1IwC", "ufNTEMTqAhYC", "uH_AITzNp1UC", "Ujyr6whVn20C", "ukRplJvGSD4C", "UlhGedGC668C", "uLXTjolpB_EC", "uNKImaUpW24C", "uODhydH-iWIC", "uQBf9FmAu-oC", "uQFpOTMEt9sC", "uqyMMARDscUC", "URoDbjKxx3oC", "US5aoykpdoAC", "USgMx6uKq7cC", "UTgWS01SxfkC", "UUODSqSSrZcC", "UvgGzh-6t8cC", "UvK1Slvkz3MC", "uVziYDsRDNsC", "uXAECz8bOlQC", "UxD9YbsMVhsC", "Uxwq3DdghtwC", "uYCcXSIMM8gC", "Uz3nMnT4hGsC", "Uzh4qLngklQC", "V-HeFwF7UakC", "v2RPoiRHX7EC", "V4-H6JHFEtQC", "v6fI550HlOsC", "V9UkDlzc1iwC", "v9W5x1mTOEgC", "vaiHc4-caXYC", "vAMDDsz43RUC", "veGXULZK6UAC", "vG8vLdk4EJYC", "vgX9GrngkIoC", "VgYTZXucs98C", "vjwfFOOm4ysC", "vkHCx--93jIC", "vkozsZ3-OwkC", "VlOXC3Pr2KkC", "vmTcK2ujm_IC", "vnEhQB8-uoEC", "VPE6Orsz1nIC", "vPm2kLSDeloC", "vqyMvavWsiAC", "VuaA_9dvD_EC", "vV5TcbVYPfoC", "VzamFijBMFwC", "vZc3cqjbzTMC", "W-Zb18DC8d0C", "w15KrP0xNPQC", "w25sx0G6nRsC", "w3b-1oa7NLQC", "w80iglnfDBgC", "W9d41JPUobkC", "W_8mE3eTSDkC", "WCG_-qi-DDEC", "We9pyCWAGOYC", "WeKvtiwft_MC", "whdtOuA58e0C", "WI0nPy7U0XIC", "wIEr8jXYBt8C", "wJ6vYEm1-AcC", "wk0YzGyyXzwC", "wlwCUad_Sw8C", "WNBFbIUssgAC", "wou23_QQyHgC", "wQKyLoDT1RUC", "WrL9de30FDMC", "WRlgDYVfP2kC", "WSCEgZsug1oC", "wtj4uu2Esr0C", "wvgF2t4wb2MC", "WwkTwI4f_XMC", "wxh2mBW9JP8C", "wZi7DZwwYJ0C", "wzPlQGKox1EC", "x2AEzRpvmywC", "X3rvKJrmYVwC", "X4Z-6_UjUK8C", "XaKz2uqbMzUC", "xbA4gFJBZ_UC", "XBWuaZBL8rcC", "Xc-DJNXsuacC", "xCnvVZMYajwC", "xcOhW-8ceN4C", "xcXnkKEOHIgC", "xd3X5x_-MOoC", "xEKIryULO6wC", "XelCxTJbKt4C", "Xh8GddJI8CEC", "xHWgnMsz8UIC", "xJ1j7mkgvlwC", "XJK18Kn5f7gC", "XjmvQlH55lIC", "xkkHhFuhPkMC", "XKQBdncI-RUC", "XLDFokaUJyoC", "XLFMJx8ekPkC", "XlxEL2OAq1MC", "XmEN-qK0bsMC", "xnUb0ToUgSwC", "XNvkUR5mKoAC", "Xozq7SGvyMoC", "xpKEExbb8DQC", "xrcH_BibabsC", "XRkDaOf0-uIC", "xsuY9Zhz28cC", "xTzN4tAcbWUC", "xVeVkhSLOFgC", "XVwOEeHTU4QC", "xWhaJJ0lZ-UC", "XzVLIY5L2swC", "y-YtcOzwf6MC", "Y3yDkC9IIukC", "y5OK4NA9_aoC", "y9LkuD5JLdgC", "Y9uJUlGwJIUC", "y_j7eSwRuVIC", "yDymY0juFzAC", "YEhxvTBNLhMC", "Ygw3cnsXV0gC", "yKKMZ0YNLR4C", "ykNznFLmV6wC", "YlRW1GtVrY8C", "YNboIkLuJzEC", "YNXPoQiZQDIC", "YoryriygeZgC", "ypuqwrePKJ0C", "YqJ-FqupAeQC", "YRUh6EtxyOYC", "YS80oPE7OpoC", "ys_e1Jaxh4UC", "yscEw6qeOE8C", "YSVeIm0jLy8C", "yUq1AXoC88kC", "YUsiaYPFcgsC", "Yw64dgRvc7EC", "YWwy374ei6IC", "Z2HZ7kIVskUC", "Z5VRwewA4rkC", "z6iODYzWf54C", "ZBkdrgIqguoC", "zCo8lr9bN8AC", "zezJOW8XFc0C", "ZfjzX7M8zt0C", "zgf3TFxEUUMC", "ZHwey8h5Kj4C", "ZiH-0QMl4EsC", "ZJO6ZuRE3-IC", "zMxUsres-coC", "ZX4JoRmrwyMC", "Zx94D5BWzbwC", "-hUUAAAAYAAJ", "-ThaAAAAMAAJ", "00kCAAAAYAAJ", "07QlAAAAMAAJ", "0_80AAAAMAAJ", "0bM7AAAAcAAJ", "0doNAAAAYAAJ", "0osEAAAAYAAJ", "0PAWAAAAYAAJ", "0qsRAAAAYAAJ", "139bAAAAQAAJ", "16fPAAAAMAAJ", "1G0jAAAAMAAJ", "1H4kAAAAMAAJ", "1qgTAAAAYAAJ", "1QoRAAAAYAAJ", "1V8CAAAAQAAJ", "27I0AAAAMAAJ", "2CNAAAAAYAAJ", "2GQ1AAAAMAAJ", "2vsEAAAAYAAJ", "2Zc3AAAAYAAJ", "3dwNAAAAQAAJ", "3e8OAAAAYAAJ", "3gUSAAAAYAAJ", "3H46AAAAMAAJ", "3LwYAAAAYAAJ", "3OAQAAAAYAAJ", "3OHOUzhs6qQC", "3PcYAAAAYAAJ", "3QMiAAAAMAAJ", "3tcOAAAAIAAJ", "3VEPAAAAQAAJ", "3wkOAAAAYAAJ", "3zsVAAAAYAAJ", "48MXAAAAYAAJ", "4cwNAAAAYAAJ", "4FkVAAAAYAAJ", "4HIWAAAAYAAJ", "4KgOkpSJeuwC", "4us0AAAAMAAJ", "4vEdAAAAMAAJ", "4wkOAAAAYAAJ", "50oCAAAAYAAJ", "54wEAAAAYAAJ", "5EIPAAAAQAAJ", "5gUXAAAAYAAJ", "5IoEAAAAYAAJ", "5IURAAAAYAAJ", "5KEAAAAAYAAJ", "5PRPaqgJu6oC", "5ujXAAAAMAAJ", "6gaRAAAAIAAJ", "6PE0AAAAMAAJ", "6uU_AAAAYAAJ", "6WESAAAAYAAJ", "7bU4AAAAMAAJ", "7CgDAAAAYAAJ", "7DcoAAAAYAAJ", "7dkNAAAAYAAJ", "7Ed1Guv4ZgkC", "7g4nAAAAMAAJ", "7ghLAAAAMAAJ", "7GM4AAAAMAAJ", "7jgdAAAAMAAJ", "7JhBAAAAYAAJ", "7jtaAAAAMAAJ", "7n8EAAAAYAAJ", "7p8NAAAAQAAJ", "7Tyq1m9078EC", "7UoHAAAAQAAJ", "7UxUkGUnd1YC", "828AAAAAYAAJ", "8AkXAAAAYAAJ", "8dkXAAAAYAAJ", "8GsCAAAAYAAJ", "8gU_AAAAYAAJ", "8LcOAAAAIAAJ", "8lcOMIkeNCYC", "8mo-AAAAYAAJ", "8nIqAAAAYAAJ", "8NZNAAAAYAAJ", "8WwUAAAAYAAJ", "99gDAAAAYAAJ", "9AI9AAAAYAAJ", "9bo2AAAAMAAJ", "9RUaAAAAYAAJ", "9SovAAAAYAAJ", "9wQWAAAAYAAJ", "9ywUAAAAYAAJ", "_0sqAAAAYAAJ", "_74XAAAAYAAJ", "__AYAAAAYAAJ", "_bkqAAAAYAAJ", "_JMKAAAAYAAJ", "_kEDAAAAYAAJ", "_NcDAAAAQAAJ", "_sIwAAAAYAAJ", "a1wHAAAAQAAJ", "A2YVAAAAQAAJ", "aBEXAAAAYAAJ", "Ae4WAAAAYAAJ", "AfQWAAAAYAAJ", "agcEAAAAYAAJ", "AgYnAAAAMAAJ", "ahNbAAAAMAAJ", "ak8-AAAAYAAJ", "aPdLAAAAMAAJ", "AWxEAAAAMAAJ", "awYRAAAAYAAJ", "aYYSAAAAYAAJ", "b74_AAAAYAAJ", "b7MXAAAAYAAJ", "bA-j9fLGI_wC", "bF81AAAAMAAJ", "bfBaAAAAMAAJ", "bFw1AAAAMAAJ", "BGEtAAAAMAAJ", "bH4EAAAAYAAJ", "bHwHAAAAQAAJ", "Bj8zAAAAYAAJ", "bo4EAAAAYAAJ", "bowEAAAAYAAJ", "bPRDAAAAYAAJ", "bQlHAAAAYAAJ", "btjVAAAAMAAJ", "buAQAAAAYAAJ", "buc0AAAAMAAJ", "BWoRAAAAYAAJ", "bXtaAAAAMAAJ", "c0U_AAAAcAAJ", "c1jYAAAAMAAJ", "c2c-AAAAYAAJ", "c_BJcZV_jj0C", "c_MEAAAAYAAJ", "CBAMAQAAIAAJ", "cbMSAAAAYAAJ", "cdkNAAAAYAAJ", "cFtbAAAAMAAJ", "Cg8XAAAAYAAJ", "CGpbAAAAQAAJ", "cjImAAAAMAAJ", "CmISAAAAYAAJ", "crMnAAAAMAAJ", "cRVEAAAAYAAJ", "cYHJHFS37m8C", "CyUQAAAAYAAJ", "d6r6mO0DWh0C", "d7NEAAAAYAAJ", "D8I8AAAAYAAJ", "dcxGAAAAYAAJ", "DeJgAAAAMAAJ", "DEUUAAAAQAAJ", "dgkoAAAAMAAJ", "Dj4XAAAAYAAJ", "DowhJYZmlW4C", "DPIVAAAAYAAJ", "dQ81AAAAMAAJ", "dtgDAAAAYAAJ", "dWlKAAAAYAAJ", "E18Bom4aEnIC", "e84OAAAAYAAJ", "eAGXOXy-MWwC", "EblDAAAAYAAJ", "EEMeAAAAMAAJ", "Eh0QAAAAYAAJ", "eJUKAAAAYAAJ", "EKJHAAAAYAAJ", "eKUwAAAAYAAJ", "emUtAAAAYAAJ", "eoxOAAAAMAAJ", "ePsgAAAAMAAJ", "EW89AAAAcAAJ", "exgRAAAAYAAJ", "EY0EAAAAYAAJ", "ey8EAAAAQAAJ", "EZ8Rd5IsjawC", "F4sEAAAAYAAJ", "F8ZEAAAAYAAJ", "FaoSAAAAYAAJ", "FfcYAAAAYAAJ", "fhUXAAAAYAAJ", "FIwEAAAAYAAJ", "FM-AAAAAMAAJ", "FtgDAAAAYAAJ", "FWQAAAAAMAAJ", "fz_91Zn161gC", "g1ugAAAAMAAJ", "g5IPAAAAQAAJ", "G7xfuc7lWvMC", "g9LiAAAAMAAJ", "GbUlAAAAMAAJ", "GEZaAAAAMAAJ", "GG8qAAAAYAAJ", "GkAZAAAAYAAJ", "gLCaAAAAIAAJ", "go0ZAAAAYAAJ", "gQsXAAAAYAAJ", "gSIZAAAAYAAJ", "GtAYVckH2FkC", "guFIqjynpO4C", "H0BKAAAAIAAJ", "h5UPAAAAQAAJ", "h8VCAAAAYAAJ", "H_XkAAAAMAAJ", "hBuind5qZakC", "hjoFAAAAYAAJ", "hlAHAAAAQAAJ", "hNoNAAAAYAAJ", "hoAEAAAAYAAJ", "HoJMAAAAYAAJ", "HvJaAAAAMAAJ", "hxwEAAAAYAAJ", "I2AtAAAAMAAJ", "i6tEAAAAYAAJ", "I7JiAAAAMAAJ", "i7wXAAAAYAAJ", "iAVPjpphQ90C", "ikk7AAAAcAAJ", "iywXAAAAYAAJ", "j0oYi3O_tvgC", "j5UgAAAAMAAJ", "j6auAAAAIAAJ", "j_sOAAAAIAAJ", "jaUCAAAAYAAJ", "JBM9AAAAYAAJ", "Jch56YUSRiQC", "JDotAAAAYAAJ", "jfUMub-wbrYC", "Jho_AAAAYAAJ", "JlEMAAAAYAAJ", "jq0TAAAAYAAJ", "JqYGAAAAQAAJ", "jR8-AAAAYAAJ", "JxI9AAAAYAAJ", "K1FbAAAAMAAJ", "k6g-AAAAYAAJ", "kDcDAAAAQAAJ", "kgd_kVh9-BgC", "KhMYAAAAYAAJ", "kJ5aAAAAMAAJ", "kLg8AAAAYAAJ", "KlsJAAAAQAAJ", "ko0NAAAAYAAJ", "kQ0mAAAAMAAJ", "KqtEAAAAYAAJ", "kRg_AAAAYAAJ", "KS9HAAAAYAAJ", "ksE6AAAAMAAJ", "kT8ZAAAAYAAJ", "Kt_TAAAAMAAJ", "kvAtAAAAYAAJ", "kvU_AAAAYAAJ", "KW0YAAAAYAAJ", "kWBAAAAAYAAJ", "kXUAAAAAYAAJ", "L_MEAAAAYAAJ", "La4aAAAAYAAJ", "lAYGAAAAQAAJ", "Lc0NAAAAQAAJ", "LcQXAAAAYAAJ", "LDhFAAAAYAAJ", "lDTuAAAAMAAJ", "lg4YAAAAYAAJ", "lgsXAAAAYAAJ", "ljIDAAAAYAAJ", "LnUTAAAAQAAJ", "losEAAAAYAAJ", "LtOmCdYVvh8C", "lwNbAAAAMAAJ", "lYkBhX6y39wC", "m54LAAAAYAAJ", "m9jVAAAAMAAJ", "M9oNAAAAYAAJ", "meQYAAAAYAAJ", "MH8EAAAAYAAJ", "Mjs1AAAAMAAJ", "Ml8Z1rQ74lIC", "mLs8AAAAYAAJ", "Mm8RAAAAYAAJ", "MQIwAAAAYAAJ", "mQVEAAAAYAAJ", "MRgXAAAAYAAJ", "mwswAAAAYAAJ", "MXQ6AAAAcAAJ", "mZ4TAAAAYAAJ", "mZURES_1HGcC", "N-sJAAAAIAAJ", "NBMCAAAAYAAJ", "neEIAAAAQAAJ", "Ni0dAAAAMAAJ", "Nk1OAAAAYAAJ", "NLoxfUPHoukC", "nPJaAAAAMAAJ", "NQ1AAAAAYAAJ", "OA8nAAAAMAAJ", "OAUnAAAAMAAJ", "OBlKAAAAYAAJ", "OBM3AAAAIAAJ", "OdUNAAAAYAAJ", "OEU_AAAAcAAJ", "OhstAAAAYAAJ", "OK8NAAAAQAAJ", "oLk8AAAAYAAJ", "oNEQAAAAYAAJ", "Oo83AAAAMAAJ", "OQ49AAAAYAAJ", "OrcnAAAAMAAJ", "oSFAAAAAYAAJ", "oUtOAAAAYAAJ", "p441AAAAMAAJ", "P6JGAAAAMAAJ", "p6o-AAAAYAAJ", "p9gDAAAAYAAJ", "p9gNAAAAYAAJ", "PA5YWOtJEq4C", "pGEvAAAAYAAJ", "PHI6AAAAcAAJ", "pJMrAAAAMAAJ", "pmAtAAAAMAAJ", "pn4EAAAAYAAJ", "PosEAAAAYAAJ", "PZP6WZKTl58C", "q7xEAAAAYAAJ", "q85EAAAAYAAJ", "Q8NEAAAAYAAJ", "q_08AAAAYAAJ", "QAHe1wTctRgC", "qaHRAAAAMAAJ", "qbV65PabTEYC", "QH4TAAAAQAAJ", "qHgKEqjdy-wC", "QKgVAAAAYAAJ", "qkZgAAAAMAAJ", "Ql0OAAAAQAAJ", "qL4qAAAAYAAJ", "QNpEAAAAYAAJ", "QPGBAAAAMAAJ", "qrwqAAAAYAAJ", "QSUZAAAAYAAJ", "QyQpAQAAIAAJ", "r-oJAAAAIAAJ", "R88TAAAAYAAJ", "RC8OAAAAYAAJ", "RDg1AAAAMAAJ", "RekoAAAAYAAJ", "rnEAAAAAYAAJ", "rog6AAAAMAAJ", "RqlEAAAAYAAJ", "Rrc-AAAAYAAJ", "rRwuAAAAYAAJ", "RUxQAAAAMAAJ", "RVQpAAAAYAAJ", "RwBbAAAAMAAJ", "Rx4DwJkT5l0C", "RxQ1AAAAMAAJ", "RYwEAAAAYAAJ", "s1gVAAAAYAAJ", "S1vRAAAAMAAJ", "s34EAAAAYAAJ", "S3JHAAAAYAAJ", "s6kLAAAAYAAJ", "sAvwDF6qvnIC", "SCVEAAAAYAAJ", "SdYQAAAAYAAJ", "SItpAAAAMAAJ", "SIYZAAAAYAAJ", "SmoVAAAAYAAJ", "sn8EAAAAYAAJ", "sOAQAAAAYAAJ", "sooVAAAAYAAJ", "sOPa9iabXr4C", "SYAEAAAAYAAJ", "SYIvAAAAMAAJ", "sZAZAAAAYAAJ", "T14ZAAAAYAAJ", "TAsOAAAAYAAJ", "tbCaAAAAIAAJ", "tBEqAAAAYAAJ", "tCgVAAAAYAAJ", "TFBOAAAAYAAJ", "tKf-ovCArycC", "tKoEAAAAYAAJ", "tlwpAAAAYAAJ", "TnMOAQAAIAAJ", "tQEwAAAAYAAJ", "trM8AAAAYAAJ", "troXAAAAIAAJ", "TucYAAAAYAAJ", "tyk6AAAAcAAJ", "U3gPAAAAQAAJ", "u4paAAAAMAAJ", "ua1ZAAAAMAAJ", "Uckq9uW7r7EC", "uK07AAAAcAAJ", "uNgDAAAAYAAJ", "utseAAAAMAAJ", "utvWAAAAMAAJ", "Uv8_AAAAYAAJ", "v1EHAAAAQAAJ", "V2EtAAAAMAAJ", "v2laAAAAMAAJ", "v6YWAAAAYAAJ", "V8k6AAAAMAAJ", "V9wqAQAAIAAJ", "vdAOAAAAIAAJ", "vjYIAAAAQAAJ", "vl4AAAAAYAAJ", "vPs6AAAAcAAJ", "vr0qAAAAYAAJ", "vT-JhEQSvx4C", "VwUXAAAAYAAJ", "W8ESAAAAYAAJ", "w9A98UIGNMAC", "wfIWAAAAYAAJ", "wKM6AAAAMAAJ", "wosDAAAAYAAJ", "wqU6AAAAMAAJ", "Wr1EAAAAYAAJ", "ws18cmj5ic0C", "wThMAAAAMAAJ", "wucgGgVliT0C", "WVseAAAAMAAJ", "wZAEAQAAIAAJ", "X3sbAQAAIAAJ", "x4oEAAAAYAAJ", "X4UtAAAAMAAJ", "XAICAAAAQAAJ", "xgnTteuZ694C", "xN45ZsUMgKEC", "XNgNAAAAYAAJ", "xO8WAAAAYAAJ", "xowEAAAAYAAJ", "Xqc6AAAAMAAJ", "XqsTAAAAYAAJ", "xSXEswj4D78C", "XV8XAAAAYAAJ", "Xw8WAAAAYAAJ", "XYRaAAAAMAAJ", "y40EAAAAYAAJ", "Y7sOAAAAIAAJ", "yas8AAAAYAAJ", "YDIDAAAAYAAJ", "YdjPAAAAMAAJ", "yGlKAAAAYAAJ", "YgMXAAAAYAAJ", "YiEEAAAAQAAJ", "yiQ3AAAAIAAJ", "yLESAAAAYAAJ", "yOQSvnydSzAC", "yrDRAAAAMAAJ", "YrMcAAAAMAAJ", "YuUyAAAAMAAJ", "YwYGAAAAQAAJ", "YXZbAAAAMAAJ", "YY4EAAAAYAAJ", "yY8GAAAAQAAJ", "YzbhAAAAMAAJ", "zEIqAAAAYAAJ", "ZF86AAAAcAAJ", "zgkwAAAAYAAJ", "ZMbWAAAAMAAJ", "zpwXAAAAYAAJ", "ZUzQAAAAMAAJ", "ZVZFAAAAYAAJ", "zX5BAAAAYAAJ", "ZZQpAAAAYAAJ", "-KtaAAAAMAAJ", "-MdHAAAAYAAJ", "4NpKAAAAMAAJ", "7wXy0iWQhmUC", "804IAQAAIAAJ", "85AqAAAAMAAJ", "adYISimWWB8C", "afgNAAAAYAAJ", "b5gXAAAAIAAJ", "bhEqAAAAYAAJ", "c_GqrxRZXO0C", "D2UJAAAAQAAJ", "GlQeAAAAYAAJ", "H5QYAAAAYAAJ", "hYsXAAAAIAAJ", "IkkZAAAAYAAJ", "k39vHp-5VeMC", "K3ERAAAAYAAJ", "K6U4AAAAYAAJ", "KKSeMHR3EFwC", "KYh-Oko3K8QC", "lAkOAAAAYAAJ", "ljEJAAAAIAAJ", "mNweaGcPNlQC", "mrc8AAAAYAAJ", "mSQpAQAAIAAJ", "N5H73sYXDxYC", "NmYJAAAAQAAJ", "oDQ_AAAAYAAJ", "OTcmIoJPZ8cC", "P2YJAAAAQAAJ", "P9AXAAAAIAAJ", "RMyA4SdL6e0C", "Ux0uD9EpS6AC", "v0kqtbR2RdAC", "Vm4iAAAAMAAJ", "VqgsAAAAIAAJ", "Y2AtAAAAMAAJ", "Y5tXt7aoLNoC", "yp4ZAAAAYAAJ", "Yvg3m1N3bWMC", "-GcEAQAAIAAJ", "dDUCAAAAQAAJ", "HR9AAAAAYAAJ", "-76GjNpR9VUC", "0tQjH8yzrdcC", "2KERPNCkMC8C", "4cAsr_eptg0C", "4yXOdjxolVAC", "5rF_31RVTnMC", "6P5RNn0NehsC", "9vZ64MLmVS8C", "_UNNPyZHBHoC", "cWQJJIgJNtUC", "eParwQ0YdrcC", "fs-cTvIegLgC", "g3x29UP5gnsC", "hKzjNMFba5gC", "IKSHVdYUzGEC", "injpY-EerZgC", "JHxxM6mOAAQC", "kOGSGjGmL0YC", "LBBhikJpLjwC", "lMQaeZb3_e4C", "RDTQs2y_h5QC", "RtuUTyHr-5wC", "RZll-GR0Oi4C", "TQ5rlfwgWyUC", "uf5x7GtHpjkC", "Wnc3V5m9kqgC", "Xqa9U42GP2cC", "yyaL8KoFHKIC", "-63xyvVTNwIC", "-A-wrak3BkAC", "-L2Z652rLYQC", "-MfC2j5hDFEC", "-vEXEPUJK4EC", "0ba36JZTUswC", "0dD9rHI5H5sC", "0HMvmNpuDf4C", "0iVqE9vAqloC", "0LUM-NINvEsC", "0NP8hnGNjAsC", "0Q6cMEkz8xkC", "0QmRFur9m7QC", "0Sb9rQ5Ewd4C", "0soTkTor_HMC", "1CCCWMqPtzEC", "1iaaMtRmIZMC", "1IjS2r3poyEC", "1s0fNs75eU0C", "1s_E7T5tdlEC", "2pxcG08a90UC", "2UyNR8wpDt8C", "2VqEXOH-b2YC", "2X59P60QHnYC", "2ZAptMWcCdwC", "3HDyoJBoLBQC", "3SB8yE4ndioC", "3zLSRa5lIyUC", "4_QEsBJLmy8C", "4GXEmkTTUpoC", "4In9TJ5L0VYC", "5_zAi06GKNwC", "5f1twMCxoqoC", "5gdqw3ax1KsC", "5L4An9lC3hwC", "5VhMcTIIoRoC", "5VMcW1f4fmMC", "6-EXBGEdjMIC", "61rslRcPoZ0C", "6c7jcmg3dEgC", "6pmBjSl35egC", "6S2GdoIPkKQC", "7EsxsEtV9sMC", "7VWZRVvoE0MC", "7Yhkld-Fr5wC", "7Ypg28yZ6aIC", "8aEwylFfsjIC", "8HDEs3wNLd8C", "8yG5UrYMQ-0C", "9AINECqE2lsC", "9b2VoLf4MzkC", "9jiJd8_5KnoC", "9L8MwyFsFvsC", "9mZvmEMwTKsC", "9ne3r2XzbzEC", "9nFwTXKoS6gC", "9P7h5rB2vQ0C", "9QCpUYKTwKwC", "9VYuMmcxSYcC", "_c95aA8dOLkC", "_Cfi6UiyNlkC", "_eohr5XMnBAC", "_mtzX3Gs9nUC", "_mur2PUOp8wC", "_rewTS4v-EsC", "_UKmhTR0ITkC", "_wKvp9btIvYC", "A9K5PSr_e4gC", "AfD1s_2f1FEC", "akHTeRj4JOUC", "AlGuOeb7pl0C", "axxlIDSbKg0C", "b6djRPYUZ8gC", "BBKEcM6M_BUC", "bJlyjzUWKCsC", "blQIWhUioFsC", "BNZ2-nzmQ_EC", "boA1HQSnefYC", "BQ5wbmtHFIcC", "bUba45txcJ8C", "Bulx3bJpc1QC", "BZopNYe5-qcC", "c2zhJMEYccQC", "C4Rqx1_fKLYC", "c8q-sGQ5GOEC", "C_bL0PRTQl4C", "cFhGyEREh4kC", "cJDfL_DR9GMC", "CkmPSW0uA38C", "cLec-hyjLJgC", "cMjSV6CDnOgC", "CpttRf7NQIkC", "cpW22SnQBXgC", "Crjx6NF9QAEC", "csc0gSSxSMIC", "cU-4O9xZmzMC", "CwYTKoE33jgC", "CxYXaAUJytUC", "D8UzeKZKKvgC", "d8WB2wJKKAgC", "DbuVW34eOEkC", "dELO9Pc3P50C", "DEussc1kYYYC", "DFzy1wgWL6IC", "dhr32lY_rt4C", "DNmjHtlFJUcC", "dyet0NcJMXEC", "DzlaPT_Bpz4C", "e2q53WFE7hEC", "e8aDEGSDCToC", "edFHvonqKX0C", "Ejp6LgTnSe4C", "eL6xymiJX04C", "em3obwwfGUAC", "ESr_AtJMl0AC", "eu-lSNjgkSIC", "eXgmkezrzYcC", "exPEZT-_rJUC", "f2D-5VU4K_0C", "fBazruOey4UC", "fCunxPYp_OAC", "fDjfkQYRwTcC", "fDzKNDKJPu0C", "Ffl0HCe_YV4C", "Fg5MjfVSQOkC", "fNl1sklg5RwC", "FOj7XJQuZGEC", "FPWSLAVs8jMC", "FS2DSJIHg9MC", "FVRqrE1V3fEC", "FZH5yr1VCfUC", "G4UH8cPE_VkC", "GCyjMr7CudIC", "GghRg6VmYPMC", "GifAXXyoO84C", "GIvkGVgSGokC", "gkaUu__vNDQC", "GoV9Aha9IhQC", "GVchqY1ZaB0C", "gxizgOuEebsC", "gZaqADTgdtcC", "h5ruQyEzfD0C", "h7283-AC8bQC", "H83nwxNyJMgC", "H_5zYEhiT3IC", "hE0FKGDTurYC", "HGnopNYgga4C", "HT7LP-hRhQ4C", "HwQD7Q7rhkwC", "hx4zw8cp__UC", "HxtpSewA1lAC", "I-RTiw0Z30MC", "ifc8QVdWijMC", "ifocmqVPHUwC", "IIgOBSIHmdsC", "IjJNEdgb7DwC", "IJOfUUtzn30C", "iRXHNkorlIUC", "itSPLM6udREC", "iUyrNlDbzsIC", "j1hzezxjN4QC", "J3gQzNyTyKIC", "JI6RrXDzH9UC", "JNgAP8k5KroC", "jNYDVy1Xt40C", "jOMGyirP81IC", "jPGAp_8TMZcC", "kaBCeLUbJtIC", "KAZvQcXJ0vEC", "KFWbc2tiav8C", "Kg-sqN8bu_IC", "KgSgVDI8c2UC", "Kq6EQGda_30C", "kqbwwzLe9_MC", "KRaNlo6MwskC", "KY7pygt5ImgC", "l4CEWzs7a88C", "lCMWQJPYQ8QC", "LdxfLieU0aEC", "LEXRtoAxEM8C", "lizAK72dCUMC", "lKq3n2S7I8kC", "LmCCGgBTqFAC", "lOREAqN6F48C", "LQUCLdA5sLQC", "LTNdsgWXzbQC", "lx7mQQ0mm0IC", "LxpcTkKOiJMC", "mDmcW9KR6r0C", "MF9KWcidqhcC", "Mh9n_9hsNmIC", "mJ7-gzmDRo8C", "MmJeXfkFNKwC", "mRX160l72-UC", "Mt9NFfWXW7wC", "mUEOJuwUAOkC", "mUYVmd01fuoC", "MwpER1ZbELcC", "MYII8Qi1-eoC", "N0GExYJKt0cC", "NHd1sxVg4XwC", "NPZYBrWZPVAC", "nRC9zn3nHIQC", "NWiG1MtLMioC", "Ny5I1aaSlSIC", "NzRpoHvMkS0C", "NzzLC__TwZkC", "o-W2-ayVm8IC", "of5TqT4nz4QC", "ofSWPafmlpAC", "OGU13cmmRUIC", "Ogzq_u_hOQQC", "OHqefo2QlCQC", "oiJW1KvR2MkC", "OKV8Nd7hKhkC", "On3XvILFah0C", "OP2Tp97s6AsC", "opqdY91BMrIC", "ORdZF5kVumIC", "oSXEwOdkpmAC", "p0dUyABx9SQC", "P7yZUMBcbxAC", "PbmmLSnghrEC", "Pc_nndglfn0C", "peudW5Nk940C", "poWks_q7X_oC", "PQh8kNVjYyQC", "PT96NDa3rOYC", "pV8oTgZ6B3AC", "Pyg-gr37IkwC", "Q1CEQ0AZh1kC", "q1JPyB4n7LgC", "Q2yO_wNMX74C", "Q5BuEKEe4pYC", "q6-Pgq6Bd0cC", "Q7Jk307w-XkC", "Q8g3Vx41ePwC", "qgJ4lh1zynwC", "QLSEY_GSuWIC", "QSzoTO6uw-sC", "QUNoPBsxf7AC", "R19P0tZxivIC", "rkRu9OJ6gWQC", "rMQkQxoUWXwC", "ROHwG0JvP-sC", "RoT8nuzZY6MC", "RqpYSuMLkacC", "rRQ-ln-SYnMC", "ryUDQKQHvRQC", "RZ_J2zSCsBMC", "s-IKDw_xNO4C", "S1aY04SCeCcC", "s63i21E9dr8C", "sAtrYgbkH5gC", "sbiC0dSqrY0C", "sbNgTt34a7AC", "SBT6pAV2oDAC", "sDh2VKlu28UC", "SEQr7Y2ESicC", "Si9Dgsb5BHAC", "SimBCSprSRUC", "sImIx4Fl_C0C", "SJe2yL_R6JQC", "SLwk6C7rVhgC", "SoxnKRQyj10C", "sQXNbuyxLb8C", "SUAwvChYnlwC", "Sv5OO0cJgSEC", "SW3Lmc_OJV4C", "sYzLfQ5In9AC", "SzOU6g8evBAC", "T0u3mLgB7Q8C", "T2Mp9EEd3ncC", "T53iIqrOcbIC", "t9XWY5VKJSkC", "tDi1X___kA8C", "tJtBDEjyGqwC", "tRHgqZAB8C0C", "U-fc5X0cUjwC", "U_XsG9AG6fsC", "UEqy0TZuT4IC", "uevG9aAp1IwC", "UFJC7ZobicUC", "UGHHAfRjnH0C", "Ugih6Tuam_sC", "ulWbH-4xtd8C", "URoDbjKxx3oC", "UUODSqSSrZcC", "uVr4HChPENYC", "vnFySPulSJcC", "VSGv9ygG1poC", "VWwH9SboEQcC", "VWyI9EAqpYsC", "vX0W3_MvZbMC", "W2JbNJSOA6oC", "W6AjlOPmznUC", "w8soxuejcaEC", "wFlu01q-wC0C", "whdtOuA58e0C", "wIEr8jXYBt8C", "WIXV1dms-8MC", "wk0YzGyyXzwC", "WpCOFC9f6H0C", "WsjanO7xW58C", "WULCfFrGFcwC", "WUuBNF1eSqwC", "WUyzf2cJzu8C", "wzPlQGKox1EC", "xc2N4ZOxtCYC", "xIcCXbnaKtgC", "xIp209jwYQ0C", "XRkDaOf0-uIC", "xsv8s0uId1oC", "xu-4HeilOhAC", "xuRUA92_Dc4C", "xxBV-d20EWQC", "y11kvNfIDh4C", "Y7du4IGkNagC", "YAC7D2qEu4kC", "YAv9Gv9ZIbcC", "ybOLU8HOjA4C", "yKKMZ0YNLR4C", "YkVmgI7YvxkC", "Yrehcfj2IVsC", "Yso319xUOF8C", "YSVeIm0jLy8C", "yUq1AXoC88kC", "yv5tR54Qs6sC", "z_7igwZUWX0C", "ZCAOHdptArYC", "ZDmAWWNzsZEC", "zejLZgD7VDsC", "ZHwey8h5Kj4C", "zmq2Wj1c8HEC", "ZOB2ex9u1tMC", "Zp_b7CdQnzwC", "ZrnT-eIoVp4C", "Zw9g-dT8eoMC", "Zwrx6vQxbJsC", "zzlNJFc4vngC", "2AcIZCyQSJ4C", "2paepcVm5OQC", "4YveGexFFDMC", "8jWTiB4UdQAC", "_uxrn_B6nQIC", "A8VCSfVYPXUC", "AikWxorjwGQC", "BtmfGBNcYEkC", "dVcZCGfVIe4C", "h2xxgNZCriwC", "haumLq0jxWcC", "HlzdO2mJQCUC", "il-v_WiwlWAC", "JdIRcVfYnz4C", "k6zNhshVrcoC", "KBNBgBEerZAC", "Obp2ZR6DlakC", "OFcR4TvqVoYC", "Pbau0vKNAbkC", "Q44VAAAAYAAJ", "Qe79lVUM-_QC", "qGYlK0eIz1wC", "rM7WpdtOBVUC", "rvCzitUx8T0C", "SxWznUkU1Q8C", "U8zhW9KiI8kC", "Yfn_BXJSu3QC", "1OHRziUwLsEC", "5-vJJ05fpH4C", "8Fy9NHweW9QC", "8RDs6-P8UPAC", "AmESXDfiId4C", "CUMCimMYu_oC", "D2YXySdvGBUC", "dDue614KRskC", "Fl2TlTNtPQQC", "LSup9PQoUyQC", "M04TpCjQiDwC", "QJqyBQlzZh0C", "QlLMwIkHVu8C", "QMpe1tnNw_MC", "ubodMGnHnx0C", "wFVpT3msHPQC", "xNeAB0U42wIC", "Y-CAUPszuWkC", "zagXen2NMCQC", "aOc0AAAAMAAJ", "AZ5J6B1-4BoC", "i1aG-J07IQoC", "jIoVAAAAYAAJ", "kdEWAAAAYAAJ", "MJbBqn3XWqAC", "pDsVAAAAYAAJ", "TF8XAAAAYAAJ", "tI9POJ_lt0cC", "vmTcK2ujm_IC", "ys_e1Jaxh4UC", "zF6v7bX__SQC", "ZT1ISWyvOIsC", "--ibAR9NbugC", "-1Y9ym5upKoC", "-3NrCV6J2KsC", "-4Pgj7M8hXgC", "-4SddBE1Jf0C", "-4WePVJ1wIYC", "-5fImMZMqNIC", "-5psJnxMC-AC", "-6UMvdimc98C", "-9aHZEHwiFkC", "-_9N_G37WtMC", "-_w_YYplL7YC", "-a9KHxkBTRYC", "-aRbCZD5meUC", "-ceFU75KyYQC", "-cGu6MzXGdMC", "-cjQ_VFIKFYC", "-dzQjAj3Qo8C", "-egio-BOBmwC", "-h6g9YQtqOEC", "-HYHXdQ3r20C", "-JK7pvrqVkIC", "-jn5U4kMP70C", "-k8vEgAN9jQC", "-LM59cdVOoIC", "-mNgBjHm6J8C", "-oiqw5U0jtwC", "-ooprFiVHV8C", "-Pc-cly_MM8C", "-pL56OcVubgC", "-PS1vVwZlsgC", "-pwMzSoZXfIC", "-qTi684jOfMC", "-RHh4GUmTbkC", "-rqyelbWrv8C", "-ru4OLlK_mYC", "-rWvh21kIiEC", "-S9N1h_RS-IC", "-SJ34Bo7JkMC", "-UcT6EIFG6wC", "-XcTWNLWmfoC", "-XGKFJq4eccC", "-xY35wmSePwC", "-xZfsQaaEfkC", "-yojHGlT30QC", "-zNdL180tAUC", "-ZSnoryMMEcC", "01FH6rqhAdoC", "02EylVe0DFgC", "05S8Ghpb2lYC", "06VR1JzzLNsC", "09eSEcXZfMgC", "0AtcI8aX9oUC", "0bMi22WDcvoC", "0C9tmV5ZkpoC", "0CbXmT94JagC", "0cOisn_j7mYC", "0COycjY-X18C", "0EfBgf9yr9IC", "0esmlyerDSkC", "0fbzCqQxbAMC", "0g97pJMu5_0C", "0hE74zyWyZ4C", "0HGaPH7KHH0C", "0hggJhQQQboC", "0IISbOC1hL4C", "0j-GAuXtcJ8C", "0J_dwCmQThgC", "0Je6or83PLIC", "0JEHHEq8VXoC", "0jmSmmjNosQC", "0KkogWPA6yEC", "0L_SH1ZcyDsC", "0ldowI6VgeMC", "0ljZSb-vhn8C", "0MfBUbPXnhUC", "0nAX4b41wigC", "0nBkuP48QjAC", "0NDxIWsNL4EC", "0npm-wVKye4C", "0NsMRapT6wYC", "0NSUmao2y_oC", "0o18v9h3pzkC", "0oaXBqUgLyQC", "0p0C7Y8lkH8C", "0pFGZM1Rpu4C", "0QEvzycAuzQC", "0rfvLAfHgf8C", "0RifYwKgPSkC", "0S4QxobZ-zkC", "0SCGVmOUh1kC", "0SP5CQnZCqcC", "0tyYN4G2UdYC", "0ulkXLmBB6MC", "0VV2a9fqsogC", "0WhvTFmRDCQC", "0WwkVUVl1wcC", "0x02wzd0vSEC", "0xG8XcpSsM4C", "0YNh9MEwvjMC", "0zKAg9_ZOs0C", "14j1SFs8W2YC", "160nucimkPcC", "18OA-2EH7i0C", "18TiYN9V_NwC", "19CaOeVNCEMC", "1A0Ek7Lh4x8C", "1A6owBxgNWEC", "1AudF25g9gUC", "1bFTj5SdZj4C", "1c7qn8yW7Y0C", "1CSFPgFIjQQC", "1cVjTTew6YcC", "1d7VM0OYgxYC", "1D9VuhtsX3sC", "1Dvix3Vp6IwC", "1Dw9122O0fcC", "1EnnWsMI7AAC", "1FLA-TN8Z8UC", "1GD9EJuZ-lAC", "1gDElomlm3kC", "1GKdgtGDMaUC", "1GYH63-fARUC", "1hssUnKAd0oC", "1iEHPtB7z0YC", "1ihWzPEfnHwC", "1j_bjwvCNy8C", "1jHpt9hdreoC", "1K9iHdLz0BQC", "1Kg9CvvTbWwC", "1l_AG7QjxbQC", "1LbmPEiFrd0C", "1LfvKSPY7p8C", "1MfnAhBwnLQC", "1MP0aRSQfpkC", "1nryStNrSIIC", "1OTbzCGIT2YC", "1q7teTeLoowC", "1qmVEYZVpqMC", "1QvQvXQurCYC", "1qwIfOyNkokC", "1ros72xtlOkC", "1rPknQQBGtUC", "1RrNMm-5zeIC", "1rVOwNDT6q8C", "1S_x40iLuXkC", "1SA4DTXdz-oC", "1SLjrKYIc58C", "1t_4SP8nLEcC", "1tfvtsCwTIsC", "1UMToaDBpX8C", "1v5o2uw0GJAC", "1vbW_2dDc9YC", "1VTpqPB699wC", "1wYMuHxDK8oC", "1WYZ51Ljh1wC", "1XQpFu7FGAQC", "1xwxFTU2jXYC", "1zFrYtQm0QwC", "1ZLRGbvpEWIC", "1zmhHT7lIc0C", "2-FJDJ_nAFwC", "20NWSX5PD0kC", "20v7lhXAkQcC", "219sHUkWF3oC", "24f2fyhIP-MC", "24qMnDsXwsgC", "24YDkYK3aqYC", "2553gQ8wUjkC", "26h4gMPmPtcC", "28llA7U-z78C", "29eHuTCVt5IC", "29mgL3HjD6MC", "2aLasS4OXXUC", "2Bt2rkbCArcC", "2Bt3uIUm59wC", "2BV5E85l8gwC", "2cGPtTQ_eJMC", "2dBA9kEx47MC", "2dqayoAkHiYC", "2Dus5Y3WuXMC", "2eAieKhtAgYC", "2eKRXgXfzDcC", "2fLp5OLd-xoC", "2fqYeA2vysoC", "2fzpu5w7uOIC", "2gB7w9XlNJAC", "2goK4HJO2VkC", "2h3jwRbgh80C", "2HS02CSh4nYC", "2IG1mdeOEQ0C", "2IlrLUp90BQC", "2iWvaQyc9WMC", "2Ix6kR6iN-UC", "2jJemY_31AYC", "2LXIPoESG9kC", "2LzRkWABC6sC", "2MDgpHemzl8C", "2MeFvILg4jYC", "2mVQBbt2IhoC", "2ndvJm_ZheMC", "2oNiyXm2EjoC", "2p1MDAUcSu0C", "2pfB84aGUnMC", "2Q5CVMfRwZkC", "2QduA19d_X8C", "2RZZkv6xN1sC", "2swMQcqFcRoC", "2TZB0WV2ZcIC", "2upIJbQvmVsC", "2USxB4t3L9IC", "2v6K1Ny71QEC", "2vE-LvK0CuUC", "2vPISwlI86MC", "2Vtz2U0YwfYC", "2w21xW6Vde4C", "2zCQwpUiBQ4C", "2ZlyuvWbEzgC", "2ZrrIjNxnzYC", "3-miZHcdkrsC", "32WbDlmSvpsC", "34TzVbxCItMC", "36j09FX4Ho0C", "386tCTzeb28C", "38KxG4A8M6oC", "39-p0VTOdc8C", "3_374h5dBk8C", "3_9fQ3P2AvIC", "3_PuMHrMo2EC", "3aIhHQYywI4C", "3ArOAow91GoC", "3c3y-7X-64sC", "3D8OYIZRwsAC", "3egTJ6Z7D4wC", "3F24Bn6VhuUC", "3Fp_29EN7KcC", "3fqYGB4mxLgC", "3fxJth8ZwqgC", "3guiSGdgTVgC", "3h_aBCo6i7AC", "3HiqvIUWgf4C", "3hnQHPbFJJwC", "3hONWeZgkNIC", "3jK9ZlXeYdAC", "3jN22xIA_bQC", "3kNEq6fWHtkC", "3lEMxqeDI5MC", "3MIZKq1ranYC", "3nJMjtyGp1YC", "3nM1F7y2P4sC", "3nsjbUfUGVcC", "3phhwh6iKH0C", "3q2Eq8zgmgEC", "3QyrAf9ZG9cC", "3r-vREFcj7cC", "3rZw-_EPVf4C", "3uaYUrb3Nh0C", "3vstCdOrqbUC", "3WOUyq5v1vMC", "3xklog5kVGMC", "3yBfin-sKnAC", "3Yik-OVE_HEC", "3YlSMGY1TdsC", "3ZbIPm4dIg0C", "4-bTU49pdzYC", "42D8PCCBJzkC", "42Wb1DeDZjcC", "430eDScz92cC", "43NxnhZ6FsoC", "43Od3MQLYlgC", "44r9DSS8KLkC", "46ymyCa1wxUC", "471OUKKACq8C", "47nrSBRxGCIC", "486z9lE-jdsC", "4_AgRbcIr6QC", "4_iJAoLSq3cC", "4_z4WYiQkWIC", "4Akl8rzi8bYC", "4aNoFpNfYeMC", "4ASrUa2wyaUC", "4AUbNnnOzSAC", "4aUsKOTquxsC", "4bxhMCnmH9AC", "4dZ2XSr8Q2cC", "4E2lRue5TDEC", "4EKH5xb_9noC", "4elkHwVS0eUC", "4fiy0MYLs7YC", "4g13OnwNmGkC", "4GHIciD_CuAC", "4GpPGl-79HgC", "4gTg6RtCcwQC", "4GTKnxS0B-YC", "4H5adAo97PYC", "4hAc96cz3GUC", "4hTRWStFhVgC", "4I6Xt87fcIEC", "4jqKPqwvtuYC", "4JqxfgmYR5cC", "4NoL4waMF5MC", "4nzKiXyBbpwC", "4Ob94oaPjLAC", "4OTWxs3Xde4C", "4Pc4HWtsNx0C", "4PCa-OIL34QC", "4PDdk1K_AWYC", "4pmUjowqAzoC", "4Q5KuGoCDnYC", "4qtSF3BUbjAC", "4R5XBB5OKMYC", "4ReQ21nFIugC", "4ru6F85wGK4C", "4srHsnlrlAwC", "4ur4EOhMKxgC", "4uwZ_1DB8l4C", "4UyjzqBHRjMC", "4Vo0HxFivFoC", "4Wzg6wFJ5xwC", "4xqVZn47PIEC", "4Yog2csUCFwC", "4YqLWN2wjyMC", "4zd2rtmcqT0C", "51hqhyw5yLoC", "527fvY25QWIC", "52NGYwngkEAC", "535UHUWJUckC", "54hwWFwzvioC", "56R_N48VhnkC", "57wpL-kZkMIC", "58mx6oVGhR4C", "5AO87IbZ9CMC", "5Aq2JES6y60C", "5AWb-FEssXMC", "5BcjJrvW_k4C", "5bjgMS_VZP0C", "5c_gqEyozHwC", "5cMpxa9oLMAC", "5d6sV9NBYssC", "5dGBCJpdiMcC", "5DtSTKa7bO4C", "5DTSzxqYJOYC", "5FwFRu-KpoIC", "5FX4p9_1WdcC", "5g3YDlPvbeMC", "5GppqmU13pIC", "5H5Xwb0TuBoC", "5HtUn_dUmSYC", "5InIv4DbrwYC", "5jgs0k-XgZkC", "5jmer_whYZYC", "5jUzOCHaYAcC", "5k1D1TO3iQEC", "5KD4r_CYSjoC", "5kKktfcO7MIC", "5KLXsi4Hh78C", "5l4LUWI4__AC", "5LlddZgi6iYC", "5M_3ELtQQIAC", "5madOAUfKZUC", "5mBLFoDjM4UC", "5MLnr1BvaIEC", "5NBEubMrYCMC", "5oqluDvU9KoC", "5pFr6qrQb-IC", "5Q8HJIFhYG4C", "5Qo7FyPk7NMC", "5rapCfxxAuwC", "5rPbbFDSf5UC", "5rpdrfA2T9YC", "5s4263Q-xGgC", "5sBfwX6MqLAC", "5ScMu8WQjdkC", "5SvMghMF9MMC", "5Tf1QlnRbSIC", "5trx1JKxflwC", "5vcRmfvu3IgC", "5XFBBCvU6GoC", "5ZE_KUbOduYC", "5ZmNcrZuAtQC", "5ZVQYNczX8cC", "60k0Q9tpmKYC", "60RXI4Ql0isC", "60Z7Nmd05FYC", "61XoxwU8-7kC", "62498N4bQBIC", "62lgnny7vBcC", "636vJjnZIIEC", "65oYmARUPfsC", "65r1hSAq-dQC", "65X8cs_dD2kC", "665bZ8pwh-QC", "66ObtMtso50C", "6_bKL2anJpIC", "6AQh8rnlh3kC", "6aWcWDC3TLIC", "6B1KbSMzyD0C", "6bkgqiot7Q0C", "6cilOe8HrQEC", "6d_CXeCtmiEC", "6DHvMpwEzMIC", "6eEa5vcPW04C", "6fsDrED0iX8C", "6guLi7s0cpQC", "6H7ulUGEEooC", "6h_rIembAowC", "6HxQEzZcULEC", "6I6DaTsb7o4C", "6I_XgRJaBL0C", "6ik1kifDF_oC", "6iLhjabWnl8C", "6jhV6vRcbnEC", "6L4oue__6GgC", "6MazKMAhAPYC", "6mZJ3084ouAC", "6nGNXGARG1IC", "6NUSbK-8bpQC", "6omp1WoHuxMC", "6p4usBy65FAC", "6P_kU72NBJUC", "6PMJl92rdnsC", "6PZjdLGhui4C", "6qLYEzQdEQ4C", "6QOxw11Ay7sC", "6SB17J_nFI4C", "6SbuTgPmLLcC", "6SUMel5m5Z4C", "6TZ357AOYYkC", "6UmIXBfhCGAC", "6VdyB4rKOicC", "6VXkHAfQ3wIC", "6wFHth05xkoC", "6wRUX7MkwoMC", "6wS_ijD6DSgC", "6Xg_4XutcF8C", "6yJgat3DGpQC", "6yoK7Vc4It0C", "6ZnrAf_6qnsC", "71BIq6WlZHIC", "74fnsRmeeZcC", "74IxULN0gMIC", "75lu6O9COfkC", "75MFGEDPaEkC", "75VcWvFHayoC", "75XbPC-KNrYC", "78FYunWVxRMC", "7_kOF_M1-KUC", "7AFwtCfB7acC", "7an9QXLFAjUC", "7AVkLNqAXNgC", "7bdvut8WP7cC", "7bTaHr0aRLQC", "7d1sPO13R1EC", "7eepHa_auJYC", "7ejh1RnNDt4C", "7G_PDrC4i44C", "7GIZt27ghV4C", "7GKlsIIKIFwC", "7glfIaLXXl0C", "7HBjQKtkJfEC", "7Hm_x32WxHIC", "7JleDMZzqAkC", "7K7btCVXqEcC", "7Ka1tCuCSe8C", "7kmTeOjHIqkC", "7KoHDheyeLwC", "7koU8I73-ZAC", "7l73MSV5egEC", "7lVwqywir4cC", "7nApdqEwVUgC", "7nVx9drTk10C", "7oROVAHE4a0C", "7OVLn9anvUUC", "7Pn5L3ughJkC", "7Q9Aa2V0lAIC", "7qDcC963BiUC", "7QthwQXdgrcC", "7spIVm2l22EC", "7T_pCvdDUaUC", "7tsLoy-EqqcC", "7ubpShS_NNoC", "7uKs4fKOotUC", "7vC8lb2LmXEC", "7WrCSCqMk5gC", "7wZDnZ_SiO4C", "7X8bKjnsHO8C", "7xLbhRJ16k0C", "7XoCr6MnKBwC", "7yNyE-KnjlQC", "7ZlBLYPr5QwC", "8-jO2cfz-VwC", "8159Iuor26YC", "81eLz91JljEC", "823-9jxPCpAC", "84uZ3ZHG6T8C", "85UFLsRW8roC", "8_9uh4yBAl4C", "8atLfmOFeuQC", "8bmry5hlWh4C", "8CugkWQbJysC", "8DOn30Qyw30C", "8ewCpaBQyUQC", "8fdJR9HWZqMC", "8fZ8-kK0hw4C", "8HDKuioUCpYC", "8i65CApWCnUC", "8JG5zJYz7CUC", "8jYwuP_CjhgC", "8Kf1No-4hQgC", "8L8KKh5wi5YC", "8Mj32gB7y3IC", "8mUAIXRsBLoC", "8nelbdOwdq4C", "8noJOaaVU6kC", "8O5x8sSAx4MC", "8oS85GWI8OoC", "8oWTPPpsUMQC", "8P4SGL5aoW4C", "8pODWye3Ob8C", "8POir4-AgKEC", "8pQROr5O0_0C", "8qg3Oetnx0AC", "8qHS392kglMC", "8qjgCKbYltcC", "8rtOsFjVFz0C", "8SBem707Yt4C", "8SkFHEBeEqkC", "8tUVMSsC9wAC", "8usCJVZY1vkC", "8uYCrSyHP5sC", "8v2CpAHixHcC", "8vUDE1eb62QC", "8W9Tfg8FKskC", "8yiDXnF7Ov4C", "8yW-cyScA3QC", "94JNerM50YQC", "959sKkDoLhoC", "95Kog5v4ZxkC", "96I7DN6USWQC", "98eI044RjlwC", "98neg1g3TVwC", "9aIS36Ls1BUC", "9AYE6k0JlNoC", "9BsQnk11wU4C", "9byEjVLRTo0C", "9cCm0OfLJNoC", "9Cgg_vy7564C", "9CHY2Gozh1MC", "9D17GGcyTSAC", "9DK7ks9IWXEC", "9dwxo6JrZucC", "9E-Nnf6Fwg4C", "9FcHJ2mMNDMC", "9gtbYzuaEEYC", "9GZxaRT8xxwC", "9HfzJ7pC5hIC", "9hMP5ZMu6bIC", "9HwlumbzHh8C", "9Ih79U3L6XkC", "9ins05KVIIUC", "9JL12VkSsCEC", "9jV2bzHyu9MC", "9kjJTZCFsTEC", "9LwpJ6vDsdMC", "9M7dSx9LZe4C", "9nzblUF0eAUC", "9OMcWS5K-JMC", "9onchuJ-bFkC", "9Ovgjh1n6j0C", "9qSiBeZ9g9YC", "9sVoO8hU54UC", "9ULQh89IINgC", "9Uqbhvte5XsC", "9Vd-omTdYlAC", "9vDpbW34qqIC", "9VGdzQAgkCYC", "9VjP5GOScxwC", "9Vq50oaOocgC", "9VujMtI10RwC", "9vXYz7yEG9YC", "9W_VB5TjxxoC", "9Wpi2Hlm4MwC", "9wQEaXEixGEC", "9xLVEPR-ax8C", "9xUzU2cj1dwC", "9y7YwwpBoaUC", "9YlO33BHSHYC", "9zAb6Y6pX0sC", "9ZzWRz9x8mwC", "_-9MFr6cPVoC", "_-bp1p3HgPgC", "_63ta-thTJMC", "_7GjfLUd1WwC", "_7RD2jwMU2wC", "_98d1xdtxC8C", "__3JqZOEp5EC", "__gCuLAZ8uMC", "_BACCuQFqRIC", "_bgzRnh4uvMC", "_CK8U_bzgKQC", "_eddVnC3paoC", "_EHHasGKCGsC", "_ExE6OQPiGgC", "_f9zqlrcyO8C", "_FCJWkq9KrQC", "_GnJbq2iFUkC", "_hPWVrQRMf4C", "_iAlLypvvfoC", "_ibuYRplNHQC", "_Jk8MqimEX8C", "_JpZrM94YR4C", "_ku7YLTev3kC", "_lRFOjkbwZQC", "_LTiSkrUhBEC", "_mle6G_iil0C", "_n7CFCn4Bp8C", "_n_epREv668C", "_nyan_kWIAgC", "_nz0jK0MJlkC", "_o7aIHckJyUC", "_OG54CMBjAIC", "_oL0dCJFmisC", "_P5W5ErBQRYC", "_pK_qTbfTboC", "_RWMbWAFgKkC", "_thyQHEuT4EC", "_UhVaWHDKOoC", "_Uwy3JDboDwC", "_VfWsBMSLi0C", "_VR8JnUErcsC", "_VUf45FZR7cC", "_WT-4kawqfwC", "_WZJrC81yFQC", "_Ybt_zNozBQC", "_zn3mGYYu-QC", "_ZVFWAQUossC", "A-xmIRhRqTwC", "a1s71u3ecbkC", "a1xVJU0TTUsC", "a2YtdM1kNOcC", "A37cr4HAPPUC", "a3BwzpHgqxEC", "a3CzoaCAFuUC", "A3KRKpQmDTQC", "a3vpnWCjI9gC", "a4EHi8i8vKcC", "A4FlatJCro4C", "A4KSlbYtIe0C", "A6TPi6fp-uoC", "a70HDMVS3goC", "A7fvvz9Puf8C", "A7ZC50U1oRAC", "a94RqsnuXKwC", "a99LnCcGJ5cC", "A9IxOrv-R4QC", "a9JI4DQz1EcC", "aA8SOiFWxZgC", "Aa_Y8uZAhBMC", "AAbqWAMDbIYC", "ABbCI7z4UwMC", "ABp6Tv-fI-sC", "AbpcegyuZXEC", "ACbAE5UBipkC", "aCZqlP1sQ1sC", "aDdiSKR9FM0C", "aDHKcmoCTPEC", "aDubQFDT-RkC", "aeJHQL1pcXQC", "AFBraBMN6_AC", "AfBzWL5bIIQC", "aFkVv3pStR4C", "aFSCzaM9udYC", "aGAEWDI3SR4C", "aGfLOwZpiVoC", "AGLf_DHdLnwC", "aHGkzwyTamYC", "ahrnGNSpsqwC", "AHVDtveqlpMC", "Aih1JWFo-V4C", "AIKDH1Cj2ywC", "ainFnR-j40oC", "AIOAx6dQvDsC", "aIWeYVc0oF8C", "AJDI7v4LQ8YC", "AjGP0FxZPjIC", "aJpvNKQuIhgC", "akCti9PoMtEC", "AkdV09wlYrEC", "akSN21Lmk08C", "AKVCLBIHI-MC", "aL0Hac3Vkt0C", "AlSJt1fr4gcC", "ALX9A1_RphsC", "aLyWOYcC3zAC", "AmG4eysFl-QC", "aMnfXh7vR5wC", "AmVYKzTrAwAC", "ANqfqIU-CcsC", "aOcP4_I5BY0C", "aoqB4n95pSoC", "AqvCtK1kMooC", "ar4-mvqsDpgC", "arsC3XaMc8AC", "aRXw5s8dIa0C", "ASADBUVAiDUC", "asfMR1SHK3MC", "aSlsTWM5vKkC", "aSVMepyMsgkC", "at_a1W2T-cMC", "aTHN_UCm-j4C", "AtJFLz50tKwC", "ATTwQVlUWq8C", "aUg2zQ9JpHQC", "aUp2tCXJXvAC", "AUpDiXOndHUC", "aUpXCkefjzYC", "aUSi3pnKFBoC", "Av3TOpuoAnYC", "AvNcbH1YJPsC", "Aw4AbukNCzwC", "AwB4KfFK8sYC", "AWBwHDU24agC", "AWT5lQojEAcC", "AX9nvlKGHk8C", "AyNAatS5qqwC", "Ays4piyTwq4C", "AzF2gSsVKwAC", "AzPA1HkjlngC", "b-jYDn0W4jgC", "B0wtpZfwHN0C", "B0wUhmZ-NTYC", "b1a83Kk4DesC", "B1BFDofS5SoC", "B3JKLQKkStwC", "b3lBRbqekB0C", "b4v3Y26PCXEC", "B5wmGGlP1EIC", "B6JtLrtLaCIC", "B6R4wOfCIp0C", "b70POfydeDAC", "b7t1qbZ_QFcC", "B8d9iJ8apgkC", "B8I5SP69e4kC", "b9zjAJfAFa8C", "B_nl_2GbkJ4C", "ba_b6tQkhv4C", "bAnMckqrfeoC", "BAoRdCd8TmUC", "bBefvXbMFBYC", "BbFxn48V63YC", "bbumz_zoKV4C", "bBVDgM-P9FoC", "bcefaXa6Q1kC", "BCfA2O2fTwoC", "BcFbVTfg_W0C", "Bcl8jLxcXboC", "BdeTbmRuc00C", "bdhRK0tS48AC", "BDt96S0N65AC", "bE0GRAGGUrMC", "beFcfAQa99kC", "bEHuIhK7J7MC", "bf2HhCbOAHIC", "bfaha7FaYhwC", "bFEOaD-mxC8C", "bgd-Xz5ZT38C", "bGFplIW399wC", "bghSgDwrzToC", "bgnHHqPg6R8C", "BgyurV3ICEMC", "bH3B2P9XcRQC", "bh6QDsR5tpUC", "BhWn8Iz8LR0C", "bIdjWgGc_2IC", "bIfMKp_mfesC", "biT8dZq4PuYC", "BjOJBR54jkIC", "bjPId1bPwo0C", "BjT9KvXEfywC", "BK-LtH8d0esC", "BKIY52Z8pgMC", "BKRO6PnCH88C", "bKVCtH4AjwgC", "bL4TmnauSkAC", "bl8trXhzTS0C", "BLACCNPoWdcC", "BLkGyV8RhaYC", "blLlgCHPB0sC", "bm3VNPlOTQoC", "Bnfbypa3BswC", "BNg8tdL2IdQC", "bNO2fqChNnQC", "BnsPcZW4G7YC", "BNXcn77NIhgC", "BOrep3yRZ_QC", "bOU08nfl1IoC", "Bpe0K_52NisC", "bPIcDjVeFGsC", "BpSGbZ1FlMsC", "bPT9BEcB9yMC", "bqjywa-XgVUC", "bqk8lFZbwuMC", "Bqm1_Xe9ry0C", "bQs3aed0XpAC", "bQTvg2fenkYC", "BR_zWeWMyvkC", "bRelf6_a_vgC", "bRHIrE_15IQC", "brHZvvgElL4C", "BrztZcFdZiAC", "BSTNdiLXE24C", "bt7t6ns2KKUC", "BtDz3DX-wrAC", "Bteluw-7IuEC", "btiYGZoxIqgC", "Buh064bRpcIC", "buhJIDwSfvAC", "BUJFpYcaUnQC", "BvIi0x57o1IC", "BvOjlSpjHlIC", "BvR5XGRoUp0C", "bw9TzuCg-XYC", "bWam1RUmr3oC", "bWjUf040CJ0C", "BXjz9OQ9244C", "BXrHqqUYu0QC", "BXUFSlTjS0MC", "bXWadNV-6u8C", "bXwlMj4U7DMC", "BXxL19gkswcC", "By4_hzAoz2kC", "ByGCiNwH134C", "bYP72LvvVwkC", "bYVEgXbiunkC", "BYWO2bedmg8C", "bzmmbxAm71wC", "BzNdfTTR05sC", "BZzefDlot_UC", "c-3traD-fqwC", "c-uDXSRWKtYC", "c-umCCjv3SYC", "c11HBwElG-4C", "c2b6jQ8g3sAC", "c35YVifvGekC", "C39nU_byNRcC", "C3jKDBqihB8C", "c4HfcwdQOx4C", "c4Uo4t786NsC", "c4YgBy8UPcsC", "C5WIK1vtjtMC", "c6pIcEenHasC", "C9HN6kAsf7wC", "c9P0pzEobeIC", "c9pTsKXcDawC", "c9qVVZnC7zUC", "c9xHWQFTL6oC", "c_A_wfFe-CoC", "C_E4lDNIR1QC", "c_lN_q15ZiEC", "CabxBb9clOIC", "caEQOhtS3hAC", "CaERQZBhilYC", "CaP6lLd0dwAC", "CAvUH3oP2eoC", "CB0dA-ZFWAcC", "cb2xefiR0D0C", "Cb6qWgecAW4C", "cBnMKPwfW10C", "CBTrm7jkzpsC", "CBvLF7bfQD4C", "ccjm9l0QB7gC", "cCQTcs4l1JsC", "cCuFrbe6vmkC", "cd4Z3HcEO0QC", "Cd5-_TCGx4YC", "CDkv3NDfwVoC", "Cds_cZtYcScC", "ceHgmfCMoasC", "ceKTSaO_9X8C", "CEnAWRgbntsC", "CfdJBs11wvsC", "cfHQCqaLYN0C", "CfnHttupr28C", "CfNq5z1tAEEC", "CFp8EVv7if8C", "CFPrzcHtzSsC", "CFTr0KgoL8EC", "cGJPWgPMCNQC", "cgMCSrDxKGAC", "ch_1YF1-KBcC", "cHAkoOH2DMUC", "chi2uKo8ZxMC", "cHoIAP6CTkoC", "cIcKnR6xSrEC", "cIFiNRH3oWsC", "cIjjp65FSXYC", "cIyvVjQb_pcC", "CJ-0e0aOVWsC", "cj8od4sef7wC", "CjCwAFaDRHwC", "cJif5Dq9CyQC", "cL7u1-hoh_sC", "cldKKwvF284C", "ClLma1ICDlMC", "ClNVt6WTbb8C", "ClWhWKmi0TUC", "Clyj7FsJ-o4C", "cM1bbraEf-wC", "cM_nIqO2C6cC", "CmFIQ7IxOSwC", "CMLtWJG2rLEC", "CmT_hQsgbmUC", "CmUAxTtJ9zkC", "CN2J7TYQbX0C", "Cnok6Lc7iSkC", "cNRpm1CDonkC", "Cntm93auIewC", "cOEJR5fIGEYC", "cOgcKVnLYfkC", "CorzOY37E0wC", "cOsjF0LQ4WwC", "COT8nZsi6zYC", "Cpn5r4pZl-oC", "Cpo_2d7tixUC", "CQ0EbEkT5R0C", "CQN5a45npM0C", "cQqB_hiupPgC", "cQUnrIAaETIC", "cqYYnh2MVr0C", "cr7dpSLxZy0C", "cRCPp2i9OvsC", "CrIcAjAOsE8C", "cRlHpXV8AbIC", "CRnR87UQbMwC", "cS2P6PlrSgwC", "csMB1KOk-gcC", "CsULPe9EgpkC", "CsUSjmbYMTYC", "cTcDy6hSxakC", "ctgEoKKPpZoC", "cTIDvEUe5M8C", "ctjsg8adGaYC", "CtuGKiTX0W4C", "cTz3Jefso-EC", "cUDLrfCvQiAC", "CUIyI8S26BQC", "CuLIcpvh0E4C", "CUPytpxAQy8C", "Cvgt-6bCw1sC", "Cvm8DVwnPYgC", "cVOLHzwR4oAC", "cVPwYwrr6iIC", "CvWN_1APPXEC", "cw9wjb7egFYC", "cx01PMJfsv8C", "cX18oqSNkjwC", "Cx2vq7VlIXkC", "CxkAwssQTXcC", "CxQtw38sy1oC", "CZ69KrLXC30C", "cz6HU8c_08AC", "CZfPnHEerUEC", "cZNeFYLdxRUC", "D-bqdwkPGfMC", "D-sEvbguNukC", "d0iR5mS_zckC", "D1tkJQHg8g0C", "D1vnFannII4C", "D1ydYIWVoGEC", "d3bH0MfA-s8C", "d3bVUgvRfuUC", "d6pegMjbh_MC", "D8c1-Fv7h4UC", "d9bEk7ikuf8C", "d9VWRpdQHa4C", "d_3DSXAfBjgC", "d_Kua_fO8WoC", "d_LpdqXksIEC", "Da7QsXAp2KAC", "Da86QO7OFmMC", "dAeNUVbKYZMC", "dB5Ze26QulcC", "dbhDwMRcf3gC", "DBKEpJmhfIQC", "DBmmIBF7QVUC", "DBQufQNi1NQC", "DbraAOMCglwC", "Dc_6-SREBYEC", "dcaoPhSdJwwC", "DcELPMMgF54C", "dCyscToVVJkC", "dD3IDjLA1PAC", "DD8rqgXH_IMC", "DDas282zyFoC", "degnTau2SCYC", "DejCbO1mvCYC", "DepEk9KiKHsC", "dFlv3zn_2-gC", "dftQW8wGYMAC", "dFWN0snaFrkC", "dG0I00OuLIYC", "dgJP6B7WqHsC", "DgLsKo7b80kC", "DGmPXx0nWwQC", "dH5YF-Taks0C", "dHLL9X8XCZkC", "dHojfMulawgC", "DhpA9dhtQZYC", "DhpKxQT8n74C", "DI5YIApq2vQC", "DiGNzXnAjigC", "djG2jb-B7wUC", "djQDeb2wd7EC", "Djr-9RvWNtgC", "DjSLzk3CX24C", "DK_DLjGY80IC", "Dk_moRw2Q7cC", "DKah0Hn3XwYC", "dKHiwNqBUdoC", "DKwK76kPQt8C", "dlpWT0J7s94C", "DmcHmv_3bRIC", "dmI4eW8qvOYC", "DMJ_O5RaymkC", "DmQBgx20PP8C", "Dn1cbtf1EGkC", "dN2h8uLDfHMC", "DN6kyW8Ca44C", "Dn8kGUQdQuoC", "DnCWgeoalKQC", "DNzYBE-otp0C", "DohJGXw-I2sC", "DoHq1DrnfzQC", "DOJxZvrWwI0C", "DOLD2wgkb3wC", "domPQ29OEacC", "dOTparP8u64C", "Dp9CZHPlkwcC", "DpAuk5SvwlsC", "dPijFCaOncoC", "dPT9-WijqI8C", "DQEm1m-yEGkC", "dQFBTKi4aYsC", "dqRhjQVSm7MC", "dQUzctUAMDYC", "dQWOY1QeuFsC", "DQwSI4mEcqEC", "DRzA4j9SvMEC", "DS1CXLcOFDUC", "dSAHJCmGqbsC", "dsMzPEBfpjgC", "Dt_XdDY-VbMC", "DtLgoas9kAwC", "DTTF3ufqLjkC", "DTWZLMGFFgkC", "dUgzGsEMhoUC", "DujYWG8TPMMC", "duUJEp4WbQ8C", "DUwMDknxu-kC", "DuWRmiB3QRMC", "dVBoRh77mwAC", "dvCpl1mBef0C", "dvPX1ljtXnwC", "dvQbGVVYfRsC", "dW3MS88NZR0C", "DwfmIaoLWLgC", "DWmtB9szhFsC", "DwWpvfGhDJ4C", "dWx8yejRSncC", "DX0zfCzuuxgC", "DX1JcMNgz7AC", "dXnlwi2M5ysC", "Dxo1Qm2SJPIC", "dy33QZD4XU0C", "DyF5zrlztJgC", "dyTox6KgOeAC", "dYZyzp-I9hQC", "dZ2wQGn69BkC", "dziWBc9bbesC", "dzTY5Nf-IvMC", "E0-t9ZaBm_kC", "e0KEphnVexsC", "e0rixLVIlVUC", "e0WEjH2EDmYC", "e1_oKxr5eJ4C", "e1MKMiwPJkcC", "E1nPKuOF5KUC", "E1UQ9VEX7qAC", "e31CwftjgdkC", "e3TV6jdCc64C", "E4Aj3o80jRUC", "e4qyRM4WA60C", "e5-b0sEOz-oC", "e58nW0zCKKUC", "e5_yHiOT4QMC", "E8-Tv_oreLMC", "E8l48-DZln0C", "e8vVyX2ikzsC", "e9hmN8prjWcC", "E_5TjwpQuSYC", "e_fNo1nVkhUC", "E_HCwwxMbfMC", "E_hncSqZ7goC", "E_KHeqwctTQC", "E_TZvz6qRqEC", "e_ZxZaahQt8C", "Ean4raPg4loC", "eB2ACRDcxlAC", "ECDSra1prI0C", "ecLQy_-7BiAC", "EcwSRllC_okC", "ECZBTmAEG5cC", "eE48-YnJfwkC", "EE6BmZJN4-gC", "EeD7Y5RBHgQC", "efF7PRNFoTQC", "effyPdL2NggC", "eFIZYpxKuFEC", "eFK1EFIPqI8C", "EFqxt01Nwg8C", "EFR46h9YDCoC", "EfTQANaCeXsC", "EfUlyxSlBYMC", "EFwE6RwAuoEC", "EgclZLFSTUkC", "eGHoO5tG_nsC", "Eh-xe5o-6K8C", "Ehb1MTESpuMC", "EhfdKJLrGLAC", "eHgwsL-vZiUC", "eHIMLGwiTvQC", "eHN7J-6aNOgC", "EHsRgwWtk14C", "EI9S88rMxDEC", "EIbxfCGfzgcC", "EjCncRsUgHgC", "eJkALfK8M_IC", "eK1N_aPZ0ogC", "Ek623DbKy4IC", "EkBtyXWfoxsC", "EKUyRL6x6uoC", "EkyTTvjNRZAC", "ELgd2EnTZbwC", "elNtT39MEXEC", "eLTIJ3AE5K8C", "eM1vHNOSSLgC", "eMK29sYgRkEC", "EMUiAgplnKMC", "ENbwTd9dVRgC", "enZcYyGQIKEC", "Eo0xcLkycIwC", "EoDh3KdviUMC", "eOGwcJ4NYncC", "EojH3awYyHMC", "EoZ6ZhT9lBwC", "Ep4qonrFOQEC", "EPBl0u9SVLEC", "Ept9BBfz2tUC", "ePz5Jw4M1G4C", "Eq5STLb0fO4C", "EQJgKCbP-v8C", "eqKPCxpqQOUC", "eQOtX07lJcsC", "EQpanEMpfYEC", "eRCRwf0SRR4C", "eRievpkUWQkC", "ERoAm13YF8IC", "eRuTokPwUa4C", "ErYz2d6gY6kC", "esRQjcWyrTwC", "etrlevyLof0C", "eukfBSKh8s4C", "EvkY9m79rlIC", "eVQPSr8nWekC", "evTo5YGZO0MC", "eW0Zrxp07HAC", "EW1Kkhb6n3AC", "Ewc2cyySU84C", "eWcNS4HPvpAC", "ewiGTwfA8ssC", "ewLMKATa0gwC", "eWwDEkWUxMgC", "ExGgBlCFbkkC", "exXk4Fm_pOoC", "Ey6BJlwygssC", "EyQosEtLlOMC", "EySzx3TuNdAC", "EZC1Ye-Oo5IC", "f-HQhhMFUkwC", "f-rkLLtY6H0C", "f-RuzV0i8TgC", "F-rwIWBVyYcC", "F-RY0fDsun0C", "F0aqlEBEWkwC", "F0mUte90ATUC", "F10tYokQD9kC", "F157RUqNSXYC", "F1IOWavdlooC", "f1iQwHzJeh8C", "f1UlXrOFgLgC", "f2hyf0QoB_0C", "F4hRy1F1M6QC", "F5_kVFwCazQC", "f5a5-Ib4hHcC", "f5tFDQMnLHwC", "F6aJtNcwyw8C", "F6gFtTTQktYC", "F6nx06oYabUC", "F6tJl6mVOmsC", "F75UStxhkkgC", "f7a5KxIcznAC", "F7CRxEsVDPgC", "F7IqEFlwXkkC", "F_4zWthNQjMC", "f_bTDVhQGgIC", "f_ViRN4litIC", "fapATeBaFuMC", "fB09Jo4niQUC", "fBCqF_bIaq0C", "fC0ZfSFwlGwC", "fCcP6lFS4l8C", "fco4osDhkKoC", "FCriMwwYPV4C", "fD56E-G_xtgC", "Fd8F9dBdcesC", "FdPFkAsDJVgC", "fE2quB852jcC", "Fe35NUMG7PoC", "feaP99EP7qMC", "FeVe--XHelEC", "ff30hEbK72AC", "FfAWQh9ybFYC", "ffdtbrNuaMQC", "FFSNOAzSRRoC", "FFV9NEUIewkC", "FgbDyllfOvYC", "FGkQODpSS8cC", "fGmk3NEFuO4C", "Fgo-tF4Ko90C", "fgxiezARYdQC", "fh2jW0S7w-cC", "fH7bDuYLQuwC", "FhpnSb-IuOQC", "FHWCqMcirnIC", "Fi8mroRSCSIC", "fIo_5qn2o9kC", "Fiolx9qMANMC", "fiOMox-7gTAC", "fIqGGfeRBuYC", "fj-ryrSBuxAC", "FK7ribUaJpIC", "FKb8wL3gUKIC", "fKXaYqo3bx8C", "flaI_VVftE0C", "FllyRnur8loC", "Flp9WXMHl7MC", "FLuHOd0yA7UC", "fmc0r2y-22YC", "FMLUGVui7ZMC", "fMULJZsTTWkC", "FNEcGO3CE3wC", "FNOtkFTYV4wC", "FNQd9jEmBfAC", "fNZUj6md9ZUC", "FoF7ChJwwxwC", "foFiHPRRc8YC", "fOSGJMirZ-QC", "FOzQLFvO-TYC", "fQ7UcdtVp9UC", "FqADDkunVNAC", "FQlgRiO4anwC", "fR4N__Pb408C", "FrLXpwIZ76IC", "frTY9Rp3TdYC", "FSjxitCb7zkC", "FSM7SCIiwjQC", "FspJxw0-ETUC", "fSs-Lnk-FdEC", "fsTBXJPVmzgC", "Fsua44ixWTUC", "Ft6qGWDysl8C", "FtjZ6hzP56wC", "fUol0UXx4rQC", "fuq94a8C0ioC", "fURd0Tspwt8C", "fv1P6kkUCJIC", "fvo2oenGUfYC", "FvpO3khvlX4C", "FVSNqmjpE64C", "fw3XxD0BHfgC", "FWLRXbPTC6oC", "Fwlt7N5UZwYC", "fwPtaCpO84UC", "fXKNHh6Fj-EC", "fxkWKWW29sgC", "fXT7sPDDjRMC", "FxWYa9-6KFgC", "FY1QFdG_hWMC", "fyDwxO_VuVEC", "fYlIEPXSi34C", "FYMVNMlz130C", "fYRbsK9_tIsC", "fZebM83rGrAC", "fZPcGedgSqwC", "fZr_tlFtVlMC", "FzxZ2YgfD_0C", "g-IoEnhfOYEC", "G-pnMUtTsuYC", "G0kMXkW6S64C", "g0r4WgTIhoEC", "G1i8tzrJ1nMC", "g1QHBOBzo9kC", "G24-ZSfNr34C", "g33mIXKIykIC", "G3bGAAhRcTIC", "G3lHg_uBcLYC", "G3W-hsO0Se8C", "g42RGQFvFKQC", "g4A4yTP-TZ4C", "g5-rg_wWoTUC", "G52EfFF4uQYC", "G5F1tbJcEcQC", "G62P2UNKancC", "G67WBcKiyfsC", "G6bPsjIoQRgC", "g71HD_LypocC", "G7Z4RdEAbB0C", "g8ugKhOSyuwC", "G9sZf7D24a8C", "G9WBMa1Rz_kC", "G_8DeR6vSREC", "g_dfEmUIjGMC", "g_JJG_kSCkMC", "g_K0HqWU538C", "g_Kp2jOkDj4C", "g_S1HnZ_DwQC", "gAasB1B_2RwC", "gAgA6Uoe8rEC", "gaP66nrOT6QC", "GaWtd5zJfB8C", "gBcCK8XX0HsC", "gBVThe2w7O4C", "GcfWbkEzwmgC", "Gcsz0c39QzgC", "gDkl_VliBRsC", "GDpsUbHGfxEC", "GdRDldOlrawC", "ge63yWT1Jh8C", "gEeKsYhnB3gC", "geGQYwp-tC8C", "GEYIRkKv3N0C", "gF3Orr5FW2MC", "GfagN_c7kHoC", "gfosqprkt84C", "Gfrd-On5iFwC", "GG2osAta-gIC", "GG7ihqiDfEgC", "GHbKVdz0US4C", "GHgWuuohd_0C", "GHocqremTkAC", "Gi29tN6MgswC", "Gi2nNkMLlB0C", "GiXy0_5y0iMC", "Gj_s6K3rGnAC", "gjHbpWCWObYC", "gjmRMSVmOM8C", "GK6aU0VUgXcC", "gLINZTfo4q0C", "GlmSvzw4yO8C", "GlsRJG0Wv44C", "Gm0rtSQhsqMC", "Gm6rlJaoUyUC", "GMELuWd6eowC", "gMgWtKBHly0C", "gmgxWRokQkYC", "gMNE7Egw-0oC", "gMV_uHkuuhQC", "gMyoix4eabsC", "gN1fWNxFOpkC", "gN7t338bmDwC", "gNBeDixTabkC", "gnshgsLyFckC", "GNsue2JEQigC", "GOf8H53N2S8C", "goiKKGuC4w8C", "gOlJgcpAuF4C", "GOPQn8x7CWQC", "gOreWZwKWrYC", "gow3DxwxgEcC", "gp7EquTzSBcC", "GPdMResNFOkC", "gPHjjrNWaQwC", "GphNKJvn7aMC", "gPKEXnUTF48C", "gptMDMPRG_kC", "GpvBc61vwqsC", "GQ77yT_qt0EC", "GQGJ3Ow1N-gC", "GRaZnzm6avoC", "GrHMph5SUrsC", "GSSNC1P4BlYC", "gtd3lAtcz28C", "GtEwY53Nx7wC", "GViLsAsZMeAC", "gvkh_emQHkgC", "gvSz7ipNnTMC", "GWgdn-U_kRcC", "gWhf3WFS-FsC", "GwJO1p7nsg0C", "gwSzTVp4K-YC", "gWuT5dW_-n8C", "GxC3w77TCYYC", "gXez_eYk59cC", "Gxi21X4yFckC", "GYNs63lQGUwC", "GYSxKPQ9db4C", "Gz5Jhh-BkO4C", "Gzjj9mSPAGEC", "h-H5Ss75T-MC", "h-v-y9SzGQMC", "H0LnK7ELmwwC", "H1E-EV19VREC", "h1xzw-srDvIC", "H28iGCH19IEC", "h2cV8_ebXhIC", "H2t1O8vkIJIC", "h2UR_DQnsG0C", "h3P1koY9OtkC", "h4g1ZN13EBQC", "H5h5PxnwNyEC", "H5JDad0NO3kC", "h6XG5Dg7dUUC", "h7A74b_8x8cC", "H8RcOH7aZnwC", "ha2jMwKX0DwC", "HaBHzd-VzYEC", "hAEHNznGeXoC", "haJh0MARCywC", "HaNL-mjos94C", "HAxIoUSLLMMC", "HbHaf10rZb4C", "hblx8fw5GoIC", "hbNOan-tY3wC", "hbz7X90tZtkC", "HD0CT7WqwWQC", "HDBdFBkFC6QC", "HDHAt-fviPkC", "hdoEpslpoi8C", "HdQZbAIXlycC", "HeAXLBJeUO4C", "hEIVV2REz_wC", "heMeM6Ca13oC", "hEqF8WFVYO4C", "HestSXO362YC", "hEZN_ll8vTEC", "Hf29RRC82H8C", "HF37vLFfYGgC", "hG2JWfNr0hQC", "hGeLsgsEhm4C", "hgscfLr5dCsC", "hgucJFj4adYC", "HgWWWv62BLMC", "hgXbebNQ918C", "hgZOV9vxvyQC", "HHJtGY5skf0C", "HhwifKDS9ZkC", "HIcfQr37mIMC", "Hiclc2KYaUcC", "hIJsvrXcswkC", "HIuRezqOUNwC", "hiY-wWTOdFwC", "HiYK_b6uu0oC", "HjDPRIC6QhwC", "HJexhW3C0TIC", "hJNp0GHQvPoC", "hK-_lL2c6roC", "hKCorSddfYIC", "HKfPdJDAyfEC", "HKphymCGhlsC", "hlbSrcGnhRIC", "HlhvoI2T_YYC", "Hm0FthKQuDAC", "Hm4b2XIZwMcC", "hMFecLAIM8QC", "HmFNOLfs-KoC", "hMv_9ZjMRrEC", "Hn_Vorrsv-oC", "hNpWUTs1QkQC", "hNvRVcLCgc8C", "HO60dGlf-lMC", "hoAYu1WxtrQC", "hoya5L_WctQC", "hpCQzNmvvHAC", "hPsfiopl08UC", "hq7DvqIwmbAC", "hqSCkysc7hIC", "hsenzAimpCgC", "HtUHrHlvcKYC", "HTy5GsUWgO0C", "hu2XWXmlZDUC", "huBRQ5Z6020C", "HUCFqFU-xBwC", "HUgP3InN37cC", "HUGsq_23hC8C", "hupeuMVYj2sC", "hUqzwC6RWRAC", "HurESoDQljcC", "hv4S5PPzggEC", "HV8NIZ-NbCIC", "hVupJKgpmzcC", "HW7zAmsuvQoC", "HwC8gF6F-7gC", "hwJQOwg-MGYC", "hXCi_DViuqwC", "hxf4h-HJU9AC", "HXUNz8hnnNwC", "HYShm6Q-lkEC", "HyyYMH-0I_sC", "Hz1jfmQ47tMC", "HZ3XCz-LrngC", "hzBJHOw9MmoC", "hZSi8EN4zgkC", "hZYGqOZbWcoC", "i-A1_UzfaYIC", "i03DqaR5kngC", "i0as8wwA51EC", "i10GqpzQvd8C", "i17KR1dhTTAC", "I1jxgTFq4JEC", "I1oOcpvsmOkC", "I1pE68kvpXcC", "I1RDqTYimL0C", "I2A0X4ZAVs8C", "I2jCJnMD96IC", "I2x_hrAV-toC", "I37XTdpG9voC", "i3mP7paNg68C", "i3vDCXkXRGkC", "I3YPskM9ygEC", "i4nmYgQDx1AC", "i4uuzh0r-9MC", "I57EF0rALpcC", "i5fKpFIR95IC", "i5GAf0Tit_MC", "i5MP574eUB0C", "I5OlMVqGBKAC", "i5sVopbSUigC", "i5xPLt4TBhUC", "i6-rsPcw7nwC", "I93wHcKkkxsC", "I9gXed3hj_0C", "I9p_m7oXQ00C", "i9RevNyPg20C", "I9yZKs30ChMC", "IA-C9T4ekAQC", "ia3RRTlLkXgC", "Ia3XMdZ2bOkC", "iahDFfxz65UC", "iaUAJo2Rjj0C", "IB0NsrW2KVMC", "IbHfDN-E0KoC", "ibM2xIvpQvIC", "iBpOzwAOfHYC", "IBPsQFc0TrMC", "iBS7a-HZVmUC", "IcdPGTpcQ6UC", "ice0iBehDTQC", "icraAr_CUacC", "Ict1i48rcaQC", "Icxfcg43NswC", "IcxFeiSD8xMC", "ICYTHtzte0UC", "ICZ1TFX9kiYC", "IdNz020y6RoC", "ieBUz8TwIYEC", "IeWxeVx7MFMC", "iEY-2kLVjkYC", "If2xFIsLAxoC", "IFGrnP1OGI0C", "IFM4VrHJlPoC", "ih89HAkmZ8YC", "ihDdAWPakwgC", "ihqYRudK3nYC", "iHS5AiZMJ-IC", "Ii4oNrOSvuoC", "iI9xFYwnTt0C", "iirHge-GkdkC", "IIVa4C8WZ1sC", "IivhUAX7nUoC", "IJBNvCsXfnIC", "IKAb-bSQ3bgC", "iKIFlxm-6eUC", "ikJfKaz0lEEC", "Iks2Zj6NFNYC", "ikv9cLfBsNMC", "iLiNY2ujuKoC", "iLmnzTUcYicC", "iLO-HYqgp8kC", "ilTEo-xrfXAC", "IM2rnd-Hw14C", "IMc94shnupsC", "ImDwjP5XNjMC", "iMsAfs6UJB4C", "imT9VsCi1d8C", "IMZYtRKxsdMC", "iN-VrQp4n8MC", "inbRbkubLJ8C", "inE-47w6bwcC", "inHnAqSCz2oC", "iOJYfBwzrnQC", "iolgETGRgScC", "ioPIqdVSRfkC", "IOrrnHK5lQsC", "ioyvuitdXHcC", "Ip8oWMRlSncC", "IpcT3uYlUFwC", "IPi-mn4-rrIC", "IPNXfV2-DhcC", "iPVjCpHtGSYC", "IpYQJCmoRmEC", "IQ7se2TyYboC", "iQCaKLhr6sIC", "Iqh1gPKVVisC", "iqjGZUxK5tkC", "IQJNU72KQykC", "IQK8z3xn7kUC", "IQy_4-ClC_oC", "IR-YmujBeaMC", "ir0g_PW5lAYC", "IsX5wxrcSRMC", "itdBdt8OvMwC", "ITHmTXzq1ooC", "itO3t_YeG60C", "itYPTUVhI_AC", "IU_8JDjxL34C", "iUHIE5ee52cC", "iUIe8LVs11sC", "IUNxvi0kbd8C", "Iv5Lg8P5l4oC", "iVRA5mPDyRcC", "ivVx2Db9aVAC", "iVyeJy3h5SEC", "IWk2-9ElTSoC", "iwMdXfkinrIC", "iX5BUALnh1oC", "IX5mo9ylOF0C", "iXtjiaaJnisC", "IYQmn4Vh8vkC", "IYs875dv5yAC", "iyXjE3ff3TIC", "Iz9kUx2khRwC", "iZHL-HOTvowC", "iZWBuG8M_N0C", "IzWhVs9zTHoC", "J-hSMdljW0cC", "J-qC1ajmTI4C", "j0moeTJXy3EC", "j1jq0wpxGWMC", "J1mZL49w1ywC", "j1uEon9_2aoC", "J1xc0cRKLhcC", "J1YSmHfP_U0C", "j38pCZhXKQ8C", "j5-UoSnKj-QC", "j5ReTLmAf8cC", "J65nNxyoKVQC", "J6h59KLeyGkC", "J6k4-N5lPX8C", "j7M8eF3eUzUC", "J87b_-vDhqsC", "j8bdlF8-2sIC", "J8pmzeUZ5ZcC", "J93scO5FyBgC", "J_a0AxvnKlcC", "j_tM-g68VOMC", "jA0KwEkrthYC", "JAz4lv4QLZMC", "JbByInfcxLAC", "jbeNYxZipBoC", "JBEQiZB2wPQC", "jbfEnb5eLhYC", "jbn_6jI9_JQC", "JBrXmLW4VDMC", "JBVQzRpi8SkC", "jCIIGTXQSogC", "JcMCmBnpHGsC", "JdPcnVD2J0gC", "jDuFeO9tlbkC", "JDY4CRR1uKsC", "JEBFQEiIuwEC", "JeTwQB5doD4C", "JFbTRDPlBNAC", "JFmbHaQUBPEC", "JFTVGT5IR5cC", "jFyzF3PJEZIC", "Jgsu-aIm3ncC", "jh4wn4X92UwC", "jHA_uXY299AC", "JhbDnT74kWEC", "jhFlES6Q218C", "JIgSXZ-HvyEC", "JIoY7PagAOAC", "jjlx8b2p3sMC", "jjTIpsqChmQC", "JK1lVtA_PGUC", "jK_AZCTX7toC", "Jl4ud7djPwMC", "JlFAbFifpGwC", "jlLHipHyxAAC", "JlQxM5V_pJcC", "jm7PeIvsrIoC", "jMkBN8SNLsMC", "JmS8Gb-SS1wC", "jn-mpa5yX8YC", "JN3U6cBoS3QC", "jN5uWgPvmDUC", "jn8hQqLNwPwC", "jNfgb4yYdoQC", "JnTSGlEnRWAC", "jnvKUOa_iMAC", "Jo3K5-IeRWAC", "JOdMnMK-2hMC", "JogLxVrWcoQC", "JONPZKNltBAC", "JP4P2Jl0GpEC", "jplzD3-L4pIC", "jQ45aH5LwKkC", "Jqo4bK5JLFgC", "jQw6Khkvc9oC", "jr4rCPLDip4C", "JRdGj7H4zy0C", "jRt8EQYNjmMC", "Js4hlR3b3EoC", "jsR1vbobV68C", "JStjWz_4d6wC", "Jsv1cKrM3NAC", "jSVd-uYjgHoC", "Jtj8_7WxpUkC", "Jtl4io4ruJUC", "jtlSDmiSV7cC", "jtp216JpYZgC", "jtRC6wAGeGoC", "Ju4iAEEFIYoC", "juX1nCMWkPkC", "jVESdBSMasMC", "JW-E4s398vQC", "JW6kHqxt2DgC", "Jw7tkk8xgCcC", "JWhodvqODe0C", "JWy0WEUCnWcC", "JXaElDfCQwsC", "jXe5XQJWqmkC", "jxhKtuDgLyoC", "jXKTSQrTLO8C", "jxV-jRfSz74C", "JXVwa-WOk9wC", "JyB9mIB6B_AC", "jyIhGgBGatYC", "jYIUu6cmYcUC", "JYsqDEprk7YC", "jyU_oLjkAvkC", "Jz0Yy053WS4C", "jzEqRY71zv0C", "k-6iK3uhbrsC", "k-vTiKL3GcsC", "K1bCtwc8XsMC", "K1D4SMM9LfsC", "k1Smynbdy_IC", "K29Bmkzqb-YC", "k38jM8SnUUwC", "k3mIFeG3gvkC", "k45F1fFu68sC", "k4_TCFU5L0cC", "k4KPnqH9WoYC", "K52_YvD1YNwC", "k6_R9jr1DLMC", "K7Nk3uDppF4C", "K7S2Y_DjsiAC", "K8RFMTng47kC", "K8XUetN4mJoC", "K9Hg3Rpf054C", "K_BuQw1SV_8C", "K_EYPw4RjRIC", "k_FzHdZwIA4C", "kaBuyXHFTfgC", "Kal3FT7SkbEC", "KaOW-jF_fXEC", "kaQFxHnmI-EC", "kAwvotBDTp8C", "kB5A-peO5mUC", "KBc3sv6Fo5gC", "Kc28ocJWCSMC", "kcXggMBRpYAC", "kCxV_vK6wncC", "KCz7N-GYKRcC", "Kd38N3odqJMC", "kD5qi3MyEHYC", "kdnkOJCHVvYC", "Kdplby1KebAC", "Ke7_cl6tQ1EC", "KeCx5rnVLKcC", "KEjMEwY_2pkC", "KfddjxF9No0C", "KFgCx_40DIUC", "KFlpxcQftwoC", "kFO12ZB_mpIC", "KFSt4jWFGwEC", "KFYO5sISo1oC", "kgESTBANJLIC", "KgHe3aSjEcwC", "KGv8e8gdb2IC", "KGXsBYRUqzgC", "khYVsKMvQZIC", "KiGRzqMgVC4C", "kin6TnKBZu0C", "kJbVO2G6VicC", "kjwVASsTUm0C", "kk-99kM1cbMC", "kKMynY5oDkgC", "kkuWM3tFA3UC", "kKVdwsscK0IC", "kLT7OIBKf_YC", "klx0xib6jFUC", "kMuc9Lb-3mkC", "kn5Ryzk_804C", "knaD9dttHJQC", "KNCH0KSlbv0C", "KngKYpdjwhYC", "KnvA8lal8hQC", "kNvyj-B59G0C", "knYfPoZjv1AC", "knzNIfmU2F0C", "KO0tMOWl5AEC", "kOjy3FQqXPQC", "kp9RTYomf6EC", "KpZwmRvbDXEC", "kQ18q7wtP6gC", "KqOst6a4bfUC", "kQq6wVOadbAC", "KqrukTiOoEMC", "KqZ51wR3uR4C", "kriZx5ucLZsC", "kSchquQcPwwC", "kShqtsGF24oC", "kt2uGKE8ck4C", "KtdiNYJJGyIC", "kTKo3TshDQ4C", "kto37M4olh4C", "KtPviLCuTuQC", "ku86wsnoDU0C", "kUAOn7mzr30C", "kUy8RIr2MMAC", "kuYFuUqzNBMC", "kvBhFm6SvUcC", "KVG8xj9eTyAC", "kw-Qi9kZwFgC", "kw_pn3OgVhkC", "KweDHm1QDmIC", "kX-uGcqfwEYC", "KX2EdmIr3EMC", "kxWz41WGZpQC", "kYb8P4cq_wcC", "KZFM0k8qgYMC", "kZJtiNrah-EC", "KZOJnieBC6cC", "kZRj36dHqYgC", "L-J80UHCYQwC", "l-R1g21wQmQC", "L-vqegJp9uIC", "L197GSrjYtIC", "L1N2Kq4Z5kMC", "L2RoHnh9WNgC", "l3biFpfZ6IYC", "l3mnXqi9MWwC", "l58QIv-wk_sC", "L5j0jl7GeGYC", "l5SOyJFFih4C", "l79kzRCL-64C", "L7V53j6oTE0C", "L8hfLzs0ryoC", "L8pRWa8msOYC", "l9qQKuBX1z0C", "L9sYq3XSLmIC", "l_xdnKxeYIkC", "LaNm1-VpDysC", "lB7yJWfdAlMC", "lBg47Qr7fX4C", "lbm2ahVO7JsC", "LCcoKnYJFi4C", "Lceu5SUx6iQC", "lCnIv3nz_gwC", "lcQnVWof86UC", "lCTRxp5h3cEC", "lcvGBooqMuIC", "LD62S7iA-6sC", "Ld6XYa6OV0EC", "LDbgAIq0rwAC", "LDcMr4avqQAC", "LdLKhHv1j7AC", "Le7KpGpgARoC", "LebT9J_W-JsC", "lEHIudUSWGsC", "LF9lcajLNncC", "LfyjwoRbGEQC", "LG3FQBlcuK0C", "lg8vy0i-4AMC", "lg9ziwYFWYgC", "Lgc8PkmB7kYC", "lgKz1Znda54C", "lGmrFlbK6ScC", "lgnvT8PFeQ0C", "lGnw2Lr2ye4C", "LH1jO4vBdL4C", "lh5Bq5-qF20C", "lh6piycs8loC", "lH6Sy-O13e4C", "lhffXhoB9v8C", "lHyYDF1gkcEC", "lI4hPO8u3ecC", "LIKJxwW1NPAC", "Lj1Qc8d2TFEC", "ljV5N2JDcdkC", "lKfbWTS_R20C", "lKfRTntxOSoC", "LkqcpRLrQmMC", "LLAmiykEu18C", "LlUTCGOyrLEC", "LlVPRiFaZYsC", "Lm50mS8oSv8C", "lM7bzrLCFxwC", "Lmcz0uwHj_8C", "Lmd5DJdGoPcC", "lmh-U0QOZpQC", "ln0sKggjlrIC", "LNCv7A05JWoC", "LnmPuPokrB0C", "lNuglcm8NocC", "LNvsdBdQ8HsC", "Lnx_1kPlpWYC", "loMc5HzF-usC", "LoStMjYjce8C", "LOX7iN7Q874C", "lpD5anvUaRUC", "lPGd_VV1tL0C", "lpShSdi7LUQC", "lpxDz2CAn50C", "lQiQma87RSsC", "Lr1uX7tFPoMC", "LrfdAXb2C9oC", "lrMnF60qYA0C", "lrwpUNex3WkC", "LtQsfa2WI6IC", "LtWDVZxiK6EC", "lu4JDcJtuk0C", "LUatB5OLh2QC", "lUdzKl-iG6QC", "LUI2fLpxIRwC", "luZug_PZn-kC", "lV3eeUs3LaMC", "Lv4kQT_AaT8C", "LV5cJRRPFF0C", "lvpbVPlChVEC", "lvqoRgaFTqAC", "LVS6bNvtqjAC", "lvSwwhtCwEoC", "LvU89BnfBfwC", "lvVnqd1tU88C", "lvxwS2c7FSsC", "lw86IpC5eZAC", "lWeAPI5g-WQC", "lwhhrGEkt_AC", "Lx-iIBVAX9wC", "LX7d801yKO8C", "LXWVVH_O5eYC", "LY7yjuEUqFcC", "LYavsnnx0jEC", "lydhPqDc0msC", "lYYtBxmaqn8C", "lZFhc7FCOnwC", "lzODsbstIJ8C", "LZZz6Gelw3oC", "M-B8XedeL9sC", "M-X_jS-Qeu0C", "m0GY_gNBqJkC", "M16vady03FwC", "M17DnRMSvMQC", "m1d5dkEp6qwC", "M1uKv97BQVgC", "M2GfO8IOq8cC", "m3gIdLgiEiIC", "M3S8TS_impUC", "m3ua0VRh74kC", "M4EO-Zotb4AC", "M5Apnd4a90YC", "M6_uZrk7lyIC", "M6AE8xih0fYC", "M8FjmaH-0V4C", "m8p4SxNNk1YC", "m91WYFCk5hoC", "m9I3UtyjnEMC", "m9RmPYnRSJoC", "m__Q6kmVoGAC", "mbBn8u1bNesC", "mbOLybqcWBkC", "mbwl-fgW71QC", "MCcAiE2RtwgC", "MCE7Pr1i3QwC", "MCNTv8mckdMC", "McO7ExAvcGkC", "Mdg6J1rzc3gC", "mdlEPkDNnTcC", "MDNUCJqwKZ0C", "MDRm_3niAL0C", "mERZP4q_dtwC", "Mev4LxWr-KIC", "MF8WnvUtyZ4C", "MFbm2SRUUNsC", "MFGj_PT_clIC", "MFUW8xkxTwAC", "MFUXSJjOTv8C", "MFxxpv1t1wgC", "mG-VRWgfpuYC", "mG_b5im7yEcC", "MgIytsae7OoC", "mh7Q58oo05MC", "Mh9ZKiE4S7gC", "mhYfL6Dn5g8C", "mIJu6Q1MxxUC", "mIpG7ZgQAwAC", "MiU4l3QO4dsC", "mIuDg1IBMj8C", "mJa0kAVqn5cC", "MJbE5ma65bgC", "MJcz9QFkMfwC", "mjs33MDiZ18C", "mK2QhS11JtsC", "mKFc0zsz_sUC", "mKIYLIm5yvgC", "mKMrtZyDSZkC", "ML3jtMUzRZgC", "MmapyLSVIgcC", "MMC2-KIY4UIC", "MmGkqaROdZ4C", "Mn9lrAQ_nxUC", "MNh8tx8W9_cC", "mnLO4l5Kk64C", "mO-hFM-NSNkC", "mO0KpMMUjNIC", "MOb9thbs-IcC", "MpDur-nHqa4C", "mpRgiga3tAkC", "mPXuTKlYVR0C", "mQmreUfiEJ4C", "MREAPapn82QC", "MrHaC5HAva8C", "MrS7NW0zzPMC", "MrT8xBCG3jAC", "MsjMXc0y9GgC", "mSLhDt_XIUQC", "msR0SGcs0sUC", "Mt4RB5JO4qYC", "MTNaD4rT5VgC", "mtPwaQbaXk4C", "mtyPMWgtKLMC", "MU9TN2h17C0C", "MujUlI7X9IUC", "mulgp5hb0XkC", "muwB6-puoWcC", "mVCfkE38VhAC", "mVF4mKK45gIC", "MvKnU4gHFvYC", "MVrYj9uQOUkC", "MvX7y3Rb4osC", "mw13wpsdZEcC", "MW200xjK49cC", "MWkv47DIFw8C", "MwkYUxyipDwC", "mWoSs0GgomgC", "MWRuvcsE43MC", "MWsCvdQi16UC", "mx5CfeeEkm0C", "mx8kL7iCR-AC", "mXdagZIBcXIC", "Mxge8wUpd7EC", "my1E7YMLa7QC", "MY5laQPdyqUC", "mYeFaO3Z92kC", "mYlSEszWRbQC", "mYO6uQLfMwwC", "Mzh6KxczlxgC", "MzQXH5NneSMC", "N-2kR2I6dMIC", "n-NWU0HayegC", "N0esKvW8vyoC", "n0J2v9y4ANMC", "n1oIK_VG6FsC", "N3uj_afjTyQC", "N3x1PyJmbz4C", "n3YC435gKFIC", "N4O5BpmVOR4C", "n4PRP3xLUzcC", "N5o7qYSSkKIC", "N8u-XDDX3ckC", "n8znlyDQMzQC", "n9tTHnRGZn4C", "n9zYjuvb7ykC", "N_c9iWm8DRMC", "NA9NybGyQE4C", "naa9VVsldpYC", "nASZmG3lM-MC", "nAv1gIZTgogC", "NB-ab2V1frAC", "Nb0tNFc5Y90C", "Nb5MWsRQ5fsC", "nBgNFx8P6B4C", "NblvDRP3eCYC", "NbmL9ftadNoC", "nBWIJiVv1_8C", "nbX5DfBNkXsC", "nCu8oe2i5y0C", "NDDz4WIxDvYC", "nDTc9NRAkNMC", "nE0bz0HYOogC", "NEX_8ydGrYMC", "Nf4qm1thuzYC", "nF5keLQPaSwC", "nfb690TbBRwC", "NFKwTvQjVHEC", "Ngqtp8ORGuUC", "nGyIxBpVbHIC", "NHNhj4dE1rwC", "NHOepipqw5MC", "ni05jo2PfQEC", "NilW70Yol74C", "nj9aaD4RrgsC", "NJHMuVxjF64C", "NjiG3mI5eg0C", "njTri1942n4C", "nJyWqsH3qUwC", "nk45JPhubdQC", "NkgV7ZM2HJMC", "nkisnllbM7YC", "NKpitRCwolgC", "NkubXK90GtwC", "nKZduhuEPCgC", "NkZQP-XUlwoC", "NL-7y-hjodYC", "NLRI6hzr01AC", "NLTA_L_nKf4C", "nLvjQkBajocC", "nMr_gZQQYlsC", "nn004oTBKLAC", "NNM1-tB1dfoC", "NNMf3_4WlX8C", "no8fn7hjg8MC", "nOC8XE6uE40C", "NOq2brjH2UcC", "nOvhwcESksMC", "NOXxlusWLtgC", "NP-QlBzYETwC", "nphkjxI5lScC", "nPOOVH6SHD8C", "NPpbY3vMrK4C", "NPxwcIKd1kQC", "NQ8EkEiYf_sC", "nQcNPnXaotsC", "nqJ5umM9C7QC", "NQu2oSdsA5gC", "nRCGMfqp9acC", "nrlceeqlj3EC", "NrpGnrVET_MC", "nrQCRrdku24C", "ns2k0z-4FPEC", "nslURExrg1sC", "nsPX7hErWWYC", "NtHhpIjIFMEC", "Ntn27W4nT7wC", "NtyI0b1CiDkC", "Nu3s4NA7gOoC", "nUgLVyPlO7EC", "nuh9ozVsxZMC", "nVn2yaeZm_wC", "nWHJMJoP1gQC", "nX3MXt0hiv0C", "nxd_45ba6Z4C", "nXDMAfrcyjUC", "nXuXVJqQrfIC", "ny0rmFLTKuwC", "NyHVgeaCrlMC", "nYkrTWDj5twC", "nyNPWOj-dsEC", "o1lW82-iMVgC", "O2U65rfH1NQC", "o4-BACWBJWYC", "o417BiZhN_0C", "O4bRW1VjD4gC", "o4Ju-uaw49UC", "O59l36u3Ji0C", "o5c0OysdfaEC", "O5fjMLG47WgC", "o5mtVZ53LqkC", "o5UNCmS0W4oC", "o74HqDeVAeoC", "o7FkYz8ay5AC", "o7hlmXxZtXwC", "O7mlylpFtVYC", "O8UdHCAPoqIC", "OB75l5upMJQC", "oBeL__RZP38C", "ObnB2K0Pm-gC", "oBoadQqqY6cC", "oBrM4fMi6B4C", "oBY9qYnYTgoC", "obYhbzN-dY0C", "oByKSad59WAC", "OC2kpcgpvikC", "oC7cyJ4CYVAC", "OC9RIohfJrUC", "OCEweX1U3MEC", "ODMOAai7YlIC", "ODTL3SUB46kC", "oe9S6SgfeSsC", "OESLT2EXllwC", "oF9XRMu7IUUC", "ofNvqyY50fQC", "OFp8ipPu5g0C", "OGHIo78EX5YC", "OgJwtLxVOj0C", "ogLg_TL7OygC", "OgXJ1JGsPpgC", "ohIY00toUIkC", "Oi9vfDvIuBUC", "oicpUw1BgE0C", "oiWZ5EgQ79QC", "OixOjFAE2UEC", "oj3sFUtE5T4C", "oJ7qCzCI1NIC", "oK7EQtgW7mkC", "okYh0Z3GsTsC", "OLDMJhksIKkC", "OLHXNOpxklsC", "oLKj_i7I0YsC", "oLR898PUrOcC", "OlUsahLKzBEC", "On3PnFHC9J8C", "on8LkQpHPTEC", "ONojNh1lqW8C", "OO-67enEAxUC", "oOcJq-c0_u4C", "OoI89q6qJi8C", "oOMXh9TsiRwC", "OOPVMKFveVEC", "oPa2r3UrjI8C", "OPE20Pj5yqoC", "OpqDQCu4-BIC", "OQ4i9z1_JEkC", "OQfA4OqoFtIC", "oQGrgpcyMhoC", "oqkC3PTplRsC", "OQngDQK-7lQC", "OQSpUZUN6hgC", "Or9jdsdChNoC", "OrAJCAIZ-2QC", "orjvjrj77_wC", "OroCOEqkVg4C", "oRwio-c6lfAC", "OrYmMwlbdrwC", "oS4bMeaUxzAC", "OSIc5_l8RmEC", "OskAy9XOnIsC", "OspnCGC6KY8C", "OT8bN8OmUpwC", "OTqu7UOxGsIC", "oU_-6ikmidoC", "OuE0x5z2RPoC", "Ouh5eCWqs5wC", "oUL6i_pYfNsC", "oULb1kQ2TwAC", "oUm1vvjselQC", "OuP7i2DhADwC", "OvNp8Df5XukC", "OW-jfra0aAwC", "owp3UkZCojgC", "owtSfDkt_cQC", "oX8nJShwb5wC", "ox91llFB5j4C", "oxfoF_gasvsC", "oXip2MZZrrkC", "OxSYUYpb1B0C", "OXyB0QkBg-kC", "oYBYq7CCH2gC", "OYIt6Zb0kzoC", "OYNgWRQuWLMC", "OypfoLO_6WgC", "OzoCM4221KoC", "oZPVXSW9l1gC", "oZS5zFNW5yUC", "P-48zO2V-jEC", "P-f3K3jxvckC", "P-mMbsaKdJ4C", "P0N_3rRZNe4C", "P0sP87s4f-IC", "P0xs_9NSIy8C", "P1jauDDocM0C", "p1WjYOltEOoC", "P1zI5itcG7wC", "p2Hxcbxl0OoC", "P32krFgmdzgC", "P3Z6wfs5pnQC", "P4cXo_cMIDAC", "p4G9UHazucsC", "p5E1LVJ2C-0C", "P6Qv0MdH40MC", "p6WIqdRdxe8C", "P73DrhE9F0QC", "p7e_mYbJIdgC", "P7Piq3OsQ1MC", "P7TCSLpJ7AYC", "P8xpTj3Dm-kC", "p9gXGWJfMyUC", "p_JsCMUQK04C", "PafpN9Q0_VAC", "paIrc_5Ok_sC", "pajrkLcM6d0C", "PawYMB9KYS8C", "Pb8qTzqOKbAC", "pBU9nTKzW-cC", "pcO1LSjcXd0C", "PdbfGALpRF4C", "PdjBFEEz0o0C", "pDOqZfQ5tqUC", "pDUXtSVArzkC", "pDy8yULq2CAC", "PEjhtik7W8IC", "pePU3MRBaNwC", "PEtwS6Wzi30C", "pghpw1e91e0C", "pI1j1wKgEYQC", "PIrRsZeTE_cC", "PIrZKlCeTM8C", "piuLmFNoHeQC", "PjvV6z2p-PEC", "PK5BOWbRiTsC", "PKBwjrXavKEC", "PkD2ElfiUj4C", "PKnlhkJjaOoC", "PL7vc_L7zRMC", "PlkYkdwAas8C", "pLx66Ql8wyQC", "pMbmbQsE6hEC", "PMKc8Ed8qoIC", "pmkhm0NHK9YC", "pMM5mFUvS10C", "pmZDPkJNc-QC", "PnvFYd-zUlcC", "PO5L2EA8f4QC", "po6tX53X3zQC", "PpGBuOOQyPgC", "pPNsEPSMb68C", "PpQOI-_72LkC", "ppS7-RcigG0C", "PQH8BklvQVIC", "pQMAsT7HlEsC", "pqRcT7sFYYYC", "Pr0lKluK4qwC", "pRiVTCTW6_cC", "prIX-LvPysYC", "PrOKEcZXJ58C", "PRW7HzOj4L0C", "Ps7JHG_PzvwC", "pSKvaLV6zkcC", "PsQ7zEi9AGsC", "pSUI1mAkepIC", "PuKKbUuGlQ4C", "PupnPhJkMF0C", "PUUpOUJlZogC", "pVBgdC_NWBIC", "pVvmrDZftNYC", "PVx4khyYhmIC", "pW1gin3ibSIC", "PW3r-DzcJA0C", "pwJQ-HgHnb8C", "pWlzUhdHpnEC", "PWp0mkyFuYsC", "pWrM-VeH4XsC", "PXJhH0WwBowC", "PXKOHbczKo4C", "PxtAKv81HbkC", "pXYRK0789mcC", "Pyjt9xhNKJ4C", "PYUws7DjE8UC", "pZFsVmB3sWkC", "pZJizvcWJOgC", "Q04oaR0abbgC", "Q15FWAcrf-QC", "Q1JMZxYPNcYC", "q1RJDFYWHgMC", "q24lR-f9sZ0C", "q2jOf2a3-5EC", "Q2rs9Bt83KQC", "Q3mSVp_MG5AC", "Q4QQAjtLP80C", "q5kQVxb9QVgC", "Q8BtyHu3DjMC", "q8De-srS5FEC", "q8JBo23nTxwC", "Q9R6Tjwd1_4C", "q_Pv_2bdL-8C", "QAaJo4q0JyQC", "qaifkrtG1YQC", "qAIpjYAzwxIC", "qAIy2I-DdkkC", "qArUQHMdg9YC", "QayKpFqlUwgC", "QbC7tDGlecEC", "qbdnVEd5nukC", "QbT7zBaX0pUC", "QC18oeN_txsC", "QcYl_ylrHmcC", "QDdPkSM50DkC", "QDmJ4OIdAF0C", "QdT2iJFvvgsC", "qdwDV8khUrcC", "qEBYKPN2KCEC", "qf0qyxvObVkC", "qf5rCsR_UZYC", "qFE13saB5KMC", "qfG5xgE6aScC", "QFHB2D4XH8UC", "QfuSKd7Ga_UC", "qfX5J84X4bsC", "QglOxmN4afEC", "Qgtab_u5XIIC", "qhDFuWbLlgQC", "qhhXHNKgvU8C", "qhkmf5oGVhsC", "qHqKJz1J6ZwC", "qHR4w0mYE14C", "QHr6DN2BWRUC", "QhtkLnl6PJ4C", "qi3VYphlGwYC", "qInweiKq68UC", "qiq2M4k7U6oC", "QIQXbqdKUtkC", "qixxVyYBVVAC", "qjVaD1OQbxEC", "QjYtNJZmWLEC", "QJzLeR562BsC", "qKGtuqvUhN8C", "QKjhgCNu1D4C", "QKuiIqgSfjoC", "qLl9ityyFaYC", "qLNfpb1hBWwC", "qLRf__fvjWQC", "qlwvoG_2LI4C", "QLxmwtlCKNIC", "qLZKdz7z8j0C", "QM-gzY4ATMEC", "qm9Sg7WWeFUC", "QmDLXgyH2A4C", "QmGk50yV2eMC", "qMivHGPGxqkC", "qmq-iCFviEYC", "qMRLwuhEvYQC", "qNdUuj8CQ_sC", "QnlvkNsQYIIC", "QNM4japF5g4C", "QO4V75fio5IC", "qO4zMwjqcgwC", "QO5ijIGPH0kC", "qOAlpGp1qXcC", "QOhPfuPo2ZQC", "QOsZ6WTKmXcC", "qOtFI1aylisC", "QOVvzsPnJRQC", "QOxF33PYoxQC", "Qprp911qk4oC", "QPTqaKLu-soC", "QPTzkU6u8moC", "QQH8as7ZaasC", "QqhubYvGmowC", "qQMewsDjq1cC", "qr_QTbMh4UYC", "qRFmgHgIJaAC", "QRryyAYOYYkC", "QruIGhiAVpkC", "QrWoRDvQVBoC", "Qs2bpmiNsN4C", "QSGOsmZ5srUC", "QsgZ_CitOCAC", "qShdefxAAjUC", "qt_9Q4K5Bz8C", "QtfndLdZhnAC", "qThSUMiDXr8C", "qTlunjb8t3wC", "quPX3vBkk58C", "qUrsy4blU2AC", "qv5D6shGGFQC", "qvAWw3g1TZAC", "Qvhru7bg5-8C", "qVmHL2M5I9oC", "qvo8Q74rPA4C", "QvvCpFvg6HIC", "qWCDCrim38YC", "QWmPBVImnd0C", "QWsJDMvIV7sC", "QxaITfanaUcC", "qXmjRsQYG2oC", "qXMwCbPE5mkC", "QXtFK0OT2XMC", "qy96yDeMgP8C", "QYCzHR80dmwC", "QYJzYQumaQkC", "qywzPsRB07UC", "Qz9VOE6vO0kC", "Qz9vxAeQZBMC", "QZEcG2VDUNYC", "qZNcOygYKL0C", "qzNvw-PgRJMC", "QZRAeYQR-VcC", "qZW2GgDXbIUC", "QzX8THIgRjUC", "r-2XRCAihmEC", "R-EQzoT34W4C", "R-K1rkqmEaQC", "R-QkDxkqbJoC", "r0_is9ZWV4QC", "R0d76m-Be10C", "R0dVznNGP4AC", "r0F1U5paODcC", "R1C-ninfheEC", "R1fZcc7fF_wC", "r2IsVOmNqGkC", "R3996-ouQX0C", "R3a_1OGpqO8C", "R3BIOfKssQ4C", "R3YtlswCJscC", "r4GIU2wJCAEC", "R5Z8uU9hREEC", "r69Z4urx_VAC", "r6pwHeHIq2wC", "R7Fb8Cz0sBUC", "r9dsrSJ5xXAC", "R_3rEJCX7CwC", "R_e6YP7ijeQC", "R_ZetzxFHVwC", "ra5rRLh-RkcC", "raaCI-J4COoC", "raHLd5-V2sAC", "RAJUz6k_QIEC", "ral_pGRWutsC", "RaQh5A4yv4QC", "RAuMY88cbW0C", "Rb1wrlmXojEC", "RB3gn9LNgUgC", "rB8eMRkjqN8C", "rBJd5vKWLDAC", "rBraWo3i2BcC", "Rc1rBhBiixcC", "rcD0_Dvs7ngC", "RcR5vQwxOkQC", "rD5AnQWPEGsC", "RdBFUqvReBIC", "Rdik4zbN6aAC", "RDwWK0ARwSwC", "rE7e3lG1KYwC", "rEo78qB7RAsC", "reT27U7wl9MC", "rETcT8tlEroC", "revtcXHZbjkC", "Rf5wnXgT46oC", "RFfmHNZ_SQIC", "RfW8huqkCIMC", "RGmHAVPhmRwC", "rhE-0gXNbN8C", "rhVOVKp0-5wC", "riAM_mNkE-4C", "RIR0uMgooPoC", "RITAHjToj5wC", "riwVQHtihE4C", "rJe4-_qtl7wC", "rJFBka6kGZwC", "RJSSmdgguOgC", "RkMFf4mnEVwC", "RkpAjLSjI9wC", "RlhZc4HAS5oC", "rlIvpU-Qp38C", "rLrJ-_78SB0C", "RlRzBsraB7EC", "rlVLx87ZDmwC", "rmdgHuGg3wUC", "rmhJrD0HcmMC", "RmPQGSawe7MC", "rmsUs_KDgHAC", "rNAaZbheYa0C", "rnmvt4dCYC8C", "RNNTon-z4p4C", "rPD8iteD_hoC", "RPgFnXPnfD8C", "rQ9xJe_hNLUC", "RqGcY4499DMC", "RqMp5TsWCqkC", "rqQxHHD8_V4C", "RQv_wAM_UkkC", "RQXjQyIqVjcC", "RraibLZPj8sC", "rrrWd4MsVIAC", "RRxqU3A0GrUC", "RsafPfUjC6EC", "rsBdQfPx83oC", "RSH2f0kqAXoC", "RtAu3fji7ewC", "ru-Qep42Zj0C", "rU4AuxUochEC", "rUFJsks11vIC", "rUfXM1bdw9sC", "ruKyUjnt84sC", "ruR6ds7RIpEC", "rUV-Za6EbCoC", "RvR6I6VzpzMC", "rvuhHvq0QkAC", "rW56njaMNlwC", "RWfXBObw_-cC", "RwGtZCyX6BEC", "rwHtreArk_YC", "RwhYP9n_0h4C", "RWPrAFvARUQC", "RwZOApBh9-cC", "rXiTv6JhZc4C", "Rz3SQBiOBHIC", "RzAW_XaV5sYC", "rzWqrQzSN10C", "s-lRvCbKN9oC", "s0ZhQfrW0gwC", "s1L2mh1xX6AC", "S246o6LpxOQC", "s2Bu-k4GvscC", "s2YlBHk21pIC", "S36-Rb4D2DEC", "s3SJ_1sVGeIC", "s4a1jAstmLoC", "S4a835HkJpoC", "s4D3ZQeVOzYC", "S57-VvGDLNkC", "S65k1nHzjBEC", "s6YFm0pgW94C", "S7e3XNHSMxgC", "S80tNVmTCZsC", "sa_cnttyB3wC", "Sakj3vPu9TEC", "SAyPFNMrvlgC", "sbAo3RkWIUsC", "sbDxkzAn6KMC", "SbGdnS5QyU4C", "sBsU14_crsUC", "SBuAXRPCZzYC", "SBWymtSXoT4C", "SChbFApNDc8C", "SCjBWElj0pQC", "ScRuEWv344gC", "ScVA18ol9isC", "SCzETlXk39YC", "sDLVKZlOGfMC", "SDnCJn-99_8C", "sDUEiJuHaW0C", "sEe_6MRg5xQC", "sFc5eUkookMC", "sfD1teRZUIQC", "SFlEcdkCVqQC", "SfzscM8izq0C", "Sgc4rRfAJWMC", "sgQQDC_inA8C", "SH1J_jFnpCgC", "shnh1HnwyKoC", "sI_UG8lLey0C", "SIexi_qgq2gC", "sIstJfeO2PAC", "sjH3emOkC1MC", "sjlWRAygGoYC", "sJQm214GM4UC", "sK5CJFpb2DAC", "SK5opOtSfpMC", "sKcVfinygvsC", "skf3LSyV_kEC", "skGjjKeIZ1QC", "SKnDnyQe-KgC", "sksDN84VxvAC", "sLrONAxBAgAC", "SM5hR32GSScC", "SMD-bjQppX8C", "SMfrLWPyWYkC", "sNkgg-3dF30C", "sNOWKhznU8kC", "sNpznNsnaZsC", "sNye5hpqJ5AC", "sOCvpTNDhiUC", "sOKZKESWys0C", "SoQ4ymzN-EwC", "SOsKxQ3rRVAC", "sp5WbjwKXsgC", "spGyXLNREukC", "spjgeb-TvukC", "SqM46zulAGwC", "SQQpUldtMKwC", "sQQrjCIkDE0C", "SR8p7v8vjEgC", "srEHyeOFw1QC", "SrJ920Iab0AC", "srlF0JUIBZEC", "srS13ScitwsC", "sSb2HrG0mdoC", "ssMbhqrP_hcC", "SsMUCl5j8X4C", "STAM4cTZ9JkC", "stplInkzoXwC", "STxlycWlVS0C", "Suc98NDaPMQC", "suGmGoDCWEkC", "SUUGxP5lF_QC", "suxeIoWNkGIC", "svEHBagPG_AC", "sVv2Tnf4czUC", "SvyhDobp8rYC", "sW0cJ0e9yrEC", "Sw2LE0OatnoC", "SWuWFcmRUM8C", "swxxuGuhQ5wC", "SYAQjOwA6lIC", "SYf8ytGrkqgC", "SYV-79W3oZsC", "sywjT24pBb8C", "SYZmxOI-sPEC", "sZ-Llo2emYwC", "sZ2KMp2z4vIC", "sZbKiwpLwR8C", "T-05AqadLgMC", "t-6YPniKgVkC", "t1_hnB01TKkC", "T304Ttec_9kC", "t3JbuFVWg8kC", "t4-YKz4p-UwC", "T4dZFR6Nf7wC", "T4vQw1RNkQ8C", "T5-f-dJQUKEC", "t5HbRxAEsDMC", "t5otQOxwTE8C", "t6hGd9yD1EIC", "T6mzmh4-gpcC", "t6PV6XUf6OMC", "T7CKj8bqVlwC", "T7Yn7JGorsoC", "T88qX5DHAn4C", "T8cJSr5V55sC", "T8n6NPUUVMgC", "t8PP_-KPEGAC", "T_CEYYJDtkUC", "t_F21VosYjIC", "t_i5CZKbhyIC", "Tbd0chRC7mEC", "TBHj8ZkXNG8C", "tBnjnSrsN2cC", "TcLqxN_GIHsC", "TCLWhJPI7FoC", "tCrccf0xttgC", "TCsbd7G-EFkC", "TDB8Aba5zSkC", "TDea9oyayNYC", "tDSIplwvSk8C", "tEEhsawqlM0C", "teHWSd0m5-kC", "TFlVe4ySsKQC", "tfOQ4dzVxUEC", "TFQrki145qwC", "TFz2WpwXspAC", "TGmDJz6mQ80C", "tGpIslO17UAC", "Tgwb_Y8ogvMC", "THnJrNvETr0C", "thortsX3HVoC", "tIhdDxTBwHMC", "tIkfrx4_hQwC", "TIzgnSAaj6MC", "TJDGTP9Sa5UC", "tk6cdwQRAWUC", "tK7-l0GhlJIC", "Tk954r7MojYC", "TkQ68EbRP4wC", "TkULPY-xMNsC", "Tl-O1prFDRwC", "tl7Iyvd38NwC", "tLGUxAapcL4C", "TLLBZhvO_MUC", "tLWQ4T8FmIkC", "tm-OYOeGdk4C", "TMgBNRU5JfAC", "tMhB-WKYp3AC", "TMrqtlz6zbQC", "tMYmiHg8gXMC", "TnBZi6PC9_AC", "tnOxBZL4yJUC", "tO-_dys5t0cC", "TOjmK9C9hNsC", "tojSqawVI70C", "ToOj6GxJw_sC", "tosbUp8kF9oC", "tOse262foFAC", "ToXws9n6TW8C", "tPGu98BABRIC", "TpRbGJKrw9AC", "tpUyKIEQXqsC", "tqbtgVk2DOwC", "tQFGe8VEmYkC", "tQFYJjDEwhIC", "tRg3Kpg92V8C", "TRXrMWY_i2IC", "tSegrigeLXwC", "tSL2mAl4dU8C", "tSNkXVpB1SkC", "TStnYlfQpJcC", "tsZPJ6k-2v8C", "TT_6siOxmjcC", "tTn7hDPhLCUC", "TTNPxMigCK4C", "TtYex8ky_MEC", "TU_YnC-fEZ4C", "tuHKpihaIw4C", "tUqG4yDPMaMC", "TVcaPfZ2ovIC", "tVJCs7kV5YUC", "tVo8itBJzwQC", "tVoGmBBXoB4C", "tvVRO2ar-lAC", "TVWasr-C3UcC", "tw-YGBovG8kC", "TW_G-pfyZb4C", "tWZkzAIRwOAC", "txE355KzgNkC", "tXhS4axKY7YC", "txIGOpjLaW4C", "TXj3AklQkmUC", "txz0YTg8N0QC", "TyKLxN9KUYkC", "TYYp48ytAK0C", "tZDwTDHQoMAC", "TzEXzR_3DIIC", "TzHbh5yCVPMC", "TZi4PnwV1vYC", "Tzix2jithpQC", "tZWnNPKg1K8C", "tZxaDhb71gcC", "U-2azvBELrIC", "u-BaZR9pXuIC", "U-dZalMj4MAC", "u-m9gKxRAc0C", "u0qOoHAWFmoC", "u0yHE5npw6EC", "U1RQksZ3OIoC", "U2M_rxC-yasC", "U3oeSJVTm1YC", "U4EcY2ax3BgC", "U58Wh30Smi8C", "U5hXpnwUmW4C", "u7ktCK5kqmEC", "u8Pksn_0bwMC", "u8pxT1gWEroC", "U8To1emV5ckC", "u8YQW0EBfh8C", "u91fA8PDRF0C", "u9Gf9e0wpsgC", "U9mcooAQF6oC", "u_I614Pw3C8C", "UAMGGFlcNBoC", "UAPferUlb4UC", "UArOY5U5pj0C", "UASe7zvIkYgC", "ub2nh7fU8zcC", "UbAipP9ATlUC", "uBaQK8nGY3YC", "uBbfizzKTDoC", "ubdfzyM0mvYC", "ubEptMpxCl8C", "ubH00CZv_YYC", "uBhYtCAKZ8IC", "Ud2goDsqfBIC", "ud3bOWYoug8C", "udeqm_uHGcEC", "Udl9U-0OY9gC", "uDN-qvOrCikC", "UdQBSffyTTwC", "udTfyoUKl_4C", "ue_JYo-k0_wC", "UelxdTWV4YQC", "uFBreFpwPzgC", "uFLwcEZMrOcC", "uFRchGZDu5cC", "UFzSXj2LlVYC", "UG9uh94xJGIC", "UGe4js2AvNAC", "uHCbYqZUDQ0C", "uhg_js2x6EAC", "uIQL0ClhP78C", "UiRYFVuAx-4C", "Uisvt8dbF9EC", "uISwNVKQlOIC", "UiY-F2E2lHgC", "UJaPCc5NR6kC", "UJfYIdr7qfUC", "uJOCncLLnLsC", "UJYVS2GxGMsC", "Uk9QIJmBVE8C", "UKaXYLcwoVoC", "UKix4jTGLEMC", "Uknk8sIZrbwC", "UKwN_B4HzisC", "ulappz4IaLsC", "ulAYKWVjDm0C", "ULF5r0lziKUC", "uLHa0KWZBYkC", "ulHlbvxfO7EC", "uLHlJ6sjohwC", "UlJQ7hp4HzEC", "uLuevcUMEUAC", "ULZlBvE5OOYC", "um_yWo4ZZR4C", "uMdMY55qzCoC", "ume1sxlKekcC", "UmfW-jF7pkIC", "UMI5PqvqzksC", "umk5P3OKU8cC", "UmLTsumqfskC", "umNBfh-NoN0C", "UmoiWWYNdD8C", "UMy-1YdP7jQC", "UnPP_G13_uAC", "uOB2fMgynp8C", "uolzqanj75kC", "uoOIJOibx2EC", "UpC4QJP66HUC", "UQHIYZMXzp0C", "UQPwOavv8e8C", "uqQwIHpqpfgC", "UQWZSGa6ptwC", "UratcuTxJJcC", "URkMY_t6RQQC", "UrKtMKiVIEwC", "urWWO7AXLNsC", "us670m1NV6AC", "USKxwYjlEjQC", "uSM7MK18EjwC", "UsomGft5YhUC", "UuCmOj7iKo4C", "UUnbb9tXDtAC", "uUV3JgWK5dsC", "UV9O88l1jsYC", "UvfbcAxCdrUC", "uVH-cmqx1BcC", "uVSiv0Yh2KYC", "UW8ptGgmKBYC", "UwcFKj6f9tEC", "UWCV0A6Sm64C", "ux2inxSrMjYC", "uX8zO_eCzxkC", "UX9gVZmGCJgC", "UxF2p5R_-soC", "UXHTnXuNjWoC", "UxHuPMtHGBIC", "uxJlAgRemHgC", "UXkCqO7U14oC", "UXypLB7duOgC", "uy74QJnLK7UC", "Uy9PbkDwisYC", "Uyab3vXJNCgC", "UYbmXGtHcAEC", "uYd4Q1vQluAC", "uYdmnMArdZUC", "UyJaWLcdZgMC", "UYNnCXZmi2IC", "UYx-L-uz778C", "uzdsDdbr-YYC", "UZfWWjyXmsAC", "uznwumfbBJEC", "uZRJFb2JqCcC", "uZWmAAQiLNoC", "UzZA6-L9jC4C", "v-iDn44wlr0C", "v-PR2oOTjJoC", "v0YQv_CGq9wC", "v1GQZtYOZy0C", "v39x_fKR-ykC", "V3a6-Ny0MfIC", "v3LzmLUVwgAC", "v3vCw1T7yq4C", "v41wD2jEzQkC", "V54naZlLOi4C", "v5aU82lCwccC", "v6Nv22zpEMsC", "v6vIrPFCJoMC", "V76H9NQUbp8C", "V7SsFqkHaC4C", "V8BQNWkvddkC", "v8fnNHXeEb8C", "v_7BR5kU7QAC", "V_IMCohto0YC", "V_ZjKmO24ooC", "va83wz5u7ZAC", "vaj33IYnl0YC", "VAoSXvUROnwC", "vAzmPrsjrpwC", "vazz9jFGhc4C", "vb2N_BEc7rcC", "vBB54ABhmuEC", "VBhUV9DP5LUC", "vBISE7equQ4C", "vbOCF_qzX1QC", "VceR7vhczmcC", "vcnEIw3HYUwC", "vD8S2kkzEgIC", "vDQf8U2Tcb4C", "vDRezS6n5e0C", "vDYk0hyuEWUC", "VEof-jTO6z8C", "VfdbVKeF00EC", "vfn8iIujiqkC", "vgGJo3wR6sQC", "vGJJHsJASekC", "VH_YLJZHMlYC", "VHu3wL-lkjgC", "VI-Z3_0l1zIC", "vIobJo2oDA8C", "vitoIs2Cr7oC", "vj7ybCmMe5UC", "VjaK5lke2BUC", "vJbWK3ZOz6YC", "VJK0Ffr7LL4C", "VjRw6SLS6BwC", "VkAIRAwtXbMC", "VKB0vasDiMMC", "vkC7vC78f4AC", "vkZruQoCA7YC", "VL2YyP7qN8sC", "vL6GBI5JFKIC", "VlbQb4fDNaIC", "vLcdDmLQbNIC", "VlFWzpsWNHMC", "VM4GFlzHg34C", "vm_KCE4XXPMC", "VMaPd86rSiQC", "VMtYQ2yEIb0C", "Vn4n9fJYivkC", "VnJ29GOasfMC", "vNQ3K5HfiHAC", "vO0OArqchzcC", "VOA_B_72BssC", "voiup-mz2CkC", "Vp-lB-r2jcAC", "vP6QdtNb3NoC", "VPdWbqXkRwwC", "VpkbchYdHzQC", "VpMxQAe_R1UC", "VpynYE28wDAC", "vq7eeFukzNEC", "VQ8Dji_otuMC", "VQrC1zTh6WwC", "VQYKRZo5fj4C", "vrAja1wLa5AC", "VRQF0ws5Ps8C", "VRrm_CQd7PYC", "VS26zQZ81nYC", "VskxkGOz-5AC", "vssg7oBsX6MC", "VssJ5c7KsNwC", "Vt5QfVZLCWQC", "Vtjr4N7ZIb0C", "VTN5v_8IY8kC", "VtP9wYK2ws4C", "vTR5TfkMo8sC", "vuBXrI4_hAsC", "VugJuXuobUQC", "VuiQGIl0GVwC", "VuYDPDHttQkC", "vvi0pa3X8REC", "VvtLdQ_JWI0C", "VVZ9995LHdMC", "vWIVyXC2rK8C", "VXp3l0ZXZscC", "VXT04BGUPU8C", "vya66ZMsKhAC", "vyytRY0STBAC", "vzdbUH74-z4C", "vZdMfbamUbQC", "vzKx12aNFZEC", "VzvlkNQnz2UC", "w-4UAn9A5IQC", "w-rb62wiFAwC", "W-T3-55PL_UC", "w0AQbV1Yv2gC", "W0Ha1AYQ9PQC", "w0HzM7RzzkAC", "W0ucw4WwLCgC", "W1KFNeoVo-UC", "W1oLHR1zRWgC", "W39p_m_eK2wC", "w3nuf3FThEsC", "w57G3DshfU4C", "w6NLi9nyWJoC", "W7XRfHzoUt8C", "W8bxvyiMWjUC", "w8DFaxItUf8C", "W8oYW15gH18C", "W9UlXT9_srgC", "w_KLe1AylhEC", "wAa9qq9kbncC", "WADDM36d3TAC", "wAdUjtKxyQYC", "waQTwXPvrKgC", "wbJsCd9mBKcC", "Wc9zUQin1HIC", "WcBG3YOei4gC", "WcbvthlLe3kC", "wCIDSZ5SX7gC", "WcIsm-pa81YC", "wcrnOmttT6oC", "Wd0UuFoJHMAC", "WdD4GRa0WokC", "wdGdQAVN8b8C", "WDyRGAfLeycC", "WE56DE4iZ1sC", "WEhp2bcpeL4C", "WeWE_TA1xf4C", "wF93D3RESCMC", "Wffn8Q_nUucC", "Wg66gWttf-cC", "WGGGLt9ne7EC", "wGhwAajnbUcC", "wgmtlfkwMdoC", "WGudVA5jz3cC", "Wh38a8gCR1YC", "wH6mVwu-o80C", "Whh6Gqep5JYC", "WHmMhb8usnsC", "wIaOzaH2xhAC", "WIcUq43zKzQC", "wiELCaS5A6cC", "wIFW20Vb6yoC", "wIHvn-CZyDIC", "wip9RnTSQkQC", "wIRoUV4zomYC", "Wj3_t3JQi74C", "wjEkgQZhqQ4C", "WJF9OSx57G0C", "wjPnFzWFHioC", "wjxrloC2gyMC", "wJzaC53nfjAC", "wk7OS2RM6yEC", "Wk_rW5ls5ZMC", "WkaDXMQwjgUC", "WKSgYUH1ZrAC", "WLc1uaZ3uQYC", "wLiz-YM2xhgC", "WLky5avnUWYC", "wLoKfdx7-3QC", "wm0JI4OwwewC", "wM5jDrPpDN0C", "WMA5OJCTCH4C", "wMaa_8Xb8IAC", "Wmq4IoyD7YkC", "wmTuJF6FbKQC", "WmUSPSLxlPQC", "WmUw83YShgAC", "WNDpC8SR784C", "WnGFo9t_IOUC", "WO98q-vYCYEC", "wosmqf485hUC", "WOuuYHLvYjcC", "Wp1XC3mN_2IC", "wPkSa-HN_MYC", "wpqvUuohLcYC", "wq0ilxW2vqUC", "WqAlWYtemkIC", "Wr8kC-w7JAAC", "wsINE_FYvboC", "wt35LTE782MC", "wtcUDTuDvcwC", "wtFtcD-u6YoC", "WTkreYxHt7kC", "wugATspM3_kC", "wUgQibrOaRMC", "WUPkrIURLK8C", "WVlWFpXP6pAC", "wVz695SACj8C", "ww1McrTprWIC", "Wwr_6d-81JQC", "wWvmlkiMdccC", "wxu_2Jmu1SUC", "wXW9mCfmeCkC", "wYc5_9x-vYMC", "wYeYMW2VJOcC", "wYjr2x5aBhoC", "wyMh187NfMQC", "Wyxj7Y3Fh7AC", "wZA6KEKKL48C", "WZizrtIcd58C", "wzU8hMXumDsC", "wzVeU1tbS9kC", "wzvgJAT0hFkC", "X-K-6gLqjfMC", "X-yja2PWbOsC", "X0qyLfOh1wwC", "X29egdUI4WUC", "X2IGPFRi3VcC", "x2OnhrVLMX0C", "x3FYLq_E6aYC", "X3zpP3adixsC", "x5GZe2b1T5kC", "X724dVctLwMC", "x8Cxy9E9ctYC", "x9dq3UEW2S8C", "x9Ph_EeUGlsC", "X_4Z6_ze6QEC", "x_FVF_Z44VkC", "X_g3l2bLmfMC", "xa0jilK-wBEC", "XA2CIjIqxPkC", "Xa4ZPBvQ7wwC", "xa6pUrdsRJYC", "XaZ_EXZxcgAC", "XB6ckxWOq9kC", "XC_QGlNr6UEC", "xcL6uJBrEP4C", "xcYBiLQM8D4C", "xDCfd-wJ1nYC", "xDptolIJzuMC", "xdunEwG0ekEC", "XEbyTBf7EiQC", "XeFUnQ5T4ZsC", "XF6jHaJL7-kC", "Xf6PZclfvyEC", "xfKLCGCY-IwC", "xG3vyS2XmiwC", "Xg8V-Q7Slh4C", "xgVgTyZEcEIC", "xhLJvNa3hw0C", "xHpBz44fTkMC", "Xhzjutx6xXcC", "xiEXEWPb0u4C", "xjhrj3Au1YAC", "XJkbu5qnYw8C", "XJkW6G12GnoC", "XJLX3A9wDwQC", "xjPHxJNx620C", "XJSdT_4NWTMC", "XJYsQAhR0woC", "Xk0NR2m7SmcC", "xKAfOh_De1kC", "xLozeea_y28C", "xMptYMB2jgAC", "XN0YxwnmW8kC", "Xn4TW9WsGcsC", "XncmdPu_yykC", "xnd6J2H_Hi4C", "XnKrkTozrGQC", "xOs4YQg0z_oC", "Xp6vEAtv5JgC", "XpDNvGEAe7UC", "xPF9Hb7DPLgC", "XPfQIK59tucC", "XppZdaDs7e0C", "xpXfiGyGbYEC", "Xq_QETrozC0C", "XQDjUGNtapwC", "XQgd7Bzf-SwC", "XQiwtnVqsvwC", "xQUkutYqkz4C", "xR2GawWTausC", "XrDPPG0e1XkC", "XRudk_NcA7cC", "XSPNUs8flVIC", "xTFw4h2p9m0C", "XTldGQSpnSgC", "xtlipDsvjbMC", "XtS0pZ4iiaYC", "XtU5TuLc3LQC", "XTv8wmnkif4C", "XuB3bzU2jYIC", "XUcWWiRp8EkC", "xULD1fHFdnwC", "xUzaWGocMdMC", "xv1OQIhdYiEC", "XvncO5yhtRIC", "XvWq5fQbUXAC", "Xw720FqZ4tgC", "XW_Wvjwt5nIC", "XwaR3Efr5xkC", "Xwtf8xn5oosC", "xX_rOjavnGgC", "XxoVcV6L1WUC", "xXZySrxyCR8C", "XYN8GF8Tg6QC", "XYno9yAbYvsC", "xYoPWwqWlZcC", "xZ1dKyGlFpEC", "XZ_L7qpBphgC", "XZkmY8pBCzUC", "XzZsuib2o-IC", "Y-BoqcxnjHMC", "y-dYbFcEtRkC", "Y-rDB1iuKD4C", "Y-zAdmcmpr0C", "y01CkeGoQBsC", "y0NEkHDng8kC", "Y2Mwck8Q9A4C", "y457SKdxBjgC", "Y6opRGhAvtsC", "Y6Q9DyIsEv8C", "y6TlC075m68C", "y77n2ySMJHUC", "y82VKVtQyF0C", "Y9RC-KWX7NEC", "y_8DsXWLV1YC", "yAGyi110qQkC", "yAZo2iCsCnwC", "YBJyS4ONR2AC", "Ybsjrj4Cj_oC", "YBTzuxRVppUC", "yBvwlp82czgC", "YCz0J-8HIIMC", "YD3DmobOQ1UC", "yd8ymZJI3PUC", "yEE5Byt3Yn8C", "YEnl6AXNgjMC", "yEvCzH8lTZsC", "Yfs9Vcgc-IgC", "YG3PX9nKxcwC", "yG7dKaS25OkC", "YgGzvE5QfUcC", "yGWzMkuQuAoC", "yGzGUapBwtcC", "Yh7SFWaXGmQC", "YhgcwJ1L-s0C", "YHMOopeGRLUC", "YHPmmt9VvF8C", "yHuMzHT1ymMC", "yhVvGG2wk6sC", "yi4rHT-XFREC", "YIhZQkLdV5gC", "yJ5eW6WbkZkC", "yJ9txWojyRQC", "YJGDWnNxZgUC", "YjR5Ve-zTcYC", "yjW4Qo8aVa0C", "YkfCt1ci-gYC", "yKIy-iHLaiEC", "YLf-ZgX-UbwC", "YLG0VQhpBREC", "YlGSROC8f24C", "yLnfnsSjs7kC", "ylOpe_XWA20C", "yMAK06tbIQEC", "YmWF6E452ygC", "yMwiTTpwasgC", "yNbybmjraNoC", "YNf0HXz7DzkC", "YNkNV-0dqoMC", "yNMBdJjMDAMC", "ynr1IgaajCAC", "YNr8R3Pz4BEC", "yO2yG0nxTtsC", "yo4D8ch_qOgC", "yoP8GwogNwoC", "YoWHawdOEasC", "yPBDST7yCzkC", "YPI00cDVcuIC", "yPPeKkqCX3IC", "YPYmS6tzg3IC", "Yq80VBOTOO0C", "YQJtrDm2m8YC", "yqM4zGmsYioC", "YQpUF06YzgIC", "YQqzosYoyKEC", "YqSsNCkr4P8C", "YqUrwg2oKMYC", "YruT5IEUQ40C", "ysiSyAiBL3EC", "ysLtzvYykasC", "YsrVKLkmOYoC", "YTEB8cwULEoC", "YTkZPwz-IisC", "yTqN9YLy15QC", "YtTAKHTADK4C", "Yu2oPyz_cusC", "yU5ezbYpJcEC", "yv3eVLIKUbkC", "Yv8qGDyMCcAC", "YVteNzkhHYoC", "ywr0CcGDNHwC", "YwSKMQIymxsC", "ywUiQD0ExS8C", "YwvRsvYofqoC", "YXi4TxShj7MC", "YXjEJmEuSw4C", "yxrwrGNFe8EC", "yXSFWak3ExMC", "yXUjLwz-LbcC", "yY0UFm0rwyUC", "yYE1mOtXiakC", "YyOij4PJX3UC", "yySSPhUSBDAC", "Yyxuxa-4z38C", "YZ0CYplKus0C", "yzewmitzYgEC", "z-mixu2SLyoC", "z-WsBum6UckC", "z-XHduBD-fgC", "z03CQmKJuC8C", "z0Vxqx9UBxUC", "Z20jwWZr9rAC", "Z5jDzJD_8jkC", "z5m6Iq-d0fkC", "z5PCXXkpVRkC", "Z67UVjeaYU0C", "Z6IREjoKKSMC", "z6nLTGxdAIQC", "z7FxeM_bLL8C", "z7GVCC0hlBsC", "Z7XSIdAGjY8C", "Z89d21_IaX4C", "Z8nOkDyOwnUC", "z9xMfXGoWd0C", "z_LZp0HLrzEC", "zAEtQO1y7qMC", "zAirHadN5cwC", "zaZ8mAysMeUC", "zaZJTCOL2zwC", "Zb8giChIpp0C", "zBcGaNyjIakC", "Zc11bf7iopcC", "ZcGvAzjPSboC", "zCiuBsoCiAwC", "zciYiyHBb_EC", "Zcr7qa3b1xEC", "Zd1l0Ivij8wC", "ZdAaM8LdiMEC", "ZdcWjMktgz0C", "ZdlHoksfOuAC", "zdn7ZhQb13oC", "zDUNcRJHPPoC", "zEA5ve49rGcC", "zEb7PjUzZqsC", "ZEcqBsj4nzgC", "zehMDN6VEH8C", "ZeNbiH_7W80C", "zf0XkweGmlsC", "ZfuiGIlEhE4C", "Zg9zkoeC8ikC", "ZGCaf4HbUMsC", "ZGqcDmY1V_EC", "zGwctkli91sC", "ZH5OHnoFkdoC", "ZHEYK-O-CyYC", "zHSKn-li060C", "zHSO2GUV9ucC", "zI9VMiSN2b4C", "ZiEbz0B92nAC", "zIfWQF4BmggC", "ZigB9tzZ6nUC", "ziPDbUsmdwMC", "ZiVRnurrtzoC", "zj9NFQ-R0O4C", "zJCkBsVE4e0C", "zJExf_8IszwC", "ZK_fL6GQQ3MC", "ZkOEFzU5KfQC", "zkteuesBwpQC", "zKVjWGmUMsQC", "zlEriTpFmKUC", "zLjdSAeUHNUC", "ZLk-uuTII9EC", "ZLRaCF3rPwoC", "zLyrsEvkaZUC", "zMb-ettxv2EC", "ZmG_FiqqyqgC", "ZmH2rNbYVUAC", "ZmIcSTz5I-MC", "ZmRXTGKNUacC", "ZnahFZulWTcC", "znBbzQ_xb44C", "ZnC93TifTzsC", "ZNFbrV028y8C", "ZnFzSgYtgSAC", "ZnOutTTiMrAC", "znXDfnRWpqsC", "Zo0LzmyjP-4C", "zo4C658vKIAC", "zOBmXKh-OicC", "ZofDHNpTlrgC", "zOsz3T_YX38C", "ZP5fR-FfEvIC", "ZP9Rg_dx_JUC", "zpdvLYZX2kIC", "zPJrA-irbp8C", "zPxCryQcBwAC", "zQDMySj1ytEC", "zqHiiXjk6xQC", "zQlpLeSVg4gC", "ZqM1fdyT-HEC", "ZQRFFeUnLUIC", "ZqXo8b-P8DUC", "ZRI1DvA4R1MC", "ZrJB-MsbWvoC", "zsDExU_Oji0C", "ZSfix9YX33UC", "zsRtUi8r-fwC", "zSv6dBWneMEC", "zSV6gfQSMeIC", "ZSvSfCmzo2wC", "zSYm8sBkECQC", "ZT8pJZnkAysC", "zTa37YkeYwUC", "zTB98B5wOC0C", "zTd05X5fINgC", "ZTL1LP6SitAC", "ztnY1wbBubIC", "ZTtvaxiqdpUC", "ZTYG01M4xLQC", "ZULgTHal9iIC", "ZV3afTMMSHsC", "zvyBq6k6tWUC", "ZwcbYU9lI8cC", "ZwjiMn4-_T8C", "zwPKJGpFJmUC", "zwYTsxFqZ1MC", "zX0mefUtuHMC", "zx574VhlOOoC", "zXWXyM0CqHsC", "zY3HGzU4WSsC", "ZyAt3T1V4EcC", "ZYC9J99h_KoC", "zYgKMgNoO5kC", "zYk5y-t1950C", "zyTPMwa4iVAC", "zyzNGXvy-6QC", "zZdMFSI4wGgC", "ZzDwREJdaC0C", "zZUcvgn33YAC", "ZZueYtIK1OAC", "8KSd2u8LD2MC", "bLOKdFhvUZcC", "BPpCOYH2RCgC", "C4_7_rbKy-QC", "ceYlEs6gT3QC", "d_lVB6HZJ4YC", "DpqPwAk8UvYC", "dxumVrUrpYcC", "EhmN7RRA_ugC", "eoy-khRFxGUC", "fT6U0Ee7_kQC", "GU1cifth7UAC", "i04gvDRlG3IC", "iykLVJAK49kC", "nI3JXcSjvwsC", "nSvBa7hvG1EC", "NTWZOS6Ew_QC", "PaGLM2GozFoC", "PFYBPAS3LIEC", "qB9vnlTv6Z4C", "ROZpwAolfS0C", "TuoFvFXf3NYC", "U77um_h_dgcC", "VF3fYPWhRZ0C", "yA8CJ_xxNLwC", "-Ac81W-ZQDEC", "-g93J_EADYgC", "9sHHczJ__74C", "aN6SxmXodLkC", "AOKXOA9jxYoC", "AYUZIqbH2F4C", "b2ov6zAspKsC", "bEdfDabRIs4C", "CYQZUeo0mcMC", "dTmVGc4SoRwC", "ECWbSMvY_yoC", "g3dIAAAAYAAJ", "garJ9BwysNEC", "H4cbM4mroF4C", "HZc3FzaajnMC", "j4PpSFWmNQUC", "jWgXAAAAYAAJ", "KqUVJLLDJbQC", "kyWrpT3TMTAC", "nsW03V-aBDAC", "qE2FPaaAa6wC", "RAUKBvP5OfgC", "rUbjngR5YqIC", "SQhknRXlyvkC", "u9udoFdoMooC", "uaAMQY5-4nMC", "WMZ959gYm0IC", "WwmkMDW1GxIC", "xEKrdRy6Yn0C", "-3xLKI5mpTsC", "4HIWAAAAYAAJ", "4mOrEoLlJQMC", "5Wa1OGIrpfsC", "6a8HvlJBqu4C", "AcFukkjcG6EC", "aDzteIlBZ-gC", "B73wDUgCSk0C", "C-7CUEbWSHkC", "CfPWhC7NKlcC", "e8F70MxEViAC", "fUIZtMHfyisC", "GX5PtCqGnsIC", "hG4-QGmD_84C", "hsgseqd6jW0C", "ikniJkskaZIC", "jIEhvjDHdwQC", "jy83rMzyVKcC", "K3uKk_QBg4YC", "KJfZw8djFIoC", "nRz4SETLpucC", "ob9NMdgEs-EC", "Qbln_WYE65cC", "qUelIDH7unkC", "VqU5HA3h3SIC", "XeAVAAAAYAAJ", "xllOU8qyH5QC", "yO3lSt5C3OEC", "ZMV0OxvLseIC", "0ZOQM0b3CIEC", "bfXZpcLNv7UC", "c7K9joiXqgYC", "cJ1kUY-wUVwC", "cZ_F_J1308wC", "GITDL2ZCedkC", "ixaluvF7Mx8C", "lez8urgN7IsC", "MlOWsTGRARIC", "OIk7WeItvpQC", "q2eNLtaZ7osC", "QwptKz0-wL8C", "R82YRMlkujYC", "xdbrbcBssP8C", "ZbnLAfbazQ4C", "1F2N9Q6NISQC", "1xlR5HF9ZhgC", "6VJ7KzN1x_wC", "_U0oAK46KZ0C", "aWmi9nbSr04C", "CcJjP5T0fwQC", "dfysT8sctZAC", "dYMS5W6_Lb0C", "eK0SnBnpkA8C", "HQwZYSf8x-8C", "jy1wYy1s2cAC", "k63dDkZnAoIC", "lb96g-R0yFcC", "lCNdMetFtm4C", "LnkpdauAHvEC", "PNjrRKR3sKoC", "q2E_qQwNi84C", "Qa8IoiT_3kAC", "rKNgpIpk00sC", "rYyxqSi4vJEC", "tMrWdiJa5kIC", "uey347n5FmMC", "wXVwWWBl0S8C", "ZswFrYyJ6dMC", "0JMqA3_JQ30C", "1rW-QpIAs8UC", "2weL0iAfrEMC", "3bKJ-DZZpWIC", "5HCaqYbD5t0C", "5NfZvS8gCeQC", "6vIfS9fiMu0C", "7BUf0xhBN8EC", "9m9tNj2w2bcC", "alR-oZEbPFUC", "AUqkcy2G-N8C", "BersqPj7I8sC", "BIOMtGClRbcC", "BJcgLVibkrEC", "bS70a4o-wsEC", "ccnkgkRSIMcC", "CdvXLjqAcccC", "cMWIkZzNgxUC", "d8lp4Wth67IC", "DCqFYOrGyegC", "dZqcuS2SfDgC", "fJelZ9wO11kC", "gKSp69qW17cC", "HjRPMPdVlYUC", "HRCHJp-V0QUC", "i95ShDMoWl8C", "IhFHHJ4hTnoC", "IwywDY4P6gsC", "J4cTSAXOC6sC", "jUX8N9kiCiQC", "JXKlVTGYOq8C", "k0P11ZxGN3QC", "KYs2iT4brBQC", "m_MwlF3VmKgC", "MJgN0BWagZcC", "Ms_VAVC4IJ0C", "nXYsBeGHHWsC", "Ojqi8KbWuLwC", "p1hd3kN0odgC", "P29bv8K6lXAC", "pMnySBrsQ70C", "ppLI3zTIhQ4C", "PWuh21HK5DsC", "QgzBqhbdlvUC", "qLfZf7f5_pkC", "RMd3GpIFxcUC", "RRUkLhyGZVgC", "S4v4JCNH7KgC", "tcjBGGcB8QMC", "th8NdVD8E0gC", "TlYexn8n8gQC", "Ts4PoJismWYC", "VhKiOWjjB5AC", "WSCEgZsug1oC", "Xgaf0bkDcyIC", "xWjTZhw1MiUC", "ykz7uzPEMjEC", "yOrLifj9vzIC", "ZXRxl3Bl2xMC", "-A1mSoCEOm0C", "-aAwQO_-rXwC", "-ak5icwgpRcC", "-goleb9Ov3oC", "-iBS6-2OO3wC", "-Kzb2LPyE0oC", "-L99RHLc3WoC", "-nGQ0N7P-EYC", "-pB1UoFnjZcC", "-PS1vVwZlsgC", "-sFpPTDMyrMC", "-T7z7wffbVgC", "-T9Ba5NZ_jYC", "-vhCqN2twGQC", "-ZVoVtwCMz0C", "04CSCh06t0MC", "05qJUAYfFycC", "07TScp8-0tcC", "0btZWYVwXkoC", "0gCmKrNJd8wC", "0IUC0Mxdl-0C", "0P2nLQWsG3QC", "0PCwIecU6PoC", "0UmvRJkREtYC", "10I6OfI_MOsC", "11BnFWuym8AC", "12Pk5zZFirEC", "1_eNSlA-2WIC", "1exhZf_kk_UC", "1gudrZd7CQsC", "1GWERGJlwOIC", "1J4pZFaAwnMC", "1K_wEFkeFmYC", "1ml95FLM5koC", "1PSwP25DkcoC", "1q0ae-XNmWwC", "1R75c1UxVE0C", "1TiOka9bx3sC", "1ToTgls77wUC", "1trnFmoGajYC", "1ttGagcQQi4C", "1ZF625C3My0C", "2-7DDxR-3KQC", "240uVq1tL0gC", "2aFQoNOCUCwC", "2CSkYN2KGjQC", "2d-RLuD_MX8C", "2eiErUtb-p8C", "2Gfol9An-wEC", "2hptMOgYHSEC", "2iKL7zr3kl0C", "2kL9sbknSc8C", "2ndITi80AcsC", "2vD8gLn4otkC", "2WG7cwrN2r8C", "2X-PWN_f0xwC", "2xaB9PksH1UC", "2YbevnCXAhgC", "32-r0N8l9BgC", "3A0SF9sk3EIC", "3BJdlkZ6kDkC", "3C05cv30rkcC", "3cn2R0KenN0C", "3GWqOS-52IsC", "3j5tyWkEZSYC", "3ksWYtJflsQC", "3LwmTxRRMiQC", "3LX7nh7hRcwC", "3M1RSHUqkNEC", "3o57NbjApJkC", "3REGuousjN4C", "3rtX9t-nnvwC", "3wasr5JWeicC", "3yMZOhzLhSIC", "3zmVaLrGIDEC", "45ADMg9AA7YC", "48LKoLGCyJoC", "4ikgmM2vLJ0C", "4Ll-PPvmduUC", "4LVeJT7gghMC", "4mmoZFtCpuoC", "4nd6alor2goC", "4t-sybVuoqoC", "4TjL9Ox1ntoC", "4xg6oUobMz4C", "4xlZeu8O3lcC", "4xz9OqthGW0C", "4Z5x82ImmF0C", "4ZjfJ8cPe1UC", "50lo5A_1jDIC", "50qHcSNVVEMC", "5dO2lAMQqhIC", "5GppqmU13pIC", "5HkS5BEBKLsC", "5jNPsVIcHt4C", "5k1D1TO3iQEC", "5KHXPeiSYBgC", "5l3CTPeF4D8C", "5MF4TPsIZj0C", "5OYP9Rt0NdoC", "5PorGvw6SjkC", "5sWxHTayN0wC", "5wsK1OP7UFgC", "5x1lzLq2Ft0C", "5XEMuJwnBmUC", "62l_suJtyz0C", "64zO-_FNDrsC", "66h1xWOV8c0C", "66TgFp2YqrAC", "6hkR_ixby08C", "6LpfzaGv1aYC", "6lVEKlrTq8EC", "6PY_emBeGjUC", "6TasRmIFOxQC", "6TfTS9ITW7UC", "6y_SmPc9fh4C", "6ZVkqm-J9GkC", "7-Fe-PRzbEwC", "7AFwtCfB7acC", "7C7oIV48RQQC", "7Sc4p5-ghJcC", "7TKf8BQFoF4C", "7wvrD78mUEcC", "7ZNiOo89Er4C", "834s9cWP4rgC", "8_KTbTmM3M0C", "8b-2gaCHPC4C", "8c9a9jarbMwC", "8HLqaeTFg7sC", "8i65CApWCnUC", "8jkBcSDQPXcC", "8kj3dlshk88C", "8md43ihiJ_cC", "8vZBfWypDhUC", "8wRu5InF79gC", "8xNAMDp9NasC", "8YugVtom1y4C", "95As2OF67f0C", "95ZyM7vujG0C", "9a_SyUG-A24C", "9aHawVmF_lgC", "9dqQY3Ujsx4C", "9gUrbzov9x0C", "9IH-7kSW4aIC", "9nOljWrLzAAC", "9oCHolP7FD0C", "9S9__jWLI9AC", "9uheAs3jS0sC", "9ukKq4MTYosC", "9XwBSmv5gQkC", "_0H8gwj4a1MC", "_0W5ByvEPEgC", "_2BuAVaMM5YC", "__sIfvwqVWwC", "_blECNR-6_4C", "_EyFjj8RjOoC", "_fehXFJYw0IC", "_kWzkDcAGDwC", "_phRPWsSpAgC", "_uBqNByaO0AC", "_vLmG9qEROgC", "_W-HKRVsfoQC", "a1oW4XozmDkC", "a5EoTv1OyTUC", "A_LL2LQASdoC", "abo7EABChYAC", "aDUcWY2ewlwC", "af3tmwYlgBEC", "aFcsnUEewLkC", "AfL0t-YzOrEC", "aGJPbks3necC", "AhEBg26pUNUC", "ahvvPmDtF-YC", "AJ_eBJtHxmsC", "ajd1V305PgQC", "ajqdpRHpO-oC", "al-R4JKev9EC", "ALeXRMGU1CsC", "amcdGPg5Q7gC", "amXicbM6BCkC", "An0-v7dEJjAC", "aP9K8wyxm-oC", "Aqidsw3SkDUC", "arXrC7N2IyYC", "AS3uSFlVv2AC", "ATNy_Zg3PSsC", "aUJNgHWl_koC", "AW7ekICdHAIC", "aYLi55kim1gC", "aYNCTZ16yAYC", "aZCAXVMDh6EC", "b6BT-AYpUNEC", "b7GZr5Btp30C", "B8_1UBmqVUoC", "B_1HgSfFnnIC", "BCvtssom1CMC", "BEwIQs5xY_8C", "beXegQJwqTQC", "BgVuXsW_gO0C", "BIJZTGjTxBgC", "Bj2HHI0c2RIC", "BJGCuje64FcC", "BjVsa4uDdAcC", "Bk_q7dal8XAC", "bkz7stcdbKgC", "bL7QZHtWvaUC", "Bm21Fz4TD-4C", "bn5GNkLfnsAC", "Bosc5JVxNpkC", "bowcw__fhuUC", "BPm4izC3prUC", "bPoVokUhRC0C", "bPP8Zk78a70C", "BQ2L4J6Xy4wC", "BQYR6js0CC8C", "BraohBA1avIC", "BRXXrVQEjHcC", "btxslX4AXTUC", "BTYXkirY88QC", "bv8IAqVh8EAC", "BZ1BmKEHti0C", "C0sUyTpAAQYC", "C636G0btdUIC", "C7M0tiUKMccC", "c8ALAAAAIAAJ", "CAFR6IBF4xYC", "CAm2DpIqRUIC", "CAVIOrW3vYAC", "Cayp_Um4O9gC", "CcjUGVlekQQC", "cdBPOJUP4VsC", "cigGNKrQzz8C", "CjAnY99LwTgC", "cjdNRUsOhgwC", "CKM5MUMtlcoC", "cmTZ3RMv_OwC", "cOhb6JXKOrQC", "cp5XkRVbixAC", "crzkrzMji6MC", "CTrT6wh172AC", "cu5IY6ygv9UC", "cV8xnSIa0-IC", "CY3b0mcDF9QC", "CywS3hbvth8C", "cZa3DlaSTqIC", "D-3KYbfqI2UC", "d1VgIgCq18sC", "D3uGQFvx8DEC", "d5JwYbI5P3cC", "D7TseoWoSbMC", "D8GqhULfKfAC", "daHa8NMqnwQC", "DB7nanStgAgC", "DcoqRQ47bBIC", "DdlNuvGMPisC", "Dg6SArOSCmQC", "DiWBGOP-YnoC", "DjV5hgTWNGEC", "dOg7Q9_JWAMC", "DOGQDHo8ihIC", "DOkj9TTvvN0C", "Dqz-2gf6E6UC", "DtRpdVi0Wk8C", "DujYWG8TPMMC", "DUKA1_lFigcC", "dvn3uent7VcC", "dYY3FF9jZbMC", "dyzDnCLWJugC", "DzpLddaKog8C", "DZvXOwntNZ4C", "E-Rugdp6qhcC", "e-xsrjsL7WkC", "e4a5-ItuU1oC", "e4igHzyfO78C", "e5dkxDhDjCoC", "e62RhdqIdMkC", "e799caakIWoC", "E_9NtwNY7UcC", "EAKnwRtpLcoC", "Eb42B-GQzV8C", "ebmErco-iKMC", "ebnitl7SNLQC", "EE6BmZJN4-gC", "EE_RN4aVs6gC", "egBeCRxm5yoC", "eHANhZwVouYC", "Eiji-EnuhXUC", "EkMVZUxZrgIC", "ElF3FHwouuIC", "eMBG_soDdNoC", "eoh8e52wo_oC", "eoZbYsAa4x0C", "EP6-ogoEBlEC", "eRFL_367VoUC", "eTve6XEUbYIC", "eX2ZaT-4_wsC", "EXxAswWsfKwC", "F-xrdbnQ6HQC", "F40VFo10z_MC", "f8EOBjMJMZcC", "FDjtQsXv_JUC", "Fge-BwqhqIYC", "FGVwp_WrWNwC", "FjgxVAzS5UQC", "fk7SawIjG3IC", "fKfSAu6v5LYC", "FkhBUABBe6YC", "fleOoPdOHuUC", "FlUj0Rk_rF4C", "fnO3XYYpU54C", "fPEKgIA1Hs4C", "fPzgHneNFDAC", "fQPaHzqyUxoC", "fSUZa2YTDcAC", "fTQhA56xtM0C", "fuL-_BhZFyEC", "fuq94a8C0ioC", "FVC9eqGkMr8C", "fx3wIM1_DSoC", "FXs-uRSDBFYC", "FYMVNMlz130C", "fyVtp3EMxasC", "FzPaB_6Pw4MC", "g-NdglUBHSUC", "G3ig-0M4wSIC", "G_yomLlpp4EC", "gBJbpHyFf7MC", "Gc8edC9wPEgC", "GDDhso7XjngC", "gdTIB8pfyREC", "geN6MUthHdkC", "GhCHtcyf9AcC", "GkWRVHPpQ0gC", "glIu5tT3abgC", "gM_IMlsbTqUC", "GMuSEzGL5XcC", "gnh2Rb1rcMIC", "GOblIwn-0AkC", "GPE6ZAqGrnoC", "gPHjjrNWaQwC", "gPvk-eE7t0IC", "gRNDLAK4kPUC", "Gs5PRR9-8BcC", "gUsX8yzMHaMC", "GvK7m9Bm6UsC", "gxFGJu_N8l0C", "Gy_T3abN6AEC", "H1VPa_mPaakC", "h2VxxlEKTokC", "h3g3GicFWGoC", "H3nCwyx8bf8C", "H_yEm6z1u84C", "hAi3CdjXlQsC", "HAjfSA3ir3kC", "HAPhBsmxtaYC", "hbOtcP4F7zIC", "hC3cgIKwXkkC", "hD0PNMu8CfQC", "hdvsn-N4nY8C", "He7Ge-Dz1HUC", "heBZpgYUKdAC", "hhdVr9F-JfAC", "HhwifKDS9ZkC", "hLjVKucYOtsC", "hmfbjsogFAoC", "HOLITuv6UvkC", "HpH7qJNt7MkC", "HPkTKm_bUbgC", "hqucruPBheQC", "htZzDGlCnQYC", "HwYh_FHh2VgC", "hXGr-9l1DXcC", "hXGXc2iPKlUC", "hxml9KC0GBUC", "HZzpv5Q5fBMC", "i-Mt27qe598C", "I33IwXtJwbIC", "I3aNPR1FursC", "I5GcpyPx3RwC", "i9iPG7C3EP4C", "Ibcy57Hz4tcC", "iCDr6AsHO-UC", "ihzLdVtdZQ8C", "Iisrp6FPHaYC", "IjxMRgYhQPYC", "ILPNO5j2sOkC", "IQvFpyBhGHEC", "IrLXImwvDiEC", "iTpXLrPR2TQC", "Iur4CMs_EtYC", "ivEfPj-mpqcC", "ixHcs9C-NCUC", "izPo3KwVucIC", "J4DVFmMLjOIC", "J65nNxyoKVQC", "J93o05MH3v8C", "JbhLhvJ22gMC", "jbOHb2BAwzQC", "jboIUDsekmIC", "JCXZJSfCVHUC", "Je0qlv3ZQQ8C", "jEKGKWorNlwC", "JEZzcN8G67AC", "Jh59S6WIS98C", "JHMdZC08HhcC", "JhmWHw3qfDIC", "JHNPbt7pEeQC", "jIj-qAflWxQC", "jInV9Bd_Z88C", "JL1VM5wMbrQC", "JmTIWYs3yhwC", "jpxkQ-1elyAC", "jQA6wVLCINUC", "jQJ1J_Vw1N8C", "JrNoQNpSM4cC", "JuLko8USApwC", "JWAjm234VJcC", "JXFhzfy9SZAC", "JXWOqakIlREC", "Jy_rBRz9u-MC", "K-Y4mWxqh8YC", "K0mrPqWzMB8C", "K3GS2HFqOYgC", "K7VPVr0gtg0C", "K82mOsYwq_MC", "k9n8v_7foQkC", "kAa8wzlx9G4C", "KByAsGhYJAcC", "Kc6tnRHBwLcC", "kdDRJLxBhl4C", "kfMew5cFAJsC", "kFpd86J8PLsC", "KgfHxvGFHAoC", "kgvhQ-oSZiUC", "KHuYOF29QyUC", "KI4TH6s01esC", "kKLbyWycRwcC", "kmCI6l0o-6AC", "Kn_OAuktbq4C", "KNvxPSAYzbQC", "knzNIfmU2F0C", "KO0HSzikNoUC", "KO0tMOWl5AEC", "kP5qDIDDzFwC", "kQ9yVsm3mFgC", "kqn2-JywK5kC", "kQN2jMWUrSUC", "kRekNRGo3NYC", "ktma1QNK0MAC", "kuEjSb9teJwC", "kuFhjNZuHTAC", "kYYkfkHZGksC", "l1Sqtmj1LkYC", "l5tycCzdgNAC", "L9sYq3XSLmIC", "l_1xed01BsQC", "LA15eDlOPgoC", "lBg47Qr7fX4C", "LbVCdCE-NQAC", "lbxIFujfyIwC", "LE66AM36fHgC", "LeNwsQ-5Sw8C", "LFk3pHpFiG4C", "LG3-9h0ZtiMC", "lH6Sy-O13e4C", "LjcOPtNNcZ4C", "ljcOSMK7t0EC", "Lo2uCECV__8C", "lOnWsyu-u0cC", "LOODynIU69wC", "LQyUKopZcSkC", "lsQx0-3BPV4C", "luIVsjEYeWUC", "luUj8miPuIIC", "LvgD47sRQaUC", "lwaKAqUMG10C", "lYi58Tv9XpIC", "lYlMNqYwBUIC", "lYxfy6eJ_x8C", "Lz7LNak21AQC", "lZJD2zYGbNwC", "M3S8TS_impUC", "M5ebQh1lg8oC", "M6_uZrk7lyIC", "m6cQfXCETnIC", "Ma77jxOOmBcC", "mbKKzi5FniYC", "Mbo_p4-46-cC", "mc01rIPvkfYC", "mCE-VlYSRlIC", "mCGvUhYJBGQC", "MdPIAGigJigC", "MEbKsiomE2QC", "MF8yfy5cq5wC", "Mfjv6snK0-EC", "MgAqE2DCDfYC", "mGOpScSIwU4C", "MJcrTG6tJsAC", "MJPLCqIniGsC", "mLdLHhqxUb4C", "mlOa7wPX6OYC", "mmi_hBrCMMAC", "MMQDgUxu910C", "mp-IUPLINmwC", "mpAhhjPPZMYC", "MS2f3p0j55oC", "MuaMgeJ4FF8C", "muFCYYdoG4cC", "mz5lxQxgegQC", "N1hm_nUeIToC", "n2FA-nwz7GYC", "n5BlBsFbGOQC", "n6eiH3iPVKYC", "N7BvXVUCQk8C", "naJdU5fxuNoC", "ND0pmtL28TsC", "NGIIGZmarOAC", "NhAg6qFMThYC", "nIJWmnfzNGIC", "nJ35cT-IGAMC", "NJz6xRVdOgcC", "Nk0jHTnCg8MC", "NKbAEGF4N9wC", "Nl-vaAdJD3MC", "nLdLoB7zZ9gC", "NLngYyWFl_YC", "nrQ_3YxoE_QC", "Ns7psv2IJ7MC", "nSzoG72E93MC", "nT2kbcDtMl8C", "Ntn27W4nT7wC", "nTOFkmnCQuIC", "nVbRKyVBDGMC", "NynQQGQbglYC", "o12obKDqiZQC", "o1YpDokP-8oC", "O32VXB9e5P4C", "O7Rbx4ptxqsC", "O7vMyhYJtKQC", "OcbAOkX1uRYC", "OdbUxdAghF4C", "oFnWbTqgNPYC", "ogUR3V9wbbIC", "OID48u6zY4EC", "OIWNFaJvJokC", "OKEZgru9cnUC", "okSjKZ7An5AC", "OMRWM0-gSnMC", "oN4xZy_2DKUC", "oNklVtBSda4C", "orHgII9AODoC", "oU_-6ikmidoC", "oxfoF_gasvsC", "oy-P5D7hTVAC", "oY_x7dE15_AC", "OZVeoomxxhYC", "P10p-iR2zcAC", "P2PkZfwL630C", "P3sywFksmrcC", "P5GsREMbUmAC", "p7-Enmqb604C", "p8i33BpBn0oC", "P9YjNjzr9OIC", "PB733uKl-coC", "pBiPKtOYWpkC", "Pd8-s6rOt_cC", "Phtqa_3tNykC", "PI1s90jUcHgC", "pJX8yAaMtKEC", "PK_BGGCU_dsC", "pkW1ckw93vcC", "pLhb4dAWIAgC", "PmwfH7X-IKAC", "pnH2Sz5rY0IC", "PnVKu0Yp2bcC", "PnXSXb6866EC", "POG-LSUgYckC", "pPcQ1RIn9AQC", "PqcPCgsr2u0C", "PQo7zbsvwl4C", "pSdaNuIaUUEC", "PStOS3H5LxgC", "PTAiHWK2BYIC", "PtGdSELRYuMC", "pTyCHGmAgf0C", "pX4yxOHnWg8C", "Q-R13b1QdjkC", "q2HObxRtdcwC", "q3HwhfjRmswC", "Q5P2lFaM8GgC", "q6_56x5tB7gC", "Q7yPw1ODvBUC", "qa29r1Ze1coC", "QagG_KI7Ll8C", "QBebLwsuiSUC", "QcPRc-WAI5UC", "qDhd138pPBAC", "qhOMLscX-ZYC", "qIh6FkKdQP0C", "QiJRvuXA_VcC", "qjjEsQv1spQC", "qk8ps8dtZgIC", "QKoOBXQZAMoC", "qmY3JmLtz60C", "qop8k5f85LgC", "qpVATEIQeEYC", "QQdBlDBUFywC", "qqeX8MJurLkC", "QqNpbTQwKXMC", "Qrw6vrtkDp0C", "qRza88jRTx4C", "QSBlbbkXDwAC", "QSljY8xP2psC", "QUA-ZtqMZqIC", "QUDMaGlCuEQC", "R0UdWQ5thf8C", "r1ulmNr6YWoC", "R5P2GlJvigQC", "r6t8AmFSZ80C", "R7Frpn3g9AEC", "RbOYBr0M_wgC", "rcEEeFWBx_sC", "rfJNoXk8UIEC", "RfKMOwRb1-kC", "RJcBeywz9uMC", "rJiKbrZcijAC", "RkguTdoH3VQC", "Rla7OihRvUgC", "RNkFavRF4ncC", "rtpgMCVSopIC", "rTuCTr1pdc4C", "rubP60KftfYC", "RuX1cSRsL_0C", "RVrOhyTWpJ0C", "Rw4u68fxYQMC", "rxC8j3j8MQUC", "rxrJ1RWBXK0C", "RYCMx6o47pMC", "RYT4ylLK-D4C", "Rz3XpyQv5gEC", "s-8jZaXpoBAC", "s-9zCT2bTr8C", "s0khq62YOaIC", "S0lDWprGB5cC", "S1_hPAL8obUC", "S2lqgDTm6a4C", "S2S9xPNlGoAC", "S4BJKqVYjrEC", "S57m5gW0L-MC", "S6U6qp4xJMQC", "S855YcZlshgC", "s8gX0VAyexcC", "S9Y2JxSVJcgC", "sC81wohqV8sC", "sDUEiJuHaW0C", "sfduJhZsoT0C", "sfvnNdVY3KIC", "sI2bAxgLMXYC", "si3R3Pfa98QC", "sInqr5ILPE8C", "SJXr9w_lVLUC", "sKbCtww7hacC", "skEwuRfPmx0C", "SkswFyhqRIMC", "sna9BaxVbj8C", "so0gddc0w3UC", "soZMXyEm0aAC", "Sp7z9sK7RNkC", "sPpaZnZMDG0C", "SRfKde-5LI4C", "ssEbmvfcJT8C", "STxlycWlVS0C", "sVH3YlIZK5QC", "sw6FvZ1pTX0C", "sWu2bfKcyb0C", "sYgTwHQbNAAC", "SzKVdMrU7i4C", "T0Av5fU9BTcC", "t1RCSP8YKt8C", "t4xRL9aEebsC", "T70Ahd88jSMC", "t96gl1TfRBgC", "taa1oB24qmgC", "tfOQ4dzVxUEC", "TIlDhmuZ3QwC", "tiwxzqYq2o8C", "TJDGTP9Sa5UC", "tKoGFBA-nIEC", "Tl0N2lRAO9oC", "tl9q9DbnkuUC", "tLbt4eCcltcC", "tLWve-VvBLoC", "TnVICuub4UAC", "TNYhnkXQSjAC", "toNN2yNKRBIC", "TpEfdRUQdKUC", "TqRn1lAypsgC", "TRXrMWY_i2IC", "TRzS5F92QYQC", "TV2O8YYqz1AC", "tV4Kh6qMU24C", "tVtKEWjIrnMC", "Txr71zy_pRkC", "Ty8aEmWc_ekC", "TyoOzgIlH4QC", "tZWnNPKg1K8C", "u0ksbFqagU8C", "u1RmDoJqkF4C", "u26ijgx0v_EC", "U3rMsphfCLAC", "U7G38s4y0VoC", "UAgtStKY2ycC", "ucNMDAWWyLsC", "Ud2goDsqfBIC", "uDgXoRkyWqQC", "ue_JYo-k0_wC", "uhIk3OddN9MC", "Uhm87WZBnxEC", "UhRSsLkjxDgC", "Uip3_g7zlAUC", "UIqUmzUf9sMC", "uJpXCZGxbZYC", "UJwfDYDJ-v0C", "UPeqxCF1adMC", "UPFHb7vEgjoC", "URkMY_t6RQQC", "Uui9coi6DZoC", "UujKmek0_9YC", "UUl7Zyj841QC", "Uxw6_S0NNhUC", "uXwyf1bWtFIC", "Uy9PbkDwisYC", "uybFyRcJQdQC", "v-iDn44wlr0C", "v-walRnRxWQC", "V3me7QWAZR0C", "v3XWH2PDLewC", "V5_0Tgm5ZUQC", "v8du6cp0vUAC", "V_FUpOrlnqUC", "vaNlzzIqXe0C", "VAzHhu4oFfYC", "VBI6JppgQBAC", "vbu2gis26C0C", "vcfj4xsrlg0C", "vdsK7BPGya4C", "VeoKtu_22q0C", "VfHuIq1s1pkC", "VfOmTJsotWAC", "vg1qPwCc-V8C", "VGkkjkLPZkoC", "vlhLAobsK68C", "VNetYrB8EBoC", "VocWKgK9SxQC", "VTHTUY5rUEMC", "VTko4TvTOgsC", "vTYHNyrBDfIC", "vx72IzkGD98C", "w-rb62wiFAwC", "W37zSNcybaEC", "w45BbvlRh1kC", "W4SqcNr8PLYC", "WB3wKoZRE3EC", "wcFGH-zIyGgC", "WCO0Sb1KLAoC", "wdqStSm-iY0C", "wfFiU4nPB0wC", "WFPgBUSv4PoC", "wGxmfLq4b_4C", "wItnFpuHr60C", "WIyz0mYxAwkC", "WkHO9HI7koEC", "wKJu6g5ovhcC", "wmDQ_3qzvmIC", "WmnpTpW8NOwC", "wMZIv4IxWI0C", "wNfB3AQSx1IC", "WqMMAAAAIAAJ", "WqQMESs4msoC", "WqVq6SDhtjQC", "WrSpNfsBcocC", "WVofz29Hx9UC", "WWBccP5LebcC", "Wy_kuQZzfdIC", "X39-syX449AC", "x46qiaccZLYC", "X6RtpboH478C", "x7Mdt86YwcAC", "x7YtLD4uLogC", "Xb9O5yNS5GEC", "XbWEsxy-2PwC", "Xc9xDgHgvaYC", "XCHXGyItdFIC", "xDSBaet2uSsC", "XG1CKclG-m8C", "xHy8oKa4RikC", "Xj95W0fz21IC", "XLaAIkKiydcC", "xLpndPXF3xwC", "xoM0DgW5FU0C", "xOnhG9tidGsC", "xpSSfrWCyfAC", "xQ8-prtJK_gC", "XQvkEb6_AHkC", "xR837PDL2tMC", "Xsf9OUuxtXcC", "XTcjm0flPdYC", "xukJAAAAIAAJ", "XVuRuM96pI0C", "XwC0xZU5z7kC", "Xwp8PCPA3-gC", "xYvLraxYTZoC", "XzJdpd8DbYEC", "y16ww5ZsJ0AC", "Y3uctGmr1XQC", "Y7vSVW3ebSwC", "YESB90FOStQC", "YFDGjgxc2CYC", "Yi0QySjju4UC", "yJwNrABugDEC", "yK4JAAAAIAAJ", "YlbvjEgeDlwC", "ymJ9o-w_6WEC", "yQxzIgfbG6cC", "ys_jtGM5WjYC", "YSkgXOledRgC", "YSvUvc0IzL8C", "Yt9tXLgiV40C", "YvxjJ0F0byQC", "Yxoe-sEcHNgC", "yyL40aHSTQkC", "Yzcf8RFQPmUC", "z160FGJyrikC", "z1DfFnoxQ-cC", "Z2p_Um2rCV4C", "Z6nJYDZOMWAC", "Z6yTi6HNUWwC", "z7VPlZZSZXEC", "zbDszWGvA0wC", "zcvgXWIpaiMC", "zDPLJqiMPsUC", "ZEbSSqwIhDsC", "ZhXjJeiefZsC", "ZID9VvvWiaIC", "zIYCfy0NnGgC", "ZLpcgAQvr_gC", "znkqSl7cimIC", "zpcP4AV_jPAC", "zqOfU_Ckag8C", "zr509w02h08C", "zUXuJTJ5sKcC", "ZvwEDOhLbpEC", "zWccvj_kr6YC", "zxAN9KvG-REC", "zYxRFAYcAZsC", "0DQaTU7Opq0C", "0ROwDrcmHssC", "1MsHm6me4XQC", "1n_qawoy41MC", "1Qgt4oyMwJQC", "2cLeRqOi0zYC", "2gg7P7GCBH4C", "2xsjEwJptn8C", "5jk0aWSzIPwC", "6AO31B6yUVUC", "6CyOE9PdJxgC", "6X745rS5Ci8C", "78QSbIswtQAC", "7VjyaoCFbIgC", "8dCnb4uR63EC", "8MXGNxVINkAC", "A8amtX_z1WkC", "aJyGy_eOeQ0C", "aLe4HgLkgr0C", "AmaLNTaGYxsC", "ARI1y0bu8UMC", "aw4MbnSCfnMC", "c8WH6c7_RP4C", "C9CVARo5snsC", "DA3SRxogVOwC", "dKIo6D9yh3cC", "DUcbyaGlYo4C", "earytjxi6pEC", "eBkmbFDT0PEC", "eubyMCDFlu4C", "fnVy4v5pZPMC", "frpHqlVH-O4C", "g0N8hOgFz3QC", "G87TWxGRMscC", "gDgXbx8hEjAC", "GsN2SVvNZZYC", "HcDMKrh-_fEC", "HjmIMdOx6-cC", "hW-wnqbfrdkC", "injpY-EerZgC", "JIr_egKfnDUC", "JP7D17zIEowC", "JQGHqScEFtoC", "kJp22rZDOZQC", "L1ZJT0XrFZYC", "LjHYjEZy9zMC", "LqdNEHd4Mg8C", "MAKtC4g83WsC", "MAyXHjLS7rEC", "MbGpxRxguagC", "MeBFzDmECGoC", "MeO8b6S9lb4C", "MhR5a-2nrhoC", "MJbBqn3XWqAC", "MKKPFqc3WqYC", "mp6P88ff1YEC", "mpEBZLxaLJQC", "mPTi-oZ3x-cC", "nWNI5NeeYEgC", "OnuW0ebjkaoC", "p063Z0CSLa4C", "p15Pwk-192wC", "PWnWRFEGoeUC", "rJSXMIxpcngC", "roXy5kT34j4C", "rRQ-ln-SYnMC", "s-IKDw_xNO4C", "S4ek45Si2AcC", "TjOfAy2tnb4C", "u2rIbGeX4r0C", "Unws1YIys8cC", "v9mR1wFHtq8C", "wCnHmQnPNmwC", "wlSmtlw6-bwC", "WptXk482oEUC", "wxJ9j6s_wRwC", "WZEAkY1LdtAC", "x33cjhYYoKQC", "xfsr4C_BvYwC", "XLJB3gh7LgkC", "y13y4Y5k1pwC", "y1GjTaSmauYC", "y7RoHrgX7yAC", "yu9H0Hv4Ot4C", "zd_xk4vIXsUC", "ZgVbSPYVs5sC", "ZoZZm1TYsUwC", "-jb3fATxhIkC", "1cuf2UOiRT4C", "1Mjd2GCRPmAC", "1Yt77zSb6LsC", "20DKxA4xziQC", "2znEBgYpeBIC", "3CqwLGSH1goC", "3iKRM06GXdwC", "4mcT7A371xQC", "5ge0enUNb78C", "5TMsK3VRLeUC", "7tyEWZr5iFYC", "8ELEochuwQkC", "8MCjH9CygmAC", "aqb3OYAzq1kC", "b2H01Xb9Ma4C", "bi0-4WDPGrEC", "bNO3yU4E1FsC", "cEcUmWap-CUC", "COrG7hjNlzAC", "cxHK_QB8XKwC", "dNVtHXmiDsQC", "Egiv9G3sUUQC", "ep5gtKMz8EMC", "exEgXSQhK8cC", "eyALF5NigoYC", "F_-1q6fZd7MC", "FPzap8_I4SgC", "FREOMhfr83sC", "gLrXMmu9mRUC", "gPb8y2rfjp8C", "iydRKCdhKwQC", "jZjO1mQYWd4C", "kll6h_lodrwC", "KosqNyzeyccC", "KVEq58n6iF8C", "lLtq-tWVp-AC", "lWipWdrHsMwC", "n7eJZppCVjAC", "NqBNe1RIDHsC", "nSh5F2_xXBwC", "nTlbdMveXwEC", "nWmxMXOnZcMC", "O57Cwf7Sz5IC", "OPp9I41o8XUC", "OZVrxulVBtoC", "pCP2VfWmEYwC", "poxr4hi57aUC", "PoYKChoswe8C", "PwUF_UMTZHgC", "q0nXhXclx_UC", "Qd-7TwoF7acC", "QnDvIsNKNIwC", "rCZVxulC2WkC", "RHpWjc4FaegC", "rugwMFpIA8AC", "ryIHc_dFg9QC", "s8arC-pIXY4C", "shIupOtoVfMC", "th8NdVD8E0gC", "uVcMr-ke0sEC", "uvr8XVTzrNcC", "v_AhjnYqvwAC", "Vx6CHHo8pz8C", "WVKiq9stTNgC", "XAH5bMCkKOMC", "XaoYP7uYIaIC", "xo77Lp9wHHAC", "XxRpPZ_rvD4C", "xxXRcfoL824C", "yZwjL-7IRTwC", "-2yQLxykXdoC", "-63xyvVTNwIC", "-e9rPAsnJ_sC", "-Joj2MhFqfoC", "-sC56mcAocsC", "084O32ukZIUC", "0DPypk1BLE0C", "0hA2qfGXhngC", "0xMxokVu8gsC", "1W-9MGOa_GkC", "21An6w_jf2wC", "2_rnWxsz-vUC", "2P3667UaaiQC", "34uu189sV_oC", "39hsjKwsqo0C", "3w0uK79cj_oC", "4cAsr_eptg0C", "4Hes-lClFOYC", "4j8n8hIBEa0C", "4jUjPh64X9UC", "4PmYFVJqM5cC", "5I5w_BSa0t4C", "5N78fogAH9QC", "5Q4wTKEAcT0C", "6-gRK9HMQKoC", "6huHRNMyNHIC", "6LQFtclkwvoC", "6oPfuGceReUC", "6ToRJrRHIg8C", "6uxXorE4r-UC", "6VcFyV09_aQC", "6XC3WJCTitkC", "7_UDV5Qtak8C", "7eP3jOihyjgC", "7KjggICeBJcC", "7lw7lR80rZMC", "7Yhkld-Fr5wC", "89Ncr5FRfSUC", "8h53hG89aOAC", "8KSd2u8LD2MC", "8wZbEcJsi94C", "9DpbNlLT934C", "9INFeLkvCXcC", "9Vinatxm4nUC", "_Eeh1L3IZxgC", "_rewTS4v-EsC", "_sbGtJRO5ewC", "_XIBgBYFL3MC", "_ZjCNO3mv1UC", "ae_pD7pHuI8C", "AkKj4l2F3kcC", "alluQPeRBGMC", "ancSAJsaedoC", "ApiIleI7naEC", "AWcV-S0y5TkC", "azEBqa0MXt4C", "b2St6X76bs0C", "Ba_8Ulu01o4C", "bcVMkcCoomQC", "beTVIkCGUfsC", "bw7SVDqiXN8C", "bwRPfOCzpcAC", "C5SIEprnWoUC", "CbjT2wba0LkC", "ccwXeaPkuoUC", "CUxLphJ34_cC", "Cxs3wKnB9SQC", "CxYXaAUJytUC", "d2bXnMAEJnQC", "DFhKLhM96vYC", "dHlP3pvh__QC", "dJJLK7Pp44AC", "dyT0IvLPFgQC", "e-qkVO01Gu4C", "EBKfl5RSwiEC", "eG47cVekPg0C", "eHAK8fdo0_cC", "eiP2wOi3KYwC", "ej1kzdwRbl8C", "etZroNcGKbcC", "Ev8E12hG8kkC", "f9sAf8jPkwoC", "FkcyIXUg-o4C", "FsdsMdM29hsC", "G0LZTx33-x0C", "gqAM-eIG2ykC", "GSr_S-qHI4EC", "GU1cifth7UAC", "gXf91p7v0SgC", "H4SmRvJ5shoC", "hARsDKA-f3QC", "hBwJqBsSLqMC", "hcGD7oT41e4C", "HktLkMtT1TUC", "HmZMBoTuKUEC", "Hopo4xCUcO4C", "hrSvSVdsU2oC", "hX7yGLd7ghEC", "HY3QRixFRWgC", "I9Trz48CCN4C", "IFlpcI0GS0UC", "ihIbEYpA_RcC", "ioy3vqVglTkC", "iqDmeypmglMC", "IyTKqDwkecMC", "J1oe7HvFoyMC", "jBcboa6zxMEC", "Ji5bZMlHakgC", "JnMEcVuQtcAC", "JpuMcmrhlTUC", "jVVZdthQs3gC", "JXjE1ODVPYIC", "k94DhcD19SkC", "KCIQVzXg-lgC", "KgxJ912PD38C", "KiVkPTWJCsAC", "KOvFJOOVMLsC", "KQnU1ftyUCEC", "kxFKNqDXd3EC", "KZhh4_4gq2gC", "L6YLdYgyO94C", "lQMtArj7klYC", "LSfIVk6DSekC", "LUwmBJ6YeAMC", "lXvXAGo4PxUC", "mDmcW9KR6r0C", "MQhZlYc8JHYC", "MQnawiTMcDQC", "mUGSaiTsBAIC", "myEezv0t178C", "MZsXsF1Ud7wC", "N15Bxyj-DM4C", "NPZYBrWZPVAC", "NYtR9fIlXnEC", "O-r-wnVA4mEC", "o47MZTN6c9sC", "o5FSTZx-100C", "ocsTmllg7nQC", "OKs_Q4orV6gC", "P8aq9mlY994C", "Pi_UoFpZmxUC", "PJSBn8GOSbsC", "PKoiPvi_5eUC", "pN2PxCR_-agC", "pPNIei42SgwC", "pqJRCIXAFSgC", "PQP6e9H1tzAC", "qgKMMROhGCEC", "qgwv-CpcWykC", "QIc__kliKwAC", "qiTF90Oo5KUC", "qlO8hMCAsEUC", "qPlNAKakhiIC", "Qr3LshsVPJQC", "R1-A3Ad2_8QC", "rGtHSwTF7soC", "RI-jGHJ82oUC", "RUW-hYKZBS0C", "rX73rwDuFw0C", "SJe2yL_R6JQC", "SP5BF1gA02YC", "Sp8XJxAfu4QC", "sxTKXYdFbF4C", "sxzxivjTs9IC", "T-1tiE_D6ggC", "TbL8h1SJ4PQC", "TH03T-vmAoQC", "tHbd0sXwIp0C", "ThM-8xccpOoC", "tnfIZlWC6HsC", "tOLFrSSbFD8C", "tp4ncMbnOEMC", "tRX8HYsd9s4C", "tSk1mvtq_iYC", "tT_D6rYb9IYC", "tTNMgO5_CHQC", "TU3k6MuE2BAC", "U3MN8AAaD5YC", "u9bP7QbozNcC", "uD6UZjMTjg8C", "uf3aCkUbz3oC", "UGb18NmjOTkC", "uKp-VsaCNMQC", "UmBZOMbtZZIC", "uQ1rsATfO34C", "UqIvGf3jRHoC", "UQwjcdyVWPIC", "Vg-jISv-naoC", "vMcpRqad5-gC", "vWWaPvxsTfgC", "vWXzNR4adfwC", "w1KP1fpepAcC", "W6TImqN5HpwC", "W_L_2yTfOEEC", "wCvZ9ksz-zgC", "We5JWvX01HkC", "WfK9oTHKNqQC", "wSW30jYW7qEC", "WTunFBRfhWUC", "XD9Kbzjja38C", "xg_XzghnjRYC", "Xpid-HEEpRUC", "y-A5skJWwlIC", "YB4ADAMeqIAC", "YCWHcGaIhksC", "YGvfcDwewVoC", "ZFn5mActQoIC", "ZjmqkYh6uGYC", "zN-ZBSv2UuIC", "zUOwyWMDCMkC", "ZvnYdfPW-i8C", "Zwlpxvn9MrcC", "1d3XWXXxnEsC", "2ANRSQIyYqYC", "2JYJicwT84cC", "aaf6k3DWcSAC", "AgXcLEG_-SIC", "aSAXAAAAYAAJ", "c_BRQDmCqcoC", "cXdKAAAAYAAJ", "eGGYWL0962AC", "ey7Oa4CWqp8C", "FeOinIzH49kC", "fkRwjQz0O7cC", "FoWo8VitsoAC", "GKc2mPfcZ8AC", "hFSx37SaQRoC", "HQu0fXQ1oXwC", "jeVS4jRjSlQC", "MfkNV2DW_3oC", "Ms_VAVC4IJ0C", "QJ93ffsVAHMC", "Rf6rp_UfnBEC", "S6BJ94y1jnwC", "TXnD5iuM6DkC", "v3yqHR7keCcC", "xEooBgVLQY0C", "XlsVAQAAIAAJ", "XOkiRiqhCMIC", "xz2LhK79I3gC", "YV0IskcivVIC", "-4JaSBhEmmgC", "-F7oqyLU8yEC", "-vWT6E7gwRYC", "-xJpukMoY2kC", "0Sb9rQ5Ewd4C", "184dpojuVVYC", "1CCCWMqPtzEC", "1cx5KF8bz9QC", "1KdwvK9lLVUC", "1ltSREk9A94C", "1NrVATQ_Z5EC", "2UyX_6Sf0koC", "2X59P60QHnYC", "3-0St2ZXAxkC", "3HDyoJBoLBQC", "3u6N2cT0bOAC", "3yJtseH08loC", "4coo9ddRaooC", "4F1SDVZb2NgC", "4ny3c9qR8X8C", "4qonczmsK7EC", "5Dg9D0fMB-AC", "6ue1tbd-dTQC", "7334_AEUgVgC", "7g0AnM3HoA4C", "7gXh4VqSVUcC", "7sn58GhCxdgC", "8GQCE0Xd2f4C", "8rOvpN2d9TsC", "96i1EXvEucgC", "_3eu9hxU9NQC", "_B4Bef8FTFwC", "_ceeVvxULncC", "_h4Jf64pDyAC", "_mur2PUOp8wC", "_NaVar4pJ6cC", "_VH9YGAUbtAC", "akHTeRj4JOUC", "AMLHe2Co4X0C", "ANOU4FnPuCgC", "Arnvw-uD3msC", "AZ5J6B1-4BoC", "bfXZpcLNv7UC", "brQZSNtn0KYC", "bUmGusx0JwEC", "C-xXxfEAnzQC", "C4MAjfTb2t0C", "CA6h2G_mJlIC", "Cdg_NkdhoToC", "cJ1kUY-wUVwC", "COjPOyLC1NYC", "cW3PW9PbqPUC", "CXFWZuxyUFQC", "cxlwwocKMcoC", "Cyly4t2jHMsC", "D-ctsVAeN-kC", "db-C5NSSIAkC", "DeEME8MFhakC", "e2q53WFE7hEC", "EdoPqnSc6g4C", "ego1raoSBfMC", "ekJA6MZoH40C", "em3obwwfGUAC", "epEsCd50PV4C", "ePwhbo8BwE0C", "eQajBqGgHkQC", "EvFiS2rAlosC", "eXgmkezrzYcC", "F0v4zCQg10gC", "F2Z6uxeA0IsC", "FbTQFXdYCMMC", "FEizu4ZRuRYC", "FshiVC33NhMC", "FtulaDr2j-AC", "fvGy7lnl5e0C", "GBoeXA2d7dUC", "GCyjMr7CudIC", "gKSeZ_VIb9AC", "GlHfBPW8nsMC", "gMHYj6T-DCkC", "gnEGziO0ASQC", "gw6yAuC6wSQC", "HFotoS0lwvQC", "HlYbfBRhINIC", "HnGJsP8JI8MC", "hv0m2jtuXDYC", "I9PuYGBUEW0C", "IgHMY_Xa43MC", "iiepH07oVM0C", "InUl-Q41sOwC", "j4PpSFWmNQUC", "j7XsGbC7QKsC", "JHxxM6mOAAQC", "JiDYXW7kIFsC", "JNuRxUXjmWAC", "jqCjWhYNecMC", "jVL9t0pASC0C", "JxFIS87S148C", "K8VvOPLwg-EC", "kaEecwxX7WEC", "KcOo6u5EKR8C", "KDeCgbRa5jcC", "kflefDbfDOUC", "Kj5w6sZTJsoC", "KyYHVPJfJsEC", "latQHavSMfsC", "LC6iZsMxUpoC", "LgYDKal5OAcC", "LMTMTcWUNWcC", "Lp2G5aLhFZYC", "LPNS_W0lVGIC", "LY1LT83Skp4C", "m_3NPZVcsg4C", "MCP9XkskjIEC", "md6oFs29tVwC", "mD8bF6pFasIC", "MDM7ZFecFV0C", "mim-M3zIAWUC", "mK6MS891avEC", "mLqL7ulqj-oC", "mmbreDPQxlEC", "MnS1IHKV_hoC", "MSXVXP_3cFMC", "mtP0gwO7MEYC", "mUsT853PvLcC", "muw8IPWgGUAC", "N8jwsqqPjIoC", "ngZuhGcX_2wC", "nIuDdBIsS-MC", "nLYzditxyIQC", "NSK9cDNJX8AC", "O9Tp5tX0RRQC", "O_Ve1esIKS8C", "OGUZOmPbDiYC", "ohii9rGckGwC", "OHqefo2QlCQC", "oLjRxbE1SwkC", "oXg0wOgdKDcC", "OxYEcy6azbUC", "p37VqBkJvL0C", "p_f2oSYQam8C", "pEKjhF_EUIwC", "pMo2v1U_VNcC", "PNW7TiM1BJ8C", "Q8k6Z7jH8a0C", "qAAtIknyj_gC", "Qms9PNSDEFoC", "QpXLNs8v_WEC", "qZsoQyr70zkC", "R5-edU1taWAC", "RB0X01C7pg8C", "rFn1T6E0UJEC", "RJQ-tXO2i9oC", "rjTH9c476t0C", "rkRu9OJ6gWQC", "RLpxnrnXXhYC", "RmvQfoKiPCQC", "Rt70xjfLrfsC", "rXOX6BISgrwC", "Sds79NgjU7oC", "seXnMV9-vmkC", "Si1YdYq9hXcC", "SNdZ96QZ768C", "suVX7iZ3Z2sC", "T0u3mLgB7Q8C", "t5c9qWOoXsAC", "T7bAqUjbq84C", "tjnjQkoBnBMC", "tKf9RKS8zx0C", "tNKtrgmE1fUC", "TwgKlwgXZPIC", "uDoVm8-uXfQC", "uH_AITzNp1UC", "Ujyr6whVn20C", "unZllMnur4MC", "UoJqoeANmZgC", "uQBf9FmAu-oC", "UTgWS01SxfkC", "UvK1Slvkz3MC", "UwH5IwTWH3EC", "Uxwq3DdghtwC", "v2RPoiRHX7EC", "vD23gqpkAaYC", "VFeSGRmAYXsC", "VJufAYSsmZ4C", "vlRL88hU1bsC", "VyAIKyqpLFAC", "W3kGJYwFKDEC", "WeKvtiwft_MC", "whdtOuA58e0C", "WrL9de30FDMC", "wzPlQGKox1EC", "wzpQ1ITeIt8C", "XADVtLpi0k8C", "xdbrbcBssP8C", "Xh8GddJI8CEC", "xkkHhFuhPkMC", "xpKEExbb8DQC", "xsv8s0uId1oC", "xurCDqruAkoC", "YbTa79buEaoC", "YDCEorbLCFMC", "YNXPoQiZQDIC", "Yonh5x309J0C", "ys_e1Jaxh4UC", "YSVeIm0jLy8C", "YUsiaYPFcgsC", "z4arig0oCm0C", "ZBkdrgIqguoC", "zmLlHLWm96QC", "-Ac81W-ZQDEC", "-sFkv-rGTJYC", "1xlR5HF9ZhgC", "2UyX_6Sf0koC", "32yoIgkRJOcC", "3e1IKgAVDi0C", "4IFSVDIWAFkC", "4lMynL91Mw4C", "66Dm4p1wxqUC", "7VWZRVvoE0MC", "7xJKxbP5pL0C", "8QzD1qRZ3f0C", "8t0enPgsm44C", "97bydx8gf7cC", "9z-9ufun9G4C", "_UNNPyZHBHoC", "a2iAh-KFdIgC", "ae89cJhLYJ4C", "auZXJuwLw8QC", "aWcGepCckEMC", "AxwO8nc74hgC", "AZ5J6B1-4BoC", "B6YCffPQR-cC", "BHEWSQd1a3cC", "bKKyBRMnI3QC", "btpIkZ6X6egC", "CzEy6ernA3oC", "D96Kjfbn6RgC", "d_-I7aOYbckC", "DCILcKYEg-gC", "dKIo6D9yh3cC", "DMA63zMS7lAC", "dpxajQE4VG0C", "DVMsjPtMfqMC", "dyieVB2i5wAC", "EbquUB1D6B8C", "ekJA6MZoH40C", "eParwQ0YdrcC", "Esr4fKWU27AC", "fa8Ilo7DVW4C", "FEL8DlqjYEkC", "FJGUYgk2cvMC", "fnkCJBTdJekC", "gdqzOgL7-f0C", "Gqo5IlbVj2MC", "HQwZYSf8x-8C", "I-SAcg7Ves0C", "Ia0W1gg3aqYC", "IciSK2hKiQ4C", "iCpj07vEEIcC", "injpY-EerZgC", "JIccGs-Gzz8C", "JuDQleqK5PYC", "KcOo6u5EKR8C", "KE-2ixsSCpMC", "KosqNyzeyccC", "kx6eAjugaA0C", "LBBhikJpLjwC", "LGbZmjzCHvAC", "lGS9Lbv0PdsC", "LVuUjIq_P9oC", "M-IRbSratpYC", "m7EUB-P4noMC", "mAiJ8a_vk3QC", "Mw1ky2bqh04C", "n7eJZppCVjAC", "nI3JXcSjvwsC", "NpHmCupwB5cC", "PdCLMpSY5qkC", "PFYBPAS3LIEC", "PNjrRKR3sKoC", "pqJRCIXAFSgC", "Q5QRRluMxecC", "qE2FPaaAa6wC", "QI6aci84OfgC", "QRPXBXsU7UIC", "RAUKBvP5OfgC", "rKq8bnUK3WoC", "rPoBYx7hRB4C", "RtuUTyHr-5wC", "s8zIH7dnYCsC", "sdoeg4UWckkC", "SRFbLHcl808C", "T5UpCOVOJboC", "Tk2tDV5PIjwC", "tKf9RKS8zx0C", "tSceY_DydLoC", "tSTJQof39GEC", "TtJ0VT4AnMkC", "TVudYcZo5dMC", "u5CQpfaElJYC", "Ua-wEYZS6eoC", "ucpxOA3LDWcC", "uey347n5FmMC", "uf5x7GtHpjkC", "uUenyaHxJfMC", "UvK1Slvkz3MC", "vBz89NFgzqIC", "VDin06S0V_8C", "veGXULZK6UAC", "VKGbb1hg8JAC", "vzXz40IXEpIC", "W_5-RKxftbcC", "WcIJcNFzgqgC", "whdtOuA58e0C", "wQW4fnPUwBkC", "WrL9de30FDMC", "WVKEsWCgh3sC", "x3IcNujwHxcC", "xllOU8qyH5QC", "XngKxt-zCNkC", "YA7gLtcwMMcC", "yBDBEGBIUmgC", "Ztp-cUw0jowC", "zY6re8jbHWUC", "zzv-uEc6v3oC", "-3wmOo_IsmsC", "-Ac81W-ZQDEC", "-ChM6a5u6M8C", "-CLgHZOadckC", "-GiwEX6RMeUC", "-JQgOaES2VsC", "-rZv_sVuoXEC", "-u2YftwNR10C", "-X52qeiGteQC", "-XP7DTeuuZQC", "-zIdXgGm_mMC", "0BGLbBzVliYC", "0ebRxGSCUYwC", "0gmHw-vHr40C", "0haAje37kvMC", "0KPRrkBISAoC", "0pDWXUyrXwsC", "0SnZ26KqgEIC", "0ywyhKnti_gC", "0z1_U277JzgC", "13sniV1eNVsC", "1au3mbl9OhUC", "1c-m_QnbDvYC", "1d2n3Q5Jn8wC", "1GnFOBVjE_UC", "1mUi6nzik1wC", "1N8katBAbJoC", "1p5-4eMRdKEC", "1Q-s9CbuCQgC", "1QHr1YYD66oC", "1xlR5HF9ZhgC", "1YSxPAP8XhMC", "1Z0skArBkdkC", "1ZZn7DLTskkC", "237PaZVtDjMC", "26VWKV5V9kkC", "28-8vpddlVkC", "281ZO5O2HWQC", "2BxlZpK1_yYC", "2c5vBU1eU0EC", "2f_dIRVjUXMC", "2OacwRaPMXcC", "2OkozfAgTYQC", "2TkuqbekiL8C", "2VFCTmQPM7AC", "2WwAfFlIrTEC", "3AxDv2bsfNEC", "3BrulA0PTmQC", "3bwkR2NgVW8C", "3EYAYUOEchsC", "3meeBRX67sgC", "3riJYW4TMeAC", "3rjD8nL92AwC", "3S8r-FluryEC", "3V_6YwEqHzcC", "3XAIxbTa8k4C", "42HnEenlw_EC", "43yVaZoByecC", "492iizG4Jx4C", "4dsETTyOBxsC", "4hRwjNQclhgC", "4jv1DfsvqpEC", "4PatqekyGkIC", "4tQldK5E07UC", "4UhBvm3LbWIC", "4wr9zohow94C", "50cYOYZuPEEC", "53-gp__-Ni0C", "55PsW9Jt8DEC", "59a2_pfKi4IC", "5DCHpJrnEXwC", "5g5RBYEo5fAC", "5gAANhPh6LcC", "5GEwe5PIzK4C", "5kATSNyEMmkC", "5oRR4qzG6zIC", "5qtal-QaXwsC", "5R2Q5kKDia0C", "5rTzCFJ-UtYC", "5sZdIZ0GBJ4C", "5ws4KytmfEwC", "61MPIWD2nFQC", "67wx-rCPKzsC", "68XRZyuYbcMC", "6fNjbZVaig0C", "6gqGJ-BVDlEC", "6sq6qEBhonsC", "6stlUN-MjXIC", "6VVHgoCt9KQC", "6W1Bh5R3O7wC", "70vb78KIR1AC", "72_PrSu57SoC", "73XvU2tCUi8C", "77VSf06vQEkC", "781jTOT4n1AC", "7HhKjSs6q5cC", "7pB2Xjw6U4sC", "7qUvezISnjEC", "7VWZRVvoE0MC", "7yPXLxnf46YC", "848QRUKZkSoC", "84NTN0_Z7PwC", "84rJ77ALstEC", "8_9DRzv7CdQC", "8_hvDp3sCkMC", "8iYU-kAiBxAC", "8nRllaLoFBcC", "8seX71u_LHMC", "8Xztp3e0TfAC", "8yzQ6zRibasC", "92LGqm5F4ywC", "9i7yZUpmdiMC", "9OhpLVADPQwC", "9plU4x0dP1oC", "_3eu9hxU9NQC", "_ATB4nYqguQC", "_eJiYywsoOQC", "_hNbGkhxlysC", "_lAViWbDXYQC", "_MDWi7AOJl8C", "_SsA-3vGopQC", "_uHAsgQZKv8C", "_wIcpxMOjD4C", "A-agLi2ldB4C", "A-crywke5jEC", "a0IDhqcZsFAC", "A3D3IwNiOkUC", "A4d0W94Ae-0C", "a5Q_FCG0t0MC", "A6FQywvBORoC", "a6Q2S2JZz2AC", "A9MVPDPN1vkC", "a9yLyHtIgEIC", "aBaAQ9ZPM4UC", "AE4mW-um7tUC", "AEVQIco1rkIC", "AfPTfDbxLE8C", "AGwk6qG9rIIC", "ahFs9THomokC", "aHg46bCHoIMC", "aHNeW3rAdYUC", "ai3GHUTVfDQC", "aiLpfyPqmiYC", "aJ5zDM1KfewC", "AL_paj7-NcYC", "AMl7b-gZSKEC", "aoaYrL-ZBnMC", "aOfD2uon4wcC", "AprADuUfsNcC", "AsFLaG69M-wC", "AsY1vTm4xWQC", "AU1MAA9I58cC", "AuaFFAI3xocC", "aVTTHRlL-csC", "AvvgFOAbURQC", "AXcT1FuCIIUC", "AxwO8nc74hgC", "AzWmYqgAj8wC", "baKATJNpCikC", "BATd_O0z-r0C", "BbKlsN69PmUC", "bDDUuqRITs4C", "bdVzZ59FoO4C", "beAh43E_wcsC", "bEe6T9f7zAgC", "BEWGP8PbTpkC", "BGt-ZgFtBhkC", "BHEWSQd1a3cC", "Bik1zikOjYEC", "bKKyBRMnI3QC", "BonRzVxisykC", "Boqh8dNWxTEC", "bPCmwNZEEr4C", "bPKI_3mAi2kC", "bQ-d_JK0zmUC", "BSL6s5iAB2cC", "BSlBWtayNRcC", "BTpNxGl2tXUC", "btTgbQqk8_sC", "BTvIhQ25s50C", "bVFMCuLLklAC", "bWECSuumcDIC", "bxFZDbbyCz8C", "BYj6ql7jv28C", "c-D-b8zEJvoC", "C-xXxfEAnzQC", "c1UfjmtTYWwC", "C3OU2sMjXjoC", "c7U0S1iOPHYC", "CA5wOJ0r7aUC", "cDFbng59ksYC", "cf5RFWIMJugC", "cG-gPxwzDGwC", "CHnm8gP-n_AC", "cjjHQgjMiXQC", "cMPHWmt6lWAC", "cMX0xoOETCkC", "cO414xqtpNQC", "cObMuzlpw0MC", "cosLaMDLOF4C", "CQFNpdixOlUC", "CRicb8AOkpEC", "CrJXCFjqd1EC", "cSqzF6bJiNsC", "CUARfIi5QdIC", "cvaYmFpC1rMC", "CYQZUeo0mcMC", "D-xZXkWpWtIC", "D2y7SftShx8C", "D8jiYWiqyqEC", "d_-I7aOYbckC", "D_1u-B9MAaUC", "dazjzKOMSxsC", "DCILcKYEg-gC", "DcMOw7Q98mkC", "dE45EA-mE9cC", "de4CjVEmv28C", "Dep5Eh_SUPkC", "deTO4RY7YHYC", "DHH7CDE_ju0C", "DjOF5044Q8kC", "DjzwZGaJq64C", "dlGBjrq_5IsC", "dLo_GyEykjQC", "DnigThvaffcC", "DNl5gZ6i-94C", "dpxajQE4VG0C", "dqI6k8TIN3MC", "DRcWz8Qif6YC", "DTCsQYBQK2EC", "dTF5pdoDIVIC", "dTmVGc4SoRwC", "dTtZ4GPU6z0C", "DVMsjPtMfqMC", "dw7ECt8MMlsC", "dWQLrRj6dQkC", "Dx4Ugg8si7kC", "DXyXGjjrIFwC", "DZF4PTaXUSYC", "DZoTIeLlBxsC", "E-jshveXxl8C", "E6UrL76WfJUC", "E7HAX2d5WwsC", "e_AKhyXiMtsC", "E_gJ4mWAkYgC", "EAu33SRf6VwC", "ebfN6XqMUZcC", "EcsIyDtMXCgC", "ees5mRMzg1kC", "eg6aPq47nRkC", "EGRLRfGTpF8C", "EGyDOtkjYSUC", "EH_5jtqfq5sC", "Ejgq8771UU4C", "eLWHPScZ-qAC", "em1D_FpNlocC", "Eok8kGCq9rEC", "epDlSPRlP64C", "EpfiV_4Im6sC", "EQ6shEPH3Z8C", "erOBU9dVA3sC", "esaI75H-SpQC", "esmBu4Ojrk8C", "Ev3D_54sCvEC", "F0yMFwWjhjMC", "F2cr0G_ZWmEC", "f3gbvvW4zaIC", "F5iKoj8roJoC", "F9nerYOcPNQC", "fa8Ilo7DVW4C", "faNTuib-zAEC", "FcjGQ-BTTdIC", "FGhVMc7gN0EC", "FGnoQosLZyYC", "FId_zGvhbKUC", "fk6uvAeBbccC", "fkqAJFeoSEAC", "fL9HDd_AFN8C", "fLFwNBxxRuMC", "fLkGTjDvYjgC", "FmDzziz8-WQC", "FnnbwLpPr58C", "fO9c9IVuOXYC", "FOFAaptU4CUC", "FOsLvwmv_K4C", "FRx9Z-8oLKkC", "Fsi_veuH6B8C", "fuu9yAPkl5QC", "fVgCjnhk14AC", "FVyEZ9kFLuEC", "fxoF-vPG-TMC", "G001xz-FDhEC", "G0tcxUnNVnQC", "G5p_fx8DMvIC", "g7n-vsSJUyEC", "G8DvSzUoDKkC", "gccU6riITuIC", "Gens5o-Vit0C", "gHxW_KO-HY8C", "gLHMGpzPmCUC", "GlObs5fGEWkC", "glV24BcDr8IC", "gNc34oNpg0AC", "GOYq2EX1QuYC", "GpAzYZnAqcoC", "GQoKx7UugagC", "GRJwW2NF6ScC", "grmm7d-B_TgC", "GSeUzsNrKQoC", "GsGTLu2Zv9kC", "gszyGuchgQkC", "gtFcropCebsC", "GWfvFkdqmNYC", "GYFIDaVfMAYC", "GzEa-lL8rngC", "GzmXXKwy0KAC", "gZrmiKutsckC", "GZtwxVgblZwC", "H-Gkvb6HK9cC", "h2WTgw_Qs4kC", "H4cbM4mroF4C", "h6Bcq8aNffcC", "H6ullBCJMXEC", "H8hOjFvZHkUC", "h_crbeKZ6iAC", "h_x9e3LtUfYC", "hGqZ-wk3zOMC", "HgusS4sGYbsC", "hGZbWwdB-1QC", "Hh8KuEIR7twC", "HIaDcEkD_y8C", "Hic-eJ_9l9gC", "hKWhhhMTRaMC", "HpoOj_yRvv8C", "hq41UzIN6sUC", "hTjaPrQQsgIC", "HVdIYf5TwXsC", "hw3gf8U_Z5cC", "HX0bEWOab_cC", "hxgOv2k1KWgC", "Hy8pU6BwX3AC", "hz32iBYVyGgC", "I0AHmFs9q2sC", "i5kZUavDFxAC", "I6mW-aqF138C", "I92GsTNjFqYC", "I_9X0_Q2rXIC", "IaA8mZqhjPkC", "iaKLCIkmYmsC", "iBdjTgKVtxUC", "IciSK2hKiQ4C", "iCnHT7D0fp4C", "IeeiW4TPJmAC", "IN_KLE9YuFkC", "inlgYOatTYgC", "ioUUU5cyWD4C", "IrEEP19689oC", "iRRpp3vEKp0C", "ISKMgGkrnh8C", "iVrXqNNZwZMC", "izeowNVsC_kC", "j1S-lIVPTrkC", "j2Hqz7qyg9sC", "j4PpSFWmNQUC", "j9KkHgfBwxAC", "J9qv-A3q01wC", "Ja_OwdTm398C", "JbUKeU0Di68C", "JchdjM2KH1wC", "JejkOq1HMzkC", "JfKzrfi8A6sC", "jgC36S_BdpwC", "JgQmOA61vR0C", "JIbbzILVgrgC", "jIg8Y9-Ha54C", "JiWZf5Or3a8C", "jJfgCKnJZLoC", "JjGiGOYJLoYC", "jJpr-7aBf_QC", "JlCLVAGG3xEC", "JljBYVrqvI0C", "jo20j86ugJMC", "Jp_eAHUqG4UC", "JPpCG82zwk8C", "jptgGdakja4C", "Jqbe-AbH7aEC", "JQg-nxPFjwcC", "jqP_eDTHM5UC", "jRWEvzORYDsC", "jwRRCH7N47UC", "jy1wYy1s2cAC", "JyBhDSvIu74C", "jZKc_W6PImEC", "K2NkBhJz06kC", "k3mNH4F9ZtEC", "k4_A4hmDOBkC", "K7JBq7pp_FcC", "kahd0P1GJuoC", "kD_rDCpaugsC", "kdJw6JgwK9EC", "KE-2ixsSCpMC", "KEGWF4JtXV0C", "kEH1Js5RC_8C", "KGe9O7sGfRYC", "KiECrhfUzRwC", "kpmL51ZiAcQC", "KPP6PhKAJgMC", "Kr_FL4dBOQoC", "Ks9kynHehRkC", "KtTuVrTjjecC", "KUMr_UyL55QC", "KuziLVfZfhMC", "kWjL0vyR0UMC", "kWOsMN_IxgUC", "kX_Buy_sG-gC", "kXVVmvAqFawC", "kYZCqpL0xcIC", "l05GSu0j7r0C", "L2JiVYu7PtQC", "l8qmxf8AGhoC", "LCg3rwRZ-X8C", "LDYVl5Ym3-oC", "lgbhSUdDEvUC", "ljDfUfu0kagC", "LkwY7J2y0xQC", "LMb7ClaXJS0C", "LnkpdauAHvEC", "lNx25OPfhggC", "ls_-Lgth7TQC", "LTa33mfbNOgC", "LuJ76pYKJqgC", "LZNNhBR3ea4C", "M2x18ZHzI-4C", "M763AjCmiqUC", "m7EUB-P4noMC", "mAiJ8a_vk3QC", "MdktGa0nHXsC", "MDM7ZFecFV0C", "Me7fAyZojEIC", "meoj6qqzJ3wC", "MGJ0uN6mmY0C", "MgwE2PZu318C", "mmofUwH31moC", "mPJkTVlz084C", "muXgq4C2UtoC", "mzfNbAE9mX8C", "N-xT_PsAjNcC", "N19wqjhL7cAC", "n3G62PcJbY8C", "n83XQTUI-DoC", "NB9Bhi6mOgAC", "nBLD2FTooCgC", "nc5GNvctQpEC", "Nd7KLa6CAtMC", "nejBeS_jnCkC", "Nf6hRs94nggC", "NFinEL0eTHMC", "ng7RJW-udoQC", "nGw_z0Z5SeoC", "nic0RdWRvJIC", "nnr7H0zxeIsC", "nqJCFT30myMC", "NRyO822Rw24C", "ntyWhaSXRDQC", "nw2sKOHJDwcC", "NwsUasv4wmgC", "Nx_zJLzs3EYC", "nxnnSzT74fsC", "o0FEMFyP_58C", "o4dc_zcnl1cC", "o7TrduB4-bsC", "O9Ih8cP82ZUC", "OfF0qpEoSrsC", "OFxRs3ScMxEC", "ojxc71E0aGYC", "ok-060mlnKMC", "Ol7nuF7QRkUC", "OnmhSKwSvM0C", "OOaw8tbk9lYC", "op5CtTPCk1IC", "OpSkmWjy7jIC", "OQBwAwyLz-4C", "OQldD65qBpAC", "oWDiu7i6uAsC", "oYG7nsEmq4kC", "oZ_vOd5GFrcC", "p00q4rikH2kC", "P09SDvbxwxQC", "p5PdMtSLLf0C", "P8FS76Kyv4kC", "P8XhS2TaxzQC", "PAEuxkTd6sUC", "PAupJYHq3_QC", "pCNalA6pX68C", "pE8eDBV3C9QC", "pEh87asSVtgC", "Pf5UpP2yQ1QC", "pfDTnAQNrKMC", "PFYBPAS3LIEC", "pL4MvQHRZGEC", "Pp6ydR5FHfYC", "PR_yqTL6FngC", "ptus_WL-Af8C", "PtXj1SYg_j8C", "pve694PWVDwC", "PXe5yUh7eDQC", "PXhISl9MQL4C", "Pxx5knnbhR8C", "py2PTt6TfgUC", "pZcnl7NK3NAC", "Q1chf04zVP0C", "q7tI2koKzr8C", "Q97JavphfIgC", "Q_UzZy1Aq64C", "QA7MGuf1DygC", "QcNDxzsbMPkC", "qd-zYXT0USUC", "QDJDpSJN2W8C", "QDo8QoJfJgQC", "Qe79lVUM-_QC", "QG7AAgV2laEC", "Qh4wsMFC0MoC", "QI6aci84OfgC", "qijqtSY6M6UC", "qikD022P1usC", "qK0BIL65rXoC", "qLfipozwnmoC", "QLGfNWbHYEwC", "QrjEgKsuXlIC", "QRPXBXsU7UIC", "QS4k67pzxggC", "QSwNbjG_JZYC", "qVxi5W6X9pcC", "QyNRtayO-8YC", "QZ_54ZvNjh4C", "qzt3tdca6xkC", "R1dgM34YgtcC", "r1o7_VVkb5oC", "r2Aglw65zccC", "r6BtrMH7j-MC", "rCGEg8VvFeQC", "RDzHvqdjynMC", "rEa6zWxasXQC", "rElJhaRDMSQC", "rfP4tCddelYC", "rmabvIcEFp0C", "RoPB4vjbFCkC", "rQqOoknhLQMC", "rs9QiQn3ugEC", "rUQMaklNOBcC", "rVyfxzxH3p0C", "rWAiRrm3LkcC", "rx1LI-P8nIkC", "rxRBf9nB-IYC", "ry83-hLk2WAC", "RYC17q5J9YoC", "RYf1o1haIFoC", "S0NUaz1xGvIC", "S1A_KdKUIocC", "S6SE1AMRmswC", "s_OpBZttLfAC", "sBjTIqguys8C", "sdoeg4UWckkC", "SGdTGMniVXkC", "SH1zfdGHbwoC", "siIiEJJWk6wC", "SkEHskyHjHYC", "SKHt_C2UgW0C", "SnJrQaEVJpUC", "SOEwja9ZQ5wC", "SwREHRH64IkC", "SWZ4FCf3LiQC", "sxiK7p9dxPYC", "sZlfOhrBemwC", "T1yLPvZoW00C", "t4x7Cy4p7lwC", "T_nZurUMcV4C", "tBKTK71-XKEC", "TBTXWyg9hkEC", "TcClcWvUrIsC", "tcHqtHz-yQoC", "TdSouWWZjZ0C", "tezKte4wcdYC", "tGfmounsYWMC", "tH7isGkFXtkC", "THczQ7cOz6IC", "tIb_fIPq_FQC", "tiQ1Lhg-r_0C", "tj-CfBmVD_EC", "Tk2tDV5PIjwC", "TkiCsdBgh0gC", "TKp8H1RMQSoC", "tKsNhxsy2v8C", "tKYwAMiDewwC", "tLsIzyFR08IC", "Tnxf6ItROOUC", "To1usfEfgfoC", "tozMibuZIOkC", "tQHBF-3p9B4C", "TRMz4gjMJdoC", "Ts5iLKxcAYQC", "TS6FdaS3OIIC", "tT_D6rYb9IYC", "Tv8d8ynb_58C", "TVudYcZo5dMC", "twEszupCmA4C", "tZKHQmFAMEYC", "U-jRYXvtyq4C", "u04b9-5u_jsC", "U1zMgkoUuwgC", "U6A95jkB3CcC", "UaBgDPVml0AC", "UAHgz1nZpUIC", "UBZ95HBrXJEC", "Uc0_h6qUskAC", "UDOKkCY7DHYC", "uey347n5FmMC", "ufdL_jO4GiUC", "uG4vxj_Atv8C", "UH9Oe5o9e2EC", "uiGk4G4tVZMC", "UjgEeVZVasUC", "ULCWTAjeIP4C", "ulQHhov3sMkC", "UnAArdWaO0QC", "unZiH7sXugQC", "UpF4aMQJ98YC", "UpYbOsOhgSAC", "UtlzaeM_NAcC", "UtsUZz66E2kC", "uvu21YInc88C", "uWy3rhbJvScC", "uyBP7TKyOjgC", "V1u1f8sv3k8C", "V5pglCEa2-sC", "v5zJZoSMC1EC", "v7bN2acZLE4C", "v7ScEd7NtIsC", "v9tZu1CH53QC", "VAo33t9q5TMC", "VAoCot5ZoygC", "vCxNVGb_2OcC", "VDY-pMwWmI0C", "VFJvvg8LmEcC", "VGGVIgezt34C", "vJZZi97-CVEC", "vMU7xhXmFg4C", "vsVJP6AhBJgC", "vUpSQK_x1T4C", "vVArHEF-bwoC", "VvhMdgcJKRUC", "w0YNgj0PcswC", "W214nqbIVZcC", "W4wZTKeyjzMC", "WA75soorIIwC", "WBmEY0t4hx4C", "WDvIpH2lB0QC", "wGk7cLvVlQwC", "WhQ5FihdLK4C", "WIyxykAkusEC", "WmK0-ckzLFkC", "wOAFj0r9KJEC", "wPbMBSdncT4C", "Wpn1uzq6RT0C", "wPQQXGo4rzAC", "wrlYMilBmZMC", "WsULcn-jfvUC", "wsxnhrrtNaMC", "WTl8OKRoFHYC", "WwmkMDW1GxIC", "wycoiv9BJ0QC", "WYQPTNHS0zUC", "WzzD2RMKP8wC", "X0LWTVvOCdoC", "X1rg0yNmMMsC", "x4f0Rx_b-D4C", "x9-H-6LPYGMC", "X_fR-2n40oEC", "x_k8Aptn6tEC", "x_uy8HAkkxMC", "Xc28Zq9EKcoC", "xcWfPlAlFUkC", "xFVpLV_Mqc0C", "xI6Y8BZJumMC", "xmYBTQcF1TsC", "XnQMxHHhmy0C", "xo87MIuUcT0C", "xRmf6D64ADIC", "XSGsyt-f-GAC", "xtS1kIGT-KwC", "XUVAHkwxfpsC", "xXuYjNkxiWsC", "xY7ZCJX1MHsC", "Y0YND98qCT8C", "Y20wwovSqr4C", "y2K_ufwme2YC", "Y4-i2vOL-hkC", "y452FlGWGdIC", "y5plTzPTw8YC", "yaWuHE_PrJ4C", "yCWLfqveCZYC", "yDxxc4XNCDIC", "yKPqty4knx8C", "YLwF_d7Rzh8C", "ymhwUl8eEVMC", "YmUjOuOnMdsC", "YnpccgRJV9EC", "yoJFJAB_F6QC", "yoPXlbQQh88C", "yRXlqW-8XEUC", "YussB5D5yO0C", "yuURbFPqG1AC", "YwXckRmVguUC", "YXkm2ydUHJwC", "Yyw6_PWorwkC", "Z0GoPisj9BMC", "Z1MLmkX_NfEC", "Z1v2pqaOmuEC", "z2v9b_mUnncC", "z9izbk-II6MC", "Z9y5-M3gX6gC", "z_nqWKD4zCcC", "zeNHpa-LirAC", "zFnso9Pjcw0C", "ZiXnaD9kb3YC", "ZKXGAEzc4-AC", "zLJcQEPrJKwC", "ZM2NTPsde2oC", "zMOM4uUPb3kC", "ZpapRhTk2aMC", "zPW5Az1MtzkC", "zQeugdxXXokC", "Zs_jqHzP4mIC", "ZsPZlcZt-LUC", "ZtLb4cCZZq4C", "Ztp-cUw0jowC", "zuM1wHVdxskC", "ZxasNALEUjMC", "zY6re8jbHWUC", "zz5otC8t4cgC", "zzv-uEc6v3oC", "1BHndeKTdDQC", "1cXYGgN_gTQC", "1UMxj3O_JbEC", "2z22FTDqiwwC", "3ia-XWJVD7oC", "47QEw79wBfQC", "5FE9hLvsv1kC", "5yF2gn9ksCUC", "6EkBTg_85fUC", "7hDY74g6pc8C", "9Jf46a7wqqoC", "_J8ymvTQz8kC", "_VfAeaKff1MC", "a72fLJcsH0wC", "AlknZbhbUPAC", "auZXJuwLw8QC", "aXiTtDi_PTMC", "Bx8fU-e2FqQC", "DBMoE3YCx0QC", "dF3FBNFsyvMC", "DPfYhaIgsEAC", "Ecl4xUM5SwMC", "ehmsqp0m4OAC", "eio5-Npast8C", "ESO9jfBkdsIC", "faAjVTbjQKIC", "FLfw-N8MCf8C", "FOcu05SkdGUC", "FpZ92p1JmhsC", "FPzap8_I4SgC", "fRx3pCIX8mYC", "GmMHj1qoG8gC", "H6ot0KqrqtYC", "h9jmli9voT4C", "HXOHZHjIKmUC", "HY3CC_nLoXIC", "Igu9K9zMEdMC", "JdTMZTHuLCoC", "jPLaqKhumPQC", "jYvfQEAc-8kC", "k64rkWSuGfAC", "K8qzZ7NWsvgC", "KAvITyK0lpsC", "kcmDfBs_cbQC", "Lel5W0G1n3EC", "lykWOYUgb0gC", "MUw_dAtcRjEC", "N6OCJhkuULUC", "NA8H9zqSKeoC", "nb8fUMuQRzEC", "NIo3RQmYLqQC", "PREUJETIcjAC", "rN-hxaSVANcC", "rsUwp-NGH4UC", "S6vx8j7-0KwC", "SEwbSC99jKgC", "SJ8ITTbJFBsC", "tNsZ8xge-0wC", "U7RCAkcuQTUC", "UggCNKyB2vIC", "UZSkjJ-20GwC", "VsMfKkwxSgcC", "W-_DNF0vm-IC", "wK4qdX-0UIAC", "xTqQrFWNoW8C", "Yl554V37zDwC", "ytjVJ9wANosC", "ywFYNFkgU9cC", "ZnF7UEcxuIQC", "ZO1IGCLCvWYC", "-1wfzbInfNIC", "0UnbTUjYzsMC", "2J-M4SBQFbcC", "3EO3zIqao8MC", "3JmF7JAtIX8C", "3nOSSNv3xlgC", "4vlcQZU6mwQC", "52nYgUsVn9QC", "5Pp8OEhIJ8EC", "6fcdrgoqgjkC", "6Y3LUwwAVQUC", "7Ga0TEYaScIC", "7P87HIh9ajMC", "7VWZRVvoE0MC", "beHXwswSD9AC", "bIih2n8DAXIC", "bmFSp3b8J_oC", "BSn7ms3kdsoC", "bX0XtVhbnOkC", "BZDgJjfi59gC", "cwEDQB2DFI8C", "Emwp17M6vE8C", "ETGVeEFFuMAC", "Fuyh3lrYV2YC", "G8N3X2u6oNcC", "g_1wN2RzTlcC", "gDgXbx8hEjAC", "GfpVKx-8lDsC", "GITDL2ZCedkC", "GPCfFs1LTIMC", "hKzjNMFba5gC", "hLhw14J-swcC", "hRrLcmOMaEwC", "j2_I7ao7B7gC", "J91S8m-5HhoC", "JIr_egKfnDUC", "JYI23XTj_XkC", "k0D1eAO035MC", "k0vwC7309EoC", "KPxNDJNQ3-8C", "LIDYmd2ibVQC", "LjHYjEZy9zMC", "lmwsbWLw6EAC", "MNcB4QaX7gMC", "nq5uwdWwEJEC", "nQYybfJwXrcC", "oQ8mv52KmBIC", "oSXEwOdkpmAC", "PDpBpo5CVB4C", "Pv1uod9kd4MC", "pWDVOTYvfvgC", "q2eNLtaZ7osC", "qg61T_I1mwsC", "qUn_UMWtrsoC", "Rg3XP_rQS6oC", "RW6pxRN2JysC", "S5v4BpqrWNYC", "s9QEjj3Lx30C", "sZ0GSJbIMo0C", "T2Mp9EEd3ncC", "TGcxvQRT5swC", "tI9POJ_lt0cC", "UfTmmBmUhbcC", "V8uoRGamur0C", "v9mR1wFHtq8C", "vaEH7rkN7vsC", "vIziFZ3K7dcC", "vKOCatOFvTgC", "wHihWKJE3asC", "WjUBulsr2O0C", "WuTHl4pK0GcC", "Xg-KfK7aFgcC", "xNdZnPXsKN4C", "XRcbURgaxmMC", "Y6-AxGipk34C", "ZC0V9erPk2IC", "Zp_b7CdQnzwC", "0i7tc2P7fAsC", "0syw4IwVuC8C", "14-8TtEVjSQC", "1KEKV2BysrUC", "1nU7NLCQGQgC", "1Rx6_jyLbBYC", "1ygSThNA1-MC", "2613mp_QbBgC", "2arSMI2yjlcC", "2by0nndSiDgC", "2nxLkMspauIC", "2toggaqJMzEC", "3oYJz7vV8fQC", "3w83rbjVWZgC", "4Eqexh3saqEC", "4L7Tl2y4PowC", "5Bli9QkKskYC", "5IVMhC9jGIIC", "6D_4FLb1DKAC", "85CBUYQqKUQC", "96_4UJrUGBYC", "9I62BcuPxfYC", "9m9tNj2w2bcC", "9Oo7uTUvAS0C", "_f9cU9A5l-0C", "_ivnD4_EHEUC", "Ax6PzlpRgNkC", "AXjRvYddXJoC", "B8zM5bs2A9gC", "bV0Pivbww6oC", "bWo8Ge1WRiwC", "cCCZD5BdAdMC", "cOxMYVG0nWwC", "cP5pxV6ogdoC", "cyD059eY2RYC", "dcKqHyguyUMC", "E1Tg9q6qgFUC", "EAQfpPEkcbMC", "ED8DRD0xzrcC", "EjtrYjnAVwEC", "eyALF5NigoYC", "eyik0rO0HlsC", "EZ8s1tWqvCMC", "eZmH26oClAwC", "fE0xNuSuFLMC", "fEmaqHANzXsC", "fPh-6h0ZjIUC", "GhU4NHMJW3cC", "gSggUrFCgNsC", "hEFNvjChUOYC", "HQwZmUU67L8C", "i6aXJLeZ2OMC", "I_K8gplq24gC", "IntaNqjL4kIC", "J4cKi6r33EQC", "JAxLVY96sqsC", "Jd5XqoxHYUEC", "Jf99l5uQqlMC", "JikT2vM5YZ0C", "JirvAdAxTnIC", "K9Zh0c6Mo44C", "kIzeIBFaDOYC", "L-MW4-8wrg8C", "lbyFW9eCUJ4C", "lHtTdnbIaw8C", "LxcuDGzPmIgC", "MJb1Utv2XEEC", "mvlLcUNu-acC", "mWFAqKADH_YC", "N9llTehCpy4C", "NsF40Xh9KHoC", "o0qO7gsBek0C", "O1BI0t0qA4MC", "oS_xi6YNcnoC", "pj-vSQv9710C", "pMjiOn7JZhIC", "pnv4COWJsikC", "puo_3AXu3HoC", "PwWh1G1ktNsC", "Pyj_G5sd3mUC", "Q7CkHF7xTuYC", "qAfYUYXsc3UC", "QeoUwz4LP2kC", "qINa6ZzeYU4C", "Qm-fSCAMrIwC", "RCz5jGH0mHEC", "rE85howYIwQC", "ryIHc_dFg9QC", "S4t9VQZgeeAC", "S7f9F47uOy4C", "s8d0F4pCFLYC", "Sd7UCI45e48C", "SsplQPga2i8C", "swicGGDT4eQC", "U_Jos-CxgBgC", "UeyX6Z15Dk0C", "uJcL_Uud0OkC", "UXdK4epTU14C", "uzx3iXNsXaEC", "vIIZ_OJBw6sC", "VMVnv48Q-WoC", "VU4TKJsUuNMC", "VugfRqniLuAC", "vw5TIVBcNsIC", "WevM7aDxwqQC", "Wk8OyjcUaNYC", "wYBhLD7xFzwC", "Y-gAhChIGPUC", "y8RsnLXx7V0C", "yeCZUpu-ZD8C", "ykz7uzPEMjEC", "yZnV_OeyVjEC", "-fYxFc8RUo4C", "-POJuDejO_8C", "0-eLkwgkzcEC", "0i1dO3r97wwC", "0M6qezYNW60C", "0Y89CoIRTI8C", "1BL8s7N-pS0C", "1UMxj3O_JbEC", "2CVmvMoBRK4C", "2n-MFn3NIdoC", "2VqEXOH-b2YC", "3eJx3RwFmKAC", "3pu3QWtuQyEC", "4a6oMgT8UsEC", "5XdIgMWhmcoC", "5yoV6-brDSUC", "63iee2qa0aEC", "658MNNM3VWYC", "6AXV76B7GTIC", "7gVDKA2OCBsC", "7mHlJDgr6pUC", "8QzD1qRZ3f0C", "97k3jPprXGUC", "9NTWxB-g2bMC", "9QCpUYKTwKwC", "_nASlQHDNksC", "aKa2XdHTOwoC", "ALOagfpXwsYC", "andJBXf1IJ4C", "aVFlEvtChHEC", "awBtfaGPr38C", "bEdfDabRIs4C", "bLOKdFhvUZcC", "BnqbHc7qE0UC", "bOS9wTxSjsMC", "C1bpMhPibbEC", "CmT3DjMEHY8C", "CNM3UfS5ZA8C", "csItFZBtVdoC", "dBhppfQYfzwC", "DFzy1wgWL6IC", "Dz67I2EuT-MC", "E8tYohlb1NAC", "eKOLNeeZQFMC", "f-lv0GeeF8EC", "F521rduZP-0C", "F_5gaom1OrIC", "fG49kbqrsgoC", "G36liS2WBmYC", "GIrGb5c50MoC", "Gpbzcr6EIG0C", "gpeD8N4Bgv0C", "gXC6tBuB3ukC", "gXIpZThzkgMC", "hKvbOiuRHK4C", "HO2tcJSd1ucC", "hUa1L6-oSFIC", "I20ZTvApcBoC", "iH8kTRPq8V4C", "IiHCtRXb58sC", "iLZ7FK0Z0BYC", "iTqij7sfRv0C", "IVk9f7XuhJMC", "IY8OBT0ALeEC", "Ja79cHnK5vkC", "jBHTwGoIKFYC", "JD8B3w-wAXAC", "JDDCX3NZg0IC", "jdoXBuPkP3IC", "jILZHKGefnAC", "jZm-7l9bVNMC", "k_PJN_n9HXsC", "kdc72ePipCIC", "KLoW8UJ7yV4C", "KSqaVLJ6gAAC", "KZhGMqTcdWkC", "lAJO7vQNrqQC", "lCGyHH-9ThMC", "lez8urgN7IsC", "lmyJpFpDO0cC", "LNyJXYzsm3IC", "luT5wRZFGt0C", "m0uNZ8L7v_wC", "mnVyKrjJnq8C", "Mt-0W2y5Ge0C", "MUgZz6fsfiEC", "MzU5LWah5yMC", "NfPZrhJB96QC", "nqD7og5KJIAC", "NUtoEunmt0IC", "nV_YYqbxgdIC", "o8kXe969g0sC", "ONHIQLf4DV4C", "ox7aNVgljlMC", "OyM3-IXdmJwC", "P3CplYtSSFEC", "PczyUV_YL2MC", "pdpeP0ZbWHsC", "pWewuk6a2BMC", "Qnuo81K0IcYC", "qp2VYFn1sOUC", "R5GOrCL-hNsC", "RPQaACqkjGwC", "rsGdiauRyxMC", "RZe6cV13zE0C", "S7xmKja99FIC", "S8i7H-hTXLAC", "SGI43GWP-IYC", "SI53QAu4dF8C", "SLkt73Lrbp4C", "ssViT_3Q3FQC", "T5UpCOVOJboC", "TTtjs91IuI4C", "TujOn209Ts8C", "tVgbhu4SOtQC", "u1HkFE75cAYC", "u2uHVUp6ekgC", "ueZOmEZ50NMC", "Ug1Syk-SggkC", "uppJmSyZNLgC", "UsLsYpi_y9oC", "V0iKXreetjoC", "V5qOnsDqd8UC", "vHpAxbBtYwgC", "Vimx2y5WKpMC", "vjwfFOOm4ysC", "VttdxFt4kT4C", "vZvy4vn11wwC", "w-vZfK66wxgC", "w6z2R-4hm7QC", "W_5-RKxftbcC", "wOIKIqrmK4gC", "X2-ZG3vkJBMC", "Xqa9U42GP2cC", "xTzN4tAcbWUC", "Ycz40OX8JC4C", "yq1xDpicghkC", "ZERszJzP_w4C", "ZhUKY-yEAzUC", "0pLN4o3jnX4C", "1s0fNs75eU0C", "3QhvCFBjXt8C", "3QPCicPagmkC", "7I9hbvFbSwwC", "8Wv67qmi7JgC", "_1CxStiRr08C", "AUbEMUpDHjMC", "B1woUWB0zoEC", "bqsnJ9Kwf8cC", "cu1La-UW1uUC", "Dgh-sFywyAcC", "dkS7CMsi0CYC", "gVEr98NLoJIC", "hfpZ7mDgL4YC", "HPYLoLgJVKwC", "m8JVt054DKwC", "OIW90It28wwC", "Qn6XPK6_9PwC", "rRYjYKrShPwC", "RZ_J2zSCsBMC", "tjoUmDYGZ_kC", "wBsz9EFmYVYC", "WDBALbSAEY0C", "XlxEL2OAq1MC", "Y9gysXtdfNYC", "-ejuRdu1o0sC", "-L6Mta5ndNAC", "-P3klEJmyYoC", "-vEse95VywMC", "-VqbhDPE6RwC", "0-KFVYyJVQAC", "02Xig2qmvr8C", "09logyEmlP8C", "0BviGSKbcTEC", "0Hq3fQM_ql0C", "0mGCIWM1pOoC", "0yF95v_cIi0C", "1CZjrwiEqWQC", "1nN5hXqGUpQC", "1Tny60vKmUUC", "2-FMeNpDPLUC", "2Ub5TJ2P8_QC", "333tT0uUJUkC", "3h9hkTsLvBsC", "3uni7ltr-EgC", "3Y3Koy1GyxwC", "4CLIORno1rAC", "4hg0KpqgjcYC", "4YR9KKoIGEwC", "50cUnQ3tcKgC", "50wLU-gKr-QC", "5gdqw3ax1KsC", "5ohxQyl4-O8C", "5SXv0BUeKh0C", "5VMcW1f4fmMC", "63VsrJx-DcwC", "6AWJpoorWoQC", "6MtRNh_cgSMC", "6zDH9GBpFmEC", "6ZOuUCxDuNQC", "74JpqIiLifEC", "79qeY1rwa9MC", "7ER4mPFI9osC", "7TEhDf57HygC", "7Xf-oGYr5V8C", "7YtL5kM_olQC", "8fjvEUIapQIC", "8Fy9NHweW9QC", "8gelKH734-oC", "8OEbjHKSKkcC", "8srzbBuD8ooC", "8TCybCs-AHAC", "9L8MwyFsFvsC", "9P7h5rB2vQ0C", "9Yy_tYUfn0AC", "_jueZ7Tz8ywC", "_U9YvW-NfvIC", "A-nGXqb5JSYC", "a3MgYVp3MNgC", "a3wg36vBXkYC", "AhajUs_0K-EC", "AikWxorjwGQC", "AlGuOeb7pl0C", "aLrU_YzhaBoC", "AM1Q4ECeQDcC", "aWGs4TGKDcgC", "AY1iHnq-xcQC", "BBKEcM6M_BUC", "bBYG-E9nRykC", "bCosFPTNyRwC", "bL0V6oCroGYC", "BOIK4w9zM_gC", "Bp35IAKbcd8C", "bX1nS36naX4C", "CaBAy2oYiNwC", "cbJAOnu-iEAC", "ClNeCvWR5P0C", "CN5So0yMZp4C", "CrJXCFjqd1EC", "cZ_F_J1308wC", "D1g9NcEBcEYC", "D8UzeKZKKvgC", "dCq_E2MSODcC", "DEussc1kYYYC", "Dk283ZDn2CgC", "DMQjVRUdl0kC", "dMwhA-NhOF4C", "DrGsqbdcIRwC", "DsDJpRznYFAC", "DSiWIXzQQRIC", "Dt67NJYFYL4C", "DXl5d3PpY04C", "edFHvonqKX0C", "evF6kdfndvYC", "eZYrYzQW3nQC", "F1Lhjw9V1WwC", "f2D-5VU4K_0C", "FjmABe9tZFkC", "FonNsPo-E60C", "FQK28Kn_l_gC", "fu-kpQVvUNkC", "fVGEkW_gHYkC", "fyvF_1MmEMkC", "FZ38Nhdr94gC", "g-xFICaT2KgC", "G1NBCKQUbLQC", "G4UH8cPE_VkC", "gDdUJG9ZAsMC", "gsMmMAyYC-gC", "GUCo0saVa8gC", "gV4SCyVYuYQC", "Hbvw2UCKoZ4C", "hEUQWxM0nHsC", "HgMEuYosYCoC", "HLzw4WZuZRAC", "hUIhZALOqtgC", "hV6KwLHHzOwC", "I4jlSqTv0bEC", "i78nrgJzFSMC", "I7eMlFZ-drcC", "I_EZKwscuG8C", "Ifj8JhEt9ggC", "IWvJms37_owC", "iXS0g4iuYzEC", "J2lPGw1Rtw4C", "jaHqDitMkcwC", "JBmmx4WE6k8C", "JigkhryKpx4C", "jtWpJQCieJgC", "K5VWQGFBxcQC", "KgSgVDI8c2UC", "KIo9mt-eOFgC", "kqbwwzLe9_MC", "kSk9JR9LgSwC", "kx6eAjugaA0C", "L4GeYVeSpAAC", "l4lfK_WL3gEC", "LEHGfCUDYfAC", "liXVkOxFDqsC", "lKKf4Yj0W4MC", "loo0_eXLXggC", "LurjwBaxF8MC", "Lw86RxlWQnYC", "lXrnTDSacVMC", "LyOdxBQrBwIC", "lZtKCE5Ui2UC", "m1Or0ficxlsC", "mUYVmd01fuoC", "mxt0Ro-l-gAC", "mzfNbAE9mX8C", "NfGHZllfQK4C", "nFVzIP622gEC", "nJv2mifE1o4C", "nlJT7puXjx4C", "nm-BUiZMc3EC", "nQ68hmToee0C", "nVMR4Gh_Y1sC", "NyTudGXQewIC", "oB4OC53QYYkC", "Odv4ILalBKcC", "OFcR4TvqVoYC", "om6ka6hzytYC", "p-NUf2ojrQYC", "p3YW4rJ5ob8C", "pAxZbNwBNzUC", "PE53nJcigosC", "pNXdJ7cvvngC", "PRi6bl07_b0C", "Pw-rcBpV-80C", "Q3Rfm2JBti0C", "Q8lg56HLGp0C", "QdiTkdgSoaYC", "QhWVUH9tNw4C", "QlLMwIkHVu8C", "Qob065xfJc4C", "qqkjpQLEWPQC", "qRn_S83y_7cC", "QtTNYdNpJRkC", "QUBFst0zmBUC", "qUgPnJLN4lEC", "Qyhd5sjMWnMC", "ROHwG0JvP-sC", "RS6m_DbSJXIC", "Ru0t7ESGsDAC", "rxlhF88yrg0C", "s0CyUSH9iPgC", "SaaCMIz8PvUC", "sAtrYgbkH5gC", "scftQIAXQHQC", "SEQr7Y2ESicC", "SIGIlqKAaW8C", "SIGkFwAmFKwC", "sNCoxfSclV4C", "SoxnKRQyj10C", "suQbrg7MhFAC", "SWZ4FCf3LiQC", "Sysopkjdno8C", "T31kevVNqUMC", "t5NEp5iKhkYC", "T6U5eQyWuSsC", "T97vHe-Q8OMC", "TE0WobkrkQYC", "trfXmiUm5PgC", "tu16MecA8cEC", "tuSGXALbaLIC", "Tv77pfIsaVYC", "ubodMGnHnx0C", "udGI7FjregcC", "UDuEFOTuCFIC", "ufNTEMTqAhYC", "uIBm2EZDcQMC", "UjOac1Td7CYC", "UkO0zAqUSVEC", "UlhGedGC668C", "uLXTjolpB_EC", "URoDbjKxx3oC", "URtZ3OXHZQsC", "US5aoykpdoAC", "USgMx6uKq7cC", "uU7Lam3hcRwC", "UUODSqSSrZcC", "UvgGzh-6t8cC", "vnEhQB8-uoEC", "VuaA_9dvD_EC", "VzamFijBMFwC", "w7e869WABvwC", "WI0nPy7U0XIC", "wIEr8jXYBt8C", "Wih7vhglJFsC", "wk1caZUaMOUC", "WNBFbIUssgAC", "wou23_QQyHgC", "wXjHgnoHQ0MC", "X3rvKJrmYVwC", "x9YvEamhGw4C", "XaKz2uqbMzUC", "xd3X5x_-MOoC", "xJ1j7mkgvlwC", "xKOiyh5KvFAC", "Xkw1nCTwsWsC", "XLFMJx8ekPkC", "XmEN-qK0bsMC", "XvMdKogKFqcC", "XzVLIY5L2swC", "y-YtcOzwf6MC", "y11kvNfIDh4C", "Y3yDkC9IIukC", "Y5yyFc5E2m8C", "yA4cn92ySgEC", "yDymY0juFzAC", "YmWw98yeh0oC", "YqtYxm9n5-IC", "Yw64dgRvc7EC", "z080t9ESro8C", "Z2HZ7kIVskUC", "Z5VRwewA4rkC", "z6iODYzWf54C", "ZHwey8h5Kj4C", "zMxUsres-coC", "zwKv3PF_Ff8C", "ZX4JoRmrwyMC", "-Ac81W-ZQDEC", "4RAq9z5RgxYC", "5rF_31RVTnMC", "7o6pq4VR26YC", "8HDEs3wNLd8C", "9m9tNj2w2bcC", "cis5uCsRYeMC", "Dep5Eh_SUPkC", "IaA8mZqhjPkC", "IJ-GgyfvKL8C", "JAxLVY96sqsC", "JckCvpOQDOoC", "jgC36S_BdpwC", "LBBhikJpLjwC", "lGS9Lbv0PdsC", "MJgN0BWagZcC", "O1H7BVBsK9oC", "o4dc_zcnl1cC", "PJP9W9X2NGQC", "pskTkT2TDeYC", "RoO9jkV-yzIC", "SQhknRXlyvkC", "T0u3mLgB7Q8C", "uHq_8awQIbgC", "WCEhW6yWDNAC", "WMVCPeDrXs8C", "Y5vLDglww74C", "yFgt50M0WPcC", "zfONjvb9FpIC", "-6tK6UnVlEcC", "-NwZA2WUfngC", "-TNhhlGcCzwC", "0nV-mIqPa5gC", "1ZkYEFi3DMMC", "2m5bzSFYhXsC", "33krmNTydTIC", "4Y0ZBW19n_YC", "58ozhlerewMC", "6DBnS2g-KrQC", "6N6t5MXXaIsC", "6ujGHAm6UmgC", "9-8jnjgYrgYC", "9IQFh2qW9b0C", "AAiV6mJp4hUC", "aC8Baky2qTcC", "bFURkBeZqPYC", "bSphUJjJe-MC", "bxZ47UHnWGsC", "c008kdNwR1cC", "cypYpNnWjXMC", "dj7I5K33aL4C", "DNd2K6mxLpIC", "gIHSN-ht0xQC", "GxKN1LiEYyEC", "gZVaXvKwxHIC", "hhnIWGD5Zt0C", "IWvreEoFhPMC", "KMdvIKsOJwIC", "KuaZgBcnmAMC", "llUvnqcEKTcC", "mJTJO3vZkSoC", "mUTV9dgfMuMC", "Qw7qj5nXSPUC", "rKmH2DNXricC", "s2ZtdAx83yMC", "s4WCjkloJCAC", "tGBUvLpgmUMC", "uuX_cmZ4mjoC", "voB6UejOtncC", "VoPogETDqa4C", "XSIssqPhDbEC", "Ybu81FJA3jgC", "zzUeWIFDCaEC", "-76GjNpR9VUC", "0uoqWWIauscC", "2hLRAkzKHjIC", "_zhwTYftf-sC", "eDt6lmVX_k0C", "fiBhVEiOFw0C", "fXX-Z75KAhoC", "gbIG-epQgyYC", "gDcH3tczR60C", "I6BQ9yxgSaoC", "Ku8NG5OgmlEC", "lSybHLQbZ_kC", "Mmvao4xhMiYC", "O1H7BVBsK9oC", "Os-9cxoj5AcC", "t9tHrAygQWIC", "uf5x7GtHpjkC", "wmgF8XJf4l4C", "xHWgnMsz8UIC", "YoryriygeZgC", "YZ5aQdRwaX4C", "Z9Djirq3VyYC", "zezJOW8XFc0C", "zMWMzPG3j38C", "zPNgwV6VPywC", "-Ufj7x82aZQC", "0H2ujnLIb4YC", "0VQVWO-XzX4C", "198V5wsaoW8C", "1eVAVRRUnkAC", "2qYKIG4lhHYC", "2vnbMzYXBQsC", "2vtmwCOgzI0C", "3_fzWPCMmvYC", "4F85nqXb6w0C", "4KiPFF1pfPAC", "5IaLGlxtqsAC", "5zd7ZiWzIKEC", "61W3aGvTVgIC", "6kBREfqwuHEC", "a-apCPdumpsC", "A8KuchLCcYkC", "anFmX2d0KxoC", "aVWi86L3w3EC", "bIoc-41VKYEC", "BJcgLVibkrEC", "ccWmlymJEq0C", "ClHUjere8vgC", "cNB8Qm4_2J4C", "DDQ6Vw9J5DwC", "DIxJQdDgS0QC", "dLbwPpBYDl8C", "DQ-wif7eBJoC", "dULNnyLkyEoC", "e4Tb_6mxqY8C", "E7h_E7K_fwsC", "FKkPEODeDT0C", "FUha9wJrSXMC", "fVgPWLQWA4sC", "fVLMYb4OH3YC", "G_ChtsfxkRsC", "GwI3Sj_pwsUC", "h0oAFNvncUUC", "hiA_PNMp6lYC", "hKNc-9vorskC", "hKV_j23sEKcC", "i6kVrD7R_n8C", "IHtQFK_sBqcC", "iqKULT8jgRkC", "IwywDY4P6gsC", "J6sln7m6S6UC", "jdwZB4TQN8gC", "JJ8ubAShaQYC", "jUX8N9kiCiQC", "K1-LL9vlxZcC", "ldH2BM3vs_EC", "liuJiSc9n6oC", "LxcWEfaffaoC", "lyrm5fJSrSkC", "M1AUC4TY4u0C", "mnoT8c0Vx_8C", "mtQuudHqmqcC", "MwQnyFkCIL8C", "nHAot4SFzlUC", "niDNtZoYsAUC", "NoKhJMLbgD8C", "NRWlitmahXkC", "oa7NCF8auswC", "Oa8W1lM7dp0C", "Oh6wLFldgIwC", "Ojqi8KbWuLwC", "paCOTGa0wS4C", "PpEz47zsLEwC", "ppLI3zTIhQ4C", "Ps6bjZJvsHoC", "q09de7IECAkC", "QTsy3cwmtgkC", "R7yZULA2tBMC", "RfXAhxwv3d8C", "RMd3GpIFxcUC", "RZavt1b_0BAC", "S0f1dqjiGXwC", "stUAkZC2Fm0C", "T4Elzas1b3QC", "tWhTr1WekFYC", "tysWnxuQhYkC", "u7aQrw6Uo4oC", "UcPsbca_C5EC", "UohaMn1AmigC", "vkHCx--93jIC", "VX4reY-uK3oC", "WU-OyPMpDVgC", "XBkchXgQ-d8C", "xoZ-WjpIc6UC", "XVwOEeHTU4QC", "YIdZ4-jKaGIC", "YIY4089h9icC", "yPBQ0x8ilx8C", "Yt5DTUj4LXgC", "ZE0pJLh53e4C", "zuzKDZmT14oC", "ZYLmkgIqCLkC", "-52RHqbsaWwC", "-_Si5OP6cjkC", "02XEWTji9E0C", "0Mei4WzHik0C", "0w2UpJzBamoC", "1bNXWy9W9IAC", "1E8PhEA5Az8C", "1lGuK9xyvokC", "1rOerr2Ci-0C", "1sInFMCUm2YC", "1T39-GfAWrUC", "1u_tY_pssu4C", "23PS8aGYYhsC", "2E3MiOWRNtQC", "2jNwYjcIK6IC", "2TTqv_HACK8C", "2X_sivIIyQ8C", "3XAM96b312YC", "4gS_0UwVI34C", "4Hpzwl0VoyUC", "4kLJkLerSaAC", "4UXyNz_R__wC", "5DGXp5h2oL4C", "5oSqucVGhwIC", "60KnbxhqPL8C", "6oILDOdkvxYC", "802VgkC4UEUC", "8dKozfsRRH4C", "8HYQQYEtQ4gC", "8ICiTVcgwuAC", "8JspW2EUnLQC", "8NCXcrGcjiwC", "8Ri5V2SwMkQC", "995krFsdee8C", "9i-bgOjaVysC", "9lZHwn9YINEC", "_MAXmVxrdasC", "_O1UFZ89S6UC", "_PIKFebe0ZUC", "_Pk7ht_KTAQC", "_tZO-x__5b4C", "_yFAecBTPwEC", "a2cWgOGKF9MC", "AKakX0dT3f4C", "aOGdsB7a-MMC", "ArPhc8pH_ugC", "avp_J4eMt4oC", "aw0bmkidutgC", "b2ov6zAspKsC", "baMsUZCRgqIC", "BhIMO0CiTwoC", "bVbUWcZJTjYC", "C53Y8utmakQC", "C_g4YJ0rTsMC", "chGjPf3_RCEC", "CL3ql_ziOxQC", "DEgiTalvVXwC", "DnVCYtiKos8C", "drAw7ArFYTIC", "dTFo7wU_510C", "dtHmdv32NakC", "dZdWebZTGKkC", "e13q14sVPiUC", "E5zQIJb1hRAC", "e7Eznt0V6QEC", "EhmN7RRA_ugC", "ek8nf53EXugC", "EnedFN3PnZwC", "EQVcqI4HM6gC", "erkTSFYCnakC", "eTi6u-MS12kC", "EVitU7S2FPwC", "EYjb5ZmougQC", "F16NoYvQA4IC", "F20_TnLlcR8C", "f65agJNAWVcC", "F9mNmjsAzQMC", "F_vwlakdLxUC", "FaA-TWtbLwQC", "FIqEEO1Kc1EC", "fkRwjQz0O7cC", "ga7KFEaiaMcC", "gGV7hWLTDUgC", "Gk6un4og4_0C", "GMKHspxES6UC", "GU1cifth7UAC", "GyCscVPFIBsC", "GZ4xx0P9di4C", "Hc2dCHfyh0AC", "HdwuLjpjVn8C", "HE9bl6gPs-8C", "hEeJMViuF_EC", "hGD_1iPQh6gC", "HGoajRhgyM4C", "hlEaPi-VRXAC", "hORPJ3l5cSMC", "HZyRMSddyh0C", "I_K8gplq24gC", "iCTMVq5iuAUC", "ijLOO6zrl-sC", "Iq8odoc_AHMC", "iyOjvMGmXo8C", "JAoLsCTW5noC", "JAtHsOzOCoUC", "Jm_TNTVOWG0C", "JQ761pPLQ_oC", "JrfffY38O9MC", "K7zz1seo1GUC", "kIfE_AnrEwAC", "KIu5wqdIb3QC", "Kkf7gowrH_UC", "KQLWPZx8fc4C", "krIH8Sax2nQC", "KwzZwJWBO_EC", "kXSKAfy5cQYC", "l-9PAnwdMHwC", "lBwBNq7OeNYC", "Lel5W0G1n3EC", "lez8urgN7IsC", "lkMyHNy64qkC", "lkoOngAgeK8C", "lzds1LbpY5wC", "lzHauSS_z6wC", "M-Yk76ZkPlIC", "M7F4yExH0ygC", "MaI5EZmsgtQC", "mfbaDBgpteAC", "mj-of_PzKJIC", "mQLDLn0GQfwC", "mqPTDRT2v3UC", "MU-_U6mkTvgC", "MuvqrIW-WUMC", "n2h7p0H5l0wC", "NfBbt3TE9xcC", "nGZ9CyVWkmQC", "nh18wf88pe0C", "nQd8MHuaXysC", "nrQxBfJLvtgC", "Nu-nE7Iif8cC", "o9_TF2NHuFUC", "oaMkKvgT3sYC", "OEXDt0Os5aQC", "oIYNBodW-ZEC", "OknSmoptV8MC", "OkOrJIysavMC", "oLCSBeuStRcC", "oLFVBoeI1gMC", "Or9G72yAd9QC", "P2XgbUHcJiwC", "PDgGBdrq13AC", "PHPdMoXyFfMC", "pJ2DUnZMffYC", "Pn-X4YCCAVYC", "POD-D1f3OUoC", "ppmteilOxqAC", "py7QAfg-elkC", "qLmG7deqB2QC", "QUBQF0zn7hYC", "r-Wlg6VAzJUC", "R82YRMlkujYC", "RFr9q4q0VLsC", "RIPdMkiKipMC", "rLtFv6s_XzMC", "rLv8OfsqR3YC", "RQtjqXmdFOsC", "RrC8pZtmzGoC", "rRUw7deQSo4C", "rUbjngR5YqIC", "Rw2ZYQFfy74C", "s550mfKJWJAC", "sPAud06zOqcC", "SstfNYaa-gsC", "sT8uCriUVloC", "SViiPVoClWAC", "SYaFTP5qgEsC", "sZPy2IltN-wC", "T0Rx9oivVsQC", "t3h4nl3v91YC", "TGYP2rhIXM0C", "TKOUBqpaLI4C", "toKIEHepkIgC", "tTOrRdTXNlQC", "txVOZJziHAcC", "uaAMQY5-4nMC", "ucFO7tBv-pIC", "UcQ0P-6P7q4C", "uf9QosYeuX4C", "ufV1PRGkP90C", "UHSx4t_R0wYC", "UIupgDi6OugC", "Up4x7U20ZVUC", "urO0JtViT3oC", "UtQKuF5Y0tUC", "UuuMiX4SDXMC", "v8Z1tc-6200C", "vHTy1OaeHI0C", "vnl0a09mk-cC", "vt2lioMOxnkC", "vWfPuK6eCn8C", "w1kb1gE5PxUC", "w4GQlLISiCYC", "wFlu01q-wC0C", "wmwnm-sPBeQC", "WwmkfE2TBE8C", "WYfK1zOtoLwC", "X91l3wqJnikC", "x_V3JdEvL7UC", "xOs5mVMo1xAC", "xu_zcxk2cOoC", "y3Zmn5Ke0ZYC", "yiKnw-99J7oC", "YogcNmM_oJwC", "yRizg1DsQh0C", "ysVrxa25lM4C", "yTfReukYcwoC", "z9SSyLNpqusC", "zDLowxgAMCoC", "Zh4_Ptk31K4C", "zlpXQ8ifEv0C", "zwEtSw1aw1QC", "-A-wrak3BkAC", "-H4xjMzoYj4C", "-sFkv-rGTJYC", "-vEXEPUJK4EC", "-y5Jxp_VbTQC", "07LTDdpMZfYC", "0ba36JZTUswC", "0dD9rHI5H5sC", "0G-F2AOqNuUC", "0HMvmNpuDf4C", "0NP8hnGNjAsC", "0Q6cMEkz8xkC", "0Sb9rQ5Ewd4C", "16agJ40MsqkC", "1amOE2BYvIYC", "1dLQ-XiilEIC", "1e_JFkI3DPMC", "1HeSzCJrOR0C", "1IjS2r3poyEC", "1PRS3fY7pykC", "1UMxj3O_JbEC", "1waIe7g_DAsC", "22DJdTiUvg0C", "29I9RRjYX9sC", "2hLRAkzKHjIC", "2Pk6AWA0cJoC", "2pxcG08a90UC", "2sbP7J-lckoC", "2VqEXOH-b2YC", "2W3d7kwUIo4C", "2z22FTDqiwwC", "2ZAptMWcCdwC", "31rCgtgEU7AC", "38T2BHhBznwC", "3HDyoJBoLBQC", "3QzNODskpJYC", "3S37vpzASg0C", "3zLSRa5lIyUC", "44ml8Z4UGEMC", "4_QEsBJLmy8C", "4cJDRBFy9kEC", "4F1SDVZb2NgC", "4GXEmkTTUpoC", "4mcT7A371xQC", "5_zAi06GKNwC", "5E0omkoy-S4C", "5EdVJ4vYF8QC", "5F3S8RgQNUQC", "5gdqw3ax1KsC", "5L4An9lC3hwC", "5L8anx8CvsIC", "5r3QJUEsNWUC", "5rF_31RVTnMC", "5VMcW1f4fmMC", "61rslRcPoZ0C", "61W3aGvTVgIC", "6pmBjSl35egC", "6S2GdoIPkKQC", "6YkQy7wv83EC", "6yRD5W-t2XMC", "70vIJVnOOpIC", "71NB5LcRaSIC", "73s7zfPb2L0C", "79x4w7DnzPMC", "7RGQjnd620gC", "7VWZRVvoE0MC", "7wMuF4A4XF8C", "7Yhkld-Fr5wC", "7Ypg28yZ6aIC", "8aEwylFfsjIC", "8dCnb4uR63EC", "8fp1A2s6aQwC", "8h7qnrbCEAUC", "8H8WfZ_AyU8C", "8HDEs3wNLd8C", "8yG5UrYMQ-0C", "8z03WKzlC3MC", "96hZRNDqFJwC", "9b2VoLf4MzkC", "9dQq-oVJFaUC", "9jiJd8_5KnoC", "9K6oJ3mezL4C", "9L-bI_M_WskC", "9L8MwyFsFvsC", "9ne3r2XzbzEC", "9nFwTXKoS6gC", "9QCpUYKTwKwC", "9SrWPKB2q7MC", "9VYuMmcxSYcC", "9vZ64MLmVS8C", "9wynPVLnhDAC", "_2BzIHoeil8C", "_30zvdewnuEC", "__CvAFrcWY0C", "_c95aA8dOLkC", "_mtzX3Gs9nUC", "_mur2PUOp8wC", "_P1JvRV1iCIC", "_rewTS4v-EsC", "_UKmhTR0ITkC", "_UNNPyZHBHoC", "_uxrn_B6nQIC", "_wofmBiXXv0C", "a3eobGCRYGgC", "a8O0IRmdttkC", "akhuVP5NY-kC", "AmESXDfiId4C", "AoSgoI5FddcC", "AR4mvx9Tn0QC", "asrHFGGziHwC", "aWmi9nbSr04C", "aXwlII05pnkC", "axxlIDSbKg0C", "AYD_qooekugC", "AZ5J6B1-4BoC", "B2tGEsVMrYUC", "b34oZ_wzrTkC", "B5I9_q-88Q4C", "BA8Ok58Q-ugC", "bCGd7ampITkC", "bKVCtH4AjwgC", "BNZ2-nzmQ_EC", "boA1HQSnefYC", "btpIkZ6X6egC", "BZvXZ1au0VcC", "c0KhuXidBe4C", "C2YHElDp6loC", "c2zhJMEYccQC", "C4Rqx1_fKLYC", "C_bL0PRTQl4C", "CBureoAhqXEC", "CcJjP5T0fwQC", "ccwXeaPkuoUC", "CdocFvhd-JsC", "CefIFvgupFYC", "CEYDySjS0UwC", "cfS2tdrgGa0C", "CfZMvlReQAkC", "cLec-hyjLJgC", "cMjSV6CDnOgC", "CQ356zufRpcC", "CqjBCWV6Eu4C", "cWQJJIgJNtUC", "CwYTKoE33jgC", "Cx4DMx_JXggC", "cxlsKCEBohsC", "CxYXaAUJytUC", "CYYnmQwmT2QC", "D1Gm-lqYM2AC", "d1LNoUWhdf4C", "d2rXwFdzuo8C", "D2sYaR0b2ZUC", "D5H6yvflq-wC", "D8UzeKZKKvgC", "D_IwgpeDNUcC", "DayPI1EjaRgC", "DE_Ay18WF8oC", "DEgbRttpd9EC", "dELO9Pc3P50C", "dfysT8sctZAC", "DFzy1wgWL6IC", "dhr32lY_rt4C", "dKIo6D9yh3cC", "DNmjHtlFJUcC", "dqM_GcdDEHsC", "DVMsjPtMfqMC", "dwfGvtzvte4C", "dyIWVNGh-zcC", "E-tcvjEw4jEC", "e2q53WFE7hEC", "e8aDEGSDCToC", "EarJQWvrLOQC", "edFHvonqKX0C", "eFBOvBvKqE4C", "eK0SnBnpkA8C", "em3obwwfGUAC", "eq0n9Ck79ysC", "EqgV2wJhi1cC", "Er-_4IaVw1AC", "EtjIuCcJkNoC", "eu-lSNjgkSIC", "EYTfQ9h2vaoC", "fa0U8hYlJlwC", "FaovgJjD1AIC", "faQU6AVeFigC", "fBazruOey4UC", "fCunxPYp_OAC", "Ffl0HCe_YV4C", "FFO2clqJCqMC", "Fg2TI5x7qOUC", "Fg5MjfVSQOkC", "FN5wMOZKTYMC", "fnVy4v5pZPMC", "FPWSLAVs8jMC", "FS2DSJIHg9MC", "fTi775ZHyDsC", "fWKAXYomhoIC", "FXPtglTFvKIC", "FZH5yr1VCfUC", "G4UH8cPE_VkC", "g8o-_gdZ4gIC", "GCyjMr7CudIC", "GELdo7SRRssC", "GG7Y6ZFGk0AC", "GghRg6VmYPMC", "GifAXXyoO84C", "gkaUu__vNDQC", "GKPktrYG7sUC", "gq5gFEcgRHAC", "gt7EQgH8-b4C", "GVchqY1ZaB0C", "gxizgOuEebsC", "gxU0P7bsBIYC", "GyjunFDS-HoC", "gZaqADTgdtcC", "h0gJc-Sdx_8C", "H4m1VKnO7VYC", "H501Nxy7xv0C", "H83nwxNyJMgC", "H8_o6tEvTnYC", "H_5zYEhiT3IC", "HDVCxjgGZmkC", "HElYZgz1dLsC", "hfpZ7mDgL4YC", "hFSx37SaQRoC", "HG1-0P8zV8IC", "HGnopNYgga4C", "hhnIWGD5Zt0C", "HjmIMdOx6-cC", "hk7brsxp4d0C", "HLkJ7pVVOKEC", "HpydZ7Xl1xwC", "hsKLPs5XqtQC", "HT7LP-hRhQ4C", "HwQD7Q7rhkwC", "hx4zw8cp__UC", "HXRS6p9LRTIC", "HxtpSewA1lAC", "HZc3FzaajnMC", "I-RTiw0Z30MC", "i3Ts4B2_SrAC", "iaKLCIkmYmsC", "iCpj07vEEIcC", "ifocmqVPHUwC", "IjJNEdgb7DwC", "IKSHVdYUzGEC", "injpY-EerZgC", "IQC01c3qeCQC", "IsldnzHkxpsC", "itSPLM6udREC", "ittzoegmRpAC", "iUwStqNL3CUC", "iUyrNlDbzsIC", "IV2Gkol65s4C", "Iw_gHtk4ghYC", "iXn5U2IzVH0C", "j1hzezxjN4QC", "jagVDBB5nNMC", "jB1L3asv5ysC", "JbffyB5vT4kC", "Jh0wzZASOyQC", "JI6RrXDzH9UC", "jILZHKGefnAC", "JNgAP8k5KroC", "jNYDVy1Xt40C", "jOMGyirP81IC", "K-7YdiF2eEQC", "k1Am3RpR7dAC", "k63dDkZnAoIC", "K8qzZ7NWsvgC", "KAvITyK0lpsC", "KAZvQcXJ0vEC", "KcOo6u5EKR8C", "kfDyeu7Gt8YC", "KFWbc2tiav8C", "KgSgVDI8c2UC", "KjxRXWdXeREC", "kJxvhVkvYmYC", "KkRi8y0wGhEC", "kNBw5fDZ7sYC", "kotPYEqx7kMC", "Kq6EQGda_30C", "KRaNlo6MwskC", "KY7pygt5ImgC", "l4CEWzs7a88C", "L5RPRCmkzhYC", "la_e6cgLl-sC", "LBBhikJpLjwC", "lDcxH8-0ODYC", "LdxfLieU0aEC", "lh0JevgRoKsC", "Lib_c4i9A50C", "lj5woI0AjhsC", "lKq3n2S7I8kC", "LmCCGgBTqFAC", "lmTAEdyyMRUC", "LnkpdauAHvEC", "LVYKm7eJC28C", "lx7mQQ0mm0IC", "LXdGN9ovH6AC", "lyOsjsAjvcgC", "M1AUC4TY4u0C", "M5X8iZ0GCoYC", "m5ysTujFqbgC", "mDmcW9KR6r0C", "MF9KWcidqhcC", "MfS5ck5qHDwC", "mGrRj_bpLBoC", "MH5atcMZq2EC", "MmJeXfkFNKwC", "mMy6t9_dONAC", "MNA1xBL8akkC", "mQVimIsyPd8C", "ms6LXsqcn7wC", "mSlgn03zAroC", "Mt9NFfWXW7wC", "mUEOJuwUAOkC", "muXgq4C2UtoC", "mUYVmd01fuoC", "MYII8Qi1-eoC", "n2B9sT9UfIkC", "n2EK2khQWfsC", "n2kd2ajvTIsC", "nI3i03KWHlcC", "niDNtZoYsAUC", "NIo3RQmYLqQC", "NksODwE5nNIC", "nRC9zn3nHIQC", "nRLXi-7ikW0C", "NuMx6tmf5iIC", "NWiG1MtLMioC", "Ny5I1aaSlSIC", "Nzcj9nmbEiUC", "NzRpoHvMkS0C", "nzUcExdmkzAC", "NzzLC__TwZkC", "Obp2ZR6DlakC", "obY-pbyMSp0C", "oCji-fn5qEUC", "OcRqqQiIrqoC", "OF-YSMKCVwMC", "of5TqT4nz4QC", "ofSWPafmlpAC", "OiE31yjuVbYC", "OKq9OVHLjjUC", "OKV8Nd7hKhkC", "On9mohCLQMgC", "ongYdoSU3R0C", "oSXEwOdkpmAC", "OwCyCvI8mokC", "OxyUsyZrqY8C", "oXz1ZblCUIUC", "p-ln2rx0vrwC", "p0dUyABx9SQC", "P7yZUMBcbxAC", "peudW5Nk940C", "PFYBPAS3LIEC", "PIqwFAOQXdoC", "PJArEP_lPlMC", "PJgMFxbClw8C", "pK43Jn0RmTcC", "PltZoL6swlQC", "Pm9ZcFYtLZ4C", "pnGaA_pJXjQC", "PQh8kNVjYyQC", "pS-xvdmJsMYC", "ps7z-1FtNPkC", "pV8oTgZ6B3AC", "PxOB8s6dtA0C", "Pyg-gr37IkwC", "Q1CEQ0AZh1kC", "q1JPyB4n7LgC", "Q2OHIJ5W94IC", "Q2yO_wNMX74C", "Q5BuEKEe4pYC", "q6-Pgq6Bd0cC", "Q7Jk307w-XkC", "q9N5V51Zp3UC", "Qa8IoiT_3kAC", "qDWo8bSCLwkC", "qFV6Th-pDiYC", "qg61T_I1mwsC", "qgJ4lh1zynwC", "QhPgEq5ZeY8C", "QJb16_AAePkC", "QJWqI7uH7YUC", "qKHF_8IruzYC", "qliYOteXA30C", "QlLMwIkHVu8C", "qsijdHADx8IC", "qxiWkQws3msC", "Qyhd5sjMWnMC", "R19P0tZxivIC", "r63oLL3zwpsC", "REwBpIGM9PAC", "rg20BVnXdz0C", "RkGQBTHGw_8C", "rKq8bnUK3WoC", "rkRu9OJ6gWQC", "RlmniRlFsU0C", "RMd3GpIFxcUC", "ROHwG0JvP-sC", "RoT8nuzZY6MC", "RoYgPLWFeakC", "rRQ-ln-SYnMC", "RrTATTAw4MoC", "rtumzZ-I8gwC", "RW5arTsd59UC", "rXeG6ivbdIcC", "RXT-iRt5s9MC", "RZ_J2zSCsBMC", "s-IKDw_xNO4C", "S1aY04SCeCcC", "S3wSTfB65c8C", "S7wSLx75gsAC", "s8zIH7dnYCsC", "s9mLc43sk5IC", "sAtrYgbkH5gC", "SBBgOwoaYMEC", "sbNgTt34a7AC", "ScE8F_pMuAAC", "SD3G3dyx2ZoC", "sfC0p0Y9wY8C", "SGJFKqC6MEYC", "SH7sligOwkkC", "sh97YD9oH3MC", "shdMhBkwr9cC", "SimBCSprSRUC", "SJe2yL_R6JQC", "sL7ECNmsZQgC", "SLwk6C7rVhgC", "sph0j9N0q44C", "SRFbLHcl808C", "SscRZAljZY0C", "SUAwvChYnlwC", "T0u3mLgB7Q8C", "T9tq_wfD9XMC", "t9XWY5VKJSkC", "t_ZYYXZq4RgC", "tDi1X___kA8C", "Tk2tDV5PIjwC", "tKLvPAScbiAC", "tMW8EeBw1UEC", "tRHgqZAB8C0C", "ts0EsIYrVc4C", "TtJ0VT4AnMkC", "TUfQSR9GsvsC", "TYHPLULRAtAC", "TZjfyuUJ9yQC", "U-G59-3EhFQC", "U0CS9uC20SEC", "U8ExdUHjzkMC", "u9udoFdoMooC", "U_XsG9AG6fsC", "ubRi0dxb8EIC", "ucpxOA3LDWcC", "ueALvm1u_YYC", "UFJC7ZobicUC", "Ugih6Tuam_sC", "UHnXXp7M_2EC", "URoDbjKxx3oC", "UUODSqSSrZcC", "UvK1Slvkz3MC", "UVtcxvx5Zr8C", "UwH5IwTWH3EC", "V-kIKg7wCZYC", "V2Nlg8AWg2AC", "VB4eUip9HNcC", "vcxlHkUGf_wC", "VDY_jN9gbioC", "veGXULZK6UAC", "VF588BtEzCcC", "VGooIP6SZQEC", "vGtXrnsvqWYC", "ViiOObWG1ogC", "Vimx2y5WKpMC", "vJvTIBZTP-8C", "VKGbb1hg8JAC", "vm0qOJQsPIIC", "vRY8uYQUjDwC", "VSlxdKgEO9EC", "VWwH9SboEQcC", "vX0W3_MvZbMC", "VYMshHfserwC", "W6AjlOPmznUC", "W_5-RKxftbcC", "wBE-34_KfcAC", "Wc_U6-E3b6YC", "wDnbqY15oCQC", "WDvIpH2lB0QC", "WGqj5MIQ1KgC", "WGTzrCVoIuYC", "whdtOuA58e0C", "wIEr8jXYBt8C", "WpCOFC9f6H0C", "WQtn2bQAowcC", "WSny7lnNBH8C", "WULCfFrGFcwC", "WUuBNF1eSqwC", "WUyzf2cJzu8C", "WwmkMDW1GxIC", "wzPlQGKox1EC", "X7J1FvRrpPoC", "x8cFahLCb54C", "xAo1XyDVdHkC", "xc2N4ZOxtCYC", "XG5At3bBBWAC", "XIdrVDRgdpMC", "xIp209jwYQ0C", "xkVp8BIq7YkC", "XpgKk24qYW8C", "XQQPM0LOS8IC", "XRxGufxD-PMC", "xsv8s0uId1oC", "XuGYOTVOU8QC", "xuRUA92_Dc4C", "xWOhDP7JWzEC", "xxBV-d20EWQC", "xXFGHk2Z4TwC", "y11kvNfIDh4C", "Y7du4IGkNagC", "YAC7D2qEu4kC", "YAv9Gv9ZIbcC", "ybOLU8HOjA4C", "YcM_8N-LLyUC", "yEnodbQ-u3MC", "YilJnRfXKSAC", "yKKMZ0YNLR4C", "YkVmgI7YvxkC", "YqtQAsx1kGAC", "Yrehcfj2IVsC", "ys_e1Jaxh4UC", "Yso319xUOF8C", "yT_H75Q6vWoC", "yTzXasTZ0xgC", "YuLuAn3itnAC", "YwzHrfZ8ROgC", "yyaL8KoFHKIC", "Yz8Fnw0PlEQC", "z2-T2Cn6NOAC", "z2NgWQu08XsC", "z2z_6hLoPmgC", "Z6yEh5g4iIcC", "z_7igwZUWX0C", "ZCAOHdptArYC", "zDy5mkB49mEC", "zejLZgD7VDsC", "ZfjzX7M8zt0C", "ZHwey8h5Kj4C", "zjvMUVww2fQC", "ZjYP5o18qQUC", "ZlGXyYoJH2EC", "ZM7mhiLmkrsC", "ZOB2ex9u1tMC", "ZoIDSON3vxcC", "Zp_b7CdQnzwC", "ZrnT-eIoVp4C", "zuaXngLs7OIC", "ZUPMbdMUJ8EC", "zWyyiIzM6kkC", "zzB8tAKtJScC", "-HiTXBE53PkC", "-Mu5Id9OoiEC", "-qs-S7mcpAcC", "-SdPoFp5WY0C", "-tpxIqgSRPwC", "-ttE-GZ-90cC", "-zXAoJy9ZmcC", "0WqtKlK_Ha8C", "0zfUQBVN_6IC", "1AX4IDXvGsYC", "1CuMCEn7nRcC", "1cXYGgN_gTQC", "1rbQvvxaIeQC", "1VlYrwJaReUC", "1wJEiMiltVgC", "1zPAua_44-kC", "24teZxI_ULEC", "25CgnTRraSwC", "29SeWQJSpSQC", "29VG6KWyirsC", "2n38thsgRaMC", "2nDPxIRqakcC", "2NNOBx5MdJUC", "3BpO_k_I2w8C", "3KzJr5_U4egC", "3xiBJl96cucC", "41O5QMgL1ZwC", "42qZKhN6n2EC", "49iiP39EWLAC", "4_NxE3TPiJsC", "4d-24SQ8TYwC", "4NhF-0fO0rIC", "4w4d6DjmDXMC", "4ZwXRrnPRuYC", "56-7DPb-1WUC", "5GjvwsQaJpsC", "5IFW0O9roEMC", "5JT8pTHx6lwC", "5PzDzEHKMegC", "5SpZmBLVnTQC", "5sstxl1kHtkC", "6cj5S73lNhMC", "6dJg5lYQTpYC", "6GabZxz4odIC", "6uDSshoVhKUC", "6uSIwSV3jqMC", "73wZxrd6LLoC", "7fMyqj458A8C", "7j2C8YXT8CMC", "7RqcdCf6nMkC", "8CxEChno1_EC", "8iEJ4ygwLR8C", "8jm4f9g0IacC", "8nUpToKerf8C", "8UOpVTHrB_sC", "8Uzp-AZ5mcIC", "8WRQSiji_N4C", "95zvqUxnGRIC", "9aBRG7IsNLgC", "9kNyNN_EpjQC", "_6NkbJnEeJMC", "_b1S5Z3T8ccC", "_dihY3IN01UC", "_f9cU9A5l-0C", "_i1VOn2G0vkC", "_tYR8zDI-gkC", "Ac7i1Tx98cgC", "AdNBeO6z8E8C", "AhyJw6wBpG8C", "Aiomz_6zVOcC", "aiq1-13V_CMC", "amjgNfGpFi4C", "AMQbpv0qNT8C", "Ao-JdOzPM-AC", "AOSNQIKsvqQC", "aUv9po5f7w0C", "b0t3tbbLF1kC", "B2QEk37eIqUC", "b9IsR8SbBqYC", "BA25ObtVNzMC", "BD78Onv1vkUC", "BExlP6vJRXYC", "bfC_gngo50wC", "bg63hIxNC1kC", "BIdJFEjW_vUC", "BN5oIno4VqQC", "Bsk0YKq0fmcC", "BspCLoRq1vUC", "BWYADYaJt2gC", "by3ZJt2TI2YC", "BYXXhMklOo8C", "BZKG-F4EycgC", "C2v0oeOu5VYC", "cbc9ocX0LIsC", "cfi0mLqWXGoC", "ChFWJid77IIC", "Chz_b0lEGXQC", "ckb0paUhxBEC", "ckegWbaTOJ0C", "CLmNsqJmFoMC", "cLWxt9-9rAoC", "coQwNld57tUC", "cQeV7Mafr3IC", "DA8YSPVoU0UC", "DdDPBL0bd3sC", "dJT51seXtO0C", "DmL9nnVzj1EC", "dnwug8jhZigC", "DPXiC_ruDiQC", "DqXoN8liZoQC", "DU-yivYkS6gC", "dWvs3ZAJfF4C", "EbquUB1D6B8C", "Egiv9G3sUUQC", "EGNjKKGuFfsC", "ELDPuG_3HvsC", "ElJEc2z5fzgC", "eTuUboxIQTsC", "euwNw6sDqJgC", "eWbJqcDb9eEC", "f4LDwCA8B3EC", "f57ibdOL5-cC", "f7Ga6pUeGhUC", "F7Xks6zduAwC", "F8Pk9pECmZ0C", "FulGowIgz_oC", "fWaS4YKF92wC", "FWW3LmOvLAkC", "fZLrWkFOed0C", "FzRuc3t_4FQC", "g6oDwhSZW1wC", "G6UBLLF9V6AC", "G_Pl1zA-kLUC", "gHHPFw298TUC", "GhxE5kre3IsC", "gIPYys8Mj9wC", "GM-pxDjDhHEC", "GRTP8eYtZRgC", "gsqHkjUK-CwC", "gt7EQgH8-b4C", "gtIuj0DenGwC", "gUcjEDfJU9wC", "Gwql9KIPwp8C", "Gxqm3AgkOD0C", "Gy-744ZK_6sC", "H1f0MKOTfmYC", "h5dwL3eiZCwC", "HcleFaappJQC", "HefV2Vc5QDoC", "HFMSaLzKFvMC", "hg5N-qqzl8QC", "HG_L8PBfRTcC", "hHW6kcAmitwC", "HIB6jD68jtAC", "hknZxFWtWnQC", "hkyn43xcqBgC", "HNSJEqH4wd8C", "hVhnQbiuF5wC", "hW_OLqbJmjQC", "Hy8W-LdFAEMC", "I7gCj8kl_z0C", "i95ShDMoWl8C", "IeTtcc4I5YgC", "IihkFTDe7U8C", "iMQc67D_Bi8C", "iOygaKJOppsC", "IpTCI9wB72gC", "iXAdjo2g5tsC", "j-bpT-iZsBIC", "j2cH4RdSssgC", "J4ypQMCZMAsC", "jI8f_EJw-loC", "JIWqvxMwdXAC", "JVs8Thx45LIC", "jW3A-I9P7KMC", "jxJmj-TmYhQC", "k6692W5sYakC", "K6Ilv7YHDvsC", "kALuBPE9pgsC", "KfidaxTHKiwC", "KHfuJmOBmaAC", "Kj0tBzuMtXkC", "kJWbXg8Wa1sC", "KqWwCMZQutQC", "l-M62xrrDrkC", "LCBLklGJH6sC", "LcRxfTdcQsgC", "LDaTjZR3M5EC", "lJ5BOCoK4S0C", "lKMngSSGLYYC", "LUjoyS5SKvAC", "LvFLo5USiAMC", "lZ5Fljw24CwC", "LzVq41L36gMC", "M0PjsgRgee4C", "M2X-64ljtXMC", "m3hk7oHshCQC", "MdEgRyJHmvoC", "MeF_f1aEpgEC", "Mfw69Bu72BUC", "MMNOTofuzh0C", "mNIwAvSxIt0C", "mOhNJQRpjroC", "mQLDLn0GQfwC", "MYMr5_Ykyo0C", "N10hOWQXL-kC", "n4bolfkDxvIC", "n7nBUhbFMfMC", "NiM_ryIMcBoC", "nKqcauePjVUC", "nLP9mH1GqtgC", "NmEftUIRJ5YC", "NoKR0DIwgsAC", "NW-neYpd2BYC", "NzZt-kQ_4bkC", "o0pxKZa6arMC", "O4I-9BDUrt8C", "O9dN_wetT2cC", "oc0LoROKM0MC", "OfcnGQxF42wC", "Oi_TFcnNj28C", "OmCZYpe_-yQC", "OmLNidG2VjgC", "onBZhX0H9YkC", "OtabdzMdbboC", "OY-R3RCzA78C", "oz4SawhQX6wC", "p2fY2E64QY0C", "pIOcbS2Pl8kC", "pJCnEYUVvF4C", "pk2phND9ApkC", "pOw1hbQ78H0C", "PTifbRnUvDoC", "q0c-bJ2hHfQC", "q9azqAw4BUYC", "QfHKUpwFKw8C", "qG-9cwHOcCIC", "qiasCVJd65UC", "qltC9xIfSVUC", "qOmL3-S6mB0C", "qrobRyJWc1kC", "Qwr5QXEo2SgC", "qxN4qk2bm3IC", "R_uGxY9OLYEC", "rcmfi84AxKYC", "RCTBfxBqRPMC", "Rgm7rGu-D1IC", "rjP8UMPX2fwC", "rJQTgovAH7QC", "rKmH2DNXricC", "rlHWoqDYZHkC", "rMkF_Lq8fyoC", "ryiKO7sUa2cC", "S1ySM_WvJasC", "SI2M91foS7IC", "SM-_qeJkHIMC", "SRfg1yx_4F0C", "sTM1gVZ5bFMC", "t1UaNw7E5CgC", "tEvwF3BTNLQC", "Tf5MWT-MrzwC", "TI-Jpzfm-04C", "TifhggVk0KoC", "TjS6g05F31EC", "TkSmPbx4wAcC", "tm1CM85Ji_UC", "tOmDiAD6WfkC", "TRXR69wo-rYC", "tsCx4nvNxs8C", "u-Ng_zi1l3kC", "U2pksdgrZUwC", "u9KzoP-MO48C", "UB5Wbb-7BBcC", "ugNkM98iIAoC", "ui2nvsots4UC", "uJoGA_fHppsC", "UMAcfj2k4dYC", "unEwDjEo4XYC", "urbPib1FKzYC", "UYn5KM1ZRKYC", "V00KDCcEbfcC", "v75WO3nTdIMC", "v8ehi--t7EYC", "v9LbGourEWoC", "VbQzT0w3UvUC", "VgcJm1OQzHAC", "VGuRUjq7rHEC", "vK88ktao7pIC", "VLaWXj1jftkC", "VRVgvfUGzHIC", "VS7FlveweFMC", "vvn9_WPnK0gC", "VxVn-pqj488C", "W3M2HhmoJioC", "w5Gkiv9mdWsC", "w6LTXzLHjRYC", "WaoGQDv7PS8C", "wB1YBB9oLoIC", "wGkfEiBVkjwC", "WHCJ-c-xfQMC", "WMjEWv8mbIMC", "wSE4rVYlfA0C", "WSm5d0TfZNwC", "wx6S6kQcs3IC", "wZmrXnyxdpUC", "x0yCaQIFn6AC", "X60kQYBZEwgC", "xcFR-BgMomcC", "XCvxvh1qP9EC", "Xf3h3Z1YQtIC", "xIRuF5cfQ84C", "Xl-q92gWo8kC", "XMpQDN8o764C", "Y3D6_dU9wKcC", "y3Jfv2LJUR4C", "Y_r_YROlF44C", "yA7lxN7h4PAC", "YBSgcUJGkxkC", "YDLE5IsoYdIC", "YdtPYQHlJJIC", "yErnhyixDrMC", "yilnz_FH8EAC", "yjCQGpt39_AC", "Yoei3KyEszUC", "yqZWNBTokh0C", "ysLuHIf92jQC", "yUf0zj2tveoC", "yuF_MMw4IMAC", "z4ymKGCCWJcC", "Z5Wmz4oPcd4C", "z6xF3flz6cgC", "zAaz0BvKzAoC", "zB0MrDkAqHQC", "zcWxPi1-TDwC", "zDors2fHOrMC", "zhJxkMW1EtcC", "ZJ3UgCmHDScC", "ZqOLmYD-0l4C", "ZUwohLzvB7kC", "zyHkTOU7fPMC", "ZZNLaR6u7GYC"]';});

define('dat/mahog/Library',[
  'dat/mahog/BookInfo',
  'dat/mahog/CONFIG',
  'dat/mahog/params',
  'dat/mahog/utils',
  'text!dat/mahog/data/dominant_colors.json',
  'text!dat/mahog/data/ids.json',
  'third-party/js-signals.min'
], function(BookInfo, CONFIG, params, utils, colors, ids) {


  colors = JSON.parse(colors);
  ids = JSON.parse(ids);
//  console.log(colors);


  /**
   * @class A Library stores information about the books kept on a bookshelf.
   * Mahogany will only fetch book information about books we can "see" or are
   * about to see.
   * @exports Library as mahog/Library
   */
  var Library = function(renderer) {

    var _this = this;
    var _library = [];
    var _yDirection = 1;

    var dataStagger = new DataStagger();
    var thumbnailStagger = new ThumbnailStagger();

    var texture_history = [];
    var shouldRender = false;
    var renderQueued = null;

    var spriteSheets = [];

    /**
     * Preloads the spritesheets
     *
     * @param {Object} gl WebGL drawing context.
     */
    this.preloadSheets = function(gl) {

      var spriteSheetCount = Math.ceil(
        CONFIG.count / CONFIG['spritesheet_count']);

      for (var i = 0; i < spriteSheetCount; i++) {

        spriteSheets[i] = THREE.ImageUtils.loadTexture(
            '/spritesheets/' + i + '.jpg',
            THREE.UVMapping,
            getOnLoad(i)

      );

      }

      function getOnLoad(i) {
        return function() {

          var max = i + CONFIG['spritesheet_count'];

          withRange(i, max, function(bookInfo) {
            bookInfo.status.thumbnail_received = true;
          });

          spriteSheets[i].__webglTexture = gl.createTexture();

          gl.bindTexture(gl.TEXTURE_2D, spriteSheets[i].__webglTexture);
          gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
            spriteSheets[i].image);

          spriteSheets[i].__webglInit = true;

        }
      }

    };

    /**
     * To be called every frame. Updates the data stagger and thumbnail stagger.
     *
     */
    this.update = function() {

//      dataStagger.update();
      thumbnailStagger.update();

    };

    /**
     * Get book information about a specific book.
     *
     * @param {Number} bookIndex Index of book in bookDisplayers array
     *
     */
    this.fetch = function(bookIndex) {

      var cur = _library[bookIndex];

      // If we haven't asked for this book before ...
      if (cur == undefined) {

        // Make a new blank book info
        _library[bookIndex] = new BookInfo();
        cur = _library[bookIndex];

      }

      return cur;

    };

    /**
     * Loads information about books located within the specified indeces.
     *
     * @param {Number} lo minimum book index.
     * @param {Number} hi maximum book index (inclusive).
     * @param {Number} yDirection am I tilting up or down? (this dictates which
     *   order the textures load).
     *
     */
    this.see = function(lo, hi, yDirection) {

      _yDirection = yDirection;

//      console.log(lo, hi);
//
      see_c = 0;

      for (var i = lo; i <= hi; i++) {
        thumbnailStagger.request(i);
      }


    };
    var see_c = 0;

    /**
     * Loads the fullsize cover.
     *
     * @param {Number} bookIndex Index of book.
     * @param {Function} callback called upon success.
     * @param {Function} fail called upon failure.
     */
    this.requestCover = function(bookIndex, callback, fail) {

      // console.log('cover requesting', bookIndex);

      var bookInfo = _this.fetch(bookIndex);

      var fullsizeURL = utils.fullsizeURL(bookInfo.id);

      // We should add image everytime.
      // if (bookInfo.status.fullsize_requested) {
      //
      //   if (bookInfo.status.fullsize_applied) {
      //
      //     callback(bookInfo.textures.fullsize);
      //   }
      //   return;
      //
      // }

      bookInfo.status.fullsize_requested = true;

          var img = new Image();
          img.src = fullsizeURL;
          img.onload = function() {
            callback(img);
          };

    };

    /**
     * Associates a book with a Book Displayer.
     *
     * @param {mahog.BookDisplayer} bookDisplayer
     * @param {Number} bookIndex Index of book with which to associate the Book
     * Displayer.
     * @param {Object} statusListeners Status listener object
     * @param {Function} applyThumbnail function to receive thumbnails when
     * loaded.
     */
    this.registerBookDisplayerAt = function(
      bookDisplayer, bookIndex, statusListeners, applyThumbnail) {

      var prevBookIndex = bookDisplayer.getBookIndex();

      if (prevBookIndex != undefined) {

        var prevBookInfo = _this.fetch(prevBookIndex);

        prevBookInfo.bookDisplayer = undefined;
        prevBookInfo.status.clearListeners();

        prevBookInfo.status.thumbnail_applied = false;
        prevBookInfo.status.displayer_attached = false;


        prevBookInfo.applyThumbnail = function() {
          // do nothing.
        };

      }

      var info = _this.fetch(bookIndex);

      info.bookDisplayer = bookDisplayer;
      info.applyThumbnail = applyThumbnail;

      info.id = ids[bookIndex];

      info.data.color = colors[bookIndex];

//
//      info.status.clearListeners();
//      info.status.registerListeners(statusListeners);

      info.status.displayer_attached = true;


      var spriteSheetIndex = Math.floor(bookIndex / CONFIG['spritesheet_count']);

//if (!(info.status.thumbnail_requested && !info.status.thumbnail_received)) {
//        setTimeout(function() {
          applyThumbnail(spriteSheets[spriteSheetIndex], bookIndex);
//        }, see_c*1);
//  }
see_c++;

      if (spriteSheets[spriteSheetIndex] != undefined) {
        info.status.thumbnail_applied = true;
      }

      return info;

    };

    function DataStagger() {

      var frameCount = 0;
      var queue = [];

      this.request = function(lo, hi) {

        //console.log('Requesting ' + lo + ' ' + hi);

        withRange(lo, hi, function(bookInfo) {
//          bookInfo.status.data_request_queued = true;
        });

      };

      this.update = function() {
        if (timeToHonor()) {
          aggregateRequests();
          honorRequests();
        }
        frameCount++;
      };

      function timeToHonor() {
        return frameCount % 20 == 0;
      }

      function aggregateRequests() {

        for (var i = 0; i < _library.length; i++) {

          var lo, hi;


            hi = i;

          if (_library[i] &&
              // If the request has been queued ...
              _library[i].status.data_request_queued &&
            // And it hasn't been honored
            // Nor is it waiting to be honored ...
              !(_library[i].status.data_requested || isIndexInQueue(i))
              ) {

            if (lo == undefined) {
              lo = i;
            }

//            queue.push(new Request(i, i+1));

          } else if (i != 0 && lo != undefined && hi != lo) {


            queue.push(new Request(lo, hi));
            lo = undefined;

          }

        }

        if (lo != undefined && hi != lo) {
          queue.push(new Request(lo, hi));
        }

      }

      function honorRequests() {

        while (queue.length > 0) {
          queue.shift().honor();
        }

      }

      function isIndexInQueue(index) {
        for (var i = 0; i < queue.length; i++) {
          if (queue[i].contains(index)) {
            return true;
          }
        }
        return false;
      }

      function Request(lo, hi) {

        // console.log('request', lo, hi);


        this.contains = function(i) {
          return i >= lo && i < hi;
        };

        this.honor = function() {

          //console.log('asking for books from ' + lo + ' to ' + hi);

          //TODO: this should no longer be used (remove)
          var url = '/api/book_info?begin=' + lo + '&end=' + hi;
          withRange(lo, hi, function(bookInfo) {
            bookInfo.status.data_requested = true;
          });

          $.getJSON(url, getOnReceiveData(lo));

        };

        function getOnReceiveData(beginIndex) {

          return function(data) {
            // console.log(data);
            withRange(beginIndex, beginIndex + data.length, function(bookInfo) {
              bookInfo.status.data_received = true;
            });

            for (var i = 0; i < data.length; i++) {

              var bookIndex = i + beginIndex;
              var bookInfo = _this.fetch(bookIndex);

              bookInfo.data = data[i];
              bookInfo.id = data[i].id;
              bookInfo.status.data_received = true;

//              console.log('made a texture stagger request ... ');
//              thumbnailStagger.request(bookIndex);

            }

          };

        }

      }

    }

    function ThumbnailStagger() {

      var applicationRequestQueue = [];
      var imageRequestQueue = [];

      this.request = function(bookIndex) {

        var spriteSheetIndex = Math.floor(
          bookIndex / CONFIG['spritesheet_count']);

        if (spriteSheets[spriteSheetIndex] == undefined &&
          imageRequestQueue.indexOf(spriteSheetIndex) == -1) {
          imageRequestQueue.push(spriteSheetIndex);
        } else if (spriteSheets[spriteSheetIndex] != undefined) {
          applicationRequestQueue.push(bookIndex);
        }

      };

      this.update = function() {

        //sortApplicationRequestQueue(); // very expensive?

        for (var i = 0; i < params.applyThumbnailStaggerSize &&
          applicationRequestQueue.length > 0; i++) {

          honorApplicationRequest(applicationRequestQueue.shift());

        }

        for (i = 0; i < params.imageRequestStaggerSize &&
          imageRequestQueue.length > 0; i++) {

          honorImageRequest(imageRequestQueue.shift());

        }

        return shouldRender;

      };

      function honorApplicationRequest(bookIndex) {

        var bookInfo = _this.fetch(bookIndex);

        // Not if we've already applied it.
        if (bookInfo.status.thumbnail_applied) {
          return;
        }
        var spriteSheetIndex = parseInt(bookIndex / CONFIG['spritesheet_count']);

//        console.log('honoring ' + bookIndex);
//        if (spriteSheets[spriteSheetIndex]) {
        bookInfo.applyThumbnail(spriteSheets[spriteSheetIndex], bookIndex);
        bookInfo.status.thumbnail_applied = true;
//          }

      }

      function honorImageRequest(spriteSheetIndex) {

        var min = spriteSheetIndex * CONFIG['spritesheet_count'];
        var max = min + CONFIG['spritesheet_count'];

        withRange(min, max, function(bookInfo) {
          bookInfo.status.thumbnail_requested = true;
        });

        var try_to_load = setInterval(function() {
          var tex = spriteSheets[spriteSheetIndex];
          if (tex && tex.image) {
            tex.image.src = '/spritesheets/' + spriteSheetIndex + '.jpg';
          }
        }, Math.random()*1000+1000);

        spriteSheets[spriteSheetIndex] = THREE.ImageUtils.loadTexture(
            '/spritesheets/' + spriteSheetIndex + '.jpg',
            THREE.UVMapping,
            function(img) {

              clearInterval(try_to_load);
              // Let Bookshelf know that an image is rendered and we should
              // render that to the WebGL Context!
              shouldRender = true;
              if (renderQueued !== null) {
                clearTimeout(renderQueued);
              }
              renderQueued = setTimeout(function() {
                shouldRender = false;
                renderQueued = null;
              }, 1000);

              withRange(min, max, function(bookInfo, bookIndex) {
                bookInfo.status.thumbnail_received = true;
                applicationRequestQueue.push(bookIndex);
              });

            }

        );

        // console.log(params.maxTextures);
//
//        texture_history.push(spriteSheetIndex);
//        if (texture_history.length > params.maxTextures) {
//          var toRemove = texture_history.splice(0, 1)[0];
////          renderer.deallocateTexture(spriteSheets[toRemove]);
//          spriteSheets[toRemove] = undefined;
//          delete spriteSheets[toRemove];
//        }

//        console.log("#" + spriteSheetIndex);


      }

    }

    function withRange(lo, hi, each) {
//      console.log(lo, hi, each);
      for (var i = lo; i < hi; i++) {
        each(_this.fetch(i), i);
      }
    }

//    dataStagger.request(0, CONFIG.count-1);
  };

  Library.ids = ids;

  return Library;

});

define('dat/mahog/shaders/BookVertexPars',[],
function() {

  var BookVertexPars = [

    "uniform float near;",
    "uniform float far;",

    "uniform float isCover;",
    "uniform float thickness;",

    "uniform float tileSize;",
    "uniform float tileColumn;",
    "uniform float tileRow;",

    "uniform float morphInfluences[ 4 ];",

    "varying vec3 vLightWeighting;",
    "varying vec3 vNormal;",
    "varying vec2 vUv;",
    "varying vec2 vUv2;"

  ].join("\n");

  return BookVertexPars;

});
define('dat/mahog/shaders/BookFragmentPars',[], function() {

  var BookFragmentPars = [

    "uniform sampler2D texturemap;",
    "uniform sampler2D lightmap;",
    "uniform float isOpened;",
    "uniform vec4 tint;",
    "uniform float dim;",

    "varying vec3 vLightWeighting;",

    "uniform vec3 fogColor;",
    "uniform float fogNear;",
    "uniform float fogFar;",
    "uniform float transparency;",
    "varying vec3 vNormal;",
    "varying vec2 vUv;",
      "const vec3 black = vec3(0.);",
      "const vec3 white = vec3(1.);",
    "varying vec2 vUv2;"


  ].join("\n");

  return BookFragmentPars;

});
define('dat/mahog/shaders/MorphingBookShaderSource',['dat/mahog/shaders/BookUniforms',
      'dat/mahog/shaders/BookVertexPars',
      'dat/mahog/shaders/BookFragmentPars'],
function(BookUniforms, BookVertexPars, BookFragmentPars) {

  var MorphingBookShaderSource = {

    uniforms: BookUniforms,

    vertexShader: [

      BookVertexPars,

      "void main() {",

      "vec3 transformedNormal = normalize( normalMatrix * normal );",
      "vNormal = transformedNormal;",
      "vUv = uv;",

      "if (isCover == 1.) {",

        //"if (vUv.s > 1. || vUv2.s < 0. || vUv2.t > 1. || vUv2.t < 0.)",
          //"vUv2 = vec2(.01, .5 - position.y);",
        //"else",
          //"vUv2 = vec2(1. - vUv.s / .5, vUv.t / .7);",

        "vUv2 = vec2(1. - vUv.s / .5, vUv.t / .7);",
        "if (vUv2.s > 1. || vUv2.s < 0. || vUv2.t > 1. || vUv2.s < 0.) vUv2 = vec2(.01,.5-position.y);",
        "vUv2 *= tileSize;",
        "vUv2 += vec2(tileColumn,tileRow)*tileSize;",
      "} else {",

        //"if (vUv.s > 1. || vUv2.s < 0. || vUv2.t > 1. || vUv2.t < 0.)",
          //"vUv2 = vec2(0., 0.);",
        //"else",
          //"vUv2 = vec2(vUv.s, vUv.t / .7);",

        "vUv2 = vec2(vUv.s, vUv.t / .7);",
        "if (vUv2.s > 1. || vUv2.s < 0. || vUv2.t > 1. || vUv2.s < 0.) vUv2 = vec2(0.,0.);",
      "}",

      "vec3 morphedThin = vec3(0.);",
      "morphedThin += ( mix(morphTarget0,morphTarget4,thickness) - position ) * morphInfluences[ 0 ];",
      "morphedThin += ( mix(morphTarget1,morphTarget5,thickness) - position ) * morphInfluences[ 1 ];",
      "morphedThin += ( mix(morphTarget2,morphTarget6,thickness) - position ) * morphInfluences[ 2 ];",
      "morphedThin += ( mix(morphTarget3,morphTarget7,thickness) - position ) * morphInfluences[ 3 ];",
      "morphedThin += position;",

      "gl_Position = projectionMatrix * modelViewMatrix * vec4( morphedThin, 1.0 );",

      "}"

    ].join("\n"),

    fragmentShader: [

      BookFragmentPars,

      "void main() {",

      "vec4 texture = texture2D( texturemap, vUv2.st );",

      "vec3 lightMapMix = texture2D( lightmap, vUv.st ).rgg;",
      "float lightFinal = mix(lightMapMix.r,lightMapMix.g,1.-isOpened);",

      "gl_FragColor = vec4( vec3( lightFinal * texture ),1.0);",

      "float depth = gl_FragCoord.z / gl_FragCoord.w;",
      "float fogFactor = smoothstep( fogNear, fogFar, depth );",
      "gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );",

      "}"

    ].join("\n")
  };

  return MorphingBookShaderSource;

});

define('dat/mahog/MorphingBook',[
  'dat/mahog/params',
  'dat/mahog/shaders/MorphingBookShaderSource',
  'dat/utils/utils'
], function(params, MorphingBookShaderSource, datutils) {

  var MorphingBook = function(coverTexture, pagesTexture, p) {

    var _this = this;

    p = p || {};

    var _width = p.width || 35;
    var _height = p.height || 50;
    var _thickness = p.thickness || 0.5;
    var _opened = p.opened || 0;
    var _tileSize = p.tileSize || 1;
    var _tileColumn = p.tileColumn || 0;
    var _tileRow = p.tileRow || 0;

    this.morphInfluences = [];
    var _coverMaterial = new MorphingBook.Material(coverTexture, _this, true);
    var _pagesMaterial = new MorphingBook.Material(pagesTexture, _this, false);

    this.mesh = new THREE.Object3D();

    var cover = new THREE.Mesh(
      MorphingBook.COVER_GEOMETRY, _coverMaterial.material);
    this.mesh.addChild(cover);

    var pages = new THREE.Mesh(
      MorphingBook.PAGES_GEOMETRY, _pagesMaterial.material);
    this.mesh.addChild(pages);

    var hitGeom = new THREE.PlaneGeometry(1, 1);
    var hitMaterial = new THREE.MeshBasicMaterial();
    var hitPlane = new THREE.Mesh(hitGeom, hitMaterial);
    var hitPlaneXScale = 1;

    hitPlane.visible = false;

    this.mesh.addChild(hitPlane);

    this.show = function() {
      _this.mesh.children[0].visible = true;
      _this.mesh.children[1].visible = true;
    };

    this.getTopLeft = function(opened) {
      var a = Math.atan2(_this.mesh.position.z, _this.mesh.position.x);
      var amp = datutils.map(opened, 0, 1, _width / 2, _width);
      var bamp = datutils.map(opened, 0, 1, 0, _width / 2);
      var x = _this.mesh.position.x + Math.cos(a + Math.PI / 2) * amp +
        Math.cos(a + Math.PI) * bamp;
      var y = _this.mesh.position.y + _height / 2;
      var z = _this.mesh.position.z + Math.sin(a + Math.PI / 2) * amp +
        Math.sin(a + Math.PI) * bamp;
      return new THREE.Vector3(x, y, z);
    };

    this.getTopRight = function(opened) {
      var a = Math.atan2(_this.mesh.position.z, _this.mesh.position.x);
      var amp = datutils.map(opened, 0, 1, _width / 2, _width);
      var bamp = datutils.map(opened, 0, 1, 0, _width / 2);
      var x = _this.mesh.position.x + Math.cos(a - Math.PI / 2) * amp -
        Math.cos(a) * bamp;
      var y = _this.mesh.position.y + _height / 2;
      var z = _this.mesh.position.z + Math.sin(a - Math.PI / 2) * amp -
        Math.sin(a) * bamp;
      return new THREE.Vector3(x, y, z);
    };

    this.getBottomMiddleRight = function(opened) {
      var a = Math.atan2(_this.mesh.position.z, _this.mesh.position.x);
      var amp = datutils.map(opened, 0, 1, _width / 2, _width);
      var bamp = datutils.map(opened, 0, 1, 0, _width / 2);
      var x = _this.mesh.position.x + Math.cos(a - Math.PI) * amp +
        Math.cos(a - Math.PI / 2) * bamp;
      var y = _this.mesh.position.y - (_height / 2) * .9;
      var z = _this.mesh.position.z + Math.sin(a - Math.PI) * amp +
        Math.sin(a - Math.PI / 2) * bamp;
      return new THREE.Vector3(x, y, z);
    };

    this.getBottomRight = function(opened) {
      var a = Math.atan2(_this.mesh.position.z, _this.mesh.position.x);
      var amp = datutils.map(opened, 0, 1, _width / 2, _width);
      var bamp = datutils.map(opened, 0, 1, 0, _width / 2);
      var x = _this.mesh.position.x + Math.cos(a - Math.PI / 2) * amp -
        Math.cos(a) * bamp;
      var y = _this.mesh.position.y - _height / 2;
      var z = _this.mesh.position.z + Math.sin(a - Math.PI / 2) * amp -
        Math.sin(a) * bamp;
      return new THREE.Vector3(x, y, z);
    };

    this.getBottomLeft = function(opened) {
      var a = Math.atan2(_this.mesh.position.z, _this.mesh.position.x);
      var amp = datutils.map(opened, 0, 1, _width / 2, _width);
      var bamp = datutils.map(opened, 0, 1, 0, _width / 2);
      var x = _this.mesh.position.x + Math.cos(a + Math.PI / 2) * amp +
        Math.cos(a + Math.PI) * bamp;
      var y = _this.mesh.position.y - _height / 2;
      var z = _this.mesh.position.z + Math.sin(a + Math.PI / 2) * amp +
        Math.sin(a + Math.PI) * bamp;
      return new THREE.Vector3(x, y, z);
    };

    this.hide = function() {
      _this.mesh.children[0].visible = false;
      _this.mesh.children[1].visible = false;
    };

    this.__defineGetter__('height', function() {
      return _height;
    });

    this.__defineSetter__('height', function(v) {
      if (_height == v) return;
      _height = v;
      onChangeDimensions();
    });

    this.__defineGetter__('width', function() {
      return _width;
    });

    this.__defineSetter__('width', function(v) {
      if (_width == v) return;
      _width = v;
      onChangeDimensions();
    });

    this.__defineGetter__('thickness', function() {
      return _thickness;
    });

    this.__defineSetter__('thickness', function(v) {
      if (_thickness == v) return;
      _thickness = v;
      onChangeOpenedOrThickness();
    });

    this.__defineGetter__('opened', function() {
      return _opened;
    });

    this.__defineSetter__('opened', function(v) {
      if (_opened == v) return;
      _opened = v;
      onChangeOpenedOrThickness();
    });

    this.setCoverImage = function(img) {
      _coverMaterial.setImage(img);
    };

    this.setPagesImage = function(img) {
      _pagesMaterial.setImage(img);
    };

    this.__defineGetter__('tileSize', function() {
      return _tileSize;
    });

    this.__defineSetter__('tileSize', function(v) {
      if (_tileSize == v) return;
      _tileSize = v;
      onChangeTile();
    });

    this.__defineGetter__('tileRow', function() {
      return _tileRow;
    });

    this.__defineSetter__('tileRow', function(v) {
      if (_tileRow == v) return;
      _tileRow = v;
      onChangeTile();
    });

    this.__defineGetter__('tileColumn', function() {
      return _tileColumn;
    });

    this.__defineSetter__('tileColumn', function(v) {
      if (_tileColumn == v) return;
      _tileColumn = v;
      onChangeTile();
    });

    function onChangeOpenedOrThickness() {

      var m = Math.max(Math.min(_opened, 1), 0) * 3;

      _this.morphInfluences[0] = Math.max(0, Math.min(m + 1, -m + 1));
      _this.morphInfluences[1] = Math.max(0, Math.min(m, -m + 2));
      _this.morphInfluences[2] = Math.max(0, Math.min(m - 1, -m + 3));
      _this.morphInfluences[3] = Math.max(0, Math.min(m - 2, -m + 4));

      _pagesMaterial.onChangeOpenedOrThickness(_opened, _thickness);
      _coverMaterial.onChangeOpenedOrThickness(_opened, _thickness);

      pages.geometry.computeBoundingBox();
      pages.geometry.computeBoundingSphere();

      cover.geometry.computeBoundingBox();
      cover.geometry.computeBoundingSphere();

      hitPlane.rotation.y = datutils.map(
        _opened, 0, params.maxOpen, 0, Math.PI / 2);
      hitPlaneXScale = datutils.map(_opened, 0, params.maxOpen, 1, 2);
      hitPlane.scale.set(hitPlaneXScale * _width, _height, _width);

    }

    function onChangeDimensions() {
      _this.mesh.children[0].scale.set(_width, _height, _width);
      _this.mesh.children[1].scale.set(_width, _height, _width);
      hitPlane.scale.set(hitPlaneXScale * _width, _height, _width);
    }

    function onChangeTile() {
      _coverMaterial.setTile(_tileSize, _tileColumn, _tileRow);
    }

    onChangeOpenedOrThickness();
    onChangeDimensions();
    onChangeTile();

  };

  MorphingBook.loadAssets = function(success) {


    var loader = new THREE.JSONLoader();

    loader.load({
      model: params.MORPHING_COVER_GEOMETRY_SRC, callback: onLoadCover
    });

    function onLoadCover(geometry) {
      MorphingBook.COVER_GEOMETRY = geometry;
      loader.load({
        model: params.MORPHING_PAGES_GEOMETRY_SRC, callback: onLoadPages
      });
    }

    function onLoadPages(geometry) {


      MorphingBook.PAGES_GEOMETRY = geometry;


      MorphingBook.COVER_LIGHT_MAP =
          THREE.ImageUtils.loadTexture(
            params.MORPHING_COVER_LIGHT_MAP_SRC,
            THREE.UVMapping,
            onLoadCoverLightMap);
    }

    function onLoadCoverLightMap() {

      MorphingBook.PAGES_LIGHT_MAP =
          THREE.ImageUtils.loadTexture(
            params.MORPHING_PAGES_LIGHT_MAP_SRC,
            THREE.UVMapping,
            onLoadPagesLightMap);
    }

    function onLoadPagesLightMap() {
      if (success) {
        success();
      }
    }

  };

  MorphingBook.Material = function(texture, book, isCover) {

    var _this = this;

    this.uniforms = THREE.UniformsUtils.clone(
      MorphingBookShaderSource.uniforms);

    this.uniforms['texturemap'].texture = texture;

    this.uniforms['lightmap'].texture = isCover ?
        MorphingBook.COVER_LIGHT_MAP :
        MorphingBook.PAGES_LIGHT_MAP;

    this.uniforms['isCover'].value = isCover;
    this.uniforms['morphInfluences'].value = book.morphInfluences;

    this.material = new THREE.MeshShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: MorphingBookShaderSource.vertexShader,
      fragmentShader: MorphingBookShaderSource.fragmentShader,
      morphTargets: true,
      lights: true
    });

    this.setImage = function(image) {
//      var gl = THREE.currentRenderer.getContext();
//      if(_this.uniforms['texturemap'] &&
//         _this.uniforms['texturemap'].texture &&
//         _this.uniforms['texturemap'].texture.__webglTexture) {
//        gl.deleteTexture(_this.uniforms['texturemap'].texture.__webglTexture);
//      }
     _this.uniforms['texturemap'].texture.image = image;
     _this.uniforms['texturemap'].texture.needsUpdate = true;
    };

    this.setTile = function(size, column, row) {
      _this.uniforms['tileSize'].value = size;
      _this.uniforms['tileColumn'].value = column;
      _this.uniforms['tileRow'].value = row;
    };

    this.onChangeOpenedOrThickness = function(opened, thickness) {
      _this.uniforms['isOpened'].value = opened;
      _this.uniforms['thickness'].value = thickness;
    };

  };

  return MorphingBook;

});

define('dat/mahog/shaders/StaticBookShaderSource',['dat/mahog/shaders/BookUniforms',
      'dat/mahog/shaders/BookVertexPars',
      'dat/mahog/shaders/BookFragmentPars'],
function(BookUniforms, BookVertexPars, BookFragmentPars) {

  var StaticBookShaderSource = {

    uniforms: BookUniforms,

    vertexShader: [

      BookVertexPars,

      "void main() {",

      "vec3 transformedNormal = normalize( normalMatrix * normal );",
      "vNormal = transformedNormal;",
      "vUv = uv;",

      //"if (vUv.s > .5 || vUv2.s < 0. || vUv2.t > .7 || vUv2.t < 0.)",
        //"vUv2 = vec2(.0001, .5 - position.y);",
      //"else",
        //"vUv2 = vec2(1. - vUv.s / .5, vUv.t / .7);",

      "vUv2 = vec2(1. - vUv.s / .5, vUv.t / .7);",
      "if (vUv2.s > 1. || vUv2.s < 0. || vUv2.t > 1. || vUv2.s < 0.) vUv2 = vec2(.0001,.5-position.y);",
      "vUv2 *= tileSize;",
      "vUv2 += vec2(tileColumn,tileRow)*tileSize;",

      "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

      "}"

    ].join("\n"),

    fragmentShader: [

      BookFragmentPars,
      "void main() {",

      "vec4 texture = texture2D( texturemap, vUv2.st );",

      "vec3 light = texture2D( lightmap, vUv.st ).rgb;",



      "if (vUv.s>0.5 && vUv.t > 0.7) { texture.rgb = white;",
      "} else { if (tint.a > 0.) texture.rgb *= mix(white, tint.rgb, tint.a);",
      "if (dim > 0.) texture.rgb = mix(texture.rgb, vec3(0), dim); }",



      "float depth = gl_FragCoord.z / gl_FragCoord.w;",
      "float fogFactor = smoothstep( fogNear, fogFar, depth );",
      "gl_FragColor = mix( vec4( texture.rgb * light.g , transparency), vec4( fogColor, 1.0 ), fogFactor );",

      "}"

    ].join("\n")
  }

  return StaticBookShaderSource;

});

define('dat/mahog/StaticBook',[
  'dat/mahog/params',
  'dat/mahog/shaders/StaticBookShaderSource'
], function(params, StaticBookShaderSource) {

  var StaticBook = function(coverTexture, params) {

    params = params || {};

    var _this = this;

    var _scale = 1;

    var _width = params.width || 35;
    var _height = params.height || 50;
    var _tileSize = params.tileSize || 1;
    var _tileColumn = params.tileColumn || 0;
    var _tileRow = params.tileRow || 0;
    var _staticMaterial = new StaticBook.Material(coverTexture, _this);
    this.material = _staticMaterial.material;
    this.mesh = new THREE.Mesh(StaticBookGeometry, _staticMaterial.material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.rotationAutoUpdate = false;

    this.setTexture = function(texture) {
      _staticMaterial.uniforms['texturemap'].texture = texture;
    };

    this.setScale = function(s) {
      _scale = s;
      onChangeScale();
    };

    var _t ;

    var cur_a = 0;
    var targ_a = 0;
    var needs_update_a = false;

    var cur_d = 0;
    var targ_d = 0;
    var needs_update_d = false;
var tmp;
    var epsilon = 0.05;
    this.setTint = function(r, g, b, a) {
      targ_a = a;
      if (targ_a != cur_a) needs_update_a = true;
      _staticMaterial.uniforms['tint'].value.x = r;
      _staticMaterial.uniforms['tint'].value.y = g;
      _staticMaterial.uniforms['tint'].value.z = b;
    };

    this.clearTint = function() {
      targ_a = 0;
      if (targ_a != cur_a) needs_update_a = true;
    };

    this.setDim = function(d) {
      targ_d = d;
      if (targ_d != cur_d) needs_update_d = true;
    };

    this.setTransparency = function(t) {
        _staticMaterial.uniforms['transparency'].value = t;
    };

    this.getTint = function() {
      return cur_a;
    };

    this.getDim = function() {
      return cur_d;
    };

    this.update = function() {

      if (needs_update_a) {
        tmp = targ_a - cur_a;
        if (tmp > epsilon || tmp < -epsilon) {
          cur_a += tmp * 0.7;
          _staticMaterial.uniforms['tint'].value.w = cur_a;
        } else {
          needs_update_a = false;
          _staticMaterial.uniforms['tint'].value.w = targ_a;
        }
      }

      if (needs_update_d) {
        tmp = targ_d - cur_d;
        if (tmp > epsilon || tmp < -epsilon) {
          cur_d += tmp * 0.7;
          _staticMaterial.uniforms['dim'].value = cur_d;
        } else {
          needs_update_d = false;
          _staticMaterial.uniforms['dim'].value = targ_d;
        }
      }


    };

    this.__defineGetter__('width', function() {
      return _width;
    });

    this.__defineSetter__('width', function(v) {
      _width = v;
      onChangeScale();
    });

    this.__defineGetter__('height', function() {
      return _height;
    });

    this.__defineSetter__('height', function(v) {
      _height = v;
      onChangeScale();
    });

    this.__defineGetter__('tileSize', function() {
      return _tileSize;
    });

    this.__defineGetter__('tileColumn', function() {
      return _tileColumn;
    });

    this.__defineGetter__('tileRow', function() {
      return _tileRow;
    });

    this.__defineSetter__('tileSize', function(v) {
      _tileSize = v;
      onChangeTile();
    });

    this.__defineSetter__('tileColumn', function(v) {
      _tileColumn = v;
      onChangeTile();
    });

    this.__defineSetter__('tileRow', function(v) {
      _tileRow = v;
      onChangeTile();
    });

    function onChangeScale() {
      _this.mesh.scale.set(_width * _scale, _height * _scale, _width * _scale);
    }

    function onChangeTile() {
      _staticMaterial.setTile(_tileSize, _tileColumn, _tileRow);
    }

    onChangeScale();
    onChangeTile();
  };


  StaticBook.loadAssets = function(success) {

    StaticBook.COVER_LIGHT_MAP =
        THREE.ImageUtils.loadTexture(
            params.STATIC_COVER_LIGHT_MAP_SRC,
            THREE.UVMapping,
            onLoadCoverLightMap);

    function onLoadCoverLightMap() {
      //console.log('got pages light map');
      if (success) {
        success();
      }
    }

  };

  StaticBook.Material = function(texture) {

    var _this = this;

    _this.uniforms = THREE.UniformsUtils.clone(StaticBookShaderSource.uniforms);

    _this.uniforms['texturemap'].texture = texture;
    _this.uniforms['lightmap'].texture = StaticBook.COVER_LIGHT_MAP;


    this.material = new THREE.MeshShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: StaticBookShaderSource.vertexShader,
      fragmentShader: StaticBookShaderSource.fragmentShader,
      lights: true
    });

    this.setTile = function(size, column, row) {
      _this.uniforms['tileSize'].value = size;
      _this.uniforms['tileColumn'].value = column;
      _this.uniforms['tileRow'].value = row;
    };

  };

  var StaticBookThick = { 'version' : 2, 'materials': [
    { 'DbgColor' : 15658734,
      'DbgIndex' : 0, 'DbgName' : 'default' }
  ], 'vertices': [0.487209, 0.486099,
    0.168254, -0.466534, 0.486099, 0.168254, -0.478581, 0.495455, 0.183348,
    0.493336, 0.495455, 0.183348, -0.478581, -0.495455, 0.183348, 0.493336,
    -0.495455, 0.183348, 0.487209, -0.486099, 0.168254, -0.466534, -0.486099,
    0.168254, -0.492807, 0.486099, 0.000000, -0.501347, 0.495455, -0.000000,
    -0.501347, -0.495455, -0.000000, -0.492807, -0.486099, 0.000000, 0.487209,
    0.486099, -0.168254, -0.466534, 0.486099, -0.168254, -0.478581, 0.495455,
    -0.183348, 0.493336, 0.495455, -0.183348, -0.478581, -0.495455, -0.183348,
    0.493336, -0.495455, -0.183348, 0.487209, -0.495455, -0.168254, -0.466534,
    -0.486099, -0.168254, 0.456931, 0.486099, 0.000000, 0.456931, -0.486099,
    0.000000], 'morphTargets': [], 'morphColors': [], 'normals': [], 'colors': [],
    'uvs': [
      [0.000371, 0.000088, 0.494461, 0.000088, 0.494461, 0.700000,
        0.000371, 0.700000, 0.843354, 0.522690, 0.850928, 0.692143, 0.850928,
        0.296902, 0.843354, 0.382325, 0.940324, 0.335176, 0.932983, 0.327617,
        0.912600, 0.581246, 0.920026, 0.581356, 0.977676, 0.253133, 0.957194,
        0.004995, 0.949768, 0.005105, 0.970140, 0.251508, 0.898214, 0.250497,
        0.513762, 0.250497, 0.513762, 0.286871, 0.885880, 0.284575, 0.934129,
        0.294073, 0.961640, 0.292278, 0.971297, 0.292278, 0.007529, 0.709909,
        0.497969, 0.709908, 0.497969, 0.990674, 0.007529, 0.990674, 0.880522,
        0.300495, 0.880522, 0.692143, 0.887948, 0.692143, 0.887948, 0.300495,
        0.977492, 0.333381, 0.971365, 0.327569, 0.953572, 0.533439, 0.960122,
        0.544045, 0.940508, 0.254928, 0.922955, 0.042316, 0.916404, 0.052908,
        0.932971, 0.253305, 0.898214, 0.214122, 0.513762, 0.214122, 0.924472,
        0.294073, 0.907904, 0.883392, 0.909942, 0.866608, 0.874449, 0.866608,
        0.873699, 0.883392, 0.846746, 0.866608, 0.848777, 0.883392, 0.812565,
        0.883392, 0.811696, 0.866608, 0.701736, 0.711853, 0.673127, 0.711853,
        0.673127, 0.988792, 0.701736, 0.988792, 0.657125, 0.988792, 0.657125,
        0.711853, 0.628516, 0.711853, 0.628516, 0.988792, 0.936519, 0.883392,
        0.972919, 0.883392, 0.974956, 0.866608, 0.937269, 0.866608, 0.744802,
        0.866608, 0.782330, 0.866608, 0.784248, 0.883392, 0.746839, 0.883392]
    ],
    'faces': [11, 3, 2, 4, 5, 0, 0, 1, 2, 3, 11, 5, 6, 0, 3, 0, 4, 5, 6, 7, 11, 1,
      2, 3, 0, 0, 8, 9, 10, 11, 11, 7, 6, 5, 4, 0, 12, 13, 14, 15, 11, 9, 10, 4, 2,
      0, 16, 17, 18, 19, 11, 8, 9, 2, 1, 0, 20, 41, 9, 8, 11, 10, 11, 7, 4, 0, 21,
      22, 12, 15, 11, 15, 17, 16, 14, 0, 23, 24, 25, 26, 11, 17, 15, 12, 18, 0, 27,
      28, 29, 30, 11, 19, 16, 17, 18, 0, 31, 32, 33, 34, 11, 13, 12, 15, 14, 0, 35,
      36, 37, 38, 11, 9, 14, 16, 10, 0, 16, 39, 40, 17, 11, 8, 13, 14, 9, 0, 20, 35,
      38, 41, 11, 10, 16, 19, 11, 0, 21, 32, 31, 22, 11, 20, 8, 1, 0, 0, 42, 43, 44,
      45, 11, 6, 7, 11, 21, 0, 46, 47, 48, 49, 11, 20, 0, 6, 21, 0, 50, 51, 52, 53,
      11, 20, 21, 18, 12, 0, 54, 55, 56, 57, 11, 18, 21, 11, 19, 0, 58, 59, 60, 61,
      11, 20, 12, 13, 8, 0, 62, 63, 64, 65], 'edges' : [] };

  var StaticBookThin = { 'version' : 2, 'materials': [
    { 'DbgColor' : 15658734,
      'DbgIndex' : 0, 'DbgName' : 'default' }
  ], 'vertices': [0.496127, 0.491075,
    0.007651, -0.488862, 0.491075, 0.007651, -0.492502, 0.495455, 0.010889,
    0.498874, 0.495455, 0.012181, -0.492502, -0.495455, 0.010889, 0.498874,
    -0.495455, 0.012181, 0.496127, -0.490868, 0.007651, -0.488862, -0.490868,
    0.007651, -0.492807, 0.491075, 0.000000, -0.496212, 0.495455, -0.000000,
    -0.496212, -0.495455, -0.000000, -0.492807, -0.490868, 0.000000, 0.496127,
    0.491075, -0.007651, -0.488862, 0.491075, -0.007651, -0.492502, 0.495455,
    -0.010889, 0.498874, 0.495455, -0.012181, -0.492502, -0.495455, -0.010889,
    0.498874, -0.495455, -0.012181, 0.496127, -0.495455, -0.007651, -0.488862,
    -0.490868, -0.007651, 0.496127, 0.491075, 0.000000, 0.496127, -0.490868,
    0.000000], 'morphTargets': [], 'morphColors': [], 'normals': [], 'colors': [],
    'uvs': [
      [0.000371, 0.000088, 0.494461, 0.000088, 0.494461, 0.700000,
        0.000371, 0.700000, 0.843354, 0.522690, 0.850928, 0.692143, 0.850928,
        0.296902, 0.843354, 0.382325, 0.940324, 0.335176, 0.932983, 0.327617,
        0.912600, 0.581246, 0.920026, 0.581356, 0.977676, 0.253133, 0.957194,
        0.004995, 0.949768, 0.005105, 0.970140, 0.251508, 0.898214, 0.250497,
        0.513762, 0.250497, 0.513762, 0.286871, 0.885880, 0.284575, 0.934129,
        0.294073, 0.961640, 0.292278, 0.971297, 0.292278, 0.007529, 0.709909,
        0.497969, 0.709908, 0.497969, 0.990674, 0.007529, 0.990674, 0.880522,
        0.300495, 0.880522, 0.692143, 0.887948, 0.692143, 0.887948, 0.300495,
        0.977492, 0.333381, 0.971365, 0.327569, 0.953572, 0.533439, 0.960122,
        0.544045, 0.940508, 0.254928, 0.922955, 0.042316, 0.916404, 0.052908,
        0.932971, 0.253305, 0.898214, 0.214122, 0.513762, 0.214122, 0.924472,
        0.294073, 0.907904, 0.883392, 0.909942, 0.866608, 0.874449, 0.866608,
        0.873699, 0.883392, 0.846746, 0.866608, 0.848777, 0.883392, 0.812565,
        0.883392, 0.811696, 0.866608, 0.701736, 0.711853, 0.673127, 0.711853,
        0.673127, 0.988792, 0.701736, 0.988792, 0.657125, 0.988792, 0.657125,
        0.711853, 0.628516, 0.711853, 0.628516, 0.988792, 0.936519, 0.883392,
        0.972919, 0.883392, 0.974956, 0.866608, 0.937269, 0.866608, 0.744802,
        0.866608, 0.782330, 0.866608, 0.784248, 0.883392, 0.746839, 0.883392]
    ],
    'faces': [11, 3, 2, 4, 5, 0, 0, 1, 2, 3, 11, 5, 6, 0, 3, 0, 4, 5, 6, 7, 11, 1,
      2, 3, 0, 0, 8, 9, 10, 11, 11, 7, 6, 5, 4, 0, 12, 13, 14, 15, 11, 9, 10, 4, 2,
      0, 16, 17, 18, 19, 11, 8, 9, 2, 1, 0, 20, 41, 9, 8, 11, 10, 11, 7, 4, 0, 21,
      22, 12, 15, 11, 15, 17, 16, 14, 0, 23, 24, 25, 26, 11, 17, 15, 12, 18, 0, 27,
      28, 29, 30, 11, 19, 16, 17, 18, 0, 31, 32, 33, 34, 11, 13, 12, 15, 14, 0, 35,
      36, 37, 38, 11, 9, 14, 16, 10, 0, 16, 39, 40, 17, 11, 8, 13, 14, 9, 0, 20, 35,
      38, 41, 11, 10, 16, 19, 11, 0, 21, 32, 31, 22, 11, 20, 8, 1, 0, 0, 42, 43, 44,
      45, 11, 6, 7, 11, 21, 0, 46, 47, 48, 49, 11, 20, 0, 6, 21, 0, 50, 51, 52, 53,
      11, 20, 21, 18, 12, 0, 54, 55, 56, 57, 11, 18, 21, 11, 19, 0, 58, 59, 60, 61,
      11, 20, 12, 13, 8, 0, 62, 63, 64, 65], 'edges' : [] };

  var StaticBookGeometry = null;

  var loader = new THREE.JSONLoader();
  loader.createModel(StaticBookThick, function(g1) {

    loader.createModel(StaticBookThin, function(g2) {

      for (var i = 0; i < g1.vertices.length; i++) {
        g2.vertices[i].position.x -= (g2.vertices[i].position.x -
            g1.vertices[i].position.x) * 0.3;
        g2.vertices[i].position.y -= (g2.vertices[i].position.y -
            g1.vertices[i].position.y) * 0.3;
        g2.vertices[i].position.z -= (g2.vertices[i].position.z -
            g1.vertices[i].position.z) * 0.3;
      }

      StaticBookGeometry = g2;

    });
  });

  return StaticBook;

});

define('dat/utils/Routine',[
  ], function() {

    var Routine = function() {

      var _steps = [];
      var _failure;
      var _canceled = false;

      this.clear = function() {
        _steps = [];
      };

      this.wait = function(fnc, fatal) {

        fatal = fatal || false;
        _steps.push(new Step(fnc, fatal));

      };

      this.run = function(failure) {
        _canceled = false;
        _failure = failure;
        step(0);

      };

      this.cancel = function() {
        _canceled = true;
      };

      function step(index) {

        if (_canceled || index >= _steps.length) return;

        var success = function() {
           step(++index);
        };

        var failure = function() {
          if (!_steps[index].fatal) {
            step(++index);
          } else {
            if (typeof _failure == 'function') _failure();
          }
        };

        try {
          _steps[index].execute(success, failure);
        } catch (e) {
          if (typeof _failure == 'function') _failure(e);
        }

      }

      function Step(fnc, fatal) {

        var _fnc = fnc;
        this.fatal = fatal;

        this.execute = function(success, failure) {

          _fnc.apply(this, [success, function() {
            console.error('Failed to do ' + _fnc);
            failure();
          }]);

        }

      }

    };

    return Routine;

});



(function () {
var jq = typeof jQuery !== "undefined" && jQuery;
define("jquery", [], function () { return jq; });
}());

define('dat/utils/showMessage',['jquery'], function() {

  var domElement = document.createElement('div');
  domElement.setAttribute('id', 'console');
  domElement.innerHTML = 'Aww, snap!';

  document.body.appendChild(domElement);
  var d = $(domElement);
  d.hide();
  var fadeTimeout;

  var showing = false;

  var showMessage = function(msg) {
    d.html(msg);

    if (!showing) {
      clearTimeout(fadeTimeout);
      d.fadeIn();
      showing = true;
      var y = window.innerHeight / 2 - d.height() / 2;
      var x = window.innerWidth / 2 - d.width() / 2;
      d.css('top', y + 'px');
      d.css('left', x + 'px');
      fadeTimeout = setTimeout(function() {
        d.fadeOut();
        showing = false;
      }, 5000);
    }
    $(window).trigger('resize');
  };

  return showMessage;

});

define('dat/utils/Canvas2DWrappedText',[],
    function() {

      var Canvas2DWrappedText = function(
        ctx, fontStr, str, leading, width, height) {

        var _this = this;

        var _lines = [];

        var _fontStr = fontStr;
        var _ctx = ctx;

        var charsSwallowed = 0;
        var indexOfLastSpace = 0;
        var testString;

        str = str.replace(/<br>/g, '\r');
        str = str.replace(/<p>\w<\/p>/, '');
        str = str.replace(/<\/p>/g, '\r\r');
        str = str.replace(/<\/?[^>]+(>|$)/g, '');
        str = str.replace('\r{3,}', '\r\r');

        for (var i = 0; i < str.length; i++) {

          var curChar = str[i];

          if (curChar == ' ') {
            indexOfLastSpace = i;
          }

          testString = str.substring(charsSwallowed, i + 1);

          var testWidth = getWidth(testString);

          // If its time for a line break ...
          if (curChar == '\r' || testWidth > width) {

            var shouldUseEllipsis = height !== undefined &&
              (_lines.length + 1) * leading > height;

            if (curChar == ' ' || curChar == '\r') {

              _lines.push(str.substring(charsSwallowed, i) +
                (shouldUseEllipsis ? '...' : ''));
              charsSwallowed = i + 1;

            } else {

              _lines.push(str.substring(charsSwallowed, indexOfLastSpace) +
                (shouldUseEllipsis ? '...' : ''));
              charsSwallowed = indexOfLastSpace + 1;

            }

            if (shouldUseEllipsis) {
              break;

            }

          }

        }

        if (!shouldUseEllipsis) {
          _lines.push(testString);
        }

        this.numLines = function() {
          return _lines.length;
        }

        this.draw = function() {
          _ctx.font = _fontStr;

          var x = 0;
          for (var i = 0; i < _lines.length; i++) {

            if (_this.textAlign == 'center') {
              x = - _ctx.measureText(_lines[i]).width / 2;
            } else {
              x = 0;
            }

            _ctx.fillText(_lines[i], x, i * leading);
          }

        };

        this.getHeight = function() {
          return leading * _lines.length;
        };

        function getWidth(str) {
          return ctx.measureText(str).width;
        }

      };

      return Canvas2DWrappedText;

    });

define('dat/mahog/makePages',[
  'dat/mahog/params',
  'dat/utils/Routine',
  'dat/utils/utils',
  'dat/utils/showMessage',
  'dat/utils/Canvas2DWrappedText',
  'dat/mahog/utils',
  'dat/utils/urlArgs',
  'three'
], function(params, Routine, utils, showMessage, Canvas2DWrappedText, mu, urlArgs) {

  var canvas, width, height, ctx, initalized = false;

  var setup = function() {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    initalized = true;
  };

  var makePages = function(bookData, aspect_ratio, success, failure) {

    if(!initalized) {
      setup();
    }

    var routine = new Routine();

    var qrCode = new Image();

    routine.wait(function(s, f) {
      qrCode.crossOrigin = '';
          qrCode.src = mu.qrURL(bookData.id);

          qrCode.onload = s;
      qrCode.onerror = f;
    });

    routine.wait(function() {
      success(makeTexture(bookData));
    });

    routine.run(function() {
      showMessage(params.errorString);
      require('dat/mahog/BookDisplayer').cancel();
    });

    function makeTexture(bookData) {

      var h = params.pagesTextureWidth / aspect_ratio;
      var height = h / params.pagesAspectRatio;
      setSize(params.pagesTextureWidth, height);

      var qrSize = 115;

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#000';

      // QR Code
      ctx.save();
      //ctx.globalAlpha = 0.3;
      ctx.translate(width * 0.07, height * 3.53 / 4);
      ctx.scale(params.pagesScale, params.pagesScale);
      ctx.drawImage(qrCode, -qrSize / 2, -qrSize / 2, qrSize, qrSize);
      ctx.restore();

      if (bookData.volumeInfo.description) {

        var desc;

        if (urlArgs['installation'] == undefined) {
          desc = new Canvas2DWrappedText(ctx, '15px serif',
              bookData.volumeInfo.description, 20, 187 * params.pagesScale,
              290 * params.pagesScale);
        } else {
          desc = new Canvas2DWrappedText(ctx, '11.5px serif',
              bookData.volumeInfo.description, 18, 215 * params.pagesScale,
              300 * params.pagesScale);
        }

        ctx.save();
        ctx.translate(width * 0.625, height * 0.45 - desc.getHeight() / 2);
        ctx.scale(params.pagesScale, params.pagesScale);
        desc.draw();
        ctx.restore();

        ctx.save();
        ctx.translate(width * 0.625, height * 0.38 - desc.getHeight() / 2);
        ctx.scale(params.pagesScale, params.pagesScale);
        ctx.textAlign = 'left';
        ctx.font = 'italic 16px serif';
        ctx.fillText('Synopsis', 0, 0);
        ctx.restore();
      } else {


        ctx.save();
        ctx.translate(width * 0.802, height * 0.5);
        ctx.scale(params.pagesScale, params.pagesScale);
        ctx.textAlign = 'center';
        ctx.font = 'italic 16px serif';
        ctx.fillText('No description available.', 0, 0);
        ctx.restore();


      }

      //ctx.globalAlpha = 1;


      // Explain QR Code
      /*
       ctx.save();
       ctx.translate(width * 6.33 / 8, height * 2.85 / 4);
       ctx.scale(params.pagesScale, params.pagesScale);
       ctx.textAlign = 'center';
       ctx.font = '16px GeneralGG-340';
       ctx.fillText('Read me on Google Books.', 0, 0);
       ctx.restore();
       */
      /*
       // iv
       ctx.save();
       ctx.translate(width * 6.43 / 8, height * 3.8 / 4);
       ctx.scale(params.pagesScale, params.pagesScale);
       ctx.textAlign = 'left';
       ctx.font = 'italic 10px serif';
       ctx.fillText('iv', 0, 0);
       ctx.restore();
       */

      ctx.fillStyle = '#000';

      var y = 0;

      var title;

      if (bookData.volumeInfo.subtitle) {

        title = new Canvas2DWrappedText(ctx, '20px serif',
            bookData.volumeInfo.title, 24, 175 * params.pagesScale);

        title.textAlign = 'center';

        // Title
        ctx.save();
        ctx.translate(width * 0.21, height * 0.185);
        ctx.scale(params.pagesScale, params.pagesScale);
        title.draw();
        ctx.restore();

        y += title.getHeight() - 16 * params.pagesScale;

        var sub = new Canvas2DWrappedText(ctx, '16px serif',
            bookData.volumeInfo.subtitle, 21, 145 * params.pagesScale);

        sub.textAlign = 'center';

        // Sub Title
        ctx.save();
        ctx.translate(width * 0.21, height * 0.24 + y);
        ctx.scale(params.pagesScale, params.pagesScale);
        sub.draw();
        ctx.restore();
        y += sub.getHeight();

      } else {

        title = new Canvas2DWrappedText(ctx, '20px serif',
            bookData.volumeInfo.title, 24, 145 * params.pagesScale);

        title.textAlign = 'center';

        // Title
        ctx.save();
        ctx.translate(width * 0.21, height * 0.185);
        ctx.scale(params.pagesScale, params.pagesScale);
        title.draw();
        ctx.restore();

        if (title.numLines() == 1) {
          y -= 17 * params.pagesScale;
        }

      }

      // Line
      ctx.save();
      ctx.lineWidth = 0.5;
      ctx.translate(width * 0.21, height * 0.27 + y);
      ctx.scale(params.pagesScale, params.pagesScale);
      ctx.beginPath();
      ctx.moveTo(-80, 0);
      ctx.lineTo(80, 0);
      ctx.stroke();
      ctx.restore();


      var author = new Canvas2DWrappedText(ctx, '16px serif',
          bookData.volumeInfo.authors.join(', '), 21,
          145 * params.pagesScale);

      author.textAlign = 'center';


      // Author
      ctx.save();
      ctx.translate(width * 0.21, height * 0.34 + y);
      ctx.scale(params.pagesScale, params.pagesScale);
      author.draw();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#666';
      ctx.translate(width * 0.21, height * 0.43);

      ctx.scale(params.pagesScale, params.pagesScale);

      /*
       var stars = Math.round(bookData.volumeInfo.averageRating);

       for (var i = 0; i < stars; i++) {
       ctx.save();
       ctx.translate(utils.map(i, 0, stars - 1, -stars * 8, stars * 8), 0);
       drawStar(13 * 0.52, 5 * 0.52);
       ctx.restore();
       }
       ctx.restore();
       */

      return canvas;

    }

    function setSize(w, h) {
      height = canvas.height = h;
      width = canvas.width = w;
    }

    function drawStar(r, r2) {
      ctx.save();
      ctx.beginPath();
      ctx.rotate(-Math.PI / 10);
      ctx.moveTo(r, 0);
      for (var i = 0; i < 9; i++) {
        ctx.rotate(Math.PI / 5);
        if (i % 2 == 0) {
          ctx.lineTo(r2, 0);
        } else {
          ctx.lineTo(r, 0);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }


  };

  return makePages;

});

define('dat/utils/Easing',[], function() {

  Easing = { Linear: {}, Quadratic: {}, Cubic: {}, Quartic: {}, Quintic: {}, Sinusoidal: {}, Exponential: {}, Circular: {}, Elastic: {}, Back: {}, Bounce: {} };


  Easing.Linear.EaseNone = function ( k ) {

    return k;

  };

//

  Easing.Quadratic.EaseIn = function ( k ) {

    return k * k;

  };

  Easing.Quadratic.EaseOut = function ( k ) {

    return - k * ( k - 2 );

  };

  Easing.Quadratic.EaseInOut = function ( k ) {

    if ( ( k *= 2 ) < 1 ) return 0.5 * k * k;
    return - 0.5 * ( --k * ( k - 2 ) - 1 );

  };

//

  Easing.Cubic.EaseIn = function ( k ) {

    return k * k * k;

  };

  Easing.Cubic.EaseOut = function ( k ) {

    return --k * k * k + 1;

  };

  Easing.Cubic.EaseInOut = function ( k ) {

    if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k;
    return 0.5 * ( ( k -= 2 ) * k * k + 2 );

  };

//

  Easing.Quartic.EaseIn = function ( k ) {

    return k * k * k * k;

  };

  Easing.Quartic.EaseOut = function ( k ) {

    return - ( --k * k * k * k - 1 );

  }

  Easing.Quartic.EaseInOut = function ( k ) {

    if ( ( k *= 2 ) < 1) return 0.5 * k * k * k * k;
    return - 0.5 * ( ( k -= 2 ) * k * k * k - 2 );

  };

//

  Easing.Quintic.EaseIn = function ( k ) {

    return k * k * k * k * k;

  };

  Easing.Quintic.EaseOut = function ( k ) {

    return ( k = k - 1 ) * k * k * k * k + 1;

  };

  Easing.Quintic.EaseInOut = function ( k ) {

    if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k * k * k;
    return 0.5 * ( ( k -= 2 ) * k * k * k * k + 2 );

  };

//

  Easing.Sinusoidal.EaseIn = function ( k ) {

    return - Math.cos( k * Math.PI / 2 ) + 1;

  };

  Easing.Sinusoidal.EaseOut = function ( k ) {

    return Math.sin( k * Math.PI / 2 );

  };

  Easing.Sinusoidal.EaseInOut = function ( k ) {

    return - 0.5 * ( Math.cos( Math.PI * k ) - 1 );

  };

//

  Easing.Exponential.EaseIn = function ( k ) {

    return k == 0 ? 0 : Math.pow( 2, 10 * ( k - 1 ) );

  };

  Easing.Exponential.EaseOut = function ( k ) {

    return k == 1 ? 1 : - Math.pow( 2, - 10 * k ) + 1;

  };

  Easing.Exponential.EaseInOut = function ( k ) {

    if ( k == 0 ) return 0;
    if ( k == 1 ) return 1;
    if ( ( k *= 2 ) < 1 ) return 0.5 * Math.pow( 2, 10 * ( k - 1 ) );
    return 0.5 * ( - Math.pow( 2, - 10 * ( k - 1 ) ) + 2 );

  };

//

  Easing.Circular.EaseIn = function ( k ) {

    return - ( Math.sqrt( 1 - k * k ) - 1);

  };

  Easing.Circular.EaseOut = function ( k ) {

    return Math.sqrt( 1 - --k * k );

  };

  Easing.Circular.EaseInOut = function ( k ) {

    if ( ( k /= 0.5 ) < 1) return - 0.5 * ( Math.sqrt( 1 - k * k) - 1);
    return 0.5 * ( Math.sqrt( 1 - ( k -= 2) * k) + 1);

  };

//

  Easing.Elastic.EaseIn = function( k ) {

    var s, a = 0.1, p = 0.4;
    if ( k == 0 ) return 0; if ( k == 1 ) return 1; if ( !p ) p = 0.3;
    if ( !a || a < 1 ) { a = 1; s = p / 4; }
    else s = p / ( 2 * Math.PI ) * Math.asin( 1 / a );
    return - ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );

  };

  Easing.Elastic.EaseOut = function( k ) {

    var s, a = 0.1, p = 0.4;
    if ( k == 0 ) return 0; if ( k == 1 ) return 1; if ( !p ) p = 0.3;
    if ( !a || a < 1 ) { a = 1; s = p / 4; }
    else s = p / ( 2 * Math.PI ) * Math.asin( 1 / a );
    return ( a * Math.pow( 2, - 10 * k) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) + 1 );

  };

  Easing.Elastic.EaseInOut = function( k ) {

    var s, a = 0.1, p = 0.4;
    if ( k == 0 ) return 0; if ( k == 1 ) return 1; if ( !p ) p = 0.3;
    if ( !a || a < 1 ) { a = 1; s = p / 4; }
    else s = p / ( 2 * Math.PI ) * Math.asin( 1 / a );
    if ( ( k *= 2 ) < 1 ) return - 0.5 * ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );
    return a * Math.pow( 2, -10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) * 0.5 + 1;

  };

//

  Easing.Back.EaseIn = function( k ) {

    var s = 1.70158;
    return k * k * ( ( s + 1 ) * k - s );

  };

  Easing.Back.EaseOut = function( k ) {

    var s = 1.70158;
    return ( k = k - 1 ) * k * ( ( s + 1 ) * k + s ) + 1;

  };

  Easing.Back.EaseInOut = function( k ) {

    var s = 1.70158 * 1.525;
    if ( ( k *= 2 ) < 1 ) return 0.5 * ( k * k * ( ( s + 1 ) * k - s ) );
    return 0.5 * ( ( k -= 2 ) * k * ( ( s + 1 ) * k + s ) + 2 );

  };

//

  Easing.Bounce.EaseIn = function( k ) {

    return 1 - Easing.Bounce.EaseOut( 1 - k );

  };

  Easing.Bounce.EaseOut = function( k ) {

    if ( ( k /= 1 ) < ( 1 / 2.75 ) ) {

      return 7.5625 * k * k;

    } else if ( k < ( 2 / 2.75 ) ) {

      return 7.5625 * ( k -= ( 1.5 / 2.75 ) ) * k + 0.75;

    } else if ( k < ( 2.5 / 2.75 ) ) {

      return 7.5625 * ( k -= ( 2.25 / 2.75 ) ) * k + 0.9375;

    } else {

      return 7.5625 * ( k -= ( 2.625 / 2.75 ) ) * k + 0.984375;

    }

  };

  Easing.Bounce.EaseInOut = function( k ) {

    if ( k < 0.5 ) return Easing.Bounce.EaseIn( k * 2 ) * 0.5;
    return Easing.Bounce.EaseOut( k * 2 - 1 ) * 0.5 + 0.5;

  };

  return Easing;
});

//     Underscore.js 1.1.6
//     (c) 2011 Jeremy Ashkenas, DocumentCloud Inc.
//     Underscore is freely distributable under the MIT license.
//     Portions of Underscore are inspired or borrowed from Prototype,
//     Oliver Steele's Functional, and John Resig's Micro-Templating.
//     For all details and documentation:
//     http://documentcloud.github.com/underscore

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `global` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var slice            = ArrayProto.slice,
      unshift          = ArrayProto.unshift,
      toString         = ObjProto.toString,
      hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) { return new wrapper(obj); };

  // Export the Underscore object for **CommonJS**, with backwards-compatibility
  // for the old `require()` API. If we're not in CommonJS, add `_` to the
  // global object.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = _;
    _._ = _;
  } else {
    // Exported as a string, for Closure Compiler "advanced" mode.
    root['_'] = _;
  }

  // Current version.
  _.VERSION = '1.1.6';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects implementing `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (_.isNumber(obj.length)) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (i in obj && iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results[results.length] = iterator.call(context, value, index, list);
    });
    return results;
  };

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = memo !== void 0;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial && index === 0) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError("Reduce of empty array with no initial value");
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return memo !== void 0 ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var reversed = (_.isArray(obj) ? obj.slice() : _.toArray(obj)).reverse();
    return _.reduce(reversed, iterator, memo, context);
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    each(obj, function(value, index, list) {
      if (!iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result = iterator.call(context, value, index, list)) return breaker;
    });
    return result;
  };

  // Determine if a given value is included in the array or object using `===`.
  // Aliased as `contains`.
  _.include = _.contains = function(obj, target) {
    var found = false;
    if (obj == null) return found;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    any(obj, function(value) {
      if (found = value === target) return true;
    });
    return found;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    return _.map(obj, function(value) {
      return (method.call ? method || value : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Return the maximum element or (element-based computation).
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj)) return Math.max.apply(Math, obj);
    var result = {computed : -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj)) return Math.min.apply(Math, obj);
    var result = {computed : Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, iterator, context) {
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value');
  };

  // Groups the object's values by a criterion produced by an iterator
  _.groupBy = function(obj, iterator) {
    var result = {};
    each(obj, function(value, index) {
      var key = iterator(value, index);
      (result[key] || (result[key] = [])).push(value);
    });
    return result;
  };

  // Use a comparator function to figure out at what index an object should
  // be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator) {
    iterator || (iterator = _.identity);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >> 1;
      iterator(array[mid]) < iterator(obj) ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely convert anything iterable into a real, live array.
  _.toArray = function(iterable) {
    if (!iterable)                return [];
    if (iterable.toArray)         return iterable.toArray();
    if (_.isArray(iterable))      return iterable;
    if (_.isArguments(iterable))  return slice.call(iterable);
    return _.values(iterable);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    return _.toArray(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head`. The **guard** check allows it to work
  // with `_.map`.
  _.first = _.head = function(array, n, guard) {
    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the first entry of the array. Aliased as `tail`.
  // Especially useful on the arguments object. Passing an **index** will return
  // the rest of the values in the array from that index onward. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = function(array, index, guard) {
    return slice.call(array, (index == null) || guard ? 1 : index);
  };

  // Get the last element of an array.
  _.last = function(array) {
    return array[array.length - 1];
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, function(value){ return !!value; });
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array) {
    return _.reduce(array, function(memo, value) {
      if (_.isArray(value)) return memo.concat(_.flatten(value));
      memo[memo.length] = value;
      return memo;
    }, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    var values = slice.call(arguments, 1);
    return _.filter(array, function(value){ return !_.include(values, value); });
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted) {
    return _.reduce(array, function(memo, el, i) {
      if (0 == i || (isSorted === true ? _.last(memo) != el : !_.include(memo, el))) memo[memo.length] = el;
      return memo;
    }, []);
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersect = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var args = slice.call(arguments);
    var length = _.max(_.pluck(args, 'length'));
    var results = new Array(length);
    for (var i = 0; i < length; i++) results[i] = _.pluck(args, "" + i);
    return results;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i, l;
    if (isSorted) {
      i = _.sortedIndex(array, item);
      return array[i] === item ? i : -1;
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item);
    for (i = 0, l = array.length; i < l; i++) if (array[i] === item) return i;
    return -1;
  };


  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item) {
    if (array == null) return -1;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) return array.lastIndexOf(item);
    var i = array.length;
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var len = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(len);

    while(idx < len) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Binding with arguments is also known as `curry`.
  // Delegates to **ECMAScript 5**'s native `Function.bind` if available.
  // We check for `func.bind` first, to fail fast when `func` is undefined.
  _.bind = function(func, obj) {
    if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    var args = slice.call(arguments, 2);
    return function() {
      return func.apply(obj, args.concat(slice.call(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length == 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return hasOwnProperty.call(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(func, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Internal function used to implement `_.throttle` and `_.debounce`.
  var limit = function(func, wait, debounce) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var throttler = function() {
        timeout = null;
        func.apply(context, args);
      };
      if (debounce) clearTimeout(timeout);
      if (debounce || !timeout) timeout = setTimeout(throttler, wait);
    };
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time.
  _.throttle = function(func, wait) {
    return limit(func, wait, false);
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds.
  _.debounce = function(func, wait) {
    return limit(func, wait, true);
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      return memo = func.apply(this, arguments);
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func].concat(slice.call(arguments));
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = slice.call(arguments);
    return function() {
      var args = slice.call(arguments);
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) { return func.apply(this, arguments); }
    };
  };


  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (hasOwnProperty.call(obj, key)) keys[keys.length] = key;
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    return _.map(obj, _.identity);
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    return _.filter(_.keys(obj), function(key){ return _.isFunction(obj[key]); }).sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      for (var prop in source) {
        if (source[prop] !== void 0) obj[prop] = source[prop];
      }
    });
    return obj;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      for (var prop in source) {
        if (obj[prop] == null) obj[prop] = source[prop];
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    // Check object identity.
    if (a === b) return true;
    // Different types?
    var atype = typeof(a), btype = typeof(b);
    if (atype != btype) return false;
    // Basic equality test (watch out for coercions).
    if (a == b) return true;
    // One is falsy and the other truthy.
    if ((!a && b) || (a && !b)) return false;
    // Unwrap any wrapped objects.
    if (a._chain) a = a._wrapped;
    if (b._chain) b = b._wrapped;
    // One of them implements an isEqual()?
    if (a.isEqual) return a.isEqual(b);
    // Check dates' integer values.
    if (_.isDate(a) && _.isDate(b)) return a.getTime() === b.getTime();
    // Both are NaN?
    if (_.isNaN(a) && _.isNaN(b)) return false;
    // Compare regular expressions.
    if (_.isRegExp(a) && _.isRegExp(b))
      return a.source     === b.source &&
             a.global     === b.global &&
             a.ignoreCase === b.ignoreCase &&
             a.multiline  === b.multiline;
    // If a is not an object by this point, we can't handle it.
    if (atype !== 'object') return false;
    // Check for different array lengths before comparing contents.
    if (a.length && (a.length !== b.length)) return false;
    // Nothing else worked, deep compare the contents.
    var aKeys = _.keys(a), bKeys = _.keys(b);
    // Different object sizes?
    if (aKeys.length != bKeys.length) return false;
    // Recursive comparison of contents.
    for (var key in a) if (!(key in b) || !_.isEqual(a[key], b[key])) return false;
    return true;
  };

  // Is a given array or object empty?
  _.isEmpty = function(obj) {
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (hasOwnProperty.call(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType == 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an arguments object?
  _.isArguments = function(obj) {
    return !!(obj && hasOwnProperty.call(obj, 'callee'));
  };

  // Is a given value a function?
  _.isFunction = function(obj) {
    return !!(obj && obj.constructor && obj.call && obj.apply);
  };

  // Is a given value a string?
  _.isString = function(obj) {
    return !!(obj === '' || (obj && obj.charCodeAt && obj.substr));
  };

  // Is a given value a number?
  _.isNumber = function(obj) {
    return !!(obj === 0 || (obj && obj.toExponential && obj.toFixed));
  };

  // Is the given value `NaN`? `NaN` happens to be the only value in JavaScript
  // that does not equal itself.
  _.isNaN = function(obj) {
    return obj !== obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false;
  };

  // Is a given value a date?
  _.isDate = function(obj) {
    return !!(obj && obj.getTimezoneOffset && obj.setUTCFullYear);
  };

  // Is the given value a regular expression?
  _.isRegExp = function(obj) {
    return !!(obj && obj.test && obj.exec && (obj.ignoreCase || obj.ignoreCase === false));
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function (n, iterator, context) {
    for (var i = 0; i < n; i++) iterator.call(context, i);
  };

  // Add your own custom functions to the Underscore object, ensuring that
  // they're correctly added to the OOP wrapper as well.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      addToWrapper(name, _[name] = obj[name]);
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = idCounter++;
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(str, data) {
    var c  = _.templateSettings;
    var tmpl = 'var __p=[],print=function(){__p.push.apply(__p,arguments);};' +
      'with(obj||{}){__p.push(\'' +
      str.replace(/\\/g, '\\\\')
         .replace(/'/g, "\\'")
         .replace(c.interpolate, function(match, code) {
           return "'," + code.replace(/\\'/g, "'") + ",'";
         })
         .replace(c.evaluate || null, function(match, code) {
           return "');" + code.replace(/\\'/g, "'")
                              .replace(/[\r\n\t]/g, ' ') + "__p.push('";
         })
         .replace(/\r/g, '\\r')
         .replace(/\n/g, '\\n')
         .replace(/\t/g, '\\t')
         + "');}return __p.join('');";
    var func = new Function('obj', tmpl);
    return data ? func(data) : func;
  };

  // The OOP Wrapper
  // ---------------

  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.
  var wrapper = function(obj) { this._wrapped = obj; };

  // Expose `wrapper.prototype` as `_.prototype`
  _.prototype = wrapper.prototype;

  // Helper function to continue chaining intermediate results.
  var result = function(obj, chain) {
    return chain ? _(obj).chain() : obj;
  };

  // A method to easily add functions to the OOP wrapper.
  var addToWrapper = function(name, func) {
    wrapper.prototype[name] = function() {
      var args = slice.call(arguments);
      unshift.call(args, this._wrapped);
      return result(func.apply(_, args), this._chain);
    };
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      method.apply(this._wrapped, arguments);
      return result(this._wrapped, this._chain);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      return result(method.apply(this._wrapped, arguments), this._chain);
    };
  });

  // Start chaining a wrapped Underscore object.
  wrapper.prototype.chain = function() {
    this._chain = true;
    return this;
  };

  // Extracts the result from a wrapped and chained object.
  wrapper.prototype.value = function() {
    return this._wrapped;
  };

})();

define("underscore", function(){});

define('dat/mahog/animate',[
  'underscore'
],
    function() {

      /**
       * Contains all scheduled and ongoing Animations.
       */
      var _animationQueue = [];

      animate.DEFAULT_NAMESPACE = 'animate';
      animate.ondisturb = function() {};

      /**
       * Updates all animation and returns true if we'll need another update
       * after this.
       *
       * @param {Number} clock optional time in milliseconds.
       * default Date.now().
       */
      animate.update = function(clock) {
//        console.log(clock);


        if (_animationQueue.length === 0) {
          return false;
        }

        if (_.isUndefined(clock)) {
          clock = Date.now();
        }

        var toRemove = [];

        _.each(_animationQueue, function(animation, index) {
          if (animation.update(clock) === false) {
            toRemove.push(index - toRemove.length);
          }
        });

        _.each(toRemove, function(index) {
          _animationQueue.splice(index, 1);
        });

        return _animationQueue.length > 0;

      };

      /**
       * Injects a dat.animate object into another object, or alternatively,
       * returns the dat.animate object if the second argument is false
       *
       * @param {Object} object object to animate.
       * @param {Boolean|String} if false, returns as opposed to injects.
       */
      function animate(object, secondArg) {
        var __animate__, _childAnimations = {}, _namespace;

        if (_.isString(secondArg)) {
          _namespace = secondArg;
        } else {
          _namespace = animate.DEFAULT_NAMESPACE;
        }

        __animate__ = function(argument) {

          if (_.isArray(argument)) {

            chain(object, argument, setState);
            setState(argument[0]);

            if (_animationQueue.length == 0) {
              animate.ondisturb();
            }

          } else if (!_.isUndefined(argument)) {

            setState(prepareParams(object, argument));

            if (_animationQueue.length == 0) animate.ondisturb();

          }

          __animate__.destinationChange();

        };

        __animate__.isAnimating = function(propertyName) {
          return propertyName in _childAnimations;
        };

        if (secondArg !== false) {
          object[_namespace] = __animate__;
        }

        __animate__.clear = function() {

          var propertyNameArray = arguments;

          if (propertyNameArray.length == 0) {
            propertyNameArray = _.keys(_childAnimations);
          }

          _.each(propertyNameArray, function(propertyName) {
            if (!_.isUndefined(_childAnimations[propertyName])) {
              _childAnimations[propertyName].__markedForDeath = true;
            }
          });


        };

        __animate__.destinationChange = function() {};

        __animate__.dest = function(propertyName) {
          if (_.isUndefined(_childAnimations[propertyName]))
            return object[propertyName];

          return _childAnimations[propertyName].__params.to[propertyName];
        };

        if (secondArg === false) {
          return __animate__;
        }

        function setState(params) {

          var animation = new Animation(object, params, removeAnimation);

          _.each(params.to, function(destination, propertyName) {

            if (!_.isUndefined(_childAnimations[propertyName])) {
              _childAnimations[propertyName].__markedForDeath = true;
            }

            _childAnimations[propertyName] = animation;

          });

          _animationQueue.push(animation);

        }

        /**
         * Removes an animation from the state object.
         *
         * @param {Animation} animationToRemove animation.
         */
        function removeAnimation(animationToRemove) {
          _.each(_childAnimations, function(animation, property) {
            if (animation == animationToRemove) {
              delete _childAnimations[property];
            }
          });
        }



      }

      /**
       * Private class to handle individual animations
       *
       * @param {Object} object object to animate.
       * @param {Object} params parameters.
       * @param {Function} onDeath code to run with the animation is
       * completed or forcibly removed.
       */
      function Animation(object, params, onDeath) {

        this.__params = params;

        var _this = this;

        var _end = params.at + params.duration;

        var _prevClock;

        var _hasOnBegin = _.isFunction(params.onBegin);
        var _hasOnComplete = _.isFunction(params.onComplete);
        var _hasOnUpdate = _.isFunction(params.onUpdate);
        var _hasCurve = _.isFunction(params.curve);

        /**
         * Returns false upon death.
         *
         * @param {Number} clock time in milliseconds.
         */
        this.update = function(clock) {

          if (_this.__markedForDeath) {
            onDeath(_this);
            return false;
          }

          if (clock >= _end) {
            if (_hasOnComplete) {
              params.onComplete();
            }
            setValues(params.to, 1, 1);
            onDeath(_this);
            return false;
          }

          if (clock < params.at) {
            _prevClock = clock;
            return true;
          }

          if (_hasOnBegin && _prevClock < params.at) {
            params.onBegin();
          }

          var t = map(clock, params.at, _end, 0, 1), curvedT = t;

          if (_hasCurve) {
            curvedT = params.curve(t);
          }

          var values = {};

          _.each(params.to, function(destination, property) {
            values[property] = map(curvedT, 0, 1,
                params.from[property], destination);
          });

          setValues(values, t, curvedT);

          _prevClock = clock;
          return true;

        };

        /**
         * Calls onUpdate and reflectively updates object values in accordance
         * with this animation if onUpdate does not return false.
         *
         * @param {Object} values map of values at current state in animation.
         * @param {Number} t linear t (0-1).
         * @param {Number} curved_t curved t (0-1),
         * linear if no curve specified.
         */
        function setValues(values, t, curved_t) {
          if (_hasOnUpdate && params.onUpdate(values, t, curved_t) === false) {
            return;
          }
          _.each(values, function(value, property) {
            object[property] = value;
          });
        }
      }

      /**
       * Prepares args for animation, filling in assumed / default values.
       *
       * @param {Object} object object to animate.
       * @param {Object} params params.
       */
      function prepareParams(object, params) {

        if (_.isUndefined(params.at)) {
          params.at = Date.now();
        }

        if (_.isUndefined(params.from)) {
          params.from = {};
        }

        // Collect original values from object
        var original = {};
        _.each(params.to, function(destination, property) {
          original[property] = object[property];
        });

        // Use current values for whatever args.from does not specify
        params.from = _.extend(original, params.from);

        return params;

      }

      function chain(object, paramsArray, setState) {

        // Link each object together via onComplete
        _.each(_.range(paramsArray.length - 1), function(i) {

          paramsArray[i].onComplete = _.wrap(
              paramsArray[i].onComplete,
              function(onComplete) {
                paramsArray[i + 1] = prepareParams(object, paramsArray[i + 1]);
                setState(paramsArray[i + 1]);
                if (_.isFunction(onComplete)) {
                  onComplete();
                }
              }
          );

        });

        // Set proper at times
        paramsArray[0] = prepareParams(object, paramsArray[0]);
        _.each(_.range(1, paramsArray.length), function(i) {
          if (_.isUndefined(paramsArray[i].at)) {
            paramsArray[i].at =
                paramsArray[i - 1].at + paramsArray[i - 1].duration;
          }
        });

      }

      function map(v, i1, i2, o1, o2) {
        return o1 + (o2 - o1) * ((v - i1) / (i2 - i1));
      }

      return animate;

    });

define('dat/mahog/BookDisplayer',[
  'dat/mahog/params',
  'dat/mahog/StaticBook',
  'dat/mahog/CONFIG',
  'dat/mahog/makePages',
  'dat/utils/Easing',
  'dat/utils/utils',
  'dat/mahog/animate',
  'dat/utils/showMessage',
  // 'dat/mahog/Elastic',
  'three'
], function(params, StaticBook, CONFIG, makePages, Easing, utils, animate, showMessage/*, Elastic*/) {

  /**
   * Creates a new BookDisplayer.
   * @class A BookDisplayer is used to represent a book. The book that a given BookDisplayer is representing at any given time can change as we recycle BookDisplayers to create the illusion of infinity, while having a finite amount of geometry.
   * @exports BookDisplayer as mahog/BookDisplayer
   */
  var BookDisplayer =
      /**
       * @constructor
       * @param {mahog.BookShelf} bookshelf Reference to the bookshelf I'm
       * sitting on.
       * @param {THREE.Camera} camera Camera being used to look at me
       * @param {mahog.MorphingBook} morphingBook Reference to the detailed
       * book model.
       */
          function(bookshelf, camera, morphingBook) {

        var _this = this;

//        var scale = new Elastic(1);

        var open = false;
        var canceled = false;
        var loadingFullsize = false;
        var lasttex;
        var timeOpenedAt;

        var bouncePosition, canceledBouncePosition;

        var bookIndex, bookInfo, thumbnailTexture, fullsizeTexture;

        var staticBook = this.staticBook = new StaticBook(BookDisplayer.DEFAULT_TEXTURE);

        var width = staticBook.width;
        var height = staticBook.height;
        var aspect_ratio = width / height;

        /**
         * The 3D object to be placed in our scene.
         */
        this.mesh = staticBook.mesh;
        this.mesh.bookDisplayer = this;

        this.restPosition = new THREE.Vector3();
        this.restRotation = new THREE.Vector3();

        this.getWidth = function() {
          return width;
        };

        this.getHeight = function() {
          return height;
        };

        /**
         * Useful for debugging. The methods contained in this object are fired
         * as book displayers go through progressive phases of loading.
         */
        var bookStatusListener = new function() {

          this.on_displayer_attached = function() {

            if (params.TINT_DEBUG)
              staticBook.setTint(1, 1, 1);
            // else
            // staticBook.clearTint();
          };

          this.on_data_request_queued = function() {

            if (params.TINT_DEBUG)
              staticBook.setTint(1, 0, 0);

          };

          this.on_data_requested = function() {

            if (params.TINT_DEBUG)
              staticBook.setTint(0.6, 1, 0);
          };

          this.on_data_received = function() {

            if (params.TINT_DEBUG)
              staticBook.setTint(1, 1, 0);

//        aspect_ratio = bookInfo.data.aspect_ratio;
//        height = staticBook.height = params.bookSize / aspect_ratio;
//        width = staticBook.width = params.bookSize * aspect_ratio;

          };

          this.on_thumbnail_requested = function() {

            if (params.TINT_DEBUG)
              staticBook.setTint(0, 0, 0);

          };

          this.on_thumbnail_received = function() {

            if (params.TINT_DEBUG)
              staticBook.setTint(0, 1, 0);
          };

          this.on_thumbnail_created = function() {

            if (params.TINT_DEBUG)
              staticBook.setTint(0, 1, 0.5);

          };

          this.on_thumbnail_applied = function() {

            if (params.TINT_DEBUG)
              staticBook.setTint(0, 1, 1);


          };

          this.on_fullsize_requested = function() {

          };

          this.on_fullsize_received = function() {

          };


        };

        /**
         * Registers this BookDisplayer with the library at the specified book
         * index
         * @param {Number} _bookIndex Index of the book with which to associate
         * this displayer.
         */
        this.setBookIndex = function(_bookIndex) {

          if (bookIndex == _bookIndex) return false;

          bookInfo = bookshelf.library.registerBookDisplayerAt(
              _this,
              _bookIndex,
              bookStatusListener,
              setThumbnailTexture
          );

          bookIndex = _bookIndex;

          var c = bookInfo.data.color;

          if (lasttex == undefined)
            staticBook.setTint(c[0]/255, c[1]/255, c[2]/255, 1);

          this.genre = bookshelf.getGenre(_bookIndex);
          _this.onGenreChange();

          return true;

        };

        /**
         * @returns {Number} The book index this displayer is currently
         * associated with.
         */
        this.getBookIndex = function() {
          return bookIndex;
        };

        /**
         * @returns {String} The string ID of the book that we're representing.
         */
        this.getBookID = function() {
          return bookInfo.id;
        };

        /**
         * For debugging purposes. Turns a book yellowish.
         */
        this.highlight = function() {
          staticBook.setTint(1, 1, 0);
        };

        /**
         * For debugging purposes. Clears highlight.
         */
        this.unhighlight = function() {
          staticBook.clearTint();
        };


        function setThumbnailTexture(tex, bookIndex) {
          thumbnailTexture = tex;
          if (!open) {
            setCurrentTexture(tex, bookIndex);
          }

        }

        function setFullsizeTexture(image) {

//          fullsizeTexture = tex;
          if (BookDisplayer.active == _this) morphingBook.setCoverImage(image);

        }

        this.onGenreChange = function() {


          if (_this.genre != bookshelf.getCurrentGenre()) {

               staticBook.setDim(0.66);


          } else {

               staticBook.setDim(0);
           }
        };


        /**
         * To be called every frame. Updates bounce for books that are loading.
         */
        this.update = function(camera) {

          if (loadingFullsize || canceled) {
            bouncePosition = Math.sin((Date.now() - timeOpenedAt) / 200.0);
            var y;
            var stopMoving =
                canceledBouncePosition > 0 ? bouncePosition < 0 : bouncePosition > 0;
            if (!canceled || (canceled && !stopMoving)) {
              y = Math.abs(bouncePosition) * 15;
            } else {
              y = 0;
              canceled = false;
            }
            _this.mesh.position.y = y + _this.restPosition.y;
            _this.mesh.updateMatrix();
          }

          if (bookInfo.status.thumbnail_requested && !bookInfo.status.thumbnail_received) {
            var i = (Math.sin((Date.now() - bookIndex * 40) / 140)+1)/2 + 0.5;
            staticBook.setTransparency(i);
          } else {
            staticBook.setTransparency(1);
          }


          staticBook.update();


        };

        /**
         * Brings the book off the shelf and towards the camera.
         * @param {Function} [onComplete] Function to fire when animation is
         * complete.
         */
        this.open = function(onComplete, onData) {

          //morphingBook.width = width;
          //morphingBook.height = height;

          _this.comingOut = false;

          timeOpenedAt = Date.now();
          loadingFullsize = true;

          morphingBook.hide();

          BookDisplayer.loading = true;
          BookDisplayer.active = _this;

          morphingBook.mesh.position.x = staticBook.mesh.position.x;
          morphingBook.mesh.position.y = staticBook.mesh.position.y;
          morphingBook.mesh.position.z = staticBook.mesh.position.z;

          morphingBook.mesh.rotation.x = staticBook.mesh.rotation.x;
          morphingBook.mesh.rotation.y = staticBook.mesh.rotation.y;
          morphingBook.mesh.rotation.z = staticBook.mesh.rotation.z;

          var i = 0;

          var success = function() {
            i++;
            if (i == 2) {
              open = true;
              bringOut(onComplete);
            }
          };

          bookshelf.library.requestCover(bookIndex,
              function(texUrl) {
                setFullsizeTexture(texUrl);
                success();
              },
              function() {
                showMessage(params.errorString);
                BookDisplayer.cancel();
              });


          /*$.ajax('https://www.googleapis.com/books/v1/volumes/' + bookInfo.id, {
                dataType: 'jsonp',
                success: function(data) {


                  if (!data.volumeInfo) {
                    showMessage(data.error.message);
                    BookDisplayer.cancel();
                    return;
                  }


                  onData.call(this, data);


                  makePages(data, aspect_ratio,
                      function(image) {
                        morphingBook.setPagesImage(image);
                        success();
                      }, function() {
                        showMessage(params.errorString);
                        BookDisplayer.cancel();
                      });
                }
              });*/

            console.log('book id:' +　bookInfo.id)
            onData.call(this, apiTest);
            makePages(apiTest, aspect_ratio,
                function(image) {
                    morphingBook.setPagesImage(image);
                    success();
                }, function() {
                    showMessage(params.errorString);
                    BookDisplayer.cancel();
                });
        };

        /**
         * Cancels opening.
         */
        this.cancel = function() {
          loadingFullsize = false;
          canceled = true;
          canceledBouncePosition = bouncePosition;
        };

        /**
         * Returns this book to the bookshelf.
         */
        this.close = function() {

          morphingBook.animate.clear();

          _this.closing = true;


          staticBook.mesh.visible = true;
          morphingBook.animate({
            from: { close: 0 },
            to: { close: 1 },
            duration: params.bookCloseTime,
            onUpdate: getOpenOnUpdate(staticBook.mesh, false),
            onComplete: function() {
              _this.closing = false;
            }
          });

          open = false;
          morphingBook.hide();
          morphingBook.opened = 0;

        };

        function bringOut(onComplete) {

          if (BookDisplayer.active != _this)  return;

//          morphingBook.setCoverTexture(fullsizeTexture);
          morphingBook.opened = 0;

          loadingFullsize = false;

          staticBook.mesh.visible = false;
          morphingBook.show();

          morphingBook.mesh.position.copy(_this.mesh.position);
          morphingBook.mesh.rotation.copy(_this.mesh.rotation);

          BookDisplayer.loading = false;
//          console.log("COMING OUT FOOL");

          morphingBook.animate({
            from: { cover: 0 },
            to: { cover: 1 },
            duration: params.bookOpenTime,
            onUpdate: getOpenOnUpdate(morphingBook.mesh, true),
            onComplete: function() {
              _this.comingOut = false;
              if (onComplete) {
                onComplete();
              }
            },
            onBegin: function() {

              _this.comingOut = true;
            }
          });

        }

        /**
         *
         * @param tex
         * @param bookIndex
         */
        function setCurrentTexture(tex, bookIndex) {
//          return;

          lasttex = tex;


          if (tex != undefined && bookIndex != undefined) {

            var count = CONFIG['spritesheet_count'];
            var spriteIndex = bookIndex % count;
            var rowscols = Math.sqrt(count);

            var tileSize = 1 / rowscols + params.tileSizeCorrect;

            var tileColumn = spriteIndex % rowscols;
            var tileRow = Math.floor(spriteIndex / rowscols);


            staticBook.tileSize = tileSize;
            staticBook.tileRow = tileRow;
            staticBook.tileColumn = tileColumn;
          staticBook.clearTint();

          } else {

            staticBook.tileSize = 1;
            staticBook.tileRow = 0;
            staticBook.tileColumn = 0;

          }

//          if (tex) {
//            setTimeout(function() {
//              scale.value = 0.8;
              staticBook.setTexture(tex || BookDisplayer.DEFAULT_TEXTURE);
//            }, spriteIndex * 10);
//          } else {
//            staticBook.setTexture(tex || BookDisplayer.DEFAULT_TEXTURE);
//          }

        }


        /**
         * Creates an onUpdate style function defining the animation curve of
         * this book towards or away from the camera.
         * @param {THREE.Mesh} mesh StaticBook or MorphingBook, the book to
         * move.
         * @param {Boolean} comingOffShelf True if opening.
         */
        function getOpenOnUpdate(mesh, comingOffShelf) {

          var distance = camera.position.distanceTo(camera.target.position);

          var i = params.openDistance / distance;

          var openPositionFinal;

          if (comingOffShelf) {
            openPositionFinal = new THREE.Vector3(
                utils.lerp(camera.position.x, camera.target.position.x, i),
                utils.lerp(camera.position.y, camera.target.position.y, i),
                utils.lerp(camera.position.z, camera.target.position.z, i));
          } else {
            openPositionFinal = new THREE.Vector3(morphingBook.mesh.position.x,
                morphingBook.mesh.position.y, morphingBook.mesh.position.z);
          }

          var openRotationMatrix = new THREE.Matrix4();

          var targetRotation = new THREE.Vector3();

          openRotationMatrix.lookAt(openPositionFinal, camera.position, camera.up);
          targetRotation.setRotationFromMatrix(openRotationMatrix);

          var startDist = utils.dist(
              _this.restPosition.x, _this.restPosition.z, 0, 0);
          var targetDist = utils.dist(
              openPositionFinal.x, openPositionFinal.z, 0, 0);

          _this.targetAngle = Math.atan2(openPositionFinal.x, openPositionFinal.z);
          _this.startAngle = Math.atan2(_this.restPosition.x, _this.restPosition.z);

          var angleDifference = _this.targetAngle - _this.startAngle;
          var sign = utils.sign(angleDifference);

          while (Math.abs(angleDifference) > Math.PI) {
            _this.targetAngle += -sign * Math.PI * 2;
            angleDifference = _this.targetAngle - _this.startAngle;
          }

          return openOnUpdate = function(values, t) {

            _this.fullyOut = comingOffShelf && t == 1;

            // Don't let people open this while its coming in
            morphingBook.opened = 0;

            var rt;

            if (comingOffShelf) {
              t = Easing.Exponential.EaseOut(t);
              rt = Easing.Exponential.EaseOut(t);
            } else {
              var bt = 1 - t;
              t = Easing.Exponential.EaseIn(bt);
              rt = Easing.Exponential.EaseIn(bt);
            }

            var angle = utils.lerp(_this.startAngle, _this.targetAngle, t);
            var dist = utils.lerp(startDist, targetDist, t);

            mesh.position.x = Math.sin(angle) * dist;
            mesh.position.y = utils.lerp(
                _this.restPosition.y, openPositionFinal.y, Easing.Cubic.EaseIn(t));
            mesh.position.z = Math.cos(angle) * dist;

            mesh.rotation.y = utils.lerp(
                _this.startAngle + params.bookTwist - Math.PI / 2,
                _this.targetAngle,
                rt);
            mesh.updateMatrix();

          };

        }

      };

  BookDisplayer.active = null;

  BookDisplayer.cancel = function() {
    if (BookDisplayer.active != null) {
      if (BookDisplayer.active.fullyOut || BookDisplayer.active.comingOut) {
        BookDisplayer.active.close();
      }
      BookDisplayer.active.cancel();
    }
    BookDisplayer.active = null;
    BookDisplayer.loadingID = '';
    BookDisplayer.loading = false;
  };

  BookDisplayer.DEFAULT_TEXTURE =
      THREE.ImageUtils.loadTexture('textures/blue.jpg');

  return BookDisplayer;

});

define('dat/mahog/SpiralShelf',[
    'dat/mahog/params',
    'dat/mahog/utils',
    'dat/utils/urlArgs'
  ], function(params, utils, urlArgs) {

    /**
     * Returns a SpiralShelf mesh to be added to the scene.
     *
     * @param {THREE.PointLight} Point Light.
     * @param {THREE.DirectionalLight} Directional Light.
     * @param {THREE.AmbientLight} Ambient Light.
     * @param {Object} all other options to override params.
     */
    var SpiralShelf = function(
      ambientLight,
      directionalLight,
      pointLight,
      options) {

      var _this = this;
      var geometry = new THREE.Geometry(),
        material, h, i, j, k,
        bones = 0;

      var shininess = 2;

      var nextPOT = function ( value ) { var pot = 1; while ( pot < value ) pot <<= 1; return pot; };

      var tex = THREE.ImageUtils.loadTexture(params.SHELF_TEXTURE, new THREE.UVMapping(), function () {

        var canvas = document.createElement( 'canvas' );
        canvas.width = nextPOT( tex.image.width );
        canvas.height = nextPOT( tex.image.height );

        canvas.getContext( '2d' ).drawImage( tex.image, 0, 0, tex.image.width, tex.image.height, 0, 0, canvas.width, canvas.height );

        tex.image = canvas;

      });

      /*
      var normals = THREE.ImageUtils.loadTexture(params.SHELF_NORMALS, new THREE.UVMapping(), function () {

        var canvas = document.createElement( 'canvas' );
        canvas.width = nextPOT( normals.image.width );
        canvas.height = nextPOT( normals.image.height );

        canvas.getContext( '2d' ).drawImage( normals.image, 0, 0, normals.image.width, normals.image.height, 0, 0, canvas.width, canvas.height );

        normals.image = canvas;

      });
      */

      // Public Vars
      this.mesh = {};

      // override default paramaters if desired

      if (options) {

        for (var property in options) {

          params[property] = options[property];

        }

      }

      function computeMesh() {

        if (urlArgs['installation'] === '1' || urlArgs['installation_debug'] === '1') {
          params.orbits *= 3;
        }

        material = new THREE.MeshPhongMaterial({ map: tex, shading: THREE.SmoothShading });

//                var shader = THREE.ShaderUtils.lib[ "normal" ];
//                var uniforms = THREE.UniformsUtils.clone( shader.uniforms );
//
//                uniforms[ "tNormal" ].texture = normals;
//                uniforms[ "uNormalScale" ].value = - 0.75;
//
//                uniforms[ "tDiffuse" ].texture = THREE.ImageUtils.loadTexture( "obj/leeperrysmith/Map-COL.jpg" );
//
//                uniforms[ "enableAO" ].value = false;
//                uniforms[ "enableDiffuse" ].value = true;
//                uniforms[ "enableSpecular" ].value = false;
//
//                uniforms[ "uDiffuseColor" ].value.setHex( diffuse );
//                uniforms[ "uSpecularColor" ].value.setHex( specular );
//                uniforms[ "uAmbientColor" ].value.setHex( ambient );
//
//                uniforms[ "uShininess" ].value = shininess;
//
//                parameters = { fragmentShader: shader.fragmentShader, vertexShader: shader.vertexShader, uniforms: uniforms, lights: true };
//                 material = new THREE.MeshShaderMaterial( parameters );

        var bones = 0;

        var initial = -params.orbits / 2;
        var limit = params.orbits / 2;
        var step = Math.PI * 2 / params.shelfResolution;

        for (var angle = initial; angle <= limit; angle += step) {

          var amplitude = params.spiralRadius - params.shelfDepth / 2;

          var xa = Math.cos(angle) * amplitude;
          var ya = utils.orbitToY(angle) + params.shelfThickness / 2;
          var za = Math.sin(angle) * amplitude;

          amplitude = (params.spiralRadius + params.shelfDepth / 2);

          var xb = Math.cos(angle) * amplitude;
          var yb = utils.orbitToY(angle) + params.shelfThickness / 2;
          var zb = Math.sin(angle) * amplitude;

          amplitude = (params.spiralRadius + params.shelfDepth / 2);

          var xc = Math.cos(angle) * amplitude;
          var yc = utils.orbitToY(angle) - params.shelfThickness / 2;
          var zc = Math.sin(angle) * amplitude;

          amplitude = (params.spiralRadius - params.shelfDepth / 2);

          var xd = Math.cos(angle) * amplitude;
          var yd = utils.orbitToY(angle) - params.shelfThickness / 2;
          var zd = Math.sin(angle) * amplitude;

          var a = new THREE.Vector3(xa, ya, za);
          var b = new THREE.Vector3(xb, yb, zb);
          var c = new THREE.Vector3(xc, yc, zc);
          var d = new THREE.Vector3(xd, yd, zd);

          geometry.vertices.push(new THREE.Vertex(a));
          geometry.vertices.push(new THREE.Vertex(b));
          geometry.vertices.push(new THREE.Vertex(c));
          geometry.vertices.push(new THREE.Vertex(d));

          var points = geometry.vertices.length;


          var to = (bones % params.topTextureSpan) / params.topTextureSpan;
          var ts = to + 1 / params.topTextureSpan;

          var so = (bones % params.sideTextureSpan) / params.sideTextureSpan;
          var ss = so + 1 / params.sideTextureSpan;



          if (points > 7) {

            var a = points - 4;
            var b = points - 3;
            var c = points - 2;
            var d = points - 1;


            var aNormal = geometry.vertices[a].position.clone().normalize().negate();
            var bNormal = geometry.vertices[b].position.clone().normalize();
            var cNormal = geometry.vertices[c].position.clone().normalize();
            var dNormal = geometry.vertices[d].position.clone().normalize().negate();

            var h = points - 8;
            var i = points - 7;
            var j = points - 6;
            var k = points - 5;

            var hNormal = geometry.vertices[h].position.clone().normalize().negate();
            var iNormal = geometry.vertices[i].position.clone().normalize();
            var jNormal = geometry.vertices[j].position.clone().normalize();
            var kNormal = geometry.vertices[k].position.clone().normalize().negate();

            if (params.outsideFace) {
              geometry.faces.push(new THREE.Face4(i, b, c, j, [ iNormal, bNormal, cNormal, jNormal]));
              geometry.faceVertexUvs[0].push([
                new THREE.UV(0, so),
                new THREE.UV(0, ss),
                new THREE.UV(1, ss),
                new THREE.UV(1, so)]);
            }

            var up = new THREE.Vector3(0,1,0);

            if (params.topFace) {
              geometry.faces.push(new THREE.Face4(h, a, b, i, [ up, up, up, up ]));
              geometry.faceVertexUvs[0].push([
                new THREE.UV(1, to),
                new THREE.UV(1, ts),
                new THREE.UV(0, ts),
                new THREE.UV(0, to)]);
            }

            if (params.insideFace) {
              geometry.faces.push(new THREE.Face4(k, d, a, h, [ kNormal, dNormal, aNormal, hNormal ]));
              geometry.faceVertexUvs[0].push([
                new THREE.UV(0, so),
                new THREE.UV(0, ss),
                new THREE.UV(1, ss),
                new THREE.UV(1, so)]);
            }
            var down = new THREE.Vector3(0,-1,0);


            if (params.bottomFace) {
              geometry.faces.push(new THREE.Face4(j, c, d, k, [down, down, down, down]));
              geometry.faceVertexUvs[0].push([
                new THREE.UV(0, to),
                new THREE.UV(0, ts),
                new THREE.UV(1, ts),
                new THREE.UV(1, to)]);
            }
          }
          bones++;

        }


        _this.mesh = new THREE.Mesh(geometry, material);

      }

      computeMesh();

    };

    return SpiralShelf;

});
define('text!dat/mahog/pre.html', function () { return '<h6>You are currently looking:</h6>';});
define('text!dat/mahog/post.html', function () { return '<a href="#">浏览分类</a>';});

define('dat/mahog/DomLabelManager',[
  'dat/mahog/params',
  'text!dat/mahog/pre.html',
  'text!dat/mahog/post.html',
  'dat/utils/urlArgs',
  'underscore',
  'jquery'
], function(params, preHTML, postHTML, urlArgs) {

    var LabelManager = function(data, bookshelf, genreOverlay) {

      var _this = this;

      var $dom = $('<div id="label-manager" style="display: none; top: -250px;" />')
        .appendTo('#content');
      var $active = $('<div id="active-genre-element"/>')
        .appendTo($dom);

      var $ul, $frame;

      var names = _.pluck(data, 'name');
      var prevActive = 'Travel';
      var pindex = 0;
      var m = 0, timer = null, aTimer = null;
      if (urlArgs['installation'] != undefined ||
          urlArgs['installation_debug'] != undefined) {
        m = $(window).height()/2.0;//1155;
      }

      this.hidden = true;

      this.update = function() {
        handleActiveElem();
      };

      this.fadeOut = function() {
        var margin = m - 250;
        $dom.css({
          marginTop: margin,
          opacity: 0.0
        });
        $frame
          .css({
            marginTop: margin,
            opacity: 0.0
          });
        if (!_.isNull(timer)) {
          clearTimeout(timer);
        }
        timer = setTimeout(function() {
          $dom.css('display', 'none');
          $frame.css('display', 'none');
          timer = null;
          _this.hidden = true;
        }, 350);
      };

      this.fadeIn = function() {
        $dom
          .css({
            display: 'block',
            opacity: 0.0,
            marginTop: m - 250
          });
        $frame
          .css({
            display: 'block',
            opacity: 0.0,
            marginTop: m - 250
          });

        _.defer(function() {
          $dom
            .css({
              marginTop: m,
              opacity: 1.0
            });
          $frame
            .css({
              marginTop: m,
              opacity: 1.0
            });
            _this.hidden = false;
        });
      };

      function handleActiveElem() {

        var curGenre = bookshelf.getCurrentGenre();

        if (curGenre !== prevActive) {
          var index = _.indexOf(names, curGenre);
          var $li = $ul.find('li');
          var margin =  - (index * 50) - 60;
          var duration = 350;
          var di = index - pindex
          var absDi = Math.abs(di);

          if (absDi >= names.length - 1) {
            margin = - (pindex * 50) - 60;
            if (di < 0) {
              margin -= 50;
            } else {
              margin += 50;
            }
            if (!_.isNull(aTimer)) {
              clearTimeout(aTimer);
            }
            aTimer = setTimeout(function() {
              var margin = - (index * 50) - 60;
              $ul
              .css({
                '-webkit-transition': 'all ' + 0 + 'ms cubic-bezier(0.785, 0.135, 0.150, 0.860)',
                '-moz-transition': 'all ' + 0 + 'ms cubic-bezier(0.785, 0.135, 0.150, 0.860)',
                '-ms-transition': 'all ' + 0 + 'ms cubic-bezier(0.785, 0.135, 0.150, 0.860)',
                '-o-transition': 'all ' + 0 + 'ms cubic-bezier(0.785, 0.135, 0.150, 0.860)',
                'transition': 'all ' + 0 + 'ms cubic-bezier(0.785, 0.135, 0.150, 0.860)',
                marginTop: margin
              })
              aTimer = null;
            }, duration);
          } else if (absDi > 3) {
            duration = params.cameraPositionDriftLength;
          }
          $ul
            .css({
              '-webkit-transition': 'all ' + duration + 'ms cubic-bezier(0.785, 0.135, 0.150, 0.860)',
              '-moz-transition': 'all ' + duration + 'ms cubic-bezier(0.785, 0.135, 0.150, 0.860)',
              '-ms-transition': 'all ' + duration + 'ms cubic-bezier(0.785, 0.135, 0.150, 0.860)',
              '-o-transition': 'all ' + duration + 'ms cubic-bezier(0.785, 0.135, 0.150, 0.860)',
              'transition': 'all ' + duration + 'ms cubic-bezier(0.785, 0.135, 0.150, 0.860)',
              marginTop: margin
            })
            .children('li')
              .removeClass('active')
              .eq(index + 1)
                .addClass('active');
          prevActive = curGenre;
          pindex = index;
        }
      }

      function setup() {

        var domFrag = '<ul>';

        _.each(names.reverse(), function(name) {
          domFrag += '<li name="' + name + '"><span>' + name + '</span></li>';
        });
        domFrag += '</ul>';

        var $win = $(window);

        $frame = $('<div class="frame" />')
          .width(227)
          .height(40)
          .css({
            position: 'fixed',
            marginTop: m
          })
          .appendTo($dom)
          .bind('mouseover mouseenter', function() {
            $ul.find('.active').html('浏览分类');
          })
          .bind('mouseout mouseleave', function() {
            var $li = $ul.find('.active');
            $li.html('<span>' + $li.attr('name') + '</span>');
          })
          .click(function(e) {
            e.preventDefault();
            genreOverlay.show();
          });

        $active.html(domFrag);
        $ul = $active.find('ul');
        $win.resize(function() {
            $dom
              .css({
                left: ($win.width() - $dom.outerWidth()) / 2
              });
            $frame
              .css({
                top: 12,
                left: ($win.width() - $frame.outerWidth()) / 2
              })
          })
          .trigger('resize');
        $dom
          .css({
            top: 22,
            marginTop: m
          });

        $ul.find('li').eq(0).clone().appendTo($ul);
        $ul.find('li').eq(names.length - 1).clone().prependTo($ul);

      }

      setup();

    };

    return LabelManager;

});

define('dat/mahog/Genre2DOverlay',[
  'dat/mahog/params',
  'dat/utils/urlArgs',
  'dat/mahog/CONFIG',
  'dat/utils/utils',
  'jquery',
  'underscore'
], function(params, urlArgs, CONFIG, datutils) {

  return function(genreInfo, onClickGenre, bookshelfDom) {

    var _this = this;

    // Override options
    var options = { columns: 3 };

    var closebutton = document.createElement('div');
    closebutton.setAttribute('class', 'closebutton');

    // Create all our DOM Elements
    var shell = document.createElement('div');
    shell.setAttribute('id', 'genre-2d');

    // Create all the HTML insides via a string that will be appended
    // as innerHTML
    var overlay = '<div class=\'container\'>';

    // Set defaults here.
    var header = '';
    var slogan = '<h1>选择一个类别:</h1><div class=\'decoration two-thirds\'></div>';
    var footer = '<footer>The helix includes ' + CONFIG.count + ' books, and was last updated on September 19, 2011.</footer>';

    if (urlArgs['installation'] !== undefined) {
      header = '<h5 class=\'pre-heading\'>Project</h5>' +
        '<h1>' + params.projectTitle + '</h1>';
      slogan =   '<h3 class=\'post-heading\'>' +
          params.projectDescription + '</h3>' +
          '<div class=\'decoration two-thirds\'></div>';
      footer = '<footer>' + params.smallPrint + '</footer>';
    }

    header += slogan;
    var genres = '<div class=\'body\'>';

    // Mark up the data

    var rows = Math.ceil(genreInfo.length / options.columns);

    for (var i = 0; i < options.columns; i++) {

      var ul = '<ul>';
      var frag = '';

      for (var j = 0; j < rows; j++) {

        var genre = genreInfo[i * rows + j];

        if (genre) {
          var content = '<span class = \'name\'>' + genre.name +
            '</span> <span class = \'count\'>' + genre.count + '</span>';

          frag += '<li>' + content + '</li>';
        }
      }
      ul += frag + '</ul>';
      genres += ul;
    }

    genres += '<div class=\'clear\'></div></div>' +
      '<div class=\'decoration three-quarters\'></div>';
    $('body').append(shell);

    // Append in order: head, body, foot

    overlay += header + genres + footer + '</div>';

    shell.innerHTML = overlay;
    shell.appendChild(closebutton);
    var close = $(closebutton);

    close.click(function() {
      _this.hide();
    });

    var container = $(shell);
    shell.style.display = 'block';
    container.hide();

    // $('ul').width($(overlay).width() / options.columns);

    $('li').click(function(e) {

      var title = $(this).find('.name').html();
      e.preventDefault();
      e.stopPropagation();
      onClickGenre(title);
      _this.hide();
    });

    this.domElement = shell;

    // Somehow getting called on click ?
    this.hide = function() {

      container.css('opacity', '0.0');
      close.fadeOut();
      setTimeout(function() {
        open = false;
        container.css('display', 'none');
      }, 500);
    };

    var open = false;
    container.css('top', window.innerHeight / 2 - container.outerHeight() / 2);

    this.__defineGetter__('showing', function() {
      return open;
    });

    this.show = function() {

      if (open) return;
      open = true;

      container.css('display', 'block');

      var y = window.innerHeight / 2 - container.outerHeight() / 2;

      $(window).resize(handleWindowResize);

      container.css('opacity', '1.0');
      setTimeout(function() {

        var $overlay = $('.container');
        var overlayWidth = $overlay.width();
        var overlayOffsetLeft = $overlay.position().left;
        var overlayOffsetTop = $overlay.position().top;

        close.css({
          left: overlayOffsetLeft + overlayWidth - close.width() / 2.0,
          top: overlayOffsetTop - close.height() / 2.0
        });

        close.fadeIn();
      }, 500);

    };

    function handleWindowResize() {

      var y = (window.innerHeight - container.outerHeight()) / 2.0;

      container.css('top', y);

      var $overlay = $('.container');
      var overlayWidth = $overlay.width();
      var overlayOffsetLeft = $overlay.position().left;
      var overlayOffsetTop = $overlay.position().top;

      close.css({
        left: overlayOffsetLeft + overlayWidth - close.width() / 2.0,
        top: overlayOffsetTop - close.height() / 2.0
      });
    }

  }

});
define('text!dat/mahog/data/categories.json', function () { return '[{"count": 98, "name": "Bestsellers"}, {"count": 283, "name": "Biographies and Memoirs"}, {"count": 157, "name": "Business and Investing"}, {"count": 125, "name": "Childrens Books"}, {"count": 86, "name": "Computers and Internet"}, {"count": 254, "name": "Cooking Food and Wine"}, {"count": 192, "name": "Fantasy"}, {"count": 788, "name": "Fiction"}, {"count": 511, "name": "Free Books"}, {"count": 4153, "name": "General"}, {"count": 855, "name": "Highly Cited"}, {"count": 87, "name": "History"}, {"count": 71, "name": "Humor"}, {"count": 212, "name": "Lifestyle and Home"}, {"count": 29, "name": "Movie Inspirations"}, {"count": 210, "name": "Mystery and Thrillers"}, {"count": 116, "name": "NYT Bestsellers"}, {"count": 741, "name": "New Arrivals"}, {"count": 70, "name": "Parenting and Families"}, {"count": 77, "name": "Politics and Current Events"}, {"count": 112, "name": "Reference"}, {"count": 139, "name": "Religion and Spirituality"}, {"count": 282, "name": "Romance"}, {"count": 73, "name": "Science"}, {"count": 122, "name": "Science Fiction"}, {"count": 220, "name": "Sports"}, {"count": 561, "name": "Top Rated"}, {"count": 341, "name": "Travel"}]';});

/**
 * @license RequireJS order 0.25.0 Copyright (c) 2010-2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
/*jslint nomen: false, plusplus: false, strict: false */
/*global require: false, define: false, window: false, document: false,
  setTimeout: false */

(function () {
    //Sadly necessary browser inference due to differences in the way
    //that browsers load and execute dynamically inserted javascript
    //and whether the script/cache method works.
    //Currently, Gecko and Opera do not load/fire onload for scripts with
    //type="script/cache" but they execute injected scripts in order
    //unless the 'async' flag is present.
    //However, this is all changing in latest browsers implementing HTML5
    //spec. Firefox nightly supports using the .async true by default, and
    //if false, then it will execute in order. Favor that test first for forward
    //compatibility. However, it is unclear if webkit/IE will follow suit.
    //Latest webkit breaks the script/cache trick.
    //Test for document and window so that this file can be loaded in
    //a web worker/non-browser env. It will not make sense to use this
    //plugin in a non-browser env, but the file should not error out if included
    //in a file, then loaded in a non-browser env.
    var supportsInOrderExecution = typeof document !== "undefined" &&
                                   typeof window !== "undefined" &&
                                   (document.createElement("script").async ||
                               (window.opera && Object.prototype.toString.call(window.opera) === "[object Opera]") ||
                               //If Firefox 2 does not have to be supported, then
                               //a better check may be:
                               //('mozIsLocallyAvailable' in window.navigator)
                               ("MozAppearance" in document.documentElement.style)),
        readyRegExp = /^(complete|loaded)$/,
        waiting = [],
        cached = {};

    function loadResource(name, req, onLoad) {
        req([name], function (value) {
            //The value may be a real defined module. Wrap
            //it in a function call, because this function is used
            //as the factory function for this ordered dependency.
            onLoad(function () {
                return value;
            });
        });
    }

    //Callback used by the type="script/cache" callback that indicates a script
    //has finished downloading.
    function scriptCacheCallback(evt) {
        var node = evt.currentTarget || evt.srcElement, i,
            moduleName, resource;

        if (evt.type === "load" || readyRegExp.test(node.readyState)) {
            //Pull out the name of the module and the context.
            moduleName = node.getAttribute("data-requiremodule");

            //Mark this cache request as loaded
            cached[moduleName] = true;

            //Find out how many ordered modules have loaded
            for (i = 0; (resource = waiting[i]); i++) {
                if (cached[resource.name]) {
                    loadResource(resource.name, resource.req, resource.onLoad);
                } else {
                    //Something in the ordered list is not loaded,
                    //so wait.
                    break;
                }
            }

            //If just loaded some items, remove them from waiting.
            if (i > 0) {
                waiting.splice(0, i);
            }

            //Remove this script tag from the DOM
            //Use a setTimeout for cleanup because some older IE versions vomit
            //if removing a script node while it is being evaluated.
            setTimeout(function () {
                node.parentNode.removeChild(node);
            }, 15);
        }
    }

   define('order',{
        version: '0.25.0',

        load: function (name, req, onLoad, config) {
            var url = req.nameToUrl(name, null);

            //If a build, just load the module as usual.
            if (config.isBuild) {
                loadResource(name, req, onLoad);
                return;
            }

            //Make sure the async attribute is not set for any pathway involving
            //this script.
            require.s.skipAsync[url] = true;
            if (supportsInOrderExecution) {
                //Just a normal script tag append, but without async attribute
                //on the script.
                req([name], function (value) {
                    //The value may be a real defined module. Wrap
                    //it in a function call, because this function is used
                    //as the factory function for this ordered dependency.
                    onLoad(function () {
                        return value;
                    });
                });
            } else {
                //Credit to LABjs author Kyle Simpson for finding that scripts
                //with type="script/cache" allow scripts to be downloaded into
                //browser cache but not executed. Use that
                //so that subsequent addition of a real type="text/javascript"
                //tag will cause the scripts to be executed immediately in the
                //correct order.
                if (req.specified(name)) {
                    req([name], function (value) {
                        //The value may be a real defined module. Wrap
                        //it in a function call, because this function is used
                        //as the factory function for this ordered dependency.
                        onLoad(function () {
                            return value;
                        });
                    });
                } else {
                    waiting.push({
                        name: name,
                        req: req,
                        onLoad: onLoad
                    });
                    require.attach(url, null, name, scriptCacheCallback, "script/cache");
                }
            }
        }
    });
}());

// stats.js r5 - http://github.com/mrdoob/stats.js
var Stats=function(){function w(d,K,n){var u,f,c;for(f=0;f<30;f++)for(u=0;u<73;u++){c=(u+f*74)*4;d[c]=d[c+4];d[c+1]=d[c+5];d[c+2]=d[c+6]}for(f=0;f<30;f++){c=(73+f*74)*4;if(f<K){d[c]=b[n].bg.r;d[c+1]=b[n].bg.g;d[c+2]=b[n].bg.b}else{d[c]=b[n].fg.r;d[c+1]=b[n].fg.g;d[c+2]=b[n].fg.b}}}var v=0,x=2,e,y=0,l=(new Date).getTime(),J=l,z=l,o=0,A=1E3,B=0,m,g,a,p,C,q=0,D=1E3,E=0,h,i,r,F,s=0,G=1E3,H=0,j,k,t,I,b={fps:{bg:{r:16,g:16,b:48},fg:{r:0,g:255,b:255}},ms:{bg:{r:16,g:48,b:16},fg:{r:0,g:255,b:0}},mem:{bg:{r:48,
g:16,b:26},fg:{r:255,g:0,b:128}}};e=document.createElement("div");e.style.cursor="pointer";e.style.width="80px";e.style.opacity="0.9";e.style.zIndex="10001";e.addEventListener("click",function(){v++;v==x&&(v=0);m.style.display="none";h.style.display="none";j.style.display="none";switch(v){case 0:m.style.display="block";break;case 1:h.style.display="block";break;case 2:j.style.display="block"}},false);m=document.createElement("div");m.style.backgroundColor="rgb("+Math.floor(b.fps.bg.r/2)+","+Math.floor(b.fps.bg.g/
2)+","+Math.floor(b.fps.bg.b/2)+")";m.style.padding="2px 0px 3px 0px";e.appendChild(m);g=document.createElement("div");g.style.fontFamily="Helvetica, Arial, sans-serif";g.style.textAlign="left";g.style.fontSize="9px";g.style.color="rgb("+b.fps.fg.r+","+b.fps.fg.g+","+b.fps.fg.b+")";g.style.margin="0px 0px 1px 3px";g.innerHTML='<span style="font-weight:bold">FPS</span>';m.appendChild(g);a=document.createElement("canvas");a.width=74;a.height=30;a.style.display="block";a.style.marginLeft="3px";m.appendChild(a);
p=a.getContext("2d");p.fillStyle="rgb("+b.fps.bg.r+","+b.fps.bg.g+","+b.fps.bg.b+")";p.fillRect(0,0,a.width,a.height);C=p.getImageData(0,0,a.width,a.height);h=document.createElement("div");h.style.backgroundColor="rgb("+Math.floor(b.ms.bg.r/2)+","+Math.floor(b.ms.bg.g/2)+","+Math.floor(b.ms.bg.b/2)+")";h.style.padding="2px 0px 3px 0px";h.style.display="none";e.appendChild(h);i=document.createElement("div");i.style.fontFamily="Helvetica, Arial, sans-serif";i.style.textAlign="left";i.style.fontSize=
"9px";i.style.color="rgb("+b.ms.fg.r+","+b.ms.fg.g+","+b.ms.fg.b+")";i.style.margin="0px 0px 1px 3px";i.innerHTML='<span style="font-weight:bold">MS</span>';h.appendChild(i);a=document.createElement("canvas");a.width=74;a.height=30;a.style.display="block";a.style.marginLeft="3px";h.appendChild(a);r=a.getContext("2d");r.fillStyle="rgb("+b.ms.bg.r+","+b.ms.bg.g+","+b.ms.bg.b+")";r.fillRect(0,0,a.width,a.height);F=r.getImageData(0,0,a.width,a.height);try{if(performance&&performance.memory&&performance.memory.totalJSHeapSize)x=
3}catch(L){}j=document.createElement("div");j.style.backgroundColor="rgb("+Math.floor(b.mem.bg.r/2)+","+Math.floor(b.mem.bg.g/2)+","+Math.floor(b.mem.bg.b/2)+")";j.style.padding="2px 0px 3px 0px";j.style.display="none";e.appendChild(j);k=document.createElement("div");k.style.fontFamily="Helvetica, Arial, sans-serif";k.style.textAlign="left";k.style.fontSize="9px";k.style.color="rgb("+b.mem.fg.r+","+b.mem.fg.g+","+b.mem.fg.b+")";k.style.margin="0px 0px 1px 3px";k.innerHTML='<span style="font-weight:bold">MEM</span>';
j.appendChild(k);a=document.createElement("canvas");a.width=74;a.height=30;a.style.display="block";a.style.marginLeft="3px";j.appendChild(a);t=a.getContext("2d");t.fillStyle="#301010";t.fillRect(0,0,a.width,a.height);I=t.getImageData(0,0,a.width,a.height);return{domElement:e,update:function(){y++;l=(new Date).getTime();q=l-J;D=Math.min(D,q);E=Math.max(E,q);w(F.data,Math.min(30,30-q/200*30),"ms");i.innerHTML='<span style="font-weight:bold">'+q+" MS</span> ("+D+"-"+E+")";r.putImageData(F,0,0);J=l;if(l>
z+1E3){o=Math.round(y*1E3/(l-z));A=Math.min(A,o);B=Math.max(B,o);w(C.data,Math.min(30,30-o/100*30),"fps");g.innerHTML='<span style="font-weight:bold">'+o+" FPS</span> ("+A+"-"+B+")";p.putImageData(C,0,0);if(x==3){s=performance.memory.usedJSHeapSize*9.54E-7;G=Math.min(G,s);H=Math.max(H,s);w(I.data,Math.min(30,30-s/2),"mem");k.innerHTML='<span style="font-weight:bold">'+Math.round(s)+" MEM</span> ("+Math.round(G)+"-"+Math.round(H)+")";t.putImageData(I,0,0)}z=l;y=0}}}};


define("stats", function(){});

/**
 * Provides requestAnimationFrame in a cross browser way.
 * http://paulirish.com/2011/requestanimationframe-for-smart-animating/
 */

if ( !window.requestAnimationFrame ) {

	window.requestAnimationFrame = ( function() {

		return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		window.msRequestAnimationFrame ||
		function( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element ) {

			window.setTimeout( callback, 1000 / 60 );

		};

	} )();

}

define("RequestAnimationFrame", function(){});

/**
 * dat.gui Javascript Controller Library
 * http://dataarts.github.com/dat.gui
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */
var dat=dat||{};
dat.GUI=function(a){a==void 0&&(a={});var b=!1;a.height==void 0?a.height=300:b=!0;var d=[],c=[],i=!0,f,h,j=this,g=!0,e=280;if(a.width!=void 0)e=a.width;var q=!1,k,p,n=0,r;this.domElement=document.createElement("div");this.domElement.setAttribute("class","guidat");this.domElement.style.width=e+"px";var l=a.height,m=document.createElement("div");m.setAttribute("class","guidat-controllers");m.style.height=l+"px";m.addEventListener("DOMMouseScroll",function(a){var b=this.scrollTop;a.wheelDelta?b+=a.wheelDelta:
a.detail&&(b+=a.detail);a.preventDefault&&a.preventDefault();a.returnValue=!1;m.scrollTop=b},!1);var o=document.createElement("a");o.setAttribute("class","guidat-toggle");o.setAttribute("href","#");o.innerHTML=g?"Close Controls":"Open Controls";var t=!1,C=0,x=0,u=!1,v,y,w,z,D=function(a){y=v;z=w;v=a.pageY;w=a.pageX;a=v-y;if(!g)if(a>0)g=!0,l=k=1,o.innerHTML=p||"Close Controls";else return;var b=z-w;if(a>0&&l>h){var d=dat.GUI.map(l,h,h+100,1,0);a*=d}t=!0;C+=a;k+=a;l+=a;m.style.height=k+"px";x+=b;e+=
b;e=dat.GUI.constrain(e,240,500);j.domElement.style.width=e+"px";A()};o.addEventListener("mousedown",function(a){y=v=a.pageY;z=w=a.pageX;u=!0;a.preventDefault();C=x=0;document.addEventListener("mousemove",D,!1);return!1},!1);o.addEventListener("click",function(a){a.preventDefault();return!1},!1);document.addEventListener("mouseup",function(a){u&&!t&&j.toggle();if(u&&t)if(x==0&&B(),k>h)clearTimeout(r),k=n=h,s();else if(m.children.length>=1){var b=m.children[0].offsetHeight;clearTimeout(r);n=Math.round(l/
b)*b-1;n<=0?(j.close(),k=b*2):(k=n,s())}document.removeEventListener("mousemove",D,!1);a.preventDefault();return u=t=!1},!1);this.domElement.appendChild(m);this.domElement.appendChild(o);if(a.domElement)a.domElement.appendChild(this.domElement);else if(dat.GUI.autoPlace){if(dat.GUI.autoPlaceContainer==null)dat.GUI.autoPlaceContainer=document.createElement("div"),dat.GUI.autoPlaceContainer.setAttribute("id","guidat"),document.body.appendChild(dat.GUI.autoPlaceContainer);dat.GUI.autoPlaceContainer.appendChild(this.domElement)}this.autoListenIntervalTime=
1E3/60;var E=function(){f=setInterval(function(){j.listen()},this.autoListenIntervalTime)};this.__defineSetter__("autoListen",function(a){(i=a)?c.length>0&&E():clearInterval(f)});this.__defineGetter__("autoListen",function(){return i});this.listenTo=function(a){c.length==0&&E();c.push(a)};this.unlistenTo=function(a){for(var b=0;b<c.length;b++)c[b]==a&&c.splice(b,1);c.length<=0&&clearInterval(f)};this.listen=function(a){var a=a||c,b;for(b in a)a[b].updateDisplay()};this.listenAll=function(){this.listen(d)};
this.autoListen=!0;var F=function(a,b){function d(){return a.apply(this,b)}d.prototype=a.prototype;return new d};this.add=function(){if(arguments.length==1){var a=[],c;for(c in arguments[0])a.push(j.add(arguments[0],c));return a}a=arguments[0];c=arguments[1];a:for(var e in d)if(d[e].object==a&&d[e].propertyName==c)break a;e=a[c];if(e==void 0)dat.GUI.error(a+" either has no property '"+c+"', or the property is inaccessible.");else if(a=typeof e,e=G[a],e==void 0)dat.GUI.error("Cannot create controller for data type '"+
a+"'");else{for(var f=[this],g=0;g<arguments.length;g++)f.push(arguments[g]);if(e=F(e,f)){m.appendChild(e.domElement);d.push(e);dat.GUI.allControllers.push(e);a!="function"&&dat.GUI.saveIndex<dat.GUI.savedValues.length&&(e.setValue(dat.GUI.savedValues[dat.GUI.saveIndex]),dat.GUI.saveIndex++);A();q||(k=h);if(!b)try{if(arguments.callee.caller==window.onload)l=n=k=h,m.style.height=l+"px"}catch(i){}return e}else dat.GUI.error("Error creating controller for '"+c+"'.")}};var A=function(){h=0;for(var a in d)h+=
d[a].domElement.offsetHeight;m.style.overflowY=h-1>k?"auto":"hidden"},G={number:dat.GUI.ControllerNumber,string:dat.GUI.ControllerString,"boolean":dat.GUI.ControllerBoolean,"function":dat.GUI.ControllerFunction};this.reset=function(){};this.toggle=function(){g?this.close():this.open()};this.open=function(){o.innerHTML=p||"Close Controls";n=k;clearTimeout(r);s();B();g=!0};this.close=function(){o.innerHTML=p||"Open Controls";n=0;clearTimeout(r);s();B();g=!1};this.name=function(a){p=a;o.innerHTML=a};
this.appearanceVars=function(){return[g,e,k,m.scrollTop]};var s=function(){l=m.offsetHeight;l+=(n-l)*0.6;Math.abs(l-n)<1?l=n:r=setTimeout(s,1E3/30);m.style.height=Math.round(l)+"px";A()},B=function(){j.domElement.style.width=e-1+"px";setTimeout(function(){j.domElement.style.width=e+"px"},1)};if(dat.GUI.guiIndex<dat.GUI.savedAppearanceVars.length){e=parseInt(dat.GUI.savedAppearanceVars[dat.GUI.guiIndex][1]);j.domElement.style.width=e+"px";k=parseInt(dat.GUI.savedAppearanceVars[dat.GUI.guiIndex][2]);
q=!0;if(eval(dat.GUI.savedAppearanceVars[dat.GUI.guiIndex][0])==!0){var l=k,H=dat.GUI.savedAppearanceVars[dat.GUI.guiIndex][3];setTimeout(function(){m.scrollTop=H},0);if(dat.GUI.scrollTop>-1)document.body.scrollTop=dat.GUI.scrollTop;n=k;this.open()}dat.GUI.guiIndex++}dat.GUI.allGuis.push(this);if(dat.GUI.allGuis.length==1&&(window.addEventListener("keyup",function(a){!dat.GUI.supressHotKeys&&a.keyCode==72&&dat.GUI.toggleHide()},!1),dat.GUI.inlineCSS))a=document.createElement("style"),a.setAttribute("type",
"text/css"),a.innerHTML=dat.GUI.inlineCSS,document.head.insertBefore(a,document.head.firstChild)};dat.GUI.hidden=!1;dat.GUI.autoPlace=!0;dat.GUI.autoPlaceContainer=null;dat.GUI.allControllers=[];dat.GUI.allGuis=[];dat.GUI.supressHotKeys=!1;dat.GUI.toggleHide=function(){dat.GUI.hidden?dat.GUI.open():dat.GUI.close()};dat.GUI.open=function(){dat.GUI.hidden=!1;for(var a in dat.GUI.allGuis)dat.GUI.allGuis[a].domElement.style.display="block"};
dat.GUI.close=function(){dat.GUI.hidden=!0;for(var a in dat.GUI.allGuis)dat.GUI.allGuis[a].domElement.style.display="none"};dat.GUI.saveURL=function(){var a=dat.GUI.replaceGetVar("saveString",dat.GUI.getSaveString());window.location=a};dat.GUI.scrollTop=-1;dat.GUI.load=function(a){var a=a.split(","),b=parseInt(a[0]);dat.GUI.scrollTop=parseInt(a[1]);for(var d=0;d<b;d++){var c=a.splice(2,4);dat.GUI.savedAppearanceVars.push(c)}dat.GUI.savedValues=a.splice(2,a.length)};dat.GUI.savedValues=[];
dat.GUI.savedAppearanceVars=[];dat.GUI.getSaveString=function(){var a=[],b;a.push(dat.GUI.allGuis.length);a.push(document.body.scrollTop);for(b in dat.GUI.allGuis)for(var d=dat.GUI.allGuis[b].appearanceVars(),c=0;c<d.length;c++)a.push(d[c]);for(b in dat.GUI.allControllers)dat.GUI.allControllers[b].type!="function"&&(d=dat.GUI.allControllers[b].getValue(),dat.GUI.allControllers[b].type=="number"&&(d=dat.GUI.roundToDecimal(d,4)),a.push(d));return a.join(",")};
dat.GUI.getVarFromURL=function(a){for(var b,d=window.location.href.slice(window.location.href.indexOf("?")+1).split("&"),c=0;c<d.length;c++)if(b=d[c].split("="),b!=void 0&&b[0]==a)return b[1];return null};
dat.GUI.replaceGetVar=function(a,b){for(var d,c=window.location.href,i=window.location.href.slice(window.location.href.indexOf("?")+1).split("&"),f=0;f<i.length;f++)if(d=i[f].split("="),d!=void 0&&d[0]==a)return c.replace(d[1],b);if(window.location.href.indexOf("?")!=-1)return c+"&"+a+"="+b;return c+"?"+a+"="+b};dat.GUI.saveIndex=0;dat.GUI.guiIndex=0;dat.GUI.showSaveString=function(){alert(dat.GUI.getSaveString())};
dat.GUI.makeUnselectable=function(a){if(!(a==void 0||a.style==void 0)){a.onselectstart=function(){return!1};a.style.MozUserSelect="none";a.style.KhtmlUserSelect="none";a.unselectable="on";for(var a=a.childNodes,b=0;b<a.length;b++)dat.GUI.makeUnselectable(a[b])}};dat.GUI.makeSelectable=function(a){if(!(a==void 0||a.style==void 0)){a.onselectstart=function(){};a.style.MozUserSelect="auto";a.style.KhtmlUserSelect="auto";a.unselectable="off";for(var a=a.childNodes,b=0;b<a.length;b++)dat.GUI.makeSelectable(a[b])}};
dat.GUI.map=function(a,b,d,c,i){return c+(i-c)*((a-b)/(d-b))};dat.GUI.constrain=function(a,b,d){a<b?a=b:a>d&&(a=d);return a};dat.GUI.error=function(a){typeof console.error=="function"&&console.error("[DAT.GUI ERROR] "+a)};dat.GUI.roundToDecimal=function(a,b){var d=Math.pow(10,b);return Math.round(a*d)/d};dat.GUI.extendController=function(a){a.prototype=new dat.GUI.Controller;a.prototype.constructor=a};dat.GUI.addClass=function(a,b){dat.GUI.hasClass(a,b)||(a.className+=" "+b)};
dat.GUI.hasClass=function(a,b){return a.className.indexOf(b)!=-1};dat.GUI.removeClass=function(a,b){a.className=a.className.replace(RegExp(" "+b,"g"),"")};dat.GUI.getVarFromURL("saveString")!=null&&dat.GUI.load(dat.GUI.getVarFromURL("saveString"));
dat.GUI.Controller=function(){this.parent=arguments[0];this.object=arguments[1];this.propertyName=arguments[2];if(arguments.length>0)this.initialValue=this.propertyName[this.object];this.domElement=document.createElement("div");this.domElement.setAttribute("class","guidat-controller "+this.type);this.propertyNameElement=document.createElement("span");this.propertyNameElement.setAttribute("class","guidat-propertyname");this.name(this.propertyName);this.domElement.appendChild(this.propertyNameElement);
dat.GUI.makeUnselectable(this.domElement)};dat.GUI.Controller.prototype.changeFunction=null;dat.GUI.Controller.prototype.finishChangeFunction=null;dat.GUI.Controller.prototype.name=function(a){this.propertyNameElement.innerHTML=a;return this};dat.GUI.Controller.prototype.reset=function(){this.setValue(this.initialValue);return this};dat.GUI.Controller.prototype.listen=function(){this.parent.listenTo(this);return this};dat.GUI.Controller.prototype.unlisten=function(){this.parent.unlistenTo(this);return this};
dat.GUI.Controller.prototype.setValue=function(a){this.object[this.propertyName]=a;this.changeFunction!=null&&this.changeFunction.call(this,a);this.updateDisplay();return this};dat.GUI.Controller.prototype.getValue=function(){return this.object[this.propertyName]};dat.GUI.Controller.prototype.updateDisplay=function(){};dat.GUI.Controller.prototype.onChange=function(a){this.changeFunction=a;return this};dat.GUI.Controller.prototype.onFinishChange=function(a){this.finishChangeFunction=a;return this};
dat.GUI.Controller.prototype.options=function(){var a=this,b=document.createElement("select");if(arguments.length==1){var d=arguments[0],c;for(c in d){var i=document.createElement("option");i.innerHTML=c;i.setAttribute("value",d[c]);if(arguments[c]==this.getValue())i.selected=!0;b.appendChild(i)}}else for(c=0;c<arguments.length;c++){i=document.createElement("option");i.innerHTML=arguments[c];i.setAttribute("value",arguments[c]);if(arguments[c]==this.getValue())i.selected=!0;b.appendChild(i)}b.addEventListener("change",
function(){a.setValue(this.value);a.finishChangeFunction!=null&&a.finishChangeFunction.call(this,a.getValue())},!1);a.domElement.appendChild(b);return this};
dat.GUI.ControllerBoolean=function(){this.type="boolean";dat.GUI.Controller.apply(this,arguments);var a=this,b=document.createElement("input");b.setAttribute("type","checkbox");b.checked=this.getValue();this.setValue(this.getValue());this.domElement.addEventListener("click",function(d){b.checked=!b.checked;d.preventDefault();a.setValue(b.checked)},!1);b.addEventListener("mouseup",function(){b.checked=!b.checked},!1);this.domElement.style.cursor="pointer";this.propertyNameElement.style.cursor="pointer";
this.domElement.appendChild(b);this.updateDisplay=function(){b.checked=a.getValue()};this.setValue=function(a){if(typeof a!="boolean")try{a=eval(a)}catch(b){}return dat.GUI.Controller.prototype.setValue.call(this,a)}};dat.GUI.extendController(dat.GUI.ControllerBoolean);
dat.GUI.ControllerFunction=function(){this.type="function";var a=this;dat.GUI.Controller.apply(this,arguments);this.domElement.addEventListener("click",function(){a.fire()},!1);this.domElement.style.cursor="pointer";this.propertyNameElement.style.cursor="pointer";var b=null;this.onFire=function(a){b=a;return this};this.fire=function(){b!=null&&b.call(this);a.object[a.propertyName].call(a.object)}};dat.GUI.extendController(dat.GUI.ControllerFunction);
dat.GUI.ControllerNumber=function(){this.type="number";dat.GUI.Controller.apply(this,arguments);var a=this,b=!1,d=!1,c=0,i=0,f=arguments[3],h=arguments[4],j=arguments[5];this.min=function(){var b=!1;f==void 0&&h!=void 0&&(b=!0);if(arguments.length==0)return f;else f=arguments[0];b&&(q(),j==void 0&&(j=(h-f)*0.01));return a};this.max=function(){var b=!1;f!=void 0&&h==void 0&&(b=!0);if(arguments.length==0)return h;else h=arguments[0];b&&(q(),j==void 0&&(j=(h-f)*0.01));return a};this.step=function(){if(arguments.length==
0)return j;else j=arguments[0];return a};this.getMin=function(){return f};this.getMax=function(){return h};this.getStep=function(){return j==void 0?h!=void 0&&f!=void 0?(h-f)/100:1:j};var g=document.createElement("input");g.setAttribute("id",this.propertyName);g.setAttribute("type","text");g.setAttribute("value",this.getValue());j&&g.setAttribute("step",j);this.domElement.appendChild(g);var e,q=function(){e=new dat.GUI.ControllerNumberSlider(a,f,h,j,a.getValue());a.domElement.appendChild(e.domElement)};
f!=void 0&&h!=void 0&&q();g.addEventListener("blur",function(){var b=parseFloat(this.value);e&&dat.GUI.removeClass(a.domElement,"active");isNaN(b)||a.setValue(b)},!1);g.addEventListener("mousewheel",function(b){b.preventDefault();a.setValue(a.getValue()+Math.abs(b.wheelDeltaY)/b.wheelDeltaY*a.getStep());return!1},!1);g.addEventListener("mousedown",function(a){i=c=a.pageY;dat.GUI.makeSelectable(g);document.addEventListener("mousemove",p,!1);document.addEventListener("mouseup",k,!1)},!1);g.addEventListener("keydown",
function(b){switch(b.keyCode){case 13:b=parseFloat(this.value);a.setValue(b);break;case 38:b=a.getValue()+a.getStep();a.setValue(b);break;case 40:b=a.getValue()-a.getStep(),a.setValue(b)}},!1);var k=function(){document.removeEventListener("mousemove",p,!1);dat.GUI.makeSelectable(g);a.finishChangeFunction!=null&&a.finishChangeFunction.call(this,a.getValue());d=b=!1;document.removeEventListener("mouseup",k,!1)},p=function(e){i=c;c=e.pageY;var f=i-c;!b&&!d&&(f==0?b=!0:d=!0);if(b)return!0;dat.GUI.addClass(a.domElement,
"active");dat.GUI.makeUnselectable(a.parent.domElement);dat.GUI.makeUnselectable(g);e.preventDefault();e=a.getValue()+f*a.getStep();a.setValue(e);return!1};this.options=function(){a.noSlider();a.domElement.removeChild(g);return dat.GUI.Controller.prototype.options.apply(this,arguments)};this.noSlider=function(){e&&a.domElement.removeChild(e.domElement);return this};this.setValue=function(a){a=parseFloat(a);f!=void 0&&a<=f?a=f:h!=void 0&&a>=h&&(a=h);return dat.GUI.Controller.prototype.setValue.call(this,
a)};this.updateDisplay=function(){g.value=dat.GUI.roundToDecimal(a.getValue(),4);if(e)e.value=a.getValue()}};dat.GUI.extendController(dat.GUI.ControllerNumber);
dat.GUI.ControllerNumberSlider=function(a,b,d,c,i){var f=!1,h=this;this.domElement=document.createElement("div");this.domElement.setAttribute("class","guidat-slider-bg");this.fg=document.createElement("div");this.fg.setAttribute("class","guidat-slider-fg");this.domElement.appendChild(this.fg);var j=function(b){if(f){var c;c=h.domElement;var d=0,g=0;if(c.offsetParent){do d+=c.offsetLeft,g+=c.offsetTop;while(c=c.offsetParent);c=[d,g]}else c=void 0;b=dat.GUI.map(b.pageX,c[0],c[0]+h.domElement.offsetWidth,
a.getMin(),a.getMax());b=Math.round(b/a.getStep())*a.getStep();a.setValue(b)}};this.domElement.addEventListener("mousedown",function(b){f=!0;dat.GUI.addClass(a.domElement,"active");j(b);document.addEventListener("mouseup",g,!1)},!1);var g=function(){dat.GUI.removeClass(a.domElement,"active");f=!1;a.finishChangeFunction!=null&&a.finishChangeFunction.call(this,a.getValue());document.removeEventListener("mouseup",g,!1)};this.__defineSetter__("value",function(b){this.fg.style.width=dat.GUI.map(b,a.getMin(),
a.getMax(),0,100)+"%"});document.addEventListener("mousemove",j,!1);this.value=i};
dat.GUI.ControllerString=function(){this.type="string";var a=this;dat.GUI.Controller.apply(this,arguments);var b=document.createElement("input"),d=this.getValue();b.setAttribute("value",d);b.setAttribute("spellcheck","false");this.domElement.addEventListener("mouseup",function(){b.focus();b.select()},!1);b.addEventListener("keyup",function(c){c.keyCode==13&&a.finishChangeFunction!=null&&(a.finishChangeFunction.call(this,a.getValue()),b.blur());a.setValue(b.value)},!1);b.addEventListener("mousedown",
function(){dat.GUI.makeSelectable(b)},!1);b.addEventListener("blur",function(){dat.GUI.supressHotKeys=!1;a.finishChangeFunction!=null&&a.finishChangeFunction.call(this,a.getValue())},!1);b.addEventListener("focus",function(){dat.GUI.supressHotKeys=!0},!1);this.updateDisplay=function(){b.value=a.getValue()};this.options=function(){a.domElement.removeChild(b);return dat.GUI.Controller.prototype.options.apply(this,arguments)};this.domElement.appendChild(b)};dat.GUI.extendController(dat.GUI.ControllerString);
dat.GUI.inlineCSS="#guidat { position: fixed; top: 0; right: 0; width: auto; z-index: 1001; text-align: right; } .guidat { color: #fff; opacity: 0.97; text-align: left; float: right; margin-right: 20px; margin-bottom: 20px; background-color: #fff; } .guidat, .guidat input { font: 9.5px Lucida Grande, sans-serif; } .guidat-controllers { height: 300px; overflow-y: auto; overflow-x: hidden; background-color: rgba(0, 0, 0, 0.1); } a.guidat-toggle:link, a.guidat-toggle:visited, a.guidat-toggle:active { text-decoration: none; cursor: pointer; color: #fff; background-color: #222; text-align: center; display: block; padding: 5px; } a.guidat-toggle:hover { background-color: #000; } .guidat-controller { padding: 3px; height: 25px; clear: left; border-bottom: 1px solid #222; background-color: #111; } .guidat-controller, .guidat-controller input, .guidat-slider-bg, .guidat-slider-fg { -moz-transition: background-color 0.15s linear; -webkit-transition: background-color 0.15s linear; transition: background-color 0.15s linear; } .guidat-controller.boolean:hover, .guidat-controller.function:hover { background-color: #000; } .guidat-controller input { float: right; outline: none; border: 0; padding: 4px; margin-top: 2px; background-color: #222; } .guidat-controller select { margin-top: 4px; float: right; } .guidat-controller input:hover { background-color: #444; } .guidat-controller input:focus, .guidat-controller.active input { background-color: #555; color: #fff; } .guidat-controller.number { border-left: 5px solid #00aeff; } .guidat-controller.string { border-left: 5px solid #1ed36f; } .guidat-controller.string input { border: 0; color: #1ed36f; margin-right: 2px; width: 148px; } .guidat-controller.boolean { border-left: 5px solid #54396e; } .guidat-controller.function { border-left: 5px solid #e61d5f; } .guidat-controller.number input[type=text] { width: 35px; margin-left: 5px; margin-right: 2px; color: #00aeff; } .guidat .guidat-controller.boolean input { margin-top: 6px; margin-right: 2px; font-size: 20px; } .guidat-controller:last-child { border-bottom: none; -webkit-box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.5); -moz-box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.5); box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.5); } .guidat-propertyname { padding: 5px; padding-top: 7px; cursor: default; display: inline-block; } .guidat-controller .guidat-slider-bg:hover, .guidat-controller.active .guidat-slider-bg { background-color: #444; } .guidat-controller .guidat-slider-bg .guidat-slider-fg:hover, .guidat-controller.active .guidat-slider-bg .guidat-slider-fg { background-color: #52c8ff; } .guidat-slider-bg { background-color: #222; cursor: ew-resize; width: 40%; margin-top: 2px; float: right; height: 21px; } .guidat-slider-fg { cursor: ew-resize; background-color: #00aeff; height: 21px; } ";

define("dat/gui/dat.GUI.min", function(){});

define('dat/mahog/Bookshelf',[

  'dat/mahog/shaders/BookUniforms',

  'dat/mahog/Library',
  'dat/mahog/MorphingBook',
  'dat/mahog/StaticBook',
  'dat/mahog/params',
  'dat/mahog/BookDisplayer',
  'dat/mahog/utils',
  'dat/mahog/SpiralShelf',
  'dat/mahog/CONFIG',
  'dat/mahog/DomLabelManager',
  // 'dat/mahog/Demonstrator',
  'dat/mahog/animate',
  'dat/mahog/Genre2DOverlay',

  'dat/utils/Easing',
  'dat/utils/utils',
  'dat/utils/Routine',
  'dat/utils/showMessage',
  'dat/utils/urlArgs',

  'text!dat/mahog/data/categories.json',

  'order!dat/gui/dat.GUI.min',

  'jquery',
  'three',
  'stats',
  'RequestAnimationFrame',
  'underscore'

], function(BookUniforms, Library, MorphingBook, StaticBook, params, BookDisplayer, utils, SpiralShelf, CONFIG, LabelManager, /*Demonstrator,*/ animate, genre2DOverlay, Easing, datutils, Routine, showMessage, urlArgs, categories) {


  var VERBOSE = false;

  var categories = JSON.parse(categories);
  var disableClickToRead = !!urlArgs['disableClickToRead'];

  /**
   * @class A singleton class that represents a Bookshelf. Deals with scene
   * creation, camera movement, book placement and mouse events.
   * @exports Bookshelf as mahog/Bookshelf
   */
  var Bookshelf =
      /** @constructor */
          function() {

        // TODO get away from getter and setter. Don't break the save strings.
        this.__defineSetter__('numBookDisplayers', function(v) {
          while (_this.bookDisplayers.length < v) {
            var bookDisplayer = new BookDisplayer(_this, camera, morphingBook);
            _this.bookDisplayers.push(bookDisplayer);
            scene.addObject(bookDisplayer.mesh);
          }
          numBookDisplayers = v;
        });

        this.__defineGetter__('numBookDisplayers', function() {
          return numBookDisplayers;
        });

        /**
         * List of book displayers.
         */
        this.bookDisplayers = [];

        /**
         * Drawing surface for the bookshelf
         */
        this.domElement = document.createElement('div');
        this.domElement.setAttribute('id', 'content');

        var cur_genre;

        var renderer = new THREE.WebGLRenderer({ antialias: true });

        /**
         * Library associated with this bookshelf.
         */
        this.library = new Library(renderer);

        this.frameCount = 0;

//        animate.ondisturb = loop;

        /**
         * Returns the vertical destination of the camera.
         *
         * @returns {Number} Vertical destination of camera.
         */
        this.getClimbDest = function() {
          var cs = cameraState.animate.dest('cameraTargetPositionY');
          return cs + utils.orbitToY(cameraState.animate.dest('orbit'));
        };

        /**
         * Animates the camera to the specified book.
         *
         * @param {String} id Book ID.
         * @param {Boolean|Function} [onArrive] If true, opens book on completion.
         * If a function, will perform the function when the camera arrives at book.
         */
        this.goToBookById = function(id, onArrive) {

          _this.returnBookToShelf();

          var index = Library.ids.indexOf(id);
          if(index < 0) {
            console.log("Error index of "+ id +" not found: "+index);
          } else {
            var callback = onArrive;
            if (onArrive === true) {
              callback = function() {
                _this.showCover(index);
              };
            }
            _this.goToBookByIndex(index, callback);
          }

        };

        /**
         * Returns the ID of the currently active book.
         *
         * @returns {String} ID of the currently active book.
         */
        this.getActiveBookId = function() {
          if (BookDisplayer.active != null) {
            return BookDisplayer.active.getBookID();
          }
          return null;
        };

        /**
         * Animates to a specified book by its position in the BookDisplayers array.
         *
         * @param {Number} i Index of book.
         * @param {Function} [onArrive] Function to execute when animation is
         * complete.
         */
        this.goToBookByIndex = function(i, onArrive) {

          var height = utils.indexToY(i);
          var theta = utils.yToOrbit(height);
          var circles = Math.floor(theta / (Math.PI * 2));

          theta %= Math.PI * 2;

          circles += 1;

          var climb = -circles * params.shelfHeight;

          var diff = theta - cameraState.orbit;

          while (Math.abs(diff) > Math.PI * 2) {

            theta -= datutils.sign(diff) * Math.PI * 2;
            climb -= datutils.sign(diff) * params.shelfHeight;
            diff = theta - cameraState.orbit;

          }

//          climb+= params.shelfHeight;

          _this.returnBookToShelf();

          cameraState.animate({
            to: {
              cameraTargetPositionY: climb
            },
            duration: params.cameraTargetDriftLength,
            curve: Easing.Circular.EaseOut
          });

          cameraState.animate({
            to: {
              cameraPositionY: climb,
              orbit: theta
            },
            duration: params.cameraPositionDriftLength,
            curve: Easing.Quadratic.EaseOut,
            onComplete: onArrive
          });



        };

        /**
         * Animate to a given genre.
         *
         * @param {String} genreName Name of the genre to which to animate.
         * @param {Function} [onArrive] Function to execute when animation is
         * complete.
         */
        this.goToGenre = function(genreName, onArrive) {

          var numBooksPreceding = 0;

          for (var i in genreData) {

            if (genreData[i].name === genreName) {
              break;
            } else {
              numBooksPreceding += genreData[i].count;
            }

          }

          // Big old hack, goes one shelf down for the first genre.
          numBooksPreceding = Math.max(numBooksPreceding, params.booksPerCircle);

          _this.goToBookByIndex(numBooksPreceding, onArrive, _this.showCover);

        };

        /**
         * Get the name of the current genre
         *
         * @returns {String} Name of the current genre.
         */
        this.getCurrentGenre = function() {
          return cur_genre;

        };

        this.getGenre = function(index) {

          var count = 0;
          for (var i in genreData) {
            count += genreData[i].count;
            if (count > index) {
              return genreData[i].name;
            }
          }

          return genreData[0].name;

        };

        /**
         * Brings a book off the shelf and up to the camera to show the cover.
         *
         * @param {Number|Object} book If a number, this parameter is interpreted as
         *  a book index. If a BookDisplayer, this parameter is interpreted as the
         *  book currently represented by that BookDisplayer.
         * @param {Function} [onComplete] Function to fire when animation is
         * complete.
         */
        this.showCover = function(book, onComplete) {

          labelManager.fadeOut();

          // Is a book on its way out?
          if (BookDisplayer.active && !BookDisplayer.active.fullyOut) {
            return;
          }

          if (_.isNumber(book)) {
            var bookId = book;
            book = _this.bookDisplayers[bookId];
            if (_.isUndefined(book)) {
              book = _this.library.fetch(bookId).bookDisplayer;
            }
          } else if (_.isUndefined(book) || _.isNull(book)) {
            book = _this.library.fetch(_this.getCurrentBookIndex()).bookDisplayer;
          }

          if (!BookDisplayer.loading && BookDisplayer.active != book) {

            BookDisplayer.active = book;
            _this.lastOpenedId = book.getBookID();
            book.open(function() {
              bringUpCloseButton(0);
              if (_.isFunction(onComplete)) {
                onComplete();
              }
            }, function(data) {
              if (data.error === undefined) {
                $(clickToRead).find('a').attr('href', data.volumeInfo.infoLink);
              }
            });
          }

        };

        /**
         * Opens to the inside of the currently active book and toggles the X icon.
         *
         * @param {Function} [onComplete] Function to execute after the animation is
         * complete.
         */
        this.openBook = function(onComplete) {
          if ($(closeButton).css('opacity') < 1 || $(closeButton).css('display') === 'none') {
            openBook(onComplete);
          } else {
            fadeOutCloseButton(onComplete);
            fadeOutClickToRead();
          }
        };

        /**
         * Closes the currently active book and toggles the X icon.
         *
         * @param {Function} [onComplete] Function to execute when the animation is
         * complete.
         */
        this.closeBook = function(onComplete) {
          if ($(closeButton).css('opacity') < 1 || $(closeButton).css('display') === 'none') {
            closeBook(onComplete);
          } else {
            fadeOutCloseButton(onComplete);
            fadeOutClickToRead();
          }
        };

        /**
         * Tries to guess what book we're currently "looking at" and returns the
         * corresponding book index.
         *
         * @returns {Number} Index of the book we're currently "looking at".
         */
        this.getCurrentBookIndex = function() {

          var towerHeight = utils.indexToY(CONFIG.count);

          var wrappedY = datutils.wrap(_this.getClimbDest() + params.shelfHeight, towerHeight);
          var index = utils.yToIndex(wrappedY);

          var phaseUnrounded = index / params.booksPerCircle;
          phaseUnrounded -= utils.orbitToY(cameraState.orbit) / params.shelfHeight;

          var desync = params.booksPerCircle - CONFIG.count % params.booksPerCircle;
          var towers = Math.floor(_this.getClimbDest() / towerHeight);

          index += towers * desync;
          if (phaseUnrounded % 1 < 0.5) {
            index -= datutils.wrap(phaseUnrounded, 1) * params.booksPerCircle;
          } else {
            index -= (phaseUnrounded - 0.5) % 1 * params.booksPerCircle;
            index -= params.booksPerCircle / 2;
          }

          index += params.booksPerCircle * params.focusOffset;
          index = datutils.wrap(index, CONFIG.count);

          return Math.round(index);

        };

        /**
         * Puts the active book back on the shelf.
         */
        this.returnBookToShelf = function() {

          if (BookDisplayer.loading) {
            BookDisplayer.cancel();
          }

          fadeOutCloseButton();
          fadeOutClickToRead();
          labelManager.fadeIn();

          if (BookDisplayer.active != null) BookDisplayer.active.close();
          BookDisplayer.active = null;

        };

        var readyOut = null;
        var READY = false;

        var _this = this;

        var projector,
            scene,
            stats,
            fov,
            camera,
            pcamY,
            width,
            height,
            gui,
            shelf,
            genreData,
            genreOverlay,
            downOverMorphingBook = false,
            labelManager,
            genreButton,
            clickToRead,
            closeButton;

        var cameraState = {
          cameraPositionY: 0,
          cameraTargetPositionY: 0,
          orbit: 0
        };

        /**
         * Fires when bookshelf is rendered in WebGL Context.
         */
         this.ready = function(callback) {

           clearTimeout(readyOut);

           if (READY) {
             if (_.isFunction(callback)) {
               callback(_this);
             }
           } else {
             readyOut = setTimeout(this.ready, 7000, callback);
           }

         };

        animate(cameraState);
        cameraState.animate.destinationChange = onCameraTargetDestinationChange;

        var mouseDownX, mouseDownY, downState;

        // TODO move to init
        var ambient = 0xffffff, diffuse = 0xffffff, specular = 0xffffff,
            ambientLight = new THREE.AmbientLight(ambient, 1),
            directionalLight = new THREE.DirectionalLight(diffuse, 1),
//        directionalLight2 = new THREE.DirectionalLight(diffuse, 2),

            pointLight = new THREE.PointLight(specular, 1);
//            pointLight2 = new THREE.PointLight(specular),
//            pointLight3 = new THREE.PointLight(specular);
        directionalLight.position.set(1, 0.2, 0);
        directionalLight.position.normalize();

        //directionalLight2.position.set(0, 0.8, 0);

        var demoWindowBegin = 0;
        var demoWindowEnd = 60;

        if (urlArgs['demoWindowBegin'] !== undefined) {
          demoWindowBegin = urlArgs['demoWindowBegin'];
        }

        if (urlArgs['demoWindowEnd'] !== undefined) {
          demoWindowEnd = urlArgs['demoWindowEnd'];
        }

        // TODO move to init
        // var demonstrator = this.demonstrator;
        // if (urlArgs['installation']) {
        //   demonstrator = this.demonstrator = new Demonstrator(_this, demoWindowBegin, demoWindowEnd);
        // } else {
        //   demonstrator = this.demonstrator = {
        //     update: _.identity,
        //     onActivity: _.identity
        //   };
        // }

        var downOpened = 0;
        var numBookDisplayers = 0;
        var dragged = false;

        var pmouseX = 0;
        var pmouseY = 0;
        var mouseX = 0;
        var mouseY = 0;

        var morphingBook;

        var viewOffset = {};

        if (urlArgs['rows'] !== undefined || urlArgs['cols'] !== undefined) {

          // Split frustum

          var rows = urlArgs['rows'] || 1;
          var cols = urlArgs['cols'] || 1;
          var row = urlArgs['row'] || 0;
          var col = urlArgs['col'] || 0;
          var bezel = urlArgs['bezel'] || 0;

          viewOffset.fullWidth = cols * window.innerWidth + (cols - 1) * bezel;
          viewOffset.fullHeight = rows * window.innerHeight + (rows - 1) * bezel;
          viewOffset.viewX = col * (window.innerWidth + bezel);
          viewOffset.viewY = row * (window.innerHeight + bezel);

        } else {

          // Single window

          viewOffset.fullWidth = parseInt(urlArgs['fullWidth']) ||
              window.innerWidth;
          viewOffset.fullHeight = parseInt(urlArgs['fullHeight']) ||
              window.innerHeight;
          viewOffset.viewX = parseInt(urlArgs['viewX']) || 0;
          viewOffset.viewY = parseInt(urlArgs['viewY']) || 0;

        }

        var routine = new Routine();

        if (VERBOSE) {
          console.log("Begining to construct routine.");
        }

        routine.wait(MorphingBook.loadAssets);
        routine.wait(StaticBook.loadAssets);

        routine.wait(function(success, failure) {

          if (VERBOSE) {
            console.log("Initializing Bookshelf");
          }

          init();

          genreData = categories;
          populateGUI();

          genreOverlay = new genre2DOverlay(
              genreData, _this.goToGenre, renderer.domElement);
          _this.domElement.appendChild(genreOverlay.domElement);

          labelManager = new LabelManager(genreData, _this, genreOverlay);


          success();

        });

        routine.wait(function(success) {

          if (VERBOSE) {
            console.log("Creating Spiral Shelf");
          }

          shelf = new SpiralShelf(ambientLight, directionalLight, pointLight);
          scene.addObject(shelf.mesh);

          /*
          if (urlArgs['preload'] == 'true' || urlArgs['preload'] == '1') {
            _this.library.preloadSheets(renderer.getContext());
          }
          */

          _this.numBookDisplayers = params.numBookDisplayers;

          onCameraTargetDestinationChange();
          loop();
          success();

        });

        routine.wait(function(success) {
          if (VERBOSE) {
            console.log("Bookshelf Ready");
          }

          READY = true;
          success();

        });

        if (VERBOSE) {
          console.log("About to run.");
        }

        routine.run();

        /**
         * Initializes scene.
         */
        function init() {

          gui = new dat.GUI({height: viewOffset.fullHeight - 40});

          width = viewOffset.fullWidth;
          height = viewOffset.fullHeight;

          camera = new THREE.Camera(params.baseFov, viewOffset.fullWidth /
              viewOffset.fullHeight, 1, 10000);

          pcamY = camera.position.y - 1;

          projector = new THREE.Projector();

          scene = new THREE.Scene();
          scene.fog = new THREE.Fog(0x000000, params.near, params.far);
          scene.matrixAutoUpdate = false;

          morphingBook = new MorphingBook(
              new THREE.Texture(), new THREE.Texture());

          animate(morphingBook);

          morphingBook.hide();
          morphingBook.mesh.matrixAutoUpdate = true;

          scene.addObject(morphingBook.mesh);

//          scene.addLight(ambientLight);
          scene.addLight(directionalLight);

          scene.addLight(pointLight);

//                    scene.addLight(pointLight2);
//                    scene.addLight(pointLight3);
          if (urlArgs['stats'] == 'true' || urlArgs['stats'] == '1') {
            stats = new Stats();
            stats.domElement.style.position = 'absolute';
            stats.domElement.style.bottom = '20px';
            stats.domElement.style.left = '20px';
            stats.domElement.style.opacity = '0.6';
            stats.domElement.style.zIndex = 100;
            stats.domElement.setAttribute('id', 'stats');
            _this.domElement.appendChild(stats.domElement);
          }


          THREE.currentRenderer = renderer;  // used for quick access to the gl
          renderer.sortObjects = false;
          _this.domElement.appendChild(renderer.domElement);

          // genreButton = document.createElement('div');
          // genreButton.setAttribute('id', 'genrebutton');

          if (urlArgs['installation'] != undefined ||
              urlArgs['installation_debug'] != undefined) {
            // _this.domElement.appendChild(genreButton);
            // genreButton.style.top = 1080 + 60 + 15 + 'px';
            // genreButton.style.right = 15 + 'px';

            // Inject this style
            var styles = '*, html, body, div, canvas { ' +
                'cursor: url(/textures/ui/invisible.gif), none !important; }';

            var css = document.createElement('style');
            css.type = 'text/css';
            if (css.styleSheet) {
              css.styleSheet.cssText = styles;
            } else {
              css.appendChild(document.createTextNode(styles));
            }

            document.getElementsByTagName('head')[0].appendChild(css);

          }

          closeButton = document.createElement('div');
          closeButton.setAttribute('class', 'closebutton');
          _this.domElement.appendChild(closeButton);
          $(closeButton).click(function(e) {
            e.stopPropagation();
            _this.returnBookToShelf();
          });

          clickToRead = document.createElement('div');
          clickToRead.setAttribute('id', 'click-to-read');
          clickToRead.style.display = 'none';
          clickToRead.innerHTML = '<a href="#" target="_blank">搜索本书</a>';
          _this.domElement.appendChild(clickToRead);

          // Event Listeners

          window.addEventListener('resize', onWindowResize, false);
          onWindowResize();

          /*
          window.addEventListener('mousemove', onDocumentMouseMove);
          window.addEventListener('mousedown', onDocumentMouseDown);
          window.addEventListener('click', onDocumentClick);
          window.addEventListener('mousewheel', onDocumentMouseWheel, false);
          */

          // if (urlArgs['installation'] !== undefined) {
          //   _this.addEventListeners();
          // }

        }

        this.addEventListeners = function() {
          _this.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
          _this.domElement.addEventListener('mousedown', onDocumentMouseDown, false);
          _this.domElement.addEventListener('click', onDocumentClick, false);
          _this.domElement.addEventListener('mousewheel', onDocumentMouseWheel, false);
          if (!_.isUndefined(genreButton)) {
            $(genreButton).click(function(e) {
              genreOverlay.show();
            });
          }
          if (labelManager.hidden) {
            labelManager.fadeIn();
          }
        };

        this.removeEventListeners = function() {
          _this.domElement.removeEventListener('mousemove', onDocumentMouseMove, false);
          _this.domElement.removeEventListener('mousedown', onDocumentMouseDown, false);
          _this.domElement.removeEventListener('click', onDocumentClick, false);
          _this.domElement.removeEventListener('mousewheel', onDocumentMouseWheel, false);
          if (!_.isUndefined(genreButton)) {
            $(genreButton).unbind('click');
          }
        };

        /**
         * Fires when the window is resized.
         */
        function onWindowResize(e) {

          var reference = $('#content');

          renderer.setSize(reference.width(), reference.height());
          camera.aspect = reference.width() / reference.height();
          camera.updateProjectionMatrix();
          viewOffset.fullWidth = reference.width();
          viewOffset.fullHeight = reference.height();
//          camera.setViewOffset(
//              viewOffset.fullWidth, viewOffset.fullHeight, viewOffset.viewX,
//              viewOffset.viewY, window.innerWidth, window.innerHeight);

          shouldRender = true;

        }

        /**
         * Called whenever the camera changes destination.
         */
        function onCameraTargetDestinationChange() {

          var centerIndex = Math.floor(utils.yToIndex(_this.getClimbDest()));

          var gt = params.grabTextures;
          var lo = datutils.wrap(centerIndex - gt / 2, CONFIG.count);
          var hi = datutils.wrap(centerIndex + gt / 2, CONFIG.count);

          var yDirection = camera.target.position.y - camera.position.y;

          var index = _this.getCurrentBookIndex();

          var new_genre = _this.getGenre(index);

          if (new_genre != cur_genre) {
            shouldRender = true;

            cur_genre = new_genre;
            _.each(_this.bookDisplayers, function(b) {
              b.onGenreChange();

            });
            shouldRender = true;
          }
          if (lo > hi) {
            _this.library.see(lo, CONFIG.count - 1, yDirection);
            _this.library.see(0, hi, yDirection);
          } else {
            _this.library.see(lo, hi, yDirection);
          }

          // labelManager.cameraState = cameraState;

        }

        /**
         * Places books upon the spiral.
         */
        function assignPositions() {

          camera.vel = Math.abs(pcamY - camera.position.y);


          if (pcamY != camera.position.y) {

            for (var i = 0; i < _this.bookDisplayers.length; i++) {

              var book = _this.bookDisplayers[i];

              var unwrappedIndex = getVisibleIndex(i);

              var bookIndex = datutils.wrap(unwrappedIndex, CONFIG.count);


//              if (vel < 20) {
                book.setBookIndex(bookIndex);
//              }


              var y = utils.indexToY(unwrappedIndex);
              var angle = utils.yToOrbit(y);

              book.restPosition.x = Math.cos(angle) * params.spiralRadius;
              book.restPosition.y = y + book.getHeight() / 2;
              book.restPosition.z = Math.sin(angle) * params.spiralRadius;
              book.restRotation.y = -(angle % (Math.PI * 2)) + params.bookTwist;

//              if (true) {
                book.mesh.position.copy(book.restPosition);
                book.mesh.rotation.copy(book.restRotation);

                book.mesh.updateMatrix();
//              }

//              }

            }

            // labelManager.assignLabelPosition(camera, false);

          }


          pcamY = camera.position.y;

        }

        /**
         * Recycles book displayers
         * @param {Number} index Real book index (unlooped).
         */
        function getVisibleIndex(index) {

          var view = params.loopHeight;

          var y = datutils.lerp(camera.position.y, camera.target.position.y, 0.1);

          if (camera.position.y > camera.target.position.y) {

            while (utils.indexToY(index) < y - view) {
              index += numBookDisplayers;
            }
            while (utils.indexToY(index) > y + view) {
              index -= numBookDisplayers;
            }

          } else {

            while (utils.indexToY(index) > y + view) {
              index -= numBookDisplayers;
            }
            while (utils.indexToY(index) < y - view) {
              index += numBookDisplayers;
            }

          }

          return index;

        }

        /**
         * Adds controls to the GUI.
         */
        function populateGUI() {

          if (urlArgs['saveString'] == undefined) {
            if (urlArgs['installation'] != undefined || urlArgs['installation_debug'] != undefined) {
              dat.GUI.load("1,0,true,304,767,0,1300,1240,1100,68,1.8221,true,40,110,0.5708,1.6445,202,39,950,1.25,618,237,725,1400,1525,3000,-15,56,0,0,20");
            } else {
              dat.GUI.load("1,0,true,280,0,0,500,400,950,74,1.8221,true,28,52,0.5708,1.6445,279,52,355,1.25,665,120,550,1250,1500,3000,54,30,0,0,20"); //  650
            }
          }

          dat.GUI.close();

          gui.listenAll();

          gui.add(params, 'numBookDisplayers').min(0).step(5);

          gui.add(params, 'loopHeight').step(10);

          gui.add(params, 'cameraDistance').step(50);
          gui.add(params, 'shelfHeight').onChange(assignPositions);
          gui.add(params, 'bookTwist', 0, Math.PI * 2).onChange(assignPositions);

          gui.add(params, 'scaleFov');
          gui.add(params, 'baseFov');
          gui.add(params, 'maxFov');
          gui.add(params, 'fovCap').max(Math.PI / 2).step(0.05);
          gui.add(params, 'fovCurve', 0.01, 3);

          gui.add(params, 'spiralRadius').onChange(assignPositions);
          gui.add(params, 'booksPerCircle').onChange(assignPositions);

          gui.add(params, 'grabTextures').min(1);
          gui.add(params, 'shelfYOffset').step(0.25);
          gui.add(params, 'lightDistance');
          gui.add(params, 'openDistance');

          gui.add(scene.fog, 'near').step(25).onChange(function(newvalue) {
            BookUniforms.fogNear.value = newvalue;
            setBookFog(newvalue, BookUniforms.fogFar.value);
          });

          gui.add(scene.fog, 'far').step(25).onChange(function(newvalue) {
            BookUniforms.fogFar.value = newvalue;
            setBookFog(BookUniforms.fogNear.value, newvalue);
          });

          gui.add(params, 'cameraTargetDriftLength').step(25);
          gui.add(params, 'cameraPositionDriftLength').step(25);

          gui.add(params, 'labelOffsetY').step(1);
          gui.add(params, 'labelOffsetX').step(1);
          gui.add(params, 'offsetTheta').step(
              Math.PI / 16).min(- Math.PI * 2.0).max(Math.PI * 2.0);
          gui.add(params, 'focusOffset');
          gui.add(params, 'maxTextures');

        }

        /**
         * Find the closest 3D object underneath the mouse in the scene that passes
         * a truth test, #filter.
         *
         * @param {Function} [filter] Optional truth test, is passed the 3D object
         * in question and the distance to the intersection from the camera.
         */
        function getObjectUnderMouse(filter) {

          filter = filter || function() {
            return true;
          };

          var nx = (mouseX / viewOffset.fullWidth) * 2 - 1;
          var ny = - (mouseY / viewOffset.fullHeight) * 2 + 1;
          var vector = new THREE.Vector3(nx, ny, 0.5);

          projector.unprojectVector(vector, camera);

          var ray = new THREE.Ray(
              camera.position, vector.subSelf(camera.position).normalize());

          var intersects = ray.intersectScene(scene);

          for (i = 0; i < intersects.length; i++) {

            var object = intersects[i].object;

            if (filter(object, intersects[i].distance)) return object;

          }

          return null;

        }

        function onDocumentMouseMove(e) {

          if (!e.generated && urlArgs['installation']) {
            return;
          }

          // demonstrator.onActivity();

          pmouseX = mouseX || 0;
          pmouseY = mouseY || 0;

          mouseX = (e.x || e.clientX) + $('body').scrollLeft();
          mouseY = (e.y || e.clientY) + $('body').scrollTop();

          return false;

        }

        function onDocumentMouseDown(e) {

          if (!e.generated && urlArgs['installation']) {
            return;
          }

          e.preventDefault();

          // demonstrator.onActivity();

          var needsToSettle = false;
          if (cameraState.cameraPositionY != cameraState.cameraTargetPositionY) {
            needsToSettle = true;
          }

          cameraState.animate.clear();

          if (needsToSettle) {
            cameraState.animate({
              to: { cameraPositionY: cameraState.cameraTargetPositionY },
              duration: params.cameraTargetDriftLength,
              curve: Easing.Exponential.EaseOut
            });
          }

          mouseDownX = pmouseX = mouseX = (e.x || e.clientX) + $('body').scrollLeft();
          mouseDownY = pmouseY = mouseY = (e.y || e.clientY) + $('body').scrollTop();

          var under = getObjectUnderMouse(isActiveBook);

          downOverMorphingBook = under !== null;


          dragged = false;

          _this.domElement.addEventListener('mousemove', onDocumentMouseDrag, false);
          _this.domElement.addEventListener('mouseup', onDocumentMouseUp, false);
          window.addEventListener('mouseout', onDocumentMouseUp, false);

          return false;

        }

        function onDocumentMouseDrag(e) {

          if (!e.generated && urlArgs['installation']) {
            return;
          }

          if (!dragged &&
              datutils.dist(mouseDownX, mouseDownY, mouseX, mouseY) >
                  params.dragEpsilon) {

            dragged = true;
            mouseDownX = mouseX;
            mouseDownY = mouseY;
            downOpened = morphingBook.opened;
            downState = copyCameraState();
          } else if (!dragged) {
            return false;
          }

          // demonstrator.onActivity();
          dragged = true;

          if (BookDisplayer.loading) {

            BookDisplayer.cancel();

          } else if (BookDisplayer.active != null) {

            if (downOverMorphingBook) {

              fadeOutCloseButton();
              fadeOutClickToRead();
              var t = datutils.map(
                  mouseX, mouseDownX, mouseDownX - params.fullOpenEffort, 0, 1);
              t += downOpened;
              t = datutils.clamp(t, 0, 1);
              updateOpened(t);
              return false;

            } else {
              _this.returnBookToShelf();
              BookDisplayer.cancel();
            }

          }


          var y, o;

          o = datutils.map(
              mouseX, mouseDownX, mouseDownX + 300,
              downState.orbit, downState.orbit + Math.PI / 8);

          y = datutils.map(mouseY,
              mouseDownY, mouseDownY + 2.5,
              downState.cameraTargetPositionY,
              downState.cameraTargetPositionY + 0.5 * (5 / 6.0));


          cameraState.animate.clear();

          cameraState.animate({
            to: {
              orbit: o,
              cameraPositionY: y,
              cameraTargetPositionY: y
            },
            duration: 0
          });
          shouldRender = true;



          //onCameraTargetDestinationChange();

          return false;

        }

        function onDocumentMouseWheel(event) {

          if (!event.generated && urlArgs['installation']) {
            return;
          }

          // demonstrator.onActivity();

          if (BookDisplayer.active != null) {
            BookDisplayer.cancel();
            _this.returnBookToShelf();
          }

          var o = cameraState.orbit - (event.wheelDeltaX / 1000);
          var y = cameraState.cameraTargetPositionY - (event.wheelDeltaY / 6);

          cameraState.animate.clear();

          cameraState.animate({
            to: {
              orbit: o,
              cameraPositionY: y,
              cameraTargetPositionY: y
            },
            duration: 0
          });

          //onCameraTargetDestinationChange();
          shouldRender = true;
          return false;

        }

        function onDocumentClick(e) {

          if (!e.generated && urlArgs['installation']) {
            return;
          }

          if (dragged) return;

          var intersectedMesh = null;
          var intersectedLabel = null;
          var intersectedActive = null;

          // demonstrator.onActivity();

          if (!genreOverlay.showing) {

            // Trying to bring up cover?
//            intersectedLabel = getObjectUnderMouse(isLabel);
            intersectedMesh = getObjectUnderMouse(isBookDisplayer);
            intersectedActive = getObjectUnderMouse(isActiveBook);

            if (BookDisplayer.active != null && intersectedActive != null) {

              fadeOutCloseButton(function() {
              snapBook(true);
              });
              fadeOutClickToRead();


            } else if (BookDisplayer.active == null) {

              /*if (intersectedLabel != null) {

                // TODO: Make work on negative indices

                if (intersectedLabel.labelInfo === labelManager.active) {
                  genreOverlay.show();
                } else if (intersectedLabel.position.y > labelManager.active.beginning.position.y) {
                  // Above
                  _this.goToBookByIndex(intersectedLabel.labelInfo.bottomIndex + 1);
                } else if (intersectedLabel.position.y < labelManager.active.beginning.position.y) {
                  // Below
                  _this.goToBookByIndex(intersectedLabel.labelInfo.topIndex - 1);
                }
              } else*/ if (intersectedMesh != null) {

                // var bd = intersectedMesh.bookDisplayer;
                // if (bd.staticBook.getDim() > 0) {
                //   // animate to section then get book
                //   _this.goToBookByIndex(bd.getBookIndex(), function() {
                //     _this.showCover(bd);
                //   });
                // } else {
                  _this.showCover(intersectedMesh.bookDisplayer);
                // }
              }


            } else if (intersectedMesh != null &&
                intersectedMesh.bookDisplayer != BookDisplayer.active) {

              if (BookDisplayer.loading && !BookDisplayer.active.comingOut) {
                BookDisplayer.cancel();
              } else {
                _this.returnBookToShelf();
              }

              _this.showCover(intersectedMesh.bookDisplayer);

            } else {

              _this.returnBookToShelf();

            }

          }

        }

        function onDocumentMouseUp(e) {

          if (!e.generated && urlArgs['installation']) {
            return;
          }

          // demonstrator.onActivity();
          downOverMorphingBook = false;

          if (BookDisplayer.active == null && dragged) {

            var dx, dy, retain;

            dx = mouseX - pmouseX;
            dy = mouseY - pmouseY;

            // TODO move to params
            retain = 0.030;

            cameraState.animate({
              to: { orbit: cameraState.orbit + dx * retain },
              duration: params.cameraTargetDriftLength,
              curve: Easing.Exponential.EaseOut
            });

            // TODO move to params
            retain = 5;

            var cameraCurTarget = cameraState.cameraTargetPositionY;
            var cameraTargetPosition = cameraCurTarget + dy * retain;

            cameraState.animate({
              to: {
                cameraPositionY: cameraState.cameraPositionY + dy * retain,
                cameraTargetPositionY: cameraTargetPosition
              },
              duration: params.cameraPositionDriftLength,
              curve: Easing.Exponential.EaseOut
            });

            //onCameraTargetDestinationChange();


          } else if (BookDisplayer.active &&
              BookDisplayer.active.fullyOut && dragged) {

            snapBook();

          }

          _this.domElement.removeEventListener('mousemove', onDocumentMouseDrag);
          _this.domElement.removeEventListener('mouseup', onDocumentMouseUp);
          window.removeEventListener('mouseout', onDocumentMouseUp);

          return false;
        }

        var shouldRender = true;

        /**
         * Called every frame, updates camera position and renders scene.
         */
        function loop() {

//          console.log(BookDisplayer.loading == true);

          requestAnimationFrame(loop);
          shouldRender = animate.update() || shouldRender ||  BookDisplayer.loading || _this.frameCount < 600000;

          _this.frameCount++;

          // Move our camera around.
          updateCameraPosition();

          // Point the canvas at our eyes
          //gesture.updatePosition(camera, fov);

          directionalLight.position.x = Math.cos(cameraState.orbit+Math.PI/3);
          directionalLight.position.z = Math.sin(cameraState.orbit+Math.PI/3);
          directionalLight.position.normalize();

          // Move the light
          pointLight.position.x = Math.cos(cameraState.orbit) * params.lightDistance;
          pointLight.position.z = Math.sin(cameraState.orbit) * params.lightDistance;
          pointLight.position.y = camera.position.y;
//          pointLight.updateMatrix();
//          console.log(pointLight.position.y, camera.position.y);

//          pointLight2.position.x = Math.cos(cameraState.orbit + Math.PI/2.5) * params.lightDistance;
//          pointLight2.position.z = Math.sin(cameraState.orbit + Math.PI/2.5) * params.lightDistance;
//          pointLight2.position.y = camera.position.y;
//
//
//          pointLight3.position.x = Math.cos(cameraState.orbit - Math.PI/2.5) * params.lightDistance;
//          pointLight3.position.z = Math.sin(cameraState.orbit - Math.PI/2.5) * params.lightDistance;
//          pointLight3.position.y = camera.position.y+10;


           var ty = Math.floor(
              camera.position.y / params.shelfHeight) * params.shelfHeight;
          shelf.mesh.position.y = ty;
          shelf.mesh.updateMatrix();

          labelManager.update();

          // Move our books up and down.
          assignPositions();

          for (var i = 0, l = _this.bookDisplayers.length; i < l; i++) {
            _this.bookDisplayers[i].update(camera);
          }

          // Move the active book in and out.
          // TWEEN.update();

          // Apply textures that have been waiting.
          // Honor ajax requests that have been waiting.
          var renderTextures = _this.library.update();

//          console.log(shouldRender);

          if (shouldRender || renderTextures) {
            renderer.render(scene, camera);
          }

//          demonstrator.update();

//          gesture.draw();
          if (urlArgs['stats'] == 'true' || urlArgs['stats'] == '1') stats.update();

          shouldRender = false;

        }

        /**
         * Opens to the inside of the currently active book.
         *
         * @param {Function} [onComplete] Function to execute when the animation is
         * complete.
         */
        function openBook(onComplete) {
          morphingBook.animate({
            from: {
              open: 0
            },
            to: {
              open: 1
            },
            duration: (params.maxOpen - morphingBook.opened) / params.openVel,
            onUpdate: getUpdateOpened(true),
            onComplete: function() {
              bringUpCloseButton(true);
              if (urlArgs['installation'] === undefined &&
                  urlArgs['installation_debug'] === undefined ) {
                bringUpClickToRead();
              }
              if (_.isFunction(onComplete)) {
                onComplete();
              }
            }
          });
        }

        /**
         * Closes the currently active book.
         *
         * @param {Function} [onComplete] Function to execute when the animation is
         * complete.
         */
        function closeBook(onComplete) {
          morphingBook.animate({
            from: {
              open: 1
            },
            to: {
              open: 0
            },
            duration: morphingBook.opened / params.openVel,
            onUpdate: getUpdateOpened(false),
            onComplete: function() {
              bringUpCloseButton(false)
              if (urlArgs['installation'] === undefined &&
                  urlArgs['installation_debug'] === undefined ) {
                $(clickToRead).fadeOut();
              }
              if (_.isFunction(onComplete)) {
                onComplete();
              }
            }
          });
        }

        /**
         * Fully opens or closes the active book depending on its starting state and
         * current opened value.
         *
         * @param {Boolean} [invert=false] If true, reverses the open condition
         */
        function snapBook(invert) {

          invert = invert || false;

          var shouldOpen = morphingBook.opened > (downOpened > 0.5 ?
              params.maxOpen - params.openThreshold :
              params.openThreshold);

          if (invert) shouldOpen = !shouldOpen;

          if (shouldOpen) {
            _this.openBook();
          } else {
            _this.closeBook();
          }
        }

        /**
         * Updates the camera position based on cameraState.
         */
        function updateCameraPosition() {

          var s = Math.abs(Math.atan2(cameraState.cameraTargetPositionY -
              cameraState.cameraPositionY,
              params.cameraDistance - params.spiralRadius));

          s = Math.min(s, params.fovCap);

          var fovI = Math.pow(s / params.fovCap, params.fovCurve);

          fov = params.baseFov + (params.scaleFov ? fovI *
              (params.maxFov - params.baseFov) : 0);
          var cameraDistance = params.cameraDistance * params.baseFov / fov;

          camera.fov = fov;
          camera.updateProjectionMatrix();

          camera.position.x = Math.cos(cameraState.orbit) * (cameraDistance);
          camera.position.z = Math.sin(cameraState.orbit) * (cameraDistance);

          camera.target.position.y = cameraState.cameraTargetPositionY +
              utils.orbitToY(cameraState.orbit);

          camera.position.y = cameraState.cameraPositionY +
              utils.orbitToY(cameraState.orbit);

        }

        /**
         * onUpdate style function for active book opening animation.
         *
         * @param {Number} t Time value from 0 - 1 with 1 being complete.
         */
        function updateOpened(t) {

          // TODO bandaid.
          if (BookDisplayer.active == null) return;

          // Position the close button

          morphingBook.opened = datutils.lerp(0, params.maxOpen, t);
          morphingBook.mesh.rotation.y =
              datutils.cmap(Easing.Sinusoidal.EaseInOut(t), 0, 1,
                  BookDisplayer.active.targetAngle,
                  BookDisplayer.active.targetAngle - Math.PI / 2);

          shouldRender = true;

        }

        function isBookDisplayer(o, distance) {
          return o.bookDisplayer !== undefined &&
              o.visible &&
              distance < params.cameraDistance;
        }

        function isLabel(o, distance) {
          return o.labelInfo !== undefined && distance < params.cameraDistance;
        }

        function isActiveBook(o) {
          for (var i in morphingBook.mesh.children)
            if (o == morphingBook.mesh.children[i])
              return true;
          return false;
        }

        /**
         * Returns an onUpdate style function accounting for the book's starting
         * opened value.
         *
         * @param {Boolean} openingUp Is the book opening or closing?
         */
        function getUpdateOpened(openingUp) {
          var startT = datutils.map(morphingBook.opened, 0, params.maxOpen, 0, 1);
          return function(values, t) {

            var ft = datutils.map(t, 0, 1, startT, openingUp ? 1 : 0);
            if (!openingUp) {
              ft = datutils.map(Easing.Quadratic.EaseOut(t), 0, 1, startT, 0);
            } else {
              ft = datutils.map(Easing.Circular.EaseOut(t), 0, 1, startT, 1);
            }
            updateOpened(ft);
          }
        }

        /**
         * Returns an object representing the current camera state.
         */
        function copyCameraState() {
          var r = {};
          for (var i in cameraState) {
            r[i] = cameraState[i];
          }
          return r;
        }

        /**
         * Returns an onUpdate style function to update the active book close
         * icon.
         *
         * @param {Number} opened A number from 0 - 1, with 1 being open.
         */
        function updateCloseButtonPosition(opened) {

          if (_.isUndefined(opened)) {
            opened = 0;
          } else {
            opened = Math.round(opened);
          }

          var screenPos = projector.projectVector(
              morphingBook.getTopRight(opened), camera);
          var y = viewOffset.fullHeight / 2 * (1 - screenPos.y) -
              $(closeButton).height() / 2;
          var x = viewOffset.fullWidth / 2 * (screenPos.x + 1) -
              $(closeButton).width() / 2;

          closeButton.style.top = y + 'px';
          closeButton.style.left = x + 'px';

        }

        function updateClickToRead(opened) {

          var screenPos = projector.projectVector(
              morphingBook.getBottomMiddleRight(opened), camera);
          var y = viewOffset.fullHeight / 2 * (1 - screenPos.y) -
            $(clickToRead).height() / 2;
              // $(clickToRead).height() / 2 - 60;
          var x = viewOffset.fullWidth / 2 * (screenPos.x + 1) -
            $(clickToRead).width() / 2;
              // $(clickToRead).width() / 2 - 286;

          clickToRead.style.top = y + 'px';
          clickToRead.style.left = x + 'px';
        }

        function fadeOutCloseButton(callback) {
          $(closeButton).fadeOut(params.closeButtonFadeSpeed, function() {
            window.removeEventListener('resize', resizeCloseButton, false);
            if (_.isFunction(callback)) {
              callback();
            }
          });
        }

        function fadeOutClickToRead(callback) {
          $(clickToRead).fadeOut(params.closeButtonFadeSpeed, function() {
            window.removeEventListener('resize', resizeClickToRead, false);
            if (_.isFunction(callback)) {
              callback();
            }
          });
        }

        function bringUpCloseButton(opened) {
          updateCloseButtonPosition(opened);
          $(closeButton).fadeIn(function() {
            window.addEventListener('resize', resizeCloseButton, false);
          });
        }

        function bringUpClickToRead() {
          if (disableClickToRead) {
            return;
          }
          updateClickToRead(1);
          $(clickToRead).fadeIn(function() {
            window.addEventListener('resize', resizeClickToRead, false);
          });
        }

        function resizeCloseButton(e) {
          updateCloseButtonPosition(morphingBook.open);
        }

        function resizeClickToRead(e) {
          updateClickToRead(1);
        }

        function setBookFog(near, far) {
          _.each(_this.bookDisplayers, function(v,i) {
            v.staticBook.material.uniforms['fogNear'].value = near;
            v.staticBook.material.uniforms['fogFar'].value = far;
          });
        }

      };

  return Bookshelf;

});
