const pkg = require('../package.json');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { version } = pkg;
const newVal = version.replace(/(\w+\.\w+\.)(\w+)/g, (_, left, right) => {
  return left + (Number(right)+1);
})

const exec = (v) => console.log(execSync(v, {"encoding": 'utf-8', cwd: process.cwd() }));

// 构建
exec('pnpm build');

// 改版本
pkg.version = newVal;
fs.writeFileSync(path.resolve(process.cwd(), './package.json'), JSON.stringify(pkg, undefined, 2)+'\n');

// 发布
exec('pnpm pub');

console.log('发布成功🤡~')