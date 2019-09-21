/* eslint-disable arrow-parens */
const parse = require('./index');

describe('test rules', () => {
  it('parse', async () => {
    const result = parse(`
//baidu.com 127.0.0.1:8080
/web/token https://qq.com/web/token
qq.com 127.0.0.1:8080/web
//nohost.bytedance.net/web 127.0.0.1:8080/web
fudao.qq.com file:///User/zman/qq
`);
    Object.keys(result).forEach((key) => {
      const t = result[key];
      Object.keys(t).forEach((key2) => {
        console.log(t[key2].rawPattern);
      });
    });
    expect('module').toMatchSnapshot('module');
  });
});
