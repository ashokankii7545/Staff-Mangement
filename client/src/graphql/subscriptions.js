import { gql } from '@apollo/client';

export const ON_LEAVE_REQUEST_ADDED = gql`
  subscription OnLeaveRequestAdded {
    leaveRequestAdded {
      id
      leaveType
      startDate
      endDate
      reason
      status
      user {
        id
        employeeId
        name
      }
    }
  }
`;

export const ON_LEAVE_REQUEST_UPDATED = gql`
  subscription OnLeaveRequestUpdated {
    leaveRequestUpdated {
      id
      leaveType
      startDate
      endDate
      reason
      status
      adminFeedback
      approvedBy {
        id
        name
      }
    }
  }
`;



export const ON_NOTIFICATION_ADDED = gql`
  subscription NotificationAdded {
    notificationAdded {
      id
      type
      title
      message
      link
      isRead
      createdAt
    }
  }
`;
