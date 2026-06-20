const fs = require('fs');
const file = 'c:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/hooks/useTasks.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{ sendNotification \} from '\.\.\/services\/notificationService';/g, "import { activityEventService } from '../services/activityEventService';");

content = content.replace(/sendNotification\(\s*workspaceId,\s*'system',\s*'New Task Assigned',\s*\You have been assigned to task: \$\{data\.name\}\,\s*data\.assignee_id,\s*\{\s*task_id:\s*data\.id,\s*project_id:\s*data\.project_id\s*\}\s*\)/g, 
"activityEventService.recordActivity({ workspace_id: workspaceId, actor_id: 'system', entity_type: 'system', entity_id: 'global', action_type: 'notification_event', metadata: { title: 'New Task Assigned', message: \You have been assigned to task: \\, target_user: data.assignee_id, type: 'task_assigned', task_id: data.id, project_id: data.project_id } })");

content = content.replace(/sendNotification\(\s*workspaceId,\s*'deadlines',\s*'Task Schedule Modified',\s*\Task \\"\$\{task\?\.name\.toUpperCase\(\)\}\\" timeline updated to: \$\{startDate \|\| 'Unset'\} - \$\{deadline \|\| 'Unset'\}\\s*\)/g, 
"activityEventService.recordActivity({ workspace_id: workspaceId, actor_id: 'system', entity_type: 'system', entity_id: 'global', action_type: 'notification_event', metadata: { title: 'Task Schedule Modified', message: \Task \\"\\\" timeline updated to: \ - \\, target_user: task?.assignee_id } })");

content = content.replace(/sendNotification\(\s*workspaceId,\s*'system',\s*'Task Reassigned',\s*\You have been assigned to task: \$\{updates\.name \|\| originalTask\.name\}\,\s*updates\.assignee_id,\s*\{\s*task_id:\s*taskId,\s*project_id:\s*originalTask\.project_id\s*\}\s*\)/g, 
"activityEventService.recordActivity({ workspace_id: workspaceId, actor_id: 'system', entity_type: 'system', entity_id: 'global', action_type: 'notification_event', metadata: { title: 'Task Reassigned', message: \You have been assigned to task: \\, target_user: updates.assignee_id, type: 'task_reassigned', task_id: taskId, project_id: originalTask.project_id } })");

content = content.replace(/sendNotification\(\s*workspaceId,\s*'system',\s*'Dependency Vector Wired',\s*\Task \\"\$\{taskA\?\.name\.toUpperCase\(\)\}\\" is now linked to depend on \\"\$\{taskB\?\.name\.toUpperCase\(\)\}\\"\\s*\)/g, 
"activityEventService.recordActivity({ workspace_id: workspaceId, actor_id: 'system', entity_type: 'system', entity_id: 'global', action_type: 'notification_event', metadata: { title: 'Dependency Vector Wired', message: \Task \\"\\\" is now linked to depend on \\"\\\"\ } })");

content = content.replace(/sendNotification\(\s*workspaceId,\s*'system',\s*'Task Ready for Review',\s*\Task \\"\$\{task\.name\}\\" is ready for PM review\.\,\s*undefined,\s*\{\s*type:\s*'task_review',\s*entity_id:\s*taskId,\s*deep_link:\s*\\/workspace\/projects\/\$\{task\.project_id\}\\s*\}\s*\)/g, 
"activityEventService.recordActivity({ workspace_id: workspaceId, actor_id: 'system', entity_type: 'system', entity_id: 'global', action_type: 'notification_event', metadata: { title: 'Task Ready for Review', message: \Task \\"\\\" is ready for PM review.\, type: 'task_review', entity_id: taskId, deep_link: \/workspace/projects/\\ } })");

content = content.replace(/sendNotification\(\s*workspaceId,\s*'system',\s*'Task Blocked',\s*\Task \\"\$\{task\.name\}\\" has been blocked\.\,\s*undefined,\s*\{\s*type:\s*'task_blocked',\s*entity_id:\s*taskId,\s*deep_link:\s*\\/workspace\/projects\/\$\{task\.project_id\}\\s*\}\s*\)/g, 
"activityEventService.recordActivity({ workspace_id: workspaceId, actor_id: 'system', entity_type: 'system', entity_id: 'global', action_type: 'notification_event', metadata: { title: 'Task Blocked', message: \Task \\"\\\" has been blocked.\, type: 'task_blocked', entity_id: taskId, deep_link: \/workspace/projects/\\ } })");

content = content.replace(/sendNotification\(\s*workspaceId,\s*'system',\s*'Changes Requested',\s*\Changes were requested on your task \\"\$\{task\.name\}\\"\.\,\s*task\.assignee_id,\s*\{\s*type:\s*'task_changes',\s*entity_id:\s*taskId,\s*deep_link:\s*\\/workspace\/projects\/\$\{task\.project_id\}\\s*\}\s*\)/g, 
"activityEventService.recordActivity({ workspace_id: workspaceId, actor_id: 'system', entity_type: 'system', entity_id: 'global', action_type: 'notification_event', metadata: { title: 'Changes Requested', message: \Changes were requested on your task \\"\\\".\, target_user: task.assignee_id, type: 'task_changes', entity_id: taskId, deep_link: \/workspace/projects/\\ } })");

content = content.replace(/sendNotification\(\s*workspaceId,\s*'system',\s*'Task Approved',\s*\Your task \\"\$\{task\.name\}\\" was approved and marked completed\.\,\s*task\.assignee_id,\s*\{\s*type:\s*'task_approved',\s*entity_id:\s*taskId,\s*deep_link:\s*\\/workspace\/projects\/\$\{task\.project_id\}\\s*\}\s*\)/g, 
"activityEventService.recordActivity({ workspace_id: workspaceId, actor_id: 'system', entity_type: 'system', entity_id: 'global', action_type: 'notification_event', metadata: { title: 'Task Approved', message: \Your task \\"\\\" was approved and marked completed.\, target_user: task.assignee_id, type: 'task_approved', entity_id: taskId, deep_link: \/workspace/projects/\\ } })");

fs.writeFileSync(file, content);
console.log('done');
