import { Dependencies } from "@tandem/common";
import { keyBindingDependency } from "./key-bindings";
import { pastHTMLServiceDependency } from "./services";
import { createHTMLCoreDependencies } from "../../core";
import { textToolDependency, editInnerHTMLDependency } from "./models";

import {
  SyntheticDOMText,
  SyntheticDOMComment,
  SyntheticHTMLElement,
} from "@tandem/synthetic-browser";

import {
  StageToolComponentFactoryDependency,
  LayerLabelComponentFactoryDependency,
  EntityPaneComponentFactoryDependency,
} from "@tandem/editor/browser";

import {
  SyntheticHTMLLink,
  SyntheticHTMLStyle,
  SyntheticHTMLScript,
} from "@tandem/html-extension/synthetic";

import {
  TextLayerLabelComponent,
  CommentLayerLabelCoponent,
  ElementLayerLabelComponent,
  ElementInfoStageToolComponent,
  EntityAttributesPaneComponent,
} from "./components";

export function createHTMLEditorBrowserDependencies() {

  return new Dependencies(

    createHTMLCoreDependencies(),

    // layer components
    new LayerLabelComponentFactoryDependency(SyntheticHTMLElement.name, ElementLayerLabelComponent),
    new LayerLabelComponentFactoryDependency(SyntheticHTMLStyle.name, ElementLayerLabelComponent),
    new LayerLabelComponentFactoryDependency(SyntheticHTMLScript.name, ElementLayerLabelComponent),
    new LayerLabelComponentFactoryDependency(SyntheticHTMLLink.name, ElementLayerLabelComponent),
    new LayerLabelComponentFactoryDependency(SyntheticDOMText.name, TextLayerLabelComponent),
    new LayerLabelComponentFactoryDependency(SyntheticDOMComment.name, CommentLayerLabelCoponent),

    // entity panes
    new EntityPaneComponentFactoryDependency("htmlAttributes", EntityAttributesPaneComponent),

    // stage tool components
    new StageToolComponentFactoryDependency("elementInfo", "pointer", ElementInfoStageToolComponent),

    // services
    pastHTMLServiceDependency,

    // tools
    textToolDependency,
    editInnerHTMLDependency,

    // key bindings
    keyBindingDependency
  );
}

export * from "./components";
export * from "./key-bindings";
export * from "./services";
export * from "./models";
export * from "../../core";
export * from "../worker";