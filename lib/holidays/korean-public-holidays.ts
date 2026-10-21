import "server-only";

import { parseKoreanPublicHolidayXml } from "@/lib/holidays/parse-korean-public-holidays";

const KOREAN_HOLIDAY_API_URL =
  "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

export type KoreanPublicHoliday = {
  date: string;
  name: string;
};

function currentKoreanYear() {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
    }).format(new Date()),
  );
}

function encodedServiceKey() {
  const key = process.env.KOREA_HOLIDAY_API_KEY?.trim();
  if (!key) {
    throw new Error("대한민국 공휴일 API 환경변수가 설정되지 않았습니다.");
  }
  return key.includes("%") ? key : encodeURIComponent(key);
}

async function fetchKoreanPublicHolidays(year: number) {
  const requestUrl = new URL(KOREAN_HOLIDAY_API_URL);
  requestUrl.search = [
    `ServiceKey=${encodedServiceKey()}`,
    `solYear=${year}`,
    "numOfRows=100",
    "pageNo=1",
  ].join("&");

  const response = await fetch(requestUrl, {
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/xml" },
    next: {
      revalidate: ONE_DAY_IN_SECONDS,
      tags: [`korean-public-holidays-${year}`],
    },
  });
  if (!response.ok) {
    throw new Error(`대한민국 공휴일 API 응답 오류 (${response.status})`);
  }

  return parseKoreanPublicHolidayXml(await response.text());
}

export async function getKoreanPublicHolidays(requestedYears?: number[]) {
  const year = currentKoreanYear();
  const years = requestedYears ?? [year - 1, year, year + 1, year + 2];
  const results = await Promise.all(years.map(fetchKoreanPublicHolidays));
  const holidayByDate = new Map<string, KoreanPublicHoliday>();

  results.flat().forEach((holiday) => {
    const current = holidayByDate.get(holiday.date);
    holidayByDate.set(holiday.date, {
      date: holiday.date,
      name:
        current && current.name !== holiday.name
          ? `${current.name} · ${holiday.name}`
          : holiday.name,
    });
  });

  return [...holidayByDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
