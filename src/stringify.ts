
const isObjectLike = (v: any) => Object.prototype.toString.call(v).match(/\[object (Array|Object)\]/)
const last = (arr: any[]) => arr[arr.length - 1];

const a = {
  value: 'aaa',
};

const c = {
  value: {
    x: 0,
    y: 1,
  },
  a,
};

// @ts-ignore
a.c = c;

const e =  {
  a,
  c,
}

export function stringify(obj: object, space: string | number | undefined = 2) {

	let objPaths: any[] = [];
  const handled = new Map();

	const result = JSON.stringify(obj, replacer, space);
  function replacer(this: object, key: string, val: any) {
    // console.log(this, key);
    // 非对象不用处理
    if (!isObjectLike(val)) {
      return val;
    }

    const lastOne = last(objPaths);
    const isSon = this === lastOne;
    // 是的话就说明正在访问子节点，访问子节点，将 value push 到 paths。遍历到 obj 时，list 推入 obj，其他操作不处理
    if (isSon || val === obj) {
      objPaths.push({ key, val });
    }
    // 不是的话就是访问 paths 将 找到 this 节点，将其后的替换成本节点
    else {
      const parentI = objPaths.findIndex((it) => it.val === this);
      objPaths = [...objPaths.slice(0, parentI + 1), { key, val}];
    }

    // 未访问过 set ← val
    if (!handled.has(val)) {
      const path = getPathFromObjs(objPaths);
      // console.log('__paths', objPaths, paths);
      // 标记已处理的对象
      handled.set(val, path)
      return val;
    }

    // 已访问过，返回 objPaths.join
    const path = handled.get(val);
    return path;
  }

  function getPathFromObjs(objs: any[]) {
    const path = objs.map((it) => it.key).join('.')
    return `root${path}`;
  }

  return result;
}

// console.log(stringify(e));