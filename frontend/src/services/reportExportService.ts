export const reportExportService = {
  /**
   * Export report snapshot as JSON
   */
  exportAsJson(snapshot: any, filename: string) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${filename}.json`);
    dlAnchorElem.click();
  },

  /**
   * Export report snapshot as Markdown
   */
  exportAsMarkdown(snapshot: any, filename: string) {
    let md = `# Resolve PM Report - ${new Date(snapshot.period?.end || Date.now()).toLocaleDateString()}\n\n`;
    
    if (snapshot.metrics) {
      md += `## Metrics\n`;
      Object.keys(snapshot.metrics).forEach(k => {
        md += `- **${k}**: ${snapshot.metrics[k]}\n`;
      });
      md += `\n`;
    }

    if (snapshot.activityDigest) {
      md += `## Activity Digest\n`;
      const dig = snapshot.activityDigest;
      md += `- Total Events: ${dig.totalEvents}\n`;
      md += `- Tasks Progressed: ${dig.tasksProgressed}\n`;
      md += `- Tasks Completed: ${dig.tasksCompleted}\n`;
      md += `- Tasks Blocked: ${dig.tasksBlocked}\n`;
      md += `- Mass Timeline Shifts: ${dig.timelineShifts}\n`;
      md += `\n`;
    }

    if (snapshot.risks && snapshot.risks.length > 0) {
      md += `## Risks\n`;
      snapshot.risks.forEach((r: any) => {
        md += `- [${r.taskName || r.taskId}]: ${r.reason}\n`;
      });
    }

    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(md);
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${filename}.md`);
    dlAnchorElem.click();
  }
};
