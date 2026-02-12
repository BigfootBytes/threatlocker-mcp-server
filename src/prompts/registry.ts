import { z } from 'zod';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export interface PromptDefinition {
  name: string;
  title: string;
  description: string;
  argsSchema?: Record<string, z.ZodTypeAny>;
  cb: (args: Record<string, string>) => GetPromptResult;
}

export const allPrompts: PromptDefinition[] = [
  {
    name: 'investigate_denial',
    title: 'Investigate Application Denial',
    description: 'Step-by-step guide for investigating why an application was blocked by ThreatLocker',
    argsSchema: {
      hostname: z.string().optional().describe('Computer name or hostname pattern to filter by'),
      path: z.string().optional().describe('File path or pattern of the denied application'),
      timeframe: z.string().optional().describe('Time range to search (e.g., "last 24 hours", "last 7 days"). Default: last 24 hours'),
    },
    cb: (args) => {
      const hostname = args.hostname || '*';
      const path = args.path || '';
      const timeframe = args.timeframe || 'last 24 hours';

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                `Investigate why an application was denied on ThreatLocker.`,
                ``,
                `**Parameters:**`,
                `- Hostname: ${hostname}`,
                path ? `- Path: ${path}` : '',
                `- Timeframe: ${timeframe}`,
                ``,
                `**Steps:**`,
                `1. Use \`threatlocker_action_log\` with action "search", actionId 99 (Any Deny), and the timeframe above to find recent denials${hostname !== '*' ? ` for hostname "${hostname}"` : ''}${path ? ` matching path "${path}"` : ''}.`,
                `2. Review the denial entries — note the full path, process path, hash, and certificate information.`,
                `3. Use \`threatlocker_computers\` to look up the affected computer and check its current mode (Secure, Learning, Installation).`,
                `4. Use \`threatlocker_applications\` with action "match" to check if the denied file matches any known application.`,
                `5. Use \`threatlocker_policies\` to review existing policies for the computer's group — determine if a policy should be created or modified.`,
                `6. Summarize findings: what was denied, why (no matching permit policy), and recommended next steps (create policy, add to application, or approve request).`,
              ].filter(Boolean).join('\n'),
            },
          },
        ],
      };
    },
  },
  {
    name: 'review_approval_requests',
    title: 'Review Approval Requests',
    description: 'Guide for triaging and reviewing pending ThreatLocker approval requests',
    cb: (_args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Review and triage pending ThreatLocker approval requests.`,
              ``,
              `**Steps:**`,
              `1. Use \`threatlocker_approval_requests\` with action "count" to get the total number of pending requests.`,
              `2. Use \`threatlocker_approval_requests\` with action "list", statusId 1 (Pending), ordered by "datetime" descending to see the most recent requests.`,
              `3. For each request, note the username, computer, file path, and action type.`,
              `4. Group requests by application or file path to identify patterns (e.g., many users requesting the same application).`,
              `5. For high-priority or recurring requests, use \`threatlocker_applications\` with action "research" to check the ThreatLocker research rating and risk assessment.`,
              `6. Provide a prioritized summary: which requests should be approved (low risk, known applications), which need further investigation (unknown or high risk), and which should be denied.`,
            ].join('\n'),
          },
        },
      ],
    }),
  },
  {
    name: 'security_posture_report',
    title: 'Security Posture Report',
    description: 'Generate a security posture summary for the ThreatLocker-protected organization',
    argsSchema: {
      timeframe: z.string().optional().describe('Time range for the report (e.g., "last 7 days", "last 30 days"). Default: last 7 days'),
    },
    cb: (args) => {
      const timeframe = args.timeframe || 'last 7 days';

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                `Generate a security posture report for the organization over the ${timeframe}.`,
                ``,
                `**Steps:**`,
                `1. Use \`threatlocker_computers\` with kindOfAction "Computer Mode" to get an overview of computers in each mode (Secure, Learning, Installation, MonitorOnly). Flag any computers not in Secure mode.`,
                `2. Use \`threatlocker_computers\` with kindOfAction "NeedsReview" to identify computers that need attention.`,
                `3. Use \`threatlocker_action_log\` with actionId 99 (Any Deny) for the ${timeframe} to get recent denial activity. Use groupBys [8, 17] (Application Name, Asset Name) for a summary view.`,
                `4. Use \`threatlocker_approval_requests\` with action "count" to check pending approval requests.`,
                `5. Use \`threatlocker_system_audit\` with action "search" for the ${timeframe} to review portal activity (logins, policy changes, configuration modifications).`,
                `6. Compile a report with sections: Executive Summary, Computer Fleet Status, Denial Activity, Pending Approvals, Portal Activity, and Recommendations.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  },
  {
    name: 'computer_audit',
    title: 'Computer Security Audit',
    description: 'Deep-dive audit of a specific computer\'s ThreatLocker security state',
    argsSchema: {
      computer_name: z.string().describe('Name of the computer to audit'),
    },
    cb: (args) => {
      const computerName = args.computer_name;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                `Perform a security audit of computer "${computerName}".`,
                ``,
                `**Steps:**`,
                `1. Use \`threatlocker_computers\` with action "list" and searchText "${computerName}" to find the computer. Note its ID, group, current mode, and last check-in time.`,
                `2. Use \`threatlocker_maintenance_mode\` with action "get_history" and the computer ID to review recent maintenance mode activity (installation mode, learning mode, etc.).`,
                `3. Use \`threatlocker_computer_groups\` to get the computer's group details and understand which policies apply.`,
                `4. Use \`threatlocker_action_log\` with action "search", the computer's hostname, and actionId 99 (Any Deny) for the last 7 days to review recent denials on this machine.`,
                `5. Use \`threatlocker_action_log\` with action "search", the computer's hostname, and actionId 1 (Permit) with groupBys [8] (Application Name) to see what applications are actively running.`,
                `6. Compile an audit report: computer details, current security mode, recent maintenance windows, denial summary, active applications, and any security concerns or recommendations.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  },
];
