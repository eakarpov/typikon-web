import N1t from "@/app/dictionary/[id]/declension/N1/N1t";
import N1t_extra from "@/app/dictionary/[id]/declension/N1/N1t_extra";
import N1sj from "@/app/dictionary/[id]/declension/N1/N1sj";
import N1s from "@/app/dictionary/[id]/declension/N1/N1s";
import N1k_extra from "@/app/dictionary/[id]/declension/N1/N1k_extra";
import N1k from "@/app/dictionary/[id]/declension/N1/N1k";
import N1j_extra from "@/app/dictionary/[id]/declension/N1/N1j_extra";
import N1j from "@/app/dictionary/[id]/declension/N1/N1j";
import N1in from "@/app/dictionary/[id]/declension/N1/N1in";
import N1i from "@/app/dictionary/[id]/declension/N1/N1i";
import N1g from "@/app/dictionary/[id]/declension/N1/N1g";
import N1e from "@/app/dictionary/[id]/declension/N1/N1e";
import N1c_extra from "@/app/dictionary/[id]/declension/N1/N1c_extra";
import N1a from "@/app/dictionary/[id]/declension/N1/N1a";

const schemes = {
    N1a,
    'N1c*': N1c_extra,
    N1e,
    N1g,
    N1i,
    N1in,
    N1j,
    'N1j*': N1j_extra,
    N1k,
    'N1k*': N1k_extra,
    N1s,
    N1sj,
    N1t,
    'N1t*': N1t_extra,
};

const decline = (word: any, scheme: keyof typeof schemes) => {
    const declension = schemes[scheme](word);

    return declension;
}

export default decline;
