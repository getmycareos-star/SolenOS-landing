# SolenOS Data Retention and Deletion Policy

## Overview
This document describes the data retention and deletion practices for SolenOS, a caregiving support system. The policy outlines what data is retained, for how long, and how it can be deleted.

## Data Retention Principles
- SolenOS retains data until explicitly deleted by the user or caregiver.
- There is no automatic expiration or TTL (time-to-live) for most data types.
- Data is retained to support caregiving continuity, historical analysis, and legal compliance where applicable.
- Users and caregivers have the right to delete their data in accordance with applicable privacy laws (e.g., GDPR, CCPA).

## Data Types and Deletion Methods

### 1. Users
- **Retention**: User accounts are retained until deleted.
- **Deletion**: Soft delete via `DELETE /api/users/[id]`. Sets `deleted_at` timestamp.
- **Effect**: 
  - The user is no longer able to log in or access the system.
  - Associated data (sessions, care events, etc.) remains in the database but is inaccessible via the API due to authentication checks that exclude soft-deleted users.
  - To fully remove user data, a separate process must delete associated records (sessions, care events, etc.) or they can be retained for historical purposes with the user dissociated.
- **Filesystem**: No direct filesystem storage for user accounts.

### 2. Care Events
- **Retention**: Care events (timeline entries) are retained until deleted.
- **Deletion**: Hard delete via `DELETE /api/care-events/[id]`. Removes the event and its associated sources from the database.
- **Effect**: 
  - The care event and its source records are permanently removed.
  - This action cannot be undone.
- **Filesystem**: No direct filesystem storage for care events (stored in database only via event-sourced storage).

### 3. Care Recipient Identities
- **Retention**: Links between caregivers and care recipients are retained until deleted.
- **Deletion**: Soft delete via `DELETE /api/care-recipient-identities/[id]`. Removes the identity record from the database and associated filesystem JSON file.
- **Effect**: 
  - The link between a caregiver and care recipient is removed.
  - Care events and other data associated with the care recipient remain but are no longer linked via this identity.
- **Filesystem**: The corresponding JSON file in `.data/care-recipient-identity/` is deleted.

### 4. Problem Reports
- **Retention**: Feedback reports are retained until deleted.
- **Deletion**: Hard delete via `DELETE /api/problem-reports/[id]`. Removes the report from the database.
- **Effect**: 
  - The report is permanently removed.
  - This action cannot be undone.
- **Filesystem**: No filesystem storage for problem reports.

### 5. Routine Moments
- **Retention**: Routine moment records (including observations, baselines, and changes) are retained until deleted.
- **Deletion**: Hard delete via `DELETE /api/routine-moments/[id]`. Removes the routine moment and its associated observations and changes from the database and memory cache.
- **Effect**: 
  - The routine moment record is permanently removed.
  - This action cannot be undone.
- **Filesystem**: Routine moments are not stored in the filesystem via the living-care-record-persistence layer; they are stored in Postgres and in-memory cache only.

### 6. Sessions
- **Retention**: Authentication sessions are retained until expiration (30 days) or until deleted via user logout or account deletion.
- **Deletion**: 
  - Sessions automatically expire after 30 days.
  - When a user is soft-deleted, all associated sessions are invalidated by setting their expiration to the current time.
  - There is no explicit API endpoint to delete a session; expiration is handled automatically.
- **Filesystem**: No filesystem storage for sessions.

### 7. Audit Trail
- **Retention**: Audit entries are append-only and retained indefinitely to preserve history of changes (as per specification requirements).
- **Deletion**: No deletion endpoint. The audit trail is designed to be immutable.
- **Effect**: 
  - Audit entries are never deleted through normal operation.
  - A special administrative function (`resetAuditTrailStore`) exists for testing purposes only and should not be used in production.
- **Filesystem**: No filesystem storage for audit trail (stored in database only).

### 8. Open Loops
- **Retention**: Open loops are retained until resolved or deleted.
- **Deletion**: Hard delete via `DELETE /api/open-loops/[id]`.
- **Effect**: 
  - The open loop is permanently removed from the database.
  - This action cannot be undone.
- **Filesystem**: No filesystem storage for open loops.

### 9. Care Attention Items
- **Retention**: Attention items are retained until resolved or deleted.
- **Deletion**: Soft delete via `DELETE /api/care-attention/[id]`. Sets `attention_state` to 'RESOLVED' and `resolution_state` to 'RESOLVED_BY_USER'.
- **Effect**: 
  - The attention item is marked as resolved but remains in the database for historical and audit purposes.
  - This aligns with the specification requirement to preserve resolution history.
- **Filesystem**: No filesystem storage for care attention items.

### 10. Living Care Record Spine (Filesystem)
- **Retention**: The `.data/` directory stores durable JSON files for certain entities (e.g., care recipient identities) to survive process restarts.
- **Deletion**: 
  - When an entity is deleted via its API endpoint, the associated filesystem file is deleted.
  - The `living-care-record-persistence` module provides functions (`deleteDurableFile`, `clearDurableDirectory`) used by the stores.
- **Effect**: 
  - Filesystem cleanup is automatic when entities are deleted via the API.
  - Manual cleanup of the `.data/` directory is possible but not recommended as it may orphan database records.

## Verification of Deletion
- All deletion endpoints return a JSON response with a `success` boolean indicating whether the deletion was completed.
- Error responses include appropriate HTTP status codes and messages.
- Administrators can verify deletion by attempting to retrieve the deleted resource (should return 404 or equivalent).

## Alignment with Public Disclosures
This retention and deletion policy aligns with SolenOS's public privacy disclosures, which state:
- User data is not shared with third parties without consent.
- Users have the right to access, correct, and delete their personal data.
- Data is retained only as necessary to provide the service or as required by law.
- SolenOS does not retain data indefinitely without user consent; users may delete their data at any time.

## Implementation Notes
- Soft deletion is used for entities where history preservation is important (users, care attention items) or where hard deletion would break referential integrity (users).
- Hard deletion is used for entities that are independent or where cascading deletes are safely implemented (care events, problem reports, routine moments, open loops).
- All deletion endpoints require authentication and authorization checks to ensure users can only delete their own data or data they are permitted to delete.
- The filesystem (`./data/`) is cleaned up automatically when entities that have durable storage are deleted.