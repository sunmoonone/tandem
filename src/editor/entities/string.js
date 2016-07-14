import Entity from 'common/entities/entity';
import { FactoryFragment } from 'common/fragments';

export default class StringEntity extends Entity {
  async execute() {
    this.value = this.expression.value;
  }
}

export const fragment = FactoryFragment.create({
  ns      : 'entities/string',
  factory : StringEntity,
});
