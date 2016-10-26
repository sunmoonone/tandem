import { Action } from "./base";
import { definePublicAction } from "./core";
import { IActor } from "@tandem/common/actors";
import { File } from "../models";

export * from "./base";
export * from "./core";

@definePublicAction()
export class OpenProjectAction extends Action {
  static readonly OPEN_PROJECT_FILE = "openProjectFile";
  constructor(readonly filePath: string) {
    super(OpenProjectAction.OPEN_PROJECT_FILE);
  }
  static async execute({ filePath }: { filePath: string }, bus: IActor): Promise<boolean> {
    return (await bus.execute(new OpenProjectAction(filePath)).read()).value;
  }
}

@definePublicAction()
export class GetPrimaryProjectFilePathAction extends Action {
  static readonly GET_PRIMARY_PROJECT_FILE_PATH = "getPrimaryProjectFilePath";
  constructor() {
    super(GetPrimaryProjectFilePathAction.GET_PRIMARY_PROJECT_FILE_PATH);
  }
  static async execute(bus: IActor): Promise<string> {
    return (await bus.execute(new GetPrimaryProjectFilePathAction()).read()).value;
  }
}

export class EntityAction extends Action {
  static readonly ENTITY_STALE = "entityStale";
  static readonly ENTITY_DIRTY = "entityDirty";
}

export class ActiveRecordAction extends Action {
  static readonly ACTIVE_RECORD_DESERIALIZED = "activeRecordDeserialized";
}