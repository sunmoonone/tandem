import * as path from "path";
import * as memoize from "memoizee";

import { pull, values } from "lodash";
import { IFileSystem } from "../file-system";
import { RawSourceMap } from "source-map";
import { IDependencyGraph } from "./graph";
import { DependencyAction } from "./actions";
import { FileCache, FileCacheItem } from "../file-cache";

import {
  IDependencyLoaderResult,
  IResolvedDependencyInfo,
} from "./strategies"

import {
  FileCacheProvider,
  FileSystemProvider,
} from "../providers";

import { WrapBus } from "mesh";

import {
  Action,
  inject,
  Logger,
  IActor,
  loggable,
  Injector,
  LogLevel,
  IWalkable,
  Observable,
  TreeWalker,
  IInjectable,
  serialize,
  deserialize,
  serializable,
  ITreeWalker,
  watchProperty,
  MimeTypeProvider,
  BaseActiveRecord,
  InjectorProvider,
  PropertyChangeAction,
  PLAIN_TEXT_MIME_TYPE,
  DisposableCollection,
} from "@tandem/common";

import { Dependency } from "./dependency";
import { DependencyWalker, flattenDependencies } from "./utils";

@serializable({
  serialize({ type, data }: DependencyGraphWatcherAction) {
    return { type, data: serialize(data) };
  },
  deserialize({ type, data }, injector) {
    return new DependencyGraphWatcherAction(type, deserialize(data, injector));
  }
})
export class DependencyGraphWatcherAction extends Action {
  static readonly DEPENDENCY_GRAPH_LOADED: string = "dependencyGraphWatcherLoaded";
  static readonly DEPENDENCY_GRAPH_LOADING: string = "dependencyGraphWatcherLoading";
  constructor(type: string, readonly data?: any) {
    super(type);
  }
}

const RELOAD_TIMEOUT = 1000 * 3;

@loggable()
export class DependencyGraphWatcher extends Observable {
  protected readonly logger: Logger;

  private _dependencyObserver: IActor;
  private _dependencyObservers: DisposableCollection;
  private _resolve: any;
  private _loading: boolean;

  constructor(readonly entry: Dependency) {
    super();
    this._dependencyObserver = new WrapBus(this.onDependencyAction.bind(this));
  }

  public dispose() {
    this._dependencyObservers.dispose();
    this._dependencyObservers = undefined;
  }

  public waitForAllDependencies = memoize(async () => {
    this._loading = true;

    let deps: Dependency[];

    this.notify(new DependencyGraphWatcherAction(DependencyGraphWatcherAction.DEPENDENCY_GRAPH_LOADING));

    // timeout so that the notification above has enough time to be
    // sent to the browser - otherwise the notification may get locked up by the content
    // loaders.
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      while (true) {
        await this.entry.load();

        deps = flattenDependencies(this.entry);

        const loadingDependencies = deps.filter(dep => dep.loading);

        // Break if everything is loaded in the dependency graph starting from this instance.
        // if there were loading deps, then there may be more imported deps that are being loaded in,
        // so we'll need to re-traverse the entire DEP graph to ensure that they're checked.
        if (!loadingDependencies.length) break;

        this.logger.verbose(`Waiting for ${loadingDependencies.length} dependencies to load`);

        await Promise.all(loadingDependencies.map(dep => dep.load()));
      }
    } catch(e) {
      this._loading = false;

      // Set interval for reloading the watcher if there's an error to cover
      // the case when a nested dependency dispatches a fix, and there's nothing listening
      // to it.
      setTimeout(this.waitForAllDependencies, RELOAD_TIMEOUT);
      this.notify(new DependencyGraphWatcherAction(DependencyGraphWatcherAction.DEPENDENCY_GRAPH_LOADED, e));
      throw e;
    }

    if (this._dependencyObservers) {
      this._dependencyObservers.dispose();
    }

    this._dependencyObservers = new DisposableCollection();

    for (const dep of deps) {
      dep.observe(this._dependencyObserver);
      this._dependencyObservers.push({
        dispose: () => dep.unobserve(this._dependencyObserver)
      })
    }
    this._loading = false;

    this.notify(new DependencyGraphWatcherAction(DependencyGraphWatcherAction.DEPENDENCY_GRAPH_LOADED));

  }, { promise: true })


  private onDependencyAction(action: Action) {
    if (this._loading) return;
    this.waitForAllDependencies["clear"]();
    this.waitForAllDependencies();
  }
}

