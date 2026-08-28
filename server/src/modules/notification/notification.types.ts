export const notificationTypes = /* GraphQL */ `
  enum NotificationType {
    LEAVE_REQUEST
    LEAVE_DECISION
    REGULARIZATION_REQUEST
    REGULARIZATION_DECISION
    ATTENDANCE_FLAGGED
    ATTENDANCE_DECISION
    SIGNUP_REQUEST
    SIGNUP_DECISION
    TEMP_DUTY
    DAY_OFF
    MEDICINE_REQUEST
    MEDICINE_DECISION
    PUNCH_REMINDER
    ABSENT_ALERT
    DOCUMENT_UPLOADED
    DOCUMENT_DECISION
    DOCUMENT_REQUESTED
    GENERIC
  }

  type Notification {
    id: ID!
    recipient: User!
    type: NotificationType!
    title: String!
    message: String
    link: String
    isRead: Boolean!
    createdAt: DateTime
  }
`;
