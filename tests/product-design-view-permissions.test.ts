import test from "node:test";
import assert from "node:assert/strict";
import { canViewOtherDesignAssignee, canManageProductDesignTask, canDeleteProductDesignTask } from "../lib/product-design/permissions";

test("웹팀 일반 직원은 모든 웹 업무 공간에서 다른 담당자 조회만 가능", () => {
  const employee = { id:"viewer",role:"employee" as const,positionCode:"staff",departmentCode:"web_design" };
  assert.equal(canViewOtherDesignAssignee(employee,"product_design"),true);
  assert.equal(canManageProductDesignTask(employee,"other"),false);
  assert.equal(canDeleteProductDesignTask(employee,"other"),false);
  assert.equal(canManageProductDesignTask(employee,"viewer"),true);
  for (const workspace of ["web_design","web_education","web_marketing","web_md"]) {
    assert.equal(canViewOtherDesignAssignee(employee,workspace),true);
    assert.equal(canViewOtherDesignAssignee({...employee,departmentCode:"web_marketing"},workspace),true);
    assert.equal(canViewOtherDesignAssignee({...employee,departmentCode:"logistics"},workspace),false);
  }
  assert.equal(canViewOtherDesignAssignee(employee,"unknown"),false);
  assert.equal(canViewOtherDesignAssignee({...employee,departmentCode:"web_marketing"},"product_design"),true);
  assert.equal(canViewOtherDesignAssignee({...employee,departmentCode:"logistics"},"product_design"),false);
  assert.equal(canViewOtherDesignAssignee({...employee,role:"admin",positionCode:"representative",departmentCode:"unassigned"},"product_design"),true);
});
