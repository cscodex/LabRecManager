# Documents Page Enhancements - Implementation Plan

Implementing 5 major features for the documents management system: advanced file viewers, bulk actions with folders, column sorting, trash/recycle bin, and storage quota management.

## User Review Required

> [!IMPORTANT]
> **Library Choices**: Using **SuperDoc** (MIT licensed, vanilla JS) for DOCX viewing and **Jspreadsheet CE** (MIT licensed) for Excel/CSV spreadsheet viewing. Both are free for commercial use.

> [!WARNING]
> **Database Changes**: This implementation adds new fields to `Document` and `User` models, plus a new `Folder` model. Requires a Prisma migration.

---

## Proposed Changes

### 1. Advanced File Viewers [COMPLETED]

#### [NEW] client/src/components/FileViewer.jsx
- Integrated `docx-preview` for DOCX
- Integrated `jspreadsheet-ce` for Excel/CSV
- Component created and integrated into Documents page

---

### 2. Select Box & Bulk Actions with Folder Structure [COMPLETED]

#### [NEW] database/add_folder_structure.sql
- Implemented `DocumentFolder` table and `folder_id` column

#### [MODIFY] [schema.prisma](file:///Users/charanpreetsingh/LabRecManagemer/server/prisma/schema.prisma)
- Added `DocumentFolder` model and relations

#### [NEW] server/src/routes/folder.routes.js
- Implemented CRUD and Move operations

#### [MODIFY] [page.jsx](file:///Users/charanpreetsingh/LabRecManagemer/client/src/app/admin/documents/page.jsx)
- Added folder logic, breadcrumbs, create folder modal, move document modal

---

### 3. Column Sorting [COMPLETED]

#### [MODIFY] [page.jsx](file:///Users/charanpreetsingh/LabRecManagemer/client/src/app/admin/documents/page.jsx)
- Implemented sortable headers for Name, Type, Size, Date

---

### 4. Trash/Recycle Bin [COMPLETED]

#### [NEW] database/add_document_enhancements.sql
- Added `deleted_at`, `deleted_by` columns

#### [MODIFY] [document.routes.js](file:///Users/charanpreetsingh/LabRecManagemer/server/src/routes/document.routes.js)
- Implemented soft delete, restore, permanent delete, and trash listing

#### [MODIFY] [page.jsx](file:///Users/charanpreetsingh/LabRecManagemer/client/src/app/admin/documents/page.jsx)
- Added Trash tab with restore/delete actions

#### [NEW] server/src/services/cron.service.js
- Implemented 30-day auto-delete cron job

---

### 5. Storage Quota Management [COMPLETED]

#### [NEW] database/add_document_enhancements.sql
- Added `storage_quota_mb`, `storage_used_bytes`

#### [NEW] server/src/routes/storage.routes.js
- Implemented storage usage calculation and quota endpoints

#### [MODIFY] [page.jsx](file:///Users/charanpreetsingh/LabRecManagemer/client/src/app/admin/documents/page.jsx)
- Added visual storage indicator bar

---

## Verification Plan

### Manual Testing

1. **File Viewers**
   - Upload a DOCX file → Preview should show formatted content with SuperDoc
   - Upload an XLSX file → Preview should show spreadsheet with cell editing
   - Upload a CSV file → Preview should show table data with formatting

2. **Bulk Actions & Folders**
   - Create a new folder → Should appear in folder tree
   - Select multiple documents → Bulk toolbar should appear
   - Move documents to folder → Documents should move correctly
   - Delete folder with contents → Should ask for confirmation

3. **Column Sorting**
   - Click "Name" header → Documents sort A-Z
   - Click again → Documents sort Z-A
   - Click "Date" header → Documents sort by newest
   - Sort indicator should appear on active column

4. **Trash/Recycle Bin**
   - Delete a document → Should move to Trash tab
   - Open Trash tab → Deleted document should appear
   - Click Restore → Document returns to My Documents
   - Click Permanent Delete → Document removed forever

5. **Storage Quota**
   - Check storage bar in documents header
   - As admin, go to Storage Management
   - Set individual quota for a user
   - Bulk set quotas for multiple users
   - Try uploading when over quota → Should show error

### Automated Tests

> [!NOTE]
> The project doesn't have existing test files. Manual testing will be the primary verification method. If you have a preferred testing framework, please let me know.

---

## Implementation Order

1. **Database migrations** (schema changes first)
2. **Column sorting** (quickest win, no DB changes)
3. **Trash/Recycle bin** (extends existing delete)
4. **Storage quota** (backend + admin UI)
5. **Folder structure** (requires new model + UI)
6. **File viewers** (npm packages + component integration)
