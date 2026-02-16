# Student Interface Enhancements

Implementing four features for the student interface: due date display, and notifications for new work assignments, ticket resolutions, and assignment submissions.

## Proposed Changes

### Notification Service

#### [NEW] [notificationService.js](file:///Users/charanpreetsingh/LabRecManagemer/server/src/services/notificationService.js)

Create a helper service to create notifications with support for:
- Single user notifications
- Bulk notifications (to classes/groups)
- Different notification types: `work_assigned`, `ticket_resolved`, `submission_received`

```javascript
// Helper function to create notification for single user
async function createNotification({ userId, title, message, type, referenceType, referenceId, actionUrl })

// Helper to notify all students in a class
async function notifyClass({ classId, title, message, type, referenceType, referenceId, actionUrl })

// Helper to notify all members of a group  
async function notifyGroup({ groupId, title, message, type, referenceType, referenceId, actionUrl })
```

---

### Requirement 1: Due Date Display

**Status: Already Implemented** ✅

The [my-work/page.jsx](file:///Users/charanpreetsingh/LabRecManagemer/client/src/app/my-work/page.jsx) already displays due dates at lines 244-257:
- Shows relative due time ("Due in X days", "Due today", "Overdue")
- Shows absolute date/time
- Has color-coded urgency indicators

No changes required for this requirement.

---

### Requirement 2: Notification When New Work is Assigned

#### [MODIFY] [assignment.routes.js](file:///Users/charanpreetsingh/LabRecManagemer/server/src/routes/assignment.routes.js)

Add notification trigger in the `POST /:id/targets` endpoint (line 731-761) after creating the assignment target:

```diff
+ // Send notification to assigned students
+ if (targetType === 'class') {
+     await notificationService.notifyClass({
+         classId: targetId,
+         title: `New Work Assigned: ${assignment.title}`,
+         message: `You have been assigned new work. Due: ${dueDate || 'No deadline'}`,
+         type: 'work_assigned',
+         referenceType: 'assignment',
+         referenceId: assignment.id,
+         actionUrl: `/my-work`
+     });
+ } else if (targetType === 'group') {
+     await notificationService.notifyGroup({...});
+ } else if (targetType === 'student') {
+     await notificationService.createNotification({...});
+ }
```

---

### Requirement 3: Notification When Ticket is Resolved

#### [MODIFY] [ticket.routes.js](file:///Users/charanpreetsingh/LabRecManagemer/server/src/routes/ticket.routes.js)

Add notification trigger in the `PUT /:id/resolve` endpoint (line 309-327) after resolving the ticket:

```diff
+ // Notify ticket creator that ticket is resolved
+ await notificationService.createNotification({
+     userId: ticket.createdById,
+     title: `Ticket Resolved: ${resolved.ticketNumber}`,
+     message: `Your ticket "${resolved.title}" has been resolved.${resolutionNotes ? ` Notes: ${resolutionNotes}` : ''}`,
+     type: 'ticket_resolved',
+     referenceType: 'ticket',
+     referenceId: resolved.id,
+     actionUrl: `/tickets`
+ });
```

---

### Requirement 4: Notification When Student Submits Assignment

#### [MODIFY] [submission.routes.js](file:///Users/charanpreetsingh/LabRecManagemer/server/src/routes/submission.routes.js)

Add notification trigger in the `POST /` endpoint (line 432-537) after creating the submission:

```diff
+ // Notify instructor/admin about new submission
+ await notificationService.notifyAssignmentOwner({
+     assignmentId: assignment.id,
+     title: `New Submission: ${assignment.title}`,
+     message: `${req.user.firstName} ${req.user.lastName} has submitted work for ${assignment.title}`,
+     type: 'submission_received',
+     referenceType: 'submission',
+     referenceId: submission.id,
+     actionUrl: `/submissions`
+ });
```

---

### Frontend Notification Display

The existing [notifications/page.jsx](file:///Users/charanpreetsingh/LabRecManagemer/client/src/app/notifications/page.jsx) and notification dropdown in the Sidebar should automatically display notifications from the database. No frontend changes needed as the backend notification routes already support fetching and displaying notifications.

---

## Verification Plan

### Manual Verification

1. **Due Date Display** (Already working)
   - Login as a student
   - Navigate to `/my-work`
   - Verify assignments show due dates with color-coded urgency

2. **New Work Notification**
   - Login as instructor
   - Navigate to `/assignments/assign`
   - Assign an assignment to a class/group/student
   - Login as the assigned student
   - Check notifications page or notification bell for new work notification

3. **Ticket Resolution Notification**
   - Login as student, create a ticket
   - Login as admin/lab_assistant
   - Navigate to `/tickets`, resolve the ticket
   - Login as student
   - Check notifications for resolution message

4. **Submission Notification**
   - Login as instructor, create and assign an assignment
   - Login as student, submit the assignment
   - Login as instructor
   - Check notifications for submission notification

> [!IMPORTANT]
> Please confirm if this implementation plan looks correct before I proceed with the changes.
