# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains an MCP (Model Context Protocol) server implementation for ThreatLocker integration.

## ThreatLocker API Reference

### Base URL

```
https://portalapi.INSTANCE.threatlocker.com/portalapi/
```

Replace `INSTANCE` with your organization's instance identifier.

### Swagger Specifications

- **Stable API**: https://portalapi.g.threatlocker.com/swagger/public/swagger.json
- **Beta API**: https://betaportalapi.g.threatlocker.com/swagger/public/swagger.json

### Authentication

All endpoints require authentication via header:
- `APIKey` or `Authorization` token (required)
- `managedOrganizationId` (optional, GUID format) - for cross-organization operations

Content type: `application/json`

### KB Documentation

- [Unified Audit](https://threatlocker.kb.help/unified-audit-portalapiactionlog/)
- [Application](https://threatlocker.kb.help/portalapiapplication/)
- [ApprovalRequest](https://threatlocker.kb.help/portalapiapprovalrequest/)
- [Computer](https://threatlocker.kb.help/portalapicomputer/)
- [ComputerCheckin](https://threatlocker.kb.help/portalapicomputercheckin/)
- [ComputerGroup](https://threatlocker.kb.help/portalapicomputergroup/)
- [MaintenanceMode](https://threatlocker.kb.help/portalapimaintenancemode/)
- [Organization](https://threatlocker.kb.help/portalapiorganization/)
- [Policy](https://threatlocker.kb.help/portalapipolicy/)
- [SystemAudit](https://threatlocker.kb.help/portalapisystemaudit/)
- [Tag](https://threatlocker.kb.help/portalapitag/)
- [ThreatLockerVersion](https://threatlocker.kb.help/portalapithreatlockerversion/)

---

## Common Enumerations

### OS Types
| Value | OS |
|-------|-----|
| 0 | All |
| 1 | Windows |
| 2 | macOS |
| 3 | Linux |
| 5 | Windows XP |
| 7 | Red Hat |

### Action IDs
| Value | Action |
|-------|--------|
| 1 | Permit |
| 2 | Deny |
| 3 | Deny (Option to Request) |
| 6 | Ringfenced |
| 99 | Any Deny |

### Maintenance Type IDs
| Value | Mode |
|-------|------|
| 1 | ApplicationControlMonitorOnly |
| 2 | ApplicationControlInstallationMode |
| 3 | Learning |
| 4 | Elevation |
| 6 | TamperProtectionDisabled |
| 8 | Installation Mode (legacy) |
| 14 | Isolation |
| 15 | Lockdown |
| 16 | DisableOpsAlerts |
| 17 | NetworkControlMonitorOnly |
| 18 | StorageControlMonitorOnly |
| 19 | InstallationLegacy |

### Approval Request Status IDs
| Value | Status |
|-------|--------|
| 1 | Pending |
| 4 | Approved |
| 6 | Not Learned |
| 10 | Ignored |
| 12 | Added to Application |
| 13 | Escalated from Cyber Heroes |
| 16 | Self-Approved |

### Update Channel Values
| Value | Channel |
|-------|---------|
| 0 | Manual |
| 1 | Pre-Releases |
| 2 | Regular |
| 3 | Expedited |
| 4 | Slow and Steady |

### Elevation Status
| Value | Status |
|-------|--------|
| 0 | Do not Elevate / None |
| 1 | Elevate / Notify |
| 2 | Silent Elevation |
| 3 | Force Standard User |

### Rule IDs (Maintenance Mode)
| Value | Rule |
|-------|------|
| 0 | No Maintenance Mode |
| 1 | Installation Mode (1 hour) |
| 2 | Learning Mode (1 hour) |
| 3 | Monitor Mode (1 hour) |

---

## API Endpoints

### ActionLog (Unified Audit)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ActionLog/ActionLogGetByParametersV2` | Get action logs by parameters |
| GET | `/ActionLog/ActionLogGetAllForFileHistory` | Get file history |
| GET | `/ActionLog/ActionLogGetAllForFileHistoryV2` | Get file history (v2, includes computerId) |
| GET | `/ActionLog/ActionLogGetById` | Get action log by ID |
| GET | `/ActionLog/ActionLogGetByIdV2` | Get action log by ID (v2) |
| POST | `/ActionLog/ActionLogGetTestingEnvironmentDetailsById` | Get testing environment details |
| POST | `/ActionLog/ActionLogGetPolicyConditionsForPermitApplication` | Get policy conditions for permit |
| POST | `/ActionLog/ActionLogGetSearchString` | Get search string (for saved search) |
| GET | `/ActionLog/ActionLogGetFileDownloadDetailsById` | Get file download details |

**Required header:** `usenewsearch: true`

**ActionLogGetByParametersV2 Request Body:**
```json
{
  "endDate": "2025-01-15T23:59:59Z",
  "startDate": "2025-01-01T00:00:00Z",
  "pageNumber": 1,
  "pageSize": 100,
  "paramsFieldsDto": [],
  "actionType": "execute|install|network|registry|read|write|move|delete|baseline|powershell|elevate|configuration|dns",
  "actionId": 1,
  "hostname": "*pattern*",
  "fullPath": "*pattern*",
  "groupBys": [1, 2],
  "exportMode": false,
  "showTotalCount": true,
  "showChildOrganizations": false,
  "onlyTrueDenies": false,
  "simulateDeny": false
}
```

**Source Table IDs:** 1 (ActionLog), 2 (DenyActionLog), 3 (BaselineActionLog), 4 (EventLogActionLog)

**Group By Options:** Username (1), Process Path (2), Policy Name (6), Application Name (8), Action Type (9), Asset Name (17), Risk Score (70), 50+ additional fields

**Response Headers (when showTotalCount=true):** `firstItem`, `lastItem`, `totalItems`, `totalPages`

**Permissions:** View Unified Audit

---

### Application

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/Application/ApplicationGetById` | Get application by ID |
| POST | `/Application/ApplicationGetByParameters` | Search applications with filtering |
| GET | `/Application/ApplicationGetForMaintenanceMode` | Get applications for maintenance mode |
| POST | `/Application/ApplicationGetMatchingList` | Find matching applications by file properties |
| GET | `/Application/ApplicationGetResearchDetailsById` | Get ThreatLocker research details |
| POST | `/Application/ApplicationGetForApplicationOptions` | Get application options |
| GET | `/Application/ApplicationGetForNetworkPolicyProcessById` | Get application for network policy |
| POST | `/Application/ApplicationInsert` | Create new custom application |
| PUT | `/Application/ApplicationUpdateById` | Update existing application |
| POST | `/Application/ApplicationUpdateForDelete` | Delete applications (no policies attached) |
| POST | `/Application/ApplicationConfirmUpdateForDelete` | Delete applications (with policies attached) |

**ApplicationGetByParameters Request Body:**
```json
{
  "orderBy": "name|date-created|review-rating|computer-count|policy",
  "pageNumber": 1,
  "pageSize": 25,
  "searchBy": "app|full|process|hash|cert|created|categories|countries",
  "category": 0,
  "countries": ["US", "GB"],
  "includeChildOrganizations": false,
  "isAscending": true,
  "isHidden": false,
  "osType": 1,
  "permittedApplications": false,
  "searchText": ""
}
```

**ApplicationInsert Request Body:**
```json
{
  "name": "Application Name",
  "osType": 1,
  "description": "",
  "applicationFileUpdates": [
    {
      "fullPath": "C:\\\\path\\\\to\\\\file.exe",
      "processPath": "",
      "installedBy": "",
      "cert": "",
      "hash": "",
      "notes": "",
      "updateStatus": 1
    }
  ]
}
```

**ApplicationGetMatchingList Request Body:**
```json
{
  "osType": 1,
  "certs": [{"sha": "", "subject": "", "validCert": true}],
  "createdBys": ["C:\\\\Windows\\\\System32\\\\msiexec.exe"],
  "hash": "",
  "path": "",
  "processPath": "",
  "sha256": ""
}
```

**Research Details Response Fields:** `productName`, `productDescription`, `concernRating`, `businessRating`, `reviewRating`, `potentialRiskStrategyText`, `remediationText`, `countriesWhereCodeCompiled`, `categories`, `accessLevels`

**Permissions:** Edit Application Control Applications

---

### ApprovalRequest

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ApprovalRequest/ApprovalRequestGetById` | Get approval request by ID |
| GET | `/ApprovalRequest/ApprovalRequestGetFileDownloadDetailsById` | Get file download details |
| GET | `/ApprovalRequest/ApprovalRequestGetPermitApplicationById` | Get permit application details |
| POST | `/ApprovalRequest/ApprovalRequestGetByParameters` | Get approval requests by parameters |
| GET | `/ApprovalRequest/ApprovalRequestGetCount` | Get pending approval request count |
| GET | `/ApprovalRequest/ApprovalRequestGetStorageApprovalById` | Get storage approval by ID |
| POST | `/ApprovalRequest/ApprovalRequestPermitApplication` | Approve permit application |
| POST | `/ApprovalRequest/ApprovalRequestPermitStorageApproval` | Approve storage request |
| POST | `/ApprovalRequest/ApprovalRequestUpdateForTakeOwnership` | Take ownership of request |
| POST | `/ApprovalRequest/ApprovalRequestUpdateForIgnore` | Ignore request (deprecated) |
| POST | `/ApprovalRequest/ApprovalRequestUpdateForReject` | Reject request |
| POST | `/ApprovalRequest/ApprovalRequestAuthorizeForPermitById` | Authorize for permit (Cyber Hero) |

**ApprovalRequestGetByParameters Request Body:**
```json
{
  "statusId": 1,
  "pageNumber": 1,
  "pageSize": 25,
  "searchText": "",
  "showChildOrganizations": false,
  "orderBy": "username|devicetype|actiontype|path|actiondate|datetime",
  "isAscending": true
}
```

**ApprovalRequestPermitApplication Request Body:**
```json
{
  "approvalRequest": {
    "approvalRequestId": "GUID",
    "json": "formatted JSON from GetPermitApplicationById",
    "comments": "",
    "requestorEmailAddress": "",
    "ticketApprovalManager": "",
    "ticketId": ""
  },
  "computerId": "GUID",
  "computerGroupId": "GUID",
  "fileDetails": {
    "fullPath": "C:\\\\path\\\\to\\\\file.exe"
  },
  "matchingApplications": {
    "useMatchingApplication": false,
    "matchingApplication": {
      "applicationName": "",
      "applicationId": "GUID",
      "organizationId": "GUID",
      "osType": 1
    },
    "useExistingApplication": false,
    "existingApplication": {},
    "useNewApplication": false,
    "newApplicationName": ""
  },
  "organizationHasElevation": true,
  "organizationId": "GUID",
  "organizationIds": ["GUID"],
  "osType": 1,
  "policyConditions": {
    "useExistingPolicy": false,
    "manualOptions": [
      {"hash": ""},
      {"fullPath": "", "cert": ""}
    ],
    "ruleId": 0
  },
  "policyLevel": {
    "toEntireOrganization": false,
    "toComputerGroup": false,
    "selectedComputerGroup": {
      "computerGroupId": "GUID",
      "organizationId": "GUID",
      "osType": 1
    },
    "toComputer": false
  },
  "ringfenceActionId": 1,
  "elevationExpiration": 1,
  "elevationStatus": 0,
  "networkExclusions": [{"tagPrefixTypeId": 1, "value": ""}],
  "policyExpirationDate": "2025-01-15T23:59:59Z"
}
```

**Notes:**
- Hash-only rules should not include other fields
- File paths require escaped backslashes (`\\\\`)
- Cyber Hero Management product required for AuthorizeForPermitById

**Permissions:** Approve for Entire Organization, Approve for Group, Approve for Single Computer, View Approvals

---

### Computer

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/Computer/ComputerGetByAllParameters` | Get computers by parameters |
| GET | `/Computer/ComputerGetForEditById` | Get computer for editing |
| PATCH | `/Computer/ComputerUpdateForEdit` | Update computer details |
| POST | `/Computer/ComputerUpdateBaselineRescan` | Trigger baseline rescan |
| POST | `/Computer/ComputerUpdateShouldRestartByIds` | Restart service by IDs |
| POST | `/Computer/ComputerUpdateShouldRestartByOrganization` | Restart all org computers |
| POST | `/Computer/ComputerMoveToOtherOrganization` | Move computer to another org |
| POST | `/Computer/ComputerEnableProtection` | Enable Secure Mode |
| POST | `/Computer/ComputerDisableProtection` | Enable Maintenance Mode |
| POST | `/Computer/ComputerRemoveDuplicate` | Remove duplicate computers |
| POST | `/Computer/ComputerUpdateMaintenanceMode` | Update maintenance mode |
| POST | `/Computer/ComputerUpdateToFinishMaintenanceMode` | Finish maintenance mode |
| POST | `/Computer/ComputerUpdateForDeleteByIds` | Remove computers from Portal |
| GET | `/Computer/ComputerGetForNewComputer` | Get installation info |
| POST | `/Computer/ComputerGetDownload` | Get installer download |
| POST | `/Computer/ComputerGetOSTypeByIds` | Get OS types by IDs |
| GET | `/Computer/ComputerSignedScriptDownload` | Download signed login script |
| GET | `/Computer/ComputerSamplePathDownload` | Download sample batch file |
| GET | `/Computer/ComputerUnSignedScriptDownload` | Download unsigned login script |
| POST | `/Computer/ComputerUpdateChannel` | Update ThreatLocker update channel |
| POST | `/Computer/ComputerUpdateThreatlockerVersionByIds` | Update version (deprecated) |

**ComputerGetByAllParameters Request Body:**
```json
{
  "orderBy": "computername|group|action|lastcheckin|computerinstalldate|deniedcountthreedays|updatechannel|threatlockerversion",
  "pageNumber": 1,
  "pageSize": 25,
  "action": "Secure|Installation|Learning|MonitorOnly",
  "childOrganizations": false,
  "computerGroup": "GUID",
  "computerId": "GUID",
  "isAscending": true,
  "kindOfAction": "Computer Mode|TamperProtectionDisabled|NeedsReview|ReadyToSecure|BaselineNotUploaded|Update Channel",
  "searchBy": 1,
  "searchText": ""
}
```

**ComputerUpdateForEdit Request Body:**
```json
{
  "computerId": "GUID",
  "computerGroupId": "GUID",
  "name": "Computer Name",
  "useProxyServer": false,
  "proxyServerOption": "https://",
  "proxyUrlEntry": "",
  "proxyURL": "",
  "options": []
}
```

**ComputerDisableProtection Request Body:**
```json
{
  "computerDetailDtos": [
    {"computerGroupId": "GUID", "computerId": "GUID", "organizationId": "GUID"}
  ],
  "endDate": "2025-01-15T23:59:59Z",
  "startDate": "2025-01-15T00:00:00Z",
  "maintenanceModeType": 1,
  "permitEnd": true,
  "applicationId": "autocomp|autogroup|GUID"
}
```

**ComputerGetDownload Request Body:**
```json
{
  "platform": "x64|x86|",
  "brand": "Threatlocker",
  "apiKey": "installation-key",
  "fileType": "stub|windows|pssscript|mac|debian|redhat|windowsxp|remediation"
}
```

**ComputerUpdateForDeleteByIds Request Body:**
```json
[
  {"computerId": "GUID", "computerName": "Name", "organizationId": "GUID"}
]
```

**Note:** ComputerUpdateForDeleteByIds only removes from Portal, does not uninstall agent. All computers must be in same organization.

**Permissions:** Edit Computers, View Computers, Install Computers

---

### ComputerCheckin

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ComputerCheckin/ComputerCheckinGetByParameters` | Get check-in history |

**Request Body:**
```json
{
  "computerId": "GUID",
  "pageSize": 25,
  "pageNumber": 1,
  "hideHeartbeat": false
}
```

**Permissions:** Allow View Checkin History

---

### ComputerGroup

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ComputerGroup/ComputerGroupGetGroupAndComputer` | Get groups and computers |
| GET | `/ComputerGroup/ComputerGroupGetDropdownByOrganizationId` | Get dropdown by org |
| GET | `/ComputerGroup/ComputerGroupGetDropdownWithOrganization` | Get dropdown with organizations |
| GET | `/ComputerGroup/ComputerGroupGetForPermitApplication` | Get for permit application |
| GET | `/ComputerGroup/ComputerGroupGetForDownload` | Get for download |

**ComputerGroupGetGroupAndComputer Parameters:**
- `computerGroupId` (UUID)
- `osType` (int32): 0=All, 1=Windows, 2=MAC, 3=Linux, 5=Windows XP
- `includeGlobal` (boolean): Display global application-permitting group
- `includeAllPolicies` (boolean)
- `includeOrganizations` (boolean): Include accessible organizations
- `includeAllComputers` (boolean)
- `includeParentGroups` (boolean): Show parent computer groups
- `includeLoggedInObjects` (boolean): Add contextual path labels
- `includeDnsServers` (boolean)
- `includeIngestors` (boolean)
- `includeAccessDevices` (boolean)
- `includeRemovedComputers` (boolean)
- `portalModuleTypeId` (int32)

**ComputerGroupGetDropdownByOrganizationId Parameters:**
- `computerGroupOSTypeId` (int32): 1=Windows, 2=MAC, 3=Linux, 5=Windows XP
- `computerOSType` (string): "windows", "mac", "linux", "windows xp"
- `hideGlobals` (boolean, default: false)

**ComputerGroupGetDropdownWithOrganization Parameters:**
- `includeAvailableOrganizations` (boolean): Include child and parent organizations

**ComputerGroupGetForDownload Parameters:**
- `installKey` (string): 24-character key from Computer Groups page

**Permissions:** Super Admin (for GetGroupAndComputer), Edit Computers, Edit Computer Groups, View Computers

---

### MaintenanceMode

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/MaintenanceMode/MaintenanceModeGetByComputerId` | Get by computer ID (deprecated) |
| GET | `/MaintenanceMode/MaintenanceModeGetByComputerIdV2` | Get maintenance history (paginated) |
| POST | `/MaintenanceMode/MaintenanceModeInsert` | Insert maintenance schedule |
| PATCH | `/MaintenanceMode/MaintenanceModeEndById` | End maintenance schedule |
| POST | `/MaintenanceMode/MaintenanceModeUpdateEndDateTimeForSpecificDate` | Update end datetime |

**MaintenanceModeGetByComputerIdV2 Parameters:**
- `computerId` (GUID, required)
- `pageNumber` (int, required)
- `pageSize` (int, required)

**MaintenanceModeInsert Request Body:**
```json
{
  "allUsers": false,
  "automaticApplication": false,
  "automaticApplicationType": 0,
  "computerDateTime": "2025-01-15T00:00:00Z",
  "computerId": "GUID",
  "createNewApplication": false,
  "endDateTime": "2025-01-15T23:59:59Z",
  "maintenanceTypeId": 1,
  "permitEnd": true,
  "startDateTime": "2025-01-15T00:00:00Z",
  "useExistingApplication": false,
  "usersList": ["DOMAIN\\USERNAME"],
  "existingApplication": {
    "applicationId": "GUID",
    "name": ""
  },
  "newApplication": {
    "applicationId": "GUID",
    "applicationName": "",
    "createApplicationOnly": false,
    "appliesToId": "GUID"
  }
}
```

**automaticApplicationType Values:** 0 (empty), 1 (Computer), 2 (Group), 3 (System)

**MaintenanceModeEndById Request Body:**
```json
{
  "ComputerID": "GUID",
  "MaintenanceModeId": "GUID",
  "MaintenanceTypeId": 1
}
```

**MaintenanceModeUpdateEndDateTimeForSpecificDate Request Body:**
```json
{
  "computerId": "GUID",
  "maintenanceEndDate": "2025-01-15T23:59:59Z",
  "maintenanceTypeId": 1
}
```

**Permissions:** Edit Computers, Edit Application Control Applications, Manage Application Control Installation Mode, Manage Application Control Learning Mode

---

### OnlineDevices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/OnlineDevices/OnlineDevicesGetByParameters` | Get online devices |

**Parameters:**
- `pageNumber` (int32, default: 1)
- `pageSize` (int32, default: 2)

---

### Organization

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/Organization/OrganizationGetAuthKeyById` | Get auth key |
| POST | `/Organization/OrganizationUpdateAuthKeyById` | Generate new auth key |
| GET | `/Organization/OrganizationGetForMoveComputers` | Get orgs for moving computers |
| POST | `/Organization/OrganizationCreateChild` | Create child organization |
| POST | `/Organization/OrganizationGetChildOrganizationsByParameters` | Get child organizations |

**OrganizationCreateChild Request Body:**
```json
{
  "displayName": "Organization Name",
  "timezoneId": "Timezone ID from UserGetAllTimezones",
  "domains": ["domain.com"],
  "elevationDefaultHours": 1,
  "hasDisabledEmailNotifications": false,
  "itarCompliant": false,
  "name": "org-identifier",
  "options": [],
  "proxyServerOption": "https://",
  "proxyUrlEntry": "",
  "timeoutOnLogin": 30,
  "useProxyServer": false
}
```

**elevationDefaultHours Values:** 0, 1, 2, 6, 12, 24
**timeoutOnLogin Values (minutes):** 15, 30, 60, 120, 240, 480, 1440

**OrganizationGetChildOrganizationsByParameters Request Body:**
```json
{
  "pageNumber": 1,
  "pageSize": 25,
  "includeAllChildren": false,
  "isAscending": true,
  "orderBy": "billingMethod|businessClassificationName|dateAdded|name",
  "searchText": ""
}
```

**Permissions:** Edit Organizations, View Organizations, Super Admin - Child

---

### Policy

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/Policy/PolicyGetById` | Get policy by ID |
| POST | `/Policy/PolicyGetForViewPoliciesByApplicationId` | Get policies by application |
| POST | `/Policy/PolicyInsert` | Create new policy |
| POST | `/Policy/PolicyInsertForCopyPolicies` | Copy policies |
| PUT | `/Policy/PolicyUpdateById` | Update policy |
| PUT | `/Policy/PolicyUpdateForDeleteByIds` | Delete policies |

**PolicyGetForViewPoliciesByApplicationId Request Body:**
```json
{
  "applicationId": "GUID",
  "organizationId": "GUID",
  "pageNumber": 1,
  "pageSize": 25,
  "appliesToId": "GUID",
  "includeDenies": false
}
```

**PolicyInsert Request Body:**
```json
{
  "applicationIdList": ["GUID"],
  "computerGroupId": "GUID",
  "name": "Policy Name",
  "osType": 1,
  "policyActionId": 1,
  "isEnabled": true,
  "logAction": true,
  "elevationStatus": 0,
  "policyScheduleStatus": 0,
  "ringfencingOptions": {},
  "allowRequest": false,
  "killRunningProcesses": false
}
```

**policyActionId Values:** 1 (Permit), 2 (Deny), 6 (Permit with Ringfence)
**policyScheduleStatus Values:** 0 (None), 1 (Expiration), 2 (Schedule)

**PolicyInsertForCopyPolicies Request Body:**
```json
{
  "osType": 1,
  "policies": [{"policyId": "GUID"}],
  "sourceAppliesToId": "GUID",
  "sourceOrganizationId": "GUID",
  "targetAppliesToIds": ["GUID"]
}
```

**PolicyUpdateById Notes:**
- Omitted optional fields default to false
- `osType` cannot be changed after creation
- Review current configuration before updating

**Permissions:** View Application Control Policies, Edit Application Control Policies

---

### Report

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/Report/ReportGetByOrganizationId` | Get reports by org |
| POST | `/Report/ReportGetDynamicData` | Get dynamic report data |

---

### SaveSearch

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/SaveSearch/SaveSearchGetByPage` | Get saved searches |
| POST | `/SaveSearch/SaveSearchInsert` | Insert saved search |
| DELETE | `/SaveSearch/SaveSearchDeleteById` | Delete saved search |

---

### ScheduledAgentAction

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ScheduledAgentAction/List` | Get scheduled actions list |
| GET | `/ScheduledAgentAction/AppliesTo` | Get applies-to options |
| GET | `/ScheduledAgentAction/GetForHydration` | Get scheduled action details |
| POST | `/ScheduledAgentAction/GetByParameters` | Get by parameters |
| POST | `/ScheduledAgentAction` | Insert scheduled action |
| POST | `/ScheduledAgentAction/Abort` | Abort scheduled actions |

**GetByParameters Request Body:**
```json
{
  "orderBy": "scheduleddatetime|computername|computergroupname|organizationname",
  "isAscending": true,
  "pageSize": 25,
  "pageNumber": 1,
  "organizationIds": ["GUID"],
  "computerGroupIds": ["GUID"]
}
```

**Insert Request Body:**
```json
{
  "scheduledType": 1,
  "batchAmount": 25,
  "startDate": "2025-01-15",
  "windowStartTime": "00:00",
  "windowEndTime": "23:59"
}
```

**scheduledType Values:** 1 (Version Update)
**batchAmount Values:** 25, 50, 100, 250, 500

---

### SystemAudit

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/SystemAudit/SystemAuditGetForHealthCenter` | Get for health center |
| POST | `/SystemAudit/SystemAuditGetByParameters` | Get by parameters |

**SystemAuditGetByParameters Request Body:**
```json
{
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-15T23:59:59Z",
  "pageSize": 25,
  "pageNumber": 1,
  "username": "",
  "action": "Create|Delete|Logon|Modify|Read",
  "ipAddress": "",
  "effectiveAction": "Denied|Permitted",
  "details": "",
  "viewChildOrganizations": false,
  "objectId": "GUID"
}
```

**SystemAuditGetForHealthCenter Request Body:**
```json
{
  "days": 7,
  "isLoggedIn": true,
  "pageSize": 25,
  "pageNumber": 1,
  "searchText": ""
}
```

**Notes:**
- Supports `*` wildcard searches
- `searchText` supports lat/long format: "lat:X&long:Y"

**Permissions:** View System Audit, View Health Center

---

### Tag

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/Tag/TagGetById` | Get tag by ID |
| GET | `/Tag/TagGetDowndownOptionsByOrganizationId` | Get dropdown options |
| POST | `/Tag/TagUpdate` | Update tag |

**TagGetDowndownOptionsByOrganizationId Parameters:**
- `includeBuiltIns` (boolean, default: false): Include ThreatLocker built-in tags
- `tagType` (int32, default: 1)
- `includeNetworkTagInMaster` (boolean, default: true)

**Note:** Parent organization tags use format: `"parentOrganizationName\\tagName"`

**Permissions:** Edit Network Control Policies, Manage Tags, Edit Application Control Policies, View/Edit Web Control Policies

---

### ThreatLockerVersion

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ThreatLockerVersion/ThreatLockerVersionGetForDropdownList` | Get version dropdown |

**Response Fields:**
- `label`: Version number display (e.g., "9.3.3")
- `value`: ThreatLockerVersionId
- `isEnabled`: Boolean - if version is installable
- `dateTime`: When version was added to portal
- `isDefault`: Boolean - default version for new computer groups
- `OSTypes`: Operating system type identifier

**Permissions:** Edit Computers, Edit Computer Groups, View Computers, Install Computers

---

### UploadRequest

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/UploadRequest/UploadRequestInsert` | Insert upload request |
| POST | `/UploadRequest/UploadRequestGet` | Get upload request |

---

### VDIHyperV

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/VDIHyperV/VDIHyperVGetTestingEnvironmentDetails` | Get testing environment details |

---

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Malformed request |
| 401 | Unauthorized / Unauthenticated |
| 403 | Forbidden |
| 500 | Server error |

---

## Important Notes

1. **Date/Time Format**: All timestamps must be UTC format: `YYYY-MM-DDTHH:MM:SSZ` (T separator and Z suffix required)

2. **Path Escaping**: File paths require double-escaped backslashes in JSON: `C:\\\\path\\\\to\\\\file.exe`

3. **Certificate Escaping**: Certificate fields with quotes require: `\\"`

4. **Wildcards**: Many text fields support `*` wildcard for pattern matching

5. **GUID Format**: All IDs use format: `00000000-0000-0000-0000-000000000000`

6. **EULA Requirement**: User must accept EULA for installation endpoints to return data

7. **Deploy After Changes**: After creating/modifying policies, deploy via DeployPolicyQueue endpoints

8. **Hash-Only Rules**: When creating hash rules, only include the hash - no other fields
