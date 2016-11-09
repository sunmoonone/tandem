import * as postcss from "postcss";
import { Action, inject, Injector, InjectorProvider, sourcePositionEquals, MimeTypeProvider } from "@tandem/common";
import {
  parseCSS,
  SyntheticCSSStyleRule,
  syntheticCSSRuleType,
  SyntheticCSSStyleSheetEdit,
  SyntheticCSSMediaRuleEdit,
  SyntheticCSSAtRuleEdit,
  SyntheticCSSAtRule,
  SyntheticCSSKeyframesRuleEdit,
  SyntheticCSSStyleRuleEdit,
} from "@tandem/synthetic-browser";
import {
  Dependency,
  EditAction,
  IContentEdit,
  BaseContentEdit,
  InsertChildEditAction,
  RemoveChildEditAction,
  MoveChildEditAction,
  ISyntheticObject,
  ISyntheticObjectChild,
  ISyntheticSourceInfo,
  BaseContentEditor,
  SetValueEditActon,
  SetKeyValueEditAction,
} from "@tandem/sandbox";

function nodeMatchesSyntheticSource(node: postcss.Node, source: ISyntheticSourceInfo) {
  return node.type === source.kind && sourcePositionEquals(node.source.start, source.start);
}

// TODO - move this to synthetic-browser
// TODO - may need to split this out into separate CSS editors. Some of this is specific
// to SASS
export class CSSEditor extends BaseContentEditor<postcss.Node> {

  @inject(InjectorProvider.ID)
  private _injector: Injector;

  [SyntheticCSSStyleRuleEdit.SET_RULE_SELECTOR](node: postcss.Rule, { target, newValue }: SetValueEditActon) {
    const source = target.source;
    node.selector = newValue;
  }

  [SyntheticCSSStyleSheetEdit.REMOVE_STYLE_SHEET_RULE_EDIT](node: postcss.Container, { target, child }: RemoveChildEditAction) {
    const childNode = this.findTargetASTNode(node, <syntheticCSSRuleType>child);
    childNode.parent.removeChild(childNode);
  }

  [SyntheticCSSStyleSheetEdit.MOVE_STYLE_SHEET_RULE_EDIT](node: postcss.Container, { target, child, newIndex }: MoveChildEditAction) {
    const childNode = this.findTargetASTNode(node, <syntheticCSSRuleType>child);
    const parent = childNode.parent;
    parent.removeChild(childNode);
    parent.insertBefore(node.nodes[newIndex], childNode);
  }

  [SyntheticCSSStyleSheetEdit.INSERT_STYLE_SHEET_RULE_EDIT](node: postcss.Container, { target, child, index }: InsertChildEditAction) {

    let newChild = <syntheticCSSRuleType>child;
    const newChildNode = {
      rule(rule: SyntheticCSSStyleRule) {
        const ruleNode = postcss.rule({
          selector: rule.selector,
        });

        for (const key in rule.style.toObject()) {
          ruleNode.append(postcss.decl({
            prop: key,
            value: rule.style[key]
          }));
        }

        return ruleNode;
      },
      atrule(atrule: SyntheticCSSAtRule) {
        const ruleNode = postcss.atRule({
          name: atrule.atRuleName,
          params: atrule.params
        });

        for (const rule of atrule.cssRules) {
          ruleNode.append(this[rule.source.kind](rule));
        }

        return ruleNode;
      }
    }[newChild.source.kind](newChild);

    if (index >= node.nodes.length) {
      node.append(newChildNode);
    } else {
      node.each((child, i) => {
        if (child.parent === node && i === index) {
          node.insertBefore(child, newChildNode);
          return false;
        }
      });
    }
  }

  [SyntheticCSSStyleRuleEdit.SET_DECLARATION](node: postcss.Rule, { target, name, newValue, oldName, newIndex }: SetKeyValueEditAction) {
    const source = target.source;

    let found: boolean;
    let foundIndex: number = -1;
    const shouldAdd = node.walkDecls((decl, index) => {
      if (decl.prop === name || decl.prop === oldName) {
        if (name && newValue) {
          decl.prop  = name;
          decl.value = newValue;
          foundIndex = index;
        } else {
          node.removeChild(decl);
        }
        found = true;
      }
    });

    if (newIndex != null, foundIndex > -1 && foundIndex !== newIndex) {
      const decl = node.nodes[foundIndex];
      node.removeChild(decl);
      if (newIndex === node.nodes.length) {
        node.append(decl);
      } else {
        node.insertBefore(node.nodes[newIndex], decl);
      }
    }

    if (!found && newValue) {
      node.append(postcss.decl({ prop: name, value: newValue }));
    }
  }

  protected findTargetASTNode(root: postcss.Container, target: ISyntheticObject) {
    let found: postcss.Node;

    const walk = (node: postcss.Node, index: number) => {
      if (found) return false;


      if (node.type === target.source.kind && node.source && sourcePositionEquals(node.source.start, target.source.start)) {
        found = node;
        return false;
      }
    };

    if (walk(root, -1) !== false) {
      root.walk(walk);
    }

    return found;
  }

  parseContent(content: string) {
    return parseCSS(content, undefined, null, false);
  }

  getFormattedContent(root: postcss.Rule) {

    // try parsing again. This should throw an error if any edits are invalid.
    parseCSS(root.toString());

    return root.toString();
  }
}

function isRuleNode(node: postcss.Node) {
  return node.type === "rule";
}