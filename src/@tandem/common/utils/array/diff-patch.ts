export interface IArrayChangeAddition {
  index: number;
  value: any;
}

export enum DiffKind {
  REMOVE = 0,
  INSERT = REMOVE + 1,
  UPDATE = UPDATE + 1
}

export interface IArrayDiffChange {
  readonly kind: DiffKind;
}

export class ArrayDiffInsert<T>  implements IArrayDiffChange {
  readonly kind = DiffKind.INSERT;
  constructor(readonly index: number, readonly value: T) { }
}

export class ArrayDiffRemove {
  readonly kind = DiffKind.REMOVE;
  constructor(readonly index: number) { }
}

export class ArrayDiffUpdate<T> {
  readonly kind = DiffKind.UPDATE;
  constructor(readonly originalOldIndex: number, readonly patchedOldIndex: number, readonly newValue: T, readonly newIndex: number) { }
}

export interface IArrayDiffVisitor<T> {
  visitRemove(del: ArrayDiffRemove);
  visitInsert(insert: ArrayDiffInsert<T>);
  visitUpdate(update: ArrayDiffUpdate<T>);
}

export class ArrayDiff<T> {
  constructor(
    readonly deletes: ArrayDiffRemove[],
    readonly inserts: ArrayDiffInsert<T>[],
    readonly updates: ArrayDiffUpdate<T>[]
  ) { }

  accept(visitor: IArrayDiffVisitor<T>) {
    this.deletes.forEach(remove => visitor.visitRemove(remove));
    this.inserts.forEach(insert => visitor.visitInsert(insert));
    this.updates.forEach(update => visitor.visitUpdate(update));
  }
}

export function diffArray<T>(oldArray: Array<T>, newArray: Array<T>, countDiffs: (a: T, b: T) => number): ArrayDiff<T> {

  // model used to figure out the proper mutation indices
  const model    = oldArray.concat();

  // remaining old values to be matched with new values. Remainders get deleted.
  const oldPool  = oldArray.concat();

  // remaining new values. Remainders get inserted.
  const newPool  = newArray.concat();

  const removes: ArrayDiffRemove[]    = [];
  const inserts: ArrayDiffInsert<T>[] = [];
  const updates: ArrayDiffUpdate<T>[] = [];
  const matches: Array<[T, T]>        = [];

  for (let i = 0, n = oldPool.length; i < n; i++) {

    const oldValue = oldPool[i];
    let bestNewValue;

    let fewestDiffCount = Infinity;

    // there may be multiple matches, so look for the best one
    for (let j = 0, n2 = newPool.length; j < n2; j++) {

      const newValue   = newPool[j];

      // -1 = no match, 0 = no change, > 0 = num diffs
      let diffCount = countDiffs(oldValue, newValue);

      if (~diffCount && diffCount < fewestDiffCount) {
        bestNewValue    = newValue;
        fewestDiffCount = diffCount;
      }

      // 0 = exact match, so break here.
      if (fewestDiffCount === 0) break;
    }

    // subtract matches from both old & new pools and store
    // them for later use
    if (bestNewValue) {
      oldPool.splice(i--, 1);
      n--;
      newPool.splice(newPool.indexOf(bestNewValue), 1);
      matches.push([oldValue, bestNewValue]);
    }
  }

  for (let i = 0, n = oldPool.length; i < n; i++) {
    const oldValue  = oldPool[i];
    const index     = oldArray.indexOf(oldValue);
    removes.push(new ArrayDiffRemove(index));
    model.splice(index, 1);
  }

  for (let i = 0, n = newPool.length; i < n; i++) {
    const newValue = newPool[i];
    const index    = newArray.indexOf(newValue);
    inserts.push(new ArrayDiffInsert(index, newValue));
    model.splice(index, 0, newValue);
  }

  // apply updates last using indicies from the old array model. This ensures
  // that mutations are properly applied to whatever target array.
  for (let i = 0, n = matches.length; i < n; i++) {
    const [oldValue, newValue] = matches[i];
    updates.push(new ArrayDiffUpdate(oldArray.indexOf(oldValue), model.indexOf(oldValue), newValue, newArray.indexOf(newValue)));
  }

  return new ArrayDiff(
    removes,
    inserts,
    updates
  );
}

export function patchArray<T>(target: Array<T>, diff: ArrayDiff<T>, mapUpdate: (a: T, b: T) => T, mapInsert?: (b: T) => T) {
  diff.accept({
    visitInsert({ index, value }) {
      target.splice(index, 0, mapInsert(value));
    },
    visitRemove({ index }) {
      target.splice(index, 1);
    },
    visitUpdate({ patchedOldIndex, newValue, newIndex }) {
      const oldValue     = target[patchedOldIndex];
      const patchedValue = mapUpdate(oldValue, newValue);
      if (patchedValue !== oldValue || patchedOldIndex !== newIndex) {
        if (patchedOldIndex !== newIndex) {
          target.splice(patchedOldIndex, 1);
        }
        target.splice(newIndex, 0, patchedValue);
      }
    }
  });
}