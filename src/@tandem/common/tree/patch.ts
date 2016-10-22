import { ITreeNode } from "./base";
import { diffArray } from "@tandem/common/utils/array";
import { getPatchableProperties } from "@tandem/common/decorators";
import { IComparable, IPatchable } from "@tandem/common/object";

type ComparableTreeType = ITreeNode<any> & IComparable;

export const patchTreeNode = (oldNode: ComparableTreeType, newNode: ComparableTreeType, patchLeaf?: (oldNode: ComparableTreeType, newNode: ComparableTreeType) => any) => {
  if (!patchLeaf) patchLeaf = defaultPatchLeaf;

  diffArray(oldNode.children, newNode.children, compareTreeNodes).accept({
    visitRemove({ index }) {
      oldNode.removeChild(oldNode.children[index]);
    },
    visitInsert({ index, value }) {
      oldNode.insertChildAt(value, index);
    },
    visitUpdate({ oldIndex, newValue, newIndex }) {

      // apply shift
      if (oldIndex !== newIndex) {
        oldNode.insertChildAt(oldNode.children[oldIndex], newIndex);
      }

      // patch sub tree
      patchTreeNode(oldNode.children[newIndex], newValue, patchLeaf);
    }
  });

  patchLeaf(oldNode, newNode);
};

export const compareTreeNodes = (a: ITreeNode<any>, b: ITreeNode<any>): number => {
  if (a.constructor !== b.constructor) return 0;
  if ((<IComparable><any>a).compare) {
    return Number((<IComparable><any>a).compare(<IComparable><any>b));
  }
  return 1;
};

export const defaultPatchLeaf = (oldNode: ComparableTreeType, newNode: ComparableTreeType) => {
  for (const property of getPatchableProperties(oldNode)) {
    oldNode[property] = newNode[property];
  }
};
