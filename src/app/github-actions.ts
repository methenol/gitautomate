'use server';

import type { Task } from '@/types';
import { parseFrontmatter } from '@/lib/frontmatter';

// A type for repository data
export interface Repository {
  owner: string;
  name: string;
  full_name: string;
}

// Action to get user repositories
export async function getRepositories(token: string): Promise<Repository[]> {
  const { Octokit } = await import('@octokit/rest');
  if (!token) {
    return [];
  }
  try {
    const octokit = new Octokit({ auth: token });
    const repos = await octokit.repos.listForAuthenticatedUser({
      type: 'owner',
      sort: 'updated',
      per_page: 100,
    });

    return repos.data.map((repo) => ({
      owner: repo.owner.login,
      name: repo.name,
      full_name: repo.full_name,
    }));
  } catch (error) {
    console.error('Failed to fetch repositories:', error);
    throw new Error(
      'Failed to fetch repositories. Please check your GitHub token.'
    );
  }
}

/**
 * Render a task as an issue body.
 *
 * The generated brief already carries frontmatter, which GitHub renders as a stray
 * horizontal rule, so the metadata is promoted into a readable header instead and the
 * brief follows verbatim — an agent picking up the issue gets the same contract as one
 * reading `tasks/task-NNN.md`.
 */
function buildTaskIssueBody(task: Task): string {
  const { frontmatter, body } = parseFrontmatter(task.details ?? '');
  const hasMetadata = task.id || task.dependsOn?.length || task.files?.length;

  if (!hasMetadata && Object.keys(frontmatter).length === 0) {
    return task.details ?? '';
  }

  const dependsOn = task.dependsOn?.length ? task.dependsOn.join(', ') : 'nothing';
  const files = task.files?.length ? task.files.map((file) => `\`${file}\``).join(', ') : '—';

  const header = [
    task.id ? `**Task:** ${task.id}` : null,
    `**Depends on:** ${dependsOn}`,
    `**Files:** ${files}`,
    task.outcome ? `**Done when:** ${task.outcome}` : null,
    '',
    '> This issue is a complete brief. Implement only what its Scope allows, satisfy every',
    '> acceptance criterion, and make every quality gate pass before closing it.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return `${header}\n\n---\n\n${body.trim()}`;
}

// Action to create a GitHub implementation plan with sub-issues for tasks
export async function createImplementationPlanIssues(
  token: string,
  repoFullName: string,
  prd: string,
  architecture: string,
  specifications: string,
  fileStructure: string,
  tasks: Task[],
  standards?: string
): Promise<{ html_url: string }> {
  const { Octokit } = await import('@octokit/rest');
  if (!token || !repoFullName) {
    throw new Error('Missing token or repository information.');
  }
  const [owner, repo] = repoFullName.split('/');
  const octokit = new Octokit({ auth: token });

  // 1. Create sub-issues for each task first and collect their details.
  const createdTaskIssues: { title: string; url: string }[] = [];
  for (const task of tasks) {
    try {
      const childIssue = await octokit.issues.create({
        owner,
        repo,
        title: task.id ? `${task.id} — ${task.title}` : task.title,
        body: buildTaskIssueBody(task),
      });
      createdTaskIssues.push({
        title: task.title,
        url: childIssue.data.html_url,
      });
      // Delay to avoid hitting GitHub's secondary rate limits.
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to create issue for task "${task.title}":`, error);
      // We'll still try to create the parent issue, but this one will be marked as failed.
      createdTaskIssues.push({
        title: `${task.title} (⚠️ Failed to create)`,
        url: '#',
      });
    }
  }

  // 2. Construct the body for the main implementation issue (parent issue).
  // Ordering and dependencies come first: this issue is the thing an agent (or a
  // human dispatching agents) reads to decide what to pick up next.
  const taskList = createdTaskIssues
    .map((issue, index) => {
      const task = tasks[index];
      const deps = task?.dependsOn?.length ? ` — after ${task.dependsOn.join(', ')}` : '';
      return `- [ ] [${issue.title}](${issue.url})${deps}`;
    })
    .join('\n');

  const parentIssueBody = [
    '## How to work this plan',
    '',
    'Work the tasks below in order. Do not start a task until every task it depends on is',
    'closed. Each task issue is a complete brief: implement only what its Scope allows,',
    'satisfy every acceptance criterion, and make every quality gate pass before closing it.',
    '',
    '## Tasks',
    '',
    taskList || 'No tasks were created.',
    '',
    '---',
    '',
    '## Product Requirements Document',
    '',
    prd,
    '',
    '---',
    '',
    '## Architecture',
    '',
    architecture,
    '',
    '---',
    '',
    '## Specifications',
    '',
    specifications,
    '',
    '---',
    '',
    '## File Structure',
    '',
    fileStructure,
    ...(standards
      ? ['', '---', '', '## Engineering Standards And Quality Gates', '', standards]
      : []),
  ].join('\n');

  // 3. Create the main implementation issue with the full task list.
  try {
    const response = await octokit.issues.create({
      owner,
      repo,
      title: `🚀 Implementation Plan: ${prd.substring(0, 50)}...`,
      body: parentIssueBody,
    });
    return { html_url: response.data.html_url };
  } catch (error) {
    console.error('Failed to create parent GitHub issue:', error);
    // If this fails, the user has all the sub-tasks, but no parent.
    // We should inform them of this.
    throw new Error(
      'Successfully created task issues, but failed to create the main tracking issue. You can find the individual tasks in your repository.'
    );
  }
}
