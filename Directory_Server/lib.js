/*
  Copyright (c) <2016> <Various Authors>

  Permission is hereby granted, free of charge, to any person obtaining a copy of
  this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
  OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/



if( typeof XMLHttpRequest == "undefined" ) XMLHttpRequest = function() {
  try { return new ActiveXObject("Msxml2.XMLHTTP.6.0") } catch(e) {}
  try { return new ActiveXObject("Msxml2.XMLHTTP.3.0") } catch(e) {}
  try { return new ActiveXObject("Msxml2.XMLHTTP") } catch(e) {}
  try { return new ActiveXObject("Microsoft.XMLHTTP") } catch(e) {}
  throw new Error( "This browser does not support XMLHttpRequest." )
};

function echo_clear(nodename) {
  if (nodename == null)
    nodename = "jsout";
  var jsout = document.getElementById(nodename);
  if (!jsout)
    throw "no element with id 'jsout' found";
  while(jsout.childNodes.length)
    jsout.removeChild(jsout.firstChild)
};
function echo_append(msg, nodename) {
  if (nodename == null)
    nodename = "jsout";
  var jsout = document.getElementById(nodename);
  jsout.appendChild(document.createTextNode(msg));
  jsout.appendChild(document.createElement("br"));
};
function echo_set(msg, nodename) {
  echo_clear(nodename);
  echo_append(msg, nodename);
};

function pretty_hex(input) {
  //returns a "pretty" hex representation of the 8-bit input string
  //example: "de:ad:be:ef:12:8b:28:3a"
  if (input == undefined)
    return;
  hex = "";
  for(var i = 0; i < input.length; ++i) {
    var c = input.charCodeAt(i);
    if (c > 0xFF && !arguments[1].ignore_errors)
      throw "this is not a 8-bit string!";
    else
    hex += (c < 16 ? "0" : "")
         + c.toString(16)
         + (i == input.length-1 ? "" : ":")
         + (i%16==15 ? " " : "");
  }
  return hex;
}

function straight_hex(input) {
  //returns a "straigh" hex representation of the 8-bit input string
  //example: "deadbeef128b283a"
  if (input == undefined)
    return;
  hex = "";
  var access;
  if (typeof input == "string")
    access = function(s,i) { return s.charCodeAt(i); };
  else if (input instanceof Array)
    access = function(s,i) { return s[i]; };
  else throw "straight_hex: input must be String or Array";
  for(var i = 0; i < input.length; ++i)
    hex += (access(input,i) < 16 ? "0" : "")
         + access(input,i).toString(16);
  return hex;
}

function to8bit(input) {
  //XMLHttpRequest adds 0xf700 to all binary data > 0x7f
  //this function simply removes the first byte using & 0xFF
  if (typeof input == "string") {
    //too bad, we cant actually manipulate JS strings, so we have to make a new one
    output = ""
    for(var i = 0; i < input.length; ++i)
      output += String.fromCharCode(input.charCodeAt(i) & 0xFF);
    return output;
  } else
    throw "and0xFF: type " + typeof input + ": implement me!"
}

function loadfiles(filenames, readyfunction) {
  function Fileloader(filenames, readyfunction) {
    this.filenames = filenames;
    this.files = {};
    this.requests = [];
    this.readyfunction = readyfunction;
    this.fired = false;
    this.loadfiles();
  }

  Fileloader.prototype.waitforall = function() {
    for(var i = 0; i < this.filenames.length; ++i)
      if (this.files[this.filenames[i]] == undefined)
        return;
    //now this is a lame mutex... dont know if its needed
    if (this.fired)
      return;
    this.fired = true;
    this.readyfunction(this.files);
  }

  Fileloader.prototype.loadfiles = function() {
    for(var i = 0; i < this.filenames.length; ++i) {
      this.requests[i] = new XMLHttpRequest();
      this.requests[i].open("GET", this.filenames[i], true);
      this.requests[i].onreadystatechange = function(filename, loader) {
        return function() {
          if(this.readyState == 4 && this.status == 200) {
            loader.files[filename] = this.responseText;
            loader.waitforall();
          }
          else if (this.readyState == 4 && this.status > 400) {
            throw "Fileloader::loadfiles(): Error code " + this.status;
          }
        }
      }(this.filenames[i], this);
      this.requests[i].send("");
    }
  }

  var loader = new Fileloader(filenames, readyfunction);
}

function fetch(url, opts) {
  //synchronously fetches a document
  opts = opts || {};
  var req = new XMLHttpRequest();
  if (!opts.dont_leak_random)
    url += "?leaking_random="+Math.floor(4294967296 * Math.random()).toString(16);
  req.open('GET', url, false);
//   if (content_type)
//     req.setRequestHeader("Content-Type", content_type);
  req.send(null);

  if (200 == req.status)
    return req.responseText;
  else {
    echo_append("fetch(): status code " + req.status + " fetching file '" + url + "'");
    throw("fetch(): status code " + req.status);
  }
};

//utf8_encode from webtoolkit.info, license unknown :(
function utf8_encode(string) {
  string = string.replace(/\r\n/g,"\n");
  var utftext = "";

  for (var n = 0; n < string.length; n++) {

    var c = string.charCodeAt(n);

    if (c < 128) {
      utftext += String.fromCharCode(c);
    }
    else if((c > 127) && (c < 2048)) {
      utftext += String.fromCharCode((c >> 6) | 192);
      utftext += String.fromCharCode((c & 63) | 128);
    }
    else {
      utftext += String.fromCharCode((c >> 12) | 224);
      utftext += String.fromCharCode(((c >> 6) & 63) | 128);
      utftext += String.fromCharCode((c & 63) | 128);
    }

  }

  return utftext;
};

//returns (binary) 8bit string from hexadecimal string
function h2s(h) {
  var ret = "";
  h.replace(/(..)/g,
    function(s) {
      ret += String.fromCharCode(parseInt(s, 16));
    });
  return ret;
}

curve25519_zero = function() {
  return [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
}

curve25519_one = function() {
  return [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
}

curve25519_nine = function() {
  return [9,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
}

curve25519_clamp = function(curve) {
  //makes a private key out of the curve
  curve[15] &= 0xF8FF;
  curve[0] &= 0xFF7F;
  curve[0] |= 0x0040;
  return curve;
}

curve25519_clamp_string = function(s) {
  return curve25519_to8bitString(curve25519_clamp(curve25519_from8bitString(s)));
}

curve25519_getbit = function(curve, c) {
  return Math.floor(curve[Math.floor(c / 16)] / Math.pow(2, c % 16)) % 2;
}

curve25519_from8bitString = function(/*8bit string */ s) {
  var curve = curve25519_zero();
  if (32 != s.length)
    throw "curve25519_fromString(): input string must exactly be 32 bytes";
  for(var i = 0; i < 16; ++i)
    //weird encoding from curve25519lib...
    curve[i] = s.charCodeAt(31-i*2) | (s.charCodeAt(30-i*2) << 8);
  return curve;
}

curve25519_to8bitString = function(curve) {
  var s = "";
  //weird encoding from curve25519lib...
  //todo: check if this encoding also applies for DJB's code (probably doesnt? does he even handle encodings?)
  for(var i = 15; i >= 0; --i)
    s += String.fromCharCode(((curve[i] >>> 8) & 0xFF), (curve[i] & 0xFF));
  return s;
}

curve25519_prime = [0xffff-18, 0xffff, 0xffff, 0xffff,  0xffff, 0xffff, 0xffff, 0xffff,  0xffff, 0xffff, 0xffff, 0xffff,  0xffff, 0xffff, 0xffff, 0x7fff];

curve25519_compare = function (a ,b) {
  var c;
  for (c = 15; c >= 0; c--) {
    var x = a[c];
    var y = b[c];
    if (x > y) {
      return 1;
    }
    if (x < y) {
      return -1;
    }
  }
  return 0;
}

curve25519_add = function (a, b) {
  var r = [];
  var v;
  r[0] = (v = a[0] + b[0]) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + a[1] + b[1]) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + a[2] + b[2]) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + a[3] + b[3]) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + a[4] + b[4]) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + a[5] + b[5]) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + a[6] + b[6]) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + a[7] + b[7]) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + a[8] + b[8]) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + a[9] + b[9]) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + a[10] + b[10]) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + a[11] + b[11]) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + a[12] + b[12]) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + a[13] + b[13]) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a[14] + b[14]) % 0x10000;
  r[15] = Math.floor(v / 0x10000) + a[15] + b[15];
  return r;
}

curve25519_substract = function (a, b) {
  var r = [];
  var v;
  r[0] = (v = 0x80000 + a[0] - b[0]) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[1] - b[1]) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[2] - b[2]) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[3] - b[3]) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[4] - b[4]) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[5] - b[5]) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[6] - b[6]) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[7] - b[7]) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[8] - b[8]) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[9] - b[9]) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[10] - b[10]) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[11] - b[11]) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[12] - b[12]) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[13] - b[13]) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[14] - b[14]) % 0x10000;
  r[15] = Math.floor(v / 0x10000) - 8 + a[15] - b[15];
  return r;
}

curve25519_sqr8h = function (a7, a6, a5, a4, a3, a2, a1, a0) {
  var r = [];
  var v;
  r[0] = (v = a0*a0) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + 2*a0*a1) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + 2*a0*a2 + a1*a1) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + 2*a0*a3 + 2*a1*a2) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + 2*a0*a4 + 2*a1*a3 + a2*a2) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + 2*a0*a5 + 2*a1*a4 + 2*a2*a3) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + 2*a0*a6 + 2*a1*a5 + 2*a2*a4 + a3*a3) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + 2*a0*a7 + 2*a1*a6 + 2*a2*a5 + 2*a3*a4) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + 2*a1*a7 + 2*a2*a6 + 2*a3*a5 + a4*a4) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + 2*a2*a7 + 2*a3*a6 + 2*a4*a5) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + 2*a3*a7 + 2*a4*a6 + a5*a5) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + 2*a4*a7 + 2*a5*a6) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + 2*a5*a7 + a6*a6) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + 2*a6*a7) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a7*a7) % 0x10000;
  r[15] = Math.floor(v / 0x10000);
  return r;
}

curve25519_sqrmodp = function(a) {
  var x = curve25519_sqr8h(a[15], a[14], a[13], a[12], a[11], a[10], a[9], a[8]);
  var z = curve25519_sqr8h(a[7], a[6], a[5], a[4], a[3], a[2], a[1], a[0]);
  var y = curve25519_sqr8h(a[15] + a[7], a[14] + a[6], a[13] + a[5], a[12] + a[4], a[11] + a[3], a[10] + a[2], a[9] + a[1], a[8] + a[0]);
  var r = [];
  var v;
  r[0] = (v = 0x800000 + z[0] + (y[8] -x[8] -z[8] + x[0] -0x80) * 38) % 0x10000;
  r[1] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[1] + (y[9] -x[9] -z[9] + x[1]) * 38) % 0x10000;
  r[2] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[2] + (y[10] -x[10] -z[10] + x[2]) * 38) % 0x10000;
  r[3] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[3] + (y[11] -x[11] -z[11] + x[3]) * 38) % 0x10000;
  r[4] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[4] + (y[12] -x[12] -z[12] + x[4]) * 38) % 0x10000;
  r[5] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[5] + (y[13] -x[13] -z[13] + x[5]) * 38) % 0x10000;
  r[6] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[6] + (y[14] -x[14] -z[14] + x[6]) * 38) % 0x10000;
  r[7] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[7] + (y[15] -x[15] -z[15] + x[7]) * 38) % 0x10000;
  r[8] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[8] + y[0] -x[0] -z[0] + x[8] * 38) % 0x10000;
  r[9] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[9] + y[1] -x[1] -z[1] + x[9] * 38) % 0x10000;
  r[10] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[10] + y[2] -x[2] -z[2] + x[10] * 38) % 0x10000;
  r[11] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[11] + y[3] -x[3] -z[3] + x[11] * 38) % 0x10000;
  r[12] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[12] + y[4] -x[4] -z[4] + x[12] * 38) % 0x10000;
  r[13] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[13] + y[5] -x[5] -z[5] + x[13] * 38) % 0x10000;
  r[14] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[14] + y[6] -x[6] -z[6] + x[14] * 38) % 0x10000;
  r[15] = 0x7fff80 + Math.floor(v / 0x10000) + z[15] + y[7] -x[7] -z[7] + x[15] * 38;
  curve25519_reduce(r);
  return r;
}

curve25519_mul8h = function(a7, a6, a5, a4, a3, a2, a1, a0, b7, b6, b5, b4, b3, b2, b1, b0) {
  var r = [];
  var v;
  r[0] = (v = a0*b0) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + a0*b1 + a1*b0) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + a0*b2 + a1*b1 + a2*b0) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + a0*b3 + a1*b2 + a2*b1 + a3*b0) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + a0*b4 + a1*b3 + a2*b2 + a3*b1 + a4*b0) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + a0*b5 + a1*b4 + a2*b3 + a3*b2 + a4*b1 + a5*b0) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + a0*b6 + a1*b5 + a2*b4 + a3*b3 + a4*b2 + a5*b1 + a6*b0) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + a0*b7 + a1*b6 + a2*b5 + a3*b4 + a4*b3 + a5*b2 + a6*b1 + a7*b0) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + a1*b7 + a2*b6 + a3*b5 + a4*b4 + a5*b3 + a6*b2 + a7*b1) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + a2*b7 + a3*b6 + a4*b5 + a5*b4 + a6*b3 + a7*b2) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + a3*b7 + a4*b6 + a5*b5 + a6*b4 + a7*b3) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + a4*b7 + a5*b6 + a6*b5 + a7*b4) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + a5*b7 + a6*b6 + a7*b5) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + a6*b7 + a7*b6) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a7*b7) % 0x10000;
  r[15] = Math.floor(v / 0x10000);
  return r;
}

curve25519_mulmodp = function(a, b) {
  // Karatsuba multiplication scheme: x*y = (b^2+b)*x1*y1 - b*(x1-x0)*(y1-y0) + (b+1)*x0*y0
  var x = curve25519_mul8h(a[15], a[14], a[13], a[12], a[11], a[10], a[9], a[8], b[15], b[14], b[13], b[12], b[11], b[10], b[9], b[8]);
  var z = curve25519_mul8h(a[7], a[6], a[5], a[4], a[3], a[2], a[1], a[0], b[7], b[6], b[5], b[4], b[3], b[2], b[1], b[0]);
  var y = curve25519_mul8h(a[15] + a[7], a[14] + a[6], a[13] + a[5], a[12] + a[4], a[11] + a[3], a[10] + a[2], a[9] + a[1], a[8] + a[0],
  			b[15] + b[7], b[14] + b[6], b[13] + b[5], b[12] + b[4], b[11] + b[3], b[10] + b[2], b[9] + b[1], b[8] + b[0]);
  var r = [];
  var v;
  r[0] = (v = 0x800000 + z[0] + (y[8] -x[8] -z[8] + x[0] -0x80) * 38) % 0x10000;
  r[1] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[1] + (y[9] -x[9] -z[9] + x[1]) * 38) % 0x10000;
  r[2] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[2] + (y[10] -x[10] -z[10] + x[2]) * 38) % 0x10000;
  r[3] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[3] + (y[11] -x[11] -z[11] + x[3]) * 38) % 0x10000;
  r[4] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[4] + (y[12] -x[12] -z[12] + x[4]) * 38) % 0x10000;
  r[5] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[5] + (y[13] -x[13] -z[13] + x[5]) * 38) % 0x10000;
  r[6] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[6] + (y[14] -x[14] -z[14] + x[6]) * 38) % 0x10000;
  r[7] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[7] + (y[15] -x[15] -z[15] + x[7]) * 38) % 0x10000;
  r[8] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[8] + y[0] -x[0] -z[0] + x[8] * 38) % 0x10000;
  r[9] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[9] + y[1] -x[1] -z[1] + x[9] * 38) % 0x10000;
  r[10] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[10] + y[2] -x[2] -z[2] + x[10] * 38) % 0x10000;
  r[11] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[11] + y[3] -x[3] -z[3] + x[11] * 38) % 0x10000;
  r[12] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[12] + y[4] -x[4] -z[4] + x[12] * 38) % 0x10000;
  r[13] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[13] + y[5] -x[5] -z[5] + x[13] * 38) % 0x10000;
  r[14] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[14] + y[6] -x[6] -z[6] + x[14] * 38) % 0x10000;
  r[15] = 0x7fff80 + Math.floor(v / 0x10000) + z[15] + y[7] -x[7] -z[7] + x[15] * 38;
  curve25519_reduce(r);
  return r;
}

curve25519_reduce = function (a) {
  var v = a[15];
  if (v < 0x8000) return;
  a[15] = v % 0x8000;
  v = Math.floor(v / 0x8000) * 19;
  a[0] = (v += a[0]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[1] = (v += a[1]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[2] = (v += a[2]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[3] = (v += a[3]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[4] = (v += a[4]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[5] = (v += a[5]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[6] = (v += a[6]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[7] = (v += a[7]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[8] = (v += a[8]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[9] = (v += a[9]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[10] = (v += a[10]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[11] = (v += a[11]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[12] = (v += a[12]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[13] = (v += a[13]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[14] = (v += a[14]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) return;
  a[15] += v;
}

curve25519_addmodp = function(a, b) {
  var r = [];
  var v;
  r[0] = (v = (Math.floor(a[15] / 0x8000) + Math.floor(b[15] / 0x8000)) * 19 + a[0] + b[0]) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + a[1] + b[1]) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + a[2] + b[2]) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + a[3] + b[3]) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + a[4] + b[4]) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + a[5] + b[5]) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + a[6] + b[6]) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + a[7] + b[7]) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + a[8] + b[8]) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + a[9] + b[9]) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + a[10] + b[10]) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + a[11] + b[11]) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + a[12] + b[12]) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + a[13] + b[13]) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a[14] + b[14]) % 0x10000;
  r[15] = Math.floor(v / 0x10000) + a[15] % 0x8000 + b[15] % 0x8000;
  return r;
}

curve25519_submodp = function(a, b) {
  var r = [];
  var v;
  r[0] = (v = 0x80000 + (Math.floor(a[15] / 0x8000) - Math.floor(b[15] / 0x8000) - 1) * 19 + a[0] - b[0]) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[1] - b[1]) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[2] - b[2]) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[3] - b[3]) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[4] - b[4]) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[5] - b[5]) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[6] - b[6]) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[7] - b[7]) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[8] - b[8]) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[9] - b[9]) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[10] - b[10]) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[11] - b[11]) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[12] - b[12]) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[13] - b[13]) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[14] - b[14]) % 0x10000;
  r[15] = Math.floor(v / 0x10000) + 0x7ff8 + a[15]%0x8000 - b[15]%0x8000;
  return r;
}

curve25519_invmodp = function (a) {
  var c = a;
  var i = 250;
  while (--i) {
    a = curve25519_sqrmodp(a);
    //if (i > 240) { tracev("invmodp a", a); }
    a = curve25519_mulmodp(a, c);
    //if (i > 240) { tracev("invmodp a 2", a); }
  }
  a = curve25519_sqrmodp(a);
  a = curve25519_sqrmodp(a); a = curve25519_mulmodp(a, c);
  a = curve25519_sqrmodp(a);
  a = curve25519_sqrmodp(a); a = curve25519_mulmodp(a, c);
  a = curve25519_sqrmodp(a); a = curve25519_mulmodp(a, c);
  return a;
}

curve25519_mulasmall = function(a) {
  var m = 121665;
  var r = [];
  var v;
  r[0] = (v = a[0] * m) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + a[1]*m) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + a[2]*m) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + a[3]*m) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + a[4]*m) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + a[5]*m) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + a[6]*m) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + a[7]*m) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + a[8]*m) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + a[9]*m) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + a[10]*m) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + a[11]*m) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + a[12]*m) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + a[13]*m) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a[14]*m) % 0x10000;
  r[15] = Math.floor(v / 0x10000) + a[15]*m;
  curve25519_reduce(r);
  return r;
}

curve25519_dbl = function(x, z) {
  var x_2, z_2, m, n, o;
  ///tracev("dbl x", x);
  ///tracev("dbl z", z);
  m = curve25519_sqrmodp(curve25519_addmodp(x, z));
  //tracev("dbl m", curve25519_addmodp(x, z));
  n = curve25519_sqrmodp(curve25519_submodp(x, z));
  ///tracev("dbl n", n);
  o = curve25519_submodp(m, n);
  ///tracev("dbl o", o);
  x_2 = curve25519_mulmodp(n, m);
  //tracev("dbl x_2", x_2);
  z_2 = curve25519_mulmodp(curve25519_addmodp(curve25519_mulasmall(o), m), o);
  //tracev("dbl z_2", z_2);
  return [x_2, z_2];
}

function curve25519_sum(x, z, x_p, z_p, x_1) {
  var x_3, z_3, k, l, p, q;
  //tracev("sum x", x);
  //tracev("sum z", z);
  p = curve25519_mulmodp(curve25519_submodp(x, z), curve25519_addmodp(x_p, z_p));
  q = curve25519_mulmodp(curve25519_addmodp(x, z), curve25519_submodp(x_p, z_p));
  //tracev("sum p", p);
  //tracev("sum q", q);
  x_3 = curve25519_sqrmodp(curve25519_addmodp(p, q));
  z_3 = curve25519_mulmodp(curve25519_sqrmodp(curve25519_submodp(p, q)), x_1);
  return [x_3, z_3];
}
var Chance = require('chance');

function curve25519(f, c) {
  var a, x_1, q;

  x_1 = c;
  //tracev("c", c);
  //tracev("x_1", x_1);
  a = curve25519_dbl(x_1, curve25519_one());
  //tracev("x_a", a[0]);
  //tracev("z_a", a[1]);
  q = [ x_1, curve25519_one() ];

  var n = 255;

  while (curve25519_getbit(f, n) == 0) {
    n--;
    if (n < 0) {
      return curve25519_zero();
    }
  }
  n--;

  while (n >= 0) {
    var nn, n_a;
    var b = curve25519_getbit(f, n);
    if (b == 0) {
      nn = curve25519_dbl(q[0], q[1]);
      n_a = curve25519_sum(a[0], a[1], q[0], q[1], x_1);
    } else {
      nn = curve25519_sum(a[0], a[1], q[0], q[1], x_1);
      n_a = curve25519_dbl(a[0], a[1]);
    }
    q = nn; a = n_a;
    //tracev("xn", q[0]);
    //tracev("zn", q[1]);
    //tracev("x_a", &x_a);
    //tracev("z_a", &z_a);
    n--;
  }

  //tracev("x", q[0]);
  //tracev("z", q[1]);
  q[1] = curve25519_invmodp(q[1]);
  //tracev("1/z", q[1]);
  q[0] = curve25519_mulmodp(q[0], q[1]);
  curve25519_reduce(q[0]);
  return q[0];
}

module.exports.straight_hex = straight_hex;
module.exports.curve25519_to8bitString = curve25519_to8bitString;
module.exports.curve25519 = curve25519;
module.exports.curve25519_from8bitString = curve25519_from8bitString;
module.exports.curve25519_nine = curve25519_nine;
