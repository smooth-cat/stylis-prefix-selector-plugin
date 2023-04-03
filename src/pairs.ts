// import { log } from './log';
/*
 * @Description:想到了更好的正则匹配方式
 */

export type IReplacer<R = string> = (combo: ILevelMarkCombo, level: number, i: number) => R | void;

export type IReplaceSticker = (prev: any, next: any) => any;

export type IBlocksCatchProps<R = string> = {
  startReg: RegExp;
  endReg: RegExp;
  str: string;
  useStrAsRoot?: boolean;
  filterContentSpace?: boolean;
  replacer?: IReplacer<R>;
  /** replacer 替换片段与非替换粘连起来的方法 */
  replaceSticker?: IReplaceSticker;
	replaceComment?: boolean;
};

export type IMatch = {
  /** 匹配标识符左侧 */
  left: number;
  /** 匹配标识符右侧 */
  right: number;
  /** 主 match */
  match: string;
  /** 匹配标识符右侧 */
  subMatches: string[];
};

/** 每一层级中，每一对是一个 MarkCombo */
export type ILevelMarkCombo = {
  startMatch: IMatch;
  endMatch: IMatch;
  content: Omit<IMatch, 'subMatches'>;
  parent: ILevelMarkCombo | null;
  children: ILevelMarkCombo[];
  root: ILevelMarkCombo | null;
  replacedMatch?: string;
  replacedContent?: string;
};

class IdxArr<T> extends Array<T> {
  idx = 0;
  constructor(...args: any[]) {
    super(...args);
  }

  iItem = () => {
    return this[this.idx];
  };
}

export type ILoopCb = (combo: ILevelMarkCombo, level: number, i: number) => void;

class LevelMarks<R = string> extends Array<IdxArr<ILevelMarkCombo>> {
  constructor(...args: any[]) {
    super(...args);
  }

  loop = (cb: ILoopCb) => {
    this.forEach((levelMark, level) => {
      levelMark.forEach((combo, i) => {
        cb(combo, level, i);
      });
    });
  };

  replacer?: IReplacer<R>;
  replaceSticker?: IReplaceSticker;
  str = '';

  strRoot: ILevelMarkCombo | null = null;

  getReplaced = () => {
    // 获取最外层匹配串中所有替换字符串，将整体字符串做替换
    return this.strRoot?.replacedMatch as R;
  };
}

/**
 * 获取对称标识符中间的代码块
 * @prop startReg: RegExp,
 * @prop endReg: RegExp,
 */
export const _pairs = <R = string>({
  startReg,
  endReg,
  str,
  filterContentSpace,
  replacer,
  replaceSticker,
  useStrAsRoot = false,
	replaceComment = false,
}: IBlocksCatchProps<R>) => {
  if (typeof str !== 'string') {
    return ({ getReplaced: () => str, loop: () => {} } as any) as LevelMarks<R>;
  }

	if(replaceComment) {
		// 去除注释
		// str = str.replace(REG_COMMENT, '');
	}

  let level = 0;
  startReg = RegExp(startReg.source, 'g');
  endReg = RegExp(endReg.source, 'g');
  /** 按层级收集到的对称标签位置 */
  const levelMarks = new LevelMarks<R>();

  // 用于作为返回值获取替换值是否有变更的判断值
  levelMarks.replacer = replacer;
  levelMarks.replaceSticker = replaceSticker;
  levelMarks.str = str;

  /**
   * 0: "a" 匹配到的所有字符串
   * index: 1 在整个字符串中的位置
   * input: "baa"
   */
  let startMatch: IMatch | null = getExecMatch(startReg, str);
  let endMatch: IMatch | null = getExecMatch(endReg, str);
  // let parendMatch: IMatch | null = null;

  /** 参考点, 默认从右开始 */
  let refMatch = endMatch;

  /** 是左参考点还是右参考点 */
  let isRightRef = true;

  let strRoot = getDefaultRoot(str);
  let parent: ILevelMarkCombo | null = useStrAsRoot ? strRoot : null;

  /**
   * 1. 从左往右开始计算，先匹配 start
   * 2. 设置参考点，参考点左右
   * 3. 死循环
   *   - 如果左右标签都遍历完则结束
   *   - 根据参考点遍历括号
   *     1. 是右参考点，遍历左括号，直至超过参考点，
   *     2. 期间每一次遍历到都增加 level
   *     3. 超过参考点后以参考点为起始位置开始遍历右参考点
   *     ...
   */
  while (1) {
    if (!startMatch && !endMatch) {
      break;
    }

    let isBeyond = false;

    // console.log('left', stringify({
    // 	startMatch, endMatch, refMatch, isRightRef, level
    // }, 2) );

    // 记录左边界
    if (isRightRef && startMatch) {
      isBeyond = beyondRefI(startMatch!);
      if (!isBeyond) {
        const levelMark = getLevelMark(levelMarks, level);

        let root = parent;
        let temp = parent;
        while ((temp = temp?.parent!) != null) {
          root = temp;
        }

        const current = { startMatch, parent, root } as any;
        if (parent) {
          if (!parent?.children) parent.children = [];
          parent.children.push(current);
        }

        levelMark.push(current);
        // 取下一个点位
        startMatch = getExecMatch(startReg, str);
        level++;
        parent = current;
      }
    }

    // 记录右边界
    if (!isRightRef && endMatch) {
      isBeyond = beyondRefI(endMatch!);
      // console.log('right-isBeyond', isBeyond);
      if (!isBeyond) {
        // 推入 endMatch
        level--;
        const levelMark = getLevelMark(levelMarks, level);
        const current = levelMark.iItem();
        current.endMatch = endMatch!;
        // 计算 content
        const left = current.startMatch.right;
        const right = endMatch.left;
        let match = str.slice(left, right);
        // // 计算 match 需要根据儿子的替换情况拼接
        // let match = str.slice(left, right);
        // let replacedMatch = match;
        // let prevI = 0;
        // if (replacer) {
        //   const children = current.children || [];
        //   // 找上一替换位置右侧到这一替换位置左侧的片段加上替换片段
        //   children.forEach(child => {
        //     if (child.replacedContent == null) return;
        //     const rLeft = child.startMatch.left - left;
        //     const rRihgt = right - child.endMatch.right;
        //     replacedMatch += match.slice(prevI, rLeft) + child.replacedContent;
        //     prevI = rRihgt;
        //   });
        //   if (prevI > 0 && prevI < match.length) {
        //     replacedMatch += match.slice(prevI, match.length);
        //   }
        // }

        const { replacedMatch, replacedContent } = getReplacedByChild<R>(
          current.children,
          current.startMatch,
          endMatch,
          str,
          replacer,
          replaceSticker,
        );
        // 这里先暂时存放一下给用户，等用户改完后再用修改后的值替换
        current.replacedMatch = replacedMatch;
        current.replacedContent = replacedContent;
        current.content = {
          left,
          right,
          match: filterContentSpace ? match.replace(/\s/g, '') : match,
        };

        const replaced = replacer?.(current, level, levelMark.idx);
        // 如果子块有替换，但父块返回 null，仍然认为父块进行了替换
        if (replaced != null) {
          current.replacedMatch = replaced as any;
        }

        levelMark.idx++;

        parent = parent?.parent || null;
        // 取下一个点位
        endMatch = getExecMatch(endReg, str);
      }
    }

    if (isBeyond) {
      isRightRef ? (refMatch = startMatch) : (refMatch = endMatch);
      isRightRef = !isRightRef;
      continue;
    }
    // 左标签已找完，不用再找了
    if (!startMatch) {
      isRightRef = false;
      refMatch = {
        left: Infinity,
        right: Infinity,
        match: '',
        subMatches: [],
      };
    }

    // 右标签已找完，不用再找了，应该不存在
    // if(!endMatch) {
    // 	isRightRef = true;
    // 	refMatch = {
    // 		left: Infinity,
    // 		right: Infinity,
    // 		match: '',
    // 		subMatches: [],
    // 	}
    // }
  }

  function beyondRefI(target: IMatch) {
    const isBeyond = target.left >= refMatch!.right;
    return isBeyond;
  }

  strRoot.children = levelMarks[0];
  strRoot.replacedMatch = getReplacedByChild(
    strRoot.children,
    {
      match: '',
      left: 0,
      right: 0,
      subMatches: [],
    },
    {
      match: '',
      left: str.length,
      right: str.length,
      subMatches: [],
    },
    str,
    replacer,
    replaceSticker,
  ).replacedMatch;
  levelMarks.strRoot = strRoot;

  return levelMarks;
};

function getDefaultRoot(str: string): ILevelMarkCombo {
  const root = {
    startMatch: {
      left: 0,
      right: 0,
      match: '',
      subMatches: [],
    },
    endMatch: {
      left: str.length,
      right: str.length,
      match: '',
      subMatches: [],
    },
    content: {
      left: 0,
      right: str.length,
      match: '',
    },
    parent: null,
    children: [],
    root: null,
    replacedContent: '',
    replacedMatch: '',
  };
  return root;
}

function getReplacedByChild<R>(
  children: ILevelMarkCombo[] = [],
  // left: number,
  // right: number,
  startMatch: IMatch,
  endMatch: IMatch,
  str: string,
  replacer?: IReplacer<R>,
  replaceSticker: IReplaceSticker = (prev, next) => String(prev) + String(next),
) {
  const { left } = startMatch;
  const { right } = endMatch;

  const startLen = startMatch.match.length;
  const endLen = endMatch.match.length;


  // 计算 match 需要根据儿子的替换情况拼接
  let match = str.slice(left, right);
  let replacedMatch = '';
  let prevI = 0;
  if (replacer && children.length) {
    // 找上一替换位置右侧到这一替换位置左侧的片段加上替换片段
    children.forEach((child) => {
      if (child.replacedMatch == null) return;
      const rLeft = child.startMatch.left - left; // 1
      const rRight = child.endMatch.right - left; // 9
      replacedMatch = replaceSticker(
        replacedMatch,
        replaceSticker(match.slice(prevI, rLeft), child.replacedMatch),
      );
      //  += ( + );
      prevI = rRight;
    });
    if (prevI > 0 && prevI < match.length) {
      replacedMatch = replaceSticker(replacedMatch, match.slice(prevI, match.length));
    }
  } else {
    replacedMatch = match;
  }
  return {
    replacedMatch,
    replacedContent: replacedMatch.slice(startLen, -endLen)
  };
}

function getLevelMark(levelMarks: IdxArr<ILevelMarkCombo>[], i: number) {
  if (levelMarks[i]) {
    return levelMarks[i];
  }
  return (levelMarks[i] = new IdxArr());
}

function getExecMatch(regexp: RegExp, str: string) {
  const value = regexp.exec(str);
  return value ? getMatch(value) : null;
}

function getMatch(arr: RegExpExecArray): IMatch {
  const [match, ...subMatches] = arr;
  const left = arr.index;
  const right = arr.index + match.length;
  return {
    match,
    subMatches,
    left,
    right,
  };
}

// const REG_COMMENT = /(\/\/[^\n]*\n)|(\/\*((?!\*\/)(.|\n))*\*\/)/g;
/*----------------- test -----------------*/

export const pairs: (typeof _pairs) = ((props) => {
  try {
    return _pairs(props);
  } catch (error) {
    const str = props?.str
    console.error('匹配字符串失败', { error, str });
    return { getReplaced: () => str || '', loop: () => { } }
  }
}) as any

// const pair = pairs({
//   startReg: /([^\{\}\;\n]*)\{/,
//   endReg: /\}/,
//   str: `
//   .acb {
//     .ggg {

//     }
//   } 
//   .cde { }`,
//   replacer({ startMatch, endMatch, replacedContent }) {
//     console.log({replacedContent});
    
//     return '[app] '+ startMatch?.subMatches?.[0] + '{' + replacedContent + endMatch.match;
//   },
// })

// console.log(pair.getReplaced());
