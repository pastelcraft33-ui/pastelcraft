import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PASSWORD_PEPPER: z.string().min(16),
  INITIAL_ADMIN_LOGIN_ID: z.string().regex(/^[a-z0-9._-]{4,32}$/),
  INITIAL_ADMIN_PASSWORD: z.string().min(12).max(72),
  INITIAL_ADMIN_NAME: z.string().min(2).max(50),
  INITIAL_ADMIN_POSITION: z.enum(["사원", "대리", "과장", "차장", "부장", "팀장", "대표"]),
  INITIAL_ADMIN_DEPARTMENT: z.enum(["웹팀", "물류", "물류팀", "남대문팀"]),
  INITIAL_ADMIN_PHONE: z.string().regex(/^010-\d{4}-\d{4}$/),
});

async function main() {
  const env = envSchema.parse(process.env);
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const preparedPassword = createHash("sha256")
    .update(env.INITIAL_ADMIN_PASSWORD)
    .update(env.PASSWORD_PEPPER)
    .digest("hex");
  const passwordHash = await bcrypt.hash(preparedPassword, 12);

  const { error } = await supabase.from("employees").insert({
    login_id: env.INITIAL_ADMIN_LOGIN_ID.toLowerCase(),
    password_hash: passwordHash,
    name: env.INITIAL_ADMIN_NAME,
    position: positionToDb(env.INITIAL_ADMIN_POSITION),
    department: departmentToDb(env.INITIAL_ADMIN_DEPARTMENT),
    phone: env.INITIAL_ADMIN_PHONE,
    role: "admin",
    account_status: "active",
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("같은 로그인 아이디의 직원이 이미 존재합니다.");
    }
    throw error;
  }

  console.log(`초기 관리자 '${env.INITIAL_ADMIN_LOGIN_ID}' 계정을 생성했습니다.`);
}

function positionToDb(position: z.infer<typeof envSchema>["INITIAL_ADMIN_POSITION"]) {
  return {
    사원: "staff",
    대리: "assistant_manager",
    과장: "manager",
    차장: "deputy_general_manager",
    부장: "general_manager",
    팀장: "team_lead",
    대표: "representative",
  }[position];
}

function departmentToDb(department: z.infer<typeof envSchema>["INITIAL_ADMIN_DEPARTMENT"]) {
  return {
    웹팀: "web",
    물류: "logistics",
    물류팀: "logistics",
    남대문팀: "namdaemun",
  }[department];
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  console.error(`관리자 생성 실패: ${message}`);
  process.exitCode = 1;
});
