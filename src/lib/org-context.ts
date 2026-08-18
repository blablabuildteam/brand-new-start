/**
 * Manager / afdeling bij een contracting-kans.
 * LinkedIn levert vaak de job-poster; de tekst noemt afdeling / rapportagelijn.
 */

export type OrgContext = {
  department: string | null;
  hiringManager: string | null;
  hiringManagerTitle: string | null;
  contactName: string | null;
  contactTitle: string | null;
  contactUrl: string | null;
};

const GENERIC_DEPT = /^(other|engineering|information technology|it|consulting|business|management|project management|analyst|design|research|other\/unknown)$/i;

const RECRUITER_TITLE =
  /recruiter|talent acquisition|talent partner|sourcer|recruitment|werving|hr advisor|hr business|staffing|intercedent/i;

const MANAGER_TITLE =
  /\b(hiring manager|manager|lead|director|head of|hoofd|teamlead|team lead|chapter lead|product owner|opdrachtgever)\b/i;

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s.length >= 2 ? s : null;
}

function cleanLabel(raw: string, max = 80): string | null {
  const s = raw
    .replace(/[*_#]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/[|:;•·,]+$/g, "")
    .replace(/^(de|het|onze|the|our)\s+/i, "")
    .trim();
  if (s.length < 2 || s.length > max) return null;
  if (/^(en|of|voor|with|and)$/i.test(s)) return null;
  return s;
}

function isRecruiter(title: string | null): boolean {
  return Boolean(title && RECRUITER_TITLE.test(title));
}

function looksLikePerson(name: string): boolean {
  if (/https?:\/\//i.test(name)) return false;
  const parts = name.split(/\s+/);
  if (parts.length < 2 || parts.length > 6) return false;
  const tussen = /^(de|den|der|van|von|het|ten|ter|'t)$/i;
  const named = parts.filter((p) => !tussen.test(p));
  if (named.length < 1) return false;
  return named.every((p) => /^[A-ZÁÉÍÓÚÄËÏÖÜ][\p{L}'’.\-]+$/u.test(p));
}

function parseFromText(text: string): Pick<OrgContext, "department" | "hiringManager" | "hiringManagerTitle"> {
  const t = text.replace(/\r/g, "\n");
  let department: string | null = null;
  let hiringManager: string | null = null;
  let hiringManagerTitle: string | null = null;

  const deptRes = [
    /(?:afdeling|department|directoraat|business unit|organisatieonderdeel)\s*[:\-–]\s*([^\n.|]{2,80})/i,
    /binnen (?:het|de|onze)\s+(?:team|afdeling|directie|tribe)\s+[\u201c"'']?([A-ZÁÉÍÓÚ][^\n.|]{2,70})/i,
    /(?:team|tribe|chapter)\s*[:\-–]\s*([^\n.|]{2,80})/i,
    /(?:working|work) (?:in|within) (?:the|our)\s+([A-Z][^\n.]{2,70}?)\s+(?:team|department|tribe)/i,
    /team of ([^\n.]{3,70}?)\s+experts/i,
  ];
  for (const re of deptRes) {
    const m = t.match(re);
    if (m?.[1]) {
      const v = cleanLabel(m[1]);
      if (v && !GENERIC_DEPT.test(v) && !/opdrachtgever|vacature|functie/i.test(v)) {
        department = v;
        break;
      }
    }
  }

  const mgrRes = [
    /(?:hiring manager|leidinggevende|contactpersoon)\s*[:\-–]\s*([A-ZÁÉÍÓÚ][^\n|]{2,60})/i,
    /(?:je )?rapporteer(?:t|en)? aan\s*[:\-–]?\s*([A-ZÁÉÍÓÚ][a-zA-ZÀ-ÿ'’.\-]+(?:\s+[A-ZÁÉÍÓÚ][a-zA-ZÀ-ÿ'’.\-]+){0,3})/i,
    /reports? to\s*[:\-–]?\s*([A-Z][a-zA-Z'’.\-]+(?:\s+[A-Z][a-zA-Z'’.\-]+){0,3})/i,
    /reporting to\s*[:\-–]?\s*([A-Z][a-zA-Z'’.\-]+(?:\s+[A-Z][a-zA-Z'’.\-]+){0,3})/i,
  ];
  for (const re of mgrRes) {
    const m = t.match(re);
    if (m?.[1]) {
      const v = cleanLabel(m[1], 60);
      if (v && looksLikePerson(v)) {
        hiringManager = v;
        break;
      }
      if (v && !looksLikePerson(v) && v.length <= 50) {
        hiringManagerTitle = hiringManagerTitle || v;
      }
    }
  }

  return { department, hiringManager, hiringManagerTitle };
}

function fromRaw(raw: Record<string, unknown> | null | undefined): OrgContext {
  const r = raw && typeof raw === "object" ? raw : {};
  const posterName =
    str(r.jobPosterName) || str(r.posterName) || str(r.postedBy) || str(r.contactName);
  const posterTitle = str(r.jobPosterTitle) || str(r.posterTitle) || str(r.contactTitle);
  const posterUrl = str(r.jobPosterProfileUrl) || str(r.posterUrl) || str(r.contactUrl);
  const storedDept = str(r.department);
  const jobFn = str(r.jobFunction);
  const department =
    storedDept && !GENERIC_DEPT.test(storedDept)
      ? storedDept
      : jobFn && !GENERIC_DEPT.test(jobFn)
        ? jobFn
        : null;

  const recruiter = isRecruiter(posterTitle);
  const managerish = Boolean(posterTitle && MANAGER_TITLE.test(posterTitle) && !recruiter);
  const storedMgr = str(r.hiringManager);

  return {
    department,
    hiringManager: storedMgr || (managerish ? posterName : null),
    hiringManagerTitle: str(r.hiringManagerTitle) || (managerish ? posterTitle : null),
    contactName: recruiter || (!managerish && posterName && posterName !== storedMgr) ? posterName : null,
    contactTitle: recruiter || (!managerish && posterTitle) ? posterTitle : null,
    contactUrl: posterUrl,
  };
}

export function extractOrgContext(opts: {
  text?: string | null;
  raw?: Record<string, unknown> | null;
}): OrgContext {
  const parsed = parseFromText(opts.text || "");
  const rawed = fromRaw(opts.raw);
  const department = parsed.department || rawed.department;
  const hiringManager = parsed.hiringManager || rawed.hiringManager;
  const hiringManagerTitle = parsed.hiringManagerTitle || rawed.hiringManagerTitle;

  return {
    department,
    hiringManager,
    hiringManagerTitle,
    contactName:
      rawed.contactName && rawed.contactName !== hiringManager ? rawed.contactName : null,
    contactTitle:
      rawed.contactName && rawed.contactName !== hiringManager ? rawed.contactTitle : null,
    contactUrl: rawed.contactUrl,
  };
}

export function orgContextFromSignals(
  signals: { summary?: string | null; raw?: Record<string, unknown> | null }[]
): OrgContext {
  const empty: OrgContext = {
    department: null,
    hiringManager: null,
    hiringManagerTitle: null,
    contactName: null,
    contactTitle: null,
    contactUrl: null,
  };
  let acc = empty;
  for (const s of signals) {
    const next = extractOrgContext({
      text: [s.summary, typeof s.raw?.description === "string" ? s.raw.description : ""].join("\n"),
      raw: s.raw,
    });
    acc = {
      department: acc.department || next.department,
      hiringManager: acc.hiringManager || next.hiringManager,
      hiringManagerTitle: acc.hiringManagerTitle || next.hiringManagerTitle,
      contactName: acc.contactName || next.contactName,
      contactTitle: acc.contactTitle || next.contactTitle,
      contactUrl: acc.contactUrl || next.contactUrl,
    };
  }
  return acc;
}

export function orgContextToRaw(ctx: OrgContext): Record<string, string | null> {
  return {
    department: ctx.department,
    hiringManager: ctx.hiringManager,
    hiringManagerTitle: ctx.hiringManagerTitle,
    contactName: ctx.contactName,
    contactTitle: ctx.contactTitle,
    contactUrl: ctx.contactUrl,
  };
}
