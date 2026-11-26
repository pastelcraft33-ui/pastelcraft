import test from "node:test";
import assert from "node:assert/strict";
import {groupMdTasks} from "../lib/product-design/md-groups";
test("MD 반복 업무는 담당자와 작업 구분으로 묶고 수량이 아닌 기록을 센다",()=>{
  const tasks=[
    {id:"1",assigneeId:"a",workType:"order_collection",workflowStatus:"completed",workQuantity:100},
    {id:"2",assigneeId:"a",workType:"order_collection",workflowStatus:"in_progress",workQuantity:2},
    {id:"3",assigneeId:"b",workType:"order_collection",workflowStatus:"completed",workQuantity:8},
    {id:"4",assigneeId:"a",workType:"other",workflowStatus:"completed",workQuantity:1},
  ];
  const groups=groupMdTasks(tasks);
  assert.equal(groups.length,3);
  assert.equal(groups[0].tasks.length,2);
  assert.equal(groups[0].completed,1);
  assert.deepEqual(groups[0].tasks.map(t=>t.id),["1","2"]);
  assert.equal(tasks.length,4);
  assert.deepEqual(groupMdTasks([]),[]);
});
