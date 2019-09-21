/* eslint-disable no-control-regex */
const qs = require('querystring');

const TOKEN_RE = /\r\u0000\n\u0003\r/g;
const PLUS_RE = /\+/g;
const TOKEN = '\r\u0000\n\u0003\r';
const decoder = {
  decodeURIComponent(s) {
    s = s.replace(TOKEN_RE, '+');
    return qs.unescape(s);
  },
};
const rawDecoder = {
  decodeURIComponent(s) {
    return s.replace(TOKEN_RE, '+');
  },
};

function parse(str, sep, eq, escape) {
  try {
    if (str.indexOf('+') === -1 || str.indexOf(TOKEN) !== -1) {
      return qs.parse(str, sep, eq, escape);
    }
    str = str.replace(PLUS_RE, TOKEN);
    return qs.parse(str, sep, eq, escape ? rawDecoder : decoder);
  } catch (e) {
    //
  }
  return '';
}

module.exports = parse;
