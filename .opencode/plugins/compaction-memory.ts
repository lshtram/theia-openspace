import type { Plugin } from "@opencode-ai/plugin"
import * as fs from "fs"
import * as path from "path"

/**
 * Compaction Memory Plugin
 *
 * Ensures the agent's in-flight task survives context compaction by:
 *
 * 1. `experimental.session.compacting` hook: reads current_task.md and injects
 *    it into the compaction context so the LLM includes it in its summary.
 *
 * 2. `event` hook (session.compacted): after compaction completes, writes a
 *    reminder into current_task.md prompting the next agent to re-read it.
 */
export const CompactionMemoryPlugin: Plugin = async ({ directory }) => {
  const taskFilePath = path.join(directory, ".opencode/_context/01_memory/current_task.md")

  function readTaskFile(): string | null {
    try {
      const content = fs.readFileSync(taskFilePath, "utf-8")
      // Only inject if there is actual task content (not just the template)
      const hasTask = content.includes("## Task") && !content.includes("## Task\n<one sentence")
      return hasTask ? content : null
    } catch {
      return null
    }
  }

  return {
    "experimental.session.compacting": async (_input, output) => {
      const taskContent = readTaskFile()
      if (!taskContent) return

      output.context.push(
        `## CRITICAL: In-flight task from current_task.md\n\nThe following file tracks an active multi-step task. You MUST include its full content in your summary so the next agent can resume it without loss.\n\n\`\`\`\n${taskContent}\n\`\`\`\n\nIn your summary, reproduce the current_task.md content under an "## In-Flight Task" section so it is not lost.`,
      )
    },

    event: async ({ event }) => {
      if (event.type !== "session.compacted") return

      const taskContent = readTaskFile()
      if (!taskContent) return

      // Append a post-compaction reminder so the agent knows to check the file
      const reminder = `\n\n---\n<!-- POST-COMPACTION: Context was compacted. Re-read this file and resume the task from "Where I Am". -->\n`

      try {
        const current = fs.readFileSync(taskFilePath, "utf-8")
        // Only append if reminder not already present
        if (!current.includes("POST-COMPACTION")) {
          fs.writeFileSync(taskFilePath, current + reminder, "utf-8")
        }
      } catch {
        // Non-fatal: file may not exist or be writable
      }
    },
  }
}
