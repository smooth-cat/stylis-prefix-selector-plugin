export class LimitMap<K, V> extends Map<K, V> {
  constructor(private limit = 1000, entries?: readonly (readonly [K, V])[] | null) {
    super(entries);
  }
  
  zeroSet = new Set();
  zeroOne() {
    return  this.zeroSet.values().next()?.value;
  }

  set (key: K, value: V) {
    // 如果达到满状态, 删掉一个 0 引用的对象
    if(this.size === this.limit) {
      const zeroKey = this.zeroOne();
      this.delete(zeroKey);
      this.zeroSet.delete(zeroKey);
    }
    // 新添加的引用为 0
    this.zeroSet.add(key);
    super.set(key, value);
    return this
  }

  get (key: K): V {
    // 删除 0 引用
    if(this.zeroSet.has(key)) {
      this.zeroSet.delete(key);
    }
    return super.get(key);
  }
}

// const a = new LimitMap(3);
// a.set('1', 123);
// a.set('2', 123);
// a.set('3', 123);
// a.get('1');
// a.set('4', 123);
// console.log(a.get('1'), a.get(2));
 