import { debounce } from "lodash";
import { getSelectorTester, ISelectorTester } from "./tester";
import { SyntheticDOMNode, SyntheticDOMElement, SyntheticDOMContainer, DOMNodeType } from "../markup";

import {
  IActor,
  Action,
  bindable,
  IWalkable,
  diffArray,
  Observable,
  filterTree,
  IDisposable,
  IObservable,
  ITreeWalker,
  traverseTree,
  bindProperty,
  findTreeNode,
  PropertyWatcher,
  DisposableCollection,
  PropertyChangeAction,
  propertyChangeCallbackType,
} from "@tandem/common";

import { isDOMMutationAction } from "@tandem/synthetic-browser/actions";

import { WrapBus } from "mesh";

export interface IDOMTreeWalker extends ITreeWalker {
  stop();
}

function isDocumentOrShadow(node: SyntheticDOMNode) {
  return node.nodeType === DOMNodeType.DOCUMENT || node.nodeType === DOMNodeType.DOCUMENT_FRAGMENT;
}

export function createSyntheticDOMWalker(each: (node: SyntheticDOMNode, walker?: IDOMTreeWalker) => void, deep: boolean = true): IDOMTreeWalker {
  const walker = {
    stop() {
      this._stopped = true;
    },
    accept(node: IWalkable & SyntheticDOMNode) {
      if (!this._stopped && (node.nodeType === DOMNodeType.ELEMENT || (deep && isDocumentOrShadow(node)))) {
        each(node, this);
        if (!this._stopped) node.visitWalker(this);
      }
    }
  };

  return walker;
}


export function querySelector(node: SyntheticDOMNode, selectorSource: string): SyntheticDOMElement {
  let found: SyntheticDOMElement;
  const tester = getSelectorTester(selectorSource);
  const walker = createSyntheticDOMWalker(node => {
    if (tester.test(node)) {
      found = <SyntheticDOMElement>node;
      walker.stop();
    }
  });
  walker.accept(node);
  return found;
}

export function querySelectorAll(node: SyntheticDOMNode, selectorSource: string): SyntheticDOMElement[] {
  let found: SyntheticDOMElement[] = [];
  const tester = getSelectorTester(selectorSource);
  const walker = createSyntheticDOMWalker(node => {
    if (tester.test(node)) {
      found.push(<SyntheticDOMElement>node);
    }
  });
  walker.accept(node);
  return found;
}

export function selectorMatchesElement(selector: string, element: SyntheticDOMElement): boolean {
  const tester = getSelectorTester(selector);
  return tester.test(element);
}

/**
 * Watches all elements that match a given element selector
 *
 * @export
 * @interface IElementQuerier
 */

export interface IElementQuerier<T extends SyntheticDOMElement> extends IObservable, IDisposable {

  /**
   * additional filter not available with selectors
   */

  filter: elementQueryFilterType;

  /**
   * CSS selector
   *
   * @type {string}
   */

  selector: string;

  /**
   * target to call querySelectorAll against
   *
   * @type {SyntheticDOMContainer}
   */

  target: SyntheticDOMContainer;

  /**
   */

  queriedElements: T[];
}

/**
 *
 * @export
 * @class ElementQuerierObserver
 */

// TODO - listeners need to be typed here
export class ElementQuerierWatcher extends PropertyWatcher<IElementQuerier<any>> {

  constructor(target: IElementQuerier<any>) {
    super(target);
  }

  public watchTarget = (callback: propertyChangeCallbackType) => {
    return this.addPropertyWatcher("target", callback);
  }

  public watchFilter = (callback: propertyChangeCallbackType) => {
    return this.addPropertyWatcher("filter", callback);
  }

  public watchQueriedElements = (callback: propertyChangeCallbackType) => {
    return this.addPropertyWatcher("queriedElements", callback);
  }

  public watchSelector = (callback: propertyChangeCallbackType) => {
    return this.addPropertyWatcher("selector", callback);
  }
}

export type elementQueryFilterType = (element: SyntheticDOMElement) => boolean;
const ELEMENT_QUERY_TIMEOUT = 50;

/**
 * Speedier version of querySelector with a few additional features
 *
 * @export
 * @abstract
 * @class BaseElementQuerier
 * @extends {Observable}
 * @implements {IElementQuerier<T>}
 * @template T
 */

export abstract class BaseElementQuerier<T extends SyntheticDOMElement> extends Observable implements IElementQuerier<T> {

  @bindable() public target: SyntheticDOMContainer;
  @bindable() public filter: (element: SyntheticDOMElement) => boolean;
  @bindable() public selector: string;

  // listener of bindable properties
  readonly watcher: ElementQuerierWatcher;

  private _queriedElements: T[];
  private _disposed: boolean;

  constructor(target?: SyntheticDOMContainer, selector?: string, filter?: elementQueryFilterType) {
    super();

    this.target   = target;
    this.selector = selector;
    this.filter   = filter;
    this._queriedElements = [];

    const { watchTarget, watchFilter, watchSelector } = this.watcher = this.createWatcher();

    // all of this stuff may be set at the same time, so add a debounce. Besides, ElementQuerier
    // is intended to be asyncronous
    watchTarget(this.debounceReset);
    watchFilter(this.debounceReset);
    watchSelector(this.debounceReset);

    this.reset();
  }

  protected createWatcher(): ElementQuerierWatcher {
    return new ElementQuerierWatcher(this);
  }

  get queriedElements(): T[] {
    return this._queriedElements;
  }

  protected debounceReset = debounce(() => {
    if (this._disposed) return;
    this.reset();
  }, ELEMENT_QUERY_TIMEOUT)

  protected setQueriedElements(newQueriedElements: T[]) {
    const oldQueriedElements = this._queriedElements;
    this.notify(new PropertyChangeAction("queriedElements", this._queriedElements = newQueriedElements, oldQueriedElements));
  }

  dispose() {
    this._disposed = true;
    // this.watcher.dispose(); TODO
  }
  protected abstract reset();
}


export class SyntheticElementQuerier<T extends SyntheticDOMElement> extends BaseElementQuerier<T> {

  private _rootObserver: IActor;

  constructor(target?: SyntheticDOMContainer, selector: string = "*", filter?: elementQueryFilterType) {
    super(target, selector, filter);
    this._rootObserver = new WrapBus(this.onRootAction.bind(this));
  }

  protected reset() {
    this.cleanup();
    if (!this.target) return this.setQueriedElements([]);
    this.target.observe(this._rootObserver);

    const found = [];
    const filter = this.filter || (() => true);
    const tester = getSelectorTester(this.selector);

    createSyntheticDOMWalker(node => {
      if (tester.test(node) && filter(<SyntheticDOMElement>node)) found.push(node);
    }).accept(this.target);

    this.setQueriedElements(found);
  }

  createChildQuerier<U extends SyntheticDOMElement & T>(selector: string = "*", filter?: elementQueryFilterType) {
    return new ChildElementQuerier<U>(this, selector, filter);
  }

  private onRootAction(action: Action) {

    // reset on ALL actions -- there are cases where Nodes may contain state that
    // parts of the app using this querier needs to access (metadata for example). Debounce so
    // the app doesn't get clobbered with expensive querySelectorAll requests.
    this.debounceReset();
  }

  dispose() {
    super.dispose();
    this.cleanup();
  }

  private cleanup() {
    if (this.target) {
      this.target.unobserve(this._rootObserver);
    }
  }
}

export class ChildElementQuerierWatcher extends ElementQuerierWatcher {
  watchParent = (listener: propertyChangeCallbackType) => {
    return this.addPropertyWatcher("parent", listener);
  }
}

export class ChildElementQuerier<T extends SyntheticDOMElement> extends BaseElementQuerier<T>{

  readonly watcher: ChildElementQuerierWatcher;
  @bindable() public parent: IElementQuerier<any>;

  private _parentWatchers: DisposableCollection;

  constructor(parent?: IElementQuerier<any>, selector: string = "*", filter?: elementQueryFilterType) {
    super(parent && parent.target, selector, filter);

    const { watchParent } = this.watcher;

    watchParent((parent: SyntheticElementQuerier<any>) => {
      if (this._parentWatchers) this._parentWatchers.dispose();
      const { watchTarget, watchQueriedElements } = parent.watcher;
      this._parentWatchers = new DisposableCollection(
        watchTarget(target => this.target = target).trigger(),
        watchQueriedElements(this.reset.bind(this))
      );
    });
  }

  protected createWatcher() {
    return new ChildElementQuerierWatcher(this);
  }

  protected reset() {
    if (!this.parent) return this.setQueriedElements([]);

    const filter = this.filter || (() => true);
    const tester = getSelectorTester(this.selector);

    this.setQueriedElements(this.parent.queriedElements.filter(element => tester.test(element) && filter(element)));
  }

  dispose() {
    super.dispose();
    if (this._parentWatchers) this._parentWatchers.dispose();
  }
}