import { pairs } from "./pairs";
import { LimitMap } from './limit-map';
import fs from 'fs';
import path from 'path';
import { stringify } from "./stringify";
export type PrefixOption = {
  prefix?: string;
  exclude?: RegExp;
  // TODO:
  ignoreFiles?: RegExp;
  // TODO:
  includeFiles?: RegExp;
  transform?: ((prefix: string, selector: string, prefixedSelector: string) => string|undefined);
  body?: boolean;
  isOld?: boolean;
  debug?: boolean;
  idClassOnly?: boolean;
};

// https://www.npmjs.com/package/stylis/v/3.5.4 参考，postProcess 类型是处理后的 css，这里我们就修改这种类型就好
export enum StylisCtxLevel {
  /* post-process context */
  postProcess = -2,
  /* preparation context */
  preparation = -1,
  /* newline context */
  newline = 0,
  /* property context */
  property = 1,
  /* selector block context */
  selector = 2,
  /* @at-rule block context */
  atRule = 3
}

type ICtx = Record<any, any> & PrefixOption & {
  selector: string;
  handledSelector: string;
}

const DefaultOpt: PrefixOption = {
  body: false,
}

/** 缓存 css 与 对应处理后的执行结果 */
const memoMap = new LimitMap(4000);

export const createPlugin = (opt: PrefixOption = {}) => {
  const fn = (
    ctx: StylisCtxLevel,
    str: string,
    // parent: string[],
    // selector: string[],
    // line: number,
    // column: number,
    // length: number,
    ) => {
    const notHasSelector = !str.includes('{');
    const hasHandled = str.includes(opt.prefix);
    const notCss = ctx !== StylisCtxLevel.postProcess;

    if(notCss || notHasSelector || hasHandled) {
      return str;
    }

    // 缓存
    if(memoMap.has(str)) {
      return memoMap.get(str);
    }


    // 1. 匹配所有选择器，即 match 内容以及 左边界值（选择器）
    const pair = pairs({
      // 匹配非 { | } | ;
      startReg: /([^\{\}\;]*)\{/,
      endReg: /\}/,
      str,
      replacer: ({ startMatch, replacedContent, endMatch, content }) => {
        const selector = startMatch?.subMatches?.[0];
        // 如果是 keyFrame 不替换
        if(ignoreKeyFrame(selector)) {
          return startMatch.match + content.match +  endMatch.match;
        }
  
        // 生成 ctx
        let ctx = { ...DefaultOpt, ...opt } as ICtx;
  
        // 2. 找到 selectors
        const selectors = selector.split(',');
  
        // 3. 替换
        const handledSelectors = selectors.map((s: string) => handleSelector(trimEpt(s), ctx))
  
        // 4. 合并
        const handledSelector = handledSelectors.join(',');
  
        // 5. 添加原来的空格
        return `${handledSelector}{${replacedContent}}`;
      },
    })
    
    const handled = pair.getReplaced()
    if(opt.debug) {
      console.log('[stylis-prefix-selector-plugin]', { raw: str, handled } );
    }
    // 缓存
    memoMap.set(str, handled)
    return handled;
  }

  Object.defineProperty(fn, 'name', { value: 'stylis-prefix-selector-plugin' });

  return fn;
}

/** 找到不为空的字符索引 */
const findNotEpt = (s: string) =>  {
  for (const i in s as any) {
    if(s[i]) {
      return Number(i);
    } 
  }
}

const ignoreKeyFrame = (selector: string) => {
  // 父级是 keyframe 的不做处理
  const keyframeRules = [
    'keyframes',
    '-webkit-keyframes',
    '-moz-keyframes',
    '-o-keyframes',
  ];

  if(keyframeRules.some((key) => selector.includes(key))) {
    return true;
  }

  return false;
}


const handleSelector = (selector: string, ctx: ICtx) => {
  let {
    prefix,
    exclude,
    // ignoreFiles,
    // includeFiles,
    transform,
    body,
    idClassOnly
  } = ctx;
    // 正则排除
    const shouldExclude = exclude && selector.match(exclude);
    // 默认忽略 body
    const ignoreBody =  !body && selector === 'body';
    // 选择器中 包含 id\class 才
    const notIdClass = idClassOnly && !selector.match(/[\.#]/);
  
    if (shouldExclude || ignoreBody || notIdClass) {
      return selector;
    }

  const prefixSelector = `${prefix} ${selector}`;

  // 没有处理直接返回带前缀的
  if(transform == null) return prefixSelector;

  // 处理结果
  const res = transform(prefix, selector, prefixSelector);

  // 未返回则不进行替换
  if(res == null) return selector;

  // 返回结果
  return res;
}

/** 替换掉选择器前后的空白 */
const trimEpt = (str: string) => str.replace(/\s*(\S[\s\S]*\S)\s*/, (_, path) => path);


// const str = createPlugin({
//   prefix: '[app]',
//   transform: function (prefix, selector, prefixedSelector) {
//     if(selector.match(/[\.#]/)) {
//       return prefixedSelector;
//     }
//     return selector;
//   },
// })(1, fs.readFileSync(path.resolve(__dirname, '../test/key.css'), {'encoding': 'utf-8'}));

// fs.writeFileSync(path.resolve(__dirname, '../test/key1.css'), str)