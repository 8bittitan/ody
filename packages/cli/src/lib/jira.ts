import type { JiraCredentials } from './auth';

import { Http } from './http';

const TICKET_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/;

export type JiraTicket = {
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  labels: string[];
  components: string[];
  comments: string[];
};

export type ParsedInput = {
  baseUrl: string;
  ticketKey: string;
};

export namespace Jira {
  export function parseInput(input: string, configBaseUrl?: string): ParsedInput {
    const trimmed = input.trim();

    if (trimmed.includes('://')) {
      let url: URL;

      try {
        url = new URL(trimmed);
      } catch {
        throw new Error(`Invalid Jira URL: ${trimmed}`);
      }

      const baseUrl = url.origin;
      const segments = url.pathname.split('/').filter(Boolean);
      const browseIndex = segments.indexOf('browse');

      const ticketKey = segments[browseIndex + 1];

      if (browseIndex === -1 || !ticketKey) {
        throw new Error(
          `Could not extract ticket key from URL: ${trimmed}. Expected a URL containing /browse/PROJ-123`,
        );
      }

      if (!TICKET_KEY_PATTERN.test(ticketKey)) {
        throw new Error(
          `Invalid ticket key "${ticketKey}" extracted from URL. Expected format: PROJ-123`,
        );
      }

      return { baseUrl, ticketKey };
    }

    if (TICKET_KEY_PATTERN.test(trimmed)) {
      if (!configBaseUrl) {
        throw new Error(
          `Ticket key "${trimmed}" provided without a base URL. Set jira.baseUrl in .ody/ody.json or provide a full Jira URL.`,
        );
      }

      return { baseUrl: configBaseUrl, ticketKey: trimmed };
    }

    throw new Error(
      `Invalid Jira input: "${trimmed}". Provide a full Jira URL (https://company.atlassian.net/browse/PROJ-123) or a ticket key (PROJ-123).`,
    );
  }

  export async function fetchTicket(
    baseUrl: string,
    key: string,
    auth?: JiraCredentials,
  ): Promise<JiraTicket> {
    const fields = 'summary,description,status,priority,issuetype,labels,components,comment';
    const url = `${baseUrl}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fields}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (auth) {
      const authToken = Buffer.from(`${auth.email}:${auth.apiToken}`).toString('base64');
      headers['Authorization'] = `Basic ${authToken}`;
    }

    const res = await Http.fetchWithRetry(
      url,
      { headers },
      {
        timeoutMs: 6_000,
        retries: 2,
      },
    );

    if (!res.ok) {
      switch (res.status) {
        case 401:
          throw new Error(
            `Authentication failed for ${baseUrl}. Run \`ody auth jira\` to configure your credentials.`,
          );
        case 403:
          throw new Error(
            `Permission denied when fetching ${key} from ${baseUrl}. Check that your account has access to this issue.`,
          );
        case 404:
          throw new Error(
            `Ticket ${key} not found on ${baseUrl}. Check the ticket key and try again.`,
          );
        default:
          throw new Error(
            `Jira API error (HTTP ${res.status}) when fetching ${key} from ${baseUrl}: ${res.statusText}`,
          );
      }
    }

    const data = await res.json();

    return mapResponseToTicket(key, data);
  }

  function mapResponseToTicket(key: string, data: any): JiraTicket {
    const fields = data.fields ?? {};

    const comments: string[] = (fields.comment?.comments ?? []).map((c: any) => {
      const author = c.author?.displayName ?? c.author?.name ?? 'Unknown';
      const body = c.body ?? '';
      return `${author}: ${body}`;
    });

    return {
      key,
      summary: fields.summary ?? '',
      description: fields.description ?? '',
      status: fields.status?.name ?? '',
      priority: fields.priority?.name ?? '',
      type: fields.issuetype?.name ?? '',
      labels: fields.labels ?? [],
      components: (fields.components ?? []).map((c: any) => c.name ?? ''),
      comments,
    };
  }

  export function formatAsDescription(ticket: JiraTicket): string {
    const lines: string[] = [];

    lines.push(`Key: ${ticket.key}`);
    lines.push(`Summary: ${ticket.summary}`);
    lines.push(`Type: ${ticket.type}`);
    lines.push(`Priority: ${ticket.priority}`);
    lines.push(`Status: ${ticket.status}`);

    if (ticket.labels.length > 0) {
      lines.push(`Labels: ${ticket.labels.join(', ')}`);
    }

    if (ticket.components.length > 0) {
      lines.push(`Components: ${ticket.components.join(', ')}`);
    }

    lines.push('');

    if (ticket.description) {
      lines.push('Description:');
      lines.push(ticket.description);
    } else {
      lines.push('Description: (none)');
    }

    if (ticket.comments.length > 0) {
      lines.push('');
      lines.push('Comments:');

      for (const comment of ticket.comments) {
        lines.push(`- ${comment}`);
      }
    }

    return lines.join('\n');
  }
}
