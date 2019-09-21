const REG_EXP_RE = /^\/(.+)\/(i)?$/;
function isRegExp(regExp) {
  return REG_EXP_RE.test(regExp);
}

function toRegExp(regExp, ignoreCase) {
  regExp = REG_EXP_RE.test(regExp);
  try {
    regExp = regExp && new RegExp(RegExp.$1, ignoreCase ? 'i' : RegExp.$2);
  } catch (e) {
    regExp = null;
  }
  return regExp;
}

function hasProtocol(url) {
  return /^[a-z0-9.-]+:\/\//i.test(url);
}

function getProtocol(url) {
  return hasProtocol(url) ? url.substring(0, url.indexOf('://') + 1) : null;
}

function removeProtocol(url, clear) {
  return hasProtocol(url) ? url.substring(url.indexOf('://') + (clear ? 3 : 1)) : url;
}

/**
 * 解析一些字符时，encodeURIComponent可能会抛异常，对这种字符不做任何处理
 * see: http://stackoverflow.com/questions/16868415/encodeuricomponent-throws-an-exception
 * @param ch
 * @returns
 */
function safeEncodeURIComponent(ch) {
  try {
    return encodeURIComponent(ch);
  } catch (e) {
    //
  }

  return ch;
}

exports.escapeRegExp = (str) => {
  if (!str) {
    return '';
  }
  return str.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
};
exports.hasProtocol = hasProtocol;
exports.getProtocol = getProtocol;
exports.removeProtocol = removeProtocol;
exports.encodeURIComponent = safeEncodeURIComponent;
exports.isRegExp = isRegExp;
exports.toRegExp = toRegExp;
