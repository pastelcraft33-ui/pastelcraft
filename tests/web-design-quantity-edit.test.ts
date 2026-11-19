import test from "node:test";
import assert from "node:assert/strict";
import { webDesignLogSchema } from "../schemas/product-design";
const input={workflowStatus:"in_progress",currentStage:"",workContent:"작업 건수 정정",note:""};
test("웹디자인 기록 저장 시 작업 건수 검증",()=>{
  for(const value of [1,10,999999]) assert.equal(webDesignLogSchema.safeParse({...input,workQuantity:value}).success,true);
  for(const value of [0,-1,1.5,1000000,"10",null]) assert.equal(webDesignLogSchema.safeParse({...input,workQuantity:value}).success,false);
  assert.equal(webDesignLogSchema.safeParse(input).success,true);
});
