/**
 * Help-rule cases shared by helpSignposting.test.js and the offline
 * parity test (offlineSafetyParity.test.js): POSITIVE messages are
 * generic help requests, NEGATIVE ones are not.
 */

const HELP_POSITIVE = [
  "Where can I get help?",
  "where can i get help",
  "WHERE CAN I FIND HELP",
  "How can I get some help?",
  "Where can I go for help?",
  "Where do I turn for help?",
  "Who can I talk to?",
  "Who should I speak to?",
  "Is there someone I can talk to?",
  "I want to talk to someone",
  "I need someone to talk to",
  "I need help",
  "I need some help!!",
  "Can someone help me?",
  "Could anyone help me please",
  "Can you help?",
  "Help",
  "Help me",
  "Hi, where can I get help?",
];

const HELP_NEGATIVE = [
  "Where can I get birth control?",
  "Help me understand the HIV window period",
  "I need help with contraception",
  "Who can I talk to about my period?",
  "Can someone help me get the morning after pill?",
  "Where can I get help with an STI test?",
  "I need help, I think I'm pregnant",
  "Where can I get help if the condom broke?",
  "Is the clinic helpful?",
  "What is the helpline number for HIV testing?",
  "Help me find a clinic for contraception",
  "Who can I talk to at the clinic about PrEP?",
  "I fear that I am pregnant",
  "Is the clinic confidential?",
  "What is consent?",
  "helping a friend who might be pregnant",
  "I need help paying for antenatal checkups",
  "Where can I get condoms?",
  "",
  "   ",
];

module.exports = { HELP_POSITIVE, HELP_NEGATIVE };
