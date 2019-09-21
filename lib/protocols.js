/* eslint-disable eqeqeq */
/* eslint-disable no-use-before-define */
/* eslint-disable no-underscore-dangle */
const protocols = [
  'G',
  'host',
  'rule',
  'pipe',
  'weinre',
  'proxy',
  'https2http-proxy',
  'http2https-proxy',
  'internal-proxy',
  'pac',
  'filter',
  'ignore',
  'enable',
  'disable',
  'delete',
  'log',
  'plugin',
  'referer',
  'auth',
  'ua',
  'urlParams',
  'params',
  'resMerge',
  'statusCode',
  'replaceStatus',
  'redirect',
  'method',
  'cache',
  'attachment',
  'forwardedFor',
  'responseFor',
  'rulesFile',
  'resScript',
  'reqDelay',
  'resDelay',
  'headerReplace',
  'reqSpeed',
  'resSpeed',
  'reqType',
  'resType',
  'reqCharset',
  'resCharset',
  'reqCookies',
  'resCookies',
  'reqCors',
  'resCors',
  'reqHeaders',
  'resHeaders',
  'reqPrepend',
  'resPrepend',
  'reqBody',
  'resBody',
  'reqAppend',
  'resAppend',
  'urlReplace',
  'reqReplace',
  'resReplace',
  'reqWrite',
  'resWrite',
  'reqWriteRaw',
  'resWriteRaw',
  'cssAppend',
  'htmlAppend',
  'jsAppend',
  'cssBody',
  'htmlBody',
  'jsBody',
  'cssPrepend',
  'htmlPrepend',
  'jsPrepend',
];

const aliasProtocols = {
  ruleFile: 'rulesFile',
  ruleScript: 'rulesFile',
  rulesScript: 'rulesFile',
  reqScript: 'rulesFile',
  pathReplace: 'urlReplace',
  download: 'attachment',
  'http-proxy': 'proxy',
  'xhttp-proxy': 'xproxy',
  status: 'statusCode',
  hosts: 'host',
  xhost: 'host',
  html: 'htmlAppend',
  js: 'jsAppend',
  reqMerge: 'params',
  css: 'cssAppend',
  excludeFilter: 'filter',
  includeFilter: 'filter',
};
exports.protocols = protocols;
exports.aliasProtocols = aliasProtocols;

function resetRules() {
  return protocols.reduce((rules, protocol) => {
    rules[protocol] = [];
    return rules;
  }, {});
}

function getRules() {
  return resetRules({});
}

exports.getRules = getRules;
