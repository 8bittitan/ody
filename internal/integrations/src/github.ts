import { Http } from './http';

const GITHUB_URL_PATTERN = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/;
const SHORTHAND_PATTERN = /^([^/]+)\/([^#]+)#(\d+)$/;

const GITHUB_API_BASE = 'https://api.github.com';

export type GitHubIssue = {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  comments: string[];
};

export type ParsedIssueInput = {
  owner: string;
  repo: string;
  issueNumber: number;
};

export namespace GitHub {
  export function parseInput(input: string): ParsedIssueInput {
    const trimmed = input.trim();

    const urlMatch = trimmed.match(GITHUB_URL_PATTERN);

    if (urlMatch) {
      const owner = urlMatch[1] as string;
      const repo = urlMatch[2] as string;
      const issueNumber = Number.parseInt(urlMatch[3] as string, 10);

      if (!owner || !repo || !Number.isFinite(issueNumber) || issueNumber < 1) {
        throw new Error(
          `Invalid GitHub issue URL: ${trimmed}. Expected format: https://github.com/owner/repo/issues/123`,
        );
      }

      return { owner, repo, issueNumber };
    }

    const shortMatch = trimmed.match(SHORTHAND_PATTERN);

    if (shortMatch) {
      const owner = shortMatch[1] as string;
      const repo = shortMatch[2] as string;
      const issueNumber = Number.parseInt(shortMatch[3] as string, 10);

      if (!owner || !repo || !Number.isFinite(issueNumber) || issueNumber < 1) {
        throw new Error(
          `Invalid GitHub issue shorthand: ${trimmed}. Expected format: owner/repo#123`,
        );
      }

      return { owner, repo, issueNumber };
    }

    throw new Error(
      `Invalid GitHub issue input: "${trimmed}". Provide a full URL (https://github.com/owner/repo/issues/123) or shorthand (owner/repo#123).`,
    );
  }

  export async function fetchIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    token?: string,
  ): Promise<GitHubIssue> {
    const issueUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const issueRes = await Http.fetchWithRetry(
      issueUrl,
      { headers },
      {
        timeoutMs: 6_000,
        retries: 2,
      },
    );

    if (!issueRes.ok) {
      handleApiError(issueRes.status, owner, repo, issueNumber);
    }

    const issueData = await issueRes.json();

    const commentsUrl = `${issueUrl}/comments`;
    const commentsRes = await Http.fetchWithRetry(
      commentsUrl,
      { headers },
      {
        timeoutMs: 6_000,
        retries: 2,
      },
    );
    let comments: string[] = [];

    if (commentsRes.ok) {
      const commentsData = (await commentsRes.json()) as any[];
      comments = mapComments(commentsData);
    }

    return mapResponseToIssue(issueData, comments);
  }

  function handleApiError(status: number, owner: string, repo: string, issueNumber: number): never {
    const ref = `${owner}/${repo}#${issueNumber}`;

    switch (status) {
      case 401:
        throw new Error(
          'Authentication required. Run `ody auth github` to configure credentials or verify your token has the correct scopes.',
        );
      case 403:
        throw new Error(
          `Access denied or rate limit exceeded for ${ref}. Authenticated requests get 5,000 requests/hour.`,
        );
      case 404:
        throw new Error(`Issue not found: ${ref}. Check the owner, repo, and issue number.`);
      default:
        throw new Error(`GitHub API error (HTTP ${status}) when fetching ${ref}.`);
    }
  }

  function mapComments(data: any[]): string[] {
    return data.map((c: any) => {
      const author = c.user?.login ?? 'unknown';
      const body = c.body ?? '';
      return `${author}: ${body}`;
    });
  }

  function mapResponseToIssue(data: any, comments: string[]): GitHubIssue {
    return {
      number: data.number ?? 0,
      title: data.title ?? '',
      body: data.body ?? '',
      state: data.state ?? '',
      labels: (data.labels ?? []).map((l: any) => (typeof l === 'string' ? l : (l.name ?? ''))),
      assignees: (data.assignees ?? []).map((a: any) => a.login ?? ''),
      milestone: data.milestone?.title ?? null,
      comments,
    };
  }

  export function formatAsDescription(issue: GitHubIssue, owner: string, repo: string): string {
    const lines: string[] = [];

    lines.push(`Issue: ${owner}/${repo}#${issue.number}`);
    lines.push(`Title: ${issue.title}`);
    lines.push(`State: ${issue.state}`);

    if (issue.labels.length > 0) {
      lines.push(`Labels: ${issue.labels.join(', ')}`);
    }

    if (issue.assignees.length > 0) {
      lines.push(`Assignees: ${issue.assignees.join(', ')}`);
    }

    if (issue.milestone) {
      lines.push(`Milestone: ${issue.milestone}`);
    }

    lines.push('');

    if (issue.body) {
      lines.push('Description:');
      lines.push(issue.body);
    } else {
      lines.push('Description: (none)');
    }

    if (issue.comments.length > 0) {
      lines.push('');
      lines.push('Comments:');

      for (const comment of issue.comments) {
        lines.push(`- ${comment}`);
      }
    }

    return lines.join('\n');
  }
}
