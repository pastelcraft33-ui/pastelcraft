/** Group records, not entered quantities; preserve original records and ordering. */
export function groupMdTasks<T extends {assigneeId:string;workType:string;workflowStatus:string}>(tasks:T[]) {
  const groups=new Map<string,{key:string;workType:string;tasks:T[];completed:number}>();
  for(const task of tasks){
    const key=JSON.stringify([task.assigneeId,task.workType]);
    const group=groups.get(key)??{key,workType:task.workType,tasks:[],completed:0};
    group.tasks.push(task);
    if(task.workflowStatus==="completed")group.completed++;
    groups.set(key,group);
  }
  return [...groups.values()];
}
