/* eslint-disable no-misleading-character-class */
/* eslint-disable no-plusplus */
/* eslint-disable no-use-before-define */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-cond-assign */
/* eslint-disable no-multi-assign */
const net = require('net');
const protoMgr = require('./protocols');
const util = require('./utils');

const SPACE_RE = /\s+/g;
const MULTI_TO_ONE_RE = /^\s*line`\s*[\r\n]([\s\S]*?)[\r\n]\s*`\s*$/gm;
const MULTI_LINE_VALUE_RE = /^[^\n\r\S]*(```+)[^\n\r\S]*(\S+)[^\n\r\S]*[\r\n]([\s\S]+?)[\r\n][^\n\r\S]*\1\s*$/gm;
const WEB_PROTOCOL_RE = /^(?:https?|wss?|tunnel):\/\//;
const PORT_RE = /^host:\/\/(?:([^[\]:]*)|\[([:\da-f]*:[\da-f]*:[\da-f]+)\])(?::(\d+))?$/i;
const PLUGIN_RE = /^(?:plugin|whistle)\.([a-z\d_-]+:\/\/[\s\S]*)/;
const HOST_RE = /^(?:(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)|[:\da-f]*:[\da-f]*:[\da-f]+|\[[:\da-f]*:[\da-f]*:[\da-f]+\])(?::\d+)?$/i;
const FILE_RE = /^(?:[a-z]:(?:\\|\/[^/])|\/[^/])/i;
const PROXY_RE = /^x?(?:socks|proxy|https?-proxy|internal-proxy|https2http-proxy|http2https-proxy):\/\//;
const NO_SCHEMA_RE = /^\/\/[^/]/;
const WILDCARD_RE = /^(\$?((?:https?|wss?|tunnel):\/\/)?([^/]+))/;
const VALUE_KEY_RE = /^\{(\S+)\}$/;
const LINE_END_RE = /\n|\r\n|\r/g;
const PATH_RE = /^<.*>$/;
const VALUE_RE = /^\(.*\)$/;
const REG_URL_RE = /^((?:[\w.*-]+:|\*+)?\/\/)?([\w*.-]*)/;
const REG_URL_SYMBOL_RE = /^(\^+)/;
const PATTERN_FILTER_RE = /^(?:filter|ignore):\/\/(.+)\/(i)?$/;
const FILTER_RE = /^(?:excludeFilter|includeFilter):\/\/(.*)$/;
const PROPS_FILTER_RE = /^(?:filter|excludeFilter|includeFilter|ignore):\/\/(m(?:ethod)?|i(?:p)?|h(?:eader)?|s(?:tatusCode)?|b(?:ody)?|clientIp|clientIP|serverIp|serverIP|req(?:H(?:eaders?)?)?|res(?:H(?:eaders?)?)?):(.+)$/;
const PATTERN_WILD_FILTER_RE = /^(?:filter|ignore):\/\/(!)?(\*+\/)/;
const WILD_FILTER_RE = /^(\*+\/)/;
const { aliasProtocols } = protoMgr;
const DOMAIN_STAR_RE = /([*~]+)(\\.)?/g;
const STAR_RE = /\*+/g;
const PORT_PATTERN_RE = /^!?:\d{1,5}$/;
const COMMENT_RE = /#.*$/;
let inlineValues;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u001e\u001f\u200e\u200f\u200d\u200c\u202a\u202d\u202e\u202c\u206e\u206f\u206b\u206a\u206d\u206c]+/g;

function domainToRegExp(all, star, dot) {
  const len = star.length;
  let result = len > 1 ? '([^/]*)' : '([^/.]*)';
  if (dot) {
    result += '\\.';
    if (len > 2) {
      result = `(?:${result})?`;
    }
  }
  return result;
}

function pathToRegExp(all) {
  const len = all.length;
  if (len > 2) {
    return '(.*)';
  }
  return len > 1 ? '([^?]*)' : '([^?/]*)';
}

function queryToRegExp(all) {
  return all.length > 1 ? '(.*)' : '([^&]*)';
}

function isRegUrl(url) {
  // eslint-disable-next-line no-use-before-define
  const not = isNegativePattern(url);
  if (not) {
    url = url.substring(1);
  }
  const hasStartSymbol = REG_URL_SYMBOL_RE.test(url);
  let hasEndSymbol;
  let ignoreCase;
  if (hasStartSymbol) {
    ignoreCase = RegExp.$1.length;
    url = url.substring(ignoreCase);
    hasEndSymbol = /\$$/.test(url);
    if (hasEndSymbol) {
      url = url.slice(0, -1);
    }
  }
  if (!hasStartSymbol || !REG_URL_RE.test(url)) {
    return false;
  }
  let protocol = RegExp.$1 || '';
  let domain = RegExp.$2;
  let pathname = url.substring(protocol.length + domain.length);
  let query = '';
  const index = pathname.indexOf('?');
  if (index !== -1) {
    query = pathname.substring(index);
    pathname = pathname.substring(0, index);
  }
  if (!protocol || protocol === '//') {
    protocol = '[a-z]+://';
  } else {
    protocol = util.escapeRegExp(protocol).replace(/\*+/, '([a-z:]+)');
  }
  domain = util.escapeRegExp(domain);
  if (domain) {
    domain = domain.replace(DOMAIN_STAR_RE, domainToRegExp);
  } else {
    domain = '[^/]*';
  }
  if (pathname) {
    pathname = util.escapeRegExp(pathname).replace(STAR_RE, pathToRegExp);
  } else if (query || hasEndSymbol) {
    pathname = '/';
  }
  query = util.escapeRegExp(query).replace(STAR_RE, queryToRegExp);
  const pattern = `^${protocol}${domain}${pathname}${query}${hasEndSymbol ? '$' : ''}`;
  try {
    return {
      not,
      pattern: new RegExp(pattern, ignoreCase ? 'i' : ''),
    };
  } catch (e) {
    //
  }
  return {};
}

function getRealProtocol(matcher) {
  const index = matcher.indexOf(':');
  if (index === -1) {
    return;
  }
  const protocol = matcher.substring(0, index);
  return aliasProtocols[protocol];
}

function detactShorthand(url) {
  if (NO_SCHEMA_RE.test(url)) {
    return url;
  }

  if (url === '{}' || VALUE_KEY_RE.test(url) || PATH_RE.test(url) || VALUE_RE.test(url)) {
    return `file://${url}`;
  }

  if (url === '/' || (FILE_RE.test(url) && !util.isRegExp(url))) {
    return `file://${url}`;
  }
  // compact Chrome
  if (/^file:\/\/\/[A-Z]:\//.test(url)) {
    return `file://${url.substring(8)}`;
  }

  if (/^@/.test(url)) {
    if (url.indexOf('@://') === -1) {
      url = `@://${url.substring(1)}`;
    }
    return url.replace('@', 'G');
  }

  return url;
}

function formatUrl(pattern) {
  let queryString = '';
  const queryIndex = pattern.indexOf('?');
  if (queryIndex !== -1) {
    queryString = pattern.substring(queryIndex);
    pattern = pattern.substring(0, queryIndex);
  }
  let index = pattern.indexOf('://');
  index = pattern.indexOf('/', index === -1 ? 0 : index + 3);
  return (index === -1 ? `${pattern}/` : pattern) + queryString;
}

function toLine(_, line) {
  return line.replace(SPACE_RE, ' ');
}

function getLines(text) {
  if (!text || !(text = text.trim())) {
    return [];
  }
  text = text.replace(MULTI_TO_ONE_RE, toLine);
  const lines = text.split(LINE_END_RE);
  const result = [];
  // eslint-disable-next-line arrow-parens
  lines.forEach((line) => {
    line = line.trim();
    if (!line) {
      return;
    }
    result.push(line);
  });
  return result;
}

function parseWildcard(pattern, not) {
  if (!WILDCARD_RE.test(pattern)) {
    return;
  }
  let preMatch = RegExp.$1;
  const protocol = RegExp.$2;
  const domain = RegExp.$3;
  if (domain.indexOf('*') === -1 && domain.indexOf('~') === -1) {
    return;
  }
  if (not) {
    return false;
  }
  let path = pattern.substring(preMatch.length) || '/';
  const isExact = preMatch.indexOf('$') === 0;
  if (isExact) {
    preMatch = preMatch.substring(1);
  }
  if ((domain === '*' || domain === '~') && path.charAt(0) === '/') {
    preMatch += '*';
  }
  const index = path.indexOf('?');
  const hasQuery = index !== -1;
  if (hasQuery && index === 0) {
    path = `/${path}`;
  }
  const dLen = domain.length;
  preMatch = util.escapeRegExp(preMatch).replace(DOMAIN_STAR_RE, domainToRegExp);
  if (domain[dLen - 1] !== '*' && domain.indexOf(':') === -1) {
    preMatch += '(?::\\d+)?';
  }
  if (!protocol) {
    preMatch = `[a-z]+://${preMatch}`;
  } else if (protocol === '//') {
    preMatch = `[a-z]+:${preMatch}`;
  }
  preMatch = `^(${preMatch})`;

  return {
    preMatch: new RegExp(preMatch),
    path,
    hasQuery,
    isExact,
  };
}
function parseRule(rules, pattern, matcher, raw, options) {
  // eslint-disable-next-line no-use-before-define
  if (isNegativePattern(matcher)) {
    return;
  }
  const rawPattern = pattern;
  let wildcard;
  let noSchema;
  let isRegExp;
  let port;
  let protocol;
  let isExact;

  const not = isNegativePattern(pattern);
  // 位置不能变
  const isPortPattern = PORT_PATTERN_RE.test(pattern);
  if (not) {
    pattern = pattern.substring(1);
  }
  if (NO_SCHEMA_RE.test(pattern)) {
    noSchema = true;
    pattern = pattern.substring(2);
  }
  if (!pattern) {
    return;
  }
  if (isPortPattern) {
    isRegExp = true;
    pattern = new RegExp(`^[\\w]+://[^/]+${pattern}/`);
  }
  if (!isRegExp && (isRegExp = util.isRegExp(pattern)) && !(pattern = util.toRegExp(pattern))) {
    return;
  }
  if (!isRegExp) {
    wildcard = parseWildcard(pattern, not);
    if (wildcard === false) {
      return;
    }
    if (!wildcard && isExactPattern(pattern)) {
      isExact = true;
      pattern = pattern.slice(1);
    } else if (not) {
      return;
    }
  }
  const isIp = net.isIP(matcher);
  if (isIp || HOST_RE.test(matcher)) {
    matcher = `host://${matcher}`;
    protocol = 'host';
  } else if (matcher[0] === '/') {
    if (matcher[1] === '/') {
      protocol = 'rule';
    } else {
      matcher = `file://${matcher}`;
      protocol = 'file';
    }
  } else if (PLUGIN_RE.test(matcher)) {
    protocol = 'plugin';
  } else if (PROXY_RE.test(matcher)) {
    protocol = 'proxy';
  } else if (!(protocol = getRealProtocol(matcher))) {
    protocol = matcher.match(/^([\w-]+):\/\//);
    protocol = protocol && protocol[1];
    if (matcher === 'host://') {
      matcher = 'host://127.0.0.1';
    }
  }
  let list = rules[protocol];
  if (!list) {
    protocol = 'rule';
    list = rules[protocol];
  }
  if (!isIp && protocol === 'host' && PORT_RE.test(matcher)) {
    matcher = `host://${RegExp.$1 || RegExp.$2}`;
    port = RegExp.$3;
  }
  const rule = {
    not,
    name: protocol,
    isTpl: protocol === 'log' || protocol === 'weinre' ? false : undefined,
    wildcard,
    isRegExp,
    isExact,
    protocol: isRegExp ? null : util.getProtocol(pattern),
    pattern: isRegExp ? pattern : formatUrl(pattern),
    matcher,
    port,
    raw,
    isDomain: !isRegExp && !not && (noSchema ? pattern : util.removeProtocol(rawPattern, true)).indexOf('/') === -1,
    rawPattern,
    filters: options.filters,
  };

  if (list) {
    list.push(rule);
  }
}

function isPattern(item) {
  return (
    PORT_PATTERN_RE.test(item) ||
    NO_SCHEMA_RE.test(item) ||
    isExactPattern(item) ||
    isRegUrl(item) ||
    isNegativePattern(item) ||
    WEB_PROTOCOL_RE.test(item) ||
    util.isRegExp(item)
  );
}

function isHost(item) {
  return net.isIP(item) || HOST_RE.test(item);
}

function indexOfPattern(list) {
  let ipIndex = -1;
  for (let i = 0, len = list.length; i < len; i++) {
    const item = list[i];
    if (isPattern(item)) {
      return i;
    }

    if (!util.hasProtocol(item)) {
      if (!isHost(item)) {
        return i;
      }
      if (ipIndex === -1) {
        ipIndex = i;
      }
    }
  }
  return ipIndex;
}

function resolveFilterPattern(matcher) {
  let not;
  let isInclude;
  let filter;
  let caseIns;
  let wildcard;
  if (PATTERN_FILTER_RE.test(matcher)) {
    filter = RegExp.$1;
    caseIns = RegExp.$2;
    not = filter[0] === '!';
    if (not) {
      filter = filter.substring(1);
    }
    if (filter[0] === '/') {
      filter = filter.substring(1);
    }
    return filter
      ? {
          not,
          filter,
          caseIns,
        }
      : false;
  }
  if (FILTER_RE.test(matcher)) {
    filter = RegExp.$1;
    if (!filter || filter === '!') {
      return false;
    }
    not = isInclude = matcher[0] === 'i';
    if (filter[0] === '!') {
      not = !not;
      filter = filter.substring(1);
    }
    if (util.isRegExp(filter)) {
      filter = RegExp.$1;
      caseIns = RegExp.$2;
      return {
        not,
        isInclude,
        filter,
        caseIns,
      };
    }
    if (filter[0] === '/' && filter[1] !== '/') {
      wildcard = '/';
    } else if (WILD_FILTER_RE.test(filter)) {
      wildcard = RegExp.$1;
    }
  } else if (PATTERN_WILD_FILTER_RE.test(matcher)) {
    not = RegExp.$1 || '';
    wildcard = RegExp.$2;
  } else {
    return;
  }
  if (wildcard) {
    matcher = filter || matcher.substring(matcher.indexOf('://') + 3 + not.length);
    let path = util.escapeRegExp(matcher.substring(wildcard.length));
    if (path.indexOf('*') !== -1) {
      path = path.replace(STAR_RE, pathToRegExp);
    } else if (path && path[path.length - 1] !== '/') {
      path += '(?:[/?]|$)';
    }
    return {
      not,
      isInclude,
      filter: `^[a-z]+://[^/]+/${path}`,
    };
  }
  const result = isRegUrl(`^${filter}`);
  if (result) {
    result.not = not;
    result.isInclude = isInclude;
    return result;
  }
}

function resolveMatchFilter(list) {
  const matchers = [];
  let filters;
  let filter;
  let not;
  let isInclude;
  let hasBodyFilter;
  let orgVal;
  list.forEach((matcher) => {
    if (PROPS_FILTER_RE.test(matcher)) {
      filters = filters || [];
      let propName = RegExp.$1;
      let value = RegExp.$2;
      not = isInclude = matcher[1] === 'n';
      if (value[0] === '!') {
        not = !not;
        value = value.substring(1);
        if (!value) {
          return;
        }
      }
      let pattern;
      const isIp = propName === 'i' || propName === 'ip';
      let isClientIp;
      let isServerIp;
      if (!isIp) {
        isClientIp = propName[0] === 'c';
        isServerIp = !isClientIp && (propName === 'serverIp' || propName === 'serverIP');
      }
      if (isIp || isClientIp || isServerIp) {
        pattern = util.toRegExp(value);
        if (!pattern && !net.isIP(value)) {
          return;
        }
        if (isIp) {
          propName = pattern ? 'iPattern' : 'ip';
        } else if (isClientIp) {
          propName = pattern ? 'clientPattern' : 'clientIp';
        } else if (isServerIp) {
          propName = pattern ? 'serverPattern' : 'serverIp';
        }
        value = pattern || value;
      } else if (propName[0] === 'm') {
        pattern = util.toRegExp(value, true);
        propName = pattern ? 'mPattern' : 'method';
        value = pattern || value.toUpperCase();
      } else if (propName === 's' || propName === 'statusCode') {
        pattern = util.toRegExp(value);
        propName = pattern ? 'sPattern' : 'statusCode';
        value = pattern || value.toLowerCase();
      } else if (propName === 'b' || propName === 'body') {
        hasBodyFilter = true;
        pattern = util.toRegExp(value);
        if (pattern) {
          propName = 'bodyPattern';
          value = pattern;
        } else {
          propName = 'body';
          value = {
            orgVal: util.encodeURIComponent(value).toLowerCase(),
            value: value.toLowerCase(),
          };
        }
      } else {
        const index = value.indexOf('=');
        if (index === -1 || !index || index === value.length - 1) {
          return;
        }
        let key = value.substring(0, index).toLowerCase();
        const lastIndex = key.length - 1;
        if (key[lastIndex] === '!') {
          key = key.substring(0, lastIndex);
          if (!key) {
            return;
          }
          not = !not;
        }
        orgVal = value.substring(index + 1);
        value = { key };
        if ((pattern = util.toRegExp(orgVal))) {
          value.hPattern = pattern;
        } else {
          orgVal = value.orgVal = orgVal.toLowerCase();
          value.value = util.encodeURIComponent(orgVal);
        }
        switch (propName[2]) {
          case 'q':
            propName = 'reqHeader';
            break;
          case 's':
            propName = 'resHeader';
            break;
          default:
            propName = 'header';
        }
      }
      filter = { not, isInclude };
      filter[propName] = value;
      return filters.push(filter);
    }
    const result = resolveFilterPattern(matcher);
    if (result === false) {
      return;
    }
    if (!result) {
      matchers.push(matcher);
      return;
    }
    if (result.pattern) {
      filters = filters || [];
      result.raw = matcher;
      return filters.push(result);
    }
    filter = `/${result.filter}/${result.caseIns ? 'i' : ''}`;
    if ((filter = util.toRegExp(filter))) {
      filters = filters || [];
      filters.push({
        raw: matcher,
        pattern: filter,
        not: result.not,
      });
    }
  });
  return {
    hasBodyFilter,
    matchers,
    filters,
  };
}

function parseText(text) {
  const rules = protoMgr.getRules();
  getLines(text).forEach((line) => {
    const raw = line;
    line = line.replace(COMMENT_RE, '').trim();
    line = line && line.split(/\s+/);
    const len = line && line.length;
    if (!len || len < 2) {
      return;
    }
    line = line.map(detactShorthand);
    const patternIndex = indexOfPattern(line);
    if (patternIndex === -1) {
      return;
    }

    const pattern = line[0];
    const result = resolveMatchFilter(line.slice(1));
    const { matchers } = result;
    if (patternIndex > 0) {
      // supports: operator-uri1 operator-uriX pattern1 pattern2 ... patternN
      const opList = [pattern];
      const patternList = matchers.filter((p) => {
        if (isPattern(p) || isHost(p) || !util.hasProtocol(p)) {
          return true;
        }
        opList.push(p);
        return false;
      });
      opList.forEach((matcher) => {
        // eslint-disable-next-line no-shadow
        patternList.forEach((pattern) => {
          parseRule(rules, pattern, matcher, raw, result);
        });
      });
    } else {
      matchers.forEach((matcher) => {
        parseRule(rules, pattern, matcher, raw, result);
      });
    }
  });
  return rules;
}

function isExactPattern(pattern) {
  return /^\$/.test(pattern);
}

function isNegativePattern(pattern) {
  return /^!/.test(pattern);
}

function resolveInlineValues(str) {
  str = str && str.replace(CONTROL_RE, '').trim();
  if (!str || str.indexOf('```') === -1) {
    return str;
  }
  return str.replace(MULTI_LINE_VALUE_RE, (_, __, key, value) => {
    inlineValues = inlineValues || {};
    if (!inlineValues[key]) {
      inlineValues[key] = value;
    }
    return '';
  });
}

function resolveInlineValuesFn(item) {
  item.text = resolveInlineValues(item.text);
  return item;
}

function trimInlineValues(text) {
  return Array.isArray(text) ? text.map(resolveInlineValuesFn) : resolveInlineValues(text);
}

function parse(text) {
  return parseText(trimInlineValues(text));
}

module.exports = parse;
