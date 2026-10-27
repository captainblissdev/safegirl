# V4 labelling guide (27 Oct 2026)

Draft 2 with the edits recorded in docs/decision-log.md, "V4
pre-registration: deviation 3 (2026-10-27), labelling guide and
timing".

Label each question with ONE primary class, by the topic a clinician
would file it under, not by its wording. Label the MAIN worry. If the
rules below conflict or two classes are equally plausible, mark it
"ambiguous" (reported separately). A secondary class is allowed for
sealed or test items only, never for training seeds. Ignore whether a
safety rule would fire: if it sounds like abuse or distress, still
give a topic label and tick safety_flag (not scored). Do not look at
any model output while labelling.

## Classes

- contraception: methods, access, side effects, myths, condom use,
  condom accidents, emergency contraception.
- sti: STIs and HIV: symptoms, discharge, itching, sores, vaginal
  infections including thrush and BV, testing, prevention (PrEP, HPV
  vaccine, condoms as infection protection), PEP, cures, myths.
- pregnancy: chance of pregnancy, signs, tests, antenatal care,
  staying in school, options including abortion, care of the mother
  after birth; a late period when sex or pregnancy is the worry.
- general: other adolescent SRH: (a) periods, cramps, PMS, puberty,
  body changes, menstrual hygiene and products; (b) clinics, access,
  cost, age, privacy, fear of being judged, with no specific topic.
  Needs a named service, clinic, cost, privacy or fear of being
  judged; (c) consent, relationships, pressure, how to talk to a
  partner; (d) a late period with a stated non-pregnancy cause.
- out_of_scope: no SRH content: other topics, and health problems that
  are not reproductive or menstrual (cuts, toothache, flu, diabetes,
  baby vaccines and baby care, medicines not for an SRH problem, exam
  nerves).
- vague: no identifiable topic or question: greetings, tests of the
  app, openers, a feeling with no question ("something happened").
  Asking for help or who to turn to, with no topic and no service
  named.

## Rules

1. A service, cost or privacy question about a specific topic takes
   that topic ("can I test for HIV without my parents" = sti). Section
   (b) is only for questions with no topic.
2. Asking how to talk to a partner (about condoms, testing, saying
   no) = general (c). Information about the condom, test or method
   itself = its topic. Exception: telling a partner about a test
   result or diagnosis = sti.
3. "Can I get pregnant if...": pregnancy, for sex acts, timing and
   withdrawal or precum (withdrawal is a sex act, not a method).
   Contraception only if it names a method (pill, injection, implant,
   condom, emergency contraception) or a failure of one.
4. Late period: pregnancy if sex or pregnancy is the worry or nothing
   is stated. A stated non-pregnancy cause wins, even if pregnancy is
   mentioned: general.
5. Discharge: general if the question ties it to the cycle, puberty
   or age. Otherwise sti, including "is this normal or a problem" with
   no context.
6. Cramps or pelvic pain: general; sti if with burning or unusual
   discharge.
7. Held topics are labelled by topic, not by how the app handles them:
   emergency contraception and condom accidents = contraception,
   abortion = pregnancy, PEP = sti.
8. Abuse or distress with no SRH question: abuse = general (c), with
   safety_flag; distress with no topic = vague, with safety_flag.
9. SRH content mixed with something unrelated: the SRH class.
