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

export type GitHubPullRequest = {
  author: string;
  baseRefName: string;
  body: string;
  headOwner: string;
  headRefName: string;
  number: number;
  state: string;
  title: string;
  url: string;
};

export type GitHubIssueComment = {
  author: string;
  body: string;
  createdAt: string;
  id: number;
  kind: 'issue_comment';
  pullRequestNumber: number;
  url: string;
};

export type GitHubReviewComment = {
  author: string;
  body: string;
  createdAt: string;
  diffHunk: string | null;
  id: number;
  kind: 'review_comment';
  line: number | null;
  path: string | null;
  pullRequestNumber: number;
  url: string;
};

export type ParsedIssueInput = {
  owner: string;
  repo: string;
  issueNumber: number;
};

export namespace GitHub {
  function buildHeaders(token?: string) {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async function fetchJson(url: string, token?: string) {
    const response = await Http.fetchWithRetry(
      url,
      { headers: buildHeaders(token) },
      {
        timeoutMs: 6_000,
        retries: 2,
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API error (HTTP ${response.status}) when fetching ${url}.`);
    }

    return response.json() as Promise<any>;
  }

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

  export async function fetchPullRequest(
    owner: string,
    repo: string,
    pullRequestNumber: number,
    token?: string,
  ): Promise<GitHubPullRequest> {
    const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullRequestNumber}`;
    const data = await fetchJson(url, token);

    return {
      author: data.user?.login ?? 'unknown',
      baseRefName: data.base?.ref ?? '',
      body: data.body ?? '',
      headOwner: data.head?.repo?.owner?.login ?? owner,
      headRefName: data.head?.ref ?? '',
      number: data.number ?? 0,
      state: data.state ?? '',
      title: data.title ?? '',
      url: data.html_url ?? '',
    };
  }

  export async function findOpenPullRequestByBranch(
    owner: string,
    repo: string,
    branch: string,
    token?: string,
  ): Promise<GitHubPullRequest | undefined> {
    const url = new URL(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
    );

    url.searchParams.set('head', `${owner}:${branch}`);
    url.searchParams.set('state', 'open');
    url.searchParams.set('per_page', '100');

    const data = (await fetchJson(url.toString(), token)) as any[];
    const pullRequest = data[0];

    if (!pullRequest) {
      return undefined;
    }

    return {
      author: pullRequest.user?.login ?? 'unknown',
      baseRefName: pullRequest.base?.ref ?? '',
      body: pullRequest.body ?? '',
      headOwner: pullRequest.head?.repo?.owner?.login ?? owner,
      headRefName: pullRequest.head?.ref ?? '',
      number: pullRequest.number ?? 0,
      state: pullRequest.state ?? '',
      title: pullRequest.title ?? '',
      url: pullRequest.html_url ?? '',
    };
  }

  export async function fetchIssueComment(
    owner: string,
    repo: string,
    commentId: number,
    token?: string,
  ): Promise<GitHubIssueComment> {
    const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${commentId}`;
    const data = await fetchJson(url, token);

    return mapIssueComment(data);
  }

  export async function fetchReviewComment(
    owner: string,
    repo: string,
    commentId: number,
    token?: string,
  ): Promise<GitHubReviewComment> {
    const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/comments/${commentId}`;
    const data = await fetchJson(url, token);

    return mapReviewComment(data);
  }

  export async function fetchPullRequestIssueComments(
    owner: string,
    repo: string,
    pullRequestNumber: number,
    token?: string,
  ): Promise<GitHubIssueComment[]> {
    const url = new URL(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${pullRequestNumber}/comments`,
    );

    url.searchParams.set('per_page', '100');

    const data = (await fetchJson(url.toString(), token)) as any[];
    return data.map((comment) => mapIssueComment(comment));
  }

  export async function fetchPullRequestReviewComments(
    owner: string,
    repo: string,
    pullRequestNumber: number,
    token?: string,
  ): Promise<GitHubReviewComment[]> {
    const url = new URL(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullRequestNumber}/comments`,
    );

    url.searchParams.set('per_page', '100');

    const data = (await fetchJson(url.toString(), token)) as any[];
    return data.map((comment) => mapReviewComment(comment));
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

  function parsePullRequestNumberFromUrl(url: string): number {
    const match = url.match(/\/(?:issues|pulls)\/(\d+)$/);

    if (!match) {
      throw new Error(`Unable to determine pull request number from GitHub URL: ${url}`);
    }

    return Number.parseInt(match[1] as string, 10);
  }

  function mapIssueComment(data: any): GitHubIssueComment {
    const url = data.html_url ?? '';

    if (typeof url === 'string' && !url.includes('/pull/')) {
      throw new Error(`GitHub comment is not attached to a pull request: ${url}`);
    }

    return {
      author: data.user?.login ?? 'unknown',
      body: data.body ?? '',
      createdAt: data.created_at ?? '',
      id: data.id ?? 0,
      kind: 'issue_comment',
      pullRequestNumber: parsePullRequestNumberFromUrl(data.issue_url ?? data.html_url ?? ''),
      url,
    };
  }

  function mapReviewComment(data: any): GitHubReviewComment {
    return {
      author: data.user?.login ?? 'unknown',
      body: data.body ?? '',
      createdAt: data.created_at ?? '',
      diffHunk: data.diff_hunk ?? null,
      id: data.id ?? 0,
      kind: 'review_comment',
      line: typeof data.line === 'number' ? data.line : null,
      path: data.path ?? null,
      pullRequestNumber: parsePullRequestNumberFromUrl(
        data.pull_request_url ?? data.html_url ?? '',
      ),
      url: data.html_url ?? '',
    };
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
