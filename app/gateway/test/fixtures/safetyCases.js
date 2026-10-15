/**
 * Shared Safety Net cases: used by safetyNet.test.js and by the
 * gateway/offline parity test, so both implementations are checked
 * against exactly the same list.
 */

/** [query, expected category] */
const POSITIVE = [
  // Self-harm and suicidal statements, first person.
  ["I want to kill myself", "self_harm"],
  ["i wanna die", "self_harm"],
  ["I want 2 die", "self_harm"],
  ["I dont want to be alive anymore", "self_harm"],
  ["I don’t want to live", "self_harm"],
  ["I want to end my life", "self_harm"],
  ["I keep hurting myself", "self_harm"],
  ["I have been cutting myself", "self_harm"],
  ["there is no reason to live", "self_harm"],
  ["I have nothing to live for", "self_harm"],
  ["I wish I was dead", "self_harm"],
  ["everyone would be better off without me", "self_harm"],
  ["I am thinking about suicide", "self_harm"],
  ["I want to kil my self", "self_harm"],
  // Self-harm, third person.
  ["my friend wants to die", "self_harm"],
  ["she said she will kill herself", "self_harm"],
  ["my sister keeps harming herself", "self_harm"],
  // Abuse, present and past tense.
  ["he beats me", "abuse"],
  ["he hits me on the head", "abuse"],
  ["she slapped me", "abuse"],
  ["I was beaten by my stepfather", "abuse"],
  ["he keeps touching me", "abuse"],
  ["he forces me to have sex", "abuse"],
  ["he makes me have sex with him", "abuse"],
  ["he pressures me into sex", "abuse"],
  ["I was molested", "abuse"],
  ["I said no but he got angry", "abuse"],
  // Blackmail and threats.
  ["he is blackmailing me with my photos", "abuse"],
  ["he will post my nudes", "abuse"],
  [
    "he says he will leak my naked pictures unless I have sex with him",
    "abuse",
  ],
  ["he threatened to kill me", "abuse"],
  ["my dad threatens me", "abuse"],
  ["he threatened to beat me", "abuse"],
  // Self-harm: newer families.
  ["I see no point in going on", "self_harm"],
  ["there is no reason to keep going", "self_harm"],
  ["I dont see a reason to keep going", "self_harm"],
  ["i cant see any point in living", "self_harm"],
  ["I just want everything to end", "self_harm"],
  ["I wish my life would end", "self_harm"],
  ["I really hate my life", "self_harm"],
  ["I am tired of being alive", "self_harm"],
  ["they would be better off if I wasnt here", "self_harm"],
  ["I keep thinking about how to end it", "self_harm"],
  ["my sister says she will hurt herself", "self_harm"],
  // Abuse: secrecy with touch or sex, threats to kill, FGM, nude requests.
  ["my coach told me not to tell anyone after he touched me", "abuse"],
  ["he said it is our secret and he touches my body", "abuse"],
  ["keep it a secret he said, after sex", "abuse"],
  ["my boyfriend is going to kill me", "abuse"],
  ["my dad'll kill me", "abuse"],
  ["they are taking me to be cut in December", "abuse"],
  ["my aunt wants me to be circumcised", "abuse"],
  ["he keeps touching my private parts", "abuse"],
  ["he asks me to send nude pictures", "abuse"],
  ["a man keeps asking me for nudes", "abuse"],
  // Normalisation: "@" between letters.
  ["he r@ped me", "abuse"],
  // Self-harm: others happier without me.
  ["my family would be happier if I was gone", "self_harm"],
  ["they would be better off if I didnt exist", "self_harm"],
  ["people would be happier without me", "self_harm"],
  ["everyone would be better if I died", "self_harm"],
  // Abuse: secrecy about what we do.
  ["he says it is our secret", "abuse"],
  ["he tells me not to tell anyone what we do", "abuse"],
  // Abuse: "what we do at night / in the dark" with a negative cue.
  ["I hate what we do at night", "abuse"],
  ["I am scared of what we do in the dark", "abuse"],
  ["what we do at night is our secret", "abuse"],
  ["nobody knows what we do in his room", "abuse"],
  // Abuse: violence against others in the home.
  ["my dad hits us when he is drunk", "abuse"],
  ["he beats my mum", "abuse"],
  ["my father slaps my little sister", "abuse"],
  ["he hits them with a belt", "abuse"],
  // Abuse: threats to show photos.
  ["he says he will post my photos", "abuse"],
  ["she threatened to share my pictures online", "abuse"],
  ["he is going to send everyone my videos", "abuse"],
  // Abuse: not safe at home.
  ["I dont feel safe at home", "abuse"],
  ["I do not feel safe in my house", "abuse"],
  ["I am scared to go home", "abuse"],
  // Self-harm: "be dead", ending everything, can't go on, not being here.
  ["I want to be dead", "self_harm"],
  ["I just want to be dead", "self_harm"],
  ["I would rather be dead", "self_harm"],
  ["I want to end it all", "self_harm"],
  ["I feel like ending everything", "self_harm"],
  ["I cannot take this life anymore", "self_harm"],
  ["I cant take it anymore", "self_harm"],
  ["I cant go on like this", "self_harm"],
  ["I dont want to be here anymore", "self_harm"],
  ["I do not want to be on this earth", "self_harm"],
  // Abuse: violence with a body part or place after "in".
  ["he hits me in the face", "abuse"],
  ["he slaps me in front of people", "abuse"],
  ["he kicks me in the stomach", "abuse"],
  ["he beats me in class", "abuse"],
  // Abuse: photo threats with a condition after them.
  ["he will share my photos if I leave", "abuse"],
  ["post my pictures or else, he says", "abuse"],
];

/** Queries that must not be flagged, including idioms. */
const NEGATIVE = [
  "this exam is killing me",
  "I am dying to know what PrEP is",
  "my teacher threatened to fail me",
  "she beat me at chess",
  "you beat me to it",
  "beats me why my period is late",
  "I want to dye my hair",
  "can I hit the gym when pregnant",
  "what is PrEP",
  "I am so tired of exams",
  "the injection hurt",
  "can my boyfriend touch me during my period",
  "I am scared to ask my mother about periods",
  "my phone is dying",
  "this heat is killing me",
  "will the pill kill my chances of having a baby",
  "how do I end my period early",
  // Over-trigger risks for the newer families.
  "my parents said no to the party",
  "the doctor said no to antibiotics",
  "I hate maths",
  "I am tired of exams",
  "I want this lesson to end",
  "when will my period end",
  "I want to end things with my boyfriend",
  "I was thinking about how to end it with my boyfriend",
  "do not tell my parents I asked about contraception",
  "can you keep a secret",
  "my teacher said not to tell the answers",
  "my email is mary@school",
  // Laughter idioms must not match "want to die".
  "I want to die laughing",
  "I was dying laughing at that",
  "I want to die of laughter at this",
  // Games and sport.
  "she beat us in the match",
  "he beat them at football",
  "our team beat them during the game",
  "he hit us with the ball by accident",
  // Ordinary photo, home and secret questions.
  "can I send my photos to the clinic",
  "how do I share my pictures safely",
  "I feel safe at home",
  "I am excited to go home",
  "what we do in biology class is boring",
  "the secret to clear skin",
  // "Be dead" without a first-person wish.
  "my phone battery is dead",
  "I was dead tired after school",
  // "Can't take" with an ordinary object.
  "I cant take the pill anymore",
  "I cannot take this heat anymore",
  "I dont want to be here at this school",
  // Games after "in".
  "our team beat us in the football match",
  "she beat me in the exam",
  // "What we do" without a secrecy cue; photos without a threat cue.
  "my friends and I, what we do together on weekends",
  "what we do at night",
  "I love what we do at night, we study together",
  "my mum wants to post my photos",
];

module.exports = { POSITIVE, NEGATIVE };
