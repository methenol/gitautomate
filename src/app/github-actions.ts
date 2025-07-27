'use server'

import type { Task } from '@/types'
import type { Repository } from './github-actions-types'

// Action to get user repositories
export async function getRepositories(token: string): Promise<Repository[]> {
  const { Octokit } = await import('@octokit/rest')
  if (!token) {
    return []
  }
  try {
    const octokit = new Octokit({ auth: token })
    const repos = await octokit.repos.listForAuthenticatedUser({
      type: 'owner',
      sort: 'updated',
      per_page: 100,
    })

    return repos.data.map(repo => ({
      owner: repo.owner.login,
      name: repo.name,
      full_name: repo.full_name,
    }))
  } catch (error) {
    console.error('Failed to fetch repositories:', error)
    throw new Error(
      'Failed to fetch repositories. Please check your GitHub token.'
    )
  }
}

// Action to create a GitHub implementation plan with sub-issues for tasks
export async function createImplementationPlanIssues(
  token: string,
  repoFullName: string,
  prd: string,
  architecture: string,
  specifications: string,
  fileStructure: string,
  tasks: Task[]
): Promise<{ html_url: string }> {
  const { Octokit } = await import('@octokit/rest')
  if (!token || !repoFullName) {
    throw new Error('Missing token or repository information.')
  }
  const [owner, repo] = repoFullName.split('/')
  const octokit = new Octokit({ auth: token })

  // 1. Create sub-issues for each task first and collect their details.
  const createdTaskIssues: { title: string; url: string }[] = []
  for (const task of tasks) {
    try {
      const childIssue = await octokit.issues.create({
        owner,
        repo,
        title: task.title,
        body: task.details,
      })
      createdTaskIssues.push({
        title: task.title,
        url: childIssue.data.html_url,
      })
      // Delay to avoid hitting GitHub's secondary rate limits.
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`Failed to create issue for task "${task.title}":`, error)
      // We'll still try to create the parent issue, but this one will be marked as failed.
      createdTaskIssues.push({
        title: `${task.title} (⚠️ Failed to create)`,
        url: '#',
      })
    }
  }

  // 2. Construct the body for the main implementation issue (parent issue)
  const taskList = createdTaskIssues
    .map(issue => `- [ ] [${issue.title}](${issue.url})`)
    .join('\n')

  const parentIssueBody = `
### Product Requirements Document
${prd}

---

### Proposed Architecture
${architecture}

---

### File Structure
${fileStructure}

---

### Specifications
${specifications}

---

### Actionable Tasks
${taskList || 'No tasks were created.'}
`.trim()

  // 3. Create the main implementation issue with the full task list.
  try {
    const response = await octokit.issues.create({
      owner,
      repo,
      title: `🚀 Implementation Plan: ${prd.substring(0, 50)}...`,
      body: parentIssueBody,
    })
    return { html_url: response.data.html_url }
  } catch (error) {
    console.error('Failed to create parent GitHub issue:', error)
    // If this fails, the user has all the sub-tasks, but no parent.
    // We should inform them of this.
    throw new Error(
      'Successfully created task issues, but failed to create the main tracking issue. You can find the individual tasks in your repository.'
    )
  }
}
