# History rewrite map (2026-10-15)

On 2026-10-15, attribution lines were removed from 22 commit messages: 20
`Co-Authored-By: Claude ...` trailers and 2 pairs of `Co-Authored-By` and
`Claude-Session` lines, all from 23 and 24 September 2026. **The content
is unchanged.** Every rewritten commit has an identical tree, author,
committer and dates to the original, verified against a full backup
bundle. Each changed message differs from the original only by the
removed lines.

Because a commit's hash depends on its parent's, every commit from the
first of those 22 onwards also got a new hash, although its message and
content are identical. That is 136 commits in all. The tag
`v2.0-classifier-validated`, `main` and every commit before 23 September
are unchanged.

Old hashes still appear in a few places, now with the new hash beside
them ("before history cleanup; now ..."). The file name
`research/eval/results/safety_holdout_3_SEALED_8a083cf.csv` keeps the old
hash on purpose: `8a083cf` is now `be91073`.

How it was done: `git filter-repo` in partial mode (`--refs`, everything
from the parent of the first attribution commit onwards) with a message
callback that removed only those lines, and with
`--preserve-commit-hashes`, so hashes quoted inside other commit
messages were left as they were.

| Old | New | Message changed | Subject |
|---|---|---|---|
| `57aecdb` | `8f54fe2` |  | chore: exclude ML checkpoint directory from version control |
| `6682846` | `b20ebb8` |  | chore: gitignore ml_service venv |
| `6ff1561` | `cf2cab4` |  | chore: gitignore ml_service checkpoint directory |
| `7e76fac` | `447b3bd` | yes | feat: V3.1 euphemism-fix retrain, STI recall 0%% -> 75%% on holdout |
| `d786825` | `d270653` |  | feat(ml-service): add FastAPI inference service for V2 classifier |
| `f46f6a4` | `98213ff` | yes | feat: add euphemism holdout handling to V3 training pipeline |
| `187dfa6` | `020385d` | yes | ci: run lint and format checks, move to Node 24 LTS |
| `217fe7a` | `25be907` | yes | fix: correct KB generator paths and README test command |
| `2ca9c95` | `ec68d36` | yes | feat(interface): restore restyle and offline pipeline edits |
| `3b94c59` | `25987ac` | yes | chore: normalise line endings to LF and add editorconfig |
| `3b98669` | `d197650` | yes | chore(gateway): npm audit fix for uuid advisory |
| `4d9be53` | `dd7020f` |  | fix(frontend): add Firebase SDK dependency |
| `5e3a376` | `041d988` | yes | fix(gateway): declare firebase-admin and use its modular API |
| `5e93604` | `e7591f5` | yes | chore: ignore firebase service account files at any path |
| `6f929aa` | `1907e7d` | yes | chore(research): track V3 experiment scripts and training logs |
| `837ab02` | `d9d65ac` | yes | style: apply Prettier formatting to gateway and interface |
| `89e9353` | `dcc93ec` | yes | chore(interface): stop tracking dist build output |
| `94176c0` | `4875a93` | yes | fix(gateway): restore classifier hierarchy lost in 03bf3d8 |
| `97abe44` | `a5caaef` | yes | refactor(research): move notebooks/classifier to research/experiments |
| `9881376` | `73d76cd` | yes | refactor(gateway): move app/backend to app/gateway |
| `a3a5dfa` | `6d23cb4` | yes | refactor(resources): move knowledge-base to resources/knowledge_base |
| `a79be45` | `dfc5ad8` |  | (docs):Revise README for project overview and updates |
| `ad7098a` | `8df4f3c` | yes | refactor(interface): move app/frontend to app/interface |
| `b6e6318` | `7681e5d` |  | Merge pull request #22 from captainblissdev/chore/lint-format |
| `b7f56e3` | `58e80b8` | yes | refactor: update references to renamed paths |
| `ba0b8c1` | `53e65f8` |  | Merge pull request #21 from captainblissdev/restructure/folder-naming |
| `beecb4a` | `253cb63` | yes | chore: add ESLint and Prettier to gateway and interface |
| `e1716f3` | `018b7f9` | yes | fix(interface): resolve type-aware lint findings |
| `e41f3e4` | `727f64c` | yes | refactor(resources): move dataset to resources |
| `fe42be3` | `bb73c2e` | yes | chore: ignore Python venvs and versioned classifier checkpoints |
| `0c0f8a4` | `860dd37` |  | feat(ml_service): wire knowledge-base retrieval and /retrieve endpoint |
| `142617b` | `c2d3970` |  | fix(ml_service): correct stale V2 references to V3 |
| `32e6333` | `cc300ab` |  | fix(ml_service): add sentence-transformers and numpy to requirements |
| `3571a2a` | `dded207` |  | feat(ml_service): generate knowledge base from markdown source, embed title with content |
| `57326ba` | `35515d3` |  | feat(ml_service): add build_kb.py and generated knowledge_base.json |
| `8089406` | `78816c3` |  | fix(ml_service): keep /classify up when the retriever fails to load |
| `822fbb0` | `0cafc8c` |  | fix(gateway): flag GBV-specific consent-violation phrasing in safety net |
| `eda921f` | `6b55d3a` |  | fix(gateway): never return a null message when retrieval finds no entry |
| `0394e4a` | `abe508a` |  | refactor(gateway): build the Express app with createApp |
| `05ddcb4` | `6de39f8` |  | fix(gateway): return 503 when ID tokens cannot be verified |
| `1002263` | `262e1a6` |  | feat(gateway): report retrievalScope in query responses |
| `1162dbc` | `bd9c0dc` |  | test(interface): cover the query client and anonymous session |
| `1cc7929` | `b43dc79` |  | feat(gateway): route classification and retrieval through classifierClient |
| `203aae7` | `a4778f2` |  | feat(gateway): add injectable auth middleware and fail-closed auth config |
| `3752e33` | `2b57b12` |  | feat(gateway): add classifierClient for ml_service classify and retrieve |
| `4302c4d` | `f2778d5` |  | docs: document the abstain threshold and retrievalScope |
| `4c9aed1` | `875c368` |  | feat(interface): add retrievalScope to QueryResponse |
| `4cf48e3` | `e423e01` |  | feat(gateway): require anonymous auth on POST /api/query |
| `51951ba` | `b9cdb35` |  | fix(gateway): stop leaking request text in error handling |
| `8495e28` | `885818e` |  | feat(interface): sign in anonymously in memory and send the ID token |
| `903e362` | `8dd70c5` |  | docs: document classifier service environment variables |
| `94ba873` | `939fef0` |  | feat(interface): add classifier and answer fields to QueryResponse |
| `a21a69c` | `ea6100b` |  | Merge pull request #24 from captainblissdev/feature/classifier-inference-integration |
| `a8c7e0b` | `01fab60` |  | Merge pull request #25 from captainblissdev/feature/gateway-classifier-wiring |
| `bbc324c` | `efd004f` |  | feat(gateway): abstain from retrieval below a confidence floor |
| `e7618c4` | `40ef9d2` |  | docs: document gateway authentication configuration |
| `e7da015` | `aae35d4` |  | docs: describe the implemented anonymous authentication |
| `0496c76` | `fa838d2` |  | fix(gateway): final Safety Net patch round before the freeze |
| `1002e58` | `1527581` |  | fix(kb): write the offline KB with LF line endings |
| `13772a3` | `7ab9370` |  | Merge pull request #28 from captainblissdev/feature/kb-ratified-entries |
| `23cf510` | `21f4480` |  | Merge pull request #29 from captainblissdev/feature/retrieval-eval |
| `2567d62` | `ae6f2f1` |  | feat(gateway): signpost generic help requests and widen the no-answer message |
| `31e89fb` | `12aa496` |  | docs: describe the Safety Net categories and referral messages |
| `36d08d9` | `9fb6463` |  | fix(kb): replace consent claims with interim wording |
| `37650c0` | `e425846` |  | fix(kb): hold KB-P2 and KB-S2 pending a rewrite after legal review |
| `42366d6` | `f27db1f` |  | feat(kb): add 15 ratified knowledge-base entries |
| `465d5fe` | `fcfc2e3` |  | fix(gateway): widen Safety Net coverage for indirect disclosures |
| `48ee860` | `34d6edf` |  | fix(kb): bring the interim consent wording to the offline KB |
| `626f5b5` | `2eb058e` |  | test(eval): record what the pipeline returns for the hold-out 3 safety misses |
| `730be0d` | `bb1ee1c` |  | feat(gateway): replace the abuse referral placeholder with interim text |
| `8a083cf` | `be91073` |  | docs: describe the new Safety Net families and offline message parity |
| `927a9ca` | `2233e91` |  | feat(interface): bring the offline Safety Net to parity with the gateway |
| `9c4bb19` | `227fd28` |  | docs: update the Safety Net section with categories and known limits |
| `a3ad17d` | `027dcdd` |  | Merge pull request #27 from captainblissdev/feature/help-signposting |
| `a3f96d4` | `036e034` |  | fix(gateway): extend Safety Net coverage to self-harm, abuse and threats |
| `a4a156a` | `588d6c3` |  | chore(kb): reformat the offline KB (raw characters, LF, final newline) |
| `ae2a293` | `4f00b79` |  | docs: describe the real request order instead of parallel dispatch |
| `b6cc3e2` | `a39d92f` |  | feat(interface): use the gateway referral messages offline |
| `b8a21e7` | `6db6614` |  | test(eval): add the retrieval development evaluation set |
| `ba2bdca` | `441ed3d` |  | Merge pull request #26 from captainblissdev/feature/anonymous-auth |
| `c78e329` | `6cb5137` |  | feat(eval): add the retrieval evaluation harness |
| `cc40e30` | `3c4d075` |  | docs: note the KB review status and describe semantic retrieval |
| `dadabb8` | `d1893c6` |  | fix(kb): drop the WHO caveat from KB-C2's interim answer |
| `ddbce10` | `bb9ca08` |  | docs: describe the retrieval evaluation harness |
| `ef8b988` | `778f18a` |  | feat(interface): add the signposting outcome to QueryResponse |
| `f02930c` | `fdd9ce2` |  | test(eval): record the first retrieval evaluation run |
| `f354ba6` | `29b4468` |  | fix(gateway): widen Safety Net patterns by category |
| `f97c650` | `dc69962` |  | feat(gateway): add a separate referral message for self-harm |
| `044b612` | `de54f9a` |  | docs(eval): write up the classifier and relevance analysis |
| `0b6fb9d` | `af80478` |  | feat(interface): make the topic chips fill in an example question |
| `0ea5f3d` | `07dfec7` |  | feat(experiments): add a standalone Gemini grounded vs ungrounded probe |
| `2777d01` | `3bcefb7` |  | feat(interface): add playful decoration, calm on the referral screen |
| `2f38848` | `0b1b20c` |  | docs(design): record the playful update |
| `329359f` | `fd2dca5` |  | test(eval): track the three Safety Net hold-out sets |
| `39d915c` | `3962d09` |  | feat(interface): add an opt-in details line under each answer |
| `46faa34` | `12dde1c` |  | feat(interface): friendlier prompts and 'You could also ask' follow-ups |
| `525b41c` | `b4c4d29` |  | fix(gateway): restore a narrow 'what we do at night' rule and flag 'beats me in class' |
| `5307ab4` | `c5204c5` |  | docs(design): add contrast ratios and Lighthouse before/after |
| `5646010` | `c757f08` |  | feat(interface): add a wide-screen sidebar with New chat and an anonymous card |
| `5689f03` | `06fdfe0` |  | style(interface): system fonts, 16px text, 44px targets and one focus ring |
| `56acbad` | `100ef3c` |  | feat(interface): add a standing 'Need help now?' panel and a wide-screen support panel |
| `67f66c5` | `4b75f3d` |  | style(interface): restyle the screens to the approved wireframe |
| `6c37799` | `1affc42` |  | test(eval): run every suggested question through the full stack |
| `6e684ab` | `87093cc` |  | test(eval): V3 and keyword-baseline calibration and per-class errors |
| `70b6db5` | `6395604` |  | fix(interface): announce the typing indicator politely to screen readers |
| `756d46e` | `d1256af` |  | feat(interface): add app icons and a favicon, and match the manifest colours |
| `7a2a15f` | `ef4fbee` |  | test(eval): reproduce the sealed hold-out 3 Safety Net run at 8a083cf |
| `7b552ab` | `2846276` |  | feat(interface): state the scope in the greeting and make the privacy wording exact |
| `7f19c20` | `aa16fdc` |  | test(eval): provisional class labels, label review and analysis inputs |
| `86cacb8` | `20ec1ac` |  | feat(interface): give each topic chip an icon and its own pastel colour |
| `8fa8bd3` | `bb34091` |  | test(interface): guard the self-hosted font setup |
| `a537f1e` | `5db1f88` |  | feat(interface): time out slow queries and sign-ins, and cancel superseded queries |
| `a8c4bdd` | `26c9945` |  | feat(interface): add gentle motion to the chat |
| `a916627` | `aa279ec` |  | fix(interface): never answer /api or /health navigations with the app shell |
| `ab25e35` | `5b17ec2` |  | style(interface): replace the teal and coral palette with purple and lavender tokens |
| `b000213` | `3d7a977` |  | feat(interface): say when an answer comes from limited mode |
| `b630734` | `cc6d626` |  | docs(design): add interface screenshots at 390px and 1280px |
| `c37e23b` | `e3af7da` |  | fix(interface): centre the note on the session end card |
| `c403600` | `7a3d2f0` |  | test(eval): relevance signal for when not to answer |
| `d3d4464` | `d75677b` |  | docs(testing): record the PWA audit and the Lighthouse reports |
| `d8bfc42` | `cb06354` |  | Merge pull request #31 from captainblissdev/feature/pwa-hardening |
| `db470eb` | `a19de5f` |  | style(interface): regenerate the app icons in the purple palette |
| `dca8d0c` | `fd9c96c` |  | test(eval): record post-patch Safety Net regression results |
| `de6b74f` | `996b4bc` |  | style(interface): use Nunito, a rounded friendly font, self-hosted |
| `de996a0` | `f8a394a` |  | fix(interface): offer follow-ups only after a full answer |
| `e61daad` | `30df07a` |  | test(interface): document the four interface test suites |
| `f1afb45` | `bf4e772` |  | Merge pull request #30 from captainblissdev/feature/safety-net-coverage |
| `f793af7` | `7071232` |  | docs(design): record the re-theme against the wireframes |
| `1801c88` | `82ffc25` |  | Merge remote-tracking branch 'origin/development' into feature/ui-theme |
| `1b6b166` | `e9980ed` |  | Merge pull request #32 from captainblissdev/feature/ui-theme |
| `1c81cb3` | `1b13a65` |  | Merge pull request #34 from captainblissdev/docs/safety-net-evaluation |
| `4b5c04a` | `112e9d5` |  | docs(safety): write the Safety Net evaluation |
| `4c8300d` | `94611e6` |  | fix(interface): replace the fragile Q14 follow-up with Q15 |
| `90d12b4` | `a33174f` |  | Merge pull request #35 from captainblissdev/analysis/classifier-relevance |
| `99ff237` | `8190596` |  | docs(decisions): freeze the Safety Net patterns and the demo state |
| `a654081` | `0c49f04` |  | Merge pull request #33 from captainblissdev/feature/ui-playful |
