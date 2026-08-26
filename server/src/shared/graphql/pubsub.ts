import { PubSub } from 'graphql-subscriptions';
import { PUBSUB_CHANNELS } from '../../config/constants.js';

/**
 * PubSubBus – SINGLETON owner of the shared GraphQL PubSub instance.
 * Every publisher/subscriber goes through this one bus so channel names and
 * payload shapes stay consistent app-wide.
 */
class PubSubBus {
  private static instance: PubSubBus | null = null;

  public readonly client: PubSub;

  private constructor() {
    this.client = new PubSub();
  }

  public static getInstance(): PubSubBus {
    if (!PubSubBus.instance) {
      PubSubBus.instance = new PubSubBus();
    }
    return PubSubBus.instance;
  }
}

export const pubsub = PubSubBus.getInstance().client;
export { PUBSUB_CHANNELS };
