import { PubSub } from 'graphql-subscriptions';

/**
 * Single shared PubSub instance for the whole app.
 * Every resolver publishes/subscribes through this so channels stay consistent.
 */
export const pubsub = new PubSub();

export const CHANNELS = {
  LEAVE_REQUEST_ADDED: 'LEAVE_REQUEST_ADDED',
  LEAVE_REQUEST_UPDATED: 'LEAVE_REQUEST_UPDATED',
  REGULARIZATION_ADDED: 'REGULARIZATION_ADDED',
  REGULARIZATION_UPDATED: 'REGULARIZATION_UPDATED',
  NOTIFICATION_ADDED: 'NOTIFICATION_ADDED',
};
