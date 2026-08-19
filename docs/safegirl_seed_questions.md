# SafeGirl — Seed Questions & Labeling Guide (Draft v1)

Status: first pass, not yet reviewed by domain expert. GBV-related seeds are provisional —
final source document for this class is still pending supervisor/expert approval per the
dataset plan (Section 7, open items).

---

## Labeling guide — boundary rules

When a query could plausibly fit more than one class, apply these rules in order:

1. **GBV-related takes priority** if the query describes coercion, force, violence, or lack
   of consent — even if it also mentions contraception, pregnancy, or STIs as a consequence.
   (e.g. "My boyfriend forced me and now I'm scared I'm pregnant" → GBV-related, not Pregnancy)
2. **Confidentiality/privacy questions belong to whichever health topic they're attached to**,
   not to General — "Can I get an STI test without my parents knowing?" is STIs, not General.
   General is reserved for app-mechanics or non-health-topic questions only.
3. **Ambiguous multi-topic queries** (e.g. "How do I avoid getting pregnant or catching
   something?") are labeled by the *first* concern raised, unless one topic is clearly the
   main point — flag genuinely ambiguous cases during review rather than guessing.

---

## Contraception (10 seeds)

1. What birth control options exist for someone my age?
2. Can I get contraception without my parents knowing?
3. What happens if a condom breaks during sex?
4. How effective is the birth control pill really?
5. Where can I get emergency contraception quickly?
6. Do contraceptive injections have side effects?
7. Is it true that birth control affects your ability to have children later?
8. What's the difference between condoms and other contraceptive methods?
9. Can I get contraception at a regular clinic or do I need a special one?
10. How soon after unprotected sex can I take emergency contraception?

## STIs (10 seeds)

1. How do I know if I have an STI?
2. Can I get an STI test without my parents knowing?
3. Can you get an STI even if you used a condom?
4. What are the common signs of an STI?
5. Where can I get tested confidentially?
6. Is it possible to have an STI with no symptoms at all?
7. How long after exposure should I wait before getting tested?
8. Can STIs be treated completely, or do they stay with you?
9. What should I do if I think my partner has an STI?
10. Is HIV testing part of regular STI testing or separate?

## Pregnancy (10 seeds)

1. How do I know if I'm pregnant?
2. I think I might be pregnant — what should I do first?
3. Is it safe to go to a clinic if I'm under 18 and pregnant?
4. What are my options if I'm pregnant and not ready to tell my family?
5. How early can a pregnancy test detect a pregnancy?
6. What does antenatal care actually involve?
7. Can I still go to school if I'm pregnant?
8. What are the risks of a first pregnancy at a young age?
9. Who can I talk to about a pregnancy without being judged?
10. What happens at a first antenatal visit?

## GBV-related (6 seeds — provisional, pending source approval)

1. What counts as sexual abuse?
2. My partner is forcing me to do things I don't want to do — what do I do?
3. How do I report someone hurting me without getting in trouble myself?
4. Is it abuse if it's someone I know, not a stranger?
5. What should I do if I feel unsafe at home?
6. Where can I get help if someone is threatening me?

## General (8 seeds)

1. How does this app keep me anonymous?
2. Is my information ever shared with anyone?
3. Where's the nearest youth-friendly clinic?
4. Can I talk to a real person instead of just the chat?
5. Does this app work if I don't have internet?
6. Do I need to give my name or phone number to use this?
7. Can I delete my conversation history?
8. What languages does this app support?

---

## Next steps

- [ ] Domain expert review of Contraception, STIs, Pregnancy, General seeds
- [ ] GBV source confirmed → finalize and expand GBV seeds to match the other classes (target ~10)
- [ ] Once approved, proceed to LLM-assisted paraphrasing per the documented procedure
