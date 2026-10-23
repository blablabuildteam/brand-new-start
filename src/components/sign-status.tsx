import Link from "next/link";
import { OUR_SIGNATURE, type BnsSignature, dateNl } from "@/lib/agreement";

/** Eén regel: wie heeft de overeenkomst getekend, wie nog niet. */
export function SignStatus({
  bns,
  current,
  linkToAgreement = false,
}: {
  bns: BnsSignature | null;
  current: boolean;
  linkToAgreement?: boolean;
}) {
  return (
    <div className={`sign-status ${current ? "sign-status--done" : ""}`}>
      <span className="sign-status__label">Ondertekening</span>
      <span className="sign-status__party sign-status__party--done">
        ✓ blablabuild · {dateNl(OUR_SIGNATURE.signedAt)}
      </span>
      {current && bns ? (
        <span className="sign-status__party sign-status__party--done">
          ✓ Brand New Start · {dateNl(bns.signedAt)}
        </span>
      ) : (
        <span className="sign-status__party sign-status__party--open">○ Brand New Start · nog te tekenen</span>
      )}
      {linkToAgreement && !current ? (
        <Link href="/pilot#tekenen" className="sign-status__cta">
          Naar de overeenkomst →
        </Link>
      ) : null}
    </div>
  );
}
