# Requirements from the approved proposal (August 2026)
Note: the 'Preliminary note' column is the starting hypothesis only. It is superseded by docs/requirements-traceability.md, which records what the code and tests show.

Source: the SafeGirl proposal, Section 4.2 (verbatim text). The "Preliminary note" column is a starting point only. Every note must be checked against the code, tests and results in this repository before it is used in the report.

## Functional requirements

| ID | Requirement | Preliminary note |
|---|---|---|
| FR-01 | The system classifies an incoming SRH query into one of four categories using the keyword baseline or the fine-tuned classifier. | Likely met. Check the live path and the keyword fallback. |
| FR-02 | The system independently checks every query for distress, GBV, or crisis language, regardless of classification outcome. | Likely met; recall is limited (sealed hold-out 3: 6/14). |
| FR-03 | Where a query is not flagged, the system retrieves category-scoped evidence and generates a grounded response. | Deviation: answers are extractive, not generated; retrieval is scoped only when the classifier is confident. |
| FR-04 | Where a query is flagged, the system suppresses the classification-retrieval-generation pipeline and returns referral guidance instead. | Likely met. Verify suppression. |
| FR-05 | The system displays a privacy and safety disclaimer once per session, before any query is processed. | Verify in the interface. |
| FR-06 | The system allows a session to end without persisting conversation content beyond that session. | Likely met (chat only in memory). Verify. |

## Non-functional requirements

| ID | Requirement | Preliminary note |
|---|---|---|
| NFR-01 | The keyword baseline remains interpretable, with its routing decision traceable to matched keywords and priority order. | Verify. |
| NFR-02 | The safety check operates independently of the intent classifier, dispatched in parallel rather than sequentially. | Deviation: the Safety Net runs first, before classification. Justification must come from the decision log. |
| NFR-03 | No personally identifiable information or real health records are used in training or evaluation data. | Likely met (synthetic data). Verify. |
| NFR-04 | The system does not require account creation or persistent login for any core function. | Likely met (anonymous auth). |
| NFR-05 | The fine-tuned classifier is evaluated against the frozen keyword baseline under identical, controlled conditions. | Likely met (baseline frozen 2026-08-27). |

## Data requirements

| ID | Requirement | Preliminary note |
|---|---|---|
| DR-01 | The intent-classification dataset shall contain labelled examples representing the four supported SRH categories: contraception, STIs, pregnancy, and general youth-friendly services. | Verify. |
| DR-02 | Training, validation, and test data shall be separated at the seed-question level rather than the individual paraphrase level to prevent data leakage. | Verify from the training log. |
| DR-03 | Dataset content shall be traceable to an authoritative source at the point of seed creation. | Verify. |
| DR-04 | The independent test set shall be constructed through a process distinct from training-data generation. | A DR-04 set exists; distinguish it from the pending external expert test. |
| DR-05 | Dataset examples shall undergo review to identify and remove duplicate, ambiguous, unsuitable, or incorrectly labelled content before use in model training or evaluation. | Label review exists; verify. |
| DR-06 | GBV-related content shall remain excluded from the knowledge base until appropriate authoritative source material and competent review have been confirmed. | Verify. |
| DR-07 | Sheng and English-Swahili code-switched queries shall remain excluded from the classification dataset until appropriate source coverage and competent review have been confirmed. | Verify. |
| DR-08 | The system shall not use real patient records or personally identifiable health information in training, validation, or evaluation data. | Likely met. Verify. |

## Interface and integration requirements

| ID | Requirement | Preliminary note |
|---|---|---|
| IR-01 | The system shall provide a user interface through which an anonymous adolescent user can submit an SRH query and receive a system response. | Met (PWA). |
| IR-02 | The system shall use Firebase Anonymous Authentication for session-scoped authentication without requiring identifying credentials from the user. | Met. |
| IR-03 | The system shall interface with the Google Gemini API for response generation, subject to the applicable service terms and limitations. | Deviation: no Gemini in the system. Extractive answers approved by the supervisor on 12 October 2026. A standalone probe exists on a local branch. |
| IR-04 | The retrieval component shall interface with the knowledge base through LlamaIndex and sentence-transformers to retrieve evidence relevant to the classified SRH category. | Check whether LlamaIndex is actually used; the implementation uses a sentence-transformers model. |
| IR-05 | The system shall handle invalid or unavailable responses from integrated services without exposing internal processing details to the user. | Likely met (timeouts, limited mode). Verify. |

## Other proposal commitments that differ from the build (check each)

- Section 3.6.7 and 3.7.4: RAG evaluated with RAGAS (faithfulness, context precision, answer relevancy). Faithfulness is trivially satisfied by extractive answers.
- Section 3.7.1: DistilBERT fine-tuned on Google Colab. Confirm where V3 was trained.
- Section 4.4.2: Firestore data design. The implementation stores no Firestore records; Firebase is used only for anonymous sign-in.
- Chapter 4 activity and sequence diagrams show a parallel safety and classification fork and a Gemini step. Both differ from the build.
