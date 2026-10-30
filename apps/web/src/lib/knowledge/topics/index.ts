import type { Topic } from '../types';
import { keycapsTopic } from './keycaps';
import { layoutsTopic } from './layouts';
import { mountingTopic } from './mounting';
import { prototypeTopic } from './prototype';
import { switchesTopic } from './switches';
import { wirelessTopic } from './wireless';

export const TOPICS = [
  layoutsTopic,
  switchesTopic,
  keycapsTopic,
  mountingTopic,
  wirelessTopic,
  prototypeTopic,
] as const;

export function getTopic(slug: string): Topic | undefined {
  return TOPICS.find((topic) => topic.slug === slug);
}
