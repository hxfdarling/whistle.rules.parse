# whistle.rules.parse

将 whistle 规则解析成 json 对象，便于其他程序处理 whistle 规则，规则基于 `whistle1.15.x` 实现

## usage

```js
const parse = require('whistle.rules.parse');
const rules = parse('*.baidu.com 127.0.0.1:8080');
```
